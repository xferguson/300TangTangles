import { routeRegistry } from './registry';
import { matchRoute } from './routing';
import { useHashRoute } from './useHashRoute';

export function App() {
  const hash = useHashRoute();
  const match = matchRoute(routeRegistry, hash);
  if (match) return <match.Component />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 lang="zh-Hant">唐詩糾纏</h1>
        <p lang="en">300 Tang Tangles</p>
      </header>
      <main className="app-main" />
    </div>
  );
}
