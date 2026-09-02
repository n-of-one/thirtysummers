import "./ui/hud.css";
import * as C from "./config.ts";
import { Keyboard } from "./input/keyboard.ts";
import { createApp } from "./render/app.ts";
import { loadAssetPack } from "./render/atlas.ts";
import { Camera } from "./render/camera.ts";
import { PropLayer } from "./render/propLayer.ts";
import { TileLayer } from "./render/tileLayer.ts";
import { World } from "./sim/world.ts";

/**
 * Surface startup failures on the page. A module with top-level await that
 * rejects renders nothing at all and logs where a screenshot cannot see it,
 * which makes asset problems needlessly hard to diagnose.
 */
function showFatal(error: unknown): void {
  const el = document.querySelector<HTMLDivElement>("#debug");
  if (el) {
    el.hidden = false;
    el.textContent = `startup failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.error(error);
}
addEventListener("error", (e) => showFatal(e.error ?? e.message));
addEventListener("unhandledrejection", (e) => showFatal(e.reason));

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? C.DEFAULT_SEED);
const world = World.fromSeed(seed);

const app = await createApp(document.querySelector<HTMLDivElement>("#stage")!);
const pack = await loadAssetPack(app.renderer, params.get("pack") ?? undefined);

const camera = new Camera();
const tiles = new TileLayer(world.map, pack);
const props = new PropLayer(world.map, pack);
app.stage.addChild(tiles.container, props.container);

camera.centreOn(world.player);

/**
 * Drive the viewport off the renderer's own resize event, not the window's.
 * Pixi resizes itself from a window listener too, and if ours runs first we
 * read the previous canvas size -- which leaves the camera and the tile pool
 * sized for a viewport that no longer exists.
 */
function applyViewport(width: number, height: number): void {
  camera.resize(width, height);
  tiles.resize(width, height);
  props.resize(width, height);
  camera.clampTo(world.map.width, world.map.height);
}
applyViewport(app.screen.width, app.screen.height);
app.renderer.on("resize", applyViewport);

const keyboard = new Keyboard();

/** Which walk frame to draw, chosen by distance travelled rather than by time. */
function playerTexture() {
  const { facing, moving, distanceWalked } = world.player;
  if (!moving) return pack.idle(facing);
  const frames = pack.walk(facing);
  return frames[Math.floor(distanceWalked / C.WALK_FRAME_TILES) % frames.length]!;
}

/**
 * The simulation advances in fixed steps so that per-second rates -- stamina,
 * hydration, movement -- come out identical regardless of frame rate. Rendering
 * runs once per frame and only ever reads simulation state.
 */
const FIXED_DT = 1 / 60;
/** Cap on catch-up after a stall (a backgrounded tab), to avoid a spiral. */
const MAX_FRAME_SEC = 0.25;
const WATER_FRAME_SEC = 0.45;
let accumulator = 0;
let elapsed = 0;

app.ticker.add(({ deltaMS }) => {
  const frameSec = Math.min(deltaMS / 1000, MAX_FRAME_SEC);
  const input = keyboard.state();

  accumulator += frameSec;
  while (accumulator >= FIXED_DT) {
    world.step(FIXED_DT, input);
    accumulator -= FIXED_DT;
  }

  camera.follow(world.player, frameSec);
  camera.clampTo(world.map.width, world.map.height);

  elapsed += frameSec;
  tiles.setAnimationFrame(Math.floor(elapsed / WATER_FRAME_SEC));
  tiles.update(camera);
  props.update(camera, world.camp, world.nodes, world.player, playerTexture());
});

// Readout of the exact numbers this frame was drawn with, so a screenshot is
// self-describing. Becomes the real debug overlay in M6.
const debug = document.querySelector<HTMLDivElement>("#debug")!;
if (params.has("debug")) {
  debug.hidden = false;
  app.ticker.add(() => {
    const p = world.player;
    debug.textContent =
      `pos ${p.x.toFixed(2)},${p.y.toFixed(2)} ${p.facing}${p.sprinting ? " sprint" : ""}  ` +
      `on ${world.groundUnderPlayer().kind} ${world.speed().toFixed(2)} tiles/s  ` +
      `seed ${seed}  pack ${pack.id}  ${app.ticker.FPS.toFixed(0)}fps`;
  });
}

console.log(
  `seed ${seed} | pack "${pack.id}" @${pack.tileSize}px | ` +
    `${world.map.width}x${world.map.height} | ${world.nodes.length} nodes | ` +
    `renderer ${app.renderer.name} | WASD to move, Shift to sprint`,
);
