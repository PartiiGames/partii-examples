import { createLeaderboard, resetsIn } from "./leaderboard";
import { createPartii } from "./partii";

const partii = createPartii();
const board = createLeaderboard(partii, "examples-score");
const list = document.querySelector<HTMLOListElement>("#top")!;
const me = document.querySelector<HTMLElement>("#me")!;
let run = 0;

async function draw() {
  const b = await board.top("daily", 10);
  list.replaceChildren(...b.entries.map((e) => Object.assign(document.createElement("li"), { textContent: `${e.display_name}: ${e.score}` })));
  me.textContent = b.me ? `You: ${b.me.score} (#${b.me.rank}) · ${resetsIn(b.resets_at)}` : "No score today yet";
}
document.querySelector("#play")!.addEventListener("click", async () => {
  run++;
  await board.runEnded(`run-${Date.now()}-${run}`, Math.floor(Math.random() * 5000));
  await draw();
});
void draw();
