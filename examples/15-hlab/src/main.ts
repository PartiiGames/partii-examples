// One hlab humanoid on the page's own three.js, walking around with WASD (Shift runs), a follow
// camera, and Partii wired in: this device's guest and one analytics event when it spawns.
//   ?tier=game|phone|crowd   (default auto: phone on a small touch screen, else game)
//   ?seed=N                  someone else (a random person by seed; default: the default person)
import { createAnalytics } from "./analytics";
import { Controller } from "./controller";
import { hlab, THREE } from "./libs";
import { createPartii, errorMessage } from "./partii";

const q = new URLSearchParams(location.search);
const status = document.querySelector<HTMLElement>("#status")!;
const partii = createPartii();
const analytics = createAnalytics({ partii, version: "1.0.0", build: import.meta.env.MODE });
const signedIn = partii.ensurePlayer("hlab walker").catch((err) => void (status.textContent = `Offline: ${errorMessage(err)}`));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c8);
scene.fog = new THREE.Fog(0x9fb4c8, 18, 60);
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6b6253, 1.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x7c8a6e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground, new THREE.GridHelper(200, 200, 0x5f6c55, 0x6f7c63));

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// The humanoid. The Partii content profile is built into hlab: an adult, clothed and shod, whatever
// the spec says. `{}` is the default person; hlab.js's header has openHlab().people() for more.
const t0 = performance.now();
const spec = q.has("seed") ? { seed: Number(q.get("seed")) } : {};
const h = await hlab.createHumanoid(spec, { tier: q.get("tier") ?? "auto", look: { renderer } });
// Scale the ROOT (h.scene), never a bone: the controller's speeds follow root.scale.
scene.add(h.scene);
h.look?.settle();
// Compile every shader before the first frame, so the first frames don't stall (or show a grey body).
await renderer.compileAsync(scene, camera);
const controller = new Controller(h).bind(window);
const readyMs = Math.round(performance.now() - t0);
status.textContent = `WASD to walk · Shift to run · ${h.tier} tier, ready in ${(readyMs / 1000).toFixed(1)} s`;

await signedIn;
analytics.track("humanoid_spawned", { tier: h.tier, ready_ms: readyMs, generate_ms: Math.round(h.generate_ms) });
const sent = analytics.flush();

// The camera follows from behind and above, at a fixed angle (W walks away from it).
const offset = new THREE.Vector3(0, 2.1, 4.6);
camera.position.copy(offset);
const eye = new THREE.Vector3();
const aim = new THREE.Vector3();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  controller.update(dt);
  h.look?.update();
  const p = h.scene.position;
  camera.position.lerp(eye.copy(p).add(offset), 1 - Math.exp(-5 * dt));
  camera.lookAt(aim.set(p.x, 1.1, p.z));
  sun.position.set(p.x + 3, 6, p.z + 4);
  sun.target.position.copy(p);
  renderer.render(scene, camera);
});

// For the test (and your console): what the page built and what it is doing.
Object.assign(window, { __hlab: { h, controller, analytics, partii, sent, readyMs } });
