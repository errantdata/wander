import { middle, cellOf } from './floor.js';
import { AROUND, beside, open, roomMiddle, search, way } from './walk.js';
/** A board as the story stands, everyone moved as far as the story's values say they have gone. */
export function boardAt(board, story) {
  const people = Object.fromEntries(
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
export const peopleIn = (plan, room) => Object.values(plan.people[room] ?? {});
export function offers(plan, choices) {
  const at = new Map();
  choices.forEach((choice, index) => {
    if (!plan.places[choice.room]) throw new Error(`The board has no place ${choice.room}.`);
    at.set(choice.room, [...(at.get(choice.room) ?? []), index]);
  });
  const places = Object.entries(plan.places);
  const sought = [...at.keys()].filter((id) => !plan.places[id].pass);
  const find = (test) => places.find(([, place]) => test(place))?.[0];
  return {
    at,
    sought,
    litRooms: new Set(sought.map((id) => plan.places[id].room)),
    passing: (room) =>
      [...at.keys()].find((id) => plan.places[id].room === room && plan.places[id].pass),
    inRoom: (room) => sought.find((id) => plan.places[id].room === room),
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
/** The walks of a house: room by room through its doors, to its places. */
export function house(rooms) {
  /** The rooms to pass through, door by door, from one room to another. */
  const roomsBetween = (from, to) =>
    search(from, to, (here) => rooms[here].doors.flatMap((door) => door.to ?? []));
  /** The square a place is at: its person's while they are still there, its door's, or its own. */
  const placeCell = (plan, place) => {
    if (place.who) return plan.people[place.room]?.[place.who];
    if (place.door) return rooms[place.room].doors.find((door) => door.id === place.door).cell;
    return place.at;
  };
  /**
   * The walk to a room: room by room through the doors, then across it to the point `end` picks from
   * where the walker comes in; null if the way is barred.
   */
  const walkTo = (plan, from, room, end) => {
    const path = roomsBetween(from.room, room);
    if (!path) return null;
    const legs = [];
    let at = from;
    for (const next of path.slice(1)) {
      const here = rooms[at.room];
      const door = here.doors.find((each) => each.to === next);
      const across = way(here, at.at, middle(door.cell), peopleIn(plan, here.id));
      if (!across) return null;
      legs.push({ path: across, door });
      at = { room: next, at: middle(door.enter) };
    }
    const here = rooms[room];
    const taken = peopleIn(plan, room);
    const target = end(here, at.at, taken);
    const last = target && way(here, at.at, target, taken);
    return last && [...legs, { path: last }];
  };
  return {
    roomsBetween,
    placeCell,
    /** The walk to a room's middle, when the map's room is tapped. */
    toRoom: (plan, from, room) =>
      walkTo(plan, from, room, (here, _, taken) => middle(roomMiddle(here, taken))),
    /** The walk to a place: up beside its person, onto its door or square. */
    journey: (plan, from, id) => {
      const target = plan.places[id];
      const cell = placeCell(plan, target);
      if (!cell) return null;
      return walkTo(plan, from, target.room, (here, at, taken) => {
        if (!target.who) return middle(cell);
        const path = beside(here, cell, cellOf(at), taken);
        return path && middle(path.at(-1));
      });
    },
    /**
     * Where the walker starts: beside the place last walked to when the last scene was there, else in
     * the room the last scene was painted in, if it is in the same house, else where the board begins.
     */
    startFor: (plan, last, scene) => {
      const place = last ? plan.places[last] : undefined;
      // Whoever was there may have moved on since.
      const target = place && placeCell(plan, place);
      if (place && target && rooms[place.room].scenes.includes(scene)) {
        const room = rooms[place.room];
        const taken = peopleIn(plan, place.room);
        const near = AROUND.map(([dl, dr]) => [target[0] + dl, target[1] + dr]).find((cell) =>
          open(room, cell, taken),
        );
        if (near) return { room: place.room, cell: near };
      }
      const room = Object.values(rooms).find((each) => each.scenes.includes(scene));
      if (room && room.id !== plan.start.room && roomsBetween(plan.start.room, room.id)) {
        const taken = peopleIn(plan, room.id);
        const centre = [Math.floor(room.lanes / 2), room.rows - 2];
        const cell = [centre, ...room.doors.map((door) => door.cell)].find((each) =>
          open(room, each, taken),
        );
        if (cell) return { room: room.id, cell };
      }
      return plan.start;
    },
  };
}
