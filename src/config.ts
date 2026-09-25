/**
 * Every tunable number in the prototype lives here so feel can be tweaked
 * without reading any logic.
 *
 * Values marked [DOC] come from docs/design/ or docs/current/five-summers.md.
 * Values marked [GUESS] were not specified and were chosen to make the
 * summer play sensibly -- these are the ones worth arguing about.
 */

// ---------------------------------------------------------------- world ----

export const MAP_W = 168;
export const MAP_H = 168;
export const MAP_LAYERS = 1; // z-levels: only layer 0 is generated for now
export const DEFAULT_SEED = 1337;
/**
 * A bare address rolls a seed below this and puts it in the address bar, so a
 * playtest is a new map each time and still says which one it was. Small
 * enough to read out loud and to type back in.
 */
export const SEED_ROLL_MAX = 1000;

/** Size of one tile in the view, in logical pixels. */
export const TILE = 32;

// ----------------------------------------------------------------- view ----

/**
 * The logical view the game is drawn in, whatever the window: full HD, chosen
 * in play over 1280x720. It is scaled to fit the window with black bars where
 * the shapes differ, so the same number of tiles is on screen everywhere: 60
 * by 33.75 at TILE 32. `?view=1280x720` tries another.
 */
export const VIEW_W = 1920;
export const VIEW_H = 1080;
/**
 * The view's scale, in device pixels per logical pixel, is floored to a
 * multiple of this. Chosen when an art pixel was 8 logical pixels (TILE 64), so
 * any multiple of 1/8 covered a whole number of screen pixels. At TILE 32 an
 * art pixel is 4 logical pixels and that needs a multiple of 1/4; not yet
 * changed. Scale 1 and 2 are whole either way.
 */
export const VIEW_SCALE_STEP = 1 / 8;

// --------------------------------------------------------------- summer ----

/**
 * [DOC] A summer is 5 minutes in year 1. The design doc puts summer length on
 * an age curve that peaks at 15 minutes from year 10 to 20; nothing ages yet,
 * so every summer is the year-1 length.
 */
export const SUMMER_LENGTH_SEC = 300;

// ------------------------------------------------------------ simulation ----

/**
 * Length of one simulation step. The whole simulation runs at this rate,
 * regardless of frame rate, so per-second values do not drift with it.
 */
export const TICK_SEC = 1 / 60;
/**
 * Longest frame the loop will account for. A backgrounded tab returns with a
 * frame worth minutes; anything past this is dropped rather than caught up on,
 * so the loop cannot fall into a spiral it never climbs out of.
 */
export const MAX_FRAME_SEC = 0.25;

// ------------------------------------------------------------- movement ----

/**
 * [GUESS] Walking speed, in tiles per second. Raised from 7 when sprint went,
 * since walking is now the only speed there is. Tune in play.
 */
export const WALK_SPEED = 8;
/**
 * [GUESS] Speed multipliers on the two kinds of rough ground. Tuned in play.
 *
 * They differ so the two barriers feel like different things: underbrush is
 * pushed through, mud is waded. At one shared 0.4 they read as one obstacle
 * drawn two ways.
 */
export const UNDERBRUSH_SPEED_MUL = 0.5;
export const MUD_SPEED_MUL = 0.3;

/**
 * [GUESS] Trails. Each time the player's centre walks over an underbrush tile
 * and leaves it wears it one stage further, and each stage is drawn flatter and
 * walked faster: trodden, trodden again, then flat at full speed. The first
 * walk already leaves a line that pays, because the player has to see what
 * walking does on the first trip, not find out by luck. A flat tile is still
 * underbrush, so the paths stay paths and the ring does not turn to lawn.
 *
 * One multiplier per stage, in order; the last is flat.
 */
export const TRAIL_SPEED_MULS = [0.7, 0.85, 1] as const;
/** How many stages a trail has, and the wear at which a tile is flat. */
export const TRAIL_STAGES = TRAIL_SPEED_MULS.length;

/** [GUESS] Collision radius of the player, in tiles. */
export const PLAYER_RADIUS = 0.3;

// ---------------------------------------------------------------- camera ----

/**
 * [GUESS] How hard the camera is pulled toward the player, per second. Higher
 * follows more tightly; lower glides further behind.
 */
export const CAMERA_STIFFNESS = 120;

// ------------------------------------------------------------- hydration ----

