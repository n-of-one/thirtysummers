/**
 * Every tunable number in the prototype lives here so feel can be tweaked
 * without reading any logic.
 *
 * Values marked [DOC] come from docs/design/ or docs/current/five-summers.md.
 * Values marked [GUESS] were not specified and were chosen to make the
 * summer play sensibly -- these are the ones worth arguing about.
 */

// ---------------------------------------------------------------- world ----

export const MAP_W = 128;
export const MAP_H = 128;
export const MAP_LAYERS = 1; // z-levels: only layer 0 is generated for now
export const DEFAULT_SEED = 1337;

/** On-screen size of one tile, in CSS pixels. */
export const TILE = 64;

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
/** [GUESS] Speed multiplier on difficult terrain (underbrush, mud). Tuned in play. */
export const DIFFICULT_SPEED_MUL = 0.4;

/** [GUESS] Collision radius of the player, in tiles. */
export const PLAYER_RADIUS = 0.3;

// ---------------------------------------------------------------- camera ----

/**
 * [GUESS] How hard the camera is pulled toward the player, per second. Higher
 * follows more tightly; lower glides further behind.
 */
export const CAMERA_STIFFNESS = 12;

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
 * hydration down to the threshold. Sized for a full HD screen: 13 tiles is
 * 832px, so the dark begins just inside the left and right edges and the
 * corners start out well darkened...
 */
export const FOG_MAX_RADIUS_TILES = 13;
/** [GUESS] ...and at zero hydration. */
export const FOG_MIN_RADIUS_TILES = 2.5;

// ----------------------------------------------------------------- items ----

/** [DOC] The backpack holds 10 items, counting every resource type together. */
export const BACKPACK_CAPACITY = 10;
/** [DOC] Each ore chunk is worth 1 gold (the doc says feather; you asked for ore). */
export const ORE_GOLD = 1;

// -------------------------------------------------------------------- HUD ----
// Purely cosmetic thresholds: when a readout turns from calm to alarming.

/** [GUESS] Seconds left in the summer below which the clock turns urgent. */
export const CLOCK_URGENT_SEC = 60;

/**
 * The outline drawn on the tile a cut or a bridge would land on.
 *
 * Both act on the nearest tile of the right kind rather than on the one the
 * player is facing, and until the tile was marked there was no way to tell
 * which one that was until the materials had already been spent on it.
 */
/** [GUESS] Thickness of the outline, in screen pixels. */
export const TARGET_OUTLINE_PX = 3;
/** [GUESS] Colour when the action can be carried out... */
export const TARGET_COLOR = 0xffe9a8;
/** ...and when it is the right action here but not possible. */
export const TARGET_BLOCKED_COLOR = 0xe0674f;
/** [GUESS] Opacity of the outline. */
export const TARGET_OUTLINE_ALPHA = 0.95;
/**
 * [GUESS] Height of the progress bar along the bottom of the marked tile.
 *
 * A bar rather than a fill over the whole tile: a wash pale enough to see the
 * ground through lightens a thicket until it reads as already cut, which is
 * the one thing the marker must not say.
 */
export const TARGET_PROGRESS_PX = 8;

/**
 * [GUESS] Screen pixels below the player's feet where the action prompt and the
 * toasts hang. Far enough down to clear the sprite, close enough that reading
 * one does not mean looking away from the other.
 */
export const PROMPT_OFFSET_PX = 44;
/**
 * [GUESS] Closest that floating stack comes to the edge of the window. The
 * camera stops at the map border while the player keeps walking, so at the
 * edges of the world the prompt would otherwise hang off the screen.
 */
export const PROMPT_EDGE_MARGIN_PX = 16;

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
 * What a cut thicket tile turns into. Grass, so a cut path is also a fast path
 * and the second trip through is visibly cheaper than the first. `underbrush`
 * is the other candidate: it would leave the cut readable but still slow.
 */
export const CUT_LEAVES = "grass" as const;

/** [DOC] Sticks and vines one bridge tile costs. */
export const BRIDGE_STICKS = 1;
export const BRIDGE_VINES = 1;

// ------------------------------------------------------------- worldgen ----

/** Noise feature size, in tiles. Larger = broader forests and clearings. */
export const FOREST_SCALE = 34;
export const MOISTURE_SCALE = 22;
export const STREAM_SCALE = 90;

/** Noise value above which grass becomes underbrush. */
export const UNDERBRUSH_THRESHOLD = 0.10;
/**
 * Noise value above which a tile counts as forest. Forest floor is underbrush;
 * trees are then scattered across it at a density that follows the same noise,
 * so a wood thins out towards its edges instead of ending at a hard line.
 */
export const TREE_THRESHOLD = 0.20;

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

/** Thickness of the impassable rock border around the playable area. */
export const BORDER_THICKNESS = 2;

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
 * Springs, the drinking spots. They stand near a stream but never touch it, so
 * the water you drink from and the water you bridge are different tiles.
 */
/**
 * [GUESS] Tiles from a spring to the nearest stream tile, counting diagonals.
 * At 2 the bank tile between a spring and the stream reaches both; there the
 * key is the bridge, and the spring is drunk from its other sides.
 */
export const SPRING_STREAM_DISTANCE = 2;
/** [GUESS] Closest two springs may stand, so there are many but never a wall of them. */
export const SPRING_SPACING_TILES = 6;
/** [GUESS] No spring this close to the camp, which needs its clearing. */
export const SPRING_CAMP_CLEARANCE = 3;

/** How many of each resource to scatter. */
export const FRUIT_NODES = 45;
export const ORE_NODES = 140;

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
