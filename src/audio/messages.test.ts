import { describe, expect, it } from 'vitest';

import { capabilityMessage } from './messages';

describe('capabilityMessage', () => {
  it('is null when a voice is ready', () => {
    const cap = { status: 'ready', voice: { name: 'Sin-ji', lang: 'zh-HK', local: true } } as const;
    expect(capabilityMessage(cap, 'yue')).toBeNull();
  });
  it('says plainly that the device has no Cantonese voice, and does not offer Mandarin', () => {
    const msg = capabilityMessage({ status: 'no-voice' }, 'yue');
    expect(msg).toBe('This device has no Cantonese voice installed.');
    expect(msg).not.toMatch(/mandarin/i);
  });
  it('names Mandarin for cmn and Hokkien for nan', () => {
    expect(capabilityMessage({ status: 'no-voice' }, 'cmn')).toBe(
      'This device has no Mandarin voice installed.',
    );
    expect(capabilityMessage({ status: 'no-voice' }, 'nan')).toMatch(/Hokkien/);
  });
  it('explains unsupported browsers', () => {
    expect(capabilityMessage({ status: 'unsupported' }, 'yue')).toMatch(/does not support speech/);
  });
});
