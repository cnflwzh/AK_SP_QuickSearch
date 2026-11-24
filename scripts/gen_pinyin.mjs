/**
 * 为当前赛季、攻略术语及别名生成 data/pinyin.ts，为比较页单独生成缺少的读音。
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
import {format, resolveConfig} from 'prettier';
import {COMPARISON_VERSIONS} from '../data/comparison/index.ts';
import {ENEMY_TERM_ALIASES, GAME_TERMS} from '../data/gameTerms.ts';
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
    ...GAME_TERMS.flatMap(({term, aliases}) => [term, ...aliases]),
    ...Object.keys(ENEMY_GLOSSARY).flatMap(
      (term) => ENEMY_TERM_ALIASES[term] ?? [],
    ),
  ]),
];

const HAN = /\p{Script=Han}/u;

/** 一个名称的全部读法，每种读法是空格分隔的音节串 */
function readings(name, overrides) {
  if (Object.hasOwn(overrides, name)) return overrides[name];
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
  .map((name) => [name, readings(name, PINYIN_OVERRIDES)]);

const currentReadings = new Map(entries);
const extraReadings = new Map();
for (const {season} of COMPARISON_VERSIONS) {
  const entityNames = new Set([
    ...Object.keys(season.covenants),
    ...season.operators.map((op) => op.name),
    ...season.strategies.map((strategy) => strategy.name),
    ...season.equipment.map((item) => item.name),
    ...season.leaders.map((leader) => leader.name),
    ...season.rules.bounties.map((bounty) => bounty.name),
  ]);
  for (const name of entityNames) {
    if (!HAN.test(name)) continue;
    // 同名实体也要逐赛季读取，旧赛季的多音字覆盖可能与当前词表不同。
    const missing = readings(name, season.meta.pinyinOverrides).filter(
      (reading) => !currentReadings.get(name)?.includes(reading),
    );
    if (!missing.length) continue;
    const variants = extraReadings.get(name) ?? new Set();
    for (const reading of missing) variants.add(reading);
    extraReadings.set(name, variants);
  }
}

async function writeIndex(path, typePath, exportName, entries) {
  const body = entries
    .map(
      ([name, list]) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(list.length === 1 ? list[0] : list)},`,
    )
    .join('\n');

  const destination = new URL(`../${path}`, import.meta.url);
  const source = `import type { PinyinIndex } from '${typePath}';

/**
 * 名称拼音，音节以空格分隔；有多种读法时为数组，第一种为标准读法。
 * 由 scripts/gen_pinyin.mjs 生成，请勿手改。
 */
export const ${exportName}: PinyinIndex = {
${body}
};
`;
  writeFileSync(
    destination,
    await format(source, {
      ...(await resolveConfig(destination)),
      parser: 'typescript',
    }),
  );
  console.log(`${path}  ${entries.length} names`);
}

await writeIndex('data/pinyin.ts', './types.ts', 'PINYIN', entries);
await writeIndex(
  'data/comparison/pinyin.ts',
  '../types.ts',
  'COMPARISON_PINYIN',
  [...extraReadings].map(([name, variants]) => [name, [...variants]]),
);
