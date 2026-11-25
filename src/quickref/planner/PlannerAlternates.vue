<script setup lang="ts">
import {TIER_LABELS, type Operator} from '../../../data/index.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {color} from '../format.ts';

/** 桌面编辑器和小窗面板共同使用的备选按钮；选择与可用性由正在编辑的槽位决定。 */
defineProps<{
  early: readonly Operator[];
  alternates: readonly Operator[];
  disabled: (name: string) => boolean;
  borrowed: (name: string) => boolean;
  compact?: boolean;
}>();
const emit = defineEmits<{pick: [name: string]}>();
</script>

<template>
  <template v-for="(options, group) in [early, alternates]" :key="group">
    <template v-if="options.length">
      <span v-if="group === 0 || early.length" class="pl-altpick-sub">
        {{
          group === 0 ? '前期打工（Ⅰ–Ⅱ 阶同盟约）' : '同位平替（抓不到时替换）'
        }}
      </span>
      <div class="pl-pick-g">
        <button
          v-for="op in options"
          :key="op.name"
          type="button"
          :data-t="op.tier"
          :data-op="op.name"
          :disabled="disabled(op.name)"
          @click="emit('pick', op.name)">
          <img
            :src="avatarSrc(op.name)"
            alt=""
            width="34"
            height="34"
            loading="lazy" />
          <small>
            <template v-if="group === 0">{{ TIER_LABELS[op.tier] }}</template>
            {{ op.name }}
            <em v-if="group === 1 && borrowed(op.name)" class="pl-sub-note">
              需借
            </em>
          </small>
          <span v-if="!compact" class="dots">
            <u
              v-for="name in op.covenants"
              :key="name"
              :style="{'--c': color(name)}"></u>
          </span>
        </button>
      </div>
    </template>
  </template>
</template>
