import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('shows the game title in Chinese and English', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /唐詩糾纏/ })).toBeInTheDocument();
    expect(screen.getByText('300 Tang Tangles')).toBeInTheDocument();
  });

  it('renders a main landmark for screen content', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('UI gallery route', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('shows the UI primitives gallery at #/ui', () => {
    window.location.hash = '#/ui';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /UI primitives/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'RubyChar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'CharTile' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Seal' })).toBeInTheDocument();
  });

  it('switches to the gallery when the hash changes', () => {
    render(<App />);
    expect(screen.queryByRole('heading', { name: /UI primitives/ })).toBeNull();
    act(() => {
      window.location.hash = '#/ui';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { name: /UI primitives/ })).toBeInTheDocument();
  });
});
