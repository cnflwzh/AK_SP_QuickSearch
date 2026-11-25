import type {OperatorBox} from '../box/model.ts';
import {mergePlanBackup} from '../plans/backup.ts';
import type {Plan} from '../plans/model.ts';
import type {SettingsBackup} from './backup.ts';
import {DEFAULT_SETTINGS, type UserSettings} from './model.ts';

function settingDifferences(left: UserSettings, right: Readonly<UserSettings>) {
  return (Object.keys(left) as (keyof UserSettings)[]).filter(
    (key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]),
  ).length;
}

/** 比较已校验的对站备份与接收页当前存档，供预览和空站点首次导入共用。不会写入任何一方的存档。 */
export function compareMirrorBackup(
  backup: SettingsBackup,
  settings: UserSettings,
  plans: readonly Plan[],
  box: Readonly<OperatorBox>,
) {
  const ranks = Object.entries(backup.box ?? {});
  const merged = mergePlanBackup(plans, backup.plans ?? []);
  return {
    settings: settingDifferences(backup.settings, settings),
    incomingDefault: !settingDifferences(backup.settings, DEFAULT_SETTINGS),
    empty:
      !plans.length &&
      !Object.keys(box).length &&
      !settingDifferences(settings, DEFAULT_SETTINGS),
    plans: merged.additions.length,
    conflicts: merged.conflicts,
    newOperators: ranks.filter(([key]) => box[key] === undefined).length,
    upgrades: ranks.filter(
      ([key, rank]) => box[key] !== undefined && rank > box[key],
    ).length,
  };
}
