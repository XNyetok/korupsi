# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-11 · Last tagged release: `v0.6.1`. What is live is the latest
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

- [~] **P2 — Play the Kelurahan and tune it.** Waiting on the maintainer. Two sessions on
  an iPhone so far, both about how the game sits on a phone rather than how it plays:
  the notes are in Done under v0.6.0 and v0.6.1. Confirmed on the phone: the double-tap
  zoom is gone, the tune and the effects are good, and in v0.6.1 the share sheet lists
  Instagram (the story is chosen inside that app; a web page cannot open it directly).
  One more note from the third session:
  - [x] The shared picture should be something people want to post: funny, and
    different with the result. Done 2026-11-11 (#39): it is now a surat keputusan that
    appoints the player to one of ten titles, from Raja Amplop to Oknum, decided by the
    time, the OTT count and the envelopes. The portrait, the decree's number and the
    envelopes on the desk change with the result too, and the result screen shows the
    title. Not released yet.

  Still untried: sharing in Chrome on Android. The questions that need more than one
  session are in `docs/design/game-design.md` (Open questions). P3 waits for this.

## Next

- [ ] **P3 — Floor 02, Kecamatan.** Its own scenery and one new hazard, built on the
  spacing rules at the top of `src/core/tower.ts`. Needs: more than one floor in a run
  (the door leads to the next floor, the bag is paid upwards and the weight resets), a
  promotion card between floors, and the floor name in the HUD from the floor itself.
- [ ] **T1 — Count OTT in telemetry.** `run_ended` carries money, weight, height and
  duration, but not how often the player was caught or where, which is what says whether
  a hazard is unfair. Needs a column in the collector and a row in the panel.

## Later

- [ ] **P4 — Floors 03 to 05:** Dinas, Kementerian, the roof and the way out.
- [ ] **P5 — A mode without checkpoints**, once the tower is whole.
- [!] **C1 — Remove the service worker kill switch** after 2027-02: delete `public/sw.js`,
  its nginx location, the smoke test line in `ci.yml`, and `tests/sw.test.mjs`. Blocked
  on the date: old installs need the switch until then.

## Done

- [x] **D7 — Credit nyetok.id.** Done 2026-11-11 (#41), not released yet. "Dibuat oleh
  nyetok.id", as a link that opens beside the game: next to the version on the title
  card, under the result, in the panel's footer (#40), in the page's author metadata and
  in the README. Not on the shared picture, which stays the player's own.
- [x] **D6 — A panel that can be read.** Done 2026-11-11 (#40), not released yet. The
  maintainer asked for a cleaner panel whose numbers explain themselves. It now leads
  with four figures (visits, runs started, finished, shared) and what share each is of
  the one before, shows the days as one chart with a table behind it, and measures the
  runs that reached the door apart from the runs that were left: the old panel averaged
  them together, and counted a run that was walked away from as "finished". New from the
  collector: finished runs per day, medians per outcome, and how high abandoned runs got,
  in ten-metre bands. Light and dark, and readable on a phone. Checked against a seeded
  database on a local collector, not against the live data.
- [x] **v0.6.1** — released and deployed 2026-11-11 (release run 42957553708, deploy run
  42957741901): live as `0.6.1+8a97b15`, `/api/health` 404, `/panel/` 401; on the live
  site a phone with a stand-in share sheet is handed the picture and nothing else, and
  one that refuses it is shown the picture. The note from the maintainer's second
  session, in Safari on an iPhone: sharing offered a save but no way to a story. The
  share sheet now gets the picture alone, asked for straight from the press, and a phone
  whose sheet will not take it shows it for a long press instead of downloading it (#37).
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
