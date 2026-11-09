# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-09 · Last tagged release: `v0.2.0`. What is live is whatever the
latest successful deploy run on `main` shipped: check `gh run list --branch main`, not
this line.

## Rules for whoever updates this file

1. **Read it before starting, update it in the same PR as the work.** A PR that finishes or
   starts an item changes its line here. Work outside a PR (server, GitHub settings) gets
   its line updated in the next commit, with the date.
2. **Done means evidence.** Tick `[x]` only with a PR number, a commit, or a dated note of
   what was checked. No evidence, no tick.
3. **The code wins.** If this file and the repository disagree, the repository is right:
   check (`git log`, the code, `gh pr list`) and correct this file. Never act on a line
   here without confirming it is still true.
4. **Keep items small and stable.** IDs never change or get reused. Split an item by adding
   new IDs; drop one by moving it to *Dropped* with the reason.
5. **No secrets and no weaknesses in detail.** The repository is public. Write "harden SSH",
   not what is currently open, and never a host, user, path to a credential or a password.
6. **Keep it short.** Done items older than one release collapse into one line per release.
7. **Order is urgency.** Within a section, the first open item is the next one to do.

Status: `[ ]` to do · `[~]` in progress (name the branch or PR) · `[x]` done · `[!]` blocked
(say on what)

## Now

- [~] **H3 — Keep addresses out of telemetry** (split from H1, #6). Error messages keep their first line only, and URLs, inline
  URIs, email addresses and host paths are replaced, in the page and again in the
  collector; rows stored earlier are cleaned on start. nginx answers 404 for `/api/health`
  and any other unlisted `/api/` path. Most urgent because the README already promises "no
  addresses". Done when merged and the nginx config is reinstalled on the server.
- [ ] **H1 — Harden the server.** Restrict the deploy key to what the deploy needs, review
  SSH settings. Operator work outside the repository. Record only "done" and the date here.
- [ ] **R1 — Release process.** Adopt release-please (the commits already follow
  Conventional Commits): it opens a release PR that bumps `package.json` and writes
  `CHANGELOG.md`; merging it creates the tag and the GitHub Release.
  - Production deploy runs on a published release, behind a GitHub `production`
    environment. Pushes to `main` build and test only.
  - One version identity: build label `X.Y.Z+<sha7>`, dev builds `X.Y.Z-dev+<sha7>`,
    release folders `vX.Y.Z-<sha7>`.
  - Release notes are player-facing; operational notes go to `docs/deploy.md`.
  - Done when: a release PR exists, and the deploy job is gated on the release event.
  - Done together with D1 and D3: all three rewrite the same deploy job.
- [ ] **D1 — Deploy order and rollback for the collector.** Restart and check the collector
  before switching the site; give it release folders so it rolls back with the site.
- [ ] **D3 — Pin Node.** `engines` in `package.json`, and check the server's Node version in
  the deploy (the collector needs `node:sqlite`, Node 22.13 or newer).
- [ ] **R2 — Cut v0.3.0** through R1. Contents: service worker removed (#2), deploy guard
  (#2), gameplay fixes (#3), telemetry redaction (H3). Done when the tag exists and the
  ready screen shows `v0.3.0`. Until then the live build says `v0.2.0` while running
  v0.3.0 code.
- [ ] **D2 — Server config from the repository.** Apply `deploy/nginx` and `deploy/systemd`
  from CI (with `nginx -t` and automatic restore), instead of by hand.

## Next

- [ ] **S1 — Seeded runs.** Replace `Math.random` in the simulation with a seeded RNG; accept
  `?seed=` and show the seed on the result screen, so a bug report can be replayed exactly.
  Before B1, so playtest runs can be replayed.
- [ ] **S3 — Browser tests.** Playwright smoke run for input, pause and result screens,
  replacing the ad hoc headless checks used in #3. Before S2: the split moves input,
  viewport and UI code that no test covers yet.
- [ ] **S2 — Split the source by layer.** `src/core/` (no DOM: rng, params, types, level,
  physics, rules, game), `src/platform/` (input, loop, viewport, storage, audio, telemetry,
  share), `src/view/` (renderer, camera, sprites, fx), `src/ui/`. Behaviour must not change:
  the existing tests pass untouched apart from import paths.
- [ ] **H2 — Repository settings.** Enable Dependabot security updates; add lint and format
  checks to CI.

## Later

- [ ] **B1 — Retune after a hands-on playtest.** #3 made the game slightly harder (see the
  playtest log). Retune `cameraBase` / `cameraAccel` only from real play, and log it.
- [ ] **V1 — Visual redesign, vertical slice.** One zone (Kelurahan) and the player sprite,
  in the direction set out in the 2026-11-09 audit:
  - Pixel art at a low internal resolution, scaled by whole numbers without smoothing,
    with a three-layer parallax background.
  - The player: an official in a safari suit and peci. The belly and briefcase grow with
    weight.
  - Ledges: safe ones are AC units and window sills; gold ones are envelope stacks; fiktif
    ones are stalled scaffolding.
  - The audit band: sirens and press flashes.
  - The result screen: the player in the orange vest.
  - Every asset recorded in `docs/design/assets.md`. No state emblems, no real agency
    logos, no real faces.
  - Reference for quality, not for copying: poteto.com.
- [ ] **V3 — Loading screen and asset budget.** Needed once V1 adds sprite sheets (expected
  0.5–1 MB). Set the budget with V1, not after it.
- [ ] **V2 — Height zones.** Kelurahan → Kecamatan → Dinas → Kementerian → roof, each with
  its own facade and a promotion card. Depends on V1.
- [ ] **C1 — Remove the service worker kill switch** after 2027-02: delete `public/sw.js`,
  its nginx location, the smoke test line, and `tests/sw.test.mjs`.

## Done

- [x] **v0.3.0 work (untagged, live)**
  - Service worker replaced by a kill switch; manifest and install metadata removed (#2).
  - The deploy validates its settings; the smoke test checks the live build (#2).
  - The server address is out of the docs; `DEPLOY_HOST` is a secret, so logs mask it (#2).
  - Gameplay fixes, with 12 new tests (#3):
    - two ledges on every level; the safe path is never guarded;
    - no reroll by landing back on the same ledge; levels counted per new ledge;
    - fixed world width; the run ends at the drawn audit line;
    - Space follows the last jump; result lock; pause card; keys on buttons stay there;
    - screen shake no longer leaves the canvas offset.
  - 2026-11-09, outside PRs:
    - History rewritten to remove the server address; tags re-pushed, releases intact.
    - Old Actions logs deleted.
    - `main` protected: PR required, checks required, no force push.
    - v0.2.0 release notes no longer name the panel password file; the file was removed
      from the server.
    - nginx config reinstalled from #2.
  - Stale docs, comments and the unused `installed` telemetry event cleaned up (#5).
  - Plan reordered by urgency (2026-11-09): H1 split into H3 (code) and H1 (server); D1
    and D3 move up next to R1; S3 before S2; V3 next to V1.
- [x] **v0.2.0** — telemetry collector and private panel.
- [x] **v0.1.0** — first playable release.

## Dropped

- **PWA / offline play.** It served stale builds and cached the private panel; removed in #2.
  Reasoning in `docs/design/game-design.md`, Decisions.

## Open questions

- Ask GitHub Support to purge cached views of pre-rewrite commits? Optional; the address
  is public through DNS anyway. Owner: the maintainer.
