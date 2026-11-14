# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-14 · Last tagged release: `v0.7.1`. What is live is the latest
published release that deployed: check `gh run list --workflow deploy.yml`, not this line.

## Rules for whoever updates this file

1. **Read it before starting, update it in the same PR as the work.** A PR that finishes
   or starts an item changes its line here. Work outside a PR (server, GitHub settings)
   gets its line updated in the next commit, with the date.
2. **Done means evidence.** Tick `[x]` only with a PR number, a commit, or a dated note of
   what was checked. No evidence, no tick.
3. **The code wins.** If this file and the repository disagree, the repository is right:
   check (`git log`, the code, `gh pr list`) and correct this file. Never act on a line
   here without confirming it is still true.
4. **Keep items small and stable.** IDs never change or get reused. Split an item by
   adding new IDs; drop one by moving it to *Dropped* with the reason.
5. **No secrets and no weaknesses in detail.** The repository is public. Write "harden
   SSH", not what is currently open, and never a host, user, path to a credential or a
   password.
6. **Keep it short.** Done items older than one release collapse into one line per
   release.
7. **Order is urgency.** Within a section, the first open item is the next one to do.

Status: `[ ]` to do · `[~]` in progress (name the branch or PR) · `[x]` done · `[!]` blocked
(say on what)

## Now

- [~] **P2 — Play the Kelurahan and tune it.** Waiting on the maintainer, and now on the
  numbers too. Three sessions on an iPhone so far, all about how the game sits on a phone
  and how a result is shared, none about the jump or the hazards; what came of them is in
  Done under v0.6.0, v0.6.1 and v0.7.0. Confirmed on the phone: no double-tap zoom, the
  tune and the effects are good, the share sheet lists Instagram (the story is chosen
  inside that app; a web page cannot open it directly). Still untried: sharing in Chrome
  on Android. The panel was read against live data on 2026-11-14; the one error it
  listed was not the game's (fixed in v0.7.1). From v0.7.0 the panel says which hazard
  catches people and where they leave: read it after a few days of play (the JSON export
  is the form to give an agent, `docs/telemetry.md` says how to read it), then tune the
  floor. The open questions are in `docs/design/game-design.md`. P3 waits for this.
