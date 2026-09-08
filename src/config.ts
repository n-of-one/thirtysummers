/**
 * Every tunable number in the prototype lives here so feel can be tweaked
 * without reading any logic.
 *
 * Values marked [DOC] come straight from the design document.
 * Values marked [GUESS] were not specified and were chosen to make the day
 * play sensibly -- these are the ones worth arguing about.
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

/** [GUESS] Base walking speed, in tiles per second. */
export const WALK_SPEED = 7;
/** [GUESS] Sprinting speed multiplier. */
export const SPRINT_MULTIPLIER = 1.8;
/** [GUESS] Speed multiplier on difficult terrain (underbrush, mud). */
export const DIFFICULT_SPEED_MUL = 0.4;
/**
 * [GUESS] Speed multiplier at zero stamina. Left at 1.0 (no penalty) because
 * the design doc does not call for one; raise to ~0.5 if exhaustion should
 * bite harder than just "cannot sprint".
 */
export const EXHAUSTED_SPEED_MUL = 1.0;

/** [GUESS] Collision radius of the player, in tiles. */
export const PLAYER_RADIUS = 0.3;

// ---------------------------------------------------------------- camera ----

/**
 * [GUESS] How hard the camera is pulled toward the player, per second. Higher
 * follows more tightly; lower glides further behind.
 */
export const CAMERA_STIFFNESS = 12;

// -------------------------------------------------------------- stamina ----
// All rates are percentage points per second.

/** [DOC] Stamina and hydration are percentages, so they top out here. */
export const STAT_MAX = 100;

/** [DOC] Sprinting costs 5%/s. */
export const STAMINA_SPRINT = -5.0;
/** [DOC] Walking over difficult terrain (or up a slope) costs 1%/s. */
export const STAMINA_DIFFICULT = -1.0;
/** [DOC] Walking over easy terrain restores 0.2%/s. */
export const STAMINA_WALK_EASY = 0.2;
/** [DOC] Standing still restores 1%/s while hydration is above 50%... */
export const STAMINA_STAND_HYDRATED = 1.0;
/** [DOC] ...and half that once it is not. Resting is what water is for. */
export const STAMINA_STAND_PARCHED = 0.5;

/**
 * [GUESS] Stamina needed to break into a sprint. The doc says only that
 * sprinting costs 5%/s; this is what stops an empty bar from flickering in and
 * out of a sprint one tick at a time. Above zero so exhaustion lasts long
 * enough to be felt, low enough that it is never a wait.
 */
export const SPRINT_MIN_STAMINA = 5;

// ------------------------------------------------------------- hydration ----

/**
 * [DOC] Passive hydration loss, %/s. A full bar runs dry in 100 seconds, so a
 * summer needs water found and drunk all the way through it.
 */
export const HYDRATION_DRAIN = 1.0;
/**
 * [DOC] Above this, standing still recovers stamina at the fast rate; at or
 * below it, at half that. The doc gives "> 50%" and "< 50%" and says nothing
 * about 50% exactly, so exactly 50 counts as parched.
 */
export const HYDRATION_LOW_THRESHOLD = 50;

// ----------------------------------------------------------------- items ----

/** [DOC] The backpack holds 10 items, counting every resource type together. */
export const BACKPACK_CAPACITY = 10;
/** [DOC] Fruit restores 20% stamina. */
export const FRUIT_STAMINA = 20;
/** [DOC] Water restores 50% hydration. */
export const WATER_HYDRATION = 50;
/** [DOC] Eating starts a 60s "full stomach" cooldown. */
export const FULL_STOMACH_SEC = 60;
/** [DOC] Each ore chunk is worth 1 gold (the doc says feather; you asked for ore). */
export const ORE_GOLD = 1;

// -------------------------------------------------------------------- HUD ----
// Purely cosmetic thresholds: when a readout turns from calm to alarming.

/** [GUESS] Stamina below this colours the bar as a warning. */
export const STAMINA_WARN_THRESHOLD = 25;
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

/** How many of each resource to scatter. */
export const FRUIT_NODES = 45;
export const WATER_NODES = 45;
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

// ------------------------------------------------------------ the build ----

/**
 * Which map the public build plays.
 *
 * One constant, because it is a decision rather than a setting: `d` goes out to
 * itch.io and `e` stays unshipped, kept clean for a session I can watch later.
 * Their layouts are written down nowhere, which is the point -- see
 * public/maps/README.md.
 */
export const SHIPPED_MAP = "d";

// -------------------------------------------------------- playtest trace ----
// The public build is played by someone nobody is watching, so the game has to
// be its own observer. These decide how closely.

/**
 * [GUESS] Seconds of simulated time between trace samples.
 *
 * One a second is 300 samples a summer, which draws a path with every turn in
 * it and still compresses to a couple of kilobytes. Finer would record the
 * stride rather than the route, and the route is the question.
 */
export const TRACE_SAMPLE_SEC = 1;

/**
 * [GUESS] How long the player has to stay on one tile before it counts as a
 * place they stopped.
 *
 * Five seconds is longer than any hold in the game -- a bridge tile is the
 * slowest at two -- so a spot only shows up when they stood there doing
 * nothing, which is what "they got stuck here" looks like from the outside.
 */
export const TRACE_IDLE_SEC = 5;

/** Format version of a pasted playtest record; bumped when its shape changes. */
export const PLAYTEST_LOG_VERSION = 1;

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
