# Asset policy

Everything in this repository is public and MIT licensed, unless a file states otherwise.
That only works if we are strict about what gets committed.

## Allowed

- work you made yourself, in this project
- public domain material (CC0, expired copyright), credited in the table below
- licensed material whose terms allow redistribution, with the license text or a link
  recorded here
- placeholder shapes, solid colours, and text used to test a mechanic

## Not allowed

- images, fonts, music or sound pulled from a game, film, or a search engine
- material whose license is "unknown" or "probably fine"
- assets generated from a model whose output terms forbid commercial or public use
- screenshots containing other people's names, accounts, or messages
- large binaries. Screenshots and design references belong in an issue, not the tree

## What the game ships today

Nothing third-party. The scenery, the sprites and both pixel fonts are drawn in code
(`src/view/`) and the sound is synthesised (`src/platform/audio.ts`), so both are part of
the source and carry its license. The images in `docs/media/` and `public/og.png` are
screenshots of the game itself.

The art takes its direction, not its pixels, from other pixel-art platformers: no sprite,
tile, palette file or level layout is copied from another game.

## Registry

Every third-party asset gets a row. If it is not in this table, it is not shipped.

| Asset | Path | Source | License | Attribution required |
| --- | --- | --- | --- | --- |
| _none yet_ | | | | |

## Removal

If an asset turns out to be unusable, remove the file and the code that references it in
the same commit, and note it in the design log. Do not leave orphaned files behind.
