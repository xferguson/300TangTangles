# 300 Tang Tangles — working rules

Read [`docs/PLAN.md`](docs/PLAN.md) for the product design and architecture. Read [`docs/TASKS.md`](docs/TASKS.md) to find and claim work. These rules apply to every session and contributor.

## Workflow
1. **Pick a task** from `docs/TASKS.md` whose `Depends on` tasks are all `Status: done` and whose own status is `todo`.
2. **Branch:** `task/Txx-short-name` from the latest `main`. One task = one branch = one PR. **Never commit directly to `main`.**
3. **Claim it:** in your first commit, set the task's `Status: in-progress` and fill in `Branch:`. Open the PR (draft) early and fill in `PR:`.
4. **Red/green TDD for all implementation:**
   - Commit the failing test first: `test(Txx): <behavior> [red]`. Run it and paste the failing output into the PR description.
   - Then the minimal implementation that makes it pass: `feat(Txx): <behavior> [green]`.
   - Then an optional `refactor(Txx): …` with tests still green.
   - Repeat per behavior. Never write implementation code without a failing test that demands it.
   - Exempt: docs-only and content-only tasks. Content is still validated by the schema test.
5. **Finish:** set `Status: done` in the same PR, mark the PR ready, and merge.

## Merge policy
- A PR whose CI (`ci-ok` check) is green **may be merged by the session without asking**. Use squash merge or enable auto-merge.
- **Exceptions that need a human:** the task says `Approval: required` (always true for design mock-ups), or the person who started the task asked for approval. Add the `needs-approval` label to such PRs. CI's `approval-gate` keeps `ci-ok` red until a human removes the label.
- Never skip, disable, or weaken tests to get CI green.

## Editing `docs/TASKS.md` (avoid merge conflicts)
- Only edit the `Status:` / `Branch:` / `PR:` lines **inside your own task's block**.
- Don't reflow, reorder, or renumber other tasks. Don't add summary or status tables.
- To add a task, append a new block at the end of its lane with the next unused ID, and copy the block template exactly. Leave the blank line between the static fields and the mutable fields.
- Status values: `todo` · `in-progress` · `in-review` · `blocked (<reason>)` · `done`.
- Docs-only changes (`*.md`, `docs/**`) run only the trivial CI gate, so doc updates are cheap.

## Code standards
- TypeScript `strict`; no `any` without a comment explaining why. ESLint + Prettier must pass.
- **Domain logic is pure:** `src/core`, `src/lexicon`, `src/engine`, `src/tangle`, `src/speech/grade` must not import React or touch the DOM. UI talks to domain code only through the types in `src/core/types.ts`.
- `src/core/types.ts` and the poem Zod schema are **contracts**. Change them only in a dedicated small PR, and note which tasks it affects.
- Poem content lives in `content/poems/*.json` and must validate against the schema. Readings are **modern** pronunciations. Hokkien Tâi-lô is stored in both layers: **文讀 literary** and **白讀 everyday**.
- Tests sit next to the code (`*.test.ts(x)`); e2e tests go in `e2e/`. Run Playwright with `--trace off` unless debugging.
- Secrets (TTS API keys) come only from local env. Never commit them, and never use them in CI. Generated audio is committed under `public/audio/`.

## Commits & PRs
- Conventional Commits with the task ID as scope, e.g. `feat(T31): count-aware duplicate feedback [green]`.
- Fill in the PR template: task ID, red/green evidence, approval requirement.
