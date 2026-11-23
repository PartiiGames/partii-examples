import { createPartii } from "./partii";
import { createUnlocks, priceOf } from "./unlock";

const ITEM = "gold-skin";
const partii = createPartii();
const unlocks = createUnlocks(partii);
const button = document.querySelector<HTMLButtonElement>("#buy")!;
const state = document.querySelector<HTMLElement>("#state")!;

async function draw() {
  await unlocks.refresh();
  const q = await priceOf(partii, ITEM);
  state.textContent = unlocks.owns(ITEM) ? "Gold skin: unlocked" : "Gold skin: locked";
  button.textContent = `Unlock for ${q.price_pops} Pops`;
  button.hidden = unlocks.owns(ITEM);
}
// From a tap: browsers block popups that aren't.
button.addEventListener("click", async () => {
  const r = await unlocks.unlock(ITEM);
  if (!r.ok && r.reason === "popup_blocked" && r.url) window.open(r.url, "_blank");
  await draw();
});
void draw();
