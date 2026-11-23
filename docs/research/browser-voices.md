# Browser voices for Mandarin and Cantonese: findings

Task: T41 · Written 2026-11-23 · Feeds: T45, T58

## TL;DR

- Audio uses the browser's `speechSynthesis`. Which voices exist depends on the **device and OS**, not on our app. We cannot ship a guarantee, only detection plus an honest message.
- Cantonese is selected only from `zh-HK` or `yue*` voices. If none exists, the provider reports `no-voice` and the UI says "This device has no Cantonese voice installed." (`capabilityMessage` in `src/audio/messages.ts`). **It never falls back to a Mandarin voice**, because a Mandarin voice reading Cantonese text produces Mandarin pronunciation and would silently teach the wrong sound.
- **Nothing in this document was verified by a human listening.** See "What could not be verified".

## What was observed directly

Probe: Playwright's Chromium, run in this task's Linux sandbox, waiting 1.5 s for `voiceschanged`.

| Item | Result |
|---|---|
| Browser | HeadlessChrome 157 on Linux x86_64 |
| `'speechSynthesis' in window` | `true` |
| `speechSynthesis.getVoices()` | **empty list (0 voices)** |

So on a bare Linux Chromium with no speech-dispatcher / espeak voices installed, the API exists but offers nothing. This is the real "no voice installed" state and is exactly what the provider's `no-voice` status models. It also means automated tests must use the fake `speechSynthesis` (`src/audio/fakeSpeech.ts`); CI cannot exercise real voices.

## What is documented (not observed here)

These come from vendor documentation and common knowledge as of the author's knowledge. Treat them as expectations to check on a real device, not as facts about this app.

| Platform | Mandarin | Cantonese | Notes |
|---|---|---|---|
| macOS / iOS Safari | Yes: `zh-TW` (e.g. Meijia), `zh-CN` (e.g. Tingting) | Yes: `zh-HK` (e.g. Sinji) | Some voices must be downloaded in System Settings / Settings → Accessibility → Spoken Content before they appear. Lists can be empty until `voiceschanged` fires. |
| Windows Edge / Chrome | Yes, if the Chinese language pack's voices are installed (Microsoft online voices in Edge, e.g. `zh-TW`, `zh-CN`) | Yes in Edge with `zh-HK` online voices (e.g. HiuGaai, WanLung); local availability depends on the installed language pack | Edge's online "natural" voices need network. |
| Desktop Chrome (non-Windows) | Google network voices (`zh-CN`, `zh-TW`) on some builds | Google network voice for `yue-HK` on some builds | Network voices need connectivity and may be absent in Chrome builds without Google voices. |
| Android Chrome | Via the device's TTS engine (Google TTS: `zh-CN`, `zh-TW`) | Google TTS offers `yue-HK` on recent versions; may need a voice-data download | Android reports tags with underscores (`zh_TW`); `normalizeLang` handles this. |
| Firefox | Uses OS voices (Windows SAPI/OneCore, macOS, speech-dispatcher on Linux) | Same: only if the OS has one | On Linux often empty unless speech-dispatcher with a Chinese engine is configured. |

Caveats on these claims: voice names and the presence of `yue-HK` change between OS and Chrome releases, and a given voice may be local on one platform and network-only on another.

## Pitfalls that affect the code

1. **Voices load late.** `getVoices()` is often empty on first call (Chrome, Safari). The provider subscribes to `voiceschanged` and exposes `onChange`; UI must re-read capability on change rather than caching the first answer.
2. **Language tag spelling varies**: `zh-HK`, `zh_HK`, `yue-HK`, `yue-Hant-HK`. Selection normalises case and underscores and accepts any tag starting `zh-hk` or `yue`.
3. **`zh-HK` is ambiguous in principle**: a few engines label a Mandarin-with-HK-accent voice `zh-HK`. We cannot detect this from metadata; only listening can.
4. **Mandarin selection excludes Cantonese tags**, so a device with only `zh-HK` gives Mandarin `no-voice` too (rather than reading Mandarin poems in Cantonese).
5. **Rate**: `slow` maps to 0.6. Some voices ignore or clamp `rate`; unverified.
6. **Android/iOS autoplay and background rules** require speech to start from a user gesture. The audio buttons are gesture-driven; unverified on devices.

## 《靜夜思》 and wrong readings

Not assessed: this needs a person listening on real devices. The expected failure modes to look for when someone does check:

- Literary vs colloquial Cantonese readings (文讀 vs 白讀) are mostly the same for this poem, but check 光, 霜, 望, 舉 and 頭 for any colloquial substitution.
- 床 (cong4 in Cantonese) is a classic trap: a Mandarin-oriented engine or a mislabelled voice may produce Mandarin `chuáng`.
- Tone-level errors cannot be caught from metadata.
- 思 in 《靜夜思》 is the noun reading (si3); engines often read it as si1. Check this specifically.

## What could NOT be verified

- No human listening happened; no judgement of how any voice sounds on 《靜夜思》.
- Not tested: Safari (macOS/iOS), iOS, Android, Windows, Edge, Firefox, or non-headless desktop Chrome with real voices. The platform table above is documentation-based expectation only.
- Not confirmed that any real device's `zh-HK`/`yue` voice reads the poem with correct Cantonese pronunciation.
- Not confirmed which voices a specific learner's device will have; the app must keep detecting at runtime.
- The T40 manual check ("desktop Chrome plus one phone, noting which voices were found") is also outstanding.

## Follow-ups

- (Resolved in T62: `AudioCheckPage` and its dev route were deleted.)
- A human with a Cantonese-capable device should fill in a "voices found / how it sounded" table here.
