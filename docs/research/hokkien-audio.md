# Hokkien (Taiwanese) audio & speech: research report

Task: T42 · Researched 2026-11-22 · Feeds: T43

## TL;DR

**Recommendation: go ahead, with a gated path. Do not defer.**

1. **Ship TTS that takes Tâi-lô input** as a `gen-audio` adapter (`nan`), driven by the content's 文讀 Tâi-lô, not by Han characters. T43 first runs a short **bake-off on 《靜夜思》** across the candidate engines below. A native speaker who knows 文讀 then listens. The first engine that passes becomes the adapter.
2. **Use the MOE dictionary (教育部臺灣台語常用詞辭典) as the reference and checker, not as a clip source.** Its audio is CC BY-ND 3.0 TW. The no-derivatives term rules out trimming or splicing syllables into line clips. We can link to it, and we can ship unmodified files with attribution if we ever want to.
3. **Human recording is the fallback** if no engine passes. It is also the premium option for the prototype poem.
4. **Defer Hokkien ASR.** Keep the record → play back → self-grade flow from PLAN §9. No model is both browser-sized and able to grade 文讀 recitation.

**Deferral rule for T43:** if no engine passes the listening check, and no one is available to record, T43 records a deferral and the UI keeps "coming soon".

## Why this is harder than Mandarin or Cantonese

- **文讀 vs 白讀.** Classical poems are read with literary readings. Most engines read Han characters with colloquial readings by default. In 《靜夜思》 most syllables differ:

  | Char | 文讀 (wanted) | 白讀 (typical TTS default) |
  |---|---|---|
  | 月 | goa̍t | gue̍h |
  | 光 | kong | kng |
  | 霜 | song | sng |
  | 頭 | thiô | thâu |
  | 上 | siōng | tsiūnn |
  | 鄉 | hiong | hiunn |

  A Han-character-input engine is therefore **disqualified unless it accepts romanization, or an override at the level of individual syllables**. The MOE dictionary marks the two layers in its entries as `[文]` / `[白]`. For example, 用 is iōng [文] / īng [白]. That makes it the right authority for checking content (T10) and audio.
- **Tone sandhi.** Connected speech changes most tones; only the last syllable of a phrase keeps its citation tone. So stitching together citation-tone syllables sounds wrong for line and full-poem clips. It is only acceptable for single-character clips. An engine must either apply sandhi from citation-tone Tâi-lô, or accept sandhi-marked input.
- **No big-cloud voice.** Azure, Google and AWS have no Taiwanese Hokkien neural voice that we could rely on (verify at T43 time), so we can't reuse the T40 vendor.

## Options evaluated

Legend: ✅ good · ⚠️ uncertain or needs checking · ❌ blocker

### A. Open and academic TTS models

| Candidate | Quality | 文讀 control | Licence | Cost | Automation |
|---|---|---|---|---|---|
| **BreezyVoice-Taigi** (MediaTek Research, Breeze Taigi, arXiv 2603.19259, 2026; built on CosyVoice 2) | ⚠️ newest and likely the best open model; not yet heard | ⚠️ input format unconfirmed. The Breeze work scores everything as Han characters, so Tâi-lô input may not be supported → risk of 白讀 | ✅/⚠️ BreezyVoice code is Apache-2.0, partly derived from CosyVoice. Check the Taigi checkpoint's own licence | Free; needs a GPU to run offline | ✅ runs locally, scriptable |
| **意傳科技 (i3thuan5) SuiSiann / 台灣媠聲** | ⚠️ older model, decent single voice | ✅ the pipeline takes Tâi-lô (community tools go Han → Tâi-lô → 意傳 synthesis) | ⚠️ training code MIT; the public synthesis service is free, but terms of use for redistributing output are not published → **ask in writing** (ithuan@ithuan.tw) | Free | ⚠️ public web service, not a documented API |
| **TAT-TTS corpus** (NTUT) | n/a (data only) | ✅ Tâi-lô annotations | ❌ licensed by application to ACLCLP with a signed agreement. Too heavy for this project to train its own model | Licence fee + training | ❌ |

### B. Commercial TTS

