<script setup lang="ts">
import { OPERATOR, TIER_LABELS } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc } from '../../lib/assets.ts';
import type { OwnedEquipment } from '../../lib/runAdvisor.ts';

withDefaults(defineProps<{
  name?: string;
  index?: number;
  copies?: number;
  elite?: boolean;
  selected?: boolean;
  compact?: boolean;
  equipment?: readonly Readonly<OwnedEquipment>[];
  emptyLabel?: string;
}>(), { name: '', copies: 1, equipment: () => [], emptyLabel: '添加干员' });
defineEmits<{ select: [event: MouseEvent] }>();
</script>

<template>
  <button type="button" class="ra-slot" :class="{ empty: !name, selected, elite, compact }"
    :data-t="name ? OPERATOR[name]?.tier : undefined" :data-op="name || undefined"
    :aria-label="name ? `编辑${name}${elite ? '，精锐' : `，${copies}张`}` : emptyLabel"
    :aria-pressed="name ? selected : undefined" @click="$emit('select', $event)">
    <span v-if="index !== undefined" class="ra-slot-index">{{ String(index + 1).padStart(2, '0') }}</span>
    <template v-if="name">
      <span class="ra-slot-portrait">
        <img :src="avatarSrc(name)" alt="" width="56" height="56" loading="lazy">
        <i>{{ TIER_LABELS[OPERATOR[name]?.tier ?? 0] }}</i>
        <b v-if="elite" class="ra-slot-badge">精</b>
        <b v-else-if="copies > 1" class="ra-slot-badge">×{{ copies }}</b>
      </span>
      <strong>{{ name }}</strong>
      <span v-if="!compact" class="ra-slot-gear">
        <span v-for="position in 2" :key="position" :class="{ advanced: equipment[position - 1]?.advanced }">
          <img v-if="equipment[position - 1]" :src="equipIconSrc(equipment[position - 1].name)"
            :alt="equipment[position - 1].name" width="16" height="16">
          <span v-else>·</span>
        </span>
      </span>
    </template>
    <template v-else><span class="ra-slot-plus">＋</span><span>{{ emptyLabel }}</span></template>
  </button>
</template>
