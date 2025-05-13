// lib/buildFlowData.ts
import { Node, Edge } from "reactflow";

export type ElementNode = {
  element: string;
  recipes: ElementNode[];
};

export const buildFlowData = (root: ElementNode) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let idCounter = 0;

  const traverse = (node: ElementNode, parentId: string | null) => {
    const id = `${idCounter++}`;
    nodes.push({
      id,
      type: "alchemy",
      data: { label: node.element },
      position: { x: Math.random() * 400, y: idCounter * 80 },
    });

    if (parentId) {
      edges.push({
        id: `e${parentId}-${id}`,
        source: parentId,
        target: id,
      });
    }

    node.recipes?.forEach((child) => traverse(child, id));
  };

  traverse(root, null);
  return { nodes, edges };
};
