import * as C from "../../config.ts";
import { RESOURCES } from "../resources.ts";
import { mulberry32, type Rng } from "../rng.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceKind, ResourceNode, TerrainKind, Vec2 } from "../types.ts";
import { carveBrambleBay, findBrambleBay } from "./brambleBay.ts";
import { nearRing, reachableFrom } from "./reachability.ts";
import { placeSprings } from "./springs.ts";
import { keepStagesOnUnderbrush, paintTerrain } from "./terrain.ts";
import { thickenStream } from "./water.ts";
import type { GeneratedWorld } from "../worldgen.ts";

/**
 * A seed in, a map that holds the first five summers out.
 *
 * The barriers of docs/current/five-summers.md are not something noise
 * produces: each summer has to open exactly one thing, and each barrier has to
 * be short in the one currency the summer before supplied. So the landscape is
 * the generator's -- its woods, its mud, its thinning tree line -- and this
 * pass stamps the table onto it: the half circle of stream round camp, the
 * near ring inside it, the feather field across the stream, and the shell
 * field behind its copse. The dry pocket comes back with M12.
 *
 * Positions are jittered and the whole arrangement is mirrored by the seed, so
 * two seeds are not the same walk, while every seed still holds the same
 * chain. `worldgen/rows.ts` is what says whether a given map does.
 *
 * A map file in public/maps is a dump of this pass, made when a map is worth
 * freezing and editable by hand afterwards: the file is the format, not this
 * code. Play is on seeds otherwise, because every seed holds the chain.
 */
