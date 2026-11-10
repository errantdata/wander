/**
 * Wander, the engine a player walks a house with, room by room. It knows rooms, doors, floors in
 * perspective, walks and what a board offers, and nothing of any game: no framework, no rendering,
 * no story. A game hands it its rooms and boards.
 *
 * A room is a painting of it from above with its floor laid out as a grid of squares in perspective.
 */
export type Cell = readonly [lane: number, row: number];
/** A point on a room's floor, in squares: (2.5, 1.5) is the middle of square (2, 1). */
export type Point = readonly [lane: number, row: number];
export declare const middle: ([lane, row]: Cell) => Point;
export declare const cellOf: ([lane, row]: Point) => Cell;
export type Side = 'n' | 's' | 'e' | 'w';
export interface Door {
  readonly id: string;
  readonly cell: Cell;
  /** The wall the door is in, from the square inside it. */
  readonly side: Side;
  readonly label: string;
  /** The room it opens on, and the square the walker steps in at; none for a door the story uses. */
  readonly to?: string;
  readonly enter?: Cell;
  /** Why it stays closed, said when the walker tries it. */
  readonly shut?: string;
}
export interface Room {
  readonly id: string;
  readonly name: string;
  /** The painting's size in pixels, and the floor's corners in it: far left, far right, near left, near right. */
  readonly size: readonly [number, number];
  readonly corners: readonly (readonly [number, number])[];
  readonly lanes: number;
  readonly rows: number;
  /** How wide one lane is in metres, so everyone stands at their height for the square they are on. */
  readonly laneM: number;
  readonly blocked: readonly Cell[];
  /** The story's paintings of this room, so a board opens where the last scene was. */
  readonly scenes: readonly string[];
  readonly doors: readonly Door[];
}
export interface Floor {
  /** A point of the grid (lane, row, fractional) in the painting's pixels. */
  readonly at: (lane: number, row: number) => readonly [number, number];
  /** The point of the floor under a point of the painting, or null off the floor. */
  readonly pointAt: (x: number, y: number) => Point | null;
  /** The square under a point of the painting, or null off the floor. */
  readonly cellAt: (x: number, y: number) => Cell | null;
  /** Pixels per metre across the floor at a point of the grid. */
  readonly scaleAt: (lane: number, row: number) => number;
}
/** The perspective that lays the room's grid on its painted floor, from the floor's four corners. */
export declare function floorOf(room: Room): Floor;
type Size = {
  readonly width: number;
  readonly height: number;
};
type XY = {
  readonly x: number;
  readonly y: number;
};
/**
 * How near a room can be seen: at first its whole width (held upright) or nearly, close enough to
 * see faces, pinched out to the whole room or in to well past the screen's height.
 */
export declare function zoomRange(
  room: Room,
  size: Size,
): {
  base: number;
  least: number;
  most: number;
};
/** Screen pixels per painting pixel at a zoom, within the room's range. */
export declare const scaleOf: (room: Room, size: Size, zoom: number) => number;
/** The camera kept on the room: the room fills the screen, or sits in its middle where it is smaller. */
export declare function clampCamera(camera: XY, world: Size, size: Size): XY;
/** The camera that keeps the point between two fingers still as the room grows by `ratio`. */
export declare const pinched: (camera: XY, focal: XY, ratio: number) => XY;
export {};
