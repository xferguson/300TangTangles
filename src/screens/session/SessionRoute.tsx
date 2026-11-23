import { useCallback, useEffect, useMemo, useState } from 'react';

import { useHashRoute } from '../../app/useHashRoute';
import { BrowserSpeechProvider } from '../../audio';
import { parsePoem, type Lexicon, type Poem, type PoemProgress } from '../../core';
import { loadLexicon, saveLexicon } from '../../lexicon';
import { useSettings } from '../../settings/useSettings';
import { loadProgress, saveProgress } from './progressStore';
import { SessionScreen } from './SessionScreen';

const DEFAULT_POEM_ID = 'jingyesi';

const poemFiles = import.meta.glob<unknown>('../../../content/poems/*.json', {
  eager: true,
  import: 'default',
});
const poems = new Map<string, Poem>(
  Object.values(poemFiles).map((json) => {
    const poem = parsePoem(json);
    return [poem.id, poem];
  }),
);

/** `#/play` → default poem; `#/play/<poemId>` → that poem. */
function poemIdFromHash(hash: string): string {
  const id = hash.split('/')[2];
  return id ? decodeURIComponent(id) : DEFAULT_POEM_ID;
}

interface Loaded {
  lexicon: Lexicon;
  progress: PoemProgress;
}

/** Loads the lexicon and this poem's progress, then starts the session. Remounts per poem. */
function PoemSession({ poem }: { poem: Poem }) {
  const [settings] = useSettings();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // One session seed per visit, so a reload gives a fresh shuffle.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  useEffect(() => {
    let live = true;
    Promise.all([
      loadLexicon().catch(() => ({}) as Lexicon),
      loadProgress(poem, new Date().toISOString()),
    ]).then(([lexicon, progress]) => {
      if (live) setLoaded({ lexicon, progress });
    });
    return () => {
      live = false;
    };
  }, [poem]);

  const provider = useMemo(() => new BrowserSpeechProvider(), []);
  const playAudio = useCallback(
    (text: string, opts?: { slow?: boolean }) => {
      void provider.speak(text, settings.audioLanguage, opts?.slow ? 'slow' : 'normal');
    },
    [provider, settings.audioLanguage],
  );
  const canSpeak = provider.capability(settings.audioLanguage).status === 'ready';

  const onPersist = useCallback((lexicon: Lexicon, progress: PoemProgress) => {
    void saveLexicon(lexicon);
    void saveProgress(progress);
  }, []);

  if (!loaded) {
    return (
      <main className="session">
        <p>Loading…</p>
      </main>
    );
  }
  return (
    <SessionScreen
      poem={poem}
      settings={settings}
      lexicon={loaded.lexicon}
      progress={loaded.progress}
      onPersist={onPersist}
      playAudio={canSpeak ? playAudio : undefined}
      seed={seed}
    />
  );
}

/** Route wrapper: picks the poem from the hash. */
export function SessionRoute() {
  const poemId = poemIdFromHash(useHashRoute());
  const poem = poems.get(poemId);
  if (!poem) {
    return (
      <main className="session">
        <p>No poem called "{poemId}".</p>
      </main>
    );
  }
  return <PoemSession key={poem.id} poem={poem} />;
}