- [~] **T2–T6 — More to read in the telemetry.** The maintainer asked on 2026-11-14 for
  much richer telemetry, still without any identifier: the address a beacon comes from
  may be used once to look up a province and a town, never stored. Five parts, one pull
  request each, in this order; each collects from the release that ships it.
  - [x] **T2 — How a run is played.** Done 2026-11-14 (#47), not released yet. A run
    says when it reached each clock-in machine, where it was caught and carrying what,
    what caught it last, which envelopes it took and lost, its jumps and dashes, how
    long it stood on each ledge, its pauses and time away, which run of the visit it
    was, and whether the player had finished before. The statistics carry the floor
    plan; the panel draws the catches on it and shows the route, the envelopes, what
    the weight costs, the moves and the attempts.
  - [x] **T3 — Browser and device.** Done 2026-11-14 (#48), not released yet. The
    collector reduces the User-Agent to a browser and its version, a system, a kind of
    device and a phone model, names the apps that open links inside themselves, and
    drops crawlers and requests with Do Not Track or Global Privacy Control, which the
    page honours too. A visit says the width of the page, whether it was opened from the
    home screen, the player's time zone and whether they had finished before; Chrome
    names the phone's model when asked. The panel shows them, with the hour and the day
    of play on the player's own clock.
  - [x] **T4 — Province and town.** Done 2026-11-14 (#49), not released yet. The
    collector looks the visitor's address up in DB-IP's free GeoIP file and keeps the
    country, the province and the town, never the address; the panel shows them. Needs
    installing on the server before any place is recorded: the nginx line that passes
    the address, the unit's `GEO_DB`, and the file itself (`docs/deploy.md`, The GeoIP
    file).
  - [x] **T5 — Visits and where players come from.** Done 2026-11-14 (#50), not released
    yet. A visit and its runs say which site linked here (the site, never the page) and
    the marks on the link, which then come off the address; a shared text links to
    `?dari=bagikan`. A run says how the one before ended and how long the title or the
    result was up first. Leaving the page says on which screen and after how long, so a
    visit is summed up without tying events together; a share press that came to nothing
    is counted. The JavaScript budget went from 26 to 28 KB for T2 to T6.
  - [ ] **T6 — Speed and sound.** Load time, network type, frame rate, whether the sound
    runs, and where in the game errors happen.

## Next

- [ ] **P3 — Floor 02, Kecamatan.** Its own scenery and one new hazard, built on the
  spacing rules at the top of `src/core/tower.ts`. Needs: more than one floor in a run
  (the door leads to the next floor, the bag is paid upwards and the weight resets), a
  promotion card between floors, and the floor name in the HUD from the floor itself.

## Later

- [ ] **P4 — Floors 03 to 05:** Dinas, Kementerian, the roof and the way out.
- [ ] **P5 — A mode without checkpoints**, once the tower is whole.
- [!] **C1 — Remove the service worker kill switch** after 2027-02: delete `public/sw.js`,
  its nginx location, the smoke test line in `ci.yml`, and `tests/sw.test.mjs`. Blocked
  on the date: old installs need the switch until then.

## Done

- [x] **v0.7.1** — released and deployed 2026-11-14 (release run 43588697563, deploy run
  43588853158): live as `0.7.1+a2fb21d`, `/api/health` 404, `/panel/` 401. Nothing
  changed for players.
  - The game reports only errors thrown by its own code, and the collector drops
    "Script error.", rows already stored included. The five the panel listed came from
    scripts that extensions and in-app browsers add to the page (#45). Checked on the
    live site: an error from a script on another origin is no longer sent, one from the
    game still is.
  - The panel's rate limit allows refreshing it (#44). That is nginx config, which a
    release does not install (`docs/deploy.md`, Changing the server config).
- [x] **v0.7.0** — 2026-11-11: finished runs earn one of ten titles, shared as a surat
  keputusan (#39); a panel that can be read (D6, #40); telemetry on what catches players
  and where they leave (T1, #42); the credit to nyetok.id (D7, #41).
- [x] **v0.6.1** — 2026-11-11: the share sheet gets the picture alone, so apps that only
  take pictures stay in it; a phone that refuses it shows the picture instead (#37).
- [x] **v0.6.0** — 2026-11-11: the four notes from the first session on a phone. No
  double-tap zoom in Safari (#32), the game fills a phone's screen (#33), the result
  shared as a story-sized picture (#34), a tune and louder effects (#35).
- [x] **v0.5.0** — 2026-11-10: the game rebuilt as a pixel-art platformer with its first
  floor, the Kelurahan (P1, #28); the one-tap climb retired.
- [x] **v0.4.0** — 2026-11-10: the audit band retuned from real play and the first run
  taught on the ready card (B1 #25, B2 #26, simulator #24, #22, #23).
- [x] **v0.3.1** — 2026-11-10: releases made by tag, draft and publish, like Havus (D5,
  #20), replacing deploy-on-push (D4, #19).
- [x] **v0.3.0** — 2026-11-10 (#16): seeded runs, browser smoke tests as a required check,
  the `core`/`platform`/`view`/`ui` split, lint and the size budget in CI, telemetry
  redaction; `/api/health` answers 404 publicly (H3).
- [x] **v0.2.0** — telemetry collector and private panel.
- [x] **v0.1.0** — first playable release.

## Dropped

- **V3 — Loading screen.** It was for sprite sheets of 0.5 to 1 MB. The art is drawn in
  code (P1), so there is nothing to load.
- **The one-tap endless climb** (v0.1.0 to v0.4.0), with its seeds, its audit band and
  `scripts/simulate.mjs`. Replaced by P1; the reasoning is in
  `docs/design/game-design.md`, Decisions.
- **H1 — Harden the server.** The maintainer decided (2026-11-10): no changes to SSH or
  the server beyond what Korupsi's own deploy needs.
- **release-please (R1).** The XNyetok organisation forbids Actions from opening pull
  requests, so its release PR had to be opened by hand. D5 tags by hand instead, like
  Havus.
- **Deploy on every push to `main` (D4).** For an open source project, a merged pull
  request should not go live by itself; D5 makes shipping a deliberate step.

- **PWA / offline play.** It served stale builds and cached the private panel; removed in
  #2. Reasoning in `docs/design/game-design.md`, Decisions.

## Open questions

- Ask GitHub Support to purge cached views of pre-rewrite commits? Optional; the address
  is public through DNS anyway. Owner: the maintainer.
