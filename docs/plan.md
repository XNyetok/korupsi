# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-11 · Last tagged release: `v0.6.0`. What is live is the latest
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

- [~] **P2 — Play the Kelurahan and tune it.** Waiting on the maintainer. The first
  session, on v0.5.0 on a phone, gave four notes; all four went out in v0.6.0 (see Done).
  None has been tried on a real phone yet. Next: play v0.6.0 in Safari and in Chrome and
  say what is still off, above all whether the double-tap zoom is gone, whether the share
  sheet takes the picture, and whether the tune is worth keeping. The questions that need
  more than one session are in `docs/design/game-design.md` (Open questions). P3 waits
  for this.

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

- [x] **v0.6.0** — released and deployed 2026-11-11 (release run 42955077519, deploy run
  42955274412): live as `0.6.0+f3db541`, `/api/health` 404, `/panel/` 401; the game
  starts, plays its tune and saves a result picture on the live site. The four notes from
  the maintainer's first session on a phone:
  - A double tap on a control no longer zooms the page in Safari on iOS: touches on the
    game are cancelled, and the page declares `touch-action: none` (#32).
  - On a touch screen the game fills the screen, upright or sideways, with a camera that
    follows sideways when the view is narrower than the tower, the controls over a cellar
    drawn under the lobby, and a full-screen button where the browser has one (#33).
  - "Bagikan hasil" shares a 1080 x 1920 picture of the result: the share sheet on a
    phone, a saved file anywhere else (#34).
  - A 16-bar tune in a pelog-like scale, footsteps, a warning before a stamp falls, and
    effects about 20 dB louder, all still synthesised; the sound button works on the
    cards too (#35).
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
