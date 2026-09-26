import { createNoise2D } from "simplex-noise";
import * as C from "../../config.ts";
import { mulberry32, randInt } from "../rng.ts";
import type { Vec2 } from "../types.ts";
import { fbm } from "./terrain.ts";

type Noise2D = (x: number, y: number) => number;
/** A point of a line on the map: x, y and half the width there, in tiles. */
type LinePoint = [x: number, y: number, halfWidth: number];

/**
 * The valley a seed plays in, as masks over the map, before any ground is
 * painted: where the floor is, where the water is and what kind, where the
 * cliff walls the river off, the near ring, and camp. Each mask is 1 on a tile
 * and indexed `y * width + x`.
 */
export interface ValleyPlan {
  width: number;
  height: number;
  /** Walkable valley floor, before the water and the cliff are laid on it. The rest is rock. */
  floor: Uint8Array;
  /** The river and the lake: water in the ravine, which no one reaches. */
  river: Uint8Array;
  /** The first stream, which can be drunk from and bridged. */
  stream: Uint8Array;
  ponds: Uint8Array;
  /** The ravine's edge, between the river and the floor. */
  cliff: Uint8Array;
  /** Camp's part of the valley: the floor it reaches without crossing water or cliff. */
  ring: Uint8Array;
  camp: Vec2;
}

/**
 * Lay the valley out for a seed: the one docs/design/map-arc.md describes,
 * from the plan in `C.VALLEY`. Why it is built this way is in
 * docs/rationale/technical.md, under "The valley".
 *
 * The plan in `C.VALLEY` is turned and scaled onto the map, and the seed adds
 * only noise: the walls' outline, the meanders, the shore of still water, and
 * whether the whole is mirrored east to west. The turn itself never changes,
 * because the first stream's waterfall has to fall towards the viewer, and a
 * mirror keeps that.
 */
