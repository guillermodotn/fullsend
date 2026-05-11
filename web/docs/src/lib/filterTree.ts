import type { ManifestNode } from "virtual:fullsend-docs";

export function filterTree(
  nodes: ManifestNode[],
  query: string,
): ManifestNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return pruneNodes(nodes, q);
}

function pruneNodes(nodes: ManifestNode[], q: string): ManifestNode[] {
  const out: ManifestNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.title.toLowerCase().includes(q)) out.push(node);
    } else {
      if (node.name.toLowerCase().includes(q)) {
        out.push(node);
      } else {
        const children = pruneNodes(node.children, q);
        if (children.length > 0) {
          out.push({ type: "dir", name: node.name, children });
        }
      }
    }
  }
  return out;
}