/** Hydration is a percentage, so it tops out here. */
export const HYDRATION_MAX = 100;
/**
 * [GUESS] Hydration lost per second, whatever the player is doing. A full bar
 * runs dry in 100 seconds.
 */
export const HYDRATION_DRAIN = 1.0;
/**
 * [GUESS] Drinking is offered only below this, so a spring beside a thicket or
 * a node does not take the key from them while the bar is nearly full.
 */
export const DRINK_OFFER_BELOW = 90;
/**
 * [GUESS] Below this the fog closes in, and the player is told they are
 * thirsty. Fog is the only cost of running dry; above it the view is ringed at
 * its widest.
 */
export const HYDRATION_FOG_THRESHOLD = 50;
/**
 * [GUESS] Radius of the clear circle round the player, in tiles, from full
 * hydration down to the threshold. In tiles rather than a share of the view,
 * because what is seen is the simulation's to know, and it does not know the
 * view: 9 is 288 logical pixels, 0.3 of half the width in full HD...
 */
export const FOG_MAX_RADIUS_TILES = 9;
/** [GUESS] ...and at zero hydration. */
export const FOG_MIN_RADIUS_TILES = 2.5;
/**
 * [GUESS] How far past the fog's clear radius a tile still counts as seen, for
 * the map: 14/9 of it, 14 tiles at full hydration, where the fade is well on
 * its way to black but the ground can still be made out. The corner map is
 * that circle and nothing round it, so its size follows: see
 * MAP_DIAMETER_TILES.
 */
export const SEEN_RADIUS_MUL = 14 / 9;
/**
 * [GUESS] The colour the fog darkens to. Pure black meets the black bars round
 * the view without a seam; 0x080a07 is the near-black it used to be.
 */
export const FOG_COLOR = 0x000000;
/**
 * [GUESS] How the fog darkens outside the clear radius, as
 * [distance as a multiple of the radius, opacity from 0 to 1] pairs, in order
 * outwards. Clear up to 1, then the stops, and fully opaque from the last stop
 * on, whatever its opacity says. With FOG_MAX_RADIUS_TILES at 9 the side
 * edges of full HD are at about 3.3 of the widest radius and its corners at
 * about 3.8, so every stop below is inside the view. Settled in play: a long,
 * even fade to black at 1.9. Tried before it, with the radius at 0.87, where
 * the side edges were at 1.15:
 *
 * - `[[1, 0], [1.06, 0.85], [1.12, 1]]`, black just before the side edges.
 * - `[[1, 0], [1.08, 0.75], [1.2, 0.95], [1.35, 1]]`, the first darker try.
 * - `[[1, 0], [1.15, 0.5], [1.35, 0.85], [1.6, 1]]`, the original soft edge.
 */
export const FOG_STOPS: readonly (readonly [number, number])[] = [
  [1.0, 0],
  [1.2, 0.1],
  [1.3, 0.2],
  [1.4, 0.3],
  [1.5, 0.5],
  [1.6, 0.7],
  [1.8, 0.9],
  [1.9, 1],
  // [1.25, 1],
];

// ----------------------------------------------------------------- items ----

/**
 * [DOC] The backpack holds 10 slots, counting every resource type together.
 * A bulky kind takes two; how many each takes, and what each sells for, is the
 * resource table in sim/resources.ts.
 */
export const BACKPACK_CAPACITY = 10;

// ---------------------------------------------------------------- winter ----
// What winter costs and what the surplus is worth, from
// docs/current/five-summers.md: the near ring's feathers make more than the
// rent, its trees hold about twice the food a winter eats, and anything for the
// family comes from across the stream.

/**
 * [DOC] The fruit winter eats...
 *
 * These are level 0's row of the upkeep table in five-summers.md, charged flat
 * every winter. M10.6 turns the two of them into `UPKEEP_BY_LEVEL`, and the
 * two players' tables in that document are its arithmetic, not this one's.
 */
export const UPKEEP_FRUIT = 8;
/** ...and the rent it wants besides. */
export const UPKEEP_GOLD = 6;
/** [DOC] Extra gold owed for ending the summer away from camp. */
export const AWAY_GOLD_CHARGE = 3;
/**
 * [DOC] What the town charges for one fruit. Above what fruit sells for, so
 * buying food back is always the worse end of the deal.
 */
