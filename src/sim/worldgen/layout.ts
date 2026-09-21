import * as C from "../../config.ts";
import { RESOURCES } from "../resources.ts";
import { mulberry32, type Rng } from "../rng.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceKind, ResourceNode, TerrainKind, Vec2 } from "../types.ts";
import { reachableFrom } from "./reachability.ts";
import { placeSprings } from "./springs.ts";
import { paintTerrain } from "./terrain.ts";
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
 * The maps in public/maps are dumps of this pass, and can still be edited by
 * hand afterwards: the file is the format, not this code.
 */
export function layoutSummerWorld(seed: number): GeneratedWorld {
  const rng = mulberry32(seed ^ 0x5a17);
  const W = C.LAYOUT_W;
  const H = C.LAYOUT_H;
  const jitter = (n: number) => Math.round((rng() * 2 - 1) * n);

  // The generator's landscape, with its own water and walls taken out: this
  // map's water is the one stream the table asks for, and its only walls are
  // the ones placed below.
  const map = paintTerrain(seed, mulberry32(seed), W, H, C.LAYOUT_BORDER);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const kind = map.get(x, y);
      if (kind === "stream" || kind === "bridge" || kind === "thicket") map.set(x, y, "underbrush");
    }
  }

  const stamp = new Stamp(map, W, H);
  const camp: Vec2 = { x: Math.floor(W / 2) + jitter(6) + 0.5, y: H - C.CAMP_FROM_BOTTOM + 0.5 };
  const cx = Math.floor(camp.x);
  const cy = Math.floor(camp.y);
  // Which side the copse is on. The pockets take the other, so the summers
  // pull the player across the map rather than round one corner of it.
  const side = rng() < 0.5 ? -1 : 1;
  const R = C.NEAR_RING_RADIUS;

  const at = (dx: number, dy: number): Vec2 => ({ x: cx + dx, y: cy + dy });
  const featherField = at(jitter(10), -(R + C.FEATHER_FIELD_BEYOND + jitter(4)));
  const shellField = at(
    side * (C.SHELL_FIELD_SIDE + jitter(8)),
    -(R + C.SHELL_FIELD_BEYOND + jitter(6)),
  );
  // The two pockets sit well off the line out of camp, one to each side, so
  // the route north never cuts through the stand's wall.
  const UP = -Math.PI / 2;
  const off = () => 0.9 + rng() * 0.5;
  const stand = polar(camp, 0.45 * R, UP - side * off());
  const mudPocket = polar(camp, 0.62 * R, UP + side * off());

  // The clearings each pocket and field is worked in, before anything is
  // walled off, so a wall is never drawn over its own field.
  stamp.disc(camp, 0, C.CAMP_CLEARING, "grass");
  stamp.disc(featherField, 0, C.FEATHER_FIELD_RADIUS, "grass");
  stamp.disc(shellField, 0, C.SHELL_FIELD_RADIUS, "grass");

  // The first stream: a half circle above camp, run down to the bottom border
  // so the near ring is closed, with both banks walkable for springs.
  stamp.halfRing(camp, R, C.STREAM_HALF_WIDTH);
  stamp.clearBanks(camp, R);

  // The near ring: the stand behind its thin thicket, and the open mud pocket.
  // The mud is a barrier that only costs time, so nothing walls it.
  stamp.discIf(stand, 0, C.STAND_RADIUS, () => (rng() < C.STAND_SAPLING_SHARE ? "sapling" : "grass"));
  stamp.disc(stand, C.STAND_RADIUS + 0.5, C.STAND_RADIUS + C.STAND_WALL + 0.5, "thicket");
  stamp.disc(mudPocket, 0, C.MUD_POCKET_RADIUS, "mud");

  // The route the cart will run, from M11: camp, through the feather field, to
  // the shell field. Grass all the way except where it crosses the stream,
  // which is what the bridge is for, and it is drawn after the stream so the
  // banks cannot wipe it.
  const bend = towards(shellField, featherField, C.ROUTE_BEND_FROM_FIELD);
  stamp.line(camp, { x: featherField.x, y: featherField.y }, 1, "grass");
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
  // the stand holds the sticks and nothing else.
  const walled: readonly (readonly [Vec2, number])[] = [
    [stand, C.STAND_RADIUS + C.STAND_WALL + 1],
  ];
  nodes.spread("fruit", camp, R - 6, N.nearRingFruit, C.NEAR_RING_SPACING, cy, walled);
  nodes.spread("feather", camp, R - 6, N.nearRingFeathers, C.NEAR_RING_SPACING, cy, walled);
  // A stick has to be reachable with a knife alone: saplings are a wall until
  // the axe comes, and a stick boxed in by them is a stick the first summer
  // can see and cannot have.
  const openStand = standOpen(map, stand);
  nodes.spread(
    "stick",
    stand,
    C.STAND_RADIUS - 0.5,
    N.standSticks,
    C.FIELD_SPACING,
    undefined,
    [],
    (x, y) => openStand.has(y * W + x),
  );
  nodes.spread("vine", mudPocket, C.MUD_POCKET_RADIUS - 0.5, N.pocketVines, C.FIELD_SPACING);
  // Across the stream, and behind the copse.
  const field = C.FEATHER_FIELD_RADIUS - 1;
  nodes.spread("feather", featherField, field, N.featherFieldFeathers, C.FIELD_SPACING);
  nodes.spread("fruit", featherField, field, N.featherFieldFruit, C.FIELD_SPACING);
  nodes.spread("shell", shellField, C.SHELL_FIELD_RADIUS - 1, N.shellFieldShells, C.FIELD_SPACING);

  // Springs are placed from the finished map with the map file's own seed, so
  // a dump of this world and the world itself have the same drinking spots:
  // the file carries no springs, and reading it back places them again.
  const springs = placeSprings(map, camp, nodes.placed, C.MAP_SPRING_SEED);
  return {
    seed,
    map,
    camp,
    nodes: nodes.placed,
    springs,
    reachable: reachableFrom(map, camp),
  };
}

