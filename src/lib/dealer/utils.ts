import {
  COVENANTS,
  CYCLE_REWARDS,
  HEADCOUNT_BREAKPOINTS,
  LAYER_BREAKPOINTS,
} from '../../../data/index.ts';
import type {CovenantMemo, TraitSegment} from './types.ts';

let orderNonce = 0;

/** Generates a fresh per-attempt seed so card positions shuffle even on the same daily date. */
export function createOrderSeed(): string {
  orderNonce = (orderNonce + 1) | 0;
  return `${Date.now().toString(36)}-${orderNonce}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Formats a local calendar date key as YYYY-MM-DD. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailyTagFromKey(dateKey: string): string {
  return dateKey.slice(5).replace('-', '') || dateKey;
}

function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (FNV-1a + Mulberry32) so daily runs match everywhere. */
export function createSeededRandom(seedKey: string): () => number {
  let state = hashSeed(seedKey) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith<T>(list: readonly T[], rng: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function extractTriggerHint(trait: string): string {
  const match = trait.match(/<([^>]+)>/);
  return match?.[1] ?? '常驻生效';
}

export function shortenTraitText(trait: string): string {
  return trait
    .replace(/使已激活的|已激活的/g, '')
    .replace(/（此干员在整备区也生效）/g, '（整备区生效）')
    .replace(/每回合至多叠加/g, '每回合至多')
    .replace(/每场战斗至多叠加/g, '每场至多');
}

/** Splits an operator or equipment trait into styled segments without HTML interpolation. */
export function splitTraitSegments(trait: string): TraitSegment[] {
  const shortened = shortenTraitText(trait);
  const parts = shortened.split(/(<[^>]+>|【[^】]+】|\d+(?:\.\d+)?%?)/);
  const segments: TraitSegment[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('<') && part.endsWith('>')) {
      segments.push({text: part.slice(1, -1), kind: 'trigger'});
    } else if (part.startsWith('【') && part.endsWith('】')) {
      segments.push({text: part.slice(1, -1), kind: 'covenant'});
    } else if (/^\d+(?:\.\d+)?%?$/.test(part)) {
      segments.push({text: part, kind: 'num'});
    } else {
      segments.push({text: part, kind: 'text'});
    }
  }
  return segments;
}

/** Returns concise rule-memory hints built strictly from static rules data. */
export function covenantMemo(covenant: string): CovenantMemo {
  const data = COVENANTS[covenant];
  if (!data) {
    return {covenant, need: 0, summary: '', bonus: ''};
  }
  const reserveNote =
    COVENANTS[covenant]?.mechanics?.countsReserve ||
    data.effect.includes('整备区也计入')
      ? '（整备区也计入）'
      : '';
  const summary = `${data.need}人激活${reserveNote} · ${data.effect}`;

  const bonusParts: string[] = [];
  const cycle = CYCLE_REWARDS[covenant];
  const layers = LAYER_BREAKPOINTS[covenant];
  const head = HEADCOUNT_BREAKPOINTS.find((item) => item.covenant === covenant);
  if (cycle) bonusParts.push(`每${cycle.every}层得${cycle.reward}`);
  if (layers?.length) {
    bonusParts.push(layers.map((p) => `${p.layers}层${p.effect}`).join('；'));
  }
  if (head) bonusParts.push(`${head.condition}：${head.effect}`);
  else if (!layers?.length && data.bonus) bonusParts.push(data.bonus);

  return {
    covenant,
    need: data.need,
    summary,
    bonus: bonusParts.join(' · '),
  };
}
