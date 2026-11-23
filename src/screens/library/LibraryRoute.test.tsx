import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { clear } from 'idb-keyval';

import { resetSettings, setSettings } from '../../settings/settings';
import { LibraryRoute } from './LibraryRoute';

afterEach(async () => {
  resetSettings();
  await clear();
});

describe('library route', () => {
  it('lists 靜夜思 in Traditional by default', () => {
    render(<LibraryRoute />);
    expect(screen.getByRole('link', { name: /靜夜思/ })).toBeInTheDocument();
  });

  it('follows the persisted script setting', () => {
    setSettings({ script: 'simp' });
    render(<LibraryRoute />);
    expect(screen.getByRole('link', { name: /静夜思/ })).toBeInTheDocument();
  });
});
