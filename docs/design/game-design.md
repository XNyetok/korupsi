# Korupsi — game design

**Status:** prototype. The loop lives in [`../prototype/index.html`](../../prototype/index.html)
and is being tuned for feel before any production structure is written.

## One line

Panjat birokrasi satu lompatan sekaligus, dan putuskan berapa banyak amplop yang sanggup
kamu bawa sebelum tim audit menyusul.

## Pillars

1. **Satu jari, satu detik.** Every action is one tap. No menus, no reading, no pause
   inside a run.
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
| Audit band | Ends every run | Screen bottom scrolls up and accelerates |
| Rebuild after landing | Keeps the path honest | The next pair is generated from where the player actually landed, at the current weight |

## Scope

**In scope for the first playable**

- One endless climb, one difficulty curve, one high score in `localStorage`
- Portrait-first layout that also works on desktop, no assets, no network requests
- Runs of 45 to 120 seconds

**Out of scope until the loop is proven**

- Deposit checkpoints that shed weight mid-run (planned for the version after MVP)
- Accounts, leaderboards, multiplayer, daily challenges
- Narration, cutscenes, art beyond shapes and colour
- Sound design

## Open questions

| Question | Decide when | Owner |
| --- | --- | --- |
| Does the weight penalty feel like a choice or a punishment? | After 10 playtests | Debi |
| Are runs too short for a curious player and too long for an honest one? | After 10 playtests | Debi |
| Should content be Indonesian only, or Indonesian and English? | Before writing final copy | Debi |
| Is there room for a daily seeded run? | After the loop survives a week of play | Debi |
| Final title: keep "Korupsi" as the game, or add a mode name? | Before the first public release | Debi |

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

## What the prototype measures

Simulated runs, 40 per policy, with the current numbers:

| Policy | Average run | Money | Ends by |
| --- | --- | --- | --- |
| Takes every envelope, never waits | ~8 s | ~2 M | Auditor |
| Takes envelopes, waits for a gap | ~61 s | ~5 M | Audit band |
| Never takes an envelope | ~82 s | 0 | Audit band |

The honest run is the control: a player who refuses the mechanic survives longer and
scores nothing. That is the joke, and it needs a playtest to confirm it reads as a choice.

## Tuning

Numbers live in the prototype so they stay in one place:

| Parameter | Value | Effect |
| --- | --- | --- |
| Gravity | 1900 px/s² | Snappy fall, no float |
| Jump velocity | 700 px/s | About 129 px of rise at zero weight |
| Horizontal impulse | 115 px/s | About 65 px of travel per ledge |
| Weight penalty | 3% per envelope | Noticeable after five, fatal after fifteen |
| Minimum jump factor | 0.45 | A heavy player is slow, never stuck |
| Audit band | 26 px/s, +1.3 px/s² | Catches a resting player quickly, a climbing one in about a minute |
| Crumble delay | 0.45 s | Enough to react, not enough to relax |
| Gold chance | 45% of levels | Roughly one decision every two jumps |
| Envelope value | Rp 500.000 | Score is money, so nothing else needs to be scored |
