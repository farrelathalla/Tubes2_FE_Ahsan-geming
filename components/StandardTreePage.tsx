import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { apiConfig } from "@/lib/api-config"; // Adjust import path as needed

// Define props for the TreePage component
interface TreePageProps {
  targetElement: string;
  algorithm: string; // "dfs" or "bfs"
  mode: string; // "shortest" or "multiple"
  limit?: number; // Number of recipes for multiple mode
}

// Define update types
interface ProcessUpdate {
  type: "progress" | "result" | "error";
  element: string;
  path: any;
  complete: boolean;
  stats: {
    nodeCount: number;
    stepCount: number;
    elapsedTime?: number;
    elapsedTimeMs: number;
  };
}
type Recipe = {
  result: string;
  ingredients: string[];
};

// Define the RecipeNode type
interface RecipeNode {
  element: string;
  recipes: RecipeNode[];
}

// D3 node type with position
interface D3Node extends d3.HierarchyNode<RecipeNode> {
  x: number;
  y: number;
}

// Color mapping for basic elements
const elementColors: Record<string, string> = {
  Fire: "#FF5733",
  Water: "#3333FF",
  Earth: "#8B4513",
  Air: "#ADD8E6",
  Time: "#9932CC",
};

// Get color for an element
const getElementColor = (elementName: string): string => {
  // Check predefined colors
  if (elementColors[elementName]) {
    return elementColors[elementName];
  }

  // Generate a color from the element name
  let hash = 0;
  if (!elementName) return "#CCCCCC";

  for (let i = 0; i < elementName.length; i++) {
    hash = elementName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a color from the hash
  const color = `hsl(${hash % 360}, 70%, 50%)`;
  return color;
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

const StandardTreePage: React.FC<TreePageProps> = ({
  targetElement,
  algorithm,
  mode,
  limit = 5,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [treeData, setTreeData] = useState<any>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>("No results yet.");
  const [multipleRecipes, setMultipleRecipes] = useState<any[]>([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState<number>(0);
  const [processingElements, setProcessingElements] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
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

  // Function to create the tree visualization
  const renderTree = (data: any) => {
    if (!svgRef.current || !data) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = getDimensions();
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create the SVG container
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

    // Create the root group with margins
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Convert data to D3 hierarchy
    const root = d3.hierarchy(data, (d) => d.recipes);

    // Count nodes to adjust spacing
    const nodeCount = root.descendants().length;

    // Adjust sizing based on node count
    const nodeSpacing = Math.max(120, 180 - nodeCount * 0.5); // Decrease spacing as nodes increase
    const nodeRadius = Math.max(20, 30 - nodeCount * 0.05); // Decrease node size as nodes increase

    // Create tree layout - use horizontal layout for better space usage
    const treeLayout = d3
      .tree<RecipeNode>()
      .size([innerHeight, innerWidth])
      .nodeSize([nodeSpacing, nodeSpacing * 1.5]) // [vertical, horizontal] spacing between nodes
      .separation((a, b) => {
        // Increase separation between different subtrees
        return a.parent === b.parent ? 1 : 1.5;
      });

    // Apply layout
    treeLayout(root as d3.HierarchyNode<RecipeNode>);

    // Calculate bounds for the tree
    // Calculate bounds for the tree
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    root.each((d) => {
      if (typeof d.x === "number" && typeof d.y === "number") {
        minX = Math.min(minX, d.x);
        maxX = Math.max(maxX, d.x);
        minY = Math.min(minY, d.y);
        maxY = Math.max(maxY, d.y);
      }
    });

    // Center the tree
    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;

    // Add links with animation
    const linksGroup = g.append("g").attr("class", "links");

    linksGroup
      .selectAll("path")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr(
        "d",
        d3
          .linkHorizontal<
            d3.HierarchyLink<RecipeNode>,
            d3.HierarchyPointLink<RecipeNode>
          >()
          .x((d: any) => d.y)
          .y((d: any) => d.x)
      )
      .style("opacity", 0)
      .transition()
      .duration(500)
      .delay((_, i) => i * 50)
      .style("opacity", 1);

    // Add nodes with animation
    const nodesGroup = g.append("g").attr("class", "nodes");

    const nodeGroups = nodesGroup
      .selectAll("g")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`)
      .style("opacity", 0)
      .transition()
      .duration(500)
      .delay((_, i) => i * 50)
      .style("opacity", 1);

    // Add node circles and backgrounds
    nodesGroup
      .selectAll("g")
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d: any) => {
        // Highlight processing elements
        if (processingElements.includes(d.data.element)) {
          return "#FFC107"; // Amber color for processing
        }
        return getElementColor(d.data.element);
      })
      .attr("stroke", "#333")
      .attr("stroke-width", 2);

    // Add element icons
    nodesGroup
      .selectAll("g")
      .append("image")
      .attr("x", -nodeRadius * 0.7)
      .attr("y", -nodeRadius * 0.7)
      .attr("width", nodeRadius * 1.4)
      .attr("height", nodeRadius * 1.4)
      .attr("xlink:href", (d: any) => getElementImagePath(d.data.element))
      .on("error", function () {
        // If image fails to load, remove it
        d3.select(this).remove();
      });

    // Add text labels below nodes
    nodesGroup
      .selectAll("g")
      .append("text")
      .attr("dy", nodeRadius + 12)
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .text((d: any) => d.data.element)
      .each(function (d) {
        // Add background rectangle for text
        const bbox = (this as SVGTextElement).getBBox();
        const parentElement = (this as SVGTextElement).parentElement;
        if (parentElement) {
          d3.select(parentElement)
            .insert("rect", "text")
            .attr("x", bbox.x - 2)
            .attr("y", bbox.y - 1)
            .attr("width", bbox.width + 4)
            .attr("height", bbox.height + 2)
            .attr("fill", "white")
            .attr("fill-opacity", 0.8)
            .attr("rx", 2)
            .attr("ry", 2);
        }
      });

    // Add tooltips
    nodesGroup
      .selectAll("g")
      .append("title")
      .text((d: any) => d.data.element);

    // Add interactivity
    nodesGroup
      .selectAll("g")
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", nodeRadius * 1.2);
      })
      .on("mouseout", function () {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", nodeRadius);
      });

    // Auto-center the graph on initial load
    const initialTransform = d3.zoomIdentity
      .translate(width / 2 - centerY, height / 2 - centerX)
      .scale(0.8);

    svg.call((d3.zoom() as any).transform, initialTransform);
  };

  // Connect to WebSocket and start search
  useEffect(() => {
    if (!targetElement) return;

    setTreeData(null);
    setMultipleRecipes([]);
    setCurrentRecipeIndex(0);
    setProcessingElements([targetElement]);
    setLoading(true);
    setStatus(`Searching for ${targetElement}...`);
    setProgress(0);
    setResultText("Searching...");

    // Create WebSocket connection
    const wsUrl = apiConfig.getWebSocketUrl();
    const socket = new WebSocket(`${wsUrl}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("Connected to server. Starting search...");

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
        const data: ProcessUpdate = JSON.parse(event.data);

        if (data.type === "error") {
          setStatus(`Error: ${(data.path as any).error || "Unknown error"}`);
          setLoading(false);
          return;
        }

        if (data.type === "progress") {
          // Update progress display
          setProgress(data.stats.nodeCount);
          setStatus(`Processing... Examining element: ${data.element}`);

          // Debug logging
          console.log("Progress stats:", data.stats);

          setStats({
            nodeCount: data.stats.nodeCount,
            stepCount: data.stats.stepCount,
            elapsedTimeMs: data.stats.elapsedTimeMs || 0,
          });

          // Add current element to processing elements
          if (!processingElements.includes(data.element)) {
            setProcessingElements((prev) => [...prev, data.element]);
          }

          // Update tree data for visualization
          setTreeData(data.path);

          // Display the result as text
          setResultText(JSON.stringify(data.path, null, 2));
        } else if (data.type === "result") {
          // Show final result
          setLoading(false);
          setStatus(
            `Search completed. Found ${
              mode === "multiple" ? (data.path as any).recipeCount || 0 : 1
            } recipe(s).`
          );

          // Debug logging
          console.log("Result stats:", data.stats);

          // Update final stats
          setStats({
            nodeCount: data.stats.nodeCount,
            stepCount: data.stats.stepCount,
            elapsedTimeMs: data.stats.elapsedTimeMs || 0,
          });

          // Clear processing elements
          setProcessingElements([]);

          // Handle multiple recipes
          if (mode === "multiple" && (data.path as any).recipes) {
            setMultipleRecipes((data.path as any).recipes || []);
            setTreeData((data.path as any).recipes[0]);
          } else {
            setTreeData(data.path);
          }

          // Display the result as text
          setResultText(JSON.stringify(data.path, null, 2));
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

  // Render tree whenever data changes
  useEffect(() => {
    if (treeData && viewMode === "tree") {
      renderTree(treeData);
    }
  }, [treeData, processingElements, viewMode]);

  // Handle browser resize
  useEffect(() => {
    const handleResize = () => {
      if (treeData && viewMode === "tree") {
        renderTree(treeData);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [treeData, viewMode]);

  // Switch between recipes in multiple mode
  const handlePreviousRecipe = () => {
    if (multipleRecipes.length > 0 && currentRecipeIndex > 0) {
      const newIndex = currentRecipeIndex - 1;
      setCurrentRecipeIndex(newIndex);
      setTreeData(multipleRecipes[newIndex]);
    }
  };

  const handleNextRecipe = () => {
    if (
      multipleRecipes.length > 0 &&
      currentRecipeIndex < multipleRecipes.length - 1
    ) {
      const newIndex = currentRecipeIndex + 1;
      setCurrentRecipeIndex(newIndex);
      setTreeData(multipleRecipes[newIndex]);
    }
  };

  // Add this debug component to your TreePage.tsx file

  // Debug component to display multipleRecipes data
  const RecipeDebug: React.FC<{ recipes: any[] }> = ({ recipes }) => {
    if (!recipes || recipes.length === 0) return <p>No recipes available</p>;
  };
  return (
    <div className="tree-page">
      <div className="controls flex justify-between items-center mb-4">
        <div className="left-controls flex items-center">
          {/* <button
            onClick={() => {
              if (svgRef.current && viewMode === "tree") {
                // Reset zoom
                d3.select(svgRef.current)
                  .transition()
                  .duration(750)
                  .call(d3.zoom().transform as any, d3.zoomIdentity);
              }
            }}
            className="px-4 py-2 rounded-l-full bg-[#d68921] text-white"
          >
            Reset View
          </button> */}

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
        </div>

        {/* Recipe navigation controls for multiple mode */}
        {multipleRecipes.length > 1 && (
          <div className="right-controls flex items-center">
            <button
              onClick={handlePreviousRecipe}
              disabled={currentRecipeIndex === 0}
              className={`px-4 py-2 rounded-l-full ${
                currentRecipeIndex === 0
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[#d68921] cursor-pointer"
              } text-white`}
            >
              Previous
            </button>

            <span className="px-4 py-2 bg-gray-100">
              Recipe {currentRecipeIndex + 1} of {multipleRecipes.length}
            </span>

            <button
              onClick={handleNextRecipe}
              disabled={currentRecipeIndex === multipleRecipes.length - 1}
              className={`px-4 py-2 rounded-r-full ${
                currentRecipeIndex === multipleRecipes.length - 1
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
        {/* {statu  s} */}
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
        {!treeData && !loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-gray-500">
              No data to display. Start a search to visualize the recipe tree.
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
            <RecipeDisplay data={treeData} />
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
            element.download = `${targetElement}_${algorithm}_${mode}.json`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
          }}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          Download JSON
        </button>
      </div>

      <div className="result-container bg-gray-100 p-4 rounded font-mono text-sm overflow-auto max-h-[300px]">
        {resultText}
      </div> */}

      {/* Legend for basic elements */}
      <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="text-lg font-medium mb-2">Legend</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(elementColors).map(([element, color]) => (
            <div key={element} className="flex items-center">
              <div className="flex items-center">
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
            </div>
          ))}
          <div className="flex items-center">
            <div
              className="w-4 h-4 rounded-full mr-1"
              style={{ backgroundColor: "#FFC107" }}
            ></div>
            <span className="text-sm">Processing</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandardTreePage;
