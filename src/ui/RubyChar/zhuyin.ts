/** Which reading to show. Mandarin defaults to zhuyin; the reading always matches the audio language. */
export type Romanization = 'zhuyin' | 'pinyin' | 'jyutping' | 'tailo' | 'off';

export type ZhuyinTone = 'ˊ' | 'ˇ' | 'ˋ' | '˙';

const TONE_MARKS: readonly string[] = ['ˊ', 'ˇ', 'ˋ', '˙'];

export interface ParsedZhuyin {
  symbols: string[];
  tone: ZhuyinTone | null;
}

/** Split a zhuyin syllable such as `ㄔㄨㄤˊ` into its symbols and tone mark (none for 1st tone). */
export function parseZhuyin(reading: string): ParsedZhuyin {
  const chars = [...reading.trim()];
  let tone: ZhuyinTone | null = null;
  const symbols: string[] = [];
  for (const c of chars) {
    if (TONE_MARKS.includes(c)) tone = c as ZhuyinTone;
    else symbols.push(c);
  }
  return { symbols, tone };
}