export function layoutSummerWorld(seed: number): GeneratedWorld {
  const rng = mulberry32(seed ^ 0x5a17);
  const W = C.LAYOUT_W;
  const H = C.LAYOUT_H;
  const jitter = (n: number) => Math.round((rng() * 2 - 1) * n);

  // The generator's landscape without its own stream: this map's water is the
  // one stream the table asks for, and its only walls are the ones placed
  // below. The noise paints no walls of its own.
  const camp: Vec2 = { x: Math.floor(W / 2) + jitter(6) + 0.5, y: H - C.CAMP_FROM_BOTTOM + 0.5 };
  const cx = Math.floor(camp.x);
  const cy = Math.floor(camp.y);
  const R = C.NEAR_RING_RADIUS;
  // The near ring grows by its own settings, more open than the valley: inside
  // the half circle the stream will take, and the strip below camp between
  // its two legs. The band of bank along the stream hides the change.
  const groundFor = (x: number, y: number): C.GroundSettings =>
    (y <= cy ? Math.hypot(x - camp.x, y - camp.y) < R : Math.abs(x - camp.x) < R) ? C.RING_GROUND : C.GROUND;

  const underbrushStages = new Uint8Array(W * H);
  const moisture = new Float32Array(W * H);
  const forest = new Float32Array(W * H);
  const map = paintTerrain(
    seed,
    mulberry32(seed),
    W,
    H,
    C.LAYOUT_BORDER,
    underbrushStages,
    false,
    moisture,
    forest,
    groundFor,
  );

  const stamp = new Stamp(map, W, H);
  // Which side the copse is on. The pockets take the other, so the summers
  // pull the player across the map rather than round one corner of it.
  const side = rng() < 0.5 ? -1 : 1;

  const at = (dx: number, dy: number): Vec2 => ({ x: cx + dx, y: cy + dy });
  const featherField = at(jitter(10), -(R + C.FEATHER_FIELD_BEYOND + jitter(4)));
  const shellField = at(
    side * (C.SHELL_FIELD_SIDE + jitter(8)),
    -(R + C.SHELL_FIELD_BEYOND + jitter(6)),
  );
  // The vines' pocket sits well off the line out of camp, on the far side
  // from the copse. This is only where its last resort goes.
  const UP = -Math.PI / 2;
  const mudPocket = polar(camp, 0.62 * R, UP + side * (0.9 + rng() * 0.5));

  // The clearings each pocket and field is worked in, before anything is
  // walled off, so a wall is never drawn over its own field.
  stamp.disc(camp, 0, C.CAMP_CLEARING, "grass");
  stamp.disc(featherField, 0, C.FEATHER_FIELD_RADIUS, "grass");
  stamp.disc(shellField, 0, C.SHELL_FIELD_RADIUS, "grass");

  // The first stream: a half circle above camp, run down to the bottom border
  // so the near ring is closed, with both banks walkable for springs.
  stamp.halfRing(camp, R, C.STREAM_HALF_WIDTH);
  stamp.clearBanks(camp, R);

  // The near ring's bramble bay, where the sticks lie: the edge of a wood
  // that wraps furthest round open ground, anywhere in the ring, with
  // brambles on the wood's floor round it. It goes down before the mud, so
  // the mud keeps out.
  const ring = nearRing(map, camp);
  const bay = findBrambleBay(map, seed, rng, camp, ring, forest, moisture, underbrushStages);
  carveBrambleBay(map, seed, camp, forest, underbrushStages, bay);

  // Mud where the water is: the noise only knew about moisture, and now the
  // stream is in, the ground near it is wetter. Kept dry are the clearings
  // and the bramble bay.
  const wet = new Wet(map, moisture, ring, [
    [camp, C.CAMP_CLEARING + 2],
    [featherField, C.FEATHER_FIELD_RADIUS + 2],
    [shellField, C.SHELL_FIELD_RADIUS + 2],
    [bay.centre, bay.reach + 2],
  ]);
  wet.soak();
  // The vines' pocket is the largest patch of that mud on its side of the
  // ring, grown only if it is too small to hold them. Nothing walls it: the
  // mud is a barrier that only costs time.
  const pocket = wet.pocket(camp, R, side, mudPocket);

  // The way in to the shell field: from the feather field, bending round to
  // the copse, grass the whole way, and the one gap the underbrush round the
  // copse leaves. It is drawn after the stream so the banks cannot wipe it.
  // Nothing is laid from camp to the feather field: that walk is whatever the
  // player's feet wear into the ground.
  const bend = towards(shellField, featherField, C.ROUTE_BEND_FROM_FIELD);
  stamp.line(featherField, bend, 1, "grass");
  stamp.line(bend, shellField, 1, "grass");

  // The copse that hides the shell field, and the underbrush round it that
  // leaves the route the only grass in. Both go on after the route, so the
  // wall of saplings is unbroken.
  stamp.disc(
    shellField,
    C.SHELL_FIELD_RADIUS - 0.5,
    C.SHELL_FIELD_RADIUS + C.COPSE_WALL - 0.5,
    "sapling",
  );
  stamp.moat(
    shellField,
    C.SHELL_FIELD_RADIUS + C.COPSE_WALL,
    C.SHELL_FIELD_RADIUS + C.COPSE_WALL + C.COPSE_MOAT,
  );
  stamp.disc(towards(shellField, featherField, C.HEDGE_FROM_FIELD), 0, C.HEDGE_RADIUS, "thicket");

  thickenStream(map);
  stamp.border();

  const nodes = new Scatter(map, rng);
  const N = C.LAYOUT_NODES;
  // Inside the ring, what is walled off is walled off: the first summer's
  // fruit and feathers are out in the open where they can be walked to, and
  // the bramble bay holds the sticks and nothing else.
  const walled: readonly (readonly [Vec2, number])[] = [
    [bay.centre, bay.reach + 1],
    // Camp's own clearing: a tree planted against the fire would be four fruit
    // that cost nothing to reach, and the ring's food is meant to be four
    // stops out in it.
    [camp, C.CAMP_CLEARING + 2],
  ];
  // The ring's food, before anything else is scattered, so the feathers keep
  // their distance from the trees rather than the other way about.
  nodes.plant(stamp, camp, R - 6, N.nearRingTrees, N.nearRingFruit, C.NEAR_RING_SPACING, cy, walled);
  nodes.spread("feather", camp, R - 6, N.nearRingFeathers, C.NEAR_RING_SPACING, cy, walled);
  // The sticks lie on the bramble bay's floor, as what the wood drops.
  const floorReach = [...bay.floor].reduce(
    (r, i) => Math.max(r, Math.hypot((i % W) - bay.centre.x, (i - (i % W)) / W - bay.centre.y)),
    0,
  );
  nodes.spread(
    "stick",
    bay.centre,
    floorReach + 0.5,
    N.brambleBaySticks,
    C.FIELD_SPACING,
    undefined,
    [],
    (x, y) => bay.floor.has(y * W + x),
  );
  // Vines sit well inside the pocket's mud, never along its rim, so reaching
  // one is always a wade rather than a step off the grass.
  nodes.spread(
    "vine",
    pocket.centre,
    pocket.radius,
    N.pocketVines,
    C.FIELD_SPACING,
    undefined,
    [],
    (x, y) => pocket.tiles.has(y * W + x) && insideMud(map, x, y, C.MUD_VINE_INSET),
  );
  // Across the stream, and behind the copse.
  const field = C.FEATHER_FIELD_RADIUS - 1;
  nodes.plant(
    stamp,
    featherField,
    field - 1,
    N.featherFieldTrees,
    N.featherFieldFruit,
    C.NEAR_RING_SPACING,
  );
  nodes.spread("feather", featherField, field, N.featherFieldFeathers, C.FIELD_SPACING);
  nodes.spread("shell", shellField, C.SHELL_FIELD_RADIUS - 1, N.shellFieldShells, C.FIELD_SPACING);

  // Springs are placed from the finished map with the map file's own seed, so
  // a dump of this world and the world itself have the same drinking spots:
  // the file carries no springs, and reading it back places them again.
  const springs = placeSprings(map, camp, nodes.placed, C.MAP_SPRING_SEED);
  // The noise's stages, less wherever the layout stamped something else.
  // Underbrush the layout stamps itself, the band round the copse, is full.
  keepStagesOnUnderbrush(map, underbrushStages);
  return {
    seed,
    map,
    camp,
    nodes: nodes.placed,
    springs,
    reachable: reachableFrom(map, camp),
    underbrushStages,
  };
}

