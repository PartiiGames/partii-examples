// Script errors to Partii as they happen: window "error" and "unhandledrejection". Partii groups
// reports of the same bug (numbers in the message don't split a group) and shows them in
// `partii errors list <game>` and on partii.games/dev.
// copied from PartiiGames/partii-examples@f051b33 examples/01-starter-shell/src/errors.ts
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/01-starter-shell/src/errors.ts
import type { Partii } from "./partii";

export interface ErrorReporterOptions {
  partii: Partii;
  version: string;
  /** The analytics session, so a crash links to what the player did. */
  session?: string;
  /** window in a page; an EventTarget in tests. */
  target?: EventTarget;
}

export interface ErrorReporter {
  report(message: string, stack?: string, context?: Record<string, string | number | boolean>): Promise<string[] | null>;
  stop(): void;
}

export function installErrorReporting(o: ErrorReporterOptions): ErrorReporter {
  const seen = new Set<string>();
  let sentThisMinute = 0;
  const minute = setInterval(() => (sentThisMinute = 0), 60_000);

  async function report(message: string, stack = "", context: Record<string, string | number | boolean> = {}) {
    const text = message.trim().slice(0, 2000);
    // One report per distinct error per page load, and at most 10 a minute: a loop that throws every
    // frame must not hit Partii's limit (30 calls a minute per device) and lose the first, useful one.
    if (!text || seen.has(text) || sentThisMinute >= 10) return null;
    seen.add(text);
    sentThisMinute++;
    try {
      const r = (await o.partii.api.errorsIngest(o.partii.cfg.game, {
        device: o.partii.deviceId(),
        platform: "web",
        version: o.version,
        errors: [{ kind: "error", message: text, backtrace: stack.slice(0, 16_000), session: o.session, at: Date.now(), context }],
      })) as { groups: string[] };
      return r.groups;
    } catch {
      return null; // never throw from the error reporter
    }
  }

  const target = o.target ?? (typeof window !== "undefined" ? window : undefined);
  const onError = (e: Event) => {
    const ev = e as ErrorEvent;
    // A missing image or script also fires "error" (on the element, seen here in the capture phase):
    // that isn't a script error, and has no message.
    if (!ev.message && !(ev.error instanceof Error)) return;
    void report(ev.message || String(ev.error), ev.error instanceof Error ? (ev.error.stack ?? "") : "");
  };
  const onRejection = (e: Event) => {
    const reason = (e as PromiseRejectionEvent).reason;
    if (reason instanceof Error) void report(reason.message, reason.stack ?? "");
    else void report(String(reason));
  };
  target?.addEventListener("error", onError);
  target?.addEventListener("unhandledrejection", onRejection);

  return {
    report,
    stop() {
      clearInterval(minute);
      target?.removeEventListener("error", onError);
      target?.removeEventListener("unhandledrejection", onRejection);
    },
  };
}
