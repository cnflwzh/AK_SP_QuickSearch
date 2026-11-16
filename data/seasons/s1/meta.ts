import type {SeasonMeta} from '../../types.ts';

export const S1_META: SeasonMeta = {
  id: 's1',
  title: '卫戍协议·规程',
  guideSubtitle: '规程 · 序列Ⅰ',
  ruleVersion: 'act3autochess.V3_1 / CN 2.7.91',
  ruleSource:
    'https://github.com/Kengxxiao/ArknightsGameData/blob/6f63c14e27b847ef74b53b00fe51fc322b3cd7ff/zh_CN/gamedata/excel/activity_table.json',
  defaultCovenant: '乌萨斯',
  defaultBuild: '炎',
  baseDeploymentLimit: 8,
  defaultEliteCopies: 3,
  tierBasePrices: [0, 2, 3, 3, 3, 4, 4],
  roundLimits: {standard: 14, fast: 9},
  pinyinOverrides: {
    仇白: ['qiu bai', 'chou bai'],
    莎草: ['suo cao', 'sha cao'],
  },
  // 短编号使用固定 char_ID 表，干员在展示列表中换位置不会改变分享码含义。
  shareOperatorIds: [
    2, 113, 127, 129, 135, 140, 143, 150, 171, 174, 179, 180, 183, 185, 188,
    193, 194, 195, 199, 202, 206, 218, 219, 237, 249, 258, 263, 264, 274, 291,
    293, 322, 325, 328, 332, 333, 337, 341, 346, 347, 350, 355, 358, 367, 381,
    391, 400, 416, 420, 422, 423, 426, 427, 430, 437, 455, 469, 472, 474, 484,
    485, 488, 492, 496, 499, 616, 1012, 1014, 1016, 1019, 1023, 1027, 1031,
    1034, 1036, 1038, 1039, 1040, 1042, 1045, 1046, 1047, 1051, 2015, 2025,
    2026, 4009, 4010, 4013, 4016, 4026, 4027, 4031, 4037, 4041, 4042, 4046,
    4047, 4054, 4055, 4058, 4064, 4065, 4066, 4072, 4082, 4088, 4098, 4114,
    4116, 4133, 4134, 4137, 4139, 4145, 4146, 4147, 4151, 4162, 4163, 4165,
    4166, 4177, 4179, 4193, 4198, 4202, 4203, 4204, 4207, 4211, 4221, 4222,
    4224, 4226, 4228, 4230, 4231, 4232, 4244, 4245, 4247,
  ],
};
