import { HomeScreen } from './HomeScreen';
import { routeRegistry } from './registry';
import { matchRoute } from './routing';
import { useHashRoute } from './useHashRoute';

export function App() {
  const hash = useHashRoute();
  const match = matchRoute(routeRegistry, hash);
  if (match) return <match.Component />;
  return <HomeScreen />;
}
