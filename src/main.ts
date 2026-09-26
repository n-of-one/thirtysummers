import "./ui/hud.css";
import "./ui/winter.css";
import * as C from "./config.ts";
import { DebugOverlay, formatReadout } from "./debug/overlay.ts";
import { FrameClock } from "./frameClock.ts";
import { isTypingTarget, Keyboard, NO_INPUT } from "./input/keyboard.ts";
import { Pause } from "./input/pause.ts";
import { createApp, setResolution } from "./render/app.ts";
import { loadAssetPack } from "./render/atlas.ts";
import { Camera } from "./render/camera.ts";
import { loadIcons } from "./render/packs/icons.ts";
import { PropLayer } from "./render/propLayer.ts";
import { TargetMarker, targetTile } from "./render/targetMarker.ts";
import { TileLayer } from "./render/tileLayer.ts";
import { parseMap } from "./sim/mapfile.ts";
import { decodeSave, encodeSave } from "./sim/save.ts";
import { summarise, type SummerSummary } from "./sim/summary.ts";
import { World } from "./sim/world.ts";
import { BuildMenu } from "./ui/buildMenu.ts";
import { Hud, hudModel } from "./ui/hud.ts";
import { MapWidget } from "./ui/mapWidget.ts";
import { TransferPanel } from "./ui/transferPanel.ts";
import { bindFullscreenButton, FixedView, parseViewParam } from "./ui/view.ts";
import { WinterScreen } from "./ui/winter.ts";

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
 * A bare address rolls a seed and puts it in the address bar.
 *
 * Playtesting wants a different map each time without having to think of a
 * number, and wants to know afterwards which map it was. So opening the game
 * with nothing after the slash picks one under `SEED_ROLL_MAX` and rewrites
 * the URL to it: a reload is then the same world, and going back to the bare
 * address is a new one. Anything that names a world -- a seed, a map file, a
 * save -- is left alone.
 */
if (!params.get("seed") && !params.get("map") && !params.get("save")) {
  seed = Math.floor(Math.random() * C.SEED_ROLL_MAX);
  const url = new URL(location.href);
  url.searchParams.set("seed", String(seed));
  history.replaceState(null, "", url);
}

/**
 * `?map=<name>` plays `/maps/<name>.txt` instead of a generated world.
 *
 * That is what the discovery test runs on: a generated dump, edited by hand to
 * hold the chain of barriers, played by someone who has not opened the file.
 * Without the parameter nothing changes and seeds work exactly as before.
 */
const mapName = params.get("map");
let world = mapName ? await loadMap(mapName) : World.fromSeed(seed);

/**
 * `?save=` picks a game up at the end of the summer it was saved at, on the
 * map the other parameters name, and opens straight onto that winter. The
 * summer's numbers come with it, since the event log does not.
 */
