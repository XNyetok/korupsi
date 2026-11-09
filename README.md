# Korupsi

A one-tap browser game about climbing a bureaucracy while the money in your pocket makes
every jump shorter.

**[Play it at korupsi.web.id →](https://korupsi.web.id)**

[![Build & deploy](https://github.com/XNyetok/korupsi/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/XNyetok/korupsi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-E3B04B)](LICENSE)

| Gameplay | Result |
| --- | --- |
| ![A run in progress](docs/media/game.png) | ![The result screen](docs/media/result.png) |

## How it plays

Every level puts two ledges at the same height: a wide safe one and a narrow gold one. One
tap on the left or right half of the screen commits to a side.

The gold ledge pays, and adds weight. Weight shortens the jump, so the climb slows while
the audit band keeps rising from below. An auditor patrols only around the money, so the
safe side is always safe. Dashed ledges are *proyek fiktif*: they crumble after being
touched.

The run ends when the auditor catches you or the band does. The result screen shows the
money you carried, the height you reached, and one dry sentence about how it ended.

| Input | Action |
| --- | --- |
| Tap or click the left half | Jump left |
| Tap or click the right half | Jump right |
| `A` / `←`, `D` / `→` | Same, with a keyboard |
| `Space` | Jump in the direction of the last jump |

Switching apps pauses the run; coming back within a minute resumes it. Staying away longer
ends it and banks the score. Closing the tab loses the run.

## Under the hood

| | |
| --- | --- |
| Build size | about 12 KB gzipped, no runtime dependencies |
| Stack | TypeScript and Canvas 2D, bundled by Vite |
| Audio | WebAudio oscillators, no audio files |
| Offline | service worker, installable to the home screen |
| Hosting | nginx on a VPS, deployed by GitHub Actions |

The simulation has no DOM in it, so a run can be stepped in a test without a browser. That
is how balance changes get compared before they ship.

## Development

```sh
npm install
npm run dev      # dev server with hot reload
npm run check    # types only
npm test         # simulation tests, no browser needed
npm run build    # production build in dist/
```

Add `?debug=1` to the URL for live sliders over jump velocity, gravity, weight penalty,
camera speed and how often the money appears.

## Documentation

- [`docs/design/game-design.md`](docs/design/game-design.md) — rules, the numbers, the
  playtest log, and why each decision was made
- [`docs/deploy.md`](docs/deploy.md) — server layout, releases, rollback, CI pipeline
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — commit style and what will not be merged
- [`SECURITY.md`](SECURITY.md) — how to report a vulnerability, privately

## Notes

- The game's copy is Indonesian, because the thing it is poking at is Indonesian.
- On an iPhone, the silent switch mutes the game: Safari treats Web Audio as ambient
  sound, so the ringer switch wins.
- Sound, offline play and sharing are deliberate choices, recorded in the design notes
  rather than left to be rediscovered.

## License

MIT. See [LICENSE](LICENSE).
