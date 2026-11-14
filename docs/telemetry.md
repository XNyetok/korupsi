# Telemetry

What the game reports, what the collector keeps, and how to read it. Written for whoever
has to decide what to build next from the numbers, person or program.

The short version: the game says *what happened*, never *who it happened to*. There is no
cookie, no stored address and no identifier, so two events can never be tied to the same
player, and a run cannot be followed from one visit to the next. The address a beacon
comes from is looked up once, to a country, a province and a town, and then forgotten; the
browser's User-Agent header is reduced to a few words. Neither is stored. Do Not Track and Global Privacy Control
switch it off entirely, in the page and again in the collector. Raw rows are deleted after
90 days.

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
| `visit` | The page loads | `device`, `layout`, `width`, `installed`, `zone`, `finishedBefore`, `model`, `from`, `source`, `campaign`, `ready`, `net`, `saveData`, `lang` |
| `run_started` | Mulai or Main lagi is pressed | `device`, `layout`, `attempt`, `after`, `wait`, `from`, `source`, `campaign` |
| `run_ended` | A run reaches the door, or is closed or restarted before it | all of the run fields below, and `from`, `source`, `campaign` |
| `shared` | Bagikan hasil is used and something came of it | `via` |
| `share_missed` | Bagikan hasil is used and nothing came of it | `via`: `cancelled` (the sheet was closed) or `failed` |
| `hidden` | The page is hidden: closed, or left for another app | `screen`, `visible`, `part` |
| `error` | The game's own code throws, or a promise rejection goes unhandled | `message`, with addresses removed; `screen` |

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
| `fps` | Frames drawn per second of play | 1 to 500 |
| `slow` | Percent of frames slower than 1/30 s: what a player sees as a stutter | 0 to 100 |
| `audio` | The sound a moment into play: `running` (heard), `suspended`, `interrupted` (Safari after a call), `closed`, or `none` (never started) | |
| `full` | Whether any of the run was played in full screen | |
| `turns` | Times the phone was turned on its side or back during the run | |

A hazard is named `kind:ledge`. The kind is `auditor` or `stempel`; the ledge is its index
in the floor's `ledges` array in `src/core/tower.ts`, so `stempel:12` is the stamp over
ledge 12. `jatuh` is a fall below the audit tape.

### Setting fields

| Field | Values | Meaning |
| --- | --- | --- |
| `device` | `touch`, `keys` | A phone or tablet, or a keyboard |
| `layout` | `window`, `fill-tall`, `fill-wide` | Boxed with a mouse; filling a phone held upright; filling a phone on its side |
| `via` | `shared`, `saved`, `show`, `copied` | The phone's share sheet; the picture downloaded; the picture shown for a long press; the text copied |
| `width` | 100 to 9999 | The width of the page in CSS pixels |
| `installed` | `true`, `false` | Opened from an icon on the home screen |
| `zone` | -720 to 840 | Minutes the player's clock is ahead of UTC: 420 is WIB, 480 WITA, 540 WIT |
| `finishedBefore` | `true`, `false` | On a visit as on a run: the floor had been finished on this device |
| `model` | text | The phone's model, which Chrome names only when the page asks (and the page asks, waiting at most 1.5 seconds) |
| `from` | host name, or `''` | The host of the site that linked here (`l.instagram.com`), never its path; `''` when nothing did. The collector keeps only the site (below) |
| `source`, `campaign` | short words | The marks on the link: `utm_source`, `ref` or `dari`, and `utm_campaign`. Read once, then taken off the address bar, so a link copied from it does not carry them on. A result shared as text links to `?dari=bagikan` |
| `after` | `win`, `restart` | How the run before ended, on a run that is not the first of the visit |
| `wait` | 0 to 86400 | Seconds the card before the run was up: the title for the first run, the result after a win |
| `screen` | `title`, `playing`, `paused`, `result` | What was on screen when the page was hidden |
| `visible` | 0 to 86400 | Seconds the page had been shown since it opened or was last come back to |
| `part` | 1 to 999 | Which time the page was hidden since it opened: 1 is the first |
| `ready` | 0 to 120000 | Milliseconds from the moment the page was asked for until its title card was up |
| `net` | `slow-2g`, `2g`, `3g`, `4g` | The network as Chrome guesses it; other browsers do not say |
| `saveData` | `true`, `false` | The player asked the browser to save data |
| `lang` | `id`, `en`, `ms`... | The first part of the browser's language |

