import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'node:test';
import { clampCamera, pinched, zoomRange, type Room } from './floor.ts';
import { boardAt, house, offers, type Board } from './house.ts';
import { open, way } from './walk.ts';

// A house of two rooms: a hall with a table, and a study off it.
const room = (id: string, lanes: number, rows: number, extra: Partial<Room>): Room => ({
  id,
  name: id,
  size: [lanes * 100, rows * 100],
  corners: [
    [0, 0],
    [lanes * 100, 0],
    [0, rows * 100],
    [lanes * 100, rows * 100],
  ],
  lanes,
  rows,
  laneM: 1,
  blocked: [],
  scenes: [],
  doors: [],
  ...extra,
});
const ROOMS = {
  hall: room('hall', 4, 4, {
    blocked: [[1, 1]],
    scenes: ['hall-scene'],
    doors: [{ id: 'study', cell: [3, 0], side: 'e', label: 'Study', to: 'study', enter: [0, 1] }],
  }),
  study: room('study', 3, 3, {
    scenes: ['study-scene'],
    doors: [{ id: 'hall', cell: [0, 1], side: 'w', label: 'Hall', to: 'hall', enter: [3, 0] }],
  }),
};
const HOUSE = house(ROOMS);
const BOARD: Board = {
  start: { room: 'hall', cell: [0, 3] },
  people: { hall: { ada: [2, 2] }, study: { ben: [2, 2] } },
  moves: [{ who: 'ben', room: 'hall', cell: [0, 0], when: 'ready' }],
  places: {
    ada: { room: 'hall', who: 'ada' },
    ben: { room: 'study', who: 'ben' },
    out: { room: 'hall', door: 'study' },
    overheard: { room: 'study', at: [1, 0], pass: true },
  },
};

it('walks straight across open floor and round furniture and people', () => {
  const hall = ROOMS.hall;
  assert.deepEqual(way(hall, [0.5, 3.5], [3.5, 3.5]), [
    [0.5, 3.5],
    [3.5, 3.5],
  ]);
  const round = way(hall, [1.5, 0.5], [1.5, 2.5], [[2, 2]])!;
  assert.ok(round.length > 2);
  assert.equal(open(hall, [1, 1]), false);
  assert.equal(way(hall, [0.5, 0.5], [1.5, 1.5]), null);
});

it('moves people as the story says, and walks room by room to a place', () => {
  assert.deepEqual(boardAt(BOARD, () => false).people.study, { ben: [2, 2] });
  const ready = boardAt(BOARD, (name) => name === 'ready');
  assert.deepEqual([ready.people.study, ready.people.hall], [{}, { ada: [2, 2], ben: [0, 0] }]);
  assert.deepEqual(HOUSE.roomsBetween('hall', 'study'), ['hall', 'study']);
  // Through the study door, then up beside Ben (to his side, not in front of him).
  const legs = HOUSE.journey(BOARD, { room: 'hall', at: [0.5, 3.5] }, 'ben')!;
  assert.deepEqual(
    legs.map((leg) => leg.door?.id),
    ['study', undefined],
  );
  assert.deepEqual(legs.at(-1)!.path.at(-1), [1.5, 2.5]);
  // Once he has gone to the hall, his place in the study has no one to walk to.
  assert.equal(HOUSE.journey(ready, { room: 'hall', at: [0.5, 3.5] }, 'ben'), null);
  assert.deepEqual(
    HOUSE.toRoom(BOARD, { room: 'hall', at: [0.5, 3.5] }, 'study')!
      .at(-1)!
      .path.at(-1),
    [1.5, 1.5],
  );
});

it('opens a board beside the place last walked to, or in the last scene’s room', () => {
  assert.deepEqual(HOUSE.startFor(BOARD, 'ben', 'study-scene'), { room: 'study', cell: [1, 2] });
  assert.equal(HOUSE.startFor(BOARD, null, 'study-scene').room, 'study');
  assert.deepEqual(HOUSE.startFor(BOARD, null, 'elsewhere'), BOARD.start);
});

it('says what the board offers: lit places, passing scenes and who has been spoken with', () => {
  const offer = offers(BOARD, [{ room: 'ben' }, { room: 'overheard' }, { room: 'ben' }]);
  assert.deepEqual(offer.at.get('ben'), [0, 2]);
  assert.deepEqual(offer.sought, ['ben']);
  assert.deepEqual([...offer.litRooms], ['study']);
  assert.deepEqual([offer.passing('study'), offer.passing('hall')], ['overheard', undefined]);
  assert.deepEqual([offer.inRoom('study'), offer.inRoom('hall')], ['ben', undefined]);
  assert.deepEqual(offer.person('study', 'ben'), { id: 'ben', ring: 'new' });
  assert.deepEqual(offer.person('hall', 'ada'), { id: 'ada', ring: 'done' });
  assert.equal(offer.person('hall', 'cara'), null);
  assert.deepEqual(offer.door('hall', 'study'), { id: 'out', lit: false });
  assert.throws(() => offers(BOARD, [{ room: 'cellar' }]), /The board has no place cellar\./);
});

it('opens a room nearly whole, and pinches out to all of it and in to well past it', () => {
  const phone = { width: 390, height: 760 };
  const tall = room('tall', 8, 12, {});
  const { base, least, most } = zoomRange(tall, phone);
  // Held upright, a tall room starts a little short of the screen's height, a little of its width
  // past the sides.
  assert.ok(tall.size[0] * base >= phone.width);
  assert.ok(tall.size[1] * base <= phone.height);
  assert.ok(least < 1);
  assert.ok(most > 1.5);
});

it('keeps the room on the screen, and still under the fingers as they pinch', () => {
  const screen = { width: 390, height: 640 };
  // A room bigger than the screen can't be dragged off it; a smaller one sits in the middle.
  assert.deepEqual(clampCamera({ x: 50, y: -900 }, { width: 600, height: 900 }, screen), {
    x: 0,
    y: -260,
  });
  assert.deepEqual(clampCamera({ x: -80, y: 0 }, { width: 300, height: 400 }, screen), {
    x: 45,
    y: 120,
  });
  // The point between the fingers stays where it is as the room doubles.
  const focal = { x: 200, y: 300 };
  const camera = pinched({ x: -100, y: -50 }, focal, 2);
  assert.equal((focal.x - camera.x) / 2, focal.x + 100);
  assert.equal((focal.y - camera.y) / 2, focal.y + 50);
});

it('stands alone: the engine imports nothing but its own files', () => {
  const here = import.meta.dirname;
  for (const file of readdirSync(here).filter((name) => /(?<!\.test)\.ts$/.test(name)))
    for (const [, from] of readFileSync(join(here, file), 'utf8').matchAll(/from '([^']+)'/g))
      assert.deepEqual([file, from!.startsWith('./')], [file, true]);
});
