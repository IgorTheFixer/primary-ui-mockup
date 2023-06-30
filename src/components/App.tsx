import { useEffect, useState, useCallback, useRef } from "react";
import {
  StaveNodeData,
  StaveNodeType,
  HistoryItem,
  Settings,
  CreateChatCompletionStreamResponseChoicesInner,
  ReactFlowNodeTypes,
} from "../utils/types";
import { NavBar } from "./utils/NavBar";
import { Column, Row } from "../utils/chakra";
import { Resizable } from "re-resizable";
import { useLocalStorage } from "../utils/lstore";
import {
  API_KEY_LOCAL_STORAGE_KEY,
  DEFAULT_SETTINGS,
  FIT_VIEW_SETTINGS,
  HOTKEY_CONFIG,
  MAX_HISTORY_SIZE,
  MODEL_SETTINGS_LOCAL_STORAGE_KEY,
  NEW_TREE_CONTENT_QUERY_PARAM,
  OVERLAP_RANDOMNESS_MAX,
  REACT_FLOW_NODE_TYPES,
  REACT_FLOW_LOCAL_STORAGE_KEY,
  TOAST_CONFIG,
  UNDEFINED_RESPONSE_STRING,
  STREAM_CANCELED_ERROR_MESSAGE,
  SAVED_CHAT_SIZE_LOCAL_STORAGE_KEY,
} from "../utils/constants";