export const FRUIT_BUY_PRICE = 2;
/**
 * [DOC] What the family's levels cost, as a running total of the surplus
 * given over every winter. A level opens more of the shop.
 */
export const FAMILY_LEVELS: readonly number[] = [10, 35, 80, 140, 220];

// -------------------------------------------------------- between summers ----
// What the map does while the family is away. Everything here is drawn from a
// seed and the year, so a map and a year always come out the same.

/**
 * [DOC] Share of what was picked outside the near ring this summer that is
 * back next summer, for a kind whose `returns` is `slowly`. Rounded down, so
 * 30 picked is 15 back, and 15 picked is 7.
 */
export const REPLENISH_SHARE = 0.5;
/** [DOC] Winters after it was felled that a sapling stands again. */
export const SAPLING_RETURN_YEARS = 3;
/**
 * [GUESS] Chance each winter that a cut tile touching thicket grows back, so a
 * path through a wall narrows at its edges.
 */
export const THICKET_CREEP_CHANCE = 0.3;
/** [DOC] A bridge loses one tile every this many winters. */
export const BRIDGE_WEAR_EVERY = 2;
/**
 * [DOC] A tired summer, after a winter that could not be paid: every hold
 * takes this many times as long, except the one that opens the transfer
 * panel...
 */
export const TIRED_HOLD_MUL = 1.5;
/**
 * ...and rough ground is walked at this share of its own speed, so mud stays
 * the slower of the two in a tired summer as well.
 */
export const TIRED_ROUGH_MUL = 0.625;

// -------------------------------------------------------------------- HUD ----
// Purely cosmetic thresholds: when a readout turns from calm to alarming.

/**
 * [GUESS] The last stretch of the summer, in seconds. Below it the clock turns,
 * a notice away from camp says to head back, an arrow at the edge of the view
 * points at camp, and the evening draws in.
 */
export const HOMEWARD_SEC = 45;
/** [GUESS] Logical pixels between the camp arrow and the edge of the view. */
export const EDGE_ARROW_MARGIN_PX = 28;
/**
 * [GUESS] The dusk: a full-view tint multiplied over the world, rising from
 * nothing at HOMEWARD_SEC left to its full opacity at the end of the summer.
 * Warm, so it cannot be taken for the fog, which is a black ring.
 */
export const DUSK_COLOR = 0xe8904f;
export const DUSK_MAX_ALPHA = 0.8;
/** Opacity steps the dusk moves in, so most frames write nothing. */
export const DUSK_ALPHA_STEP = 0.01;

/**
 * The outline drawn on the tile a cut or a bridge would land on, so the player
 * can see which tile it is before the materials are spent on it.
 */
/** [GUESS] Thickness of the outline, in logical pixels. */
export const TARGET_OUTLINE_PX = 3;
/** [GUESS] Colour when the action can be carried out... */
export const TARGET_COLOR = 0xffe9a8;
/** ...and when it is the right action here but not possible. */
export const TARGET_BLOCKED_COLOR = 0xe0674f;
/** [GUESS] Opacity of the outline. */
export const TARGET_OUTLINE_ALPHA = 0.95;

/**
 * [GUESS] Screen pixels below the player's feet where the action prompt and the
 * toasts hang. Far enough down to clear the sprite, close enough that reading
 * one does not mean looking away from the other.
 */
export const PROMPT_OFFSET_PX = 44;
/**
 * [GUESS] Closest that floating stack comes to the edge of the view. The
 * camera stops at the map border while the player keeps walking, so at the
 * edges of the world the prompt would otherwise hang off the screen.
 */
export const PROMPT_EDGE_MARGIN_PX = 16;
/** The key that ends the summer at camp, as `KeyboardEvent.key`, lower case. */
export const END_SUMMER_KEY = "q";
/**
 * The key that opens the build menu, and closes it again. The menu is where a
 * build is chosen; the clock keeps running while it is open, because choosing
 * what to build is part of what a summer is spent on.
 */
export const BUILD_MENU_KEY = "b";
/** The key that drops what is being built, along with the menu key itself. */
export const BUILD_CANCEL_KEY = "escape";

// ------------------------------------------------------------------ map ----

/**
 * [GUESS] Tiles across the map in the corner, a circle round the player: the
 * player's tile and 28 either side, twice the radius of the circle marked seen
 * at full hydration. What is being taken in fills the middle; the ring round
 * it is ground seen before, or blank. The rest of the valley is behind
 * MAP_KEY. Odd, so the player's tile is the middle cell.
 */
