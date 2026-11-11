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

The collector drops every field it does not know and bounds every number, so nothing
reaches the database that is not in the tables below.

## Events

Every event carries `type` and `rev`, the build label (`0.7.0+abc1234`).

| `type` | Sent when | Extra fields |
| --- | --- | --- |
| `visit` | The page loads | `device`, `layout` |
| `run_started` | Mulai or Main lagi is pressed | `device`, `layout` |
| `run_ended` | A run reaches the door, or is closed or restarted before it | all of the run fields below |
| `shared` | Bagikan hasil is used and something came of it | `via` |
| `error` | A JavaScript error or unhandled rejection | `message`, with addresses removed |

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
- **Small numbers are small.** The sample size is always next to the figure (`n`, `runs`);
  below a few dozen, treat a percentage as a hint.

## Adding a field

1. Add it to what is sent (`src/core/report.ts`, or the call in `src/main.ts`).
2. Accept it in `normaliseEvent`, bounded, and add its column to `ADDED_COLUMNS` in
   `server/store.mjs`: an existing database gains the column when the collector starts.
3. Sum it up in `stats`, and add its note to `ABOUT`.
4. Show it in the panel, and add it to the tables in this file.

The collector is deployed with every release, like the site, so a field is collected from
the release that adds it and never before.
