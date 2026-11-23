import { createPartii, errorMessage } from "./partii";
import { finishEmail, signOut, startEmail } from "./signin";

const partii = createPartii();
const who = document.querySelector<HTMLElement>("#who")!;
const show = () => {
  const p = partii.player();
  who.textContent = p ? `${p.display_name} · ${p.guest ? "guest" : "account"} · ${p.id}` : "…";
};
partii.ensurePlayer().then(show, (e) => (who.textContent = errorMessage(e)));

// All input is in a modal (a <dialog>), never inline.
const dialog = document.querySelector<HTMLDialogElement>("#signin")!;
document.querySelector("#open")!.addEventListener("click", () => dialog.showModal());
document.querySelector("#send")!.addEventListener("click", async () => {
  const email = (document.querySelector<HTMLInputElement>("#email")!).value;
  const r = await startEmail(partii, email);
  if (r.code) (document.querySelector<HTMLInputElement>("#code")!).value = r.code; // staging only
});
document.querySelector("#verify")!.addEventListener("click", async () => {
  const email = (document.querySelector<HTMLInputElement>("#email")!).value;
  const code = (document.querySelector<HTMLInputElement>("#code")!).value;
  const r = await finishEmail(partii, email, code);
  if (r.ok) dialog.close();
  else (document.querySelector<HTMLElement>("#error")!).textContent = r.message;
  show();
});
document.querySelector("#signout")!.addEventListener("click", async () => {
  await signOut(partii);
  show();
});