export const MAP_DIAMETER_TILES = 57;
/** [GUESS] Logical pixels between the map and the corner of the view. A multiple of the art pixel, 4. */
export const MAP_MARGIN_PX = 16;
/**
 * The key that swaps the tile view for the whole map and back, as
 * `KeyboardEvent.key`, lower case. The clock runs and the player can walk
 * while it is open: it is a way of looking, not a pause.
 */
export const MAP_KEY = "m";
/**
 * [GUESS] Most art pixels a tile the whole map is drawn at. It takes the most
 * that fit the view, and more than 3 would make a tile look like a sprite.
 */
export const MAP_WHOLE_MAX_ART_PX = 3;
/**
 * [GUESS] The map's colours, coarse on purpose: the shape of the land, not its
 * art. A colour per terrain, and trails are not drawn: worn underbrush is
 * underbrush until it is walked into grass. Resource nodes are not drawn, but
 * a fruit tree is, as a landmark.
 */
export const MAP_COLORS = {
  /** Inside the circle, never seen. */
  unseen: 0x16150f,
  grass: 0x6f8f46,
  underbrush: 0x4f6c38,
  denseUnderbrush: 0x3a522e,
  mud: 0x6b5838,
  stream: 0x3d6f9e,
  /** Trees and saplings: the woods are most of the valley's shape. */
  tree: 0x263a22,
  /** A fruit tree, as a 2 by 2 block from its trunk, picked or not. */
  fruitTree: 0xd9503c,
  rock: 0x5a5a5c,
  thicket: 0x4d3b2c,
  bridge: 0xa07a48,
  camp: 0xf2d06e,
  well: 0x8fd6f2,
  player: 0xffffff,
} as const;

// ---------------------------------------------------------- interaction ----

/** [GUESS] Seconds of holding the interact key to harvest a node. */
export const HARVEST_TIME = 0.6;
/** [GUESS] How close (in tiles) you must be to harvest or use the camp. */
export const INTERACT_RADIUS = 1.1;

/**
 * [GUESS] Seconds of holding the interact key to cut through one thicket tile.
 * Longer than a harvest, because a wall should cost more than a berry.
 */
export const CUT_TIME = 1.5;
/** [GUESS] Seconds of holding it to lay one bridge tile. */
export const BUILD_TIME = 2;
/** [GUESS] Seconds of holding it beside a spring to drink your fill. */
export const DRINK_TIME = 0.8;

/**
 * What a cut thicket tile turns into. Underbrush, now that trails wear it: the
 * knife opens the wall and the feet make the path, so a cut path through
 * thicket gets faster by being walked, like any other. It was grass before
 * trails, when nothing else would have made the second trip cheaper.
 */
export const CUT_LEAVES = "underbrush" as const;

/** [DOC] Sticks and vines one bridge tile costs. */
export const BRIDGE_STICKS = 1;
export const BRIDGE_VINES = 1;

/** [GUESS] Seconds of holding the key to fell one sapling with the axe. */
export const FELL_TIME = 2;

/** [GUESS] Logs and sticks a well costs. */
export const WELL_LOGS = 2;
export const WELL_STICKS = 2;
/** [GUESS] Seconds of holding the key to dig a well. */
export const WELL_TIME = 6;
/**
 * [GUESS] Closest a well may be dug to water, in tiles counting diagonals:
 * to a stream tile, a spring, or another well. A well is for where there is
 * no water, so nearer than this it is refused.
 */
export const WELL_WATER_CLEARANCE = 16;

// -------------------------------------------------------- the transfer ----

/**
 * [GUESS] Seconds of holding the interact key at camp to open the
 * transfer panel. Short, because the tap that banks everything happens on the
 * release: hold any longer than this and the arrival was never a quick one.
 */
export const TRANSFER_HOLD_TIME = 0.45;
/**
 * Keys that close the transfer panel, as `KeyboardEvent.key`, lower case.
 *
 * The interact keys, so the key that opened it puts it away again, which is
 * what a player reaches for. Escape too, because the browser takes Escape to
 * leave full screen whatever we do, and a key that drops full screen and
 * leaves the panel up would be the worse surprise.
 *
 * Holding an interact key is what opens the panel, so that key is still down
 * when it appears, and a held key repeats: every repeat would shut the panel
 * the instant it opened. The panel ignores auto-repeats for exactly this
 * reason; only a fresh press closes it. Shift is the modifier that moves a
 * whole kind rather than one of it.
 */
