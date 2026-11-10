# Wander

Walk a painted house, room by room.

Wander is the navigation logic behind a story game's house: each room is a painting seen from
above, its floor laid out as a grid of squares in perspective, and its doors lead to other rooms.
Wander works out where a tap lands on the floor, the way across a room around furniture and
people, the walk from room to room through the doors, and what the story currently offers on the
board: whom to speak to, which door or spot is lit, and which scene plays as you walk in.

It is plain TypeScript with no dependencies and no rendering. Your game draws the rooms, the
walker and the people; Wander tells it where everyone is and where to go.

## Install

```sh
npm install github:errantdata/wander#v0.1.0
```

The package builds itself on install (`prepare`), so it ships compiled JavaScript and type
declarations. It needs Node 22.18 or later to develop and test; any modern bundler can consume it.

## Concepts

- **Room**: a painting (`size` in pixels), the four corners of its floor in that painting (far
  left, far right, near left, near right), a grid of `lanes` × `rows` squares, how wide a lane is
  in metres (`laneM`), the squares furniture covers (`blocked`), the scenes painted there, and its
  `doors`. A door sits on a square and a wall `side`, and may lead `to` another room, where the
  walker steps in at `enter`; a door with no `to` belongs to the story, and `shut` says why it
  stays closed.
- **Board**: the house at one stretch of the story: where the walker `start`s, who stands where
  (`people`, room by room), who goes elsewhere once a story value is set (`moves`), and the
  `places` the story may offer. A place is a person to walk up to (`who`), a square (`at`) or a
  door (`door`) in a room; a `pass` place is met rather than sought, and plays when the walker
  enters its room.

## Example

```ts
import { boardAt, floorOf, house, offers, type Board, type Room } from '@errantdata/wander';

const room = (id: string, extra: Partial<Room>): Room => ({
  id,
  name: id,
  size: [400, 400],
  corners: [[0, 0], [400, 0], [0, 400], [400, 400]],
  lanes: 4,
  rows: 4,
  laneM: 1,
  blocked: [],
  scenes: [],
  doors: [],
  ...extra,
});
const rooms = {
  hall: room('hall', {
    blocked: [[1, 1]],
    doors: [{ id: 'study', cell: [3, 0], side: 'e', label: 'Study', to: 'study', enter: [0, 1] }],
  }),
  study: room('study', {
    doors: [{ id: 'hall', cell: [0, 1], side: 'w', label: 'Hall', to: 'hall', enter: [3, 0] }],
  }),
};
const board: Board = {
  start: { room: 'hall', cell: [0, 3] },
  people: { study: { ben: [2, 2] } },
  moves: [{ who: 'ben', room: 'hall', cell: [0, 0], when: 'called' }],
  places: { ben: { room: 'study', who: 'ben' } },
};

// Move everyone as far as the story has gone (here, nothing is set yet).
const now = boardAt(board, () => undefined);
// What the story offers: its current choices name places on the board.
const offer = offers(now, [{ room: 'ben' }]);
offer.person('study', 'ben'); // { id: 'ben', ring: 'new' }: something new to say
// Where a tap on the hall's painting lands, and the walk from there to Ben.
const tapped = floorOf(rooms.hall).pointAt(50, 350); // [0.5, 3.5]
const legs = house(rooms).journey(now, { room: 'hall', at: tapped! }, 'ben');
// [{ path: [...], door: the study door }, { path: [..., [1.5, 2.5]] }]
```

## API

- `floorOf(room)`: the perspective between grid and painting: `at(lane, row)` gives pixels,
  `pointAt(x, y)` and `cellAt(x, y)` go back (null off the floor), and `scaleAt` gives pixels
  per metre, so people can be drawn at their height wherever they stand.
- `open`, `route`, `way`, `beside`, `roomMiddle`: within a room, which squares are free, the
  shortest walk square by square, the same walk pulled straight wherever nothing is in the way,
  where to stand beside someone (to their side before in front), and the open square nearest
  the middle.
- `boardAt(board, story)`: the board with everyone moved as far as the story's values say.
- `offers(board, choices)`: what the board shows for the story's current choices: the places
  sought, the rooms lit (for a map), a room's passing scene, each person's mark (`new` while
  they have something to say, `done` once spoken with) and each door's place.
- `house(rooms)`: walks across rooms: `roomsBetween`, `journey` to a place, `toRoom` (a room's
  middle) and `startFor` (where a board opens after a scene).
- `zoomRange`, `scaleOf`, `clampCamera`, `pinched`: a camera for a phone held upright that opens
  a room nearly whole, pinches between the whole room and close up, and keeps the room on the
  screen.

## Development

```sh
npm install
npm run check   # types
npm test        # node:test, straight from the TypeScript source
npm run build   # dist/
```

## Licence

MIT
