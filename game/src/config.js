// Teluk Senja — open-world crime game. All tuning numbers live here so the systems
// below can share one source of truth. Units are metres, speeds metres per second,
// angles in radians. The city is a road grid; the sea lies to the west (negative x)
// and the sun sets over it.
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

// City layout: roads run north-south and east-west every GRID metres. Roads sit on
// the lines x = -HALF .. HALF and z = -HALF .. HALF in GRID steps.
export const GRID = 40;
export const HALF = 160;
export const ROAD_WIDTH = 10;
export const SIDEWALK = 3;
export const SEA_X = -195;
export const CITY_NAME = 'Teluk Senja';

// Sunset look: warm low sun over the sea, purple-ish sky, dark ground haze.
export const SKY_TOP = 0x2b2350;
export const SKY_HORIZON = 0xff8c42;
export const SUN_COLOR = 0xffb347;
export const SUN_POSITION = [-260, 55, -40];
export const SEA_COLOR = 0x14324a;
export const ASPHALT = 0x23262b;
export const SIDEWALK_COLOR = 0x8a7f70;
export const GROUND_COLOR = 0x3d4a35;
export const BUILDING_COLORS = [0xd9c7a7, 0xc96f4a, 0x4f7d8c, 0xe0a458, 0x8a6f5c, 0x5c7a5a];

// On-foot movement.
export const WALK_SPEED = 6;
export const RUN_SPEED = 10;
export const PLAYER_TURN = 9;
export const PLAYER_HEIGHT = 1.8;

// Driving (arcade, not a vehicle simulation).
export const CAR_ACCEL = 14;
export const CAR_BRAKE = 26;
export const CAR_MAX_SPEED = 34;
export const CAR_REVERSE_MAX = 10;
export const CAR_STEER = 1.9;
export const CAR_DRAG = 0.45;
export const ENTER_DISTANCE = 4.5;

// Traffic and pedestrians.
export const TRAFFIC_COUNT = 12;
export const TRAFFIC_SPEED = 9;
export const TRAFFIC_MIN_GAP = 7;
export const PED_COUNT = 20;
export const PED_SPEED = 1.6;

// Wanted level and police.
export const MAX_WANTED = 5;
export const STEAL_STARS = 1;
export const MAX_POLICE = 4;
export const POLICE_SPEED = 30;
export const POLICE_CATCH_DISTANCE = 3.2;
export const WANTED_DECAY_SECONDS = 20;
export const POLICE_SPAWN_DISTANCE = 70;

// Input.
export const KEY_FORWARD = 'KeyW';
export const KEY_BACK = 'KeyS';
export const KEY_LEFT = 'KeyA';
export const KEY_RIGHT = 'KeyD';
export const KEY_RUN = 'ShiftLeft';
export const KEY_INTERACT = 'KeyE';
export const KEY_BRAKE = 'Space';
export const KEY_PAUSE = 'KeyP';

// Screenshot staging.
export const SHOT_SEED = 7;
