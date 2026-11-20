/**
 * 生成 data/pinyin.ts：干员、盟约、装备、策略、流派名称的拼音，供速查页搜索使用。
 *
 *   npm install
 *   npm run pinyin
 *
 * 新增名称后需要重新运行。
 * 多音字读错、或玩家常用另一种读法时，在对应赛季 meta.ts 的 pinyinOverrides 里写出全部读法（空格分隔每个字的读音），
 * 第一种为标准读法。
 */
import {writeFileSync} from 'node:fs';
import {pinyin} from 'pinyin-pro';
import {
  OPERATORS,
  ADDITIONAL_OPERATORS,
  EQUIPMENT,
  STRATEGIES,
  ALL_COVENANTS,
  BUILD_NAMES,
  LEADERS,
  BOUNTIES,
  TRAINING,
  ENEMY_GLOSSARY,
  COMBAT_ROLE_LABELS,
  PINYIN_OVERRIDES,
} from '../data/index.ts';

const leaderExtraTerms = LEADERS.flatMap((leader) => [
  ...leader.abilities.map((a) => a.skill).filter(Boolean),
  ...leader.hiddenAbilities.map((a) => a.skill).filter(Boolean),
  ...(leader.terms ?? []).map((t) => t.term),
  ...leader.stage.escorts.map((e) => e.name),
  ...(leader.hiddenStage?.escorts.map((e) => e.name) ?? []),
]);

const bountyExtraTerms = BOUNTIES.flatMap((bounty) => [
  bounty.when,
  bounty.mobility,
  bounty.range,
  bounty.damage,
  ...(bounty.tags ?? []),
]);

const trainingExtraTerms = TRAINING.flatMap((training) => [
  ...training.tags,
  ...training.examples,
]);

const names = [
  ...new Set([
    ...OPERATORS.map((o) => o.name),
    ...ADDITIONAL_OPERATORS.map((o) => o.name),
    ...ALL_COVENANTS,
    ...EQUIPMENT.map((e) => e.name),
    ...STRATEGIES.map((s) => s.name),
    ...BUILD_NAMES,
    ...LEADERS.map((l) => l.name),
    ...leaderExtraTerms,
    ...Object.keys(ENEMY_GLOSSARY),
    ...BOUNTIES.map((b) => b.name),
    ...bountyExtraTerms,
    ...TRAINING.map((t) => t.name),
    ...trainingExtraTerms,
    ...COMBAT_ROLE_LABELS,
  ]),
];

const HAN = /\p{Script=Han}/u;

/** 一个名称的全部读法，每种读法是空格分隔的音节串 */
function readings(name) {
  if (Object.hasOwn(PINYIN_OVERRIDES, name)) return PINYIN_OVERRIDES[name];
  const parts = pinyin(name, {
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive',
    v: true,
  })
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  return [parts.join(' ')];
}

const entries = names
  .filter((name) => HAN.test(name))
  .map((name) => [name, readings(name)]);

const body = entries
  .map(
    ([name, list]) =>
      `  ${JSON.stringify(name)}: ${JSON.stringify(list.length === 1 ? list[0] : list)},`,
  )
  .join('\n');

writeFileSync(
  new URL('../data/pinyin.ts', import.meta.url),
  `import type { PinyinIndex } from './types.ts';

/**
 * 名称拼音，音节以空格分隔；有多种读法时为数组，第一种为标准读法。
 * 由 scripts/gen_pinyin.mjs 生成，请勿手改。
 */
export const PINYIN: PinyinIndex = {
${body}
};
`,
);
console.log(`data/pinyin.ts  ${entries.length} names`);
