<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {
  COMBAT_ROLES,
  TRAINING,
  rolesForTraining,
  type CombatRole,
  type TrainingType,
} from '../../../data/index.ts';
import {state} from '../state.ts';
import CovenantCounterGrid from './CovenantCounterGrid.vue';
import GlossaryText from './GlossaryText.vue';

const ROLE_DESC = new Map(COMBAT_ROLES.map((role) => [role.label, role.desc]));

const TRAINING_TONES: Readonly<Record<string, string>> = {
  特异: '#c45b2c',
  飞行: '#2563eb',
  频次: '#0f766c',
  元素: '#9333ea',
  持续: '#16a34a',
  隐匿: '#475569',
  折射: '#0284c7',
  致命: '#dc2626',
  复苏: '#b46a07',
};

interface TrainingMeta extends TrainingType {
  readonly tone: string;
  readonly roles: readonly CombatRole[];
}

const items: readonly TrainingMeta[] = TRAINING.map((item) => ({
  ...item,
  tone: TRAINING_TONES[item.name] ?? 'var(--teal)',
  roles: rolesForTraining(item.name),
}));

const activeName = ref<string>(items[0]?.name ?? '');
const roleFilter = ref<'' | CombatRole>('');

watch(
  () => state.focusTraining,
  (target) => {
    if (!target) return;
    if (items.some((item) => item.name === target)) {
      activeName.value = target;
      roleFilter.value = '';
    }
    state.focusTraining = '';
  },
  {immediate: true},
);

watch(activeName, () => {
  roleFilter.value = '';
});

const activeItem = computed(
  () => items.find((item) => item.name === activeName.value) ?? items[0],
);

const effectiveRoles = computed<readonly CombatRole[]>(() => {
  if (!activeItem.value) return [];
  return roleFilter.value ? [roleFilter.value] : activeItem.value.roles;
});

const activeRoleNotes = computed(() =>
  effectiveRoles.value
    .map((role) => ({role, desc: ROLE_DESC.get(role) ?? ''}))
    .filter((entry) => entry.desc),
);
</script>

<template>
  <section class="tr-shell" aria-label="普通敌人与特训对策">
    <!-- 左侧（桌面）/ 顶部紧凑格（手机·矮窗）：全部 9 类特训一屏直选，无需翻页 -->
    <nav class="tr-nav" aria-label="特训敌人类型">
      <button
        v-for="item in items"
        :key="item.name"
        type="button"
        :class="['tr-item', {on: activeItem?.name === item.name}]"
        :style="{'--tr-c': item.tone}"
        :aria-current="activeItem?.name === item.name ? 'true' : undefined"
        @click="activeName = item.name">
        <i class="tr-dot" aria-hidden="true"></i>
        <span class="tr-item-main">
          <b>{{ item.name }}</b>
          <small><GlossaryText :text="item.desc" :focusable="false" /></small>
        </span>
        <span class="tr-item-roles">
          <em v-for="role in item.roles.slice(0, 2)" :key="role">{{ role }}</em>
          <em v-if="item.roles.length > 2" class="more">
            +{{ item.roles.length - 2 }}
          </em>
        </span>
      </button>
    </nav>

    <!-- 右侧（桌面）/ 下方（手机）：选中项的攻击方式、实战思路与按盟约分组对策 -->
    <article
      v-if="activeItem"
      :key="activeItem.name"
      class="nc tr-detail"
      :style="{'--tr-c': activeItem.tone}">
      <header class="tr-detail-head">
        <div class="tr-detail-title">
          <span class="tr-badge">{{ activeItem.name }}</span>
          <GlossaryText class="tr-detail-desc" :text="activeItem.desc" />
        </div>
        <div class="tr-detail-tags">
          <i v-for="tag in activeItem.tags" :key="tag">{{ tag }}</i>
          <span class="tr-wave-meta">
            {{ activeItem.randomCandidate ? '参与开局特训抽选' : '常规敌人组' }}
          </span>
        </div>
      </header>

      <!-- 敌人攻击方式与实战思路：不出站即懂怎么打 -->
      <div class="tr-intel">
        <div class="tr-intel-box">
          <small>攻击方式与机制</small>
          <p><GlossaryText :text="activeItem.attackStyle" /></p>
          <div class="tr-examples">
            <span v-for="ex in activeItem.examples" :key="ex">{{ ex }}</span>
          </div>
        </div>
        <div class="tr-intel-box counter">
          <small>实战应对思路</small>
          <p><GlossaryText :text="activeItem.strategy" /></p>
        </div>
      </div>

      <!-- 对策实战职能细筛 -->
      <div class="tr-solution">
        <div
          class="tr-role-bar"
          role="group"
          :aria-label="`${activeItem.name}对策职能筛选`">
          <button
            v-if="activeItem.roles.length > 1"
            type="button"
            :class="['tr-role-btn', {on: roleFilter === ''}]"
            :aria-pressed="roleFilter === ''"
            @click="roleFilter = ''">
            全部职能
          </button>
          <button
            v-for="role in activeItem.roles"
            :key="role"
            type="button"
            :class="[
              'tr-role-btn',
              {on: roleFilter === role || activeItem.roles.length === 1},
            ]"
            :aria-pressed="roleFilter === role || activeItem.roles.length === 1"
            @click="
              if (activeItem.roles.length > 1) {
                roleFilter = roleFilter === role ? '' : role;
              }
            ">
            {{ role }}
          </button>
        </div>
        <ul v-if="activeRoleNotes.length" class="tr-role-notes">
          <li v-for="entry in activeRoleNotes" :key="entry.role">
            <b>{{ entry.role }}</b>
            <GlossaryText :text="entry.desc" />
          </li>
        </ul>
      </div>

      <!-- 按盟约分组的对策干员与对策装备 -->
      <CovenantCounterGrid :roles="effectiveRoles" />
    </article>
  </section>
