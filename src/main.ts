import "./ui/hud.css";
import * as C from "./config.ts";
import { DebugOverlay, formatReadout } from "./debug/overlay.ts";
import { FrameClock } from "./frameClock.ts";
import { isTypingTarget, Keyboard } from "./input/keyboard.ts";
import { Pause } from "./input/pause.ts";
import { createApp, setResolution } from "./render/app.ts";
import { loadAssetPack } from "./render/atlas.ts";
import { Camera } from "./render/camera.ts";
import { PropLayer } from "./render/propLayer.ts";
import { TargetMarker, targetTile } from "./render/targetMarker.ts";
import { TileLayer } from "./render/tileLayer.ts";
import { parseMap } from "./sim/mapfile.ts";
import { summarise } from "./sim/summary.ts";
import { World } from "./sim/world.ts";
import { BuildMenu } from "./ui/buildMenu.ts";
import { Hud, hudModel } from "./ui/hud.ts";
import { bindFullscreenButton, FixedView, parseViewParam } from "./ui/view.ts";

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

/**
 * `?map=<name>` plays `/maps/<name>.txt` instead of a generated world.
 *
 * That is what the discovery test runs on: a generated dump, edited by hand to
 * hold the chain of barriers, played by someone who has not opened the file.
 * Without the parameter nothing changes and seeds work exactly as before.
 */
const mapName = params.get("map");
let world = mapName ? await loadMap(mapName) : World.fromSeed(seed);

async function loadMap(name: string): Promise<World> {
  const res = await fetch(`/maps/${encodeURIComponent(name)}.txt`);
  if (!res.ok) throw new Error(`no map "${name}" (/maps/${name}.txt: ${res.status})`);
  return new World(parseMap(await res.text()));
}

const stage = document.querySelector<HTMLDivElement>("#stage")!;

/**
 * The fixed view: the game is drawn at one logical size, `?view=WxH` or the
 * configured one, and scaled to fit the window. Nothing below reads the window;
 * the camera, the sprite pools, the fog, the prompt and the teleport click all
 * work in the view's logical pixels.
 */
const view = new FixedView(
  parseViewParam(params.get("view")),
  document.querySelector<HTMLDivElement>("#view")!,
);
const app = await createApp(stage, view.size.width, view.size.height, view.scale);
view.onScale = (scale) => setResolution(app, scale);
const pack = await loadAssetPack(app.renderer, params.get("pack") ?? undefined);

const camera = new Camera();
let tiles = new TileLayer(world.map, pack);
let props = new PropLayer(world.map, pack, app.renderer);
// Last, so the marker is over the props: it says "this tile", and a marker a
// bush can hide is no use on the one terrain that is made of bushes.
const marker = new TargetMarker();
app.stage.addChild(tiles.container, props.container, marker.container);

camera.centreOn(world.player);

/** Size the camera and the sprite pools to the view. The view never changes size. */
function applyViewport(): void {
  const { width, height } = view.size;
  camera.resize(width, height);
  tiles.resize(width, height);
  props.resize(width, height);
  camera.clampTo(world.map.width, world.map.height);
}
applyViewport();

const keyboard = new Keyboard();
const hud = new Hud(document, view.size);
const pause = new Pause(
  document.querySelector<HTMLDivElement>("#paused")!,
  window,
  // The summary card is already a stop, and a pause card over it would need a
  // second key to get back to it.
  () => !world.summerOver,
);
// A hidden tab loses focus too, but not always a blur with it.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause.set(true);
});
// Reads `world` when clicked rather than now, because a regenerate replaces it.
hud.onEndSummer(() => world.endSummer());
// The build menu owns the choosing; the world owns what is chosen.
const buildMenu = new BuildMenu();
buildMenu.onChoose = (build) => {
  world.buildMode = build;
};
// The same from the keyboard, on the same terms as the button: only at camp,
// and not while paused, when the button is under the card.
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== C.END_SUMMER_KEY || e.repeat || isTypingTarget(e.target)) return;
  if (!pause.paused && world.atCamp) world.endSummer();
});
bindFullscreenButton(document.querySelector<HTMLButtonElement>("#fullscreen")!);

/** How far through `world.events` the renderer has got. */
let seenEvents = 0;
let summaryShown = false;

/**
 * Throw the world away and generate a new one on `nextSeed`.
 *
 * The layers are built around a particular map, so a new map means new layers;
 * they are cheap to build and there is a pool of sprites to release, so they
 * are destroyed rather than retargeted. Everything that was counting through
 * the old world -- the event cursors, the summary card -- goes back to zero, and
 * the URL is rewritten so a reload lands on the same world.
 */
