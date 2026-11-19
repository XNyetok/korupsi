# Plan

The single list of work for this repository: what is done, what is next, and what is
waiting. There is no other todo file, issue board or spec. Design reasons live in
`docs/design/game-design.md`, server details in `docs/deploy.md`; this file only tracks
work and points at them.

Last updated: 2026-11-19 · Last tagged release: `v0.8.0`. What is live is the latest
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

- [~] **P7 — Give Kecamatan its own feel.** The maintainer approved the lift opening
  (#59) and the service hall art (#60) on 2026-11-19. `feat/kecamatan-service-route`
  makes them the main Kecamatan route and carries them through the archive to Dinas.
  The scripted climb and browser checks pass. Next: a hands-on pass from the main game,
  especially the direction after the first balcony and the crossing by the copier.
- [ ] **T10 — Recheck the Kelurahan after v0.8.0.** Read the 7-day JSON export from
  2026-11-23 for a full window after the tuning (`docs/telemetry.md`). Not a blocker
  for Kecamatan.
- [ ] **P6 — Try Bagikan hasil in Chrome on an Android phone.** Check the share sheet
  and the picture fallback on a real device. Not a blocker for Kecamatan.
- [ ] **T8 — Renew the GeoIP file every month**, next in early December 2026: DB-IP
  publishes a new one monthly (`docs/deploy.md`, The GeoIP file). An old file keeps
  working, only less accurately. Waiting on the maintainer, or on an agent asked to.

## Later

- [ ] **P4 — Floors 03 to 05:** Dinas, Kementerian, the roof and the way out.
- [ ] **P5 — A mode without checkpoints**, once the tower is whole.
- [!] **C1 — Remove the service worker kill switch** after 2027-02: delete `public/sw.js`,
  its nginx location, the smoke test line in `ci.yml`, and `tests/sw.test.mjs`. Blocked
  on the date: old installs need the switch until then.

## Done

- [x] **P3 — Floor 02, Kecamatan.** #57 and #58 added a second floor, browser promotion,
  recognition of existing Kelurahan records, floor selection and separate statistics.
  The first route was present and tested on 2026-11-19; P7 replaces it before release.
- [x] **P2 — Play the Kelurahan and tune it.** The maintainer reported that the tuned
  Kelurahan felt right in hands-on play on 2026-11-19. The #54 changes are live in v0.8.0;
  follow-up telemetry and Android sharing are T10 and P6.
- [x] **v0.8.0** — released and deployed 2026-11-16 (release run 43800860476, deploy run
  43801096426): live as `0.8.0+ff72282`, `/api/health` 404, `/panel/` 401. Players get
  the Kelurahan eased at the three spots where most of them were caught, and a notice at
  the dash gap (P2, #54). Nothing to install on the server.
  - [x] **T9 — A run left on a phone still says how far it got.** Done 2026-11-16 (#55).
    44% of the runs started on v0.7.2 never reported an ending: a run reported only when
    its page was closed, and a phone may close a hidden page without another word. A run
    now reports when its page is first hidden mid-run; if the player comes back, a
    `run_resumed` says only how it then ended, so nothing is counted twice. The panel
    shows how many came back and finished. Collects from v0.8.0.
- [x] **v0.7.2** — 2026-11-14: much richer telemetry, still without any identifier: how a
  run is played, the browser and device, the province and town, where visits come from
  and where they leave, speed and sound (T2–T6, #47 to #51); the GeoIP pieces installed
  on the server (T7).
- [x] **v0.7.1** — 2026-11-14: only errors thrown by the game's own code are reported, and
  the collector drops "Script error." (#45); the panel can be refreshed without hitting
  its rate limit (#44, nginx, installed by hand).
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
