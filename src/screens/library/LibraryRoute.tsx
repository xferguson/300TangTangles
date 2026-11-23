import { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, type Lexicon } from '../../core';
import { parsePoem } from '../../core/poem';
import { loadLexicon } from '../../lexicon/persistence';
import catalogJson from '../../../content/catalog/index.json';
import { LibraryScreen } from './LibraryScreen';
import { catalogSchema } from './library';

const catalog = catalogSchema.parse(catalogJson);
const poemModules = import.meta.glob('../../../content/poems/*.json', {
  eager: true,
  import: 'default',
});
const poems = Object.values(poemModules).map((m) => parsePoem(m));

export function LibraryRoute() {
  const [lexicon, setLexicon] = useState<Lexicon>({});
  useEffect(() => {
    let live = true;
    loadLexicon()
      .then((l) => live && setLexicon(l))
      .catch(() => undefined); // no saved progress (or storage unavailable): everything is new
    return () => {
      live = false;
    };
  }, []);
  return (
    <LibraryScreen catalog={catalog} poems={poems} lexicon={lexicon} settings={DEFAULT_SETTINGS} />
  );
}
