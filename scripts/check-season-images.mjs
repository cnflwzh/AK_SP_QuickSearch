import {statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {COMPARISON_VERSIONS} from '../data/comparison/index.ts';
import {CURRENT_SEASON} from '../data/season.ts';

// 按平台真实路径检查大小写、文件类型和非空内容，也覆盖只保留在对比页里的旧赛季。
const root = new URL('../public/assets/img/', import.meta.url);
const images = new Set();
for (const season of new Set([
  CURRENT_SEASON,
  ...COMPARISON_VERSIONS.map((v) => v.season),
])) {
  for (const op of [...season.operators, ...(season.additionalOperators ?? [])])
    images.add('avatars/' + op.avatar);
  for (const item of season.equipment) images.add('equipment/' + item.icon);
  for (const strategy of season.strategies)
    images.add('strategies/' + strategy.portrait);
  for (const covenant of Object.values(season.covenants))
    images.add('covenants/' + (covenant.icon ?? covenant.id));
  for (const leader of season.leaders) images.add('leaders/' + leader.id);
  for (const bounty of season.rules.bounties)
    if (bounty.enemyId) images.add('enemies/' + bounty.enemyId);
}
for (const image of images) {
  const path = fileURLToPath(new URL(image + '.webp', root));
  const info = statSync(path, {throwIfNoEntry: false});
  if (!info?.isFile() || !info.size) {
    console.error('赛季引用的图片不存在或为空：' + path);
    process.exitCode = 1;
  }
}
