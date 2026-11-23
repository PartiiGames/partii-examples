// Gameplay analytics for a web game on Partii: queue events, send them every 30 s and when the page
// hides or closes, one session per page load with session_end {secs}. Partii drops a bad event
// silently (the reply only counts it in `dropped`), so checkEvent() refuses the same events here,
// loudly, before they're sent. The rules are Partii's edge rules (docs/API.md "What the server
// silently drops"); test/analytics.test.ts proves this file and the server agree.
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/06-analytics/src/analytics.ts
import type { Partii } from "./partii";

export type Props = Record<string, string | number | boolean>;

interface QueuedEvent {
  name: string;
  at: number;
  session: string;
  props: Props;
}

/** Partii's limits (edge/src/api/analytics.ts). */
export const LIMITS = { eventsPerCall: 100, propsBytes: 1024, stringChars: 200, callsPerMinute: 60 };
const NAME = /^[a-z][a-z0-9_.]{0,47}$/;
const PROP = /^[A-Za-z0-9_]{1,40}$/;
const SESSION = /^[A-Za-z0-9_-]{1,64}$/;

/** Why Partii would drop this event, or null when it will be kept. */
export function checkEvent(name: string, props: unknown = {}): string | null {
  if (!NAME.test(name)) return `event name "${name}" must match [a-z][a-z0-9_.]{0,47} (lowercase, starts with a letter, at most 48)`;
  if (props === null || props === undefined) return null;
  if (typeof props !== "object" || Array.isArray(props)) return "props must be a flat object";
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (!PROP.test(k)) return `prop key "${k}" must be 1-40 of [A-Za-z0-9_] (no dashes, dots or spaces)`;
    if (typeof v === "string") {
      if (v.length > LIMITS.stringChars) return `prop ${k} is ${v.length} characters (at most ${LIMITS.stringChars})`;
    } else if (typeof v === "number") {
      if (!Number.isFinite(v)) return `prop ${k} is ${v} (numbers must be finite)`;
    } else if (typeof v !== "boolean") {
      return `prop ${k} is ${v === null ? "null" : Array.isArray(v) ? "an array" : typeof v} (only strings, numbers and bools)`;
    }
  }
  const bytes = JSON.stringify(props).length;
  if (bytes > LIMITS.propsBytes) return `props are ${bytes} bytes as JSON (at most ${LIMITS.propsBytes})`;
  return null;
}

export interface AnalyticsOptions {
  partii: Partii;
  /** The game's version: up to 32 of [A-Za-z0-9._+-] ("1.2.0", not "1.2 beta": that is blanked). */
  version: string;
  /** "web" by default; up to 16 of [a-z0-9_-]. */
  platform?: string;
  /** A build name ("staging", "itch"): up to 32 of [A-Za-z0-9._+-]. */
  build?: string;
  /** Where pagehide / visibilitychange come from: window in a page, an EventTarget in tests. */
  target?: EventTarget;
  /** How often to send (ms). 30 s keeps a device far under 60 calls a minute. */
  intervalMs?: number;
  /** Called with each refused event (dev builds: console.warn). */
  onRefused?: (name: string, reason: string) => void;
}

export interface Analytics {
  track(name: string, props?: Props): boolean;
  /** Send what's queued. `closing`: the page is going away, so it goes as a beacon. */
  flush(closing?: boolean): Promise<void>;
  /** Queue session_end {secs} and send everything as a beacon. Called on pagehide for you. */
  end(): void;
  stop(): void;
  session: string;
  stats: { queued: number; accepted: number; droppedHere: number; droppedByServer: number; failedCalls: number };
}

const newId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function createAnalytics(o: AnalyticsOptions): Analytics {
  const { partii } = o;
  const session = newId(); // 32 hex: fits the session rule ([A-Za-z0-9_-], at most 64)
  if (!SESSION.test(session)) throw new Error("session id breaks Partii's rule");
  const started = Date.now();
  const queue: QueuedEvent[] = [];
  const MAX_QUEUE = 500;
  let ended = false;
  let flushing: Promise<void> | null = null;
  const stats = { queued: 0, accepted: 0, droppedHere: 0, droppedByServer: 0, failedCalls: 0 };
  const refused = o.onRefused ?? ((name: string, reason: string) => console.warn(`[analytics] dropped ${name}: ${reason}`));

  const batch = (events: QueuedEvent[]) => ({
    device: partii.deviceId(),
    platform: o.platform ?? "web",
    version: o.version,
    ...(o.build ? { build: o.build } : {}),
    events,
  });

  function track(name: string, props: Props = {}): boolean {
    if (ended) return false;
    const why = checkEvent(name, props);
    if (why) {
      stats.droppedHere++;
      refused(name, why);
      return false;
    }
    queue.push({ name, at: Date.now(), session, props });
    stats.queued++;
    // Offline for a long time: keep the newest events, not an ever-growing backlog.
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    return true;
  }

  async function sendNow(): Promise<void> {
    while (queue.length) {
      const events = queue.splice(0, LIMITS.eventsPerCall);
      try {
        const r = (await partii.api.analyticsIngest(partii.cfg.game, batch(events))) as { accepted: number; dropped: number };
        stats.accepted += r.accepted;
        stats.droppedByServer += r.dropped;
        if (r.dropped) refused(`${r.dropped} event(s)`, "the server dropped them (see checkEvent; did a prop change shape?)");
      } catch (err) {
        stats.failedCalls++;
        const status = (err as { status?: number }).status ?? 0;
        // A 400 is this batch's own fault (a bad device id, too many events): sending it again fails
        // again forever, so it's dropped. Offline, 429 and 5xx: keep it for the next try.
        if (status === 400) refused(`${events.length} event(s)`, `batch refused: ${(err as Error).message}`);
        else queue.unshift(...events);
        return;
      }
    }
  }

  function beacon(): void {
    if (!queue.length) return;
    const events = queue.splice(0, LIMITS.eventsPerCall);
    // A closing page can't wait for an answer, and a beacon can't set headers: the key goes in the
    // address and the player token in the body (the edge reads both). text/plain needs no CORS preflight.
    const url = `${partii.cfg.api.replace(/\/$/, "")}/v1/games/${encodeURIComponent(partii.cfg.game)}/events?key=${encodeURIComponent(partii.cfg.key)}`;
    const token = partii.token();
    const body = JSON.stringify({ ...batch(events), ...(token ? { player_token: token } : {}) });
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (nav?.sendBeacon?.(url, body)) return;
    void fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  }

  async function flush(closing = false): Promise<void> {
    if (closing) return beacon();
    if (flushing) return flushing;
    flushing = sendNow().finally(() => (flushing = null));
    return flushing;
  }

  function end(): void {
    if (ended) return;
    // secs counts from the page load. A session can end more than once (hidden, then closed): the largest wins.
    track("session_end", { secs: Math.max(0, Math.round((Date.now() - started) / 1000)) });
    ended = true;
    void flush(true);
  }

  const target = o.target ?? (typeof window !== "undefined" ? window : undefined);
  const onHidden = () => {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc || doc.visibilityState === "hidden") void flush(true);
  };
  const onPagehide = () => end();
  target?.addEventListener("visibilitychange", onHidden);
  target?.addEventListener("pagehide", onPagehide);
  const timer = setInterval(() => void flush(false), o.intervalMs ?? 30_000);

  track("session_start", {});

  return {
    track,
    flush,
    end,
    stop() {
      clearInterval(timer);
      target?.removeEventListener("visibilitychange", onHidden);
      target?.removeEventListener("pagehide", onPagehide);
    },
    session,
    stats,
  };
}
