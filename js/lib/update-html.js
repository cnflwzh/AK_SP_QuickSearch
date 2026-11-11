/** 局部更新模板内容，保留仍在结果中的节点、图片和控件。 */

const keyOf = node => node.nodeType === 1
  ? node.getAttribute('data-key') ?? (node.id ? `id:${node.id}` : null)
  : null;

const sameType = (a, b) => a.nodeType === b.nodeType
  && a.nodeName === b.nodeName && a.namespaceURI === b.namespaceURI;

function patchNode(current, next) {
  // 表单的实时值可能与 HTML 属性不同，不能仅凭模板相同跳过它们。
  if (current.isEqualNode(next) && !('value' in current)
    && !current.querySelector?.('input, select, textarea')) return;
  if (current.nodeType !== 1) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }

  // 不重复写入 src、class、style，避免图片和入场动画重新启动。
  for (const attr of [...current.attributes]) {
    if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
  }
  for (const attr of next.attributes) {
    if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  }
  const value = next.value;
  patchChildren(current, next);

  // 用户操作后的表单值是属性状态，需要与模板里的默认值分别同步。
  if (current instanceof HTMLInputElement) {
    if (next.hasAttribute('value') && current.value !== value) current.value = value;
    if (['checkbox', 'radio'].includes(current.type)) current.checked = next.checked;
  } else if (current instanceof HTMLSelectElement && current.value !== value) {
    current.value = value;
  } else if (current instanceof HTMLTextAreaElement && current.value !== value) {
    current.value = value;
  }
}

function patchChildren(parent, nextParent) {
  const nextChildren = [...nextParent.childNodes];
  const nextKeys = new Set(nextChildren.map(keyOf).filter(key => key !== null));
  const keyed = new Map();
  for (const child of [...parent.childNodes]) {
    const key = keyOf(child);
    if (key === null) continue;
    // 先移除被筛掉的项，让留下来的卡片继续原地使用，无需逐张搬动。
    if (!nextKeys.has(key)) child.remove();
    else keyed.set(key, child);
  }

  let cursor = parent.firstChild;
  for (const next of nextChildren) {
    const key = keyOf(next);
    let current = key === null
      ? (cursor && keyOf(cursor) === null ? cursor : null)
      : keyed.get(key);
    if (current && !sameType(current, next)) {
      const after = current.nextSibling;
      current.remove();
      if (cursor === current) cursor = after;
      current = null;
    }

    if (!current) {
      parent.insertBefore(next, cursor);
      continue;
    }
    if (current !== cursor) parent.insertBefore(current, cursor);
    patchNode(current, next);
    cursor = current.nextSibling;
  }
  while (cursor) {
    const next = cursor.nextSibling;
    cursor.remove();
    cursor = next;
  }
}

/**
 * 将应用生成的 HTML 更新到 root 内部，不替换 root 本身；支持 HTML、表格和 SVG。
 * 同一父元素下会筛选或排序的节点须带唯一 data-key（或 id），其余节点按位置复用。
 * @param {Element} root 已挂载的内容容器；节点自己的事件和滚动位置会保留。
 * @param {string} markup 应用模板生成的 HTML；外部文本仍须先转义。
 * @returns {void} 仅修改与模板不同的属性、文本及子节点，不绑定事件。
 */
export function updateHTML(root, markup) {
  const range = document.createRange();
  range.selectNodeContents(root);
  patchChildren(root, range.createContextualFragment(markup));
}
