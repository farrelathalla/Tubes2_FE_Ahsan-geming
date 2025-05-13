import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { apiConfig } from "@/lib/api-config"; // Adjust import path as needed

// Define props for the DFS Tree Page component
interface DFSTreePageProps {
  targetElement: string;
  algorithm: string; // Should be "dfs"
  mode: string; // "shortest" or "multiple"
  limit?: number; // Number of recipes for multiple mode
}

// Define structure for DFS nodes
interface DFSNode {
  element: string;
  depth: number;
  parent: string | null;
  id: string; // Unique identifier for each node instance
}

// Define structure for WebSocket updates
interface DFSUpdate {
  type: "progress" | "result" | "error";
  node?: DFSNode;
  complete: boolean;
  stats: {
    nodeCount: number;
    stepCount: number;
  };
}

// Define recipe structure
type Recipe = {
  result: string;
  ingredients: string[];
};

// Define the RecipeNode type
interface RecipeNode {
  element: string;
  recipes?: RecipeNode[];
}

// Color mapping for basic elements
const elementColors: Record<string, string> = {
  Fire: "#FF5733",
  Water: "#3333FF",
  Earth: "#8B4513",
  Air: "#ADD8E6",
  Time: "#9932CC",
};

// Helper to get color based on depth
const getDepthColor = (depth: number): string => {
  const colors = [
    "#FF0000", // Red for depth 0
    "#FF4500", // Orange for depth 1
    "#FFD700", // Gold for depth 2
    "#32CD32", // Lime for depth 3
    "#00CED1", // Dark Turquoise for depth 4
    "#4169E1", // Royal Blue for depth 5
    "#9932CC", // Dark Violet for depth 6+
  ];

  if (depth < colors.length) {
    return colors[depth];
  }
  // For deeper depths, use a gradient from purple to dark purple
  return `hsl(${270 - (depth - colors.length) * 10}, 70%, ${
    60 - Math.min(30, depth * 2)
  }%)`;
};

// Helper to format image path for an element
const getElementImagePath = (element: string): string => {
  if (!element) return "";
  return `/elements/${element.replace(/\s+/g, "_")}.png`;
};

