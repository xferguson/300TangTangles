import { useCallback, useEffect, useState } from 'react';

import { useHashRoute } from '../../app/useHashRoute';
import { usePlayAudio } from '../../audio/player/serviceContext';
import { parsePoem, type Lexicon, type Poem } from '../../core';
import { loadLexicon, saveLexicon } from '../../lexicon';
import { useSettings } from '../../settings/useSettings';
import { ReadingScreen } from './ReadingScreen';

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

/** `#/read` → default poem; `#/read/<poemId>` → that poem. */
function poemIdFromHash(hash: string): string {
  const id = hash.split('/')[2];
  return id ? decodeURIComponent(id) : DEFAULT_POEM_ID;
}

/** Route wrapper: picks the poem from the hash, loads and saves the lexicon, wires browser audio. */
export function ReadingRoute() {
  const hash = useHashRoute();
  const poem = poems.get(poemIdFromHash(hash));
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [settings] = useSettings();

  useEffect(() => {
    let live = true;
    loadLexicon()
      .then((lex) => live && setLexicon(lex))
      .catch(() => live && setLexicon({}));
    return () => {
      live = false;
    };
  }, []);

  // Shared service: re-renders when browser voices finish loading, so audio is not stuck off.
  const playAudio = usePlayAudio(settings);

  const onLexiconChange = useCallback((next: Lexicon) => {
    setLexicon(next);
    void saveLexicon(next);
  }, []);

  if (!poem) {
    return (
      <main className="reading">
        <p>No poem called "{poemIdFromHash(hash)}".</p>
      </main>
    );
  }
  if (!lexicon) {
    return (
      <main className="reading">
        <p>Loading…</p>
      </main>
    );
  }
  return (
    <ReadingScreen
      key={poem.id}
      poem={poem}
      settings={settings}
      lexicon={lexicon}
      onLexiconChange={onLexiconChange}
      playAudio={playAudio}
    />
  );
}
