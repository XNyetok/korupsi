# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-10 · Last tagged release: `v0.2.0`. What is live is whatever the
latest successful deploy run on `main` shipped: check `gh run list --branch main`, not
this line.

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

- [!] **M1 — Server steps before the v0.3.0 deploy.** Blocked on server access: they need
  root on the VPS, which only the maintainer has. Commands in `docs/deploy.md`.
  1. Install `korupsi-apply-config` and its sudoers rule (Server config). The first
     release deploy then installs the nginx files and the unit itself, including the
     `/api/health` change from H3.
  2. Optional: move the running collector into `releases/legacy` (One-time migration),
     so the first release has something to roll back to.
  Until step 1 is done, a release deploy uploads its files and stops before switching
  anything, because the unit does not run `current` yet. The live site is not touched.
- [ ] **R2 — Cut v0.3.0** through R1. Release PR #16 is open (`chore(main): release
  0.3.0`). Merge it after M1: that tags v0.3.0, publishes the release, and deploys.
  Done when the tag exists and the ready screen shows `v0.3.0`; until then the live build
  says `v0.2.0`. Then remove `release-as: 0.3.0` from `release-please-config.json`, which
  only exists because the commits since v0.2.0 alone would make 0.2.1.
- [~] **H3 — Keep addresses out of telemetry** (split from H1, #6). The redaction in the
  page and the collector is live: #6 was deployed by the old pipeline on 2026-11-10. The
  nginx part (`/api/health` and unlisted `/api/` paths answer 404) is not: on 2026-11-10
  `https://korupsi.web.id/api/health` still answered 200. It lands with the first release
  deploy after M1.
- [ ] **H1 — Harden the server.** Restrict the deploy key to what the deploy needs, review
  SSH settings. Operator work outside the repository. Record only "done" and the date here.

## Next

Nothing queued. The open items are all in *Later*, and each waits on something outside the
code.

## Later

- [!] **B1 — Retune after a hands-on playtest.** #3 made the game slightly harder (see the
  playtest log). Retune `cameraBase` / `cameraAccel` only from real play, and log it.
  Blocked on a person playing: the simulation already says what it can (game-design.md),
  and the open question is how the band feels. Note the seed of each playtest run (S1,
  #9), so a run that felt wrong can be replayed with `?seed=`.
- [!] **V1 — Visual redesign, vertical slice.** Blocked on art: the sprites have to be
  drawn or commissioned, and licensed per `docs/design/assets.md`; the internal resolution
  and palette are the maintainer's call. The code side is ready for it: drawing lives in
  `src/view/` only (#11), so a new renderer does not touch the simulation. One zone
  (Kelurahan) and the player sprite, in the direction set out in the 2026-11-09 audit:
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
- [!] **V3 — Loading screen.** Needed once V1 adds sprite sheets (expected 0.5–1 MB).
  Blocked on V1: there is nothing to load yet. The asset budget part is split out as V4.
- [!] **V2 — Height zones.** Kelurahan → Kecamatan → Dinas → Kementerian → roof, each with
  its own facade and a promotion card. Blocked on V1.
- [!] **C1 — Remove the service worker kill switch** after 2027-02: delete `public/sw.js`,
  its nginx location, the smoke test line in `deploy.yml`, and `tests/sw.test.mjs`. Blocked
  on the date: old installs need the switch until then.

## Done

- [x] **v0.3.0 work (merged, release pending: R2)**
  - Release process (R1, #7, #14): release-please, deploys only from a release behind the
    `production` environment, one version identity (`X.Y.Z+<sha7>`). The XNyetok
    organisation forbids Actions from opening pull requests, so the release PR is opened
    with `release-please release-pr` (`docs/deploy.md`, Releases); tagging and deploying
    still run in Actions. `production` environment created 2026-11-10.
  - Collector deployed before the site, with release folders and joint rollback (D1, #7).
  - Node 22.13 pinned in `engines` and checked on the server by the deploy (D3, #7).
  - nginx and systemd config applied from the release, restored on failure (D2, #8).
  - Seeded runs and `?seed=` replay (S1, #9).
  - Browser smoke tests (S3, #10); a required check of `main` since 2026-11-10.
  - Source split into `core/`, `platform/`, `view/`, `ui/`, behaviour unchanged (S2, #11).
  - Lint and format in CI, Dependabot on npm (H2, #12); Dependabot security updates
    turned on 2026-11-10.
  - Size budget in CI, 18 KB gzipped (V4, #13).
  - A test that failed one run in twenty, because the old level's auditor still
    patrolled, fixed (#15).
  - Earlier in this release:
    - Service worker replaced by a kill switch; manifest and install metadata removed (#2).
    - The deploy validates its settings; the smoke test checks the live build (#2).
    - The server address is out of the docs; `DEPLOY_HOST` is a secret (#2).
    - Gameplay fixes, with 12 new tests (#3): two ledges on every level, the safe path
      never guarded, no reroll by landing on the same ledge, fixed world width, the run
      ends at the drawn audit line, Space follows the last jump, result lock, pause card.
    - Stale docs, comments and the unused `installed` event cleaned up (#5).
    - 2026-11-09, outside PRs: history rewritten to remove the server address; old Actions
      logs deleted; `main` protected; v0.2.0 release notes cleaned; nginx config
      reinstalled from #2.
- [x] **v0.2.0** — telemetry collector and private panel.
- [x] **v0.1.0** — first playable release.

## Dropped

- **PWA / offline play.** It served stale builds and cached the private panel; removed in
  #2. Reasoning in `docs/design/game-design.md`, Decisions.

## Open questions

- Ask GitHub Support to purge cached views of pre-rewrite commits? Optional; the address
  is public through DNS anyway. Owner: the maintainer.
