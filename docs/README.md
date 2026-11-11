# Docs

Start with `plan.md`: it says what is done and what is next. The other files explain why
the game is the way it is and how it reaches the server. When a decision changes, the note
changes with it; the old reasoning stays in the git history.

| File | Contents |
| --- | --- |
| [plan.md](plan.md) | The only work list: done, next, later. Read it first, update it with every PR |
| [game-design.md](design/game-design.md) | Concept, pillars, core loop, open questions |
| [assets.md](design/assets.md) | What may be committed, and under which license |
| [deploy.md](deploy.md) | Server layout, the deploy pipeline, rollback |
| [telemetry.md](telemetry.md) | What the game reports, every field, and how to read the statistics |

## Writing notes

- Write in short paragraphs and plain language. Bullet points are fine when they are
  actually a list.
- Every open question gets an owner and a "decided when" condition, so it does not drift.
- Record rejected ideas with the reason. Future you will ask why.
- Never paste chat logs wholesale. Summarise the conclusion.
