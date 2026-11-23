import { useState } from 'react';

import {
  readingFor,
  readingSystemFor,
  type Lexicon,
  type Poem,
  type PoemChar,
  type PoemUnit,
  type Script,
  type Settings,
  type UnitStatus,
} from '../../core';
import { markKnown, setStatus, statusOf } from '../../lexicon';
import { AppNav, AudioButton, Button, CharTile, ScrollFrame } from '../../ui';
import './ReadingScreen.css';

export interface ReadingScreenProps {
  poem: Poem;
  settings: Settings;
  lexicon: Lexicon;
  /** Receives the whole updated lexicon after every status change. */
  onLexiconChange: (next: Lexicon) => void;
  /** Speak `text` in the audio language; absent when audio is unavailable. */
  playAudio?: (text: string, opts?: { slow?: boolean }) => void;
}

type Translation = 'off' | 'whole' | 'line' | 'word';
const TRANSLATIONS: [Translation, string][] = [
  ['off', 'Off'],
  ['whole', 'Whole'],
  ['line', 'Line'],
  ['word', 'Word'],
];

const STATUSES: [UnitStatus, string][] = [
  ['new', 'New'],
  ['learning', 'Learning'],
  ['known', 'Known'],
  ['ignored', 'Ignored'],
];

interface Selection {
  line: number;
  index: number;
}

/** The units shown for one line in word mode: compounds replace the chars they cover. */
function lineWords(poem: Poem, line: number): PoemUnit[] {
  const byId = new Map(poem.units.map((u) => [u.id, u]));
  const starts = new Map<number, PoemUnit>();
  for (const u of poem.units) {
    if (u.kind !== 'compound') continue;
    for (const o of u.occurrences) if (o.line === line) starts.set(o.start, u);
  }
  const out: PoemUnit[] = [];
  const chars = poem.lines[line]?.chars ?? [];
  for (let i = 0; i < chars.length; i++) {
    const compound = starts.get(i);
    if (compound) {
      out.push(compound);
      i += [...compound.id].length - 1;
    } else {
      const unit = byId.get(chars[i]!.trad);
      if (unit) out.push(unit);
    }
  }
  return out;
}

function StatusButtons({
  unit,
  label,
  lexicon,
  onSet,
}: {
  unit: string;
  label?: string;
  lexicon: Lexicon;
  onSet: (unit: string, status: UnitStatus) => void;
}) {
  const current = statusOf(lexicon, unit);
  return (
    <div className="rd-status" role="group" aria-label={`Status of ${label ?? unit}`}>
      {STATUSES.map(([status, name]) => (
        <Button
          key={status}
          size="md"
          aria-pressed={current === status}
          aria-label={label ? `${label} ${name}` : name}
          onClick={() => onSet(unit, status)}
        >
          {name}
        </Button>
      ))}
    </div>
  );
}

function ReadingsList({ char, settings }: { char: PoemChar; settings: Settings }) {
  // The popover always shows readings, whatever the poem's own reading toggle says.
  const shown = { ...settings, showReadings: true };
  if (settings.audioLanguage === 'nan') {
    return (
      <dl className="rd-readings">
        <dt data-active={settings.hokkienLayer === 'lit' || undefined}>文讀 literary</dt>
        <dd>{char.readings.tailo.lit}</dd>
        <dt data-active={settings.hokkienLayer === 'col' || undefined}>白讀 everyday</dt>
        <dd>{char.readings.tailo.col}</dd>
      </dl>
    );
  }
  const system = readingSystemFor(shown);
  return (
    <dl className="rd-readings">
      <dt>{system}</dt>
      <dd>{readingFor(char.readings, shown)}</dd>
    </dl>
  );
}