function App() {

  const [past, setPast] = useState<HistoryItem[]>([]);
  const [future, setFuture] = useState<HistoryItem[]>([]);

  const takeSnapshot = () => {
    // Push the current graph to the past state.
    setPast((past) => [
      ...past.slice(past.length - MAX_HISTORY_SIZE + 1, past.length),
      { nodes, edges, selectedNodeId, lastSelectedNodeId },
    ]);

    // Whenever we take a new snapshot, the redo operations
    // need to be cleared to avoid state mismatches.
    setFuture([]);
  };

  // const autoZoom = () => setTimeout(() => fitView(FIT_VIEW_SETTINGS), 50);
  
  // const autoZoomIfNecessary = () => {
  //   if (settings.autoZoom) autoZoom();
  // };

    /*//////////////////////////////////////////////////////////////
                        NODE MUTATION CALLBACKS
  //////////////////////////////////////////////////////////////*/

  const newUserNodeLinkedToANewSystemNode = (
    text: string | null = "",
    forceAutoZoom: boolean = true
  ) => {
    takeSnapshot();

    const systemId = generateNodeId();
    const userId = generateNodeId();

    selectNode(userId, (nodes) =>
      addUserNodeLinkedToASystemNode(
        nodes,
        settings.defaultPreamble,
        text,
        systemId,
        userId
      )
    );

    setEdges((edges) =>
      addFluxEdge(edges, {
        source: systemId,
        target: userId,
        animated: false,
      })
    );

    if (forceAutoZoom) autoZoom();

    if (MIXPANEL_TOKEN) mixpanel.track("New conversation tree created");
  };

  const newConnectedToSelectedNode = (type: FluxNodeType) => {
    const selectedNode = getFluxNode(nodes, selectedNodeId!);

    if (selectedNode) {
      takeSnapshot();

      const selectedNodeChildren = getFluxNodeChildren(nodes, edges, selectedNodeId!);

      const id = generateNodeId();

      selectNode(id, (nodes) =>
        addFluxNode(nodes, {
          id,
          x:
            selectedNodeChildren.length > 0
              ? // If there are already children we want to put the
                // next child to the right of the furthest right one.
                selectedNodeChildren.reduce((prev, current) =>
                  prev.position.x > current.position.x ? prev : current
                ).position.x + 180
              : selectedNode.position.x,
          // Add OVERLAP_RANDOMNESS_MAX of randomness to
          // the y position so that nodes don't overlap.
          y: selectedNode.position.y + 100 + Math.random() * OVERLAP_RANDOMNESS_MAX,
          fluxNodeType: type,
          text: "",
        })
      );

      setEdges((edges) =>
        addFluxEdge(edges, {
          source: selectedNodeId!,
          target: id,
          animated: false,
        })
      );

      autoZoomIfNecessary();

      if (type === FluxNodeType.User) {
        if (MIXPANEL_TOKEN) mixpanel.track("New user node created");
      } else {
        if (MIXPANEL_TOKEN) mixpanel.track("New system node created");
      }
    }
  };

  const deleteSelectedNodes = () => {
    takeSnapshot();

    const selectedNodes = nodes.filter((node) => node.selected);

    if (
      selectedNodeId && // There's a selected node under the hood.
      (selectedNodes.length === 0 || // There are no selected nodes.
        // There is only one selected node, and it's the selected node.
        (selectedNodes.length === 1 && selectedNodes[0].id === selectedNodeId))
    ) {
      // Try to move to sibling first.
      const hasSibling = moveToRightSibling();

      // If there's no sibling, move to parent.
      if (!hasSibling) moveToParent();

      setNodes((nodes) => deleteFluxNode(nodes, selectedNodeId));
    } else {
      setNodes(deleteSelectedFluxNodes);

      // If any of the selected nodes are the selected node, unselect it.
      if (selectedNodeId && selectedNodes.some((node) => node.id === selectedNodeId)) {
        setLastSelectedNodeId(null);
        setSelectedNodeId(null);
      }
    }

    autoZoomIfNecessary();

    if (MIXPANEL_TOKEN) mixpanel.track("Deleted selected node(s)");
  };

  const onClear = () => {
    if (confirm("Are you sure you want to delete all nodes?")) {
      takeSnapshot();

      setNodes([]);
      setEdges([]);
      setViewport({ x: 0, y: 0, zoom: 1 });

      if (MIXPANEL_TOKEN) mixpanel.track("Deleted everything");
    }
  };

  /*//////////////////////////////////////////////////////////////
                        CHAT RESIZE LOGIC
  //////////////////////////////////////////////////////////////*/

  const [savedChatSize, setSavedChatSize] = useLocalStorage<string>(
    SAVED_CHAT_SIZE_LOCAL_STORAGE_KEY
  );
  return (
    <>
      <Column
        mainAxisAlignment="center"
        crossAxisAlignment="center"
        height="100vh"
        width="100%"
      >
        <Row mainAxisAlignment="flex-start" crossAxisAlignment="stretch" expand>
          <Resizable
            maxWidth="75%"
            minWidth="15%"
            defaultSize={{
              // Defaults to the previously used chat size if it exists.
              width: savedChatSize || "50%",
              height: "auto",
            }}
            enable={{
              top: false,
              right: true,
              bottom: false,
              left: false,
              topRight: false,
              bottomRight: false,
              bottomLeft: false,
              topLeft: false,
            }}
            onResizeStop={(_, __, ref) => {
              setSavedChatSize(ref.style.width);
              // autoZoomIfNecessary();
            }}>
              <Column
                mainAxisAlignment="center"
                crossAxisAlignment="center"
                borderRightColor="#EEEEEE"
                borderRightWidth="1px"
                expand
              >
                <NavBar
                  newUserNodeLinkedToANewSystemNode={() =>
                    newUserNodeLinkedToANewSystemNode()
                  }
                  newConnectedToSelectedNode={newConnectedToSelectedNode}
                  deleteSelectedNodes={deleteSelectedNodes}
                  submitPrompt={() => submitPrompt(false)}
                  regenerate={() => submitPrompt(true)}
                  completeNextWords={completeNextWords}
                  undo={undo}
                  redo={redo}
                  onClear={onClear}
                  copyMessagesToClipboard={copyMessagesToClipboard}
                  showRenameInput={showRenameInput}
                  moveToParent={moveToParent}
                  moveToChild={moveToChild}
                  moveToLeftSibling={moveToLeftSibling}
                  moveToRightSibling={moveToRightSibling}
                  autoZoom={trackedAutoZoom}
                  onOpenSettingsModal={() => {
                    onOpenSettingsModal();
                  }}
                >

                </NavBar>
              </Column>
          </Resizable>
        </Row>
      </Column>
    </>
  )
}

export default App
