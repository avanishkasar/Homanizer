export function getTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.trim()) nodes.push(node);
  }
  return nodes;
}

export function highlightElement(el: Element, color = "#fef3c7"): void {
  (el as HTMLElement).style.backgroundColor = color;
  (el as HTMLElement).style.transition = "background-color 0.3s ease";
}
