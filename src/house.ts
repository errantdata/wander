import { middle, cellOf, type Cell, type Door, type Point, type Room } from './floor.ts';
import { AROUND, beside, open, roomMiddle, search, way } from './walk.ts';

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
  readonly start: { readonly room: string; readonly cell: Cell };
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
export function boardAt<B extends Board>(board: B, story: Story): B {
  const people: Record<string, Record<string, Cell>> = Object.fromEntries(
    Object.entries(board.people).map(([room, each]) => [room, { ...each }]),
  );
  for (const move of board.moves ?? []) {
    const value = story(move.when);
    if (move.at === undefined ? !value : Number(value) < move.at) continue;
    Object.values(people).forEach((each) => delete each[move.who]);
    people[move.room] = { ...people[move.room], [move.who]: move.cell };
  }
  return { ...board, people };
}
/** Where everyone in a room of a board stands. */
export const peopleIn = (plan: Board, room: string) => Object.values(plan.people[room] ?? {});

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
  readonly person: (room: string, who: string) => { id: string; ring: 'new' | 'done' } | null;
  /** The place at a door of a room, and whether it is offered. */
  readonly door: (room: string, door: string) => { id: string; lit: boolean } | null;
}
export function offers(plan: Board, choices: readonly { readonly room: string }[]): Offers {
  const at = new Map<string, number[]>();
  choices.forEach((choice, index) => {
    if (!plan.places[choice.room]) throw new Error(`The board has no place ${choice.room}.`);
    at.set(choice.room, [...(at.get(choice.room) ?? []), index]);
  });
  const places = Object.entries(plan.places);
  const sought = [...at.keys()].filter((id) => !plan.places[id]!.pass);
  const find = (test: (place: Place) => boolean) => places.find(([, place]) => test(place))?.[0];
  return {
    at,
    sought,
    litRooms: new Set(sought.map((id) => plan.places[id]!.room)),
    passing: (room) =>
      [...at.keys()].find((id) => plan.places[id]!.room === room && plan.places[id]!.pass),
    inRoom: (room) => sought.find((id) => plan.places[id]!.room === room),
    person: (room, who) => {
      const id = find((place) => place.room === room && place.who === who);
      return id ? { id, ring: at.has(id) ? 'new' : 'done' } : null;
    },
    door: (room, door) => {
      const id = find((place) => place.room === room && place.door === door);
      return id ? { id, lit: at.has(id) } : null;
    },
  };
}

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
export function house(rooms: Readonly<Record<string, Room>>) {
  /** The rooms to pass through, door by door, from one room to another. */
  const roomsBetween = (from: string, to: string) =>
    search(from, to, (here) => rooms[here]!.doors.flatMap((door) => door.to ?? []));
  /** The square a place is at: its person's while they are still there, its door's, or its own. */
  const placeCell = (plan: Board, place: Place): Cell | undefined => {
    if (place.who) return plan.people[place.room]?.[place.who];
    if (place.door) return rooms[place.room]!.doors.find((door) => door.id === place.door)!.cell;
    return place.at!;
  };
  /**
   * The walk to a room: room by room through the doors, then across it to the point `end` picks from
   * where the walker comes in; null if the way is barred.
   */
  const walkTo = (
    plan: Board,
    from: Spot,
    room: string,
    end: (here: Room, at: Point, taken: readonly Cell[]) => Point | null,
  ): Leg[] | null => {
    const path = roomsBetween(from.room, room);
    if (!path) return null;
    const legs: Leg[] = [];
    let at = from;
    for (const next of path.slice(1)) {
      const here = rooms[at.room]!;
      const door = here.doors.find((each) => each.to === next)!;
      const across = way(here, at.at, middle(door.cell), peopleIn(plan, here.id));
      if (!across) return null;
      legs.push({ path: across, door });
      at = { room: next, at: middle(door.enter!) };
    }
    const here = rooms[room]!;
    const taken = peopleIn(plan, room);
    const target = end(here, at.at, taken);
    const last = target && way(here, at.at, target, taken);
    return last && [...legs, { path: last }];
  };
  return {
    roomsBetween,
    placeCell,
    /** The walk to a room's middle, when the map's room is tapped. */
    toRoom: (plan: Board, from: Spot, room: string) =>
      walkTo(plan, from, room, (here, _, taken) => middle(roomMiddle(here, taken))),
    /** The walk to a place: up beside its person, onto its door or square. */
    journey: (plan: Board, from: Spot, id: string): Leg[] | null => {
      const target = plan.places[id]!;
      const cell = placeCell(plan, target);
      if (!cell) return null;
      return walkTo(plan, from, target.room, (here, at, taken) => {
        if (!target.who) return middle(cell);
        const path = beside(here, cell, cellOf(at), taken);
        return path && middle(path.at(-1)!);
      });
    },
    /**
     * Where the walker starts: beside the place last walked to when the last scene was there, else in
     * the room the last scene was painted in, if it is in the same house, else where the board begins.
     */
    startFor: (plan: Board, last: string | null, scene: string): Where => {
      const place = last ? plan.places[last] : undefined;
      // Whoever was there may have moved on since.
      const target = place && placeCell(plan, place);
      if (place && target && rooms[place.room]!.scenes.includes(scene)) {
        const room = rooms[place.room]!;
        const taken = peopleIn(plan, place.room);
        const near = AROUND.map(([dl, dr]): Cell => [target[0] + dl, target[1] + dr]).find((cell) =>
          open(room, cell, taken),
        );
        if (near) return { room: place.room, cell: near };
      }
      const room = Object.values(rooms).find((each) => each.scenes.includes(scene));
      if (room && room.id !== plan.start.room && roomsBetween(plan.start.room, room.id)) {
        const taken = peopleIn(plan, room.id);
        const centre: Cell = [Math.floor(room.lanes / 2), room.rows - 2];
        const cell = [centre, ...room.doors.map((door) => door.cell)].find((each) =>
          open(room, each, taken),
        );
        if (cell) return { room: room.id, cell };
      }
      return plan.start;
    },
  };
}
