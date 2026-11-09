# Korupsi

A browser game about how systems rot from the inside.

> **Status: design phase.** There is no playable build yet. The repository currently holds
> the project scaffolding and the design notes for a concept that is still being shaped.

## Why this exists

Most games that touch corruption treat it as a crime story: one villain, one bribe, one
arrest. Korupsi is interested in the quieter version, where the system keeps working
while it quietly stops working.

The mechanics, scope and art direction are being worked out in the open. Notes live in
[`docs/design/`](docs/design/), and the reasoning behind decisions gets written down
rather than lost in chat scrollback.

## Repository layout

```
.githooks/          local git hooks (secret scan, large file guard)
.github/            workflows, issue and pull request templates
docs/design/        design notes and open questions
scripts/            developer tooling
.gitleaks.toml      secret scanning rules
```

## Working on it

```sh
git clone https://github.com/XNyetok/korupsi.git
cd korupsi
./scripts/setup-hooks.sh
```

The setup script enables the repository hooks. `gitleaks` is required; install it with
`brew install gitleaks`.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Found a vulnerability or a leaked credential? Please do not open a public issue.
See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