| Candidate | 文讀 control | Licence / cost | Notes |
|---|---|---|---|
| **Taigi AI Labs** (Japan-based; learn-language.tokyo) | ✅ accepts Han, **Tâi-lô** or POJ | ⚠️ commercial and educational API; pricing not public | Strong candidate for the bake-off if the price is reasonable |
| **ATEN 優聲學 AI Voice** | ✅ accepts 台語漢字 and 台羅 | ⚠️ commercial API/SDK; pricing on request | Same |

Both need a key in local env only, like T40. Check that the terms allow committing generated clips to a public repo.

### C. MOE dictionary audio (教育部臺灣台語常用詞辭典)

- ✅ Authoritative native-speaker recordings. Entries mark `[文]`/`[白]`. Entry and example-sentence audio is downloadable in bulk (wav and mp3) from the 相關資源 page.
- ❌ for our clip format: text and audio are **CC BY-ND 3.0 TW** (the 按呢寫 column is BY-NC-ND 2.5). ND forbids trimming, splicing, re-timing or slow-mode variants, which rules out line clips, full-poem clips and `slow` clips. A copy sent to the Taiwan sovereign-AI corpus adds NC as well.
- ⚠️ Audio is per **entry**, not per syllable. A single-character entry's audio may read only one of its readings, so 文讀 coverage of our chars is not guaranteed.
- **Use:** the human listener's reference in the bake-off; a check for T10's Tâi-lô; optionally an "hear it in the MOE dictionary" link in the char popover.

### D. Human recording

- ✅ The best quality and correct 文讀 with natural sandhi. This is also the only option that reliably gets the **chanting/recitation (讀書音) register** right.
- Cost: about 20 minutes of studio or quiet-room time per short poem (full + 4 lines + about 20 chars, × normal/slow). With a paid native speaker, it's small for the prototype and large for 300 poems.
- Licence: get a written CC BY (or full assignment) release from the speaker.
- Automation: ❌ for generation. Still use `gen-audio`'s layout and manifest, using an "import" adapter that slices and names recorded takes.

## Scorecard

| Criterion (weight) | Open TTS (Breezy/意傳) | Commercial TTS | MOE audio | Human |
|---|---|---|---|---|
| Quality (3) | ⚠️ | ✅/⚠️ | ✅ | ✅ |
| 文讀 support (3) | ⚠️ | ✅ | ⚠️ partial | ✅ |
| Licensing (2) | ⚠️ ask | ⚠️ check ToS | ❌ ND | ✅ with release |
| Cost (1) | ✅ | ⚠️ | ✅ | ⚠️ scales badly |
| Automation (2) | ✅ | ✅ | ⚠️ | ❌ |

TTS that takes Tâi-lô wins once a listener has checked it. Human recording is the quality backstop.

## Hokkien ASR feasibility

- **Breeze-ASR-26** (MediaTek, Whisper-based, trained on about 10k h of synthetic Taigi; reported CER about 30%) is the strongest open model. It outputs **Mandarin-style Han characters**, not Tâi-lô. Community CTranslate2/faster-whisper builds exist. Smaller option: NUTN-KWS Whisper-Taiwanese v0.5 (about 90 h of training data).
- Blockers for our use:
  1. **Size.** These are Whisper-large-class models (about 1.5 B params). They are far too heavy for an offline-first mobile PWA, and a server would break the "static, on-device only" design.
  2. **They can't grade 文讀.** A character transcript can't tell goa̍t from gue̍h. Both come out as 月, so a learner reciting in 白讀 would "pass". Grading would need phone-level (Tâi-lô) output, and no open model provides it.
  3. A CER of about 30% on colloquial speech is too noisy for per-character Tangle feedback.
- **Conclusion: defer.** Hokkien uses the record → compare with reference → self-grade fallback already in PLAN §9 / T44. Revisit if a small model that outputs Tâi-lô appears.

## Plan for T43

1. Prerequisite: T10 content has citation-tone 文讀 Tâi-lô per char, checked against the MOE `[文]` readings.
2. Bake-off on 《靜夜思》, full + 4 lines, normal speed:
   - BreezyVoice-Taigi, if it accepts Tâi-lô (else skip);
   - 意傳, only after written permission to redistribute;
   - one commercial engine (Taigi AI Labs or ATEN), if the user supplies a key and agrees to the price.
