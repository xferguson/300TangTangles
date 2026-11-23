import { UiGallery } from './UiGallery';
import { useHashRoute } from './useHashRoute';

export function App() {
  const route = useHashRoute();
  if (route === '#/ui') return <UiGallery />;

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
