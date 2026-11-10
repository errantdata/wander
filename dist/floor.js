export const middle = ([lane, row]) => [lane + 0.5, row + 0.5];
export const cellOf = ([lane, row]) => [Math.floor(lane), Math.floor(row)];
/** Solves a small linear system (Gaussian elimination with partial pivoting). */
function solve(a, b) {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= f * m[col][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}
const floors = new WeakMap();
/** The perspective that lays the room's grid on its painted floor, from the floor's four corners. */
export function floorOf(room) {
  const known = floors.get(room);
  if (known) return known;
  const { lanes, rows, corners } = room;
  const grid = [
    [0, 0],
    [lanes, 0],
    [0, rows],
    [lanes, rows],
  ];
  const a = [];
  const b = [];
  grid.forEach(([x, y], i) => {
    const [u, v] = corners[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(u, v);
  });
  const [h0, h1, h2, h3, h4, h5, h6, h7] = solve(a, b);
  const at = (x, y) => {
    const w = h6 * x + h7 * y + 1;
    return [(h0 * x + h1 * y + h2) / w, (h3 * x + h4 * y + h5) / w];
  };
  // The inverse, for taps on the painting.
  const inverse = solve(
    corners.flatMap(([u, v], i) => {
      const [x, y] = grid[i];
      return [
        [u, v, 1, 0, 0, 0, -x * u, -x * v],
        [0, 0, 0, u, v, 1, -y * u, -y * v],
      ];
    }),
    grid.flatMap(([x, y]) => [x, y]),
  );
  const pointAt = (u, v) => {
    const [g0, g1, g2, g3, g4, g5, g6, g7] = inverse;
    const w = g6 * u + g7 * v + 1;
    const [lane, row] = [(g0 * u + g1 * v + g2) / w, (g3 * u + g4 * v + g5) / w];
    return lane < 0 || row < 0 || lane >= lanes || row >= rows ? null : [lane, row];
  };
  const cellAt = (u, v) => {
    const point = pointAt(u, v);
    return point && cellOf(point);
  };
  const scaleAt = (lane, row) => {
    const [p, q] = [at(lane - 0.5, row), at(lane + 0.5, row)];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) / room.laneM;
  };
  const floor = { at, pointAt, cellAt, scaleAt };
  floors.set(room, floor);
  return floor;
}
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
/**
 * How near a room can be seen: at first its whole width (held upright) or nearly, close enough to
 * see faces, pinched out to the whole room or in to well past the screen's height.
 */
export function zoomRange(room, size) {
  const [across, down] = [size.width / room.size[0], size.height / room.size[1]];
  const [contain, cover] = [Math.min(across, down), Math.max(across, down)];
  const base = Math.max(contain, cover * 0.88);
  return { base, least: contain / base, most: (cover * 1.6) / base };
}
/** Screen pixels per painting pixel at a zoom, within the room's range. */
export const scaleOf = (room, size, zoom) => {
  const { base, least, most } = zoomRange(room, size);
  return size.width ? base * clamp(zoom, least, most) : 0;
};
/** The camera kept on the room: the room fills the screen, or sits in its middle where it is smaller. */
export function clampCamera(camera, world, size) {
  const axis = (value, span, screen) =>
    span <= screen ? (screen - span) / 2 : clamp(value, screen - span, 0);
  return {
    x: axis(camera.x, world.width, size.width),
    y: axis(camera.y, world.height, size.height),
  };
}
/** The camera that keeps the point between two fingers still as the room grows by `ratio`. */
export const pinched = (camera, focal, ratio) => ({
  x: focal.x - (focal.x - camera.x) * ratio,
  y: focal.y - (focal.y - camera.y) * ratio,
});
