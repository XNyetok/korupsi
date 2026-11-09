# Prototype

`index.html` is the whole game: one file, no dependencies, no build step, no network
requests. It exists to answer one question — does the jump feel good and is the choice
between two ledges legible? Production structure comes after that answer.

## Run it

Desktop, from the repository root:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080/prototype/>.

On a phone, same command, then open `http://<your-laptop-ip>:8080/prototype/` while both
devices are on the same network. The file also works straight from disk (`file://`), which
is handy for AirDropping it to a device.

## Controls

| Input | Action |
| --- | --- |
| Tap / click left half | Jump left |
| Tap / click right half | Jump right |
| `A` / `←` and `D` / `→` | Same, with a keyboard |
| `Space` | Jump in the direction of the last jump |

Jumps only fire from a ledge. There is no air control, by design: the arc is fixed, so the
decision is which side to commit to, not how to steer.

## What to judge

1. Does the arc feel right? Roughly 129 px of rise and 0.74 s in the air at zero weight.
2. Can you read the choice at a glance — plain ledge versus gold ledge?
3. Does the weight penalty feel like a decision or a tax?
4. Did you die to something you could see coming?

If the answer to 1 or 4 is no, nothing else matters and the numbers below need to move.

## Tuning

`prototype/index.html?debug=1` adds a panel with live sliders for jump velocity, gravity,
weight penalty, scroll speed, and how often the gold ledge appears. The readout shows the
current jump envelope and the camera speed.

The same numbers live in the `params` object at the top of the script. Whatever you settle
on by hand goes back into `docs/design/game-design.md`.

## Known gaps

- Balance comes from simulation, not from human playtests. Treat the numbers as a guess.
- No sound, no haptics, no pause button.
- Best score only; no run history.
- Desktop shows the game in a centred 520 px column on purpose, since the game is
  portrait-first.
- The prototype is throwaway. Do not build features on it; port what survives.
