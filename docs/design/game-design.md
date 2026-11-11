# Korupsi — game design

**Status:** the first floor is playable, released as v0.5.0, and has been played by a
person. The simulation lives in [`../../src/core/game.ts`](../../src/core/game.ts), the
tower in [`../../src/core/tower.ts`](../../src/core/tower.ts). Tests and a scripted climb
prove the floor is possible. The first hands-on session, on a phone, asked for three
things around the game rather than in it: see the playtest log.

## One line

Tim audit sudah di lobi. Panjat kantor demi kantor, bawa amplop sebanyak yang berani kamu
bawa, dan jangan sampai kena OTT.

## Pillars

1. **A tower you can learn.** Every ledge and hazard is placed by hand and is in the same
   place on every run. Nothing is random, so a death is a lesson.
2. **Greed has weight.** Money is the score and it shortens your jump. The theme lives in
   the mechanic, not in the copy.
3. **Fair, not generous.** Hazards show themselves before they bite: the stamp shakes
   before it falls, the auditor only walks his desk, the tape shows where a fall is fatal.
4. **It looks like the place.** Pixel art of an Indonesian government office at dusk, with
   the jokes on the walls rather than in dialogue.

## Core loop

1. The player runs, jumps and dashes up a floor of the building: desks, shelves, filing
   cabinets, air-conditioners.
2. Envelopes sit a little off the safe path. Each is money on the result card and weight
   on the jump, so the climb gets tighter the richer the player is.
3. Auditors walk some desks and stamps come down on others. Touching either is an OTT:
   the player goes back to the last clock-in machine, and the envelopes picked up since
   then go back to where they were.
4. The floor ends at a door. The result card shows the time, the number of OTT and the
   money carried out, and keeps the best time and the most money.

## The floors

The building is the bureaucracy: each office sits on top of the one that answers to it.

| Floor | State | What it teaches |
| --- | --- | --- |
| 01 Kelurahan | playable | jump, the troli, proyek fiktif, the first auditor, the stamp, the dash |
| 02 Kecamatan | planned | |
| 03 Dinas | planned | |
| 04 Kementerian | planned | |
| Atap | planned | the way out |

The Kelurahan has three stretches, each ending at a clock-in machine or the door:

- **The lobby.** Nothing here ends a life. Fixed ledges, then a filing cart on a rail.
- **Fiktif and the first auditor.** Two ledges that give way, then a desk an auditor
  walks. The player only has to touch its near end; the envelope is at the far end.
- **Stamp, gap, auditor, stamp.** A desk under a stamp, a gap that needs a dash, a cart,
  a desk where the auditor is in the way, and a last stamp with an envelope under it.

## Sessions

- **Switching apps pauses the run.** Coming back shows a pause card; nothing moves until
  the player presses Lanjut. The clock is the score now, and a paused clock is honest.
- **Closing the tab loses the run.** A floor is a minute or two; there is nothing to save
  but the records, and those are only written at the door.
- **System gestures are not fought.** The edge-swipe is the operating system's, not ours.

## Player fantasy

The small, clever one, not the kingpin. Someone who knows exactly how much a chair costs
and exactly how much it can be made to cost, and who is very tired. The comedy comes from
bureaucratic absurdity, never from a real person or a real institution.

## Mechanics

| Mechanic | Purpose | Behaviour |
| --- | --- | --- |
| Run and jump | The core verb | Quick to top speed, quick to stop; the jump is higher the longer the button is held |
| One-way ledges | A vertical climb without bumped heads | Landed on from above, passed through from below |
| Ngeles (dash) | A second verb with a joke in it | A short level burst, once per time in the air; it crosses the wide gap and slips through an auditor |
| Weight from money | Risk and reward on the same button | Jump velocity falls 2% per envelope; the route is built to work at 80% |
| Auditor | A moving thing to time | Walks his desk at a constant pace; touching him is an OTT, dashing through him is not |
| Stamp | A fixed thing to time | Rests raised, shakes, slams, holds, rises; only the slam and the hold bite |
| Proyek fiktif | Tension inside the path | Gives way 0.5 s after it is landed on, and is back 2.5 s later |
| Troli | Patience | A cart on a rail; it carries whoever stands on it |
| Mesin absen | Checkpoints | Touching one saves the place and the bag |
| Audit tape | Makes a checkpoint a floor | Falling 80 px below the last checkpoint is an OTT; before the first one a fall only costs time |