export function planValley(seed: number): ValleyPlan {
  const V = C.VALLEY;
  const rng = mulberry32(seed ^ 0x7a11e7);
  const noise = (): Noise2D => createNoise2D(mulberry32(randInt(rng, 0, 2 ** 31)));
  const wallNoise = noise();
  const meanderNoise = noise();
  const shoreNoise = noise();
  const mirrored = rng() < 0.5;

  const a = (V.turnDeg * Math.PI) / 180;
  const s = V.scale;
  const turn = (x: number, y: number): [number, number] => [
    (x * Math.cos(a) - y * Math.sin(a)) * s,
    (x * Math.sin(a) + y * Math.cos(a)) * s,
  ];

  // The map is the floor's box with the margin of rock round it.
  const valleyLines = [V.spine, ...V.sideValleys];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const line of valleyLines) {
    for (const [px, py, w] of line) {
      const [x, y] = turn(px, py);
      x0 = Math.min(x0, x - w * s);
      y0 = Math.min(y0, y - w * s);
      x1 = Math.max(x1, x + w * s);
      y1 = Math.max(y1, y + w * s);
    }
  }
  const width = Math.ceil(x1 - x0 + 2 * V.margin);
  const height = Math.ceil(y1 - y0 + 2 * V.margin);
  const dx = V.margin - x0;
  const dy = V.margin - y0;
  /** A plan point on the map, its half width scaled by `widthScale`. */
  const place = ([px, py, w]: C.PlanPoint, widthScale: number): LinePoint => {
    const [x, y] = turn(px, py);
    return [x + dx, y + dy, w * widthScale];
  };
  const size = width * height;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  // The floor: within the half width of a valley line, as the walls' noise
  // pushes it. Measured round each point of the lines only, not over the
  // whole map for every point.
  const edge = new Float32Array(size).fill(Infinity);
  const reachOut = V.wall.coarse + V.wall.fine + 1;
  for (const line of valleyLines) {
    for (const [px, py, w] of spline(line.map((p) => place(p, s)))) {
      const r = w + reachOut;
      for (let y = Math.max(0, Math.floor(py - r)); y <= Math.min(height - 1, Math.ceil(py + r)); y++) {
        for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(width - 1, Math.ceil(px + r)); x++) {
          const d = Math.hypot(x + 0.5 - px, y + 0.5 - py) - w;
          if (d < edge[y * width + x]!) edge[y * width + x] = d;
        }
      }
    }
  }
  const floor = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (edge[i] === Infinity) continue;
      const pushed =
        edge[i]! +
        V.wall.coarse * fbm(wallNoise, x / V.wall.coarseScale, y / V.wall.coarseScale, 3) +
        V.wall.fine * fbm(wallNoise, 100 + x / V.wall.fineScale, y / V.wall.fineScale, 2);
      if (pushed < 0) floor[i] = 1;
    }
  }

  // The water. A line's half width is in tiles, so a bridge costs the same
  // whatever the scale; its meanders grow with the valley.
  const disc = (mask: Uint8Array, cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (inMap(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) mask[y * width + x] = 1;
      }
    }
  };
  let lineSeed = 0;
  const course = (line: C.PlanLine) =>
    meander(spline(line.points.map((p) => place(p, 1))), line.meander * s, line.wave * s, meanderNoise, (lineSeed += 17));
  const water = (mask: Uint8Array, line: C.PlanLine) => {
    for (const [x, y, w] of course(line)) disc(mask, x, y, w);
  };
  // The first stream is laid as squares, 3 tiles across, one at every point
  // of its course. A point moves at most a tile each way from the last, so
  // the squares overlap, and a walk across the stream crosses at least 3
  // tiles of it everywhere and exactly 3 where it runs straight: the first
  // bridge's price. A disc of the same width comes out 2 across where the
  // course runs off the grid's axes.
  const squares = (mask: Uint8Array, points: readonly LinePoint[]) => {
    for (const [x, y] of points) {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      for (let ny = cy - 1; ny <= cy + 1; ny++) {
        for (let nx = cx - 1; nx <= cx + 1; nx++) if (inMap(nx, ny)) mask[ny * width + nx] = 1;
      }
    }
  };
  const pool = (mask: Uint8Array, p: C.PlanPool) => {
    const [cx, cy] = turn(p.x, p.y);
    const lx = cx + dx;
    const ly = cy + dy;
    const rx = p.rx * s;
    const ry = p.ry * s;
    const t = ((p.turn + V.turnDeg) * Math.PI) / 180;
    const r = Math.max(rx, ry) * (1 + V.shoreNoise) + 1;
    for (let y = Math.floor(ly - r); y <= ly + r; y++) {
      for (let x = Math.floor(lx - r); x <= lx + r; x++) {
        if (!inMap(x, y)) continue;
        const u = (x + 0.5 - lx) * Math.cos(t) + (y + 0.5 - ly) * Math.sin(t);
        const v = -(x + 0.5 - lx) * Math.sin(t) + (y + 0.5 - ly) * Math.cos(t);
        const d = Math.hypot(u / rx, v / ry) + V.shoreNoise * fbm(shoreNoise, x / 12, y / 12, 2);
        if (d < 1) mask[y * width + x] = 1;
      }
    }
  };
  const river = new Uint8Array(size);
  water(river, V.riverIn);
  water(river, V.riverOut);
  pool(river, V.lake);
  // The river's edge is smoothed before the cliff goes on it: the cliff is
  // drawn in pieces that need a tile or two of straight edge, and a bank
  // ragged tile by tile came out as spikes, crumbs of ground in the water and
  // odd steps.
  smoothWater(river, width, height);
  // The shore's noise can leave a puddle of the lake apart from it. It would
  // be walled in by its own cliff, a second river no one can reach.
  keepLargest(river, width, height);
  const stream = new Uint8Array(size);
  const isRiverAt = (x: number, y: number) => inMap(x, y) && river[y * width + x] === 1;
  const streamCourse = falls(course(V.stream), isRiverAt);
  squares(stream, streamCourse);
  // Under the falls, and for `FALLS_SHORE` tiles either side, the lake's
  // shore is straight: filled where it lies lower and cut back where it lies
  // higher. The falls then drop the same height side by side, and the water
  // line runs on straight from them before it bends, where the shore's noise
  // made it jump a tile or turn at once.
  const FALLS_SHORE = 4;
  const [endX, endY] = streamCourse[streamCourse.length - 1]!;
  const firstWater = (x: number) => {
    let y = Math.floor(endY) - 16;
    while (y < height && !isRiverAt(x, y)) y++;
    return y;
  };
  const fallsX = Math.floor(endX);
  const shore = Math.min(firstWater(fallsX - 1), firstWater(fallsX), firstWater(fallsX + 1));
  for (let x = fallsX - 1 - FALLS_SHORE; x <= fallsX + 1 + FALLS_SHORE; x++) {
    const water = firstWater(x);
    // Only where the lake is there to straighten: a column past the lake's
    // end has no water near that row, and filling it would run a channel
    // down the valley.
    if (Math.abs(water - shore) > FALLS_SHORE) continue;
    for (let y = shore; y < water; y++) river[y * width + x] = 1;
    for (let y = water; y < shore; y++) river[y * width + x] = 0;
  }
  // Filling under the falls can leave a strip of ground a tile wide beside
  // what it filled.
  fillGaps(river, width, height);
  // Where the stream runs in the rock above its waterfall, the rock closes
  // round it, so it comes out of the wall at its full width: the wall's
  // ragged edge would otherwise leave ground on either side a two-tile step
  // apart.
  const COLLAR = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!stream[y * width + x] || floor[y * width + x]) continue;
      for (let ny = y - COLLAR; ny <= y + COLLAR; ny++) {
        for (let nx = x - COLLAR; nx <= x + COLLAR; nx++) if (inMap(nx, ny) && !stream[ny * width + nx]) floor[ny * width + nx] = 0;
      }
    }
  }
  const ponds = new Uint8Array(size);
  for (const p of V.ponds) pool(ponds, p);

  // The cliff: the floor beside the river and the lake, deeper where the
  // water is to the south, since that is the side that shows a face. The
  // first stream's end is taken by it too: that is the falls, where it drops
  // into the lake, and a bridge can never be laid down them.
  const cliff = new Uint8Array(size);
  const isRiver = (x: number, y: number) => inMap(x, y) && river[y * width + x] === 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!floor[i] || river[i] || ponds[i]) continue;
      let near = false;
      for (let ny = -C.CLIFF_RIM_TILES; ny <= C.CLIFF_RIM_TILES && !near; ny++) {
        for (let nx = -C.CLIFF_RIM_TILES; nx <= C.CLIFF_RIM_TILES && !near; nx++) near = isRiver(x + nx, y + ny);
      }
      // The face is only ever straight above the water: each of its tiles is
      // one row of it, counted from the water up.
      for (let ny = 1; ny <= C.CLIFF_FACE_TILES && !near; ny++) near = isRiver(x, y + ny);
      if (near) {
        cliff[i] = 1;
        stream[i] = 0;
      }
    }
  }

  // Camp's part: the floor reached from the plan's anchor without crossing
  // water or cliff.
  const open = (i: number) => floor[i] === 1 && !river[i] && !stream[i] && !ponds[i] && !cliff[i];
  const [ax, ay] = turn(V.ringAnchor[0], V.ringAnchor[1]);
  const ring = fill(width, height, nearestOpen(width, height, Math.floor(ax + dx), Math.floor(ay + dy), open), open);
  const camp = campIn(ring, width, height);

  const plan: ValleyPlan = { width, height, floor, river, stream, ponds, cliff, ring, camp };
  return mirrored ? mirror(plan) : plan;
}

