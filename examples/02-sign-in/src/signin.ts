// Guest → account, sign out, sign back in. A guest signing in with email keeps its player id, saves,
// scores and items (the guest is upgraded in place, or merged into the account it already had).
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/02-sign-in/src/signin.ts
import { PartiiError } from "@partii/sdk";
import { asPlayer, type Partii, type Player } from "./partii";

interface Answer {
  player: { id: string; display_name: string; providers?: string[] };
  player_token: string;
  merged?: boolean;
}

/**
 * Step 1: email the player a 6-digit code. In production `code` never comes back (it's in their
 * inbox). Staging has no mail, so it answers {sent: false, code}: only tests may use that.
 */
export async function startEmail(partii: Partii, email: string): Promise<{ sent: boolean; code?: string }> {
  await partii.ensurePlayer();
  return (await partii.api.playersEmailStart({ email: email.trim() })) as { sent: boolean; code?: string };
}

export type SignInResult =
  | { ok: true; player: Player; merged: boolean }
  | { ok: false; reason: "bad_code" | "in_use" | "failed"; message: string; other?: { id: string; display_name: string } };

/**
 * Step 2: the code. Sent WITH the guest's token, so the guest becomes (or merges into) the account.
 * Without the token it would sign in fresh and the guest's progress would stay behind on the guest.
 */
export async function finishEmail(partii: Partii, email: string, code: string): Promise<SignInResult> {
  await partii.ensurePlayer();
  try {
    const r = (await partii.api.playersLogin({ provider: "email", email: email.trim(), code: code.trim(), display_name: partii.player()?.display_name })) as Answer;
    // The token changes: keep the new one, or the next call is still the old guest.
    partii.rememberToken(r.player_token);
    const player = asPlayer(r.player);
    partii.setPlayer(player);
    return { ok: true, player, merged: r.merged === true };
  } catch (err) {
    if (err instanceof PartiiError && err.code === "identity_in_use") {
      // This player already has a real account and the email belongs to ANOTHER real account: nothing changed.
      const other = err.body?.error?.other as { id: string; display_name: string } | undefined;
      return { ok: false, reason: "in_use", message: err.message, other };
    }
    if (err instanceof PartiiError && err.status === 401) return { ok: false, reason: "bad_code", message: err.message };
    return { ok: false, reason: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sign out on this device. The device moves to a NEW guest (the answer's player and token); the
 * account keeps everything. Calling playersGuest with the same device id afterwards gives that new
 * guest, not the account: only signing in again returns to it.
 */
export async function signOut(partii: Partii): Promise<Player> {
  const r = (await partii.api.playersLogin({ provider: "device", device_id: partii.deviceId(), sign_out: true })) as Answer;
  partii.rememberToken(r.player_token);
  const player = asPlayer(r.player);
  partii.setPlayer(player);
  return player;
}