let savedSummary: SummerSummary | null = null;
const saveParam = params.get("save");
if (saveParam) {
  const state = decodeSave(saveParam);
  world.restore(state);
  savedSummary = state.summary;
}

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
/** The world's trails, as the layers ask for them. Bound to one world, since a regenerate replaces it. */
const trailIn = (w: World) => (x: number, y: number, z: number) => w.trailStage(x, y, z);
let tiles = new TileLayer(world.map, pack, 0, trailIn(world));
let props = new PropLayer(world.map, pack, app.renderer, 0, trailIn(world));
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
// The map's own sprites, cut out of the sheets for the pack strip and the
// winter screen's rows. Without the licensed art each kind is a flat chip.
const icons = await loadIcons();
const hud = new Hud(document, view.size, icons);
// Art pixels the same size the world's are drawn at. The whole map is in the
// HUD too, first, so the list and the pack are painted over it.
const hudRoot = document.querySelector<HTMLDivElement>("#hud")!;
const map = new MapWidget(hudRoot, "corner", C.TILE / pack.tileSize, view.size);
const wholeMap = new MapWidget(hudRoot, "whole", C.TILE / pack.tileSize, view.size);
const viewRoot = document.querySelector<HTMLDivElement>("#view")!;
/** The whole map is up in place of the tile view. The clock runs on. */
let mapOpen = false;
wholeMap.hidden = true;
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
// Opened by the world, in the log, because the hold that opens it is the same
// key the tap uses and only the simulation can tell the two apart.
const transfer = new TransferPanel();
const winter = new WinterScreen(icons);
// The same from the keyboard, on the same terms as the button: only at camp,
// and not while paused, when the button is under the card.
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== C.END_SUMMER_KEY || e.repeat || isTypingTarget(e.target)) return;
  if (!pause.paused && world.atCamp) world.endSummer();
});
// The whole map in place of the tile view, and back. After the pause's
// listener, so the key that resumes does nothing else.
// On the whole map, a debug button draws every tile, seen or not, without
// marking any of them seen.
const mapReveal = document.querySelector<HTMLButtonElement>("#map-reveal")!;
mapReveal.addEventListener("click", () => {
  wholeMap.revealAll = !wholeMap.revealAll;
  mapReveal.classList.toggle("is-on", wholeMap.revealAll);
  mapReveal.blur();
});
addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== C.MAP_KEY || e.repeat || isTypingTarget(e.target) || pause.paused) return;
  mapOpen = !mapOpen;
  viewRoot.classList.toggle("is-map-open", mapOpen);
  mapReveal.hidden = !mapOpen;
});
bindFullscreenButton(document.querySelector<HTMLButtonElement>("#fullscreen")!);

/** How far through `world.events` the renderer has got. */
let seenEvents = 0;
/** The interact key is down and the world is not to be told, until it is let go. */
let awaitInteractRelease = false;
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
  // A panel onto a camp that no longer exists, and a winter for another world.
  transfer.close();
  winter.hide();

  tiles.destroy();
  props.destroy();
  tiles = new TileLayer(world.map, pack, 0, trailIn(world));
  props = new PropLayer(world.map, pack, app.renderer, 0, trailIn(world));
  app.stage.addChild(tiles.container, props.container, marker.container);
  applyViewport();
  camera.centreOn(world.player);
  camera.clampTo(world.map.width, world.map.height);

  seenEvents = 0;
  summaryShown = false;
  hud.reset();
  map.reset();
  wholeMap.reset();
  overlay.setSeed(seed);
  exposeGame();

  const url = new URL(location.href);
  url.searchParams.set("seed", String(seed));
  // A regenerate replaces an edited map with a generated one, so the parameter
  // that would load the edited one back on reload has to go with it, and so
  // does a save made on the old one.
  url.searchParams.delete("map");
  url.searchParams.delete("save");
  history.replaceState(null, "", url);
}

/** Set `?save=` in the address bar, or take it out with null. */
function setSaveParam(save: string | null): string {
  const url = new URL(location.href);
  if (save === null) url.searchParams.delete("save");
  else url.searchParams.set("save", save);
  history.replaceState(null, "", url);
  return url.href;
}

/**
 * The winter between two summers, straight after the last one ends. The
 * screen owns the choosing; the world applies what was chosen, and then the
 * next summer starts.
 *
 * The game is saved as it opens: the address bar carries the save, so a
 * reload comes back to this winter, and the screen shows the same link to
 * copy. The next summer takes it out again.
 */
function openWinter(summary: SummerSummary): void {
  const at = world;
  const link = setSaveParam(encodeSave(at.snapshot(summary)));
  winter.show(
    at.winterInput(),
    (choices, ticked) => {
      // A regenerate while the screen was up has already put it away.
      if (at !== world) return;
      world.endWinter(choices, ticked);
      winter.hide();
      setSaveParam(null);
      nextSummer();
    },
    summary,
    link,
  );
}

/**
 * Start the next summer on the same world.
 *
 * Nothing is rebuilt: the map, the layers and the camera are the ones already
 * on screen, and the event log carries on where it left off -- so the HUD
 * resumes at the cursor it had reached rather than replaying the summer that
 * just ended. The winter changed the ground itself, so both layers redraw.
 */