export function ReadingScreen({
  poem,
  settings,
  lexicon,
  onLexiconChange,
  playAudio,
}: ReadingScreenProps) {
  const [script, setScript] = useState<Script>(settings.script);
  const [translation, setTranslation] = useState<Translation>('off');
  const [notesOpen, setNotesOpen] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);

  const rubyMode = settings.showReadings ? readingSystemFor(settings) : 'off';
  const newUnits = poem.units.filter((u) => statusOf(lexicon, u.id) === 'new');

  const apply = (unit: string, status: UnitStatus) =>
    onLexiconChange(setStatus(lexicon, unit, { status }, new Date()));

  const selChar = selected ? poem.lines[selected.line]?.chars[selected.index] : undefined;
  const selUnits = selected
    ? poem.units.filter(
        (u) =>
          u.kind === 'compound' &&
          u.occurrences.some(
            (o) =>
              o.line === selected.line &&
              selected.index >= o.start &&
              selected.index < o.start + [...u.id].length,
          ),
      )
    : [];
  const selCharUnit = selChar ? poem.units.find((u) => u.id === selChar.trad) : undefined;

  return (
    <main className="reading">
      <AppNav />
      <header className="rd-header">
        <h1>{poem.title[script]}</h1>
        <p className="rd-byline">
          {poem.poet[script]} · {poem.poet.pinyin}
        </p>
      </header>

      <div className="rd-toolbar">
        <div className="rd-seg" role="group" aria-label="Script">
          <Button aria-pressed={script === 'trad'} onClick={() => setScript('trad')}>
            繁
          </Button>
          <Button aria-pressed={script === 'simp'} onClick={() => setScript('simp')}>
            简
          </Button>
        </div>
        <div className="rd-seg" role="group" aria-label="Translation">
          {TRANSLATIONS.map(([mode, name]) => (
            <Button
              key={mode}
              aria-pressed={translation === mode}
              onClick={() => setTranslation(mode)}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      <ScrollFrame label={poem.title.trad}>
        <ol className="rd-lines">
          {poem.lines.map((line, li) => (
            <li key={li} className="rd-line">
              <div className="rd-line-row">
                <div className="rd-chars">
                  {line.chars.map((c, ci) => {
                    const entry = lexicon[c.trad];
                    return (
                      <CharTile
                        key={ci}
                        char={c[script]}
                        status={entry?.status ?? 'new'}
                        level={entry?.level ?? undefined}
                        reading={readingFor(c.readings, settings)}
                        mode={rubyMode}
                        selected={selected?.line === li && selected.index === ci}
                        onSelect={() =>
                          setSelected(
                            selected?.line === li && selected.index === ci
                              ? null
                              : { line: li, index: ci },
                          )
                        }
                      />
                    );
                  })}
                  <span className="rd-punct" aria-hidden="true">
                    {line.punct}
                  </span>
                </div>
                <AudioButton
                  label={`Play line ${li + 1}`}
                  state={playAudio ? 'idle' : 'unavailable'}
                  onPlay={() => playAudio?.(line.chars.map((c) => c[script]).join(''))}
                />
              </div>
              {translation === 'line' && <p className="rd-gloss">{line.gloss}</p>}
              {translation === 'word' && (
                <ul className="rd-words">
                  {lineWords(poem, li).map((u) => (
                    <li key={u.id}>
                      <span lang="zh" className="rd-word">
                        {u[script === 'trad' ? 'id' : 'simp']}
                      </span>{' '}
                      <span className="rd-word-gloss">{u.gloss}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </ScrollFrame>

      {translation === 'whole' && (
        <section className="rd-whole" aria-label="Translation">
          <p>{poem.translation.poetic}</p>
          <p className="rd-literal">{poem.translation.literal}</p>
        </section>
      )}

      {selected && selChar && selCharUnit && (
        <section className="rd-popover" role="dialog" aria-label={`${selChar[script]} details`}>
          <div className="rd-pop-head">
            <span className="rd-pop-char" lang="zh">
              {selChar[script]}
            </span>
            <AudioButton
              label={`Play ${selChar[script]}`}
              state={playAudio ? 'idle' : 'unavailable'}
              onPlay={() => playAudio?.(selChar[script])}
            />
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <ReadingsList char={selChar} settings={settings} />
          <p className="rd-meaning">{selCharUnit.gloss}</p>
          <StatusButtons unit={selChar.trad} lexicon={lexicon} onSet={apply} />
          {selUnits.map((u) => (
            <div key={u.id} className="rd-compound">
              <p>
                <span lang="zh" className="rd-word">
                  {u[script === 'trad' ? 'id' : 'simp']}
                </span>{' '}
                <span className="rd-word-gloss">{u.gloss}</span>
              </p>
              <StatusButtons unit={u.id} label={u.id} lexicon={lexicon} onSet={apply} />
            </div>
          ))}
        </section>
      )}

      <div className="rd-actions">
        <Button
          disabled={newUnits.length === 0}
          onClick={() =>
            onLexiconChange(
              markKnown(
                lexicon,
                newUnits.map((u) => u.id),
                new Date(),
              ),
            )
          }
        >
          Mark rest known ({newUnits.length})
        </Button>
        <Button aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)}>
          Scholar's notes
        </Button>
      </div>

      {notesOpen && (
        <aside className="rd-notes" aria-label="Scholar's notes">
          {poem.notes.map((n) => (
            <article key={n.id} className="rd-note" data-kind={n.kind}>
              <h2>{n.title}</h2>
              <p>{n.body}</p>
            </article>
          ))}
          {poem.notes.length === 0 && <p>No notes for this poem.</p>}
        </aside>
      )}
    </main>
  );
}