Two forgiving details are standard for the genre and are there on purpose: a jump still
counts for a tenth of a second after walking off a ledge, and a jump pressed slightly
early waits for the landing.

## Art direction

- **Resolution.** The tower is 384 pixels wide. With a mouse and keyboard it sits in a
  window that shows its full width and at least 216 rows, scaled by a whole number of
  device pixels whenever that costs less than 15% of the screen, so every game pixel is
  the same size.
- **On a touch screen the game fills the screen.** The view is as wide as the screen
  allows and never wider than the tower: an upright phone shows a slice at least 216
  pixels wide and the camera follows the player sideways; a phone on its side shows the
  full width and at least 160 rows. The scale is still a whole number of device pixels
  unless a long phone on its side would lose too many rows to it. The touch controls sit
  over the bottom of the picture, so the camera starts low enough to show a cellar under
  the lobby, and the ground floor is never behind a button.
- **Drawn in code.** Scenery, sprites and both fonts are rectangles placed a pixel at a
  time (`src/view/`). There are no image files, so there is nothing to license and
  nothing to load.
- **Palette.** A dark, cool office wall, so what can be stood on reads first. Gold is
  what pays, red is what catches, and nothing else in the scene uses either.
- **Layers.** A dusk sky and the roofs next door scroll slower than the wall and show
  through its louvred windows, so the town sinks as the player climbs.
- **The jokes are on the walls.** "Zona Integritas", "Stop Pungli", a service window that
  is always closed, a lunch break from 10 to 14. No state emblem, no agency logo, no real
  face: the official portraits are silhouettes.
- **People.** The player wears a safari suit and a peci; the belly and the bag grow with
  the envelopes, and an OTT puts him in the orange vest. Auditors wear a white shirt, a
  red lanyard and a clipboard.

## Sound

- **Synthesised, like the art.** Every effect and every note is made from oscillators
  and filtered noise (`src/platform/synth.ts`). There are no audio files.
- **The tune** (`src/platform/music.ts`) is a 16-bar loop at 120 beats a minute, in a
  five-note pelog-like scale on E, played on two pulse waves, a triangle bass and noise
  drums. The first eight bars are sparse; the second eight add an interlocking second
  voice. It starts with the run, fades for a pause, ducks when the player is caught, and
  stops at the door.
- **Effects say what happened.** Running has footsteps. A stamp rattles before it falls
  and thuds when it lands, quieter the further away it is. An auditor is a patrol car's
  two notes; a stamp is a buzzer. An envelope is two bright notes.
- **The mix.** Effects peak between -8 and -12 dB of full scale and the tune averages
  about -21 dB, so the tune never covers what the player needs to hear. One compressor on
  the output keeps the worst case, every loud effect on the same beat, below clipping.
- **One switch.** The sound button silences everything and is remembered.

## Scope

**What exists**

- One floor with three checkpoints. The scripted player in the tests finishes it clean in
  about 20 seconds; a first climb, with its OTTs, will take several times that
- Keyboard and touch controls; on a phone the game fills the screen, held either way
- Best time and most money per floor in `localStorage`
- A synthesised tune and effects, anonymous telemetry to the game's own server
- The result shared as a story-sized picture

**Planned** (tracked in [`../plan.md`](../plan.md), not here)

- The remaining floors, each with its own scenery and one new hazard
- A harder mode without checkpoints

**Out of scope until the first floor has been played by people**

- Accounts, leaderboards, multiplayer, daily challenges
- Narration, cutscenes

## Open questions

