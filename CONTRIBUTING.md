# Contributing

Thanks for taking an interest. This is an early project, so small, focused changes are
much easier to review than large rewrites.

## Before you send a pull request

1. Fork the repository and branch from `main`.
2. Run `./scripts/setup-hooks.sh` once. It installs the hooks that run before every commit.
3. Install `gitleaks` if it is not already on your machine:

   ```sh
   brew install gitleaks
   ```

4. Check that `git status` shows only the files you meant to change.

## What we will not merge

The repository is public and permissive, so a few rules are absolute.

- **No secrets.** API keys, tokens, passwords, connection strings, private keys, `.env`
  files. The pre-commit hook blocks the common cases; do not add an exception for yours.
- **No personal data.** Real names beyond the copyright holder, addresses, phone numbers,
  player data dumps, screenshots containing other people's accounts or messages.
- **No unlicensed assets.** Every image, font, sound and reference must be your own work,
  public domain, or properly licensed with the license recorded in
  `docs/design/assets.md`. "Found it on the internet" is not a license.
- **No generated noise.** Do not commit vendored dependency trees, build output, editor
  caches, or binaries that can be rebuilt.

If a secret reaches a commit anyway, rotate it first, then rewrite history. Deleting the
file in a later commit is not enough: it stays in the public history.

## Where code goes

`src/` is split by layer, and each layer only imports the ones before it:

| Folder | What | May import |
| --- | --- | --- |
| `core/` | the simulation: rules, levels, physics, the seeded RNG. No DOM | `core` |
| `platform/` | browser APIs: input, the frame loop, storage, audio, telemetry, sharing | `core`, `platform` |
| `view/` | drawing the canvas | `core`, `view` |
| `ui/` | the DOM around the canvas: HUD, cards, debug panel, styles | all of the above |

`main.ts` wires them together. `npm run check` compiles `core/` without the DOM library, and
`npm test` fails on an import that breaks the table.

Formatting and lint are Biome's (`biome.json`): `npm run format` fixes the format, and
`npm run lint` is what CI runs. Markdown, HTML and CSS layout are left alone.

## Commits

Use a short conventional prefix, lowercase, imperative summary:

```
feat: add a pause card when the player comes back
fix: make Space follow the last jump on desktop
docs: record why offline play was removed
chore: pin gitleaks to 8.30.1
```

Keep the subject under 72 characters. Use the body for the *why*, not a replay of the
diff. Do not add co-author trailers, generated-by footers, emoji, or marketing tone.

Indonesian or English are both fine in commit bodies and messages. The code, comments and
documentation stay in English so the repository stays readable to outside contributors.

## Pull requests

- One topic per pull request. Split unrelated cleanups.
- Describe the behaviour change and how you checked it.
- Keep the branch up to date with `main` and squash fixup commits before review.
- Update `docs/plan.md` in the same pull request: the item it starts or finishes.
- Merging does not deploy. Players get a change when the maintainer publishes a release
  (`docs/deploy.md`, Releasing).
- Design changes need a note in `docs/design/` explaining the tradeoff, not just code.

## Reporting bugs and ideas

Use the issue templates. For design debates, open a discussion-style issue with the
`design` label rather than a pull request, so the decision is visible before the code.
