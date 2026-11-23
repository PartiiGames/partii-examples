// The Partii connection every example starts from: the client, this device's id and the player.
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/01-starter-shell/src/partii.ts
// The SDK it imports ("@partii/sdk") is installed by get-sdk.mjs, never copied.
import { createClient, PartiiError, type PartiiClient } from "@partii/sdk";

/** Where Partii is and who the game is. Vite fills these from .env.staging / .env.production. */
export interface PartiiConfig {
  api: string;
  /** The project's publishable key (pk_...). Public by design; a developer token never goes in a game. */
  key: string;
  game: string;
}

export function envConfig(): PartiiConfig {
  const env = import.meta.env;
  const cfg = { api: env.VITE_PARTII_API ?? "", key: env.VITE_PARTII_KEY ?? "", game: env.VITE_PARTII_GAME ?? "" };
  if (!cfg.api || !cfg.key.startsWith("pk_") || !cfg.game) {
    throw new Error("Set VITE_PARTII_API, VITE_PARTII_KEY (pk_...) and VITE_PARTII_GAME in .env.staging / .env.production");
  }
  return cfg;
}

/** Small key-value storage, so tests (and private browsing) work without localStorage. */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

/** localStorage when the browser allows it, else memory (Safari private mode, storage blocked). */
export function browserKV(): KV {
  try {
    const ls = globalThis.localStorage;
    const probe = "partii.probe";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) };
  } catch {
    return memoryKV();
  }
}

export interface Player {
  id: string;
  display_name: string;
  /** True while every sign-in is a device: a guest. Linking email (or Apple, Google, ...) makes it an account. */
  guest: boolean;
  providers: string[];
}

interface RawPlayer {
  id: string;
  display_name: string;
  providers?: string[];
}

export const asPlayer = (raw: RawPlayer): Player => {
  const providers = raw.providers ?? [];
  return { id: raw.id, display_name: raw.display_name, providers, guest: providers.every((p) => p === "device") };
};

export function errorMessage(err: unknown): string {
  if (err instanceof PartiiError) return err.hint ? `${err.message} (${err.hint})` : err.message;
  return err instanceof Error ? err.message : "Something went wrong";
}

export interface Partii {
  api: PartiiClient;
  cfg: PartiiConfig;
  store: KV;
  /** This install's id: 32 hex characters (the server takes 8–64 of [A-Za-z0-9_-]). */
  deviceId(): string;
  token(): string | null;
  rememberToken(token: string): void;
  forgetToken(): void;
  player(): Player | null;
  setPlayer(p: Player): void;
  /** Signs in as this device's guest (or the account it became). Safe to call many times. */
  ensurePlayer(displayName?: string): Promise<Player>;
}

export function createPartii(cfg: PartiiConfig = envConfig(), store: KV = browserKV()): Partii {
  const api = createClient({ base: cfg.api, key: cfg.key });
  const DEVICE = `${cfg.game}.partii.device`;
  const TOKEN = `${cfg.game}.partii.token`;
  let current: Player | null = null;
  let signingIn: Promise<Player> | null = null;

  const self: Partii = {
    api,
    cfg,
    store,
    deviceId() {
      const saved = store.get(DEVICE);
      if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      store.set(DEVICE, id);
      return id;
    },
    token: () => store.get(TOKEN),
    rememberToken(token) {
      store.set(TOKEN, token);
      api.setPlayerToken(token);
    },
    forgetToken() {
      store.remove(TOKEN);
      api.setPlayerToken(undefined);
    },
    player: () => current,
    setPlayer(p) {
      current = p;
    },
    ensurePlayer(displayName = "Player") {
      if (current) return Promise.resolve(current);
      signingIn ??= signIn(displayName).finally(() => (signingIn = null));
      return signingIn;
    },
  };

  async function signIn(displayName: string): Promise<Player> {
    const saved = self.token();
    if (saved) {
      api.setPlayerToken(saved);
      try {
        const me = (await api.playersMe()) as { player: RawPlayer };
        current = asPlayer(me.player);
        return current;
      } catch (err) {
        // Only a refused token is dropped. Offline (status 0) or a 5xx keeps it: forgetting it then
        // would make a new guest and the player's progress would look lost.
        if (!(err instanceof PartiiError) || (err.status !== 401 && err.status !== 403)) throw err;
        self.forgetToken();
      }
    }
    // The same device id always lands on the same player (or the account it signed in to).
    const made = (await api.playersGuest({ device_id: self.deviceId(), display_name: displayName })) as { player: RawPlayer; player_token: string };
    self.rememberToken(made.player_token);
    current = asPlayer(made.player);
    return current;
  }

  return self;
}
