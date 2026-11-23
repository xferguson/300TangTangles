import type { Lexicon, Settings } from '../../core';
import type { Poem } from '../../core/poem';
import { buildLibrary, type Catalog, type LibraryCard } from './library';
import './LibraryScreen.css';

export interface LibraryScreenProps {
  catalog: Catalog;
  poems: readonly Poem[];
  lexicon: Lexicon;
  settings: Settings;
}

function InkDrops({ n }: { n: number }) {
  return (
    <span className="lib-drops" role="img" aria-label={`difficulty ${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 8 11" aria-hidden="true">
          <path
            d="M4 0 C5 3 8 5 8 7.5 A4 3.6 0 0 1 0 7.5 C0 5 3 3 4 0Z"
            fill={i < n ? 'var(--ink)' : 'none'}
            stroke="var(--ink-soft)"
            strokeWidth=".8"
          />
        </svg>
      ))}
    </span>
  );
}

function CardBody({ card, script }: { card: LibraryCard; script: 'trad' | 'simp' }) {
  const open = card.status === 'available' && card.known !== null && card.total !== null;
  return (
    <>
      <span className="lib-title" lang={script === 'trad' ? 'zh-Hant' : 'zh-Hans'}>
        {card.title[script]}
      </span>
      <span className="lib-meta">
        <span lang={script === 'trad' ? 'zh-Hant' : 'zh-Hans'}>{card.poet[script]}</span>
        {' · '}
        <InkDrops n={card.inkDrops} />
      </span>
      {open ? (
        <>
          <span className="lib-meta">
            你認得 <b>{`${card.known}/${card.total}`}</b> 字
          </span>
          <span
            className="lib-meter"
            role="meter"
            aria-label="characters known"
            aria-valuemin={0}
            aria-valuemax={card.total ?? 0}
            aria-valuenow={card.known ?? 0}
          >
            <i style={{ width: `${((card.known ?? 0) / (card.total || 1)) * 100}%` }} />
          </span>
        </>
      ) : (
        <span className="lib-meta lib-soon">coming soon</span>
      )}
    </>
  );
}

/** The library: poems grouped by length tier, playable first, then by familiarity. */
export function LibraryScreen({ catalog, poems, lexicon, settings }: LibraryScreenProps) {
  const tiers = buildLibrary(catalog, poems, lexicon);
  const all = tiers.flatMap((t) => t.poems);
  const openCount = all.filter((c) => c.status === 'available').length;
  return (
    <main className="lib">
      <header className="lib-head">
        <h1 lang="zh-Hant">詩庫</h1>
        <p>
          Library · {openCount} of {all.length} open
        </p>
      </header>
      {tiers.map((t) => (
        <section key={t.tier} className="lib-tier" aria-labelledby={`lib-tier-${t.tier}`}>
          <h2 id={`lib-tier-${t.tier}`} lang="zh-Hant">
            {t.label}
            <small>{t.poems.length}</small>
          </h2>
          <ul className="lib-list">
            {t.poems.map((card) => (
              <li
                key={card.id}
                className={card.status === 'available' ? 'lib-card' : 'lib-card soon'}
              >
                {card.status === 'available' ? (
                  <a className="lib-link" href={`#/read/${card.id}`}>
                    <CardBody card={card} script={settings.script} />
                  </a>
                ) : (
                  <div className="lib-link">
                    <CardBody card={card} script={settings.script} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
