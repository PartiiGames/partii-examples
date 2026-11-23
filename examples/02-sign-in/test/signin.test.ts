// Guest → account on Partii staging: the guest's id and save survive the sign-in, sign-out gives
// a new guest, and signing in again returns to the account. Run: npm test
import { describe, expect, it } from "vitest";
import { createPartii, envConfig, memoryKV } from "../src/partii";
import { finishEmail, signOut, startEmail } from "../src/signin";

const cfg = envConfig();
const partii = createPartii(cfg, memoryKV());
// example.com never receives mail; staging returns the code instead of sending it.
const email = `partii-examples-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;

describe("sign-in on staging", () => {
  it("is staging", () => expect(cfg.api).toMatch(/staging/));

  let guestId = "";
  let accountId = "";

  it("starts as a guest with a save", async () => {
    const p = await partii.ensurePlayer("Sign-in test");
    expect(p.guest).toBe(true);
    guestId = p.id;
    await partii.api.savesPut(cfg.game, "progress", { data: { level: 3 }, base_rev: 0 });
  });

  it("signs in with an email code and keeps the same player and its save", async () => {
    const start = await startEmail(partii, email);
    expect(start.code, "staging returns the code; production emails it").toMatch(/^\d{6}$/);
    const r = await finishEmail(partii, email, start.code!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.player.guest).toBe(false);
    expect(r.player.providers).toContain("email");
    expect(r.player.id).toBe(guestId); // upgraded in place
    accountId = r.player.id;
    const save = (await partii.api.savesGet(cfg.game, "progress")) as { save: { data: { level: number } } };
    expect(save.save.data.level).toBe(3);
  });

  it("signs out to a new guest; the account is untouched", async () => {
    const guest = await signOut(partii);
    expect(guest.guest).toBe(true);
    expect(guest.id).not.toBe(accountId);
    await expect(partii.api.savesGet(cfg.game, "progress")).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a wrong code without changing anything, then signs in again to the account and its save", async () => {
    // Codes are limited: 3 per address per 15 minutes and 10 per network per hour. This file asks for 2.
    const start = await startEmail(partii, email);
    const wrong = await finishEmail(partii, email, start.code === "000000" ? "111111" : "000000");
    expect(wrong.ok).toBe(false);
    expect(partii.player()?.guest).toBe(true);
    const r = await finishEmail(partii, email, start.code!);
    expect(r.ok && r.player.id).toBe(accountId);
    const save = (await partii.api.savesGet(cfg.game, "progress")) as { save: { data: { level: number } } };
    expect(save.save.data.level).toBe(3);
  });
});