| Question | Decide when | Owner |
| --- | --- | --- |
| Does the jump feel right in the hand: height, hang time, how fast the run stops? | When the notes from the first session are in | Debi |
| Is 2% per envelope felt at all, or should a full bag bite harder? | After 10 playtests | Debi |
| Is dashing through an auditor too generous once it is learned? | After 10 playtests | Debi |
| Are three checkpoints on the first floor too kind? | After 10 playtests | Debi |
| Should content be Indonesian only, or Indonesian and English? | Before writing final copy | Debi |
| Final title: keep "Korupsi" as the game, or add a subtitle? | Before v1.0.0 | Debi |

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-09 | Repository is public and MIT licensed | Concept benefits from being built in the open |
| 2026-11-09 | Money adds weight and shortens the jump | Makes the theme load-bearing instead of decorative |
| 2026-11-09 | Comedic failure tone | A short run cannot carry a grim tone |
| 2026-11-09 | Offline play removed (v0.3.0) | The service worker kept serving a stale build after deploys and cached the private panel. A kill switch at `/sw.js` cleans up old installs |
| 2026-11-09 | Sound is synthesised, not sampled | Keeps binary assets out of the repository |
| 2026-11-09 | The build has a size budget checked in CI | Growth should be a decision, not a drift |
| 2026-11-09 | The world is a fixed width on every screen | The renderer scales it, so phones and desktops play the same geometry |
| 2026-11-10 | **Rebuilt as a hand-built platformer.** The one-tap endless climb (v0.1.0 to v0.4.0) is retired | The brief was a pixel-art platformer. The one-tap climb was a different game: no direct control of the character, random levels, flat shapes. Its simulation, renderer and balance simulator were replaced; the pipeline, the collector and the platform layer were kept |
| 2026-11-10 | Landscape first, 384 pixels wide | A platformer needs room to the sides. A phone held upright still works, with the controls under the tower |
| 2026-11-10 | Pixel art drawn in code, no image files | The art was the item that blocked the redesign. Drawing it in code removes the licensing question, keeps the download small, and lets the scenery be changed in a pull request |
| 2026-11-10 | The tower is placed by hand and has no randomness | A precision platformer is learned by repetition. Seeds, `?seed=` and the seeded generator went with the endless climb |
| 2026-11-10 | The weight penalty is 2% per envelope with a floor at 80% | In a hand-built level every required jump has to stay possible. The tests climb the route with a full bag |
| 2026-11-10 | Every ledge on the route is one jump up, and the one after is out of reach | About 28 px against a jump of 51 px empty and 40 px full, with the next-but-one at 54 px or more: the route cannot be skipped, and weight never makes it impossible |
| 2026-11-10 | A dash passes through an auditor | Ngeles is the verb. It also gives the dash a use before the gap that requires it |
| 2026-11-10 | Falling below the last checkpoint is an OTT | Otherwise a fall costs more than a death: the climb back takes longer than the respawn. The tape makes the rule visible |
| 2026-11-10 | A pause no longer ends the run after a minute | That rule protected a score that could be farmed by waiting. The score is a clock now, and a paused clock is stopped |
| 2026-11-10 | The size budget is 30 KB (was 18 KB) | The art is code. The build is about 22 KB gzipped |
| 2026-11-10 | A press shorter than a simulation step is kept until it is read | A quick tap on a touch button could begin and end between two steps and never jump |
| 2026-11-11 | On a touch screen the game fills the screen; the box with bars is for a mouse and keyboard only | The maintainer's note from the first session on a phone. A box wasted a third of an upright phone and put the controls on bare background. Filling the screen means an upright phone cannot show the tower's full width at a readable size, so the camera follows sideways there; the slice is never narrower than 216 pixels, which keeps the next ledge in view |
| 2026-11-11 | A cellar is drawn under the lobby | The touch controls cover the bottom of the picture. Without something below the ground floor they would cover the first ledge of the climb |
| 2026-11-11 | A tune, footsteps and louder effects, all still synthesised | The maintainer's note: the sound had no punch. Measured, the old effects peaked around -30 dB of full scale, there was no music, running was silent and a stamp gave no warning to the ear. Synthesis was kept over recorded or generated audio because it costs a few kilobytes instead of a megabyte, needs no license entry, and starts with the page. If the tune does not hold up to listening, a produced track is the fallback, at the price of a loading step |
| 2026-11-11 | The tune is in a pelog-like scale | The game is about an Indonesian office; five notes are enough to say so without quoting any song |
| 2026-11-11 | The sound and pause buttons sit above the cards | They were under the title, pause and result cards, so the sound could not be switched off there. Found by a browser test |
| 2026-11-11 | The result is shared as a picture, 1080 x 1920 | The maintainer's note: a picture goes into a story or a chat, a line of text does not, and every share is the game's advertising. The card is painted by the game itself, so it needs no image file, and what matters sits clear of the top and bottom that story apps cover. A phone gets its share sheet; anything else gets the file, because a desktop share sheet is rarely where a picture is wanted |
| 2026-11-11 | A full-screen button only where the browser has full screen; an iPhone uses the home screen | Safari on an iPhone has no full-screen API. The page declares itself a home-screen app, which is the one way to lose the browser's bars there. No manifest and no service worker: nothing is cached |
| 2026-11-11 | Touches on the game are cancelled, and the page has `touch-action: none` | Safari on iOS ignores `user-scalable=no` and zooms on a double tap, which is exactly what tapping jump twice is. Real buttons and the cards keep their touches, or they would never be clicked or scrolled |

