/**
 * TEST FIXTURE ONLY. Real 《靜夜思》 content (with reviewed readings) is task T10.
 * Mandarin and Cantonese readings here are the standard ones; Tâi-lô values are placeholders
 * (`fx-lit` / `fx-col`) and must not be copied into real content.
 * Deliberately untyped (plain data) so tests can feed it to the schema and mutate copies.
 */

type Row = [trad: string, simp: string, zhuyin: string, pinyin: string, jyutping: string];

const LINES: { rows: Row[]; punct: string; gloss: string }[] = [
  {
    rows: [
      ['床', '床', 'ㄔㄨㄤˊ', 'chuáng', 'cung4'],
      ['前', '前', 'ㄑㄧㄢˊ', 'qián', 'cin4'],
      ['明', '明', 'ㄇㄧㄥˊ', 'míng', 'ming4'],
      ['月', '月', 'ㄩㄝˋ', 'yuè', 'jyut6'],
      ['光', '光', 'ㄍㄨㄤ', 'guāng', 'gwong1'],
    ],
    punct: '，',
    gloss: 'Before my bed, bright moonlight',
  },
  {
    rows: [
      ['疑', '疑', 'ㄧˊ', 'yí', 'ji4'],
      ['是', '是', 'ㄕˋ', 'shì', 'si6'],
      ['地', '地', 'ㄉㄧˋ', 'dì', 'dei6'],
      ['上', '上', 'ㄕㄤˋ', 'shàng', 'soeng6'],
      ['霜', '霜', 'ㄕㄨㄤ', 'shuāng', 'soeng1'],
    ],
    punct: '。',
    gloss: 'I take it for frost on the ground',
  },
  {
    rows: [
      ['舉', '举', 'ㄐㄩˇ', 'jǔ', 'geoi2'],
      ['頭', '头', 'ㄊㄡˊ', 'tóu', 'tau4'],
      ['望', '望', 'ㄨㄤˋ', 'wàng', 'mong6'],
      ['明', '明', 'ㄇㄧㄥˊ', 'míng', 'ming4'],
      ['月', '月', 'ㄩㄝˋ', 'yuè', 'jyut6'],
    ],
    punct: '，',
    gloss: 'I raise my head and gaze at the bright moon',
  },
  {
    rows: [
      ['低', '低', 'ㄉㄧ', 'dī', 'dai1'],
      ['頭', '头', 'ㄊㄡˊ', 'tóu', 'tau4'],
      ['思', '思', 'ㄙ', 'sī', 'si1'],
      ['故', '故', 'ㄍㄨˋ', 'gù', 'gu3'],
      ['鄉', '乡', 'ㄒㄧㄤ', 'xiāng', 'hoeng1'],
    ],
    punct: '。',
    gloss: 'I bow my head and think of home',
  },
];

const FEELINGS = [
  'Homesickness, quiet and sudden',
  'Longing for home',
  'Loneliness on a still night',
  'Homesickness',
];
const WRONG = ['Joy at the bright night', 'Anger at being far away'];

const lines = LINES.map((l, i) => ({
  chars: l.rows.map(([trad, simp, zhuyin, pinyin, jyutping]) => ({
    trad,
    simp,
    readings: { zhuyin, pinyin, jyutping, tailo: { lit: 'fx-lit', col: 'fx-col' } },
  })),
  punct: l.punct,
  gloss: l.gloss,
  literal: `literal line ${i + 1}`,
  poetic: `poetic line ${i + 1}`,
  meaning: { feeling: FEELINGS[i] ?? 'Homesickness', wrongFeelings: WRONG },
}));

const charUnit = (trad: string, simp: string, gloss: string) => {
  const occ: { line: number; start: number }[] = [];
  lines.forEach((l, line) =>
    l.chars.forEach((c, start) => {
      if (c.trad === trad) occ.push({ line, start });
    }),
  );
  return { id: trad, simp, kind: 'char', gloss, occurrences: occ };
};
const compoundUnit = (trad: string, simp: string, gloss: string, line: number, start: number) => ({
  id: trad,
  simp,
  kind: 'compound',
  gloss,
  occurrences: [{ line, start }],
});

export const fixturePoemData = {
  schemaVersion: 1,
  id: 'fixture-jingyesi',
  title: { trad: '靜夜思', simp: '静夜思' },
  poet: { trad: '李白', simp: '李白', pinyin: 'Lǐ Bái' },
  dynasty: 'tang',
  form: 'wujue',
  lines,
  units: [
    charUnit('床', '床', 'bed'),
    charUnit('前', '前', 'in front of'),
    charUnit('明', '明', 'bright'),
    charUnit('月', '月', 'moon'),
    charUnit('光', '光', 'light'),
    charUnit('疑', '疑', 'suspect'),
    charUnit('是', '是', 'to be'),
    charUnit('地', '地', 'ground'),
    charUnit('上', '上', 'on top of'),
    charUnit('霜', '霜', 'frost'),
    charUnit('舉', '举', 'to raise'),
    charUnit('頭', '头', 'head'),
    charUnit('望', '望', 'to gaze at'),
    charUnit('低', '低', 'to lower'),
    charUnit('思', '思', 'to think of'),
    charUnit('故', '故', 'old, former'),
    charUnit('鄉', '乡', 'hometown'),
    {
      ...compoundUnit('明月', '明月', 'bright moon', 0, 2),
      occurrences: [
        { line: 0, start: 2 },
        { line: 2, start: 3 },
      ],
    },
    compoundUnit('地上', '地上', 'on the ground', 1, 2),
    compoundUnit('舉頭', '举头', 'raise the head', 2, 0),
    compoundUnit('低頭', '低头', 'bow the head', 3, 0),
    compoundUnit('故鄉', '故乡', 'hometown', 3, 3),
  ],
  translation: {
    literal:
      'Before my bed, bright moonlight; I suspect it is frost on the ground. Raising my head I gaze at the bright moon; lowering it I think of home.',
    poetic:
      'Moonlight spills across my bed like frost upon the floor; I lift my eyes to the moon, and bow them, homesick.',
  },
  notes: [
    {
      id: 'bed',
      kind: 'interpretation',
      title: 'What is 床?',
      body: 'Bed, well-railing, or folding stool: scholars disagree.',
    },
  ],
  distractorSeeds: {
    望: { look: ['朢'], sound: ['忘'], meaning: ['看'] },
    霜: { look: ['雪'], sound: [], meaning: ['雪'] },
  },
  meta: {
    curriculum: [{ region: 'prc', grade: 'primary-1' }],
    scene: 'moonlit-floor',
  },
};
