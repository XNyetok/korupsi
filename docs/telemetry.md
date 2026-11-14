# Telemetry

What the game reports, what the collector keeps, and how to read it. Written for whoever
has to decide what to build next from the numbers, person or program.

The short version: the game says *what happened*, never *who it happened to*. There is no
cookie, no stored address and no identifier, so two events can never be tied to the same
player, and a run cannot be followed from one visit to the next. Do Not Track switches it
off entirely. Raw rows are deleted after 90 days.

## Where it lives

| Part | File |
| --- | --- |
| What a run says about itself | [`src/core/report.ts`](../src/core/report.ts) |
| Sending it | [`src/platform/telemetry.ts`](../src/platform/telemetry.ts), called from [`src/main.ts`](../src/main.ts) |
| Checking and storing it | [`server/store.mjs`](../server/store.mjs) (`normaliseEvent`) |
| Summing it up | [`server/store.mjs`](../server/store.mjs) (`stats`), served at `/api/stats` |
| Showing it | [`server/panel/`](../server/panel/), served at `/panel/` behind a password |
| The floor the statistics are about | [`server/floor.json`](../server/floor.json), written by [`scripts/floor.mjs`](../scripts/floor.mjs) from `src/core/tower.ts` |

The collector drops every field it does not know and bounds every number, so nothing
reaches the database that is not in the tables below.

## Events

Every event carries `type` and `rev`, the build label (`0.7.0+abc1234`).

| `type` | Sent when | Extra fields |
| --- | --- | --- |
| `visit` | The page loads | `device`, `layout` |
| `run_started` | Mulai or Main lagi is pressed | `device`, `layout`, `attempt` |
| `run_ended` | A run reaches the door, or is closed or restarted before it | all of the run fields below |
| `shared` | Bagikan hasil is used and something came of it | `via` |
| `error` | The game's own code throws, or a promise rejection goes unhandled | `message`, with addresses removed |

An error counts as the game's when the file it was thrown in is in the folder the game's
scripts are served from (`/assets/`). Extensions and in-app browsers add scripts of their
own to the page, and their errors are left out. That includes `Script error.`, all a
browser reports of an error in a script from another origin: no detail, no file, no line,
so nothing to act on. The collector drops `Script error.` as well, also from rows stored
before this rule.

### Run fields

| Field | Meaning | Range |
| --- | --- | --- |
| `cause` | `finished`: reached the door. `abandoned`: the page was closed, or the run restarted, first | |
| `duration` | Seconds on the run's clock | 0 to 3600 |
| `height` | Highest point reached, in metres above the lobby floor. 12 game pixels to the metre; the first floor's door is at about 42 m | |
| `weight` | Envelopes carried at the end | |
| `money` | Rupiah carried at the end: 500000 per envelope | |
| `deaths` | Times caught (OTT) | |
| `checkpoint` | The last checkpoint reached. 0 is the lobby; 1 and 2 are the clock-in machines, in the order of `checkpoints` in [`src/core/tower.ts`](../src/core/tower.ts) | |
| `hazards` | How often each hazard caught the player: `{"stempel:12": 3, "auditor:17": 1, "jatuh": 1}` | at most 24 keys |
| `title` | The id of the title earned ([`src/core/gelar.ts`](../src/core/gelar.ts)); only on a finished run | |
| `muted` | Whether the sound was off when the run ended | |
| `attempt` | Which run of the visit this is: 1 for the first after the page opened, 2 for the next. Counted in the page and forgotten with it | 1 to 999 |
| `splits` | Seconds on the run's clock at which each clock-in machine was first reached, in order; `null` for one never reached or skipped | at most 8 |
| `spots` | Where the player was caught: `[x, y, envelopes carried]`, in game pixels as in `src/core/tower.ts` (y is the height of the feet above the ground floor). All of a run's catches up to 30, an even sample of 30 beyond that | at most 30 |
| `lastHazard` | What caught the player last, named like a key of `hazards`; absent when nothing did | |
| `sinceCaught` | Seconds from that last catch to the end of the run, or from the start when there was none | 0 to 3600 |
| `picked`, `kept` | Envelopes picked up at least once, and those carried at the end, by index in the floor's `amplop` | lists of indices |
| `lost` | Envelopes a catch put back on the floor (the ones taken after the last clock-in) | |
| `carried`, `caughtWith` | Seconds spent free to move, and catches, while carrying 0, 1, 2... envelopes: one number per weight | at most 16 |
| `jumps`, `dashes` | Jumps and dashes (ngeles) made | |
| `dwell` | Whole seconds stood on each ledge, by ledge index, for the ledges stood on for a second or more: `{"0": 9, "11": 4}` | at most 64 keys |
| `pauses` | Times the player paused (the button, Esc or P) | |
| `away` | Times the page was left mid-run (another app, a notification) and come back to. Closing the page is not counted | |
| `finishedBefore` | Whether the floor had been finished on this device before the run began, read from the record the game keeps there for its own result screen | |
| `record` | On a finish that beat the player's own record: `time`, `money` or `both` | |

