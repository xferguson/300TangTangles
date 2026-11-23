import type { RouteDef } from './routing';
import { assertUniquePaths } from './routing';

// Each screen task adds its own `src/app/routes/<name>.route.tsx` exporting `route`;
// nothing here needs editing when a screen is added.
const modules = import.meta.glob<{ route: RouteDef }>('./routes/*.route.tsx', { eager: true });

export const routeRegistry: RouteDef[] = Object.values(modules).map((m) => m.route);
assertUniquePaths(routeRegistry);