/**
 * Is this tile mud with `inset` tiles of mud on every side of it?
 *
 * What it keeps out is a vine on the rim, which can be picked while standing
 * on the grass beside it: the mud is the whole barrier of that pocket, and a
 * vine that costs no wading is a vine that is not behind it.
 */
function insideMud(map: TileMap, x: number, y: number, inset: number): boolean {
  for (let dy = -inset; dy <= inset; dy++) {
    for (let dx = -inset; dx <= inset; dx++) {
      if (map.get(x + dx, y + dy) !== "mud") return false;
    }
  }
  return true;
}

/** The vines' pocket: its tiles deep enough in mud, and a circle round them. */
interface Pocket {
  centre: Vec2;
  radius: number;
  tiles: ReadonlySet<number>;
}

/** A pocket filled out: the tiles turned to mud for it, and its tiles deep enough for a vine. */
interface Fill {
  added: number[];
  core: number[];
}

const NEIGHBOURS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Mud from the moisture the noise left, made wetter near the water the layout
 * laid.
 *
 * The noise paints the landscape before there is a stream, so on its own it
 * puts mud wherever its moisture field happens to be high, with no regard for
 * where the water is. This raises the moisture near the water and paints the
 * mud again, on the ground the noise lets turn: open ground and underbrush,
 * including the band of bank `clearBanks` stamped over them. Dense underbrush
 * and woods keep their floor. Nothing inside a `dry` disc turns.
 */
class Wet {
  private readonly map: TileMap;
  private readonly moisture: Float32Array;
  /**
   * The near ring's tiles: the pocket is counted only on them, so a pocket
   * grown from mud on the bank never puts a vine across the water.
   */
  private readonly ring: Uint8Array;
  private readonly dry: readonly (readonly [Vec2, number])[];
  /** What the water adds to each tile's moisture. */
  private readonly boost: Float32Array;

  constructor(
    map: TileMap,
    moisture: Float32Array,
    ring: Uint8Array,
    dry: readonly (readonly [Vec2, number])[],
  ) {
    this.map = map;
    this.moisture = moisture;
    this.ring = ring;
    this.dry = dry;
    this.boost = waterBoost(map);
  }

