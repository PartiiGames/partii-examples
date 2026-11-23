// Cloud saves: named JSON slots per player per game, with a revision number so two devices never
// overwrite each other blindly. Load gives {data, rev}; save sends base_rev = the rev you loaded.
// Another device wrote first → 409 conflict with `theirs`: merge, and write again on top of theirs.
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/03-save-load/src/saves.ts
import { PartiiError } from "@partii/sdk";
import type { Partii } from "./partii";

/** Slot names: 1-64 of [A-Za-z0-9._-]. */
export const SLOT = /^[A-Za-z0-9._-]{1,64}$/;
/** As JSON text: a guest's save is at most 256 KB (403 account_needed, reason save_size); an account's 2 MB. */
export const LIMITS = { guestBytes: 256 * 1024, accountBytes: 2 * 1024 * 1024, keptRevisions: 20 };

export type Merge<T> = (mine: T, theirs: T) => T;

/** Union of two objects; for each key the larger number wins, else mine. Write your own for real games. */
export const mergeObjects: Merge<Record<string, unknown>> = (mine, theirs) => {
  const out: Record<string, unknown> = { ...theirs };
  for (const [k, v] of Object.entries(mine)) {
    const t = theirs[k];
    out[k] = typeof v === "number" && typeof t === "number" ? Math.max(v, t) : v;
  }
  return out;
};

export interface Slot<T> {
  data: T | null;
  /** 0: never written. Send it back as base_rev on the next save. */
  rev: number;
}

export function createSaves<T>(partii: Partii, slot: string, merge: Merge<T>) {
  if (!SLOT.test(slot)) throw new Error(`slot "${slot}" must be 1-64 of [A-Za-z0-9._-]`);
  let rev = 0;

  async function load(): Promise<Slot<T>> {
    await partii.ensurePlayer();
    try {
      const r = (await partii.api.savesGet(partii.cfg.game, slot)) as { save: { data: T; rev: number } };
      rev = r.save.rev;
      return { data: r.save.data, rev };
    } catch (err) {
      // 404: nothing saved yet. That is normal for a new player, not an error.
      if (err instanceof PartiiError && err.status === 404) {
        rev = 0;
        return { data: null, rev: 0 };
      }
      throw err;
    }
  }

  /** Writes data on top of the last rev this device saw; merges and retries once on a conflict. */
  async function save(data: T): Promise<Slot<T>> {
    await partii.ensurePlayer();
    const size = JSON.stringify(data).length;
    if (size > LIMITS.accountBytes) throw new Error(`save is ${size} bytes; the limit is ${LIMITS.accountBytes}`);
    let next = data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = (await partii.api.savesPut(partii.cfg.game, slot, { data: next, base_rev: rev })) as { save: { rev: number } };
        rev = r.save.rev;
        return { data: next, rev };
      } catch (err) {
        if (!(err instanceof PartiiError) || err.code !== "conflict") throw err;
        const theirs = err.body?.theirs as { data: T; rev: number } | null;
        // Never write the stale copy again: merge onto theirs, then save at their rev.
        next = theirs ? merge(next, theirs.data) : next;
        rev = theirs?.rev ?? 0;
      }
    }
    throw new Error("the save kept changing on another device; try again");
  }

  return { load, save, rev: () => rev };
}
