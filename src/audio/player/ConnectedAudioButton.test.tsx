import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_SETTINGS } from '../../core/types';
import type { Settings } from '../../core/types';
import { MockAudioProvider } from '../mock';
import { AudioServiceProvider } from './context';
import { ConnectedAudioButton } from './ConnectedAudioButton';
import { createAudioService } from './service';

function setup(provider: MockAudioProvider, settings: Settings = DEFAULT_SETTINGS) {
  const service = createAudioService({ provider });
  render(
    <AudioServiceProvider service={service}>
      <ConnectedAudioButton
        label="Play line 1"
        target={{ kind: 'line', text: '床前明月光', line: 0 }}
        settings={settings}
        slow
      />
    </AudioServiceProvider>,
  );
}

describe('ConnectedAudioButton', () => {
  it('plays its target slowly in the settings language, then returns to idle', async () => {
    const provider = new MockAudioProvider();
    setup(provider, { ...DEFAULT_SETTINGS, audioLanguage: 'yue' });
    const btn = screen.getByRole('button', { name: 'Play line 1' });
    expect(btn).toHaveAttribute('data-speed', 'slow');
    await userEvent.click(btn);
    expect(provider.calls).toEqual([{ text: '床前明月光', lang: 'yue', rate: 'slow' }]);
    await waitFor(() => expect(btn).toHaveAttribute('data-state', 'idle'));
  });
  it('shows playing while speaking and stops on a second click', async () => {
    const provider = new MockAudioProvider({ manual: true });
    setup(provider);
    const btn = screen.getByRole('button', { name: 'Play line 1' });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('data-state', 'playing'));
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('data-state', 'idle'));
    expect(provider.stopCount).toBeGreaterThan(0);
  });
  it('is unavailable when the device has no voice', () => {
    setup(new MockAudioProvider({ capability: { status: 'no-voice' } }));
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