function nextSummer(): void {
  world.nextSummer();
  transfer.close();
  summaryShown = false;
  hud.reset(seenEvents);
  map.reset(seenEvents);
  wholeMap.reset(seenEvents);
  tiles.invalidate();
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
  // Reads `world` when moved rather than now, because a regenerate replaces it.
  setHydration: (hydration) => {
    world.stats.hydration = hydration;
  },
  open: params.has("debug"),
});

/** Handle for measuring from the console or a devtools driver. */
function exposeGame(): void {
  (window as unknown as { __game?: unknown }).__game = {
    app,
    view,
    pause,
    hud,
    map,
    wholeMap,
    buildMenu,
    transfer,
    winter,
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
  // With the panel up the player is standing at a box with the lid open, not
  // walking: the keys are the panel's. The clock still runs.
  //
  // Holding the interact key is what opened the panel, so that key is still
  // down when it closes. The world must not see it again until it is let go,
  // or the hold would start over and the panel would reopen by itself.
  const keys = keyboard.state();
  if (transfer.isOpen) awaitInteractRelease = true;
  else if (!keys.interact) awaitInteractRelease = false;
  const input = transfer.isOpen
    ? NO_INPUT
    : awaitInteractRelease
      ? { ...keys, interact: false }
      : keys;

  // When the light goes the world stops: the clock is the whole constraint, and
  // a summer you can keep playing past the end is not one.
  if (!world.summerOver) {
    for (let i = 0; i < steps; i++) world.step(C.TICK_SEC, input);
  } else if (!summaryShown) {
    summaryShown = true;
    // On to the winter, and from it another summer on the same map, with
    // every cut and every bridge kept, less what the winter wore away. A fresh
    // map is the debug overlay's job.
    openWinter(savedSummary ?? summarise(world));
    savedSummary = null;
  }

  // Neither layer rebuilds unless the camera crosses a tile boundary, so
  // anything that changes the world in place has to say so. A harvested node
  // stops being drawn; a cut or a bridge changes the ground itself, and the
  // props standing on it.
  for (let i = seenEvents; i < world.events.length; i++) {
    const type = world.events[i]!.type;
    if (
      type === "harvested" ||
      type === "dug" ||
      type === "dropped" ||
      type === "pickedUp"
    ) {
      props.invalidate();
    } else if (
      type === "cut" ||
      type === "built" ||
      type === "felled" ||
      type === "trodden" ||
      type === "summerStarted"
    ) {
      tiles.invalidate();
      props.invalidate();
    } else if (type === "transferOpened") {
      transfer.open(world);
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
    world.dropped,
  );
  marker.update(camera, targetTile(world.availableAction()));
  buildMenu.update(world.buildOptions(), world.buildMode);
  transfer.update(world);
  // The prompt and the toasts hang off the player, and the arrow points at
  // camp, so the HUD needs the one thing the simulation cannot tell it: where
  // those are in the view.
  hud.update(
    hudModel(world),
    camera.toScreen(world.player),
    world.events,
    camera.toScreen(world.camp),
  );
  map.hidden = !overlay.mapShown || mapOpen;
  map.update(world);
  wholeMap.hidden = !mapOpen;
  wholeMap.update(world);
  overlay.update(camera, readout, world.stats.hydration);
});

console.log(
  `${mapName ? `map "${mapName}"` : `seed ${seed}`} | pack "${pack.id}" @${pack.tileSize}px | ` +
    `${world.map.width}x${world.map.height} | ${world.nodes.length} nodes | ` +
    `renderer ${app.renderer.name} | WASD move, ` +
    `E/Space gather, drink, cut, fell, build, bank and pick up (hold at camp ` +
    `for the transfer panel), X drop, C switch, B build menu, M map, P pause, ` +
    `\` debug panel | view ${view.size.width}x${view.size.height} at x${view.scale}`,
);