A hazard is named `kind:ledge`. The kind is `auditor` or `stempel`; the ledge is its index
in the floor's `ledges` array in `src/core/tower.ts`, so `stempel:12` is the stamp over
ledge 12. `jatuh` is a fall below the audit tape.

### Setting fields

| Field | Values | Meaning |
| --- | --- | --- |
| `device` | `touch`, `keys` | A phone or tablet, or a keyboard |
| `layout` | `window`, `fill-tall`, `fill-wide` | Boxed with a mouse; filling a phone held upright; filling a phone on its side |
| `via` | `shared`, `saved`, `show`, `copied` | The phone's share sheet; the picture downloaded; the picture shown for a long press; the text copied |

## Reading the statistics

`GET /api/stats?days=30` answers with one JSON object for the last 30 days; the panel
draws it, and its **Unduh data (JSON)** button saves it as a file. The object explains
itself: its `about` key has a note on every other key, and `format` goes up when the
shape changes. A test fails if a key is added without a note.

| Key | Answers |
| --- | --- |
| `totals`, `daily` | How many came, played, finished and shared, in all and per day |
| `causes` | How runs ended |
| `finished` | How long the floor takes, what is carried out, how often people are caught on the way |
| `abandoned` | How long people last before leaving, how high they got, how often they were caught |
| `sections` | Which stretch of the floor makes people leave, by the last checkpoint reached |
| `quit` | The same by height, in ten-metre bands |
| `hazards` | Which hazards catch people, by total catches and by runs affected |
| `devices`, `layouts` | Who plays on what, and whether a phone makes the floor harder |
| `titles` | Which titles are earned, and so whether their thresholds are right |
| `shares`, `sound` | How results leave the game; how many play with the sound off |
| `errors`, `revs` | What breaks, and which builds the data comes from |
| `floor` | The floor the numbers are about: ledges, hazards, envelopes, machines and the door, in game pixels. Read `spots`, `dwell` and ledge numbers against it |
| `route` | How many runs reach each clock-in machine and the door, and how long each stretch takes |
| `spots` | Where people are caught, in squares of 8 game pixels: the panel draws it on the floor |
| `carrying` | Time and catches at each number of envelopes carried: what the weight costs |
| `lastCatch` | What had caught the players who left, last, and how many left within 15 seconds of it |
| `envelopes` | How often each envelope is picked up, and carried out by those who finish; how many go back after a catch |
| `moves` | Jumps and dashes per run, and how many runs ever dash: whether players find ngeles |
| `dwell` | How long players stand on each ledge: where they hesitate or wait |
| `breaks` | How many runs are paused, and how many are interrupted by another app |
| `attempts` | Runs started, ended and finished by which run of the visit it was: how many tries the floor takes |
| `returning` | Runs and finishes of players who had finished before on that device, and of those who had not |

Things to keep in mind when drawing conclusions:

- **`runs` counts presses, not people.** One visit can start several runs, and a restart
  ends the run before it as `abandoned`.
- **`abandoned` is not failure alone.** It is every run that did not reach the door,
  including one closed after ten seconds of looking around. Read it with `duration`.
- **Medians, not means.** One run left open for an hour would drag a mean; `null` means
  there were no rows.
- **A hazard with many catches in few runs** is one that a few players throw themselves
  at; **many runs** means it catches nearly everyone once. They call for different fixes.
- **Rows from before v0.7.0** have no `deaths`, `checkpoint`, `hazards`, `title`, `muted`,
  `device`, `layout` or `via`. They count in the totals and are absent from those
  breakdowns, so a breakdown can add up to less than its total.
- **The details of play arrive with a release.** `route`, `spots`, `carrying`,
  `lastCatch`, `envelopes`, `moves`, `dwell`, `breaks`, `attempts` and `returning` rest
  only on runs whose build sent them; each says how many (`runs`).
- **`spots` is a sample for runs caught more than 30 times**, so the map understates the
  places such runs keep failing at. `carrying` and `hazards` count every catch.
- **`attempt` is per visit, not per player.** A player who comes back tomorrow starts at
  1 again; `finishedBefore` is what says they have played before, and only once they
  have finished.
- **Small numbers are small.** The sample size is always next to the figure (`n`, `runs`);
  below a few dozen, treat a percentage as a hint.

## Adding a field

1. Add it to what is sent (`src/core/report.ts`, or the call in `src/main.ts`).
2. Accept it in `normaliseEvent`, bounded, and add its column to `ADDED_COLUMNS` in
   `server/store.mjs`: an existing database gains the column when the collector starts.
3. Sum it up in `stats`, and add its note to `ABOUT`. After changing a floor, run
   `node scripts/floor.mjs`: a test fails while `server/floor.json` disagrees with it.
4. Show it in the panel, and add it to the tables in this file.

The collector is deployed with every release, like the site, so a field is collected from
the release that adds it and never before.
