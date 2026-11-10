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
export const middle = ([lane, row]: Cell): Point => [lane + 0.5, row + 0.5];
export const cellOf = ([lane, row]: Point): Cell => [Math.floor(lane), Math.floor(row)];
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

/** Solves a small linear system (Gaussian elimination with partial pivoting). */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = m[row]![col]! / m[col]![col]!;
      for (let k = col; k <= n; k++) m[row]![k]! -= f * m[col]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
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
const floors = new WeakMap<Room, Floor>();
/** The perspective that lays the room's grid on its painted floor, from the floor's four corners. */
export function floorOf(room: Room): Floor {
  const known = floors.get(room);
  if (known) return known;
  const { lanes, rows, corners } = room;
  const grid = [
    [0, 0],
    [lanes, 0],
    [0, rows],
    [lanes, rows],
  ] as const;
  const a: number[][] = [];
  const b: number[] = [];
  grid.forEach(([x, y], i) => {
    const [u, v] = corners[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(u, v);
  });
  const [h0, h1, h2, h3, h4, h5, h6, h7] = solve(a, b) as [number, ...number[]];
  const at = (x: number, y: number) => {
    const w = h6! * x + h7! * y + 1;
    return [(h0 * x + h1! * y + h2!) / w, (h3! * x + h4! * y + h5!) / w] as const;
  };
  // The inverse, for taps on the painting.
  const inverse = solve(
    corners.flatMap(([u, v], i) => {
      const [x, y] = grid[i]!;
      return [
        [u, v, 1, 0, 0, 0, -x * u, -x * v],
        [0, 0, 0, u, v, 1, -y * u, -y * v],
      ];
    }),
    grid.flatMap(([x, y]) => [x, y]),
  ) as [number, ...number[]];
  const pointAt = (u: number, v: number): Point | null => {
    const [g0, g1, g2, g3, g4, g5, g6, g7] = inverse;
    const w = g6! * u + g7! * v + 1;
    const [lane, row] = [(g0 * u + g1! * v + g2!) / w, (g3! * u + g4! * v + g5!) / w];
    return lane < 0 || row < 0 || lane >= lanes || row >= rows ? null : [lane, row];
  };
  const cellAt = (u: number, v: number) => {
    const point = pointAt(u, v);
    return point && cellOf(point);
  };
  const scaleAt = (lane: number, row: number) => {
    const [p, q] = [at(lane - 0.5, row), at(lane + 0.5, row)];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) / room.laneM;
  };
  const floor = { at, pointAt, cellAt, scaleAt };
  floors.set(room, floor);
  return floor;
}

type Size = { readonly width: number; readonly height: number };
type XY = { readonly x: number; readonly y: number };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
/**
 * How near a room can be seen: at first its whole width (held upright) or nearly, close enough to
 * see faces, pinched out to the whole room or in to well past the screen's height.
 */
export function zoomRange(room: Room, size: Size) {
  const [across, down] = [size.width / room.size[0], size.height / room.size[1]];
  const [contain, cover] = [Math.min(across, down), Math.max(across, down)];
  const base = Math.max(contain, cover * 0.88);
  return { base, least: contain / base, most: (cover * 1.6) / base };
}
/** Screen pixels per painting pixel at a zoom, within the room's range. */
export const scaleOf = (room: Room, size: Size, zoom: number) => {
  const { base, least, most } = zoomRange(room, size);
  return size.width ? base * clamp(zoom, least, most) : 0;
};
/** The camera kept on the room: the room fills the screen, or sits in its middle where it is smaller. */
export function clampCamera(camera: XY, world: Size, size: Size): XY {
  const axis = (value: number, span: number, screen: number) =>
    span <= screen ? (screen - span) / 2 : clamp(value, screen - span, 0);
  return {
    x: axis(camera.x, world.width, size.width),
    y: axis(camera.y, world.height, size.height),
  };
}
/** The camera that keeps the point between two fingers still as the room grows by `ratio`. */
export const pinched = (camera: XY, focal: XY, ratio: number): XY => ({
  x: focal.x - (focal.x - camera.x) * ratio,
  y: focal.y - (focal.y - camera.y) * ratio,
});
