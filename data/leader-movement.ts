import type { LeaderBattlefield, MovementBranches } from './types.ts';

/**
 * 游戏数据快照：Kengxxiao/ArknightsGameData @ 6f63c14e27b847ef74b53b00fe51fc322b3cd7ff。
 * 地形：levels/activities/act3autochess/level_act3autochess_mXX/*_sub_03.json，
 * 截取列 2–18、从上往下第 6–11 行；仅保留初始可见的工事和高台。
 * I 源石污染区，H 高台，M 沼泽，G 草丛，V 加速地板；其他图例与 LEADER_MAP 一致。
 */
export const LEADER_BATTLEFIELDS: readonly LeaderBattlefield[] = [
  {"id":"01","name":"场地 01","grid":["#################","#B....._o_.....B#","#B.BBB.___.BBB.B#","#B.BBB.___.BBB.B#","E..###..o..###..E","#ibbbbb###bbbbbi#"],"crates":[[3,2],[3,3],[4,3],[13,2],[13,3],[12,3]],"platforms":[]},
  {"id":"02","name":"场地 02","grid":["#################","#......_o_......#","#.BB...___...BB.#","#.BB.##___##.BB.#","E....##.o.##....E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
  {"id":"03","name":"场地 03","grid":["#################","###B..._o_...B###","###B.BB___BB.B###","#__..BB___BB..__#","E.......o.......E","#ibbbbb###bbbbbi#"],"crates":[[13,2],[3,2]],"platforms":[[14,3],[1,3],[2,3],[15,3],[5,2],[10,2],[11,2],[6,2]]},
  {"id":"04","name":"场地 04","grid":["#################","#B.###._o_.###.B#","#B..I..___..I..B#","#B..I..___..I..B#","E..###..o..###..E","#ibbbbb###bbbbbi#"],"crates":[[1,1],[2,1],[6,1],[15,1],[14,1],[10,1]],"platforms":[]},
  {"id":"05","name":"场地 05","grid":["#################","##H...B_o_B...H##","##H.B.B___B.B.H##","##H.#.B___B.#.H##","E...#...o...#...E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
  {"id":"06","name":"场地 06","grid":["#################","####HM._o_.MH####","###HBMB___BMBH###","##HBBMB___BMBBH##","E.......o.......E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
  {"id":"09","name":"场地 09","grid":["#################","#......_o_......#","#.B.GG#___#GG.B.#","#.#.HG#___#GH.#.#","E...#G..o..G#...E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
  {"id":"10","name":"场地 10","grid":["#################","#H....._o_.....H#","#H.B...___...B.H#","#H.B.B.___.B.B.H#","E....B#.o.#B....E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
  {"id":"11","name":"场地 11","grid":["#################","#BBB..._o_...BBB#","#....BB___BB....#","#.H#...___...#H.#","E....B#_o_#B....E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
  {"id":"12","name":"场地 12","grid":["#################","#BB..V#_o_#V..BB#","#...#V.___.V#...#","#...#B#___#B#...#","E.B..V..o..V..B.E","#ibbbbb###bbbbbi#"],"crates":[],"platforms":[]},
];

/**
 * 路线：h07_02/06/10/11、h08_02/06；right 使用对应 extraRoutes 分支，
 * 飞行随从使用分别从左右半场起步的主路线。坐标已换成 [列, 从上往下的行]。
 * 基础移速来自 levels/enemydata/enemy_database.json；两段间的 wait 是离场等待秒数。
 * loopFrom=1：先走出生段，再重复巡逻段；没有 loopFrom 的路线到终点后结束。
 * 随从从自身入场开始演示，不重复整回合刷怪波次。
 */
export const LEADER_MOVEMENTS = {
  fin: {"left":{"speed":0.8,"flying":false,"delay":0,"legs":[{"points":[[8,2],[7,1]]},{"points":[[7,1],[1,4],[7,3],[7,1]]}],"loopFrom":1},"right":{"speed":0.8,"flying":false,"delay":0,"legs":[{"points":[[8,2],[9,3]]},{"points":[[9,3],[15,4],[9,1],[9,3]]}],"loopFrom":1}},
  finCore: {"left":{"speed":0.8,"flying":false,"delay":1,"legs":[{"points":[[8,2],[7,1]]},{"points":[[7,1],[1,4],[7,3],[7,1]]}],"loopFrom":1},"right":{"speed":0.8,"flying":false,"delay":0.1,"legs":[{"points":[[8,2],[9,3]]},{"points":[[9,3],[15,4],[9,1],[9,3]]}],"loopFrom":1}},
  gun: {"left":{"speed":0.4,"flying":false,"delay":0,"legs":[{"points":[[8,2],[7,1]]},{"points":[[7,1],[1,4],[7,3],[7,1]]}],"loopFrom":1},"right":{"speed":0.4,"flying":false,"delay":0,"legs":[{"points":[[8,2],[9,3]]},{"points":[[9,3],[15,4],[9,1],[9,3]]}],"loopFrom":1}},
  gunCore: {"left":{"speed":0.4,"flying":false,"delay":0.1,"legs":[{"points":[[8,2],[7,1]]},{"points":[[7,1],[1,4],[7,3],[7,1]]}],"loopFrom":1},"right":{"speed":0.4,"flying":false,"delay":0.1,"legs":[{"points":[[8,2],[9,3]]},{"points":[[9,3],[15,4],[9,1],[9,3]]}],"loopFrom":1}},
  beast: {"left":{"speed":0.3,"flying":false,"delay":0,"legs":[{"points":[[7.8,2],[7,1]]},{"points":[[7,1],[1,4],[7,3],[7,1]]}],"loopFrom":1},"right":{"speed":0.3,"flying":false,"delay":0,"legs":[{"points":[[8.2,2],[9,1]]},{"points":[[9,1],[15,4],[9,3],[9,1]]}],"loopFrom":1}},
  springA: {"left":{"speed":0.3,"flying":false,"delay":0,"legs":[{"points":[[7,2],[1,4]]},{"points":[[1,4],[7,1],[9,1],[9,3],[7,3],[7,1],[9,1],[15,4],[1,4]]}],"loopFrom":1}},
  springB: {"left":{"speed":0.3,"flying":false,"delay":0,"legs":[{"points":[[8,2],[8,3]]},{"points":[[8,3],[7,3],[7,1],[9,1],[9,3],[1,4],[15,4],[8,3]]}],"loopFrom":1}},
  springC: {"left":{"speed":0.3,"flying":false,"delay":0,"legs":[{"points":[[9,2],[15,4]]},{"points":[[15,4],[9,3],[7,3],[7,1],[9,1],[9,3],[7,3],[1,4],[15,4]]}],"loopFrom":1}},
  fiber: {"left":{"speed":0.7,"flying":true,"delay":0,"legs":[{"points":[[8,4],[6,1],[5,4],[3,1],[1,5]]},{"points":[[8,1],[9,1],[11,4],[13,1],[15,5]],"wait":3}]},"right":{"speed":0.7,"flying":true,"delay":0,"legs":[{"points":[[8,4],[10,1],[12,4],[13,1],[15,5]]},{"points":[[8,1],[7,1],[5,4],[3,1],[1,5]],"wait":3}]}},
  sakota: {"left":{"speed":0.4,"flying":true,"delay":0,"legs":[{"points":[[8,1],[7,2],[5,2],[4,3],[2,3],[1,4],[1,5]]},{"points":[[8,1],[9,2],[11,2],[12,3],[14,3],[15,4],[15,5]],"wait":3}]},"right":{"speed":0.4,"flying":true,"delay":0,"legs":[{"points":[[8,1],[9,2],[11,2],[12,3],[14,3],[15,4],[15,5]]},{"points":[[8,1],[7,2],[5,2],[4,3],[2,3],[1,4],[1,5]],"wait":3}]}},
  ground: {"left":{"speed":0.8,"flying":false,"delay":0,"legs":[{"points":[[8,4],[1,5]]},{"points":[[8,1],[15,5]],"wait":3}]},"right":{"speed":0.8,"flying":false,"delay":0,"legs":[{"points":[[8,4],[15,5]]},{"points":[[8,1],[1,5]],"wait":3}]}},
  drone: {"left":{"speed":0.9,"flying":true,"delay":0,"legs":[{"points":[[8,4],[7,4],[7,1],[5,1],[5,4],[3,4],[3,1],[1,1],[1,5]]},{"points":[[8,1],[11,1],[11,4],[13,4],[13,1],[15,1],[15,4],[15,5]],"wait":3}]},"right":{"speed":0.9,"flying":true,"delay":0,"legs":[{"points":[[8,4],[9,4],[9,1],[11,1],[11,4],[13,4],[13,1],[15,1],[15,5]]},{"points":[[8,1],[7,1],[5,1],[5,4],[3,4],[3,1],[1,1],[1,5]],"wait":3}]}},
} as const satisfies Readonly<Record<string, MovementBranches>>;