/**
 * Catmull-Rom through the points, about one point a tile, the half width
 * eased along with the position.
 */
export function spline(points: readonly LinePoint[]): LinePoint[] {
  const out: LinePoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (j: 0 | 1 | 2) =>
        0.5 *
        (2 * p1[j] +
          (-p0[j] + p2[j]) * t +
          (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
          (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([at(0), at(1), at(2)]);
    }
  }
  const last = points[points.length - 1]!;
  out.push([last[0], last[1], last[2]]);
  return out;
}

/**
 * Meanders: each point pushed sideways by noise read along the line's length,
 * fading to nothing within `MEANDER_FADE` tiles of either end, so a line still
 * starts and ends where the plan puts it.
 */
function meander(points: LinePoint[], amp: number, wave: number, noise: Noise2D, row: number): LinePoint[] {
  const MEANDER_FADE = 25;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  const out: LinePoint[] = [];
  let along = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) along += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const fade = Math.min(1, along / MEANDER_FADE, (length - along) / MEANDER_FADE);
    const push = amp * fade * fbm(noise, along / wave, row, 3);
    const [x, y, w] = points[i]!;
    out.push([x - (ty / len) * push, y + (tx / len) * push, w]);
  }
  return out;
}

/**
 * The first stream's course, ending in its falls: followed until the lake
 * lies straight below it, `FALLS_MIN` to `FALLS_MAX` tiles down, and from
 * there run straight south into the water.
 *
 * The pack's waterfall only falls towards the viewer, so the stream has to
 * meet the lake from the north. Where the plan's course bends along the
 * shore instead, as the lake's noise can make it, this is what puts the
 * drop back. The cliff laid later takes the last tiles above the water, and
 * those are the falls.
 */
