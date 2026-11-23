import { createAnalytics } from "./analytics";
import { createPartii } from "./partii";

const partii = createPartii();
void partii.ensurePlayer();
const analytics = createAnalytics({ partii, version: "1.0.0", build: import.meta.env.MODE });
const log = document.querySelector<HTMLElement>("#log")!;
document.querySelector("#good")!.addEventListener("click", () => {
  analytics.track("level_complete", { mission: 3, secs: 41.5, won: true });
  log.textContent = "queued level_complete (sent within 30 s, or when the page hides)";
});
document.querySelector("#bad")!.addEventListener("click", () => {
  const kept = analytics.track("Level Complete", { pos: 1 });
  log.textContent = kept ? "queued" : "refused here (see the console): Partii would have dropped it silently";
});
