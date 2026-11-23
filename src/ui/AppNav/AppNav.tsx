import './AppNav.css';

/** Home and Settings links shown at the top of every screen. */
export function AppNav() {
  return (
    <nav className="app-nav" aria-label="App">
      <a className="app-nav-link" href="#/">
        <span lang="zh-Hant" aria-hidden="true">
          首頁
        </span>{' '}
        Home
      </a>
      <a className="app-nav-link" href="#/settings">
        <span lang="zh-Hant" aria-hidden="true">
          設定
        </span>{' '}
        Settings
      </a>
    </nav>
  );
}
