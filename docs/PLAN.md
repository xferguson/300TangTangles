# 300 Tang Tangles — Product & Engineering Plan

> Stable reference. Task status lives in [`TASKS.md`](TASKS.md), not here.

# PART 1 — Product design

## 0. Context
The goal is a beautiful, Tang-dynasty-styled, Wordle-inspired app that takes a learner from "never seen this poem" to "can recite it from memory" through a ladder of levels. We prototype with one poem, Li Bai's 《靜夜思》, but the data model and level engine are generic so every catalog poem plugs in. Audio comes in Mandarin, then Cantonese, then Taiwanese Hokkien, each as its own task.

**Decisions made:** mobile-first web app (PWA), Traditional script by default with a Simplified toggle, cloud TTS audio generated at build time, browser speech recognition with a self-grade fallback, 4-color Tangle feedback in Tang pigments, limited attempts where failure sends the line back to review, romanization that matches the audio language (Mandarin defaults to **bopomofo**, with a pinyin setting), and progress stored on-device only with export/import.

---

## 1. Example poem & content model
**《靜夜思》 李白 (五言絕句, 20 chars)**, the standard school text:
床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。

Each poem is a JSON file (`content/poems/jingyesi.json`) containing:
- `lines[]`: chars (Traditional + Simplified), per-char readings (zhuyin, pinyin, Jyutping, Tâi-lô **文讀 literary reading**), line gloss, literal and poetic translation.
- `units[]`: learnable vocabulary. The **base unit is the character**; **compounds** sit on top (明月, 地上, 舉頭, 低頭, 故鄉). Both are tracked separately.
- `notes[]`: "Scholar's notes", such as the 床 debate (bed / well-railing 井欄 / folding stool 胡床), the Song-era variant 床前**看**月光…舉頭望**山**月 and how the Ming text became canonical, the 光/霜/鄉 rhyme, and the 平仄 pattern.
- `meta`: poet, form, char count, curriculum flags, familiarity score, scene/theme id.

## 2. Poem catalog & difficulty
- Grouped by **length tier**: 五絕 (20), 七絕 (28), 五律 (40), 七律 (56), then 古體/樂府.
- Within each tier, sorted by **familiarity** = w1·curriculum_exposure (PRC / Taiwan / HK required lists, earlier grade weighted higher) + w2·vocab_frequency (mean and 25th-percentile char frequency, so one rare char counts against a poem) + w3·shortness.
- Each card shows 1–5 ink drops of difficulty plus a personal "you know 14/20 characters" count from the lexicon.
- A scoring script (`scripts/score-poems.ts`) is built now. v1 ships 靜夜思 plus a few greyed-out "coming soon" cards so the library layout is real.

## 3. Global lexicon (LingQ-style)
There is one lexicon shared across poems. Each unit's status uses Tang mineral pigments:
- **New**: 石青 azurite blue highlight
- **Learning 1–4**: 藤黃 gamboge yellow that fades with each level
- **Known**: no highlight
- **Ignored**: no highlight

Status changes come from FSRS spaced-repetition results, and the user can override by tapping. A character learned in one poem shows as learned in every other poem.

## 4. One continuous journey, not separate games
The app is **one game per poem** that keeps getting harder as you memorize. The stages below are not menus you pick from. They are **phases of a single "study session" flow** that the engine moves you through on its own:
- Opening a poem always lands on **one "Continue" button** that runs a session. The engine decides what comes next from your mastery state: new chars, line building, reviews of earlier lines, recitation. Exercise types are interleaved inside one session, so line 2's characters can appear right after a review of line 1.
- Support fades as you improve. The same poem scroll is always on screen, and its text gradually "fades into mist" as you master each line. Characters you can recall become blank paper, so the poem literally disappears until you're reciting from an empty scroll.
- **Meaning is part of mastery, not an extra.** Every phase includes comprehension prompts: char → meaning, line → which translation, translation → line, and "what is the poet feeling here?" A line only counts as mastered when you can **produce it and say what it means**. The final 狀元 test is reciting the whole poem from a blank scroll, then a quick check of each line's meaning.
- Ranks and seals are progress markers along this one path, not separate levels you choose.
- The only surface that sits outside the flow is **reading mode** (賞): the full poem, audio, and translations can be opened at any time without affecting progress.

