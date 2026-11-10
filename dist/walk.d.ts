import { type Cell, type Point, type Room } from './floor.ts';
/** Whether a square can be stood on: on the floor, not furniture, nobody else on it. */
export declare function open(room: Room, cell: Cell, taken?: readonly Cell[]): boolean;
/** The shortest way from one square or room to another, breadth first; null if there is none. */
export declare function search<T>(from: T, to: T, next: (here: T) => readonly T[]): T[] | null;
export declare const AROUND: readonly [
  readonly [-1, 0],
  readonly [1, 0],
  readonly [0, 1],
  readonly [0, -1],
];
/** The shortest walk between two squares, a square at a time, around furniture and people. */
export declare const route: (
  room: Room,
  from: Cell,
  to: Cell,
  taken?: readonly Cell[],
) => Cell[] | null;
/**
 * The way across a room between two points: the shortest walk square by square, pulled straight
 * wherever nothing stands in the way, so a walk on a hidden grid doesn't zigzag. The corners it
 * turns at; null if there is no way.
 */
export declare function way(
  room: Room,
  from: Point,
  to: Point,
  taken?: readonly Cell[],
): Point[] | null;
/** The quickest square beside a target to stand on: to its side before in front, so neither hides the other. */
export declare function beside(
  room: Room,
  target: Cell,
  from: Cell,
  taken: readonly Cell[],
): Cell[] | null;
/** The open square nearest a room's middle, to walk to when the map's room is tapped. */
export declare const roomMiddle: (room: Room, taken: readonly Cell[]) => Cell;
