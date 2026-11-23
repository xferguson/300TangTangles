import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { clear } from 'idb-keyval';

import { FakeSpeechSynthesis } from '../../audio/fakeSpeech';
import { ReadingRoute } from './ReadingRoute';

// Own file so the app-wide audio service is created here, after the fake is installed.
const synth = new FakeSpeechSynthesis([]);
vi.stubGlobal('speechSynthesis', synth);
vi.stubGlobal('SpeechSynthesisUtterance', function (this: { text: string }, text: string) {
  this.text = text;
});

afterEach(async () => {
  window.location.hash = '';
  await clear();
});

describe('reading route audio', () => {
  it('enables audio once browser voices load late, and speaks on click', async () => {
    window.location.hash = '#/read/jingyesi';
    render(<ReadingRoute />);
    await screen.findByRole('heading', { level: 1, name: '靜夜思' });
    synth.setVoices([{ name: 'Mei-Jia', lang: 'zh-TW', localService: true }]);
    const [button] = await screen.findAllByRole('button', { name: /^Play/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button!);
    expect(synth.spoken).toHaveLength(1);
  });
});
