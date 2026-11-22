import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
