import type { RouteDef } from './routing';
import { assertUniquePaths, matchRoute } from './routing';
import { useHashRoute } from './useHashRoute';

// Each screen task adds its own `src/app/routes/<name>.route.tsx` exporting `route`;
// nothing here needs editing when a screen is added.
const modules = import.meta.glob<{ route: RouteDef }>('./routes/*.route.tsx', { eager: true });

export const routeRegistry: RouteDef[] = Object.values(modules).map((m) => m.route);
assertUniquePaths(routeRegistry);

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