### Progress phases (the engine advances through these per line, overlapping across lines)
| Rank | Stage | Activity | Gate |
|---|---|---|---|
| 童生 | **賞 Appreciate** | Poem colored by lexicon. Play the whole poem, one line, or one char; slow mode. Tap a char for a popover (3 readings, meaning, audio, set status). Translation toggles: whole / per line / per word. Scholar's notes drawer. "Mark rest known." | Every highlighted unit triaged |
| 秀才 | **識 Characters** | Flashcards per line for its New/Learning units: char→meaning, audio→char, meaning→char. Known units are skipped. | All units in the line ≥ Learning 2 |
| 舉人 | **句 Lines** | A line unlocks when its units are ready. Scaffolded builder (§5). The next line unlocks after a pass. Earlier lines come back as SRS reviews. | Each line passed at the translation-only step |
| 進士 | **誦 Line recitation** | Prompt is the translation or the previous line (上句接下句). Speak the line; mis-said chars are highlighted. | Each line recited once |
| 探花 | **篇 Tangle** | Wordle assembly of the whole poem from one shared bank (§6). | Every line solved |
| 狀元 | **背 Full recitation** | Blank scroll; recite the whole poem in the chosen language. | ≥ 90% char accuracy, which awards the gold seal "Memorized" |

After 狀元, FSRS schedules occasional Tangles and recitations. A seal fades when its review is overdue.

## 5. Line-builder scaffolding
Each step is a short tap exercise. A mistake drops one step, and the SRS grade comes from attempts and time.
1. Cloze: 1–2 chars missing, choose from 4 options.
2. Ordered bank: only this line's chars, shuffled, with audio and translation visible.
3. Bank + distractors: look-alikes, sound-alikes, and meaning-alikes (望/看, the real variant; 霜/雪; 鄉/卿).
4. Translation only: no audio.
5. First-character prompt (首字提示).

## 6. The Tangle (Wordle) level
- The board is the poem grid (4×5 for a 五絕), with optional vertical right-to-left layout.
- The bank holds every char in the poem (duplicates included: 明月 ×2, 頭 ×2) plus distractors.
- Submitting a row gives per-tile feedback in **Tang colors**, each paired with a glyph mark so it stays colorblind-safe:
  - **石綠 malachite green** + 〇: right char, right spot
  - **藤黃 gamboge** + △: in this line, wrong spot
  - **紫 Tang official purple** + ◇: belongs to another line
  - **墨 ink grey** + ✕: not in the poem
- Bank tiles take on their revealed color, like Wordle's keyboard.
- Each line gets 6 guesses. Running out sends the line back to 舉人 practice, and the Tangle can be retried later.
- Duplicate handling follows Wordle rules (count-aware). This is unit-tested.
- A shareable emoji result grid with a seal.

## 7. Later (out of scope for v1, noted for design)
- 飛花令: given a char (月), recall any memorized line containing it.
- 平仄 and rhyme level.
- Handwriting recall.
- Daily Tangle across memorized poems.
- Cloud sync.

## 8. Audio: separate tasks, in priority order
`scripts/gen-audio.ts` reads the poem JSON and writes `public/audio/{lang}/{poem}/{full|line-n|char-x}.{normal|slow}.mp3`. It runs offline with an API key and the output is committed as static files.
1. **Mandarin** (zh-TW or zh-CN neural voice; SSML phoneme hints force readings).
2. **Cantonese** (zh-HK neural voice; literary readings checked against Jyutping).
3. **Hokkien**: a research task first. Evaluate Taiwan academic or open TTS, MOE dictionary syllable audio, and human recording, all with 文讀 readings. It is dismissed only after that evaluation. Until then the UI shows "coming soon."
- Vendor choice (Azure has zh-CN, zh-TW, and zh-HK) is confirmed when we start the task. The user supplies the key at that point.

## 9. Speech recognition
- `src/speech/` wraps the Web Speech API (`zh-TW` / `zh-CN`, `zh-HK`).
- Grading aligns the transcript to the target with Levenshtein distance and **compares by reading**, so homophone transcriptions still pass.
- Hokkien, or browsers without the API, fall back to record → play back next to the reference → self-grade.

## 10. Visual design: "Tang"
- Light theme: warm 宣紙 paper with subtle fiber texture. Dark theme: ink-black lacquer with gold.
- Pigment tokens: 朱砂 cinnabar (seals, CTAs), 石青, 石綠, 藤黃, 赭石 ochre, 紫, 墨. These are CSS variables with light and dark variants.
- Fonts: LXGW WenKai (楷) for poems and Noto Serif TC for UI. Bopomofo uses `<ruby>` with right-side inter-character positioning; pinyin goes above.
- Motion: a scroll unrolls on poem open, ink bleeds on a correct answer, seals stamp on rank-up, and Dunhuang cloud borders frame screens. Each poem can have a scene; 靜夜思 gets moonlight on a frosted floor.

---

# PART 2 — Engineering plan (tech lead)

