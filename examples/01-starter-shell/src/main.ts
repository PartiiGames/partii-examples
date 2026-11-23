// The starter shell: a canvas game loop with Partii wired in. Replace drawFrame() with your game.
import { createAnalytics } from "./analytics";
import { installErrorReporting } from "./errors";
import { createPartii, errorMessage } from "./partii";

const VERSION = import.meta.env.VITE_GAME_VERSION ?? "0.1.0";
const partii = createPartii();
const analytics = createAnalytics({ partii, version: VERSION, build: import.meta.env.MODE });
installErrorReporting({ partii, version: VERSION, session: analytics.session });

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const ctx = canvas.getContext("2d")!;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// Sign in as this device's guest. The game plays either way: a failed sign-in is shown, not fatal.
partii
  .ensurePlayer()
  .then((p) => (status.textContent = `${p.display_name}${p.guest ? " (guest)" : ""}`))
  .catch((err) => (status.textContent = `Offline: ${errorMessage(err)}`));

let x = 40;
let vx = 160;
let last = performance.now();
let runStarted = false;

function drawFrame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  x += vx * dt;
  if (x < 20 || x > w - 20) vx = -vx;
  ctx.fillStyle = "#120a1f";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ff3fa4";
  ctx.beginPath();
  ctx.arc(x, h / 2, 16, 0, Math.PI * 2);
  ctx.fill();
  if (!runStarted) {
    runStarted = true;
    analytics.track("run_start", {});
  }
  requestAnimationFrame(drawFrame);
}
requestAnimationFrame(drawFrame);
