import { createPartii } from "./partii";
import { createSaves, mergeObjects } from "./saves";

const partii = createPartii();
const saves = createSaves<Record<string, unknown>>(partii, "progress", mergeObjects);
const out = document.querySelector<HTMLElement>("#out")!;
let coins = 0;
saves.load().then((s) => {
  coins = Number(s.data?.coins ?? 0);
  out.textContent = `coins: ${coins} (rev ${s.rev})`;
});
document.querySelector("#add")!.addEventListener("click", async () => {
  coins++;
  const s = await saves.save({ coins });
  out.textContent = `coins: ${coins} (rev ${s.rev})`;
});
