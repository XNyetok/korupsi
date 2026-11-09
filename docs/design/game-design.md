# Korupsi — game design

**Status:** playable. The loop lives in [`../../src/game.ts`](../../src/game.ts) and runs at
[korupsi.web.id](https://korupsi.web.id). Balance is still expected to move.

## One line

Panjat birokrasi satu lompatan sekaligus, dan putuskan berapa banyak amplop yang sanggup
kamu bawa sebelum tim audit menyusul.

## Pillars

1. **Satu jari, satu detik.** Every action is one tap. No menus, no reading, no pause
   button inside a run.
2. **Greed has weight.** Money raises the score and shortens your jump. The theme lives in
   the mechanic, not in the copy.
3. **Fair, not generous.** Every death can be explained by the player's last decision.
   Nothing is decided by a hidden roll.

## Core loop

1. The player stands on a ledge. Above it, two ledges sit at the same height: one plain,
   one carrying an envelope. One tap on the left or right half of the screen picks a side.
2. The plain ledge is wide and safe. The envelope ledge is narrower, sometimes fake, and
   often patrolled by an auditor. Landing on it pays, and adds weight.
3. Weight lowers the jump, so the climb slows while the audit team keeps climbing from
   below. Money is a loan against your own escape route.
4. A run ends when an auditor is touched or the audit band reaches the player. The result
   screen shows the money carried, the height reached, and one dry sentence about how it
   ended.

## Sessions

The game is played in gaps between other things, so leaving is normal, not an edge case.

- **Switching apps pauses the run.** Coming back within a minute shows a pause card; a tap
  resumes exactly where the run stopped, including mid-jump. Presses in the first 350 ms
  are ignored, so a tap that only wakes the phone does nothing.
- **Staying away longer than a minute ends the run** and banks the score. The audit does not
  pause for anyone; a pause that lasts forever would quietly become a save button.
- **Closing the tab loses the run.** A minute-long game can afford an arcade contract, and it
  keeps the best score honest: only runs that actually ended are recorded.
- **System gestures are not fought.** The edge-swipe is the operating system's, not ours.

## Player fantasy

The small, clever one, not the kingpin. Someone who knows exactly how much a chair costs
and exactly how much it can be made to cost, and who is very tired. The comedy comes from
bureaucratic absurdity, never from a real person or a real institution.

## Mechanics

| Mechanic | Purpose | Behaviour |
| --- | --- | --- |
| Two ledges per level | The only real decision | Same height, one usually gold; tapping picks the side |
| One-tap two-zone jump | Whole control scheme on one thumb | Tap left half to go left, right half to go right |
| Constant horizontal impulse | Deterministic, learnable jumps | Landing spot is fixed for a given rise, so ledges are placed around it |
| Weight from money | Risk and reward on the same button | Jump velocity falls 3% per envelope, floored at 45% |
| Fake ledges | Tension inside the reward | "Proyek fiktif" crumbles 0.45 s after it is touched |
| Auditor on the money | Immediate, visible risk | Patrols only around the gold ledge, never the safe side |
| Audit band | Ends every run | A 40 px band at the bottom of the view, rising and accelerating; feet past its top edge end the run |
| Rebuild after landing | Keeps the path honest | The next pair is generated from where the player actually landed, at the current weight |

## Scope

**What exists**

- One endless climb, one difficulty curve, one high score in `localStorage`
- Portrait-first layout that also works on desktop; shapes and colour drawn in code, no
  image assets in the game itself
- Synthesised sound, sharing, anonymous telemetry to the game's own server
- Runs of roughly 45 to 120 seconds

**Planned** (tracked in [`../plan.md`](../plan.md), not here)

- A pixel-art redesign with height zones

**Out of scope until the loop is proven**

- Deposit checkpoints that shed weight mid-run
- Accounts, leaderboards, multiplayer, daily challenges
- Narration, cutscenes

## Open questions

| Question | Decide when | Owner |
| --- | --- | --- |
| Does the weight penalty feel like a choice or a punishment? | After 10 playtests | Debi |
| Are runs too short for a curious player and too long for an honest one? | After 10 playtests | Debi |
| Should content be Indonesian only, or Indonesian and English? | Before writing final copy | Debi |
| Is there room for a daily seeded run? | After the loop survives a week of play | Debi |
| Final title: keep "Korupsi" as the game, or add a mode name? | Before v1.0.0 | Debi |

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-09 | Repository is public and MIT licensed | Concept benefits from being built in the open |
| 2026-11-09 | One-tap vertical climb, not a horizontal runner | Portrait screens and a single thumb; matches the brief |
| 2026-11-09 | Money adds weight and shortens the jump | Makes the theme load-bearing instead of decorative |
| 2026-11-09 | Comedic failure tone | A 90-second run cannot carry a grim tone |
| 2026-11-09 | No deposit checkpoints in the MVP | One tension per run; add a second lever only after playtests |
| 2026-11-09 | Prototype first, production stack later | The game lives or dies on jump feel, so tune that before scaffolding |
| 2026-11-09 | Two ledges per level instead of money scattered on the path | With a fixed arc the player cannot aim at a spot on a ledge, so the choice has to be which side, not where to land |
| 2026-11-09 | The auditor only guards the money | The safe side has to be reliably safe, or the decision is a lie |
| 2026-11-09 | Plays offline, installs to the home screen | The game is meant for a spare minute, which is often a spare minute without signal |
| 2026-11-09 | Offline play removed again (v0.3.0) | The service worker kept serving a stale build after deploys and cached the private panel. A one-minute game loads fast enough without it; a kill switch at `/sw.js` cleans up old installs |
| 2026-11-09 | Sound is synthesised, not sampled | Keeps binary assets out of the repository and the download under 10 KB gzipped |
| 2026-11-09 | The share text never names the run | The joke is the choice; the next player should walk into it cold |
| 2026-11-09 | A run survives a glance, not a departure | 60 s of absence ends it; anything shorter resumes. Otherwise pausing is saving |
| 2026-11-09 | Every level has two ledges, even against a wall (v0.3.0) | 43% of levels used to show a single ledge, because the ledge on the wall side was dropped. A jump into a wall ends at the wall, so that side's ledge now sits there; the choice never disappears |
| 2026-11-09 | The world is 360 units wide on every screen (v0.3.0) | The renderer scales it. Rotating or resizing no longer strands ledges, and phones and desktops play the same geometry |
| 2026-11-09 | The run ends at the top of the audit band, not the bottom of the screen (v0.3.0) | What is drawn is what kills. The band shrank from 68 to 40 px so the room to recover barely changed |
| 2026-11-09 | Coming back shows a pause card (v0.3.0) | The band no longer starts moving the moment the tab is visible; a tap resumes, and the first 350 ms are ignored |

## What the simulation measures

500 simulated runs per play style with the v0.3.0 numbers and a 0.25 s reaction delay
after each landing (see the playtest log for how it compared with v0.2.0):

| Play style | Median height | Median money | Ends by |
| --- | --- | --- | --- |
| Always takes the envelope | 134 m | Rp 3 jt | Auditor (94%) |
| Takes the envelope half the time | 237 m | Rp 2,5 jt | Auditor (83%) |
| Never takes an envelope | 716 m | 0 | Audit band (100%) |

The honest run is the control: a player who refuses the mechanic survives longer and
scores nothing. That is the joke, and it needs a playtest to confirm it reads as a choice.

## Playtest log

| Date | Build | What was tried | What came out of it |
| --- | --- | --- | --- |
| 2026-11-09 | `20261109135951` | First hands-on run on a phone, at `korupsi.web.id` | The jump arc reads well at first contact. Real bug found: the ledge under the player was dropped from the render list on every landing, so the character stood in the air and the ledge seemed to vanish. Fixed, then verified by tracing every frame: 29 disappearing ledges in 30 jumps before, 0 after. |
| 2026-11-09 | `20261109140812` | Re-test after the fix | The ledge stays visible, the path behind dims with distance instead of vanishing, and the pair above reads as a left/right choice. Weight and the cost of greed are still unjudged. |
| 2026-11-09 | v0.3.0 branch | Simulated 500 runs per play style (always safe, half greedy, always greedy) before and after the bug fixes, with a 0.25 s reaction delay | Single-ledge levels: 43–45% → 0%. Median height 738 → 716 m (safe), 279 → 237 m (half greedy), 161 → 134 m (greedy); median money 2 → 2.5 and 3 jt. Slightly harder, because the band line sits higher and greed has more chances. Worth a hands-on check before retuning |

## Tuning

Numbers live in [`src/config.ts`](../../src/config.ts). Distances are world units: the
world is 360 units wide on every screen, so a unit is a CSS pixel on a 360 px phone.

| Parameter | Value | Effect |
| --- | --- | --- |
| Gravity | 1900 /s² | Snappy fall, no float |
| Jump velocity | 700 /s | About 129 units of rise at zero weight |
| Horizontal impulse | 115 /s | About 70 units of travel per ledge |
| Weight penalty | 3% per envelope | Noticeable after five, fatal after fifteen |
| Minimum jump factor | 0.45 | A heavy player is slow, never stuck |
| Audit band | 26 /s, +1.3 /s² | Catches a resting player quickly, a climbing one in about a minute |
| Audit band height | 40 | Its top edge is the line the feet must not cross |
| Crumble delay | 0.45 s | Enough to react, not enough to relax |
| Gold chance | 45% of levels | Roughly one decision every two jumps |
| Envelope value | Rp 500.000 | Score is money, so nothing else needs to be scored |
