# Korupsi

A browser game about how systems rot from the inside.

> **Status: prototype.** The build in [`prototype/`](prototype/) can be played today; it is
> a feel test, not a product. The concept is being worked out in the open.

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
prototype/          the playable feel test: one file, no build step
scripts/            developer tooling
.gitleaks.toml      secret scanning rules
```

## Playing it

From the repository root:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080/prototype/>. A phone on the same network can load
`http://<your-ip>:8080/prototype/`; the file also runs from disk.

Tap the left or right half of the screen to jump. Money adds weight and shortens your jump.

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
