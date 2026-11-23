import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RubyChar, parseZhuyin } from './RubyChar';

describe('parseZhuyin', () => {
  it('splits symbols from a 2nd/3rd/4th tone mark', () => {
    expect(parseZhuyin('ㄔㄨㄤˊ')).toEqual({ symbols: ['ㄔ', 'ㄨ', 'ㄤ'], tone: 'ˊ' });
    expect(parseZhuyin('ㄐㄩˇ')).toEqual({ symbols: ['ㄐ', 'ㄩ'], tone: 'ˇ' });
    expect(parseZhuyin('ㄩㄝˋ')).toEqual({ symbols: ['ㄩ', 'ㄝ'], tone: 'ˋ' });
  });

  it('has no tone mark for 1st tone', () => {
    expect(parseZhuyin('ㄍㄨㄤ')).toEqual({ symbols: ['ㄍ', 'ㄨ', 'ㄤ'], tone: null });
  });

  it('reads the neutral-tone dot whether written before or after the symbols', () => {
    expect(parseZhuyin('˙ㄉㄜ')).toEqual({ symbols: ['ㄉ', 'ㄜ'], tone: '˙' });
    expect(parseZhuyin('ㄉㄜ˙')).toEqual({ symbols: ['ㄉ', 'ㄜ'], tone: '˙' });
  });
});

describe('RubyChar', () => {
  it('off: shows only the character', () => {
    const { container } = render(<RubyChar char="床" reading="chuáng" mode="off" />);
    expect(container.textContent).toBe('床');
    expect(container.querySelector('ruby')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'off');
  });

  it.each([
    ['pinyin', 'chuáng'],
    ['jyutping', 'cong4'],
    ['tailo', 'tshông'],
  ] as const)('%s: puts the reading above in <ruby><rt>', (mode, reading) => {
    const { container } = render(<RubyChar char="床" reading={reading} mode={mode} />);
    const ruby = container.querySelector('ruby');
    expect(ruby).not.toBeNull();
    expect(ruby?.querySelector('rt')?.textContent).toBe(reading);
    expect(container.firstElementChild).toHaveAttribute('data-mode', mode);
  });

  it('zhuyin: stacks symbols in a column to the right with the tone beside them', () => {
    const { container } = render(<RubyChar char="床" reading="ㄔㄨㄤˊ" mode="zhuyin" />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-mode', 'zhuyin');
    expect(root?.querySelector('.ruby-han')?.textContent).toBe('床');
    const syms = [...(root?.querySelectorAll('.zy-col .zy-sym') ?? [])].map((n) => n.textContent);
    expect(syms).toEqual(['ㄔ', 'ㄨ', 'ㄤ']);
    expect(root?.querySelector('.zy-tone')?.textContent).toBe('ˊ');
  });

  it('zhuyin: 1st tone renders no tone mark', () => {
    const { container } = render(<RubyChar char="光" reading="ㄍㄨㄤ" mode="zhuyin" />);
    expect(container.querySelector('.zy-tone')).toBeNull();
  });

  it('zhuyin: neutral dot sits at the top of the column', () => {
    const { container } = render(<RubyChar char="的" reading="˙ㄉㄜ" mode="zhuyin" />);
    const col = container.querySelector('.zy-col');
    expect(col?.firstElementChild).toHaveClass('zy-neutral');
    expect(col?.firstElementChild?.textContent).toBe('˙');
  });

  it('falls back to the bare character when there is no reading', () => {
    const { container } = render(<RubyChar char="床" mode="pinyin" />);
    expect(container.textContent).toBe('床');
    expect(container.querySelector('ruby')).toBeNull();
  });
});