export const TRANSFER_CLOSE_KEYS = ["e", " ", "escape"] as const;

// ------------------------------------------------------------ dropping ----

/** [GUESS] The key that drops every item of the selected kind. */
export const DROP_KEY = "x";
/** [GUESS] The key that cycles the selected kind through what the pack holds. */
export const DROP_SWITCH_KEY = "c";
/**
 * [GUESS] How far out a drop will spill looking for free tiles, in rings
 * around the player. One item lands per tile, so a full pack of ten needs
 * three rings of open ground at worst; four leaves room for a hedge.
 */
export const DROP_SPILL_RINGS = 4;

// ------------------------------------------------------------- worldgen ----

/** Noise feature size, in tiles. Larger = broader forests and clearings. */
export const FOREST_SCALE = 34;
export const MOISTURE_SCALE = 22;
export const STREAM_SCALE = 90;

/** What a band of the forest noise grows. */
export type ForestGround = "underbrush" | "denseUnderbrush" | "trees";
/** One row of `FOREST_THRESHOLDS`. */
export interface ForestBand {
  /** The forest noise value this band starts at. It runs up to the next row. */
  from: number;
  ground: ForestGround;
  /** For underbrush: the trail stage it starts at, 1 trodden, 2 trodden again, 3 flat, 0 or absent full. */
  stage?: number;
}

/**
 * [GUESS] The forest noise, band by band, from open ground to the middle of a
 * wood. The noise runs from about -0.8 to 0.8 round 0, and `tmp/noise.mjs`
 * prints what share of a seed lies below any value. Below the first row it is
 * grass, or mud where the moisture noise is high.
 *
 * - `underbrush`, at a trail stage. The thin stages are the same ones a trail
 *   wears, so thin underbrush looks and walks like a trodden tile, and walking
 *   it wears it further. Following the noise, the underbrush thickens the way
 *   the noise rises, and the edges form themselves.
 * - `denseUnderbrush`: as slow as full underbrush, but walking never wears it
 *   and the knife has nothing to cut.
 * - `trees`: from here up is a wood. Trees are scattered over it, thinly at
 *   this row and thicker towards `FOREST_NOISE_MAX`, and the floor between
 *   them is the row before this one.
 */
export const FOREST_THRESHOLDS: readonly ForestBand[] = [
  { from: -0.3, ground: "underbrush", stage: 3 },
  { from: -0.2, ground: "underbrush", stage: 2 },
  { from: -0.1, ground: "underbrush", stage: 1 },
  { from: 0, ground: "underbrush", stage: 0 },
  { from: 0.12, ground: "denseUnderbrush" },
  { from: 0.2, ground: "trees" },
  // { from: 0.07, ground: "underbrush", stage: 3 },
  // { from: 0.1, ground: "underbrush", stage: 2 },
  // { from: 0.13, ground: "underbrush", stage: 1 },
  // { from: 0.16, ground: "underbrush", stage: 0 },
];
/** Noise value above which grass becomes underbrush, at its thinnest: the first row. */
export const UNDERBRUSH_THRESHOLD = FOREST_THRESHOLDS[0]!.from;
/** Noise value above which trees stand: the `trees` row, or never without one. */
export const TREE_THRESHOLD = FOREST_THRESHOLDS.find((b) => b.ground === "trees")?.from ?? Infinity;

/** Share of forest tiles that become trees at the thinnest fringe... */
export const TREE_DENSITY_EDGE = 0.06;
/** ...and in the deepest part of the wood. Keep below ~0.4 or canopies merge. */
export const TREE_DENSITY_CORE = 0.30;
/**
 * Noise value treated as "deepest forest" when scaling density. Four octaves of
 * fbm almost never reach 1.0, so normalising against 1.0 would leave every wood
 * looking like a fringe.
 */
export const FOREST_NOISE_MAX = 0.7;
/** Moisture above which open grass turns to mud. */
export const MUD_THRESHOLD = 0.45;
/** Half-width of the band around zero that becomes stream. Wider = fatter river. */
export const STREAM_WIDTH = 0.03;

