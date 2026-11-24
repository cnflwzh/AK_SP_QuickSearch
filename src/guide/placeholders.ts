// 短占位只显示首段。保留旧版可收藏的片段，将首次打开的深链接直接路由到所属章节。
const chapterAnchors: Readonly<Record<string, readonly string[]>> = {
  c1: 'diff lvchart lvmiss unlock tlseg tlinfo tl crseg crsum crchart shopbar'.split(
    ' ',
  ),
  c2: (
    'dispatchMode sLv sTiers sCost sCd sRound sSpent sSlots bUp bUpC bRef bFrz bNext bReset ' +
    'sShop sReward sRewardSlots sBenchN sBench shopTbl elSel elOut elCost elFx tierTbl ' +
    'poolSeg poolV soloSplit tierMx rfx rfChips dgrid benchDemo ordFx combos'
  ).split(' '),
  c3: 'trLeader tr9 waves leak joint ldseg ldr bty decTbl'.split(' '),
  c4: (
    'covg stk trig tlist s44 posseg mirror pos posTitle posOps ' +
    'cvSel cvLv cvL cvVals cvBase cvBig cvChart stseg stcnt stg'
  ).split(' '),
  c5: ['btabs', 'bpanel', 'hyb'],
  c6: 'dbTier dbCov dbType dbQ dbEl dbN dbg eqcols'.split(' '),
};

/** 根据已解码的页内片段查找懒加载章节，未知片段返回 undefined。 */
export function chapterForAnchor(anchor: string): string | undefined {
  return Object.keys(chapterAnchors).find((id) =>
    chapterAnchors[id].includes(anchor),
  );
}

/** Static content shown until the nearby chapter module is ready. */
export const placeholders: Readonly<Record<string, string>> = {
  c1: `
  <div class="chap-h"><span class="no">01</span><div><h2>快速上手</h2><p class="en">WHAT IS STRONGHOLD PROTOCOL · QUICK START</p></div></div>
  <p class="chap-lead">哪怕你从没玩过《明日方舟》或自走棋也没关系——下面先用一分钟讲清卫戍协议到底怎么玩，推荐第一把选「个人模拟」不限时慢慢试。</p>
  <h3 class="bh"><span>1.1</span>什么是《卫戍协议》？零基础一分钟读懂</h3>
  <div class="card">正在加载快速上手图解…</div>`,
  c2: `
  <div class="chap-h"><span class="no">02</span><div><h2>招募与升本</h2><p class="en">ECONOMY · SHOP · PROMOTION · EQUIPMENT</p></div></div>
  <p class="chap-lead">商店在游戏内叫「调度中心」。休整期的核心只有一件事：在开战清零前把资金换成战力或备战席角色，再靠三合一解锁更强的高阶主力。</p>
  <h3 class="bh"><span>2.1</span>资金五件事</h3>
  <div class="card">正在加载调度中心模拟器与合成图解…</div>`,
  c3: `
  <div class="chap-h"><span class="no">03</span><div><h2>敌人与对策</h2><p class="en">BRIEFING · JOINT DEFENSE · BOUNTIES · BOSS</p></div></div>
  <p class="chap-lead">对局失利大概率是因为没留意开局作战简报，或过早选了高难度悬赏敌人：提前补上对空、破隐或治疗角色，首领战避开点名格就能稳稳过关。</p>
  <h3 class="bh"><span>3.1</span>开局作战简报：9 类敌人特点（战术特训）速查</h3>
  <div class="card">正在加载战术特训、联防演示与领袖速记卡…</div>`,
  c4: `
  <div class="chap-h"><span class="no">04</span><div><h2>盟约与叠层</h2><p class="en">COVENANTS · STACKING ENGINE · POSITIONING</p></div></div>
  <p class="chap-lead">每个角色都带有阵营或职业标签（盟约），凑够人数即可激活团队加成，并通过叠加层数放大伤害。</p>
  <h3 class="bh"><span>4.1</span>黄金配队公式：「6 核心 + 2 机动位」</h3>
  <div class="card">正在加载盟约曲线计算器与站位朝向图…</div>`,
  c5: `
  <div class="chap-h"><span class="no">05</span><div><h2>热门流派</h2><p class="en">META ARCHETYPES · STARTER PICKS</p></div></div>
  <p class="chap-lead">先选一套推荐阵容，看看前期该抓哪些干员。打开流派页后，点「设为本局」即可高亮本局需要的干员。</p>
  <h3 class="bh"><span>5.1</span>十大核心盟约推荐阵容</h3>
  <div class="card">正在加载十大核心流派与变阵方案…</div>`,
  c6: `
  <div class="chap-h"><span class="no">06</span><div><h2>避坑与实战</h2><p class="en">PITFALLS · COMBAT ROLES · QUICKREF WORKFLOW</p></div></div>
  <p class="chap-lead">上场前过一遍新手八大高频翻车点，学会按 13 类实战职能抓克制角色。</p>
  <h3 class="bh"><span>6.1</span>新手八大高频翻车点</h3>
  <div class="card">正在加载避坑口诀与实战职能速查台…</div>`,
};