  /** Paint the mud over the whole map. */
  soak(): void {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) this.paint(x, y);
    }
  }

  /**
   * The vines' pocket: a patch of mud inside the ring on the pockets' side,
   * well off the line north from camp.
   *
   * A patch with too few tiles deep enough in mud for the vines is filled out
   * the way a hollow fills with water: the wettest ground at its edge turns
   * first, a tile at a time, so its outline follows the noise's own contours
   * instead of taking a stamped shape. Of the ring's largest patches, the
   * pocket is the one that needs the fewest tiles added. With no patch that
   * will do, it fills from whichever spot on the pockets' side needs the
   * fewest, over the stretch of the ring the disc used to be placed in.
   *
   * Where even that cannot make room, because the ground is a wood that never
   * turns, the old disc is stamped at `fallback` as a last resort: a seed
   * without its vines is a seed whose first bridge cannot be built.
   */
  pocket(camp: Vec2, radius: number, side: number, fallback: Vec2): Pocket {
    const W = this.map.width;
    const UP = -Math.PI / 2;
    const spots: number[][] = [];
    for (const out of [0.5, 0.62, 0.75]) {
      for (const turn of [0.9, 1.15, 1.4]) {
        const at = polar(camp, out * radius, UP + side * turn);
        const i = at.y * W + at.x;
        if (this.inRing(at.x, at.y) && (this.map.get(at.x, at.y) === "mud" || this.canTurn(i))) spots.push([i]);
      }
    }
    const best = this.leastFilled(this.patches(camp, radius, side)) ?? this.leastFilled(spots);
    if (best) {
      for (const i of best.added) this.map.set(i % W, (i - (i % W)) / W, "mud");
      return this.shape(best.core);
    }
    const r = C.MUD_POCKET_LAST_RESORT;
    const core: number[] = [];
    for (let y = Math.floor(fallback.y - r); y <= fallback.y + r; y++) {
      for (let x = Math.floor(fallback.x - r); x <= fallback.x + r; x++) {
        if (Math.hypot(x - fallback.x, y - fallback.y) <= r) this.map.set(x, y, "mud");
      }
    }
    for (let y = Math.floor(fallback.y - r); y <= fallback.y + r; y++) {
      for (let x = Math.floor(fallback.x - r); x <= fallback.x + r; x++) {
        if (this.inRing(x, y) && insideMud(this.map, x, y, C.MUD_VINE_INSET)) core.push(y * W + x);
      }
    }
    return this.shape(core);
  }

  /** Of the patches in `starts`, the one that needs the fewest tiles added; earlier ones win a tie. */
  private leastFilled(starts: readonly (readonly number[])[]): Fill | null {
    let best: Fill | null = null;
    for (const start of starts) {
      const fill = this.fill(start, best ? best.added.length - 1 : C.MUD_POCKET_FILL_MAX);
      if (fill) best = fill;
    }
    return best;
  }

  /**
   * Fill the patch `start` out until it has room for the vines, adding at
   * most `max` tiles, or null if that is not enough.
   *
   * The map is not touched: what is added is returned. A tile at the edge is
   * taken wettest first, mud already there before anything else, so the
   * pocket takes in the mud it meets and spreads into the dampest ground.
   */
  private fill(start: readonly number[], max: number): Fill | null {
    const { map } = this;
    const W = map.width;
    const added: number[] = [];
    const inPocket = new Set<number>();
    const isMud = (x: number, y: number) => map.get(x, y) === "mud" || inPocket.has(y * W + x);
    const core = new Set<number>();
    // Priority of each tile waiting at the edge.
    const edge = new Map<number, number>();

    const take = (i: number) => {
      inPocket.add(i);
      edge.delete(i);
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of NEIGHBOURS_4) {
        const nx = x + dx;
        const ny = y + dy;
        const n = ny * W + nx;
        if (inPocket.has(n) || edge.has(n) || !this.inRing(nx, ny)) continue;
        if (map.get(nx, ny) === "mud") edge.set(n, Infinity);
        else if (this.canTurn(n)) edge.set(n, this.moisture[n]! + this.boost[n]!);
      }
      // Only tiles this close can have become deep enough in mud.
      const inset = C.MUD_VINE_INSET;
      for (let cy = y - inset; cy <= y + inset; cy++) {
        for (let cx = x - inset; cx <= x + inset; cx++) {
          const c = cy * W + cx;
          if (core.has(c) || !inPocket.has(c)) continue;
          let deep = true;
          for (let dy = -inset; dy <= inset && deep; dy++) {
            for (let dx = -inset; dx <= inset && deep; dx++) deep = isMud(cx + dx, cy + dy);
          }
          if (deep) core.add(c);
        }
      }
    };

    for (const i of start) {
      if (map.get(i % W, (i - (i % W)) / W) !== "mud") added.push(i);
      take(i);
    }
    while (core.size < C.MUD_POCKET_CORE_MIN) {
      if (added.length > max || edge.size === 0) return null;
      let next = -1;
      let wettest = -Infinity;
      for (const [i, wet] of edge) {
        if (wet > wettest) {
          wettest = wet;
          next = i;
        }
      }
      if (wettest !== Infinity) added.push(next);
      take(next);
    }
    return added.length > max ? null : { added, core: [...core] };
  }

  /** Whether the tile at index `i` may be turned to mud: open ground or underbrush, wet by the noise, not kept dry. */
  private canTurn(i: number): boolean {
    const W = this.map.width;
    const x = i % W;
    const y = (i - x) / W;
    const kind = this.map.get(x, y);
    if (kind !== "grass" && kind !== "underbrush") return false;
    if (Number.isNaN(this.moisture[i]!)) return false;
    return !this.dry.some(([c, r]) => Math.hypot(x - c.x, y - c.y) <= r);
  }

  /**
   * Where the vines go: round the middle of the pocket's core, as far out as
   * it reaches, and on the core's tiles only.
   */
  private shape(core: readonly number[]): Pocket {
    const W = this.map.width;
    const tiles = new Set(core);
    const at = core.map((i) => ({ x: i % W, y: (i - (i % W)) / W }));
    const centre = {
      x: Math.round(at.reduce((s, t) => s + t.x, 0) / Math.max(1, at.length)),
      y: Math.round(at.reduce((s, t) => s + t.y, 0) / Math.max(1, at.length)),
    };
    const reach = at.reduce((r, t) => Math.max(r, Math.hypot(t.x - centre.x, t.y - centre.y)), 0);
    return { centre, radius: reach + 0.5, tiles };
  }

  /**
   * Turn the ground at (x, y) to mud if its moisture, near water, is high
   * enough: in the near ring, by the ring's own threshold.
   */
  private paint(x: number, y: number): void {
    const i = y * this.map.width + x;
    const threshold = this.ring[i] ? C.RING_GROUND.mudThreshold : C.GROUND.mudThreshold;
    if (this.moisture[i]! + this.boost[i]! < threshold) return;
    if (this.canTurn(i)) this.map.set(x, y, "mud");
  }

  /** Whether (x, y) is on the map and in the near ring. */
  private inRing(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height && this.ring[y * this.map.width + x] === 1;
  }

  /** The tiles of each patch of mud the pocket may be, largest first. */
  private patches(camp: Vec2, radius: number, side: number): number[][] {
    const { map } = this;
    const W = map.width;
    const inRing = (x: number, y: number) =>
      y <= camp.y &&
      Math.hypot(x - camp.x, y - camp.y) <= radius - 6 &&
      this.inRing(x, y) &&
      map.get(x, y) === "mud";
    const seen = new Uint8Array(W * map.height);
    const found: number[][] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < W; x++) {
        if (seen[y * W + x] || !inRing(x, y)) continue;
        seen[y * W + x] = 1;
        const stack = [y * W + x];
        const tiles: number[] = [];
        let sx = 0;
        let sy = 0;
        while (stack.length > 0) {
          const i = stack.pop()!;
          const tx = i % W;
          const ty = (i - tx) / W;
          tiles.push(i);
          sx += tx;
          sy += ty;
          for (const [dx, dy] of NEIGHBOURS_4) {
            const n = (ty + dy) * W + tx + dx;
            if (seen[n] || !inRing(tx + dx, ty + dy)) continue;
            seen[n] = 1;
            stack.push(n);
          }
        }
        const dx = sx / tiles.length - camp.x;
        const dy = sy / tiles.length - camp.y;
        // On the pockets' side, turned well away from north, and a walk out
        // from camp rather than beside it.
        if (dx * side <= 0 || Math.atan2(Math.abs(dx), -dy) < C.MUD_POCKET_OFF_NORTH) continue;
        if (Math.hypot(dx, dy) < C.MUD_POCKET_FROM_CAMP) continue;
        found.push(tiles);
      }
    }
    return found.sort((a, b) => b.length - a.length).slice(0, C.MUD_POCKET_CANDIDATES);
  }
}

