# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-10 · Last tagged release: `v0.4.0`. What is live is the latest
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

- [ ] **P2 — Play the Kelurahan and tune it.** The maintainer's call, hands on a keyboard
  and on a phone: the feel of the jump and the dash, whether the stamp and the auditors
  are fair, whether three checkpoints are too kind. The questions are listed in
  `docs/design/game-design.md` (Open questions); the numbers are in `src/core/params.ts`
  and can be moved live with `?debug=1`. Nothing below starts before this, and no release
  is cut before it: v0.4.0, the one-tap climb, stays live until the maintainer asks.

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

- [x] **P1 — Rebuild as a pixel-art platformer, first floor.** Done 2026-11-10 (#28). The
  brief was a pixel-art platformer; the one-tap endless climb was a different game. Replaced: the simulation, the level
  generator, the renderer, the balance simulator and the browser tests. Kept: the
  pipeline, the collector and panel, audio, storage, sharing, telemetry. New: a
  hand-built Kelurahan floor (21 ledges, two auditors, two stamps, three checkpoints, six
  envelopes), run, jump and dash with keyboard and touch, pixel art drawn in code at 384
  pixels wide, and tests that climb the route empty and full and finish the floor with
  the hazards on. The size budget went from 18 KB to 30 KB (the build is about 22 KB).
  This is V1 from the old list, done without waiting for drawn sprites; V2 became P3 and
  P4. Not released: see P2.
- [x] **v0.4.0** — released and deployed 2026-11-10 (release run 42768702423, deploy run
  42769050232): live as `0.4.0+7f64ff6`, `/api/health` 404, `/panel/` 401, the other sites
  on the host answered 200 after.
  - The band retuned from real-play data: `cameraBase` 26→12, `cameraAccel` 1.3→0.6
    (B1, #25), decided from the first telemetry and a reaction-profile sweep with the
    committed `scripts/simulate.mjs` (#24).
  - The ready card teaches what pays and what kills, and the band warns once by toast
    when it closes in, with `band_warned` telemetry (B2, #26).
  - Ready screen cleanup: the build label is gone and the seed shows only with
    `?debug=1` (#22, #23).
- [x] **B2 — Teach the first run.** Done 2026-11-10. The ready card now says what pays
  and what kills (gold pays and is guarded, weight shortens the jump, the band chases
  from below), and the band gives one toast warning per run when it closes in — with a
  `band_warned` telemetry event, so the next batch of data shows whether players still
  die right after being warned.
- [x] **B1 — Retune the band from real play.** Done 2026-11-10. The maintainer found the
  first session confusing and delegated the judgement to data (their call): the six real
  runs in telemetry died to the band at a median of 16 s against the "about a minute"
  intent, and a reaction-profile sweep with `scripts/simulate.mjs` (#24) showed the old
  values only suited a bot that never hesitates. `cameraBase` 26→12, `cameraAccel`
  1.3→0.6: a hesitating player now lasts ~37 s, a casual one dies to the auditor first,
  and the idle catch stays quick. Re-judge when the next release has gathered more
  telemetry.
- [x] **D5 — Release like Havus** (#20; first release v0.3.1, published and deployed
  2026-11-10, live as `0.3.1+2340aef`; the other sites on the host answered 200 after). Merging to `main` runs
  the checks only. A pushed `vX.Y.Z` tag runs them again and makes a draft GitHub Release
  with the built site and collector; publishing it deploys exactly those files. The
  version comes from the tag (`package.json` stays `0.0.0`), and GitHub Releases replace
  `CHANGELOG.md`. The server side is unchanged.
- [x] **D4 — Deploy like Nyetok** (2026-11-10, #19). Replaced by D5 the same day. A green push
  to `main` deploys, as in the Nyetok repository; release-please, the tag-driven deploy and
  the root apply script are gone, and server config is installed by hand again
  (`docs/deploy.md`). Kept from v0.3.0: collector first with a health check, joint
  rollback, Node check, smoke test with automatic rollback. Release folders are named
  `<UTC time>-<sha7>` like Nyetok's.
- [x] **v0.3.0** — released and deployed 2026-11-10 (#16): seeded runs with `?seed=`,
  browser smoke tests as a required check, the `core`/`platform`/`view`/`ui` split, lint
  plus the 18 KB size budget in CI, telemetry redaction, and the release-please pipeline
  that D4 then D5 replaced. The first release deploy applied the nginx rules, so
  `/api/health` answers 404 publicly (H3); the server's apply script went away with D4.
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
