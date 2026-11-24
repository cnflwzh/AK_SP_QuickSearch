import type {Covenant} from '../../data/index.ts';
import {esc} from '../lib/ui/dom.ts';

export interface DiffSegment {
  readonly kind: 'equal' | 'del' | 'add';
  readonly text: string;
}

export interface TextTokenDiff {
  readonly left: readonly DiffSegment[];
  readonly right: readonly DiffSegment[];
  readonly rewritten: boolean;
}

const TOKEN_PATTERN =
  /<[^<>]+>|【[^】]+】|\d+(?:\.\d+)?|[A-Za-z0-9_]+|\s+|[\u4e00-\u9fff]|./gu;

/** 将游戏描述拆分为适合对比的原子词元（保留时机尖括号、盟约方括号与完整数字）。 */
export function tokenizeDiff(text: string): string[] {
  if (!text) return [];
  return text.match(TOKEN_PATTERN) ?? [text];
}

function pushSegment(
  list: DiffSegment[],
  kind: DiffSegment['kind'],
  text: string,
): void {
  if (!text) return;
  const last = list[list.length - 1];
  if (last && last.kind === kind) {
    list[list.length - 1] = {kind, text: last.text + text};
  } else {
    list.push({kind, text});
  }
}

/**
 * 计算两段描述文本的词级 LCS 差异，分别输出左侧（equal + del）与右侧（equal + add）序列。
 * 若整段重做导致公共比例过低，则整段标记为替换，避免零碎虚词干扰阅读。
 */
export function diffText(before: string, after: string): TextTokenDiff {
  if (before === after) {
    const same: readonly DiffSegment[] = before
      ? [{kind: 'equal', text: before}]
      : [];
    return {left: same, right: same, rewritten: false};
  }
  if (!before) {
    return {
      left: [],
      right: after ? [{kind: 'add', text: after}] : [],
      rewritten: true,
    };
  }
  if (!after) {
    return {
      left: [{kind: 'del', text: before}],
      right: [],
      rewritten: true,
    };
  }

  const a = tokenizeDiff(before);
  const b = tokenizeDiff(after);
  const n = a.length;
  const m = b.length;

  if (n * m > 45000) {
    return {
      left: [{kind: 'del', text: before}],
      right: [{kind: 'add', text: after}],
      rewritten: true,
    };
  }

  const cols = m + 1;
  const dp = new Uint16Array((n + 1) * cols);
  for (let i = n - 1; i >= 0; i--) {
    const rowOffset = i * cols;
    const nextRowOffset = (i + 1) * cols;
    const ai = a[i];
    for (let j = m - 1; j >= 0; j--) {
      if (ai === b[j]) {
        dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
      } else {
        const down = dp[nextRowOffset + j];
        const right = dp[rowOffset + j + 1];
        dp[rowOffset + j] = down >= right ? down : right;
      }
    }
  }

  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  let equalChars = 0;
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSegment(left, 'equal', a[i]);
      pushSegment(right, 'equal', b[j]);
      equalChars += a[i].length;
      i++;
      j++;
    } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
      pushSegment(left, 'del', a[i]);
      i++;
    } else {
      pushSegment(right, 'add', b[j]);
      j++;
    }
  }
  while (i < n) {
    pushSegment(left, 'del', a[i++]);
  }
  while (j < m) {
    pushSegment(right, 'add', b[j++]);
  }

  const maxLen = Math.max(before.length, after.length);
  if (maxLen >= 8 && equalChars / maxLen < 0.28) {
    return {
      left: [{kind: 'del', text: before}],
      right: [{kind: 'add', text: after}],
      rewritten: true,
    };
  }

  return {left, right, rewritten: false};
}

function formatRichTokenText(
  raw: string,
  covenants?: Readonly<Record<string, Covenant>>,
): string {
  return raw
    .split(/(<[^<>]+>|【[^】]+】)/g)
    .map((part, index) => {
      if (!part) return '';
      if (index % 2 === 0) {
        return esc(part).replace(/\d+(?:\.\d+)?%?/g, '<b>$&</b>');
      }
      const label = part.slice(1, -1);
      if (part.startsWith('<')) {
        const inner = esc(label).replace(/\d+(?:\.\d+)?%?/g, '<b>$&</b>');
        return `<em class="df-k">&lt;${inner}&gt;</em>`;
      }
      const color =
        (covenants && Object.hasOwn(covenants, label)
          ? covenants[label].color
          : undefined) || 'var(--teal)';
      return `<em class="df-c" style="--c:${esc(color)}">${esc(label)}</em>`;
    })
    .join('');
}

/** 将纯效果文本渲染为安全富文本（用于未变动字段或纯新增/纯移除卡片）。 */
export function formatDiffPlainHtml(
  text: string,
  covenants?: Readonly<Record<string, Covenant>>,
): string {
  return formatRichTokenText(text, covenants);
}

/** 将词级差异片段序列渲染为带 <del>/<ins> 标记的安全富文本。 */
export function formatDiffSegmentsHtml(
  segments: readonly DiffSegment[],
  covenants?: Readonly<Record<string, Covenant>>,
): string {
  return segments
    .map((seg) => {
      const inner = formatRichTokenText(seg.text, covenants);
      if (seg.kind === 'del') return `<del class="df-tok-del">${inner}</del>`;
      if (seg.kind === 'add') return `<ins class="df-tok-add">${inner}</ins>`;
      return inner;
    })
    .join('');
}