function regenerate(nextSeed: number): void {
  seed = nextSeed;
  world = World.fromSeed(seed);

  tiles.destroy();
  props.destroy();
  tiles = new TileLayer(world.map, pack);
  props = new PropLayer(world.map, pack, app.renderer);
  app.stage.addChild(tiles.container, props.container, marker.container);
  applyViewport();
  camera.centreOn(world.player);
  camera.clampTo(world.map.width, world.map.height);

  seenEvents = 0;
  summaryShown = false;
  hud.reset();
  overlay.setSeed(seed);
  exposeGame();

  const url = new URL(location.href);
  url.searchParams.set("seed", String(seed));
  // A regenerate replaces an edited map with a generated one, so the parameter
  // that would load the edited one back on reload has to go with it.
  url.searchParams.delete("map");
  history.replaceState(null, "", url);
}

/**
 * Start the next summer on the same world.
 *
 * Nothing is rebuilt: the map, the layers and the camera are the ones already
 * on screen, and the event log carries on where it left off -- so the HUD
 * resumes at the cursor it had reached rather than replaying the summer that
 * just ended.
 */
function nextSummer(): void {
  world.nextSummer();
  summaryShown = false;
  hud.reset(seenEvents);
  props.invalidate();
  camera.centreOn(world.player);
  camera.clampTo(world.map.width, world.map.height);
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
  // The click arrives in CSS pixels from the canvas's corner, which is scaled
  // with the view, so it is divided back into logical pixels first.
  teleport: (screenX, screenY) => {
    const target = camera.toWorld({ x: screenX / view.cssScale, y: screenY / view.cssScale });
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
  (window as unknown as { __game?: unknown }).__game = {
    app,
    view,
    pause,
    hud,
    buildMenu,
    world,
    camera,
    props,
    tiles,
    marker,
    overlay,
  };
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
    terrain: world.groundUnderPlayer().kind,
    speed: world.speed(),
    hydration: world.stats.hydration,
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
  world.frozen = overlay.frozen;

  // Paused, no time passes at all: nothing steps, and the camera and the water,
  // which run on the same seconds, hold where they are.
  const { frameSec, steps } = clock.tick(pause.paused ? 0 : deltaMS / 1000);
  const input = keyboard.state();

  // When the light goes the world stops: the clock is the whole constraint, and
  // a summer you can keep playing past the end is not one.
  if (!world.summerOver) {
    for (let i = 0; i < steps; i++) world.step(C.TICK_SEC, input);
  } else if (!summaryShown) {
    summaryShown = true;
    // Another summer on the same map, with every cut and every bridge kept.
    // That persistence is the whole question the discovery test asks, so the
    // button in front of the player is the one that keeps it; a fresh map is
    // the debug overlay's job.
    hud.showSummary(summarise(world), nextSummer);
  }

  // Neither layer rebuilds unless the camera crosses a tile boundary, so
  // anything that changes the world in place has to say so. A harvested node
  // stops being drawn; a cut or a bridge changes the ground itself, and the
  // props standing on it.
  for (let i = seenEvents; i < world.events.length; i++) {
    const type = world.events[i]!.type;
    if (type === "harvested" || type === "summerStarted" || type === "dug" || type === "cached") {
      props.invalidate();
    } else if (type === "cut" || type === "built" || type === "felled") {
      tiles.invalidate();
      props.invalidate();
    }
  }
  seenEvents = world.events.length;

  camera.follow(world.player, frameSec);
  camera.clampTo(world.map.width, world.map.height);

  elapsed += frameSec;
  tiles.setAnimationFrame(Math.floor(elapsed / C.WATER_FRAME_SEC));
  tiles.update(camera);
  props.update(
    camera,
    world.camp,
    world.nodes,
    world.player,
    playerTexture(),
    frameSec,
    world.springs,
    world.caches,
  );
  marker.update(camera, targetTile(world.availableAction()));
  buildMenu.update(world.buildOptions(), world.buildMode);
  // The prompt and the toasts hang off the player, and the arrow points at
  // camp, so the HUD needs the one thing the simulation cannot tell it: where
  // those are in the view.
  hud.update(
    hudModel(world, view.size.width),
    camera.toScreen(world.player),
    world.events,
    camera.toScreen(world.camp),
  );
  overlay.update(camera, readout);
});

console.log(
  `${mapName ? `map "${mapName}"` : `seed ${seed}`} | pack "${pack.id}" @${pack.tileSize}px | ` +
    `${world.map.width}x${world.map.height} | ${world.nodes.length} nodes | ` +
    `renderer ${app.renderer.name} | WASD move, ` +
    `E/Space gather, drink, cut, fell, build and bank, B build menu, P pause, ` +
    `\` debug panel | view ${view.size.width}x${view.size.height} at x${view.scale}`,
);
