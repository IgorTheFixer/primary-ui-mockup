import { Node, Edge } from "reactflow";

import {
  NEW_TREE_X_OFFSET,
  OVERLAP_RANDOMNESS_MAX,
  STALE_STREAM_ERROR_MESSAGE,
  STREAM_CANCELED_ERROR_MESSAGE,
} from "./constants";
import { StaveNodeType, StaveNodeData, ReactFlowNodeTypes } from "./types";
import { getStaveNodeTypeColor } from "./color";
import { generateNodeId } from "./nodeId";
import { formatAutoLabel } from "./prompt";

/*//////////////////////////////////////////////////////////////
                         CONSTRUCTORS
//////////////////////////////////////////////////////////////*/

export function newStaveNode({
  id,
  x,
  y,
  staveNodeType,
  text,
  streamId,
}: {
  id?: string;
  x: number;
  y: number;
  staveNodeType: StaveNodeType;
  text: string;
  streamId?: string;
}): Node<StaveNodeData> {
  return {
    id: id ?? generateNodeId(),
    position: { x, y },
    style: {
      background: getStaveNodeTypeColor(staveNodeType),
    },
    data: {
      label: displayNameFromStaveNodeType(staveNodeType),
      staveNodeType,
      text,
      streamId,
    },
  };
}

/*//////////////////////////////////////////////////////////////
                         TRANSFORMERS
//////////////////////////////////////////////////////////////*/

export function addStaveNode(
  existingNodes: Node<StaveNodeData>[],
  {
    id,
    x,
    y,
    staveNodeType,
    text,
    streamId,
  }: {
    id?: string;
    x: number;
    y: number;
    staveNodeType: StaveNodeType;
    text: string;
    streamId?: string;
  }
): Node<StaveNodeData>[] {
  const newNode = newStaveNode({ x, y, staveNodeType, text, id, streamId });

  return [...existingNodes, newNode];
}

export function addUserNodeLinkedToASystemNode(
  nodes: Node<StaveNodeData>[],
  systemNodeText: string,
  userNodeText: string | null = "",
  systemId: string = generateNodeId(),
  userId: string = generateNodeId()
) {
  const nodesCopy = [...nodes];

  const systemNode = newStaveNode({
    id: systemId,
    x:
      nodesCopy.length > 0
        ? nodesCopy.reduce((prev, current) =>
            prev.position.x > current.position.x ? prev : current
          ).position.x + NEW_TREE_X_OFFSET
        : window.innerWidth / 2 / 2 - 75,
    y: 500,
    staveNodeType: StaveNodeType.System,
    text: systemNodeText,
  });

  nodesCopy.push(systemNode);

  nodesCopy.push(
    newStaveNode({
      id: userId,
      x: systemNode.position.x,
      // Add OVERLAP_RANDOMNESS_MAX of randomness to
      // the y position so that nodes don't overlap.
      y: systemNode.position.y + 100 + Math.random() * OVERLAP_RANDOMNESS_MAX,
      staveNodeType: StaveNodeType.User,
      text: userNodeText ?? "",
    })
  );

  return nodesCopy;
}

export function modifyReactFlowNodeProperties(
  existingNodes: Node<StaveNodeData>[],
  {
    id,
    type,
    draggable,
  }: { id: string; type: ReactFlowNodeTypes | undefined; draggable: boolean }
): Node<StaveNodeData>[] {
  return existingNodes.map((node) => {
    if (node.id !== id) return node;

    const copy = { ...node, data: { ...node.data }, type, draggable };

    return copy;
  });
}

export function modifyStaveNodeText(
  existingNodes: Node<StaveNodeData>[],
  { asHuman, id, text }: { asHuman: boolean; id: string; text: string }
): Node<StaveNodeData>[] {
  return existingNodes.map((node) => {
    if (node.id !== id) return node;

    const copy = { ...node, data: { ...node.data } };

    copy.data.text = text;

    // If the node's StaveNodeType is GPT and we're changing
    // it as a human then its type becomes GPT + Human.
    if (asHuman && copy.data.staveNodeType === StaveNodeType.GPT) {
      copy.style = {
        ...copy.style,
        background: getStaveNodeTypeColor(StaveNodeType.TweakedGPT),
      };

      copy.data.staveNodeType = StaveNodeType.TweakedGPT;
    }

    // Generate auto label based on prompt text, and preserve custom label
    if (!copy.data.hasCustomlabel) {
      copy.data.label = copy.data.text
        ? formatAutoLabel(copy.data.text)
        : displayNameFromStaveNodeType(copy.data.staveNodeType);
    }

    return copy;
  });
}

export function modifyStaveNodeLabel(
  existingNodes: Node<StaveNodeData>[],
  { id, type, label }: { id: string; type?: StaveNodeType; label: string }
): Node<StaveNodeData>[] {
  return existingNodes.map((node) => {
    if (node.id !== id) return node;

    const copy = {
      ...node,
      data: { ...node.data, label, hasCustomlabel: true },
      type,
      draggable: undefined,
    };

    return copy;
  });
}

export function setStaveNodeStreamId(
  existingNodes: Node<StaveNodeData>[],
  { id, streamId }: { id: string; streamId: string | undefined }
) {
  return existingNodes.map((node) => {
    if (node.id !== id) return node;

    return { ...node, data: { ...node.data, streamId } };
  });
}