## E1. Stack & standards (decided)
- **Runtime/tooling:** Node 22 LTS, pnpm, Vite, React 19, TypeScript `strict`, ESLint + Prettier, Zod (content schema + runtime validation), Zustand (UI state), `idb-keyval` (IndexedDB), `ts-fsrs` (SRS), `vite-plugin-pwa`.
- **Tests:** Vitest + Testing Library (unit/component), Playwright (e2e, phone viewport, `--trace off`).
- **Architecture rule:** pure domain logic (`src/core`, `src/lexicon`, `src/engine`, `src/tangle`, `src/speech/grade`) has **no React/DOM imports**, so it can be built and tested in parallel with UI. UI talks to domain only through the contracts in `src/core/types.ts`.
- **Content is code:** `content/poems/*.json` is validated by the Zod schema in CI (not "docs").
- **Audio:** generated offline by `scripts/gen-audio.ts`; output committed under `public/audio/`. The API key is read from env locally, never committed or used in CI.

## E2. Process rules (go into `CLAUDE.md` so every session follows them)
1. **Red/green TDD for all implementation.** Each behavior lands as a failing test commit (`test(Txx): … [red]`) followed by the implementation commit (`feat(Txx): … [green]`), then optional `refactor`. The PR description links the red commit and shows the failing output. Pure-docs and pure-content tasks are exempt from red/green (content is still schema-validated).
2. **Never commit to `main`.** One task = one branch `task/Txx-short-name` = one PR. The only exception is the one-time bootstrap commit in T00 (`main` doesn't exist yet).
3. **Merge policy:** a PR that passes CI is merged by the session without asking (squash merge, or auto-merge enabled) **unless** the task is marked `Approval: required` in TASKS.md. That applies to design mock-ups (always) and any task flagged so when created. Such PRs get the `needs-approval` label, and CI's `approval-gate` job fails while the label is present. A human removes the label or merges.
4. **Commits:** Conventional Commits with the task ID in scope; attribution trailers per session rules.
5. **Session protocol:** claim a task by setting its `Status:` to `in-progress` + branch name *in the task's own PR*. Never start a task whose `Depends on` aren't `done`. Contracts in `src/core/types.ts` change only through their own small PR.

## E3. CI design (`.github/workflows/ci.yml`)
- Triggers on every PR and push to `main`.
- Job `changes` uses `dorny/paths-filter` to classify: `code` (src/**, scripts/**, content/**, config, package files, public/** except audio) vs `docs` (`**/*.md`, `docs/**`).
- `lint`, `typecheck`, `unit`, `content-validate`, `build`, `e2e` run **only if `code` changed** (e2e only on `src`/`content` changes, with cached Playwright install skipped since the browser is preinstalled locally; CI uses `npx playwright install --with-deps chromium`).
- Docs-only PRs run **nothing except** the cheap `ci-ok` gate (seconds).
- `approval-gate`: fails if PR has `needs-approval` label.
- `ci-ok`: single aggregator job (`if: always()`) that passes when all needed jobs succeeded or were skipped. **This is the only required status check**, which avoids the "skipped required check blocks merge" problem with `paths-ignore`.
- User one-time GitHub settings (listed in T00): protect `main` (require PR + `ci-ok`), enable auto-merge, enable squash merge, auto-delete branches.

## E4. Task-tracking document design (`docs/TASKS.md`)
- Lives under `docs/`, so editing it triggers only `ci-ok`.
- **Conflict-proof layout:** one `###` block per task. The mutable fields (`Status`, `Branch`, `PR`) live *inside* each task's block, and every block is separated from the next by static lines (heading, description, deps, acceptance criteria). No two tasks' status lines are adjacent, so parallel sessions updating different tasks merge cleanly. There is **no** summary table of statuses (it would be the conflict hotspot). The dependency graph at the top is static and changes only when tasks are added.
- New tasks are appended at the end of their lane section with the next free ID, never renumbered.
- Block template:
  ```
  ### T31 · Tangle feedback algorithm
  Lane: C (domain) · Approval: none · Size: S
  Depends on: T02
  Unblocks: T54
  Goal: Count-aware 4-state feedback (correct / in-line / other-line / absent) for a row guess vs the poem.
  Done when: unit tests cover duplicates (明月×2, 頭×2), other-line, distractors; exported from src/tangle.

  Status: todo
  Branch: —
  PR: —
  ```
- `docs/PLAN.md` holds Part 1 (product design) and Part 2 (this engineering plan) as the stable reference.

## E5. Task breakdown

**Phase 0: foundation (serial, critical path)**
- **T00 Bootstrap repo:** initial `main` commit with README + `.gitignore`. Then a PR adding `CLAUDE.md` (standards), `docs/PLAN.md`, `docs/TASKS.md`, the PR template (task ID, red/green evidence, approval checkbox), and `ci.yml` (gate jobs only, for now).
- **T01 App scaffold:** Vite/React/TS/pnpm, ESLint/Prettier, Vitest + one RTL test, Playwright smoke, PWA plugin stub; CI jobs wired up.
- **T02 Core contracts:** Zod poem schema + inferred types; types for `UnitId`, `UnitStatus`, `LexiconEntry`, `Exercise` (discriminated union), `ExerciseResult`, `LineMastery {recognition, production, meaning, recitation}`, `EngineState`, `Settings`; the `nextExercise(state) → Exercise` signature; fixture poem for tests.

**Lane A: Content**
- T10 靜夜思 content JSON: Trad/Simp text, zhuyin/pinyin/Jyutping/Tâi-lô (文讀), glosses, literal + poetic translations, notes, distractor seeds. Expert review. *(dep T02)*
- T11 Catalog scoring script + curriculum/frequency source data, and 3–5 stub catalog entries. *(dep T02)*

**Lane B: Design & UI kit**
- T20 **Design mock-ups** (Approval: required, design): palette tokens light/dark, fonts, scroll, CharTile states (new/learning1-4/known), Tangle tiles with glyphs, seal, fading-scroll states, phone screens for Library / Reading / Session / Tangle / Result. *(dep T00; can start immediately)*
- T21 Theme tokens + UI primitives: `RubyChar` (bopomofo right-side / pinyin top), `CharTile`, `ScrollFrame`, `Seal`, `Button`, and audio button shell. *(dep T01, T20 approved)*

**Lane C: Domain logic (pure TS, the most parallel)**
- T30 Lexicon store: statuses, FSRS integration, IndexedDB persistence, export/import JSON. *(dep T02)*
- T31 Tangle feedback algorithm. *(dep T02)*
- T32 Recitation grader: reading-based alignment, homophone tolerance, per-char diff. *(dep T02)*
- T33 Distractor generator (look/sound/meaning-alike from content seeds). *(dep T02)*
- T34 **Session engine:** mastery model, phase progression, interleaving, fade-level per char, meaning gating, rank computation. Simulated-learner tests. *(dep T30)*

**Lane D: Audio & speech I/O**
- T40 **Audio: Mandarin** pipeline + clips (full / line / char × normal / slow); needs the user's TTS key. *(dep T10)*
- T41 **Audio: Cantonese** clips via the same pipeline. *(dep T40)*
- T42 **Audio: Hokkien research** (written report: options, 文讀 accuracy, licence). Research only, so it can start right away. *(dep T00)*
- T43 Hokkien implementation or documented deferral. *(dep T42, T40)*
- T44 Speech-input wrapper: Web Speech API adapter + record/self-grade fallback behind an interface, with a mock for tests. *(dep T02)*

**Lane E: Screens & integration**
- T50 Library screen (tiers, ink-drop difficulty, known-count). *(dep T21, T10, T30)*
- T51 Reading/triage mode: lexicon highlights, char popover, translations, notes, audio. *(dep T21, T10, T30)*
- T52 Exercise components: Flashcard, Cloze, MeaningCheck. *(dep T21, T02)*
- T53 LineBuilder (scaffold steps 2–5). *(dep T21, T33)*
- T54 TangleRow board + bank coloring + share grid. *(dep T21, T31)*
- T55 **Session flow:** Continue button, engine-driven sequence, fading scroll, rank/seal moments. *(dep T34, T51, T52, T53, T54)*
- T56 Recite exercise (line + full poem). *(dep T32, T44, T52)*
- T57 Settings (script, zhuyin/pinyin, audio language, theme) + backup screen. *(dep T21, T30)*
- T58 Audio player integration + PWA offline caching of audio. *(dep T40, T21)*
- T60 **E2E playthrough** 童生→狀元 via Continue only, plus visual polish pass. *(dep T55, T56, T58)*

## E6. Critical path & parallelism
- **Critical path:** T00 → T01 → T02 → T30 → T34 → T55 → T60. A second near-critical chain runs **T20 (human design approval) → T21 → T52/T53/T54 → T55**. T20 starts on day one so the approval wait overlaps with T01/T02.
- **Concurrency waves** (max useful sessions at once):
  - Wave 1, after T00: T01, T20, T42 → **3**
  - Wave 2, after T02: T10, T11, T30, T31, T32, T33, T44 (+T20 if still in review) → **up to 7**; recommended 4–5
  - Wave 3: T34, T21, T40 (once key provided), T57 → **4**
  - Wave 4: T50, T51, T52, T53, T54, T41, T58 → **up to 7**
  - Wave 5: T55, T56, T43 → **3**
  - Wave 6: T60 → **1**
- **Human dependencies:** T20 approval; the TTS API key before T40; GitHub settings after T00.

## Verification
- T00: the docs-only PR runs only `changes` + `approval-gate` + `ci-ok` (confirmed in the Actions run); adding the `needs-approval` label makes `ci-ok` fail.
- Per-task: the red commit's CI fails and the green commit's passes (visible in PR checks).
- Product verification (from Part 1): engine simulated-learner tests, Tangle duplicate tests, grader tests, Playwright Continue-only playthrough on a phone viewport in both themes and both scripts, and manual audio and mic checks.
