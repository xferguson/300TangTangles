import { useEffect, useRef, useState, type ReactNode } from 'react';

import { selectVoice, type VoiceInfo } from '../../audio';
import type { AudioLanguage, Settings } from '../../core';
import { loadLexicon, mergeLexicons, saveLexicon } from '../../lexicon/persistence';
import { createBackup, parseBackup } from '../../settings/backup';
import { replaceSettings } from '../../settings/settings';
import { useSettings } from '../../settings/useSettings';
import { Button } from '../../ui';
import './SettingsScreen.css';

interface Option<V extends string> {
  value: V;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface ChoiceProps<V extends string> {
  legend: string;
  name: string;
  value: V;
  options: readonly Option<V>[];
  onChange: (v: V) => void;
  note?: ReactNode;
}

function Choice<V extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  note,
}: ChoiceProps<V>) {
  return (
    <fieldset className="set-group">
      <legend>{legend}</legend>
      <div className="set-options">
        {options.map((o) => (
          <label key={o.value} className="set-option" data-disabled={o.disabled || undefined}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
            />
            <span>
              {o.label}
              {o.hint && <small> {o.hint}</small>}
            </span>
          </label>
        ))}
      </div>
      {note && <p className="set-note">{note}</p>}
    </fieldset>
  );
}

/** Voices the browser offers; empty when speech synthesis is unavailable. */
function useBrowserVoices(provided: readonly VoiceInfo[] | undefined): readonly VoiceInfo[] {
  const read = (): VoiceInfo[] => {
    if (typeof speechSynthesis === 'undefined') return [];
    return speechSynthesis
      .getVoices()
      .map((v) => ({ name: v.name, lang: v.lang, local: v.localService }));
  };
  const [voices, setVoices] = useState<readonly VoiceInfo[]>(provided ?? read);
  useEffect(() => {
    if (provided || typeof speechSynthesis === 'undefined') return;
    const update = () => setVoices(read());
    speechSynthesis.addEventListener?.('voiceschanged', update);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', update);
  }, [provided]);
  return provided ?? voices;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export interface SettingsScreenProps {
  /** Override the device's voices (tests). */
  voices?: readonly VoiceInfo[];
}

export function SettingsScreen({ voices }: SettingsScreenProps) {
  const [settings, update] = useSettings();
  const available = useBrowserVoices(voices);
  const [notice, setNotice] = useState<Notice>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const has = (lang: AudioLanguage) => selectVoice(available, lang) !== null;
  const set =
    <K extends keyof Settings>(key: K) =>
    (v: Settings[K]) =>
      update({ [key]: v });

  async function exportBackup() {
    try {
      const text = createBackup(settings, await loadLexicon(), new Date());
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tang-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ kind: 'ok', text: 'Backup downloaded.' });
    } catch {
      setNotice({ kind: 'error', text: 'Could not read saved progress to export.' });
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!result.ok) {
      setNotice({ kind: 'error', text: result.error });
      return;
    }
    try {
      await saveLexicon(mergeLexicons(await loadLexicon(), result.lexicon));
    } catch {
      setNotice({ kind: 'error', text: 'Could not save imported progress.' });
      return;
    }
    if (result.settings) replaceSettings(result.settings);
    setNotice({
      kind: 'ok',
      text: `Backup imported (${Object.keys(result.lexicon).length} units merged).`,
    });
  }

  return (
    <main className="set">
      <header className="set-head">
        <h1>設定</h1>
        <p>Settings</p>
      </header>

      <Choice
        legend="Script 字體"
        name="script"
        value={settings.script}
        onChange={set('script')}
        options={[
          { value: 'trad', label: 'Traditional', hint: '繁體' },
          { value: 'simp', label: 'Simplified', hint: '简体' },
        ]}
      />
      <Choice
        legend="Mandarin reading 注音"
        name="mandarinRomanization"
        value={settings.mandarinRomanization}
        onChange={set('mandarinRomanization')}
        options={[
          { value: 'zhuyin', label: 'Bopomofo', hint: 'ㄅㄆㄇ' },
          { value: 'pinyin', label: 'Pinyin', hint: 'pīnyīn' },
        ]}
      />
      <Choice
        legend="Show readings"
        name="showReadings"
        value={settings.showReadings ? 'on' : 'off'}
        onChange={(v) => update({ showReadings: v === 'on' })}
        options={[
          { value: 'on', label: 'Shown' },
          { value: 'off', label: 'Hidden' },
        ]}
      />
      <Choice
        legend="Audio language 語音"
        name="audioLanguage"
        value={settings.audioLanguage}
        onChange={set('audioLanguage')}
        options={[
          { value: 'cmn', label: 'Mandarin', hint: '國語' },
          { value: 'yue', label: 'Cantonese', hint: '粵語', disabled: !has('yue') },
          { value: 'nan', label: 'Hokkien', hint: '臺語', disabled: !has('nan') },
        ]}
        note="Languages without an installed voice on this device are unavailable."
      />
      <Choice
        legend="Hokkien reading layer"
        name="hokkienLayer"
        value={settings.hokkienLayer}
        onChange={set('hokkienLayer')}
        options={[
          { value: 'lit', label: 'Literary', hint: '文讀' },
          { value: 'col', label: 'Colloquial', hint: '白讀' },
        ]}
        note="Poems are recited with literary readings."
      />
      <Choice
        legend="Theme 主題"
        name="theme"
        value={settings.theme}
        onChange={set('theme')}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light', hint: '宣紙' },
          { value: 'dark', label: 'Dark', hint: '漆' },
        ]}
      />

      <section className="set-group" aria-labelledby="set-backup">
        <h2 id="set-backup">Backup 備份</h2>
        <p className="set-note">
          Export your progress and settings to a file, or import one. Importing merges progress and
          replaces settings.
        </p>
        <div className="set-actions">
          <Button onClick={() => void exportBackup()}>Export backup</Button>
          <Button onClick={() => fileRef.current?.click()}>Choose file…</Button>
        </div>
        <label className="set-file">
          <span className="set-visually-hidden">Import backup</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void importBackup(e.target.files?.[0])}
          />
        </label>
        {notice?.kind === 'error' && (
          <p role="alert" className="set-msg set-error">
            {notice.text}
          </p>
        )}
        {notice?.kind === 'ok' && (
          <p role="status" className="set-msg">
            {notice.text}
          </p>
        )}
      </section>
    </main>
  );
}