/**
 * The tiles inside the stand a player can stand on once they have cut the wall,
 * with no axe: the ground that joins the wall without a sapling in the way.
 *
 * A stand is saplings scattered over open ground, and scattering can close a
 * pocket of that ground off. The wall can be cut anywhere, so anything joined
 * to it is reachable, and anything else is not until the axe arrives.
 */
function standOpen(map: TileMap, stand: Vec2): Set<number> {
  const reach = new Set<number>();
  const queue: number[] = [];
  const walkable = (x: number, y: number) =>
    Math.hypot(x - stand.x, y - stand.y) <= C.STAND_RADIUS + 0.5 &&
    map.isPassable(x, y) &&
    map.get(x, y) !== "sapling";

  for (let y = Math.floor(stand.y - C.STAND_RADIUS - 1); y <= stand.y + C.STAND_RADIUS + 1; y++) {
    for (let x = Math.floor(stand.x - C.STAND_RADIUS - 1); x <= stand.x + C.STAND_RADIUS + 1; x++) {
      if (!walkable(x, y)) continue;
      // Against the wall, so cutting in from outside lands here.
      const touchesWall = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => map.get(x + dx!, y + dy!) === "thicket");
      if (!touchesWall) continue;
      const idx = y * map.width + x;
      if (reach.has(idx)) continue;
      reach.add(idx);
      queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % map.width;
    const y = (idx - x) / map.width;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx!;
      const ny = y + dy!;
      const n = ny * map.width + nx;
      if (reach.has(n) || !walkable(nx, ny)) continue;
      reach.add(n);
      queue.push(n);
    }
  }
  return reach;
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
   * stand keeps its sticks on ground a player without an axe can stand on.
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
    // many -- a stand that came out mostly saplings, a ring of noise with
    // little open grass in it -- it closes up rather than leaving the field
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
      this.placed.push({
        id: this.placed.length + 1,
        kind,
        x: x + 0.5,
        y: y + 0.5,
        z: 0,
        harvested: false,
      });
      placed++;
    }
    return placed;
  }
}
