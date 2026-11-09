# Security Policy

## Reporting a vulnerability

Email **debi@elysiumx.org** with the details. Please do not open a public issue for
anything that could be exploited before it is fixed.

Include:

- what the issue is and where it lives (file, endpoint, or commit)
- how to reproduce it, or a proof of concept
- the impact you think it has

You can expect an acknowledgement within a few days. This is a solo project, so please
allow reasonable time before disclosing publicly.

## Leaked credentials

If you notice a secret published in this repository, email the address above with the
commit hash. Do not quote the secret in full and do not open a public issue: it is a
public repository, and every issue is indexable.

## Data collected by the game

The game posts a small number of anonymous events to its own server: a page visit, a run
starting and ending (outcome, money, height, duration, weight), a shared result,
and the first line of a JavaScript error. Events carry the build revision so a bug report
can be matched to a release.

Not collected: IP addresses, cookies, device fingerprints, or any identifier that survives
a page load. `Do Not Track` disables the events entirely. Raw rows are deleted after 90
days.

If you believe this is not what the running site does, that is a bug worth reporting.

## Scope

The project is a browser game. Relevant reports include, but are not limited to:

- secrets or personal data committed to the repository or its history
- client-side trust issues, such as authority over game state held by the browser
- injection or cross-site scripting through user-supplied content
- dependency or build pipeline compromise
- unlicensed assets shipped in the repository

## Not in scope

- findings that require a modified browser or an already-compromised machine
- automated scanner output pasted without a reproduction

## Supported versions

Only the latest release, deployed from `main`, receives fixes.