/**
 * What the water adds to the moisture of each tile: `WET_BANK_BOOST` beside
 * the stream, falling in a straight line to nothing `WET_REACH` steps away.
 */
function waterBoost(map: TileMap): Float32Array {
  const W = map.width;
  const dist = new Int32Array(W * map.height).fill(-1);
  const queue: number[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < W; x++) {
      if (map.get(x, y) !== "stream") continue;
      dist[y * W + x] = 0;
      queue.push(y * W + x);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const x = i % W;
    const y = (i - x) / W;
    if (dist[i]! >= C.WET_REACH) continue;
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.height || dist[ny * W + nx]! >= 0) continue;
      dist[ny * W + nx] = dist[i]! + 1;
      queue.push(ny * W + nx);
    }
  }
  const boost = new Float32Array(dist.length);
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]!;
    if (d > 0 && d < C.WET_REACH) boost[i] = C.WET_BANK_BOOST * (1 - d / C.WET_REACH);
  }
  return boost;
}

/** A point `distance` from `from` at `angle`, rounded to a tile. */
function polar(from: Vec2, distance: number, angle: number): Vec2 {
  return {
    x: Math.round(from.x + Math.cos(angle) * distance),
    y: Math.round(from.y + Math.sin(angle) * distance),
  };
}

/** The point `distance` from `from` on the way to `to`. */
function towards(from: Vec2, to: Vec2, distance: number): Vec2 {
  const away = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return {
    x: Math.round(from.x + ((to.x - from.x) / away) * distance),
    y: Math.round(from.y + ((to.y - from.y) / away) * distance),
  };
}

/**
 * Drawing on the map in the shapes the layout is made of, keeping the border
 * and the route out of harm's way.
 *
 * The route is remembered as it is drawn, so the underbrush that seals the
 * copse cannot swallow the one way in, and a node is never scattered onto the
 * road itself.
 */
class Stamp {
  readonly route = new Set<number>();
  // Plain fields, not parameter properties: everything under src/sim/ has to
  // run under bare `node --experimental-strip-types`, which cannot synthesise
  // the assignments a parameter property implies.
  private readonly map: TileMap;
  private readonly w: number;
  private readonly h: number;

