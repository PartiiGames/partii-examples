// The character drawn as capsules between its 30 joints on a 2D canvas, from a camera that follows the hips.
// Swap this for your engine: Frame.P is world positions (m, y up), Frame.R each joint's world rotation.
import type { Frame } from "./motionii";

export function draw(ctx: CanvasRenderingContext2D, f: Frame, parents: number[], w: number, h: number) {
  const cx = f.P[0][0], cz = f.P[0][2], k = Math.min(w, h) / 6; // ~6 m across
  const sx = (p: number[]) => w / 2 + (p[0] - cx) * k;
  const sy = (p: number[]) => h * 0.62 - p[1] * k + (p[2] - cz) * k * 0.35; // a low three-quarter view
  ctx.fillStyle = "#120a1f"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#2c1d44"; ctx.lineWidth = 1; // the floor grid, 1 m squares, moving under him
  for (let i = -6; i <= 6; i++) {
    const gx = Math.floor(cx) + i, gz = Math.floor(cz) + i;
    line(ctx, sx([gx, 0, cz - 6]), sy([gx, 0, cz - 6]), sx([gx, 0, cz + 6]), sy([gx, 0, cz + 6]));
    line(ctx, sx([cx - 6, 0, gz]), sy([cx - 6, 0, gz]), sx([cx + 6, 0, gz]), sy([cx + 6, 0, gz]));
  }
  ctx.fillStyle = "#0008"; ctx.beginPath(); ctx.ellipse(w / 2, sy([cx, 0, cz]), k * 0.35, k * 0.1, 0, 0, 7); ctx.fill();
  const order = parents.map((_, j) => j).sort((a, b) => f.P[b][2] - f.P[a][2]); // far bones first
  ctx.lineCap = "round";
  for (const j of order) {
    const p = parents[j]; if (p < 0) continue;
    ctx.strokeStyle = f.P[j][0] - cx > 0 ? "#ff3fa4" : "#7cf0c4"; ctx.lineWidth = k * 0.07;
    line(ctx, sx(f.P[p]), sy(f.P[p]), sx(f.P[j]), sy(f.P[j]));
  }
  const head = f.P[6]; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx(head), sy(head) - k * 0.05, k * 0.1, 0, 7); ctx.fill();
}
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

/** Interpolate two frames' positions (the 30 Hz motion shown at the display's rate). */
export function lerp(a: Frame, b: Frame, t: number): Frame {
  return { ...b, P: b.P.map((p, j) => p.map((v, k) => a.P[j][k] + (v - a.P[j][k]) * t)) };
}
