<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  COVENANTS,
  CORE_COVENANTS,
  ADDON_COVENANTS,
  CORE_BUILDS,
  EQUIPMENT,
  OPERATOR,
  STRATEGIES,
  TIERS,
  TIER_LABELS,
  isCoreCovenant,
  rosterOf,
} from '../../../data/index.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {color, fx, bonusHeadcount, bonusText, stackText} from '../format.ts';
import {state, useQuickrefActions} from '../state.ts';
import {
  inRun,
  run,
  runAltTargets,
  runKey,
  runSlotMap,
  runStat,
} from '../planStore.ts';
import RunBanner from '../components/RunBanner.vue';
import Chip from '../components/Chip.vue';
import CovenantIcon from '../components/CovenantIcon.vue';
import OperatorTile from '../components/OperatorTile.vue';
const actions = useQuickrefActions();
const name = computed(() => state.covenant);
const covenant = computed(() => COVENANTS[name.value]);
const core = computed(() => isCoreCovenant(name.value));
const build = computed(() => CORE_BUILDS[name.value]);
const roster = computed(() => rosterOf(name.value));
const slots = computed(() =>
  core.value
    ? 6
    : Math.max(covenant.value.need, bonusHeadcount(covenant.value.bonus)),
);
const recommended = computed(() =>
  run.value
    ? new Set<string>()
    : new Set(
        build.value ? [...build.value.lineup, ...build.value.carries] : [],
      ),
);
const carries = computed(() =>
  run.value ? new Set<string>() : new Set(build.value?.carries ?? []),
);
const runPicks = computed(() => {
  if (!run.value) return [];
  const altMap = runAltTargets.value;
  const slotMap = runSlotMap.value;
  return roster.value
    .filter((o) => slotMap.has(o.name) || altMap.has(o.name))
    .sort((a, b) => a.tier - b.tier)
    .map((o) => ({
      operator: o,
      slot: slotMap.get(o.name),
      targets: altMap.get(o.name) ?? [],
    }));
});
const mine = computed(() => runStat.value.get(name.value));
const grantedPicks = computed(() => {
  if (!run.value || !mine.value?.granted.length) return [];
  return mine.value.granted
    .map((opName) => OPERATOR[opName])
    .filter((op): op is NonNullable<typeof op> => !!op);
});
const covAltSet = computed(() => {
  const set = new Set<string>();
  for (const opName of runAltTargets.value.keys()) {
    for (const cov of OPERATOR[opName]?.covenants ?? []) set.add(cov);
  }
  return set;
});
const onlyRun = ref(false);
const filterToRun = computed(() => onlyRun.value && runPicks.value.length > 0);
const visibleRoster = computed(() =>
  filterToRun.value
    ? roster.value.filter(
        (o) => inRun.value.has(o.name) || runAltTargets.value.has(o.name),
      )
    : roster.value,
);
const groups = computed(() =>
  [
    {
      title: '持续叠加',
      list: visibleRoster.value.filter((o) => o.type === '持续叠加'),
    },
    {
      title: '单次叠加',
      list: visibleRoster.value.filter((o) => o.type === '单次叠加'),
    },
    {
      title: '其他特质',
      list: visibleRoster.value.filter(
        (o) => o.type !== '持续叠加' && o.type !== '单次叠加',
      ),
    },
  ]
    .filter((group) => group.list.length)
    .map((group) => ({
      ...group,
      list: group.list.sort((a, b) => a.tier - b.tier),
    })),
);
const equipment = computed(() =>
  EQUIPMENT.filter((e) => e.covenant === name.value),
);
const strategies = computed(() =>
  STRATEGIES.filter((s) => s.category === name.value),
);
const builds = computed(() => [
  ...(build.value ? [name.value] : []),
  ...Object.entries(CORE_BUILDS)
    .filter(([, b]) => b.addons.includes(name.value))
    .map(([c]) => c),
]);
const bonusLabel = computed(() => {
  const head = bonusHeadcount(covenant.value.bonus);
  return head ? head + (core.value ? ' 名不同' : ' 名') : '强化';
});
</script>
<template>
  <RunBanner :focus="name" />
  <div class="cvwrap">
    <div id="cvside" :class="['cvside', {open: state.pickerOpen}]">
      <button
        type="button"
        class="cvtg"
        data-cvtg
        :style="{'--c': color(name)}"
        @click="state.pickerOpen = !state.pickerOpen">
        <CovenantIcon :name="name" emblem />
        <b>{{ name }}</b>
        <span :class="['tag', core ? 'a' : 't']">
          {{ core ? '核心' : '附加' }}
        </span>
        <i>▾</i>
      </button>
      <div id="cvp" class="cvp">
        <h5>核心</h5>
        <button
          v-for="item in CORE_COVENANTS"
          :key="item"
          type="button"
          :class="[
            'cvb',
            {
              on: item === name,
              inrun: runStat.get(item)?.active,
              runpart:
                !runStat.get(item)?.active &&
                (runStat.has(item) || covAltSet.has(item)),
            },
          ]"
          :style="{'--c': color(item)}"
          :data-pick="item"
          :aria-pressed="item === name"
          @click="actions.pickCovenant(item)">
          <span class="cvb-l">
            <CovenantIcon :name="item" />
            {{ item }}
          </span>
          <span v-if="runStat.get(item)" class="cvb-cnt">
            <b>{{ runStat.get(item)!.count }}/{{ COVENANTS[item].need }}</b>
          </span>
          <span v-else>{{ rosterOf(item).length }}</span>
        </button>
        <h5>附加</h5>
        <button
          v-for="item in ADDON_COVENANTS"
          :key="item"
          type="button"
          :class="[
            'cvb',
            {
              on: item === name,
              inrun: runStat.get(item)?.active,
              runpart:
                !runStat.get(item)?.active &&
                (runStat.has(item) || covAltSet.has(item)),
            },
          ]"
          :style="{'--c': color(item)}"
          :data-pick="item"
          :aria-pressed="item === name"
          @click="actions.pickCovenant(item)">
          <span class="cvb-l">
            <CovenantIcon :name="item" />
            {{ item }}
          </span>
          <span v-if="runStat.get(item)" class="cvb-cnt">
            <b>{{ runStat.get(item)!.count }}/{{ COVENANTS[item].need }}</b>
          </span>
          <span v-else>{{ rosterOf(item).length }}</span>
        </button>
      </div>
    </div>
    <div class="cvd" :data-covenant="name" :style="{'--c': color(name)}">
      <div class="cvh" data-key="header">
        <CovenantIcon :name="name" emblem />
        <h2>{{ name }}</h2>
        <span :class="['tag', core ? 'a' : 't']">
          {{ core ? '核心' : '附加' }}
        </span>
        <div class="need">
          <i
            v-for="index in slots"
            :key="index"
            :class="{o: index > covenant.need}"
            :style="{animationDelay: (index - 1) * 0.05 + 's'}"></i>
          <b>{{ covenant.need }}</b>
          <span class="cnt">人激活</span>
        </div>
        <button
          v-if="mine"
          type="button"
          :class="[
            'cv-mine',
            {on: mine.active, max: mine.bonusActive, off: mine.broken},
          ]"
          :title="mine.members.join('、')"
          @click="actions.openBuild(runKey)">
          本局
          <b>{{ mine.count }}</b>
          / {{ covenant.need }}
          <template v-if="mine.broken">· 失效</template>
          <template v-else-if="mine.bonusActive">· 强化</template>
          <template v-else-if="mine.active">· 激活</template>
          ▸
        </button>
      </div>
      <div class="efx" data-key="effects">
        <div
          class="ef"
          v-html="
            `<span class='tag'>${covenant.need} 人</span> ${fx(covenant.effect)}`
          "></div>
        <div
          v-if="covenant.bonus"
          class="ef bonus"
          v-html="
            `<span class='tag a'>${bonusLabel}</span> ${fx(bonusText(covenant.bonus))}`
          "></div>
      </div>
      <div
        v-if="run && (runPicks.length || grantedPicks.length)"
        class="cv-run-picks"
        data-key="run-picks">
        <div class="cv-rp-h">
          <b>本局抓牌</b>
          <span class="cnt">
            {{ runPicks.length + grantedPicks.length }} 名
          </span>
          <button
            v-if="runPicks.length"
            type="button"
            :class="['cv-only-btn', {on: filterToRun}]"
            :aria-pressed="filterToRun"
            @click="onlyRun = !onlyRun">
            {{ filterToRun ? '显示全部' : '只看本局' }}
          </button>
        </div>
        <div class="cv-rp-list">
          <button
            v-for="item in runPicks"
            :key="item.operator.name"
            type="button"
            :class="['cv-rp', {core: item.slot?.core, alt: !item.slot}]"
            :data-t="item.operator.tier"
            :data-op="item.operator.name"
            @click="actions.openDetail('op', item.operator.name)">
            <i class="tn">{{ TIER_LABELS[item.operator.tier] }}</i>
            <span v-if="item.slot?.core" class="cv-rp-star">★</span>
            <b>{{ item.operator.name }}</b>
            <em v-if="item.slot?.elite" class="cv-rp-el">精锐</em>
            <small v-if="item.slot?.eq.length" class="cv-rp-eq">
              {{ item.slot.eq.join('/') }}
            </small>
            <small v-else-if="item.targets.length" class="cv-rp-alt">
              ⇄ 替{{ item.targets.join('·') }}
            </small>
          </button>
          <button
            v-for="op in grantedPicks"
            :key="`g:${op.name}`"
            type="button"
            class="cv-rp grant"
            :data-t="op.tier"
            :data-op="op.name"
            @click="actions.openDetail('op', op.name)">
            <i class="tn">{{ TIER_LABELS[op.tier] }}</i>
            <b>{{ op.name }}</b>
            <small class="cv-rp-alt">装备赋予</small>
          </button>
        </div>
      </div>
      <div v-if="roster.length" class="roster" data-key="roster">
        <div class="lg">
          <span class="cnt">
            {{
              filterToRun
                ? `本局 ${visibleRoster.length} / ${roster.length} 名`
                : `${roster.length} 名`
            }}
          </span>
          <template v-if="run">
            <span>
              <b class="sw">✓</b>
              主力
            </span>
            <span>
              <b>★</b>
              核心
            </span>
            <span>
              <b class="sw-alt">备</b>
              过渡/备选
            </span>
          </template>
          <template v-else-if="build">
            <span>
              <b>★</b>
              终盘阵容
            </span>
            <span class="tag a" style="padding: 0 6px">核心</span>
          </template>
        </div>
        <div class="rcols">
          <div
            v-for="tier in TIERS"
            :key="tier"
            :class="['rc', {none: !visibleRoster.some((o) => o.tier === tier)}]"
            :data-t="tier">
            <i>{{ TIER_LABELS[tier] }}</i>
            <div class="tiles">
              <OperatorTile
                v-for="operator in visibleRoster.filter((o) => o.tier === tier)"
                :key="operator.name"
                :operator="operator"
                :extra-class="
                  run
                    ? ''
                    : (carries.has(operator.name) ? 'core ' : '') +
                      (recommended.has(operator.name) ? 'rec' : '')
                " />
            </div>
          </div>
        </div>
      </div>
      <div v-if="visibleRoster.length" class="stak" data-key="stacks">
        <div class="lg">
          <b class="sh5">叠层</b>
          <span>
            <b class="sw">初始</b>
            <s>/</s>
            <b class="sw e">精锐</b>
          </span>
          <span v-if="run">本局抓牌同步标注</span>
          <span v-else-if="build">
            <b>★</b>
            终盘
          </span>
        </div>
        <div
          v-for="group in groups"
          :key="group.title"
          class="sg"
          :data-key="group.title">
          <h5>
            {{ group.title }}
            <span>{{ group.list.length }}</span>
          </h5>
          <div class="srs">
            <button
              v-for="operator in group.list"
              :key="operator.name"
              type="button"
              :class="[
                'sr',
                {
                  inplan: !!run && inRun.has(operator.name),
                  core: !!run && !!runSlotMap.get(operator.name)?.core,
                  inalt:
                    !!run &&
                    !inRun.has(operator.name) &&
                    runAltTargets.has(operator.name),
                },
              ]"
              :data-key="operator.name"
              :data-t="operator.tier"
              :data-op="operator.name"
              data-peek="off"
              @click="actions.openDetail('op', operator.name)">
              <img
                v-if="avatarSrc(operator.name)"
                class=""
                :src="avatarSrc(operator.name)"
                alt=""
                width="80"
                height="80"
                loading="lazy"
                decoding="async" />
              <span v-else class="ph"></span>
              <div>
                <div class="nl">
                  <i class="tn">{{ TIER_LABELS[operator.tier] }}</i>
                  <b>{{ operator.name }}</b>
                  <span
                    v-for="cov in operator.covenants"
                    :key="cov"
                    class="x"
                    :style="{'--c': color(cov)}">
                    <CovenantIcon :name="cov" />
                    {{ cov }}
                  </span>
                  <template v-if="run">
                    <span
                      v-if="runSlotMap.get(operator.name)?.core"
                      class="rk-tag core">
                      ★ 核心
                    </span>
                    <span v-else-if="inRun.has(operator.name)" class="rk-tag">
                      ✓ 本局
                    </span>
                    <span
                      v-else-if="runAltTargets.has(operator.name)"
                      class="rk-tag alt">
                      ⇄ 替{{ runAltTargets.get(operator.name)![0] }}
                    </span>
                  </template>
                  <span v-else-if="recommended.has(operator.name)" class="rk">
                    ★
                  </span>
                </div>
                <div
                  class="tt"
                  v-html="
                    stackText(operator.trait, operator.elite, name)
                  "></div>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div class="tools" data-key="related">
        <div v-if="equipment.length">
          <span>专属装备</span>
          <div class="row">
            <Chip
              v-for="item in equipment"
              :key="item.name"
              kind="eq"
              :name="item.name" />
          </div>
        </div>
        <div v-if="strategies.length">
          <span>专属策略</span>
          <div class="row">
            <Chip
              v-for="item in strategies"
              :key="item.name"
              kind="st"
              :name="item.name" />
          </div>
        </div>
        <div v-if="builds.length">
          <span>流派</span>
          <div class="row">
            <Chip
              v-for="item in builds"
              :key="item"
              kind="build"
              :name="item" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
