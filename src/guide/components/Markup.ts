import { computed, defineComponent, h, type VNodeChild } from 'vue';

/** Render trusted, locally formatted tutorial markup as Vue nodes.
 * Stable data keys keep cards and SVG nodes in place when their values change.
 * Interactive controls are authored in Vue templates rather than HTML strings.
 */
export default defineComponent({
  name: 'GuideMarkup',
  inheritAttrs: false,
  props: { html: { type: String, default: '' }, as: { type: String, default: '' } },
  setup(props, { attrs }) {
    const nodes = computed(() => {
      const template = document.createElement('template');
      template.innerHTML = props.as === 'svg'
        ? `<svg xmlns="http://www.w3.org/2000/svg">${props.html}</svg>` : props.html;
      const root = props.as === 'svg' ? template.content.firstElementChild! : template.content;
      const toNode = (node: Node, index: number): VNodeChild => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (!(node instanceof Element)) return null;
        const attributes: Record<string, string | number> = Object.fromEntries(
          Array.from(node.attributes, attribute => [attribute.name, attribute.value]),
        );
        attributes.key = attributes['data-key'] ?? attributes.id ?? index;
        return h(node.localName, attributes, Array.from(node.childNodes, toNode));
      };
      return Array.from(root.childNodes, toNode);
    });
    return () => props.as ? h(props.as, attrs, nodes.value) : nodes.value;
  },
});
