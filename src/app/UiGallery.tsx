import { useState, type ReactNode } from 'react';
import {
  AudioButton,
  Button,
  CharTile,
  RubyChar,
  ScrollFrame,
  Seal,
  useThemePreference,
  type CharFade,
  type CharTileProps,
  type Romanization,
  type ThemePreference,
} from '../ui';
import './UiGallery.css';

// Sample text for the gallery only; real content comes from content/poems (T10).
// [char, zhuyin, pinyin, jyutping, Tâi-lô 文讀]
const LINE_1: [string, string, string, string, string][] = [
  ['床', 'ㄔㄨㄤˊ', 'chuáng', 'cong4', 'tshông'],
  ['前', 'ㄑㄧㄢˊ', 'qián', 'cin4', 'tsiân'],
  ['明', 'ㄇㄧㄥˊ', 'míng', 'ming4', 'bîng'],
  ['月', 'ㄩㄝˋ', 'yuè', 'jyut6', 'gua̍t'],
  ['光', 'ㄍㄨㄤ', 'guāng', 'gwong1', 'kong'],
];
const POEM = ['床前明月光', '疑是地上霜', '舉頭望明月', '低頭思故鄉'];

const MODES: [Romanization, string, number][] = [
  ['zhuyin', '注音 Zhuyin (Mandarin default)', 1],
  ['pinyin', 'Pinyin', 2],
  ['jyutping', 'Jyutping (Cantonese)', 3],
  ['tailo', 'Tâi-lô 文讀 (Hokkien)', 4],
  ['off', 'Off', 0],
];

const TILE_STATES: [string, Pick<CharTileProps, 'status' | 'level' | 'selected'>][] = [
  ['New', { status: 'new' }],
  ['Learning 1', { status: 'learning', level: 1 }],
  ['Learning 2', { status: 'learning', level: 2 }],
  ['Learning 3', { status: 'learning', level: 3 }],
  ['Learning 4', { status: 'learning', level: 4 }],
  ['Known', { status: 'known' }],
  ['Ignored', { status: 'ignored' }],
  ['Selected', { status: 'learning', level: 2, selected: true }],
];

const FADES: CharFade[] = ['full', 'bare', 'mist', 'blank'];

const RANKS = ['童生', '秀才', '舉人', '進士', '探花', '狀元'];

const THEMES: [ThemePreference, string][] = [
  ['system', 'System'],
  ['light', '宣紙 Light'],
  ['dark', '漆 Dark'],
];

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="gallery-section" aria-label={title}>
      <h2>{title}</h2>
      <p className="gallery-note">{note}</p>
      {children}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="gallery-item">
      {children}
      <span className="gallery-label">{label}</span>
    </div>
  );
}

/** Every primitive in every visual state. Reached at #/ui; used for design review and screenshots. */
export function UiGallery() {
  const [theme, setTheme] = useThemePreference();
  const [stamp, setStamp] = useState(0);
  const [unroll, setUnroll] = useState(0);

  return (
    <div className="gallery">
      <header className="gallery-header">
        <h1>UI primitives · 器</h1>
        <div className="gallery-seg" role="group" aria-label="Theme">
          {THEMES.map(([value, label]) => (
            <Button
              key={value}
              variant={theme === value ? 'primary' : 'ghost'}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </header>

      <Section
        title="RubyChar"
        note="Zhuyin stacks to the right of the character; other readings sit above."
      >
        {MODES.map(([mode, label, idx]) => (
          <Labeled key={mode} label={label}>
            <div className="gallery-line">
              {LINE_1.map((c) => (
                <RubyChar key={c[0]} char={c[0]} reading={idx ? c[idx] : undefined} mode={mode} />
              ))}
            </div>
          </Labeled>
        ))}
      </Section>

      <Section
        title="CharTile"
        note="Lexicon status across poems: 石青 New, 藤黃 fading through Learning 1–4."
      >
        <div className="gallery-row">
          {TILE_STATES.map(([label, props]) => (
            <Labeled key={label} label={label}>
              <CharTile char="霜" reading="ㄕㄨㄤ" mode="zhuyin" onSelect={() => {}} {...props} />
            </Labeled>
          ))}
        </div>
        <h3>Fade</h3>
        <div className="gallery-row">
          {FADES.map((fade) => (
            <Labeled key={fade} label={fade}>
              <div className="gallery-line">
                {LINE_1.map((c) => (
                  <CharTile
                    key={c[0]}
                    char={c[0]}
                    reading={c[1]}
                    mode="zhuyin"
                    status="known"
                    fade={fade}
                  />
                ))}
              </div>
            </Labeled>
          ))}
        </div>
      </Section>

      <Section
        title="Seal"
        note="白文 rank seals. Locked is an outline; overdue fades until reviewed."
      >
        <div className="gallery-row">
          {RANKS.map((r, i) => (
            <Labeled key={r} label={i < 4 ? 'earned' : 'locked'}>
              <Seal
                key={i === 3 ? `stamp-${stamp}` : r}
                text={r}
                state={i < 4 ? 'earned' : 'locked'}
                stamping={i === 3 && stamp > 0}
              />
            </Labeled>
          ))}
          <Labeled label="memorized">
            <Seal text="已背" tone="gold" label="Memorized" />
          </Labeled>
          <Labeled label="overdue">
            <Seal text="舉人" state="overdue" />
          </Labeled>
          <Labeled label="4 chars">
            <Seal text="李白之印" />
          </Labeled>
        </div>
        <div>
          <Button onClick={() => setStamp((n) => n + 1)}>Replay stamp</Button>
        </div>
      </Section>

      <Section
        title="ScrollFrame"
        note="The poem scroll. Horizontal by default, vertical right-to-left as an option."
      >
        <div className="gallery-scrolls">
          <ScrollFrame key={`h-${unroll}`} label="靜夜思 horizontal" unrolling={unroll > 0}>
            {POEM.map((l) => (
              <div key={l} className="gallery-poem-line">
                {l}
              </div>
            ))}
          </ScrollFrame>
          <ScrollFrame label="靜夜思 vertical" orientation="vertical">
            {POEM.map((l) => (
              <div key={l} className="gallery-poem-line">
                {l}
              </div>
            ))}
          </ScrollFrame>
        </div>
        <div>
          <Button onClick={() => setUnroll((n) => n + 1)}>Replay unroll</Button>
        </div>
      </Section>

      <Section title="Button" note="One cinnabar primary action per screen.">
        <div className="gallery-stack">
          <Button variant="primary" size="lg" block caption="Continue">
            繼續
          </Button>
          <div className="gallery-row">
            <Button variant="primary">Check</Button>
            <Button>Hint 首字</Button>
            <Button variant="ghost">Mark rest known</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Section>

      <Section title="AudioButton" note="Shell only; playback arrives in T58.">
        <div className="gallery-row">
          <Labeled label="idle">
            <AudioButton label="Play line 1" onPlay={() => {}} />
          </Labeled>
          <Labeled label="loading">
            <AudioButton label="Play line 1" state="loading" onPlay={() => {}} />
          </Labeled>
          <Labeled label="playing">
            <AudioButton label="Play line 1" state="playing" onPlay={() => {}} />
          </Labeled>
          <Labeled label="slow">
            <AudioButton label="Play line 1 slowly" speed="slow" onPlay={() => {}} />
          </Labeled>
          <Labeled label="unavailable">
            <AudioButton label="Play 台語" state="unavailable" onPlay={() => {}} />
          </Labeled>
        </div>
      </Section>
    </div>
  );
}
