import { type Cell, type Door, type Point, type Room } from './floor.ts';
/** Where a story place is on the house: someone to speak to, a square to stand on, or a door. */
export interface Place {
  readonly room: string;
  readonly who?: string;
  readonly at?: Cell;
  readonly door?: string;
  /** A scene the walker passes: it plays when they walk into the room, from where they stand (`at`). */
  readonly pass?: boolean;
}
/**
 * Someone who goes elsewhere as the story moves on: once the story value `when` is set, or has
 * counted up to `at`, they stand on `cell` of `room`.
 */
export interface Move {
  readonly who: string;
  readonly room: string;
  readonly cell: Cell;
  readonly when: string;
  readonly at?: number;
}
/** A board: the house at one stretch of the story, who is where, and the places the story may offer. */
export interface Board {
  /** Where the walker stands when the board first opens. */
  readonly start: {
    readonly room: string;
    readonly cell: Cell;
  };
  /** Who stands where, room by room, when the board first opens. */
  readonly people: Readonly<Record<string, Readonly<Record<string, Cell>>>>;
  /** Who goes where later, in the story's order: a later move of the same person wins. */
  readonly moves?: readonly Move[];
  /** Each place the story may offer on this board, by the id its choices name. */
  readonly places: Readonly<Record<string, Place>>;
}
/** A story value as the save stands, by name. */
export type Story = (name: string) => unknown;
/** A board as the story stands, everyone moved as far as the story's values say they have gone. */
export declare function boardAt<B extends Board>(board: B, story: Story): B;
/** Where everyone in a room of a board stands. */
export declare const peopleIn: (plan: Board, room: string) => Cell[];
/**
 * What a board offers as the story stands: each place the story's current choices name, with the
 * choices made there, and how the house shows it. A sought place is lit (its person marked as having
 * something new, its door or square glowing, its room lit on the map). A passing place is met, not
 * sought: it plays as the walker walks into its room. Someone with a place on the board that isn't
 * offered just now is marked as already spoken with.
 */
export interface Offers {
  /** The choices at each offered place, by place. */
  readonly at: ReadonlyMap<string, readonly number[]>;
  readonly sought: readonly string[];
  readonly litRooms: ReadonlySet<string>;
  /** The passing place offered in a room. */
  readonly passing: (room: string) => string | undefined;
  /** The offered place in a room that isn't passed, for the map's room. */
  readonly inRoom: (room: string) => string | undefined;
  /** Someone's place in a room, and their mark (`ring`): something new, or done; null for anyone the board gives nothing to say. */
  readonly person: (
    room: string,
    who: string,
  ) => {
    id: string;
    ring: 'new' | 'done';
  } | null;
  /** The place at a door of a room, and whether it is offered. */
  readonly door: (
    room: string,
    door: string,
  ) => {
    id: string;
    lit: boolean;
  } | null;
}
export declare function offers(
  plan: Board,
  choices: readonly {
    readonly room: string;
  }[],
): Offers;
/** A walk across one room, corner to corner, and the door it leaves by. */
export interface Leg {
  readonly path: Point[];
  readonly door?: Door;
}
/** Where the walker is: a room, and a point of its floor. */
export interface Spot {
  readonly room: string;
  readonly at: Point;
}
/** Where the walker stands: a room, and a square of it. */
export interface Where {
  readonly room: string;
  readonly cell: Cell;
}
/** The walks of a house: room by room through its doors, to its places. */
export declare function house(rooms: Readonly<Record<string, Room>>): {
  roomsBetween: (from: string, to: string) => string[] | null;
  placeCell: (plan: Board, place: Place) => Cell | undefined;
  /** The walk to a room's middle, when the map's room is tapped. */
  toRoom: (plan: Board, from: Spot, room: string) => Leg[] | null;
  /** The walk to a place: up beside its person, onto its door or square. */
  journey: (plan: Board, from: Spot, id: string) => Leg[] | null;
  /**
   * Where the walker starts: beside the place last walked to when the last scene was there, else in
   * the room the last scene was painted in, if it is in the same house, else where the board begins.
   */
  startFor: (plan: Board, last: string | null, scene: string) => Where;
};
