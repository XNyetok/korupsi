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

## Scope

The project is a browser game. Relevant reports include, but are not limited to:

- secrets or personal data committed to the repository or its history
- client-side trust issues, such as authority over game state held by the browser
- injection or cross-site scripting through user-supplied content
- dependency or build pipeline compromise
- unlicensed assets shipped in the repository

## Not in scope

- findings that require a modified browser or an already-compromised machine
- rate limiting or spam reports against a deployment that is not live
- automated scanner output pasted without a reproduction

## Supported versions

Only the current `main` branch receives fixes. There are no released versions yet.