function falls(points: LinePoint[], isRiver: (x: number, y: number) => boolean): LinePoint[] {
  const FALLS_MIN = 6;
  const FALLS_MAX = 14;
  for (let i = 0; i < points.length; i++) {
    const [x, y, w] = points[i]!;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let down = 0;
    while (down <= FALLS_MAX && !isRiver(cx, cy + down)) down++;
    if (down < FALLS_MIN || down > FALLS_MAX) continue;
    // The lake only below the drop, never beside it: water two tiles to the
    // side of the stream's straight run would leave a cliff a tile wide
    // between them, with no piece to draw it.
    let beside = false;
    for (let k = 0; k < down - 3 && !beside; k++) {
      for (let dx = -3; dx <= 3 && !beside; dx++) beside = isRiver(cx + dx, cy + k);
    }
    if (beside) continue;
    const out = points.slice(0, i + 1);
    for (let k = 1; k <= down; k++) out.push([cx + 0.5, cy + k + 0.5, w]);
    return out;
  }
  return points;
}

/** The open tile nearest (x, y), searched outwards in square rings. */
function nearestOpen(width: number, height: number, x: number, y: number, open: (i: number) => boolean): number {
  for (let r = 0; r < Math.max(width, height); r++) {
    for (let ny = y - r; ny <= y + r; ny++) {
      for (let nx = x - r; nx <= x + r; nx++) {
        if (Math.max(Math.abs(nx - x), Math.abs(ny - y)) !== r) continue;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (open(ny * width + nx)) return ny * width + nx;
      }
    }
  }
  return -1;
}

/**
 * Smooth the outline of `mask`: two passes of a majority over each tile's
 * 3x3, which rounds off the single-tile notches and bumps the discs and the
 * noise leave, and then {@link fillGaps}.
 */
function smoothWater(mask: Uint8Array, width: number, height: number): void {
  const at = (m: Uint8Array, x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? m[y * width + x]! : 0);
  for (let pass = 0; pass < 2; pass++) {
    const was = mask.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += at(was, x + dx, y + dy);
        mask[y * width + x] = n >= 5 ? 1 : 0;
      }
    }
  }
  fillGaps(mask, width, height);
}

/**
 * Water in every tile of `mask` where there is too little ground between two
 * reaches of water for the cliff to be drawn, until nothing changes.
 *
 * That is a tile with water on three or four sides, a spike of bank or a
 * crumb of ground; ground up to `CLIFF_FACE_TILES` tall with water straight
 * above and below it, since a face is that tall and a shorter one shows only
 * its bottom slice; and ground up to two tiles wide with water either side,
 * where the two banks' edges would meet.
 */
