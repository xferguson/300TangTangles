import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('shows the game title in Chinese and English', () => {
    render(<HomeScreen />);
    expect(screen.getByRole('heading', { level: 1, name: /唐詩糾纏/ })).toBeInTheDocument();
    expect(screen.getByText('300 Tang Tangles')).toBeInTheDocument();
  });

  it('links to play, library, reading and settings', () => {
    render(<HomeScreen />);
    expect(screen.getByRole('navigation', { name: 'Home' })).toBeInTheDocument();
    const href = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href(/play/i)).toBe('#/play/jingyesi');
    expect(href(/library/i)).toBe('#/library');
    expect(href(/read/i)).toBe('#/read/jingyesi');
    expect(href(/settings/i)).toBe('#/settings');
  });
});