## What the tests check

`npm test` climbs the tower without a browser (`tests/tower.test.ts`):

- every ledge on the route can be reached from the one before it, with an empty bag and
  with all six envelopes;
- the envelope branches can be taken and left with a full bag;
- no ledge on the route can be reached from two ledges below it;
- the gap after the first stamp cannot be crossed without a dash, and can with one at
  full weight;
- a scripted careful player, with every hazard on, reaches the door without an OTT.

That last one is a bot that waits for a safe moment and tries a grid of timings. It says
the floor is possible and that no landing spot is a trap. It says nothing about whether
the floor is fun.

The sound is checked in two ways, and neither is listening. `tests/music.test.ts` reads
the score: every note is in the scale, each voice plays one note at a time, the loop is
sixteen bars. And because the synthesiser runs on any audio context, the tune and every
effect can be rendered with an `OfflineAudioContext` and their levels read off; that is
how the mix in the Sound section was set. It is done by hand when the mix changes, not
in CI. Whether the tune is any good is for ears.

## Playtest log

| Date | Build | What was tried | What came out of it |
| --- | --- | --- | --- |
| 2026-11-09 to 10 | v0.1.0 to v0.4.0 | The one-tap endless climb: hands-on on a phone, simulated runs, and the first six real runs from telemetry | The maintainer found it hard to pick up, and it was not the game that was asked for. Retired on 2026-11-10; the details are in the git history of this file |
| 2026-11-10 | `feat/platformer-kelurahan` | The Kelurahan floor, by tests and by screenshots on a desktop, an upright phone and a phone on its side. No hands-on session yet | The floor is climbable empty and full, cannot be skipped, and a scripted player finishes it clean. The feel of the jump and the difficulty are unjudged |
| 2026-11-10 | v0.5.0 | The Kelurahan floor, hands on, on a phone in Safari: the first session played by a person rather than by a script | Three notes, none about the jump or the hazards: a double tap on a control zoomed the page; the game should fill the phone's screen; the result should be shared as an image. Tracked as P2 in the plan |

## Tuning

Numbers live in [`src/core/params.ts`](../../src/core/params.ts). Distances are game
pixels; the player is 10 wide and 24 tall.

| Parameter | Value | Effect |
| --- | --- | --- |
| Run speed | 96 /s | Crosses the tower in four seconds |
| Jump velocity | 320 /s | About 51 px of rise at zero weight |
| Gravity | 1000 /s² up, 1300 /s² down | A jump lands sooner than it took off |
| Jump cut | 0.5 | Letting go early halves the remaining rise |
| Coyote time, jump buffer | 0.10 s, 0.12 s | Forgive a press that is slightly late or early |
| Dash | 220 /s for 0.14 s | About 31 px, level; one per time in the air |
| Weight penalty | 2% per envelope, floor 0.8 | Six envelopes on the first floor: 0.88 |
| Stamp | 0.45 s warning, 0.55 s down | Rests raised for the remainder of its period |
| Crumble | 0.5 s, back after 2.5 s | Enough to jump from, not enough to wait on |
| Audit tape | 80 px below the checkpoint | Two ledges of forgiveness |
| Envelope value | Rp 500.000 | Score is money and time, so nothing else needs to be scored |