/**
 * [GUESS] Thickness of the impassable rock border around the playable area.
 * Wide on purpose: the camera stays centred on the player, and it can only do
 * that at the edge of the play area while half a view of map lies beyond it.
 * Half the view is VIEW_W / 2 / TILE tiles across and VIEW_H / 2 / TILE down.
 */
export const BORDER_THICKNESS = 20;

/**
 * Stream widening runs to a fixed point. This is the give-up count, not a
 * target: two passes is already more than any seed has needed.
 */
export const STREAM_THICKEN_PASSES = 8;
/** Stranded patches smaller than this are left stranded, not worth a ford. */
export const FORD_MIN_REGION = 25;
/** Give-up count for ford carving, so a pathological map cannot loop forever. */
export const FORD_MAX_COUNT = 60;

/**
 * Springs, the drinking spots: reeds on a walkable tile of the stream's bank.
 */
/** [GUESS] Closest two springs may stand, in tiles counting diagonals. */
export const SPRING_SPACING_TILES = 6;
/** [GUESS] No spring this close to the camp, which needs its clearing. */
export const SPRING_CAMP_CLEARANCE = 3;
/**
 * The seed springs are shuffled with on a hand-edited map, which has no seed of
 * its own, so the same file gets the same springs every load.
 */
export const MAP_SPRING_SEED = 1;

/** How many of each resource to scatter on a plain noise map. */
export const FRUIT_NODES = 45;
export const ORE_NODES = 140;

// ------------------------------------------------- the five-summer layout ----
// The pass that stamps the table of the first five summers onto a noise map:
// the half circle of stream round camp, the near ring inside it, and the
// pockets beyond. Everything here is [GUESS] unless it says otherwise, and
// what each summer has to open is [DOC], from docs/current/five-summers.md.

/**
 * The laid-out map, which is larger than the plain noise one: the near ring
 * alone is about six times the area it was, so that the first summer has
 * somewhere to explore rather than a clearing to sweep.
 */
export const LAYOUT_W = 200;
export const LAYOUT_H = 180;
/**
 * The rock border on a laid-out map. Thin, because the camera is allowed to
 * stop at the edge of play here: these maps are walked, not generated around.
 */
export const LAYOUT_BORDER = 2;
/** Tiles between the camp and the bottom border. */
export const CAMP_FROM_BOTTOM = 12;

/**
 * [DOC] The first stream: a half circle round camp, with springs along both
 * sides, run down to the border so the ring it makes is closed. This is its
 * radius, and everything inside it is the near ring.
 */
export const NEAR_RING_RADIUS = 58;
/** Half the stream's width, in tiles, before the generator's own thickening. */
export const STREAM_HALF_WIDTH = 1.5;
/** The camp's own clearing, cut out of whatever the noise put there. */
export const CAMP_CLEARING = 4;

/** The sapling stand in the near ring: sticks behind a thin wall of thicket. */
export const STAND_RADIUS = 6;
/** [DOC] "about three tiles" of thicket, which is a first-summer job. */
export const STAND_WALL = 3;
/** Share of the stand's own tiles that are saplings rather than open ground. */
export const STAND_SAPLING_SHARE = 0.3;
/**
 * The mud pocket in the near ring: vines in mud, and no thicket round it. The
 * mud is the whole barrier, and it only costs time.
 */
export const MUD_POCKET_RADIUS = 8;
/**
 * [GUESS] Tiles of mud a vine keeps on every side of it. A vine on the rim can
 * be taken from the grass beside it, and then the pocket has cost nothing.
 */
export const MUD_VINE_INSET = 2;

/** The feather field across the stream, as tiles beyond the stream's radius. */
export const FEATHER_FIELD_BEYOND = 16;
export const FEATHER_FIELD_RADIUS = 10;
/** The shell field the copse hides, and the copse: a wall of saplings round it. */
export const SHELL_FIELD_BEYOND = 44;
export const SHELL_FIELD_SIDE = 36;
export const SHELL_FIELD_RADIUS = 9;
export const COPSE_WALL = 3;
/**
 * A band of underbrush round the copse, so the only grass into the far field
 * is the route: the cart runs on grass and bridge, and a road that is already
 * there is not a summer's work.
 */
export const COPSE_MOAT = 5;
/** Where the hedge sits on that route, as tiles out from the far field. */
export const HEDGE_FROM_FIELD = 14;
export const HEDGE_RADIUS = 2.5;
/**
 * Where the route bends on its way in, as tiles out from the far field. Far
 * enough past the band of underbrush that the last leg crosses it once, dead
 * straight, with the hedge on it.
 */
