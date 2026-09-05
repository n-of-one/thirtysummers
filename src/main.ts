import "./ui/hud.css";
import * as C from "./config.ts";
import { DebugOverlay, formatReadout } from "./debug/overlay.ts";
import { FrameClock } from "./frameClock.ts";
import { Keyboard } from "./input/keyboard.ts";
import { createApp } from "./render/app.ts";
import { loadAssetPack } from "./render/atlas.ts";
import { Camera } from "./render/camera.ts";
import { PropLayer } from "./render/propLayer.ts";
import { TileLayer } from "./render/tileLayer.ts";
import { summarise } from "./sim/summary.ts";
import { World } from "./sim/world.ts";
import { Hud, hudModel } from "./ui/hud.ts";

/**
 * Surface startup failures on the page. A module with top-level await that
 * rejects renders nothing at all and logs where a screenshot cannot see it,
 * which makes asset problems needlessly hard to diagnose.
 */
function showFatal(error: unknown): void {
  const panel = document.querySelector<HTMLDivElement>("#debug");
  const readout = document.querySelector<HTMLDivElement>("#debug-readout");
  if (panel && readout) {
    panel.hidden = false;
    readout.textContent = `startup failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.error(error);
}
addEventListener("error", (e) => showFatal(e.error ?? e.message));
addEventListener("unhandledrejection", (e) => showFatal(e.reason));

const params = new URLSearchParams(location.search);
// `?seed=` with nothing usable after it falls back to the default rather than
// generating from NaN, which silently produces a map unrelated to any seed.
const requestedSeed = Number(params.get("seed"));
let seed = params.get("seed") && Number.isFinite(requestedSeed) ? requestedSeed : C.DEFAULT_SEED;
let world = World.fromSeed(seed);

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const app = await createApp(stage);
const pack = await loadAssetPack(app.renderer, params.get("pack") ?? undefined);

const camera = new Camera();
let tiles = new TileLayer(world.map, pack);
let props = new PropLayer(world.map, pack, app.renderer);
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
const hud = new Hud();

/** How far through `world.events` the renderer has got. */
let seenEvents = 0;
let summaryShown = false;

/**
 * Throw the day away and start a new one on `nextSeed`.
 *
 * The layers are built around a particular map, so a new map means new layers;
 * they are cheap to build and there is a pool of sprites to release, so they
 * are destroyed rather than retargeted. Everything that was counting through
 * the old day -- the event cursors, the summary card -- goes back to zero, and
 * the URL is rewritten so a reload lands on the same world.
 */
function regenerate(nextSeed: number): void {
  seed = nextSeed;
  world = World.fromSeed(seed);

  tiles.destroy();
  props.destroy();
  tiles = new TileLayer(world.map, pack);
  props = new PropLayer(world.map, pack, app.renderer);
  app.stage.addChild(tiles.container, props.container);
  applyViewport(app.screen.width, app.screen.height);
  camera.centreOn(world.player);
  camera.clampTo(world.map.width, world.map.height);

  seenEvents = 0;
  summaryShown = false;
  hud.reset();
  overlay.setSeed(seed);
  exposeGame();

  const url = new URL(location.href);
  url.searchParams.set("seed", String(seed));
  history.replaceState(null, "", url);
}

/**
 * The debug panel is always built, and starts down unless `?debug=1` asked for
 * it. Backtick brings it up. It costs a hidden div and a keydown listener, and
 * having it a keystroke away beats reloading with a query string on to find out
 * where you are standing.
 */
const overlay = new DebugOverlay({
  seed,
  regenerate,
  teleport: (screenX, screenY) => {
    const target = camera.toWorld({ x: screenX, y: screenY });
    if (!world.teleport(target.x, target.y)) return false;
    // Cut to the new position rather than gliding: a camera easing across
    // half the map hides the very thing the teleport was for.
    camera.centreOn(world.player);
    camera.clampTo(world.map.width, world.map.height);
    return true;
  },
  clickTarget: stage,
  open: params.has("debug"),
});

/** Handle for measuring from the console or a devtools driver. */
function exposeGame(): void {
  (window as unknown as { __game?: unknown }).__game = { app, world, camera, props, tiles, overlay };
}
exposeGame();

/** Which walk frame to draw, chosen by distance travelled rather than by time. */
function playerTexture() {
  const { facing, moving, distanceWalked } = world.player;
  if (!moving) return pack.idle(facing);
  const frames = pack.walk(facing);
  return frames[Math.floor(distanceWalked / C.WALK_FRAME_TILES) % frames.length]!;
}

/** The exact numbers this frame was drawn with, so a screenshot describes itself. */
function readout(): string {
  const p = world.player;
  return formatReadout({
    x: p.x,
    y: p.y,
    facing: p.facing,
    sprinting: p.sprinting,
    terrain: world.groundUnderPlayer().kind,
    speed: world.speed(),
    stamina: world.stats.stamina,
    hydration: world.stats.hydration,
    stomachCooldownSec: world.stats.stomachCooldownSec,
    elapsedSec: world.elapsedSec,
    seed,
    pack: pack.id,
    fps: app.ticker.FPS,
  });
}

/** Rendering runs once per frame and only ever reads simulation state. */
const clock = new FrameClock();
let elapsed = 0;

app.ticker.add(({ deltaMS }) => {
  // Both are states rather than events, so they are read fresh each frame: that
  // way they survive a regenerate and the world they apply to is always the one
  // on screen.
  clock.timeScale = overlay.timeScale;
  world.stats.frozen = overlay.frozen;

  const { frameSec, steps } = clock.tick(deltaMS / 1000);
  const input = keyboard.state();

  // When the light goes the world stops: the clock is the whole constraint, and
  // a day you can keep playing past the end is not one.
  if (!world.dayOver) {
    for (let i = 0; i < steps; i++) world.step(C.TICK_SEC, input);
  } else if (!summaryShown) {
    summaryShown = true;
    // A new day on the same seed, so a run can be replayed on the map it was
    // learned on. The debug overlay is where a different one comes from.
    hud.showSummary(summarise(world), () => regenerate(seed));
  }

  // A harvested node has to stop being drawn, and the prop layer only rebuilds
  // when the camera crosses a tile boundary, so say so explicitly.
  for (let i = seenEvents; i < world.events.length; i++) {
    if (world.events[i]!.type === "harvested") props.invalidate();
  }
  seenEvents = world.events.length;

  camera.follow(world.player, frameSec);
  camera.clampTo(world.map.width, world.map.height);

  elapsed += frameSec;
  tiles.setAnimationFrame(Math.floor(elapsed / C.WATER_FRAME_SEC));
  tiles.update(camera);
  props.update(camera, world.camp, world.nodes, world.player, playerTexture(), frameSec);
  // The prompt and the toasts hang off the player, so the HUD needs the one
  // thing the simulation cannot tell it: where that is on the canvas.
  hud.update(hudModel(world), camera.toScreen(world.player), world.events);
  overlay.update(camera, readout);
});

console.log(
  `seed ${seed} | pack "${pack.id}" @${pack.tileSize}px | ` +
    `${world.map.width}x${world.map.height} | ${world.nodes.length} nodes | ` +
    `renderer ${app.renderer.name} | WASD move, Shift sprint, ` +
    `E/Space gather and bank ore, F eat fruit, R drink water, \` debug panel`,
);