const RecipeDisplay: React.FC<{ data: RecipeNode }> = ({ data }) => {
  if (!data) return null;

  // Recursive bottom-up recipe extractor
  const extractRecipes = (
    node: RecipeNode,
    visited = new Set<string>()
  ): Recipe[] => {
    const recipes: Recipe[] = [];

    if (!node.recipes || node.recipes.length === 0) return [];

    // Go deeper first
    for (const child of node.recipes) {
      recipes.push(...extractRecipes(child, visited));
    }

    // Add this recipe if not yet seen
    if (!visited.has(node.element)) {
      recipes.push({
        result: node.element,
        ingredients: node.recipes.map((r) => r.element),
      });
      visited.add(node.element);
    }

    return recipes;
  };

  const allRecipes = extractRecipes(data);
  return (
    <div className="recipe-display space-y-4">
      {allRecipes.map((recipe, index) => (
        <div
          key={index}
          className="recipe-row p-2 border-b border-gray-200 flex flex-wrap items-center"
        >
          {recipe.ingredients.map((ingredient, i) => (
            <React.Fragment key={i}>
              <div className="ingredient-item flex flex-col items-center mx-2">
                <div
                  className="element-icon bg-gray-100 p-1 rounded-full overflow-hidden"
                  style={{ width: "40px", height: "40px" }}
                >
                  <img
                    src={getElementImagePath(ingredient)}
                    alt={ingredient}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/elements/placeholder.png";
                    }}
                  />
                </div>
                <span className="text-xs mt-1">{ingredient}</span>
              </div>
              {i < recipe.ingredients.length - 1 && (
                <span className="mx-2 text-gray-500">+</span>
              )}
            </React.Fragment>
          ))}
          <span className="mx-2 text-gray-500">=</span>
          <div className="result-item flex flex-col items-center mx-2">
            <div
              className="element-icon bg-gray-100 p-1 rounded-full overflow-hidden"
              style={{ width: "40px", height: "40px" }}
            >
              <img
                src={getElementImagePath(recipe.result)}
                alt={recipe.result}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/elements/placeholder.png";
                }}
              />
            </div>
            <span className="text-xs mt-1">{recipe.result}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const DFSTreePage: React.FC<DFSTreePageProps> = ({
  targetElement,
  algorithm,
  mode,
  limit = 5,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>("No results yet.");
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");

  // DFS-specific state
  const [dfsNodes, setDfsNodes] = useState<DFSNode[]>([]);
  const [connections, setConnections] = useState<
    { parent: string; child: string }[]
  >([]);
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  // Animation delay in milliseconds - adjust this value to change animation speed
  const ANIMATION_DELAY = 100; // Change this value to make animations faster/slower

  // For multiple results
  const [multipleResults, setMultipleResults] = useState<any[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState<number>(0);

  // Current recipe data
  const [currentRecipe, setCurrentRecipe] = useState<RecipeNode | null>(null);
  const [stats, setStats] = useState<{
    nodeCount: number;
    stepCount: number;
    elapsedTimeMs: number;
  } | null>(null);

  // Get dimensions of the SVG container
  const getDimensions = () => {
    if (!svgRef.current) return { width: 800, height: 600 };
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    return { width, height };
  };

  // Create hierarchical layout for DFS tree
  const createDFSLayout = (nodes: DFSNode[]) => {
    if (nodes.length === 0) return { nodes: [], links: [] };

    // Group nodes by depth
    const nodesByDepth: { [depth: number]: DFSNode[] } = {};
    nodes.forEach((node) => {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }
      nodesByDepth[node.depth].push(node);
    });

    const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number));
    const { width, height } = getDimensions();
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate minimum spacing to prevent overlap
    const nodeRadius = 20;
    const minSpacing = nodeRadius * 3; // Minimum spacing between nodes

    // Position nodes
    const positionedNodes = nodes.map((node) => {
      const depthNodes = nodesByDepth[node.depth];
      const nodeIndex = depthNodes.indexOf(node);
      const totalNodesAtDepth = depthNodes.length;

      // Calculate required width for all nodes at this depth
      const requiredWidth = totalNodesAtDepth * minSpacing;
      const availableWidth = Math.max(innerWidth, requiredWidth);

      // X position: spread nodes at each depth evenly with minimum spacing
      let x;
      if (totalNodesAtDepth === 1) {
        x = innerWidth / 2;
      } else {
        // Use the full available width but respect minimum spacing
        const actualSpacing = Math.max(
          minSpacing,
          availableWidth / totalNodesAtDepth
        );
        x =
          nodeIndex * actualSpacing +
          actualSpacing / 2 -
          availableWidth / 2 +
          innerWidth / 2;
      }

      // Y position: based on depth
      const y = (node.depth / Math.max(maxDepth, 1)) * innerHeight;

      return {
        ...node,
        x: x + margin.left,
        y: y + margin.top,
      };
    });

    // Create links from parent-child relationships
    const links = connections
      .map((conn) => {
        const parentNode = positionedNodes.find((n) => n.id === conn.parent);
        const childNode = positionedNodes.find((n) => n.id === conn.child);

        if (parentNode && childNode) {
          return {
            source: parentNode,
            target: childNode,
          };
        }
        return null;
      })
      .filter((link) => link !== null);

    return { nodes: positionedNodes, links };
  };

  // Render DFS visualization
  const renderDFSVisualization = () => {
    if (!svgRef.current || dfsNodes.length === 0) return;

    const { width, height } = getDimensions();
    const { nodes, links } = createDFSLayout(dfsNodes);

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .call(
        d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
          g.attr("transform", event.transform);
        }) as any
      );

    const g = svg.append("g");

    // Add links with animation
    const linkGroup = g.append("g").attr("class", "links");

    linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0)
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y)
      .transition()
      .duration(300)
      .delay((d: any, i: number) => {
        // Delay based on when the child node was added
        const childIndex = dfsNodes.findIndex((n) => n.id === d.target.id);
        return childIndex * ANIMATION_DELAY;
      })
      .attr("stroke-opacity", 0.6);

    // Add nodes with delayed animation
    const nodeGroup = g.append("g").attr("class", "nodes");

    const nodeEnter = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .style("opacity", 0);

    // Add circles for nodes
    nodeEnter
      .append("circle")
      .attr("r", 20)
      .attr("fill", (d: any) => {
        // Special colors for basic elements
        if (elementColors[d.element]) {
          return elementColors[d.element];
        }
        // Color based on depth for other elements
        return getDepthColor(d.depth);
      })
      .attr("stroke", "#333")
      .attr("stroke-width", 2);

    // Add element icons
    nodeEnter
      .append("image")
      .attr("width", 28)
      .attr("height", 28)
      .attr("x", -14)
      .attr("y", -14)
      .attr("xlink:href", (d: any) => getElementImagePath(d.element))
      .on("error", function () {
        d3.select(this).remove();
      });

    // Add labels
    nodeEnter
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 35)
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text((d: any) => d.element);

    // Add depth labels
    nodeEnter
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", -30)
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .text((d: any) => `Depth: ${d.depth}`);

    // Animate node appearance
    nodeEnter
      .transition()
      .duration(300)
      .delay((d: any, i: number) => i * ANIMATION_DELAY)
      .style("opacity", 1);

    // Highlight current path
    if (currentPath.length > 0) {
      const pathIds = new Set(currentPath);
      nodeEnter
        .selectAll("circle")
        .style("stroke", (d: any) => (pathIds.has(d.id) ? "#FFD700" : "#333"))
        .style("stroke-width", (d: any) => (pathIds.has(d.id) ? 4 : 2));
    }
  };

  // Process WebSocket messages
  const processDFSData = (data: any) => {
    if (!data) return;

    // Handle single DFS node
    if (data.element !== undefined && data.depth !== undefined) {
      const newNode: DFSNode = {
        element: data.element,
        depth: data.depth,
        parent: data.parent,
        id: `${data.element}_${data.depth}_${Date.now()}_${Math.random()}`,
      };

      // Update nodes and connections
      setDfsNodes((prev) => {
        // Check for duplicate elements at the same depth with the same parent
        const existing = prev.find(
          (n) =>
            n.element === data.element &&
            n.depth === data.depth &&
            n.parent === data.parent
        );

        if (existing) return prev; // Skip duplicates

        const updated = [...prev, newNode];

        // Add connection if this node has a parent
        if (data.parent !== null) {
          const parentNode = prev.find(
            (n) => n.element === data.parent && n.depth === data.depth - 1
          );
          if (parentNode) {
            setConnections((prevConn) => {
              // Check if connection already exists
              const connectionExists = prevConn.some(
                (conn) =>
                  conn.parent === parentNode.id && conn.child === newNode.id
              );
              if (!connectionExists) {
                return [
                  ...prevConn,
                  { parent: parentNode.id, child: newNode.id },
                ];
              }
              return prevConn;
            });
          }
        }

        // Update current path (all nodes from root to current)
        const pathNodes = updated.filter((node) => {
          let current: DFSNode | null = newNode;
          while (current && current.parent !== null) {
            if (
              current.element === node.element &&
              current.depth === node.depth
            ) {
              return true;
            }
            current =
              updated.find(
                (n) =>
                  n.element === current!.parent &&
                  n.depth === current!.depth - 1
              ) || null;
          }
          return (
            current &&
            current.element === node.element &&
            current.depth === node.depth
          );
        });

        setCurrentPath(pathNodes.map((n) => n.id));
        return updated;
      });

      setVisitedNodes((prev) => new Set([...prev, data.element]));
    }
  };

  // Process recipe tree into DFS nodes
  const processRecipeTree = (recipeTree: any) => {
    if (!recipeTree) return;

    // Clear existing data
    setDfsNodes([]);
    setConnections([]);
    setCurrentPath([]);

    // Convert the tree structure to DFS nodes with deduplication
    const dfsNodes: DFSNode[] = [];
    const elementTracker = new Map<
      string,
      { node: DFSNode; parents: Set<string> }
    >();

    const traverseDFS = (
      node: any,
      depth: number,
      parent: string | null,
      visited = new Set<string>()
    ) => {
      if (!node || !node.element) return;

      // Create unique identifier for this position in the tree
      const nodeKey = `${node.element}_${depth}_${parent || "root"}`;

      // Check if we've already seen this exact node configuration
      if (visited.has(nodeKey)) return;
      visited.add(nodeKey);

      const nodeData: DFSNode = {
        element: node.element,
        depth: depth,
        parent: parent,
        id: `${node.element}_${depth}_${Date.now()}_${Math.random()}`,
      };

      // Check if we've seen this element at this depth before
      const elementKey = `${node.element}_${depth}`;
      if (elementTracker.has(elementKey)) {
        const existing = elementTracker.get(elementKey)!;
        // Add this parent to the existing node's parent set
        if (parent) {
          existing.parents.add(parent);
        }
        // Use the existing node instead of creating a duplicate
        return existing.node;
      } else {
        // New element at this depth
        elementTracker.set(elementKey, {
          node: nodeData,
          parents: new Set(parent ? [parent] : []),
        });
      }

      dfsNodes.push(nodeData);

      // Process recipes (children) recursively
      if (node.recipes && Array.isArray(node.recipes)) {
        node.recipes.forEach((recipe: any) => {
          traverseDFS(recipe, depth + 1, node.element, new Set(visited));
        });
      }

      return nodeData;
    };

    // Start traversal from the root
    traverseDFS(recipeTree, 0, null);

    // Process all nodes with delays
    dfsNodes.forEach((node, index) => {
      setTimeout(() => {
        processDFSData(node);
      }, index * ANIMATION_DELAY);
    });
  };

  // Connect to WebSocket and start search
  useEffect(() => {
    if (!targetElement) return;

    // Reset state
    setDfsNodes([]);
    setConnections([]);
    setVisitedNodes(new Set());
    setCurrentPath([]);
    setLoading(true);
    setStatus(`Searching for ${targetElement} using DFS...`);
    setProgress(0);
    setResultText("Searching...");
    setMultipleResults([]);
    setCurrentResultIndex(0);
    setStats(null);
    // Create WebSocket connection
    // const socket = new WebSocket("ws://localhost:8080/ws");
    const wsUrl = apiConfig.getWebSocketUrl();
    const socket = new WebSocket(`${wsUrl}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("Connected to server. Starting DFS search...");

      // Send search request
      socket.send(
        JSON.stringify({
          target: targetElement,
          algorithm: algorithm,
          mode: mode,
          limit: limit,
        })
      );
    };

    socket.onclose = () => {
      setStatus("Disconnected from server.");
      setLoading(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Error connecting to server.");
      setLoading(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data);
        if (data.type === "error") {
          setStatus(`Error: ${data.message || "Unknown error"}`);
          setLoading(false);
          return;
        }

        if (data.type === "progress") {
          // Process DFS progress - check if we have individual node data
          setProgress(data.stats.nodeCount);

          // Update stats from progress
          setStats({
            nodeCount: data.stats.nodeCount,
            stepCount: data.stats.stepCount,
            elapsedTimeMs: data.stats.elapsedTimeMs || 0,
          });

          if (data.node) {
            // Individual node progress
            setStatus(
              `DFS exploring... Current: ${data.node.element} (depth ${data.node.depth})`
            );

            // Add delay before processing to show the search progression
            setTimeout(() => {
              processDFSData(data.node);
            }, ANIMATION_DELAY);

            setResultText(JSON.stringify(data.node, null, 2));
          } else {
            // Generic progress update
            setStatus(`DFS exploring... ${data.stats.nodeCount} nodes visited`);
          }
        } else if (data.type === "result") {
          setLoading(false);
          setStatus(`DFS completed. Found path to ${targetElement}.`);
          setResultText(JSON.stringify(data, null, 2));

          // Update final stats
          setStats({
            nodeCount: data.stats.nodeCount,
            stepCount: data.stats.stepCount,
            elapsedTimeMs: data.stats.elapsedTimeMs || 0,
          });

          // For result type, we need to process the path tree structure
          if (data.path) {
            // Check if it's multiple mode with multiple recipes
            if (
              mode === "multiple" &&
              data.path.recipes &&
              Array.isArray(data.path.recipes)
            ) {
              setMultipleResults(data.path.recipes);
              setCurrentResultIndex(0);
              setCurrentRecipe(data.path.recipes[0]);

              // Process first recipe
              processRecipeTree(data.path.recipes[0]);
            } else {
              // Single recipe
              setMultipleResults([data.path]);
              setCurrentResultIndex(0);
              setCurrentRecipe(data.path);

              // Process single recipe
              processRecipeTree(data.path);
            }
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
        setStatus("Error processing server message.");
        setLoading(false);
      }
    };

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        try {
          if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.close();
          }
          socketRef.current = null;
        } catch (error) {
          console.error("Error closing WebSocket:", error);
        }
      }
    };
  }, [targetElement, algorithm, mode, limit]);

  // Handle recipe navigation for multiple mode
  const handlePreviousRecipe = () => {
    if (multipleResults.length > 0 && currentResultIndex > 0) {
      const newIndex = currentResultIndex - 1;
      setCurrentResultIndex(newIndex);
      setCurrentRecipe(multipleResults[newIndex]);
      processRecipeTree(multipleResults[newIndex]);
    }
  };

  const handleNextRecipe = () => {
    if (
      multipleResults.length > 0 &&
      currentResultIndex < multipleResults.length - 1
    ) {
      const newIndex = currentResultIndex + 1;
      setCurrentResultIndex(newIndex);
      setCurrentRecipe(multipleResults[newIndex]);
      processRecipeTree(multipleResults[newIndex]);
    }
  };

  // Render visualization whenever data changes
  useEffect(() => {
    if (viewMode === "tree") {
      renderDFSVisualization();
    }
  }, [dfsNodes, connections, viewMode, currentPath]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (viewMode === "tree") {
        renderDFSVisualization();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [dfsNodes, viewMode]);

  return (
    <div className="dfs-tree-page">
      <div className="controls flex justify-between items-center mb-4">
        <div className="left-controls flex items-center">
          <button
            onClick={() => {
              if (svgRef.current && viewMode === "tree") {
                // Reset zoom
                d3.select(svgRef.current)
                  .transition()
                  .duration(750)
                  .call((d3.zoom() as any).transform, d3.zoomIdentity);
              }
            }}
            className="px-4 py-2 rounded bg-[#d68921] text-white"
          >
            Reset View
          </button>

          <div className="view-toggle flex ml-4">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-4 py-2 rounded-l-full ${
                viewMode === "tree"
                  ? "bg-[#d68921] text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-r-full ${
                viewMode === "list"
                  ? "bg-[#d68921] text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              List View
            </button>
          </div>

          <div className="animation-speed-control flex items-center ml-4">
            <span className="text-sm text-gray-500">
              {/* Animation speed: {ANIMATION_DELAY}ms */}
              {/* Adjust ANIMATION_DELAY constant to change animation speed */}
            </span>
          </div>

          {/* <span className="text-sm text-gray-500 ml-4">
            {viewMode === "tree" && "Tip: Use mouse wheel to zoom, drag to pan"}
          </span> */}
        </div>

        {/* Recipe navigation controls for multiple mode */}
        {multipleResults.length > 1 && (
          <div className="right-controls flex items-center">
            <button
              onClick={handlePreviousRecipe}
              disabled={currentResultIndex === 0}
              className={`px-4 py-2 rounded-l-full ${
                currentResultIndex === 0
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[#d68921] cursor-pointer"
              } text-white`}
            >
              Previous
            </button>

            <span className="px-4 py-2 bg-gray-100 text-black font-bold">
              Recipe {currentResultIndex + 1} of {multipleResults.length}
            </span>

            <button
              onClick={handleNextRecipe}
              disabled={currentResultIndex === multipleResults.length - 1}
              className={`px-4 py-2 rounded-r-full ${
                currentResultIndex === multipleResults.length - 1
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[#d68921] cursor-pointer"
              } text-white`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="status my-2 p-2 bg-gray-100 rounded">
        {/* {status} */}
        {loading && (
          <div className="loading mt-2">
            <p>Processing... {progress} nodes visited</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${Math.min(100, progress / 2)}%` }}
              ></div>
            </div>
          </div>
        )}
        {stats && (
          <div className="stats mt-2 text-sm text-gray-600 mb-2">
            <div>Nodes visited: {stats.nodeCount}</div>
            <div>
              Time elapsed:{" "}
              {stats.elapsedTimeMs !== undefined
                ? stats.elapsedTimeMs
                : "0.000"}{" "}
              milliseconds
            </div>
          </div>
        )}
      </div>

      <div className="visualization-container relative border border-gray-300 rounded mb-4 bg-white overflow-hidden">
        {dfsNodes.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-gray-500">
              No data to display. Start a DFS search to visualize the
              depth-first exploration.
            </p>
          </div>
        ) : viewMode === "tree" ? (
          <div className="w-full h-[600px]">
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ cursor: "grab" }}
            ></svg>
          </div>
        ) : (
          <div className="p-4 overflow-auto max-h-[600px]">
            <h3 className="text-xl mb-4">Recipe Steps</h3>
            {currentRecipe && <RecipeDisplay data={currentRecipe} />}
          </div>
        )}
      </div>

      {/* <div className="flex justify-between items-center mb-2">
        <div className="text-xl">Raw JSON Result:</div>
        <button
          onClick={() => {
            const element = document.createElement("a");
            const file = new Blob([resultText], { type: "application/json" });
            element.href = URL.createObjectURL(file);
            element.download = `${targetElement}_dfs_${mode}.json`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
          }}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          Download JSON
        </button>
      </div> */}

      {/* <div className="result-container bg-gray-100 p-4 rounded font-mono text-sm overflow-auto max-h-[300px]">
        {resultText}
      </div> */}

      {/* DFS statistics */}
      {/* <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="text-lg font-medium mb-2">DFS Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-medium">Total Nodes in Tree:</p>
            <p className="text-sm">{dfsNodes.length} nodes</p>
          </div>
          <div>
            <p className="font-medium">Max Depth Reached:</p>
            <p className="text-sm">
              {dfsNodes.length > 0
                ? Math.max(...dfsNodes.map((n) => n.depth))
                : 0}
            </p>
          </div>
          <div>
            <p className="font-medium">Recipe Count:</p>
            <p className="text-sm">
              {mode === "multiple"
                ? `${multipleResults.length} recipes`
                : "1 recipe"}
            </p>
          </div>
        </div>
      </div> */}

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200 text-black font-bold">
        <h3 className="text-lg mb-2">Legend</h3>
        <div className="flex flex-wrap gap-3">
          {/* Basic elements */}
          {Object.entries(elementColors).map(([element, color]) => (
            <div key={element} className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-1"
                style={{ backgroundColor: color }}
              ></div>
              <div className="w-5 h-5 mr-1">
                <img
                  src={getElementImagePath(element)}
                  alt={element}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/elements/placeholder.png";
                  }}
                />
              </div>
              <span className="text-sm">{element}</span>
            </div>
          ))}

          {/* Depth colors */}
          <div className="flex items-center ml-4">
            <span className="text-sm mr-2">Depth Colors:</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((depth) => (
                <div
                  key={depth}
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getDepthColor(depth) }}
                  title={`Depth ${depth}`}
                ></div>
              ))}
            </div>
          </div>

          {/* Current path indicator */}
          <div className="flex items-center ml-4">
            <div
              className="w-4 h-4 rounded mr-1 border-2"
              style={{ borderColor: "#FFD700" }}
            ></div>
            <span className="text-sm">Current Path</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DFSTreePage;
