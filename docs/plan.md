# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-10 · Last tagged release: `v0.3.1`. What is live is the latest
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

Nothing open.

## Next

- [ ] **B2 — Teach the first run.** From the 2026-11-10 playtest: the maintainer's first
  session was spent working out what to do, and the first telemetry runs died to the band
  before they could learn (median 16 s). Make the first seconds teach the game: ready-card
  copy that says what pays and what kills, and a first band approach that reads as a
  warning rather than a surprise.

Nothing else queued. The remaining open items are all in *Later*, and each waits on
something outside the code.

## Later

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
  its nginx location, the smoke test line in `ci.yml`, and `tests/sw.test.mjs`. Blocked
  on the date: old installs need the switch until then.

## Done

- [x] **B1 — Retune the band from real play.** Done 2026-11-10. The maintainer found the
  first session confusing and delegated the judgement to data (their call): the six real
  runs in telemetry died to the band at a median of 16 s against the "about a minute"
  intent, and a reaction-profile sweep with `scripts/simulate.mjs` (#24) showed the old
  values only suited a bot that never hesitates. `cameraBase` 26→12, `cameraAccel`
  1.3→0.6: a hesitating player now lasts ~37 s, a casual one dies to the auditor first,
  and the idle catch stays quick. Re-judge when the next release has gathered more
  telemetry; onboarding continues as B2.
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
- [x] **v0.3.0** — released and deployed 2026-11-10 (#16, release run 42671488521): the
  ready screen shows `v0.3.0`, the build label is `0.3.0+4d46b65`.
  - Server, 2026-11-10 (M1): `korupsi-apply-config` and its sudoers rule installed; the
    collector moved into `releases/legacy` and the unit runs `current`. The first release
    deploy applied the nginx rules, so `/api/health` now answers 404 publicly (H3 done).
    The other sites on the host answered 200 before and after. The apply script and its
    sudoers rule were removed again on 2026-11-10, with D4.
  - Release process (R1, #7, #14): release-please, deploys only from a release behind the
    `production` environment, one version identity (`X.Y.Z+<sha7>`). The XNyetok
    organisation forbids Actions from opening pull requests, so the release PR was opened
    with `release-please release-pr`. Replaced by D4, then D5. `production` environment
    created 2026-11-10.
  - Collector deployed before the site, with release folders and joint rollback (D1, #7).
  - Node 22.13 pinned in `engines` and checked on the server by the deploy (D3, #7).
  - nginx and systemd config applied from the release, restored on failure (D2, #8);
    installed by hand again since D4.
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