3. A native speaker scores each clip: correct 文讀 syllables / 20, sandhi natural (y/n), MOS 1–5. **Pass = 20/20 syllables correct and MOS ≥ 3.5.**
4. Winner → `scripts/gen-audio` adapter `nan` (red/green with a fake vendor, same as T40) → `public/audio/nan/<poem>/`. Record licence and attribution in the audio manifest.
5. No passing engine → human recording for 《靜夜思》 if someone is available, using an import adapter; otherwise a documented deferral, and the UI keeps "coming soon".

## Human dependencies surfaced

- Decision on budget for a commercial Taigi TTS key and/or a paid native speaker.
- A native-speaker listener who knows 文讀 for the bake-off (required on every path).
- Written redistribution permission from 意傳科技 if that engine is used.

## Limits of this research

This session's network allowed web search but not direct page fetches. So the facts above come from search-result summaries of the sources below, and items marked ⚠️ are unverified. T43 should open the primary pages before committing to an engine: model-card licences, the MOE 版權聲明, and vendor ToS and pricing.

## Sources

- Breeze Taigi paper (BreezyVoice-Taigi, BreezeASR-Taigi): https://arxiv.org/abs/2603.19259
- Breeze-ASR-26 model card: https://huggingface.co/MediaTek-Research/Breeze-ASR-26
- BreezyVoice repo (Apache-2.0): https://github.com/mtkresearch/BreezyVoice
- MediaTek Breeze 3 announcement: https://www.mediatek.com/zh-tw/tek-talk-blogs/mediatek-research-breeze-3
- MOE dictionary copyright notice: https://sutian.moe.edu.tw/zh-hant/piantsip/pankhuan-singbing/
- MOE dictionary resources/downloads: https://sutian.moe.edu.tw/zh-hant/siongkuantsuguan/
- MOE 文白異讀 explanation: https://2blog.ilc.edu.tw/3860/2011/11/18/%E6%96%87%E7%99%BD%E7%95%B0%E8%AE%80%E6%95%99%E8%82%B2%E9%83%A8%E8%87%BA%E8%AA%9E%E5%B8%B8%E7%94%A8%E8%A9%9E%E8%BE%AD%E5%85%B8-%E9%9F%B3%E8%AE%80%E8%AA%AA%E6%98%8E/
- Sovereign-AI corpus copy of the dictionary (NC-ND licence): https://taic.moda.gov.tw/datasets/27045f38-a424-4f96-a9e2-fdeadde5a305
- 意傳科技 GitHub: https://github.com/i3thuan5
- Community Han → Tâi-lô → 意傳 pipeline: https://github.com/yazelin/taigi-voice-desk
- TAT-TTS corpus: https://sites.google.com/speech.ntut.edu.tw/fsw/home/tat-tts-corpus
- Taigi AI Labs TTS: https://learn-language.tokyo/zh-TW/taiwanese-taigi-tts-launch · https://ai-taiwan.com.tw/2026/vendor/660
- ATEN AI Voice: https://www.aivoice.com.tw/
- NUTN-KWS Whisper-Taiwanese: https://huggingface.co/NUTN-KWS/Whisper-Taiwanese-model-v0.5

## Addendum (2026-11-22): both reading layers

The user decided that Hokkien should offer **both modern reading layers**, with a setting to choose:

- **文讀 literary** (`nan-lit`): how Tang poems are recited in Taiwan today, e.g. 月 goa̍t, 光 kong.
- **白讀 everyday** (`nan-col`): the colloquial layer, e.g. 月 gue̍h, 光 kng, 頭 thâu.

Reconstructed Middle Chinese (the actual Tang-era sound) is noted in PLAN §8 as a future idea and is not part of T43.

What changes for T43:

1. Content (T10) carries Tâi-lô for both layers. Where a char has no separate everyday form, the 白讀 equals the 文讀. Check both against the MOE dictionary's `[文]`/`[白]` marks.
2. The bake-off scores **both layers**, with the same pass bar of all syllables correct and MOS ≥ 3.5. Tâi-lô input is still required for 文讀. For 白讀, an engine that reads Han characters may pass on its default readings, which may let BreezyVoice-Taigi qualify for that layer even without Tâi-lô input.
3. An engine may pass for one layer only. In that case, ship that layer and show "coming soon" for the other.
4. Audio goes to `public/audio/nan-lit/<poem>/` and `public/audio/nan-col/<poem>/`. That doubles the Hokkien clip count, which matters for the human-recording fallback's cost.