function fillGaps(mask: Uint8Array, width: number, height: number): void {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? mask[y * width + x]! : 0);
  const set = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) mask[y * width + x] = 1;
  };
  /** Water at both ends of a run of `length` ground tiles from (x, y), stepping (dx, dy). */
  const between = (x: number, y: number, dx: number, dy: number, length: number) => {
    if (!at(x - dx, y - dy) || !at(x + dx * length, y + dy * length)) return false;
    for (let k = 0; k < length; k++) if (at(x + dx * k, y + dy * k)) return false;
    return true;
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) continue;
        const sides = at(x + 1, y) + at(x - 1, y) + at(x, y + 1) + at(x, y - 1);
        if (sides >= 3) {
          set(x, y);
          changed = true;
          continue;
        }
        for (let length = 1; length <= C.CLIFF_FACE_TILES; length++) {
          if (!between(x, y, 0, 1, length)) continue;
          for (let k = 0; k < length; k++) set(x, y + k);
          changed = true;
        }
        for (let length = 1; length <= 2; length++) {
          if (!between(x, y, 1, 0, length)) continue;
          for (let k = 0; k < length; k++) set(x + k, y);
          changed = true;
        }
      }
    }
  }
}

/** Clear every 4-connected piece of `mask` but the largest. */
function keepLargest(mask: Uint8Array, width: number, height: number): void {
  const piece = new Int32Array(mask.length).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || piece[i]! >= 0) continue;
    const tiles = fill(width, height, i, (n) => mask[n] === 1);
    let n = 0;
    for (let j = 0; j < tiles.length; j++) {
      if (tiles[j]) {
        piece[j] = sizes.length;
        n++;
      }
    }
    sizes.push(n);
  }
  const largest = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < mask.length; i++) if (mask[i] && piece[i] !== largest) mask[i] = 0;
}

/** Every tile `open` joins to `start`, 4-connected. */
function fill(width: number, height: number, start: number, open: (i: number) => boolean): Uint8Array {
  const out = new Uint8Array(width * height);
  if (start < 0) return out;
  out[start] = 1;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const x = i % width;
    const y = (i - x) / width;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (out[n] || !open(n)) continue;
      out[n] = 1;
      queue.push(n);
    }
  }
  return out;
}

/**
 * Where camp stands in its part: `campDown` of the way from the part's top
 * row to its bottom, in the middle of the widest run of the part on that row.
 */
function campIn(ring: Uint8Array, width: number, height: number): Vec2 {
  let top = height;
  let bottom = -1;
  for (let i = 0; i < ring.length; i++) {
    if (!ring[i]) continue;
    const y = Math.floor(i / width);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const y = Math.round(top + C.VALLEY.campDown * (bottom - top));
  let best = { from: 0, length: 0 };
  let from = -1;
  for (let x = 0; x <= width; x++) {
    const inside = x < width && ring[y * width + x] === 1;
    if (inside && from < 0) from = x;
    if (!inside && from >= 0) {
      if (x - from > best.length) best = { from, length: x - from };
      from = -1;
    }
  }
  return { x: best.from + Math.floor(best.length / 2) + 0.5, y: y + 0.5 };
}

/** The plan mirrored east to west. */
function mirror(plan: ValleyPlan): ValleyPlan {
  const { width, height } = plan;
  const flip = (mask: Uint8Array) => {
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) out[y * width + (width - 1 - x)] = mask[y * width + x]!;
    }
    return out;
  };
  return {
    width,
    height,
    floor: flip(plan.floor),
    river: flip(plan.river),
    stream: flip(plan.stream),
    ponds: flip(plan.ponds),
    cliff: flip(plan.cliff),
    ring: flip(plan.ring),
    camp: { x: width - plan.camp.x, y: plan.camp.y },
  };
}
