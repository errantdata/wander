import { cellOf, middle } from './floor.js';
/** Whether a square can be stood on: on the floor, not furniture, nobody else on it. */
export function open(room, cell, taken = []) {
  const [lane, row] = cell;
  if (lane < 0 || row < 0 || lane >= room.lanes || row >= room.rows) return false;
  return ![...room.blocked, ...taken].some((other) => String(other) === String(cell));
}
/** The shortest way from one square or room to another, breadth first; null if there is none. */
export function search(from, to, next) {
  const came = new Map([[String(from), null]]);
  const queue = [from];
  while (queue.length) {
    const here = queue.shift();
    if (String(here) === String(to)) {
      const path = [];
      for (let at = here; at !== null; at = came.get(String(at)) ?? null) path.unshift(at);
      return path;
    }
    for (const each of next(here))
      if (!came.has(String(each))) {
        came.set(String(each), here);
        queue.push(each);
      }
  }
  return null;
}
// A walk tries farther and nearer before either side; standing beside someone, the sides first.
const STEPS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];
export const AROUND = [
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, -1],
];
/** The shortest walk between two squares, a square at a time, around furniture and people. */
export const route = (room, from, to, taken = []) =>
  search(from, to, (here) =>
    STEPS.map(([dl, dr]) => [here[0] + dl, here[1] + dr]).filter((cell) => open(room, cell, taken)),
  );
/** Whether the walker's body, a little under half a square wide, can go straight between two points. */
function clear(room, from, to, taken) {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const length = Math.hypot(dx, dy);
  const steps = Math.ceil(length / 0.1);
  const [nx, ny] = length ? [-dy / length, dx / length] : [0, 0];
  for (let step = 0; step <= steps; step++)
    for (const side of [-0.22, 0, 0.22]) {
      const t = steps ? step / steps : 0;
      const point = [from[0] + dx * t + nx * side, from[1] + dy * t + ny * side];
      if (!open(room, cellOf(point), taken)) return false;
    }
  return true;
}
/**
 * The way across a room between two points: the shortest walk square by square, pulled straight
 * wherever nothing stands in the way, so a walk on a hidden grid doesn't zigzag. The corners it
 * turns at; null if there is no way.
 */
export function way(room, from, to, taken = []) {
  const squares = route(room, cellOf(from), cellOf(to), taken);
  if (!squares) return null;
  const points = [from, ...squares.slice(1, -1).map(middle), to];
  const turns = [from];
  for (let at = 0; at < points.length - 1;) {
    let next = points.length - 1;
    while (next > at + 1 && !clear(room, points[at], points[next], taken)) next--;
    turns.push(points[next]);
    at = next;
  }
  return turns;
}
/** The quickest square beside a target to stand on: to its side before in front, so neither hides the other. */
export function beside(room, target, from, taken) {
  let best = null;
  let cost = Infinity;
  for (const [dl, dr] of AROUND) {
    const cell = [target[0] + dl, target[1] + dr];
    if (!open(room, cell, taken)) continue;
    const path = route(room, from, cell, taken);
    const length = path ? path.length + (dr === 1 ? 2 : 0) : Infinity;
    if (path && length < cost) [best, cost] = [path, length];
  }
  return best;
}
/** The open square nearest a room's middle, to walk to when the map's room is tapped. */
export const roomMiddle = (room, taken) =>
  Array.from({ length: room.lanes * room.rows }, (_, index) => [
    index % room.lanes,
    Math.floor(index / room.lanes),
  ])
    .filter((cell) => open(room, cell, taken))
    .sort(
      (a, b) =>
        Math.hypot(a[0] + 0.5 - room.lanes / 2, a[1] + 0.5 - room.rows / 2) -
        Math.hypot(b[0] + 0.5 - room.lanes / 2, b[1] + 0.5 - room.rows / 2),
    )[0];