  constructor(map: TileMap, w: number, h: number) {
    this.map = map;
    this.w = w;
    this.h = h;
  }

  private inside(x: number, y: number): boolean {
    const b = C.LAYOUT_BORDER;
    return x >= b && y >= b && x < this.w - b && y < this.h - b;
  }

  set(x: number, y: number, kind: TerrainKind): void {
    if (this.inside(x, y)) this.map.set(x, y, kind);
  }

  /** Every tile between two radii of `centre`, as `kind`. */
  disc(centre: Vec2, from: number, to: number, kind: TerrainKind): void {
    this.discIf(centre, from, to, () => kind);
  }

  discIf(centre: Vec2, from: number, to: number, kind: () => TerrainKind): void {
    for (let y = Math.floor(centre.y - to - 1); y <= centre.y + to + 1; y++) {
      for (let x = Math.floor(centre.x - to - 1); x <= centre.x + to + 1; x++) {
        const d = Math.hypot(x - centre.x, y - centre.y);
        if (d >= from && d <= to) this.set(x, y, kind());
      }
    }
  }

  /** The upper half of a ring: the stream, run down to the bottom border. */
  halfRing(centre: Vec2, radius: number, half: number): void {
    for (let y = Math.floor(centre.y - radius - half - 1); y <= centre.y; y++) {
      for (let x = Math.floor(centre.x - radius - half - 1); x <= centre.x + radius + half + 1; x++) {
        const d = Math.hypot(x - centre.x, y - centre.y);
        if (Math.abs(d - radius) <= half) this.set(x, y, "stream");
      }
    }
    for (let y = Math.floor(centre.y); y < this.h; y++) {
      for (let dx = -half; dx <= half; dx++) {
        this.set(Math.round(centre.x - radius + dx), y, "stream");
        this.set(Math.round(centre.x + radius + dx), y, "stream");
      }
    }
  }

  /**
   * Both banks walkable, so springs can stand on either side: a spring is a
   * reed bed on passable ground, and a wood grown to the water's edge would
   * leave one side of the stream with nowhere to drink.
   */
  clearBanks(centre: Vec2, radius: number): void {
    this.disc(centre, radius - 4, radius + 4, "underbrush");
    this.halfRing(centre, radius, C.STREAM_HALF_WIDTH);
    for (let y = Math.floor(centre.y); y < this.h; y++) {
      for (const sign of [-1, 1]) {
        for (let d = 2; d <= 4; d++) {
          for (const x of [centre.x + sign * (radius + d), centre.x + sign * (radius - d)]) {
            if (this.map.get(Math.round(x), y) === "tree") this.set(Math.round(x), y, "underbrush");
          }
        }
      }
    }
  }

  /**
   * Grass a few tiles wide from a to b, remembered as the route.
   *
   * Water is left where it is: the route crosses the stream rather than
   * draining it, and crossing it is the first summer's work.
   */
  line(a: Vec2, b: Vec2, half: number, kind: TerrainKind): void {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          if (this.map.get(x + dx, y + dy) !== "stream") this.set(x + dx, y + dy, kind);
          this.route.add((y + dy) * this.w + (x + dx));
        }
      }
    }
  }

  /** Grass turned to underbrush in a band, leaving the route alone. */
  moat(centre: Vec2, from: number, to: number): void {
    for (let y = Math.floor(centre.y - to - 1); y <= centre.y + to + 1; y++) {
      for (let x = Math.floor(centre.x - to - 1); x <= centre.x + to + 1; x++) {
        const d = Math.hypot(x - centre.x, y - centre.y);
        if (d < from || d > to) continue;
        if (this.route.has(y * this.w + x)) continue;
        if (this.map.get(x, y) === "grass") this.set(x, y, "underbrush");
      }
    }
  }

  border(): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.inside(x, y)) this.map.set(x, y, "rock");
      }
    }
  }
}

/**
 * Scattering nodes over the ground they grow on, no two closer than `spacing`.
 *
 * The spacing is what the near ring needs: eighteen things to find over a ring
 * that takes a minute to cross should be eighteen finds, not two clumps.
 */
class Scatter {
  readonly placed: ResourceNode[] = [];
  private readonly taken = new Set<number>();
  private readonly map: TileMap;
  private readonly rng: Rng;

  constructor(map: TileMap, rng: Rng) {
    this.map = map;
    this.rng = rng;
  }