export const ROUTE_BEND_FROM_FIELD = 30;

/**
 * [DOC] How many of each kind the layout scatters, by where it goes. The dry
 * pocket and the last pocket are out of the layout until they are needed: the
 * dry pocket comes back with M12, and the thick wall is parked.
 */
export const LAYOUT_NODES = {
  nearRingTrees: 5,
  nearRingFruit: 15,
  nearRingFeathers: 10,
  standSticks: 6,
  pocketVines: 6,
  featherFieldFeathers: 30,
  featherFieldTrees: 1,
  featherFieldFruit: 4,
  shellFieldShells: 10,
} as const;
/**
 * [DOC] Fruit under one tree. A fruit tree is an ordinary tree tile with a few
 * ordinary fruit nodes on the open grass round it: nothing in the simulation
 * knows the two belong together, and what says "fruit tree" to the player is
 * the fruit rather than the tree.
 *
 * A field's fruit is split between its trees inside these bounds rather than
 * shared out evenly, because a tree that always holds the same number is a
 * counted thing and not a place: 15 fruit over 5 trees in the ring is a tree
 * worth walking to and a tree worth passing by. The total is still about twice
 * what a winter eats, so the ring's food is a handful of stops rather than a
 * sweep of the whole ring.
 */
export const FRUIT_PER_TREE_MIN = 2;
export const FRUIT_PER_TREE_MAX = 4;
/**
 * [GUESS] Chance that a tree with more fruit than the ground in front of it can
 * hold hangs its last one behind the trunk, where the canopy covers it.
 *
 * A tree is drawn from the foot of its trunk upwards, so the three tiles north
 * of it are under the canopy and a fruit there is not seen until the player is
 * past the tree. Two or three fruit are therefore always in front of it or
 * beside it; only the fourth is ever hidden, and then only sometimes, so a
 * tree can still surprise without a stop ever looking empty.
 */
export const FRUIT_BEHIND_CHANCE = 0.3;
/**
 * Closest two nodes of the near ring may stand, in tiles. The ring is large
 * and its handful of nodes are what there is to find in it, so they are held
 * apart rather than left to clump where the grass happens to be.
 */
export const NEAR_RING_SPACING = 7;
/** The same inside a field or a pocket, where a gathering run is the point. */
export const FIELD_SPACING = 2;

// ------------------------------------------------------------- animation ----

/**
 * [GUESS] Tiles walked per animation frame. Driving the walk cycle by distance
 * rather than time keeps footfalls in step with actual speed, so wading through
 * mud automatically produces slower strides.
 */
export const WALK_FRAME_TILES = 0.62;

/**
 * [GUESS] When a tree stands between the camera and the player, the player is
 * redrawn on top of it as a flat silhouette so you can still see where you are.
 * Only trees get this: every other prop is short enough that simply walking
 * behind it reads fine.
 */
export const SILHOUETTE_COLOR = 0x000000;
/**
 * Opacity of the silhouette. It is masked to exactly the covered pixels, so
 * partial cover needs no fading -- the uncovered half of the character stays in
 * full colour on its own.
 */
export const SILHOUETTE_ALPHA = 0.9;

/**
 * [GUESS] Time constant, in seconds, for the player sprite easing onto the art
 * pixel grid once it stops.
 *
 * Snapping the player while it moves fights the smoothly panning camera and
 * makes the sprite stutter, so it is left unsnapped in motion. At rest there is
 * nothing to fight, so it glides the last part of an art pixel onto the grid.
 * Short enough to feel immediate, long enough not to read as a pop.
 */
export const PIXEL_SETTLE_SEC = 0.05;

/** [GUESS] Seconds each frame of the water ripple is held. */
export const WATER_FRAME_SEC = 0.45;

// ------------------------------------------------------------------ debug ----
// Only reachable with ?debug=1. Nothing here changes how the game plays.

/** Slowest the debug overlay will run the simulation: real time. */
export const TIME_SCALE_MIN = 1;
/**
 * [GUESS] Fastest time scale. Ten turns the 5-minute summer into 30 seconds,
 * which is what the whole slider is for: seeing a summer out without spending
 * one on it.
 */
export const TIME_SCALE_MAX = 10;
/** Granularity of the slider. */
export const TIME_SCALE_STEP = 0.5;