export function appendTextToStaveNodeAsGPT(
  existingNodes: Node<StaveNodeData>[],
  { id, text, streamId }: { id: string; text: string; streamId: string }
): Node<StaveNodeData>[] {
  return existingNodes.map((node) => {
    if (node.id !== id) return node;

    // If the node's streamId is now undefined, the stream has been canceled.
    if (node.data.streamId === undefined) throw new Error(STREAM_CANCELED_ERROR_MESSAGE);

    // If the node's streamId is not undefined but does
    // not match the provided id, the stream is now stale.
    if (node.data.streamId !== streamId) throw new Error(STALE_STREAM_ERROR_MESSAGE);

    const copy = { ...node, data: { ...node.data } };

    const isFirstToken = copy.data.text.length === 0;

    copy.data.text += text;

    // Preserve custom labels
    if (copy.data.hasCustomlabel) return copy;

    // If label hasn't reached max length or it's a new prompt, set from text.
    // Once label reaches max length, truncate it.
    if (!copy.data.label.endsWith(" ...") || isFirstToken) {
      copy.data.label = formatAutoLabel(copy.data.text);
    }

    return copy;
  });
}

export function deleteStaveNode(
  existingNodes: Node<StaveNodeData>[],
  id: string
): Node<StaveNodeData>[] {
  return existingNodes.filter((node) => node.id !== id);
}

export function deleteSelectedStaveNodes(
  existingNodes: Node<StaveNodeData>[]
): Node<StaveNodeData>[] {
  return existingNodes.filter((node) => !node.selected);
}

export function markOnlyNodeAsSelected(
  existingNodes: Node<StaveNodeData>[],
  id: string
): Node<StaveNodeData>[] {
  return existingNodes.map((node) => {
    return { ...node, selected: node.id === id };
  });
}

/*//////////////////////////////////////////////////////////////
                            GETTERS
//////////////////////////////////////////////////////////////*/

export function getStaveNode(
  nodes: Node<StaveNodeData>[],
  id: string
): Node<StaveNodeData> | undefined {
  return nodes.find((node) => node.id === id);
}

export function getStaveNodeGPTChildren(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  id: string
): Node<StaveNodeData>[] {
  return existingNodes.filter(
    (node) =>
      (node.data.staveNodeType === StaveNodeType.GPT ||
        node.data.staveNodeType === StaveNodeType.TweakedGPT) &&
      getStaveNodeParent(existingNodes, existingEdges, node.id)?.id === id
  );
}

export function getStaveNodeChildren(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  id: string
) {
  return existingNodes.filter(
    (node) => getStaveNodeParent(existingNodes, existingEdges, node.id)?.id === id
  );
}

export function getStaveNodeSiblings(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  id: string
): Node<StaveNodeData>[] {
  const parent = getStaveNodeParent(existingNodes, existingEdges, id);

  if (!parent) return [];

  return getStaveNodeChildren(existingNodes, existingEdges, parent.id);
}

export function getStaveNodeParent(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  id: string
): Node<StaveNodeData> | undefined {
  let edge: Edge | undefined;

  // We iterate in reverse to ensure we don't try to route
  // through a stale (now hidden) edge to find the parent.
  for (let i = existingEdges.length - 1; i >= 0; i--) {
    const e = existingEdges[i];

    if (e.target === id) {
      edge = e;
      break;
    }
  }

  if (!edge) return;

  return existingNodes.find((node) => node.id === edge!.source);
}

// Get the lineage of the node,
// where index 0 is the node,
// index 1 is the node's parent,
// index 2 is the node's grandparent, etc.
// TODO: Eventually would be nice to have
// support for connecting multiple parents!
export function getStaveNodeLineage(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  id: string
): Node<StaveNodeData>[] {
  const lineage: Node<StaveNodeData>[] = [];

  let currentNode = getStaveNode(existingNodes, id);

  while (currentNode) {
    lineage.push(currentNode);

    currentNode = getStaveNodeParent(existingNodes, existingEdges, currentNode.id);
  }

  return lineage;
}

export function isStaveNodeInLineage(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  { nodeToCheck, nodeToGetLineageOf }: { nodeToCheck: string; nodeToGetLineageOf: string }
): boolean {
  const lineage = getStaveNodeLineage(existingNodes, existingEdges, nodeToGetLineageOf);

  return lineage.some((node) => node.id === nodeToCheck);
}

export function getConnectionAllowed(
  existingNodes: Node<StaveNodeData>[],
  existingEdges: Edge[],
  { source, target }: { source: string; target: string }
): boolean {
  return (
    // Check the lineage of the source node to make
    // sure we aren't creating a recursive connection.
    !isStaveNodeInLineage(existingNodes, existingEdges, {
      nodeToCheck: target,
      nodeToGetLineageOf: source,
      // Check if the target node already has a parent.
    }) && getStaveNodeParent(existingNodes, existingEdges, target) === undefined
  );
}

/*//////////////////////////////////////////////////////////////
                            RENDERERS
//////////////////////////////////////////////////////////////*/

export function displayNameFromStaveNodeType(
  staveNodeType: StaveNodeType,
  isGPT4?: boolean
): string {
  switch (staveNodeType) {
    case StaveNodeType.User:
      return "User";
    case StaveNodeType.GPT:
      return isGPT4 === undefined ? "GPT" : isGPT4 ? "GPT-4" : "GPT-3.5";
    case StaveNodeType.TweakedGPT:
      return displayNameFromStaveNodeType(StaveNodeType.GPT, isGPT4) + " (edited)";
    case StaveNodeType.System:
      return "System";
  }
}