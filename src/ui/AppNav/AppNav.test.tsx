import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppNav } from './AppNav';

describe('AppNav', () => {
  it('links home and to settings', () => {
    render(<AppNav />);
    const nav = screen.getByRole('navigation', { name: 'App' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '#/');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '#/settings');
  });
});