</template>

<style scoped>
.tr-shell {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

/* 左侧 9 类紧凑导航：一屏完整可见 */
.tr-nav {
  display: grid;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  position: sticky;
  top: calc(var(--qbar-height, 100px) + 8px);
}
.tr-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease;
}
.tr-item:hover {
  background: var(--surface2);
  border-color: var(--line);
}
.tr-item.on {
  border-color: color-mix(in srgb, var(--tr-c, var(--teal)) 55%, var(--line));
  background: color-mix(in srgb, var(--tr-c, var(--teal)) 10%, var(--surface));
}
.tr-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--tr-c, var(--teal));
}
.tr-item-main {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  gap: 1px;
}
.tr-item-main b {
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
}
.tr-item.on .tr-item-main b {
  color: var(--tr-c, var(--teal));
}
.tr-item-main small {
  font-size: 11px;
  line-height: 1.25;
  color: var(--ink3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tr-item-roles {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tr-item-roles em {
  font-style: normal;
  font-size: 10.5px;
  line-height: 1.35;
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--tr-c, var(--teal)) 11%, var(--surface2));
  color: var(--tr-c, var(--teal));
  font-weight: 600;
  white-space: nowrap;
}
.tr-item-roles em.more {
  background: var(--surface2);
  color: var(--ink3);
}

/* 右侧即时对策详情面板 */
.tr-detail {
  display: grid;
  gap: 11px;
  padding: 13px 15px;
  border-top: 3px solid var(--tr-c, var(--teal));
  min-width: 0;
}
.tr-detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--line);
}
.tr-detail-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.tr-badge {
  padding: 2px 10px;
  border-radius: 6px;
  background: var(--tr-c, var(--teal));
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}
.tr-detail-desc {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
}
.tr-detail-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}
.tr-detail-tags i {
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tr-c, var(--teal)) 12%, var(--surface2));
  color: var(--tr-c, var(--teal));
}
.tr-wave-meta {
  font-size: 11px;
  color: var(--ink3);
}

/* 攻击方式与应对思路双栏卡 */
.tr-intel {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 8px;
}
.tr-intel-box {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
}
.tr-intel-box.counter {
  border-color: color-mix(in srgb, var(--tr-c, var(--teal)) 32%, var(--line));
  background: color-mix(in srgb, var(--tr-c, var(--teal)) 5%, var(--surface2));
}
.tr-intel-box small {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink3);
}
.tr-intel-box.counter small {
  color: var(--tr-c, var(--teal));
}
.tr-intel-box p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink);
}
.tr-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.tr-examples span {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink2);
}

/* 对策方案与职能细筛 */
.tr-solution {
  display: grid;
  gap: 7px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface2);
  border: 1px solid var(--line);
}
.tr-role-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.tr-role-btn {
  min-height: 28px;
  padding: 2px 10px;
  border: 1px solid var(--line2);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.tr-role-btn:hover {
  border-color: var(--tr-c, var(--teal));
  color: var(--tr-c, var(--teal));
}
.tr-role-btn.on {
  border-color: var(--tr-c, var(--teal));
  background: var(--tr-c, var(--teal));
  color: #fff;
}
.tr-role-notes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ink2);
}
.tr-role-notes li {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
}
.tr-role-notes b {
  color: var(--tr-c, var(--teal));
  font-weight: 700;
}

/* 手机与窄栏：顶部紧凑 3×3 直选格（~112px），对策内容紧贴下方一屏可见 */
@container quickref-view (max-width: 740px) {
  .tr-shell {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .tr-nav {
    position: static;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
    padding: 5px;
  }
  .tr-item {
    min-height: 36px;
    padding: 5px 7px;
    gap: 6px;
    justify-content: center;
  }
  .tr-item-main {
    display: inline-flex;
    align-items: center;
    flex: 0 1 auto;
  }
  .tr-item-main small,
  .tr-item-roles {
    display: none;
  }
  .tr-detail {
    padding: 10px 11px;
    gap: 9px;
  }
  .tr-intel {
    grid-template-columns: minmax(0, 1fr);
  }
  .tr-role-btn {
    min-height: 34px;
  }
}

/* 安卓横屏小窗（640×400 / 860×380）：顶部单行横滑条，把全部纵向空间留给对策内容 */
@media (max-height: 600px) {
  .tr-shell {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .tr-nav {
    position: static;
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    gap: 5px;
    padding: 4px;
  }
  .tr-nav::-webkit-scrollbar {
    display: none;
  }
  .tr-item {
    flex: none;
    min-height: 34px;
    padding: 4px 10px;
    gap: 5px;
  }
  .tr-item-main small,
  .tr-item-roles {
    display: none;
  }
  .tr-detail {
    padding: 8px 10px;
    gap: 7px;
  }
  .tr-detail-head {
    padding-bottom: 6px;
  }
  .tr-wave-meta {
    display: none;
  }
  .tr-intel {
    gap: 6px;
  }
  .tr-intel-box {
    padding: 6px 8px;
  }
  .tr-solution {
    padding: 6px 8px;
    gap: 4px;
  }
  .tr-role-btn {
    min-height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tr-item,
  .tr-role-btn {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .tr-item),
:global(:root[data-motion='reduce'] .tr-role-btn) {
  transition: none !important;
}
</style>
