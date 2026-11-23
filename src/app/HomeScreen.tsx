import './HomeScreen.css';

const links = [
  { href: '#/play/jingyesi', zh: '學', label: 'Play', note: 'Learn 靜夜思 one step at a time' },
  { href: '#/library', zh: '詩庫', label: 'Library', note: 'All poems and your progress' },
  { href: '#/read/jingyesi', zh: '讀', label: 'Reading', note: 'Read a poem with readings' },
  { href: '#/settings', zh: '設', label: 'Settings', note: 'Script, readings, theme, backup' },
] as const;

/** The landing page at `#/`. */
export function HomeScreen() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 lang="zh-Hant">唐詩糾纏</h1>
        <p lang="en">300 Tang Tangles</p>
      </header>
      <main className="app-main">
        <nav className="home-nav" aria-label="Home">
          {links.map((l, i) => (
            <a
              key={l.href}
              className={i === 0 ? 'home-link home-primary' : 'home-link'}
              href={l.href}
            >
              <span className="home-zh" lang="zh-Hant" aria-hidden="true">
                {l.zh}
              </span>
              <span className="home-text">
                <b>{l.label}</b>
                <small>{l.note}</small>
              </span>
            </a>
          ))}
        </nav>
      </main>
    </div>
  );
}