### Read from the request

The collector adds these to every event from the request, then forgets the request. The
User-Agent header is reduced by [`server/agent.mjs`](../server/agent.mjs): a whole one can
single out a device, these few words cannot. The address nginx passes on (`X-Real-IP`) is
looked up in an offline GeoIP file by [`server/geo.mjs`](../server/geo.mjs), and only the
three names it gives are kept. A crawler's request is not stored at all, and neither is one
that carries `DNT: 1` or `Sec-GPC: 1`.

| Field | Values |
| --- | --- |
| `browser` | `Chrome`, `Safari`, `Samsung Internet`, `Firefox`, `Edge`, `Opera`... An app that shows the page inside itself is named instead of its engine: `Instagram`, `TikTok`, `Facebook`, `WhatsApp`, `Line`, `Telegram`, `X`, `Snapchat`, `Google app`, or `Android WebView` when it does not say which |
| `browserVersion` | The browser's major version |
| `os` | `Android`, `iOS`, `iPadOS`, `Windows`, `macOS`, `ChromeOS`, `Linux` |
| `form` | `phone`, `tablet`, `desktop` |
| `model` | The phone's model where the header names it (`SM-A135F`); `iPhone` or `iPad` for Apple |
| `referrer` | The site in `from`: a known name (`instagram`, `facebook`, `tiktok`, `x`, `whatsapp`, `google`...), otherwise the domain (`contoh.co.id`); `direct` when nothing linked here |
| `country` | ISO 3166 code: `ID`, `MY`... |
| `region` | The province, as the GeoIP file names it, in English (`West Java`) |
| `city` | The town or regency |

The GeoIP file is [IP to City Lite](https://db-ip.com/db/download/ip-to-city-lite) by DB-IP
(CC BY 4.0, credited in the panel), in the MaxMind DB format. It is not part of a release;
`docs/deploy.md` says where it lives and how it is updated. Without it the collector works
and records no place. A place is an estimate: mobile networks in Indonesia often resolve to
Jakarta or another big city wherever the phone is, so read a town as a hint.

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
| `browsers`, `systems`, `forms`, `models` | What players come in, and whether one of them finishes less: an in-app browser, an old version, a phone |
| `widths`, `visitors` | The screens the game is shown on; how many open it from the home screen or have finished before |
| `hours`, `weekdays`, `zones` | When people play, on their own clock, and from which time zone of Indonesia |
| `countries`, `regions`, `cities`, `geo` | Where visits come from, by country, province and town; whether the GeoIP file was there |
| `sources`, `campaigns` | Which sites and which marked links bring players, and whether those players play and finish |
| `leaving` | On which screen a visit is first left, how long it was looked at by then, and how many come back |
| `cards` | How long the title and the result are looked at before the next run; how many restart from the pause card |
| `shareMisses` | Presses of Bagikan hasil that came to nothing: with `shares`, every press and its outcome |
| `speed` | How fast the title card is up, overall and per network; how many save data |
| `frames` | How smoothly runs are drawn, by kind of device, and whether choppy runs are given up more |
| `sounds`, `display` | Whether the sound is heard; how many play in full screen or turn the phone |
| `languages` | The languages of the browsers that come |

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
- **`leaving` is the first time a visit is left, not always its end.** A player who answers
  a message and comes back counts as leaving then; `returned` says how often that happens.
- **`direct` is everything that did not say where it came from**, including apps that open
  links without a referrer (WhatsApp often does). `browsers` names the app when the page
  was opened inside one.
- **Read `slow`, not `fps`, for smoothness.** A phone with a 120 Hz screen draws 120 frames
  a second as smoothly as a 60 Hz one draws 60; the share of frames slower than 1/30 s is
  what a player feels, whatever the screen.
- **`zones` is where a clock is set, not where a player is.** Nearly every phone sets it
  from the network, so it is a fair hint of WIB, WITA or WIT; a traveller counts where
  their phone says.
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