  /**
   * `count` nodes of `kind` inside `radius` of `centre`.
   *
   * `aboveY` keeps them north of that row, which is what stops the near ring's
   * scatter from spilling into the strip below camp. `avoid` keeps them out of
   * what is walled off inside the ring, so what the first summer can see is
   * what it can pick up. `allow` is the last word on a tile, and is how the
   * bramble bay keeps its sticks on its own floor.
   */
  spread(
    kind: ResourceKind,
    centre: Vec2,
    radius: number,
    count: number,
    spacing: number,
    aboveY?: number,
    avoid: readonly (readonly [Vec2, number])[] = [],
    allow: (x: number, y: number) => boolean = () => true,
  ): void {
    // The spacing is what it aims for. Where the ground will not take that
    // many -- a bramble bay with a small floor, a ring of noise with little open
    // grass in it -- it closes up rather than leaving the field
    // short, because how much is there is what the summer is worth.
    let left = count;
    for (const at of [spacing, spacing * 0.6, 0]) {
      if (left <= 0) return;
      left -= this.attempt(kind, centre, radius, left, at, aboveY, avoid, allow);
    }
  }

  private attempt(
    kind: ResourceKind,
    centre: Vec2,
    radius: number,
    count: number,
    spacing: number,
    aboveY: number | undefined,
    avoid: readonly (readonly [Vec2, number])[],
    allow: (x: number, y: number) => boolean,
  ): number {
    const ground = RESOURCES[kind].ground;
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 400; tries++) {
      // Square root of the draw, so the area is covered evenly rather than
      // crowding the centre.
      const angle = this.rng() * Math.PI * 2;
      const at = Math.sqrt(this.rng()) * radius;
      const x = Math.round(centre.x + Math.cos(angle) * at);
      const y = Math.round(centre.y + Math.sin(angle) * at);
      if (aboveY !== undefined && y > aboveY) continue;
      if (avoid.some(([c, r]) => Math.hypot(x - c.x, y - c.y) <= r)) continue;
      if (this.map.get(x, y) !== ground || !allow(x, y)) continue;
      const index = y * this.map.width + x;
      if (this.taken.has(index)) continue;
      if (this.placed.some((n) => Math.hypot(n.x - x - 0.5, n.y - y - 0.5) < spacing)) continue;
      this.taken.add(index);
      this.add(kind, x, y);
      placed++;
    }
    return placed;
  }

  /**
   * `count` fruit trees inside `radius` of `centre`, holding `fruit` between
   * them.
   *
   * A fruit tree is a tree tile with a few ordinary fruit nodes on the open
   * ground round it. Nothing in the simulation ties the two together: each
   * fruit is harvested from the tile ahead and comes back like any other, and
   * what says "fruit tree" to the player is the fruit rather than the tree,
   * which is drawn like every other tree on the map.
   *
   * The fruit is shared out unevenly, within the bounds in `config.ts`, so a
   * tree is a place rather than a counted thing: some are worth the walk and
   * some are passed by. The rest of the arguments are `spread`'s, and hold the
   * trees apart the same way, so a field's food is stops rather than a clump.
   */
  plant(
    stamp: Stamp,
    centre: Vec2,
    radius: number,
    count: number,
    fruit: number,
    spacing: number,
    aboveY?: number,
    avoid: readonly (readonly [Vec2, number])[] = [],
  ): void {
    const share = this.share(count, fruit);
    // At each spacing, a trunk in dense underbrush first: a fruit tree stands
    // most naturally where the ground is thickest, near the other trees.
    for (const at of [spacing, spacing * 0.6, 0]) {
      for (const denseOnly of [true, false]) {
        if (share.length === 0) return;
        this.attemptTrees(stamp, centre, radius, share, at, aboveY, avoid, denseOnly);
      }
    }
  }

  /**
   * `fruit` shared between `trees`, each tree between the bounds in
   * `config.ts`: everyone gets the minimum, and what is left over is handed
   * out a fruit at a time to trees with room for one.
   */
  private share(trees: number, fruit: number): number[] {
    const out = Array.from({ length: trees }, () =>
      Math.min(C.FRUIT_PER_TREE_MIN, Math.floor(fruit / trees)),
    );
    let left = fruit - out.reduce((a, b) => a + b, 0);
    while (left > 0) {
      const room = out.flatMap((n, i) => (n < C.FRUIT_PER_TREE_MAX ? [i] : []));
      if (room.length === 0) break;
      out[room[Math.floor(this.rng() * room.length)]!]!++;
      left--;
    }
    return out;
  }

  private attemptTrees(
    stamp: Stamp,
    centre: Vec2,
    radius: number,
    share: number[],
    spacing: number,
    aboveY: number | undefined,
    avoid: readonly (readonly [Vec2, number])[],
    denseOnly: boolean,
  ): void {
    const count = share.length;
    for (let tries = 0; share.length > 0 && tries < count * 600; tries++) {
      const angle = this.rng() * Math.PI * 2;
      const at = Math.sqrt(this.rng()) * radius;
      const x = Math.round(centre.x + Math.cos(angle) * at);
      const y = Math.round(centre.y + Math.sin(angle) * at);
      if (aboveY !== undefined && y > aboveY) continue;
      if (avoid.some(([c, r]) => Math.hypot(x - c.x, y - c.y) <= r)) continue;
      if (denseOnly && this.map.get(x, y) !== "denseUnderbrush") continue;
      if (!this.canopyOpen(stamp, x, y)) continue;
      if (this.placed.some((n) => Math.hypot(n.x - x - 0.5, n.y - y - 0.5) < spacing)) continue;
      stamp.set(x, y, "tree");
      this.taken.add(y * this.map.width + x);
      for (const [dx, dy] of this.fruitSites(share.shift()!)) {
        this.taken.add((y + dy) * this.map.width + (x + dx));
        this.add("fruit", x + dx, y + dy);
      }
    }
  }

  /**
   * Where one tree's `count` fruit hang, round the eight tiles of its canopy.
   *
   * The five tiles in front of the trunk and beside it are shuffled and taken
   * first; the three behind it come last. A tree is drawn from the foot of its
   * trunk upwards, so a fruit north of it is under the canopy and is not seen
   * until the player has walked past, and up to three fruit are therefore
   * always in the open. A fourth goes behind the trunk now and then, by
   * {@link C.FRUIT_BEHIND_CHANCE}, which is what keeps a tree worth walking
   * round.
   *
   * Shuffling the five is the rest of it: fruit at the compass points is a
   * rosette, and a rosette reads as something that was placed rather than
   * something that grew.
   */
  private fruitSites(count: number): readonly (readonly [number, number])[] {
    const sites = this.shuffled([...CANOPY_FRONT, ...CANOPY_SIDE]).slice(0, count);
    if (count > CANOPY_ALWAYS_SEEN && this.rng() < C.FRUIT_BEHIND_CHANCE) {
      sites[sites.length - 1] = this.shuffled(CANOPY_BEHIND)[0]!;
    }
    return sites;
  }

  private shuffled<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /**
   * Is this a site for a tree: walkable ground, grass or underbrush of any
   * kind, with walkable ground on all eight sides, none of it spoken for and
   * none of it the way in to the shell field?
   *
   * Underbrush as well as grass, because a fruit tree stands most naturally
   * among the others, and fruit is picked from any ground the player can
   * stand on. All eight sides, not only the ones the fruit stand on, so no
   * grown tree, sapling or wall stands next to the trunk: the ring of ground
   * round it is joined to itself, and every fruit is walked to rather than
   * looked at from behind a trunk.
   *
   * The ring beyond that, two tiles out, has to be clear of anything drawn as
   * tall as a tree. A tree is drawn upwards from the foot of its trunk, so a
   * neighbour standing south of a fruit would be drawn over it, and the whole
   * point of hanging it there is that it is seen. Now that fruit trees stand
   * among the others, a wood can come that close on any side.
   */
  private canopyOpen(stamp: Stamp, x: number, y: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const index = ny * this.map.width + nx;
        if (!TREE_GROUND.has(this.map.get(nx, ny))) return false;
        if (this.taken.has(index) || stamp.route.has(index)) return false;
      }
    }
    // Nothing drawn as tall as a tree within two tiles either way: in a wood
    // one could otherwise stand beside a fruit on the canopy's edge, drawn
    // over it or taken for its trunk.
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const kind = this.map.get(x + dx, y + dy);
        if (kind === "tree" || kind === "sapling") return false;
      }
    }
    return true;
  }

  private add(kind: ResourceKind, x: number, y: number): void {
    this.placed.push({
      id: this.placed.length + 1,
      kind,
      x: x + 0.5,
      y: y + 0.5,
      z: 0,
      harvested: false,
    });
  }
}

/** The ground a fruit tree and its fruit can stand on: what the player walks, bar mud. */
const TREE_GROUND: ReadonlySet<TerrainKind> = new Set(["grass", "underbrush", "denseUnderbrush"]);

/**
 * The eight tiles a tree's fruit can stand on, in three tiers.
 *
 * A tree is three tiles wide and four tall, drawn from the foot of its trunk
 * upwards, so what is north of it is under the canopy and what is south of it
 * is drawn over the tree. In front is therefore always seen, beside the trunk
 * is clear of the canopy's bulk, and behind it is hidden until the player
 * walks round.
 */
const CANOPY_FRONT: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [-1, 1],
];
const CANOPY_SIDE: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
];
const CANOPY_BEHIND: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [-1, -1],
];
/**
 * Fruit up to this many is always in the open, however it falls. Three, so a
 * tree only ever hides its last one, and only when it has four.
 */
const CANOPY_ALWAYS_SEEN = 3;
