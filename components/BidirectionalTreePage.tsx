import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { apiConfig } from "@/lib/api-config"; // Adjust import path as needed

// Define props for the TreePage component
interface TreePageProps {
  targetElement: string;
  algorithm: string; // "dfs", "bfs", or "bidirectional"
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

// Color mapping for basic elements
const elementColors: Record<string, string> = {
  Fire: "#FF5733",
  Water: "#3333FF",
  Earth: "#8B4513",
  Air: "#ADD8E6",
  Time: "#9932CC",
};

// Helper to format image path for an element
const getElementImagePath = (element: string): string => {
  if (!element) return "";
  return `/elements/${element.replace(/\s+/g, "_")}.png`;
};

const RecipeDisplay: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;

  // Bottom-up, depth-first recipe extractor
  const extractRecipes = (
    node: any,
    visited = new Set<string>()
  ): { result: string; ingredients: string[] }[] => {
    const recipes: { result: string; ingredients: string[] }[] = [];

    if (!node.recipes || node.recipes.length === 0) return [];

    for (const child of node.recipes) {
      recipes.push(...extractRecipes(child, visited));
    }

    if (!visited.has(node.element)) {
      recipes.push({
        result: node.element,
        ingredients: node.recipes.map((r: any) => r.element),
      });
      visited.add(node.element);
    }

    return recipes;
  };

  const allRecipes = extractRecipes(data);

  if (allRecipes.length === 0) {
    return <p className="text-gray-500">No recipes found in the data.</p>;
  }

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

const BidirectionalTreePage: React.FC<TreePageProps> = ({
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
  const [stats, setStats] = useState<{
    nodeCount: number;
    stepCount: number;
    elapsedTimeMs: number;
  } | null>(null);
  // For bidirectional search visualization
  const [forwardElements, setForwardElements] = useState<Set<string>>(
    new Set(["Water", "Fire", "Earth", "Air"])
  );
  const [backwardElements, setBackwardElements] = useState<Set<string>>(
    new Set([targetElement])
  );
  const [meetingPoints, setMeetingPoints] = useState<Set<string>>(new Set());
  const [elementConnections, setElementConnections] = useState<{
    [key: string]: string[];
  }>({});

  // For animation control
  const [animationSpeed, setAnimationSpeed] = useState<number>(1000); // milliseconds between updates

  // For multiple recipes
  const [multipleRecipes, setMultipleRecipes] = useState<any[]>([]);
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState<number>(0);
  const [currentRecipeData, setCurrentRecipeData] = useState<any>(null);

  // Flag to determine if we're dealing with bidirectional search data or regular recipe tree
  const [hasBidirectionalData, setHasBidirectionalData] =
    useState<boolean>(false);

  // Get dimensions of the SVG container
  const getDimensions = () => {
    if (!svgRef.current) return { width: 800, height: 600 };
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    return { width, height };
  };

  // Function to create a custom bidirectional visualization
  const renderBidirectionalVisualization = () => {
    if (!svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = getDimensions();
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
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

    // Gather all elements involved in the search
    const allElements = new Set<string>([
      ...Array.from(forwardElements),
      ...Array.from(backwardElements),
    ]);

    // Create node data
    const nodes: { id: string; group: string }[] = [];

    // Add forward search elements
    forwardElements.forEach((element) => {
      const isMeeting = meetingPoints.has(element);
      nodes.push({
        id: element,
        group: isMeeting ? "meeting" : "forward",
      });
    });

    // Add backward search elements (if not already added)
    backwardElements.forEach((element) => {
      if (!forwardElements.has(element)) {
        const isMeeting = meetingPoints.has(element);
        nodes.push({
          id: element,
          group: isMeeting ? "meeting" : "backward",
        });
      }
    });

    // Create a Set to track all node IDs for quick lookup
    const nodeIds = new Set<string>();
    nodes.forEach((node) => nodeIds.add(node.id));

    // Create links data from connections
    const links: { source: string; target: string; type: string }[] = [];

    // Process element connections, ensuring all nodes exist
    Object.entries(elementConnections).forEach(([target, sources]) => {
      // Skip if target node doesn't exist in our nodes array
      if (!nodeIds.has(target)) return;

      sources.forEach((source) => {
        // Skip if source node doesn't exist in our nodes array
        if (!nodeIds.has(source)) return;

        // Determine link type based on the nodes it connects
        let linkType = "unknown";

        if (forwardElements.has(source) && forwardElements.has(target)) {
          linkType = "forward";
        } else if (
          backwardElements.has(source) &&
          backwardElements.has(target)
        ) {
          linkType = "backward";
        } else if (
          (forwardElements.has(source) && backwardElements.has(target)) ||
          (backwardElements.has(source) && forwardElements.has(target))
        ) {
          linkType = "meeting";
        }

        links.push({
          source,
          target,
          type: linkType,
        });
      });
    });

    // Create force simulation with error handling
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force(
        "y",
        d3
          .forceY()
          .y((d: any) => {
            // Position basic elements at the bottom
            if (["Water", "Fire", "Earth", "Air"].includes(d.id)) {
              return innerHeight * 0.8;
            }
            // Position target element at the top
            else if (d.id === targetElement) {
              return innerHeight * 0.2;
            }
            // Position meeting points in the middle
            else if (meetingPoints.has(d.id)) {
              return innerHeight * 0.5;
            }
            // Position forward search elements in the lower half
            else if (forwardElements.has(d.id)) {
              return innerHeight * 0.65;
            }
            // Position backward search elements in the upper half
            else if (backwardElements.has(d.id)) {
              return innerHeight * 0.35;
            }
            return innerHeight / 2;
          })
          .strength(0.2)
      );

    // Add links with transition for animation
    const link = g
      .append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke-width", 2)
      .attr("stroke", (d: any) => {
        if (d.type === "forward") return "#4169E1"; // Royal Blue
        if (d.type === "backward") return "#FF6347"; // Tomato
        if (d.type === "meeting") return "#8A2BE2"; // BlueViolet
        return "#999";
      })
      .style("opacity", 0) // Start invisible
      .transition()
      .duration(500)
      .delay((_, i) => i * 150) // Slower animation
      .style("opacity", 1); // Fade in

    // Add node groups with delayed appearance
    const nodeGroups = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .style("opacity", 0) // Start invisible
      .transition()
      .duration(500)
      .delay((d, i) => {
        // Delay based on search direction and role
        if (["Water", "Fire", "Earth", "Air"].includes(d.id)) {
          return 100; // Show basic elements first
        }
        if (d.id === targetElement) {
          return 100; // Show target element first
        }
        if (meetingPoints.has(d.id)) {
          return 3000; // Show meeting points last
        }
        return 1000 + i * 300; // Delay other elements for slower visualization
      })
      .style("opacity", 1) // Fade in
      .call((selection) => {
        // After transition, add drag behavior
        selection.each(function (d) {
          d3.select(this).call(
            d3
              .drag<SVGGElement, any>()
              .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              })
              .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
              })
              .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
              }) as any
          );
        });
      });

    // Add node circles
    g.selectAll(".node")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", 20)
      .attr("fill", (d: any) => {
        if (meetingPoints.has(d.id)) {
          return "#8A2BE2"; // BlueViolet for meeting points
        }
        if (d.id === targetElement) {
          return "#FF0000"; // Red for target element
        }
        if (["Water", "Fire", "Earth", "Air"].includes(d.id)) {
          return elementColors[d.id] || "#CCCCCC";
        }
        if (forwardElements.has(d.id)) {
          return "#4169E1"; // Royal Blue for forward search
        }
        if (backwardElements.has(d.id)) {
          return "#FF6347"; // Tomato for backward search
        }
        return "#CCCCCC";
      })
      .attr("stroke", "#333")
      .attr("stroke-width", 1.5)
      .style("opacity", 0) // Start invisible
      .transition()
      .duration(500)
      .delay((d, i) => {
        // Same delay pattern as node groups
        if (["Water", "Fire", "Earth", "Air"].includes(d.id)) {
          return 100;
        }
        if (d.id === targetElement) {
          return 100;
        }
        if (meetingPoints.has(d.id)) {
          return 3000;
        }
        return 1000 + i * 300;
      })
      .style("opacity", 1); // Fade in

    // Add element icons with delayed appearance
    const icons = g
      .selectAll(".icon")
      .data(nodes)
      .enter()
      .append("image")
      .attr("class", "icon")
      .attr("width", 28)
      .attr("height", 28)
      .attr("xlink:href", (d: any) => getElementImagePath(d.id))
      .style("opacity", 0) // Start invisible
      .transition()
      .duration(500)
      .delay((d, i) => {
        // Same delay pattern as nodes
        if (["Water", "Fire", "Earth", "Air"].includes(d.id)) {
          return 200;
        }
        if (d.id === targetElement) {
          return 200;
        }
        if (meetingPoints.has(d.id)) {
          return 3100;
        }
        return 1100 + i * 300;
      })
      .style("opacity", 1) // Fade in
      .on("end", function () {
        // After appearing, handle error
        d3.select(this).on("error", function () {
          d3.select(this).remove();
        });
      });

    // Add text labels with delayed appearance
    const labels = g
      .selectAll(".label")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", 30)
      .text((d: any) => d.id)
      .style("opacity", 0) // Start invisible
      .transition()
      .duration(500)
      .delay((d, i) => {
        // Same delay pattern as nodes
        if (["Water", "Fire", "Earth", "Air"].includes(d.id)) {
          return 300;
        }
        if (d.id === targetElement) {
          return 300;
        }
        if (meetingPoints.has(d.id)) {
          return 3200;
        }
        return 1200 + i * 300;
      })
      .style("opacity", 1) // Fade in
      .on("end", function () {
        // After appearing, add background rectangle
        const bbox = (this as SVGTextElement).getBBox();
        d3.select(g.node())
          .insert("rect", "text")
          .attr("x", bbox.x - 2 + (this as any).__data__.x)
          .attr("y", bbox.y - 1 + (this as any).__data__.y)
          .attr("width", bbox.width + 4)
          .attr("height", bbox.height + 2)
          .attr("fill", "white")
          .attr("fill-opacity", 0.8)
          .attr("rx", 2)
          .attr("ry", 2);
      });

    // Update node and link positions during simulation
    simulation.on("tick", () => {
      g.selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      g.selectAll(".node")
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      g.selectAll(".icon")
        .attr("x", (d: any) => d.x - 14)
        .attr("y", (d: any) => d.y - 14);

      g.selectAll(".label")
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });
  };

  // Combined function to handle both data formats
  const extractBidirectionalDataFromServerResponse = (data: any) => {
    if (!data) return null;

    console.log("Extracting data format from server response:", data);

    // First, determine what kind of data we have
    let recipes: any[] = [];
    let needsPostprocessing = false;

    // Check if this is a "multiple recipes" response
    if (
      data.recipes &&
      Array.isArray(data.recipes) &&
      data.recipes.length > 0
    ) {
      console.log(`Found ${data.recipes.length} recipes in response`);
      recipes = data.recipes;
      needsPostprocessing = true;
    }
    // Single recipe case
    else if (data.element) {
      console.log("Single recipe in response");
      recipes = [data];
    }
    // Invalid data format
    else {
      console.warn("Invalid data format received from server:", data);
      return null;
    }

    // If we have bidirectional search data, use it directly
    if (
      data.forwardVisited ||
      data.ForwardVisited ||
      data.backwardVisited ||
      data.BackwardVisited
    ) {
      console.log("Server provided explicit bidirectional search data");
      return {
        hasBidirectionalData: true,
        recipes: recipes,
      };
    }

    // Otherwise, we need to post-process recipe trees to generate
    // bidirectional search data
    if (needsPostprocessing) {
      console.log("Need to generate bidirectional data from recipe trees");
      return {
        hasBidirectionalData: false,
        recipes: recipes,
      };
    }

    // Default case, just return the data
    return {
      hasBidirectionalData: false,
      recipes: recipes,
    };
  };

  // Process bidirectional search data or recipe tree data
  const processBidirectionalData = (data: any) => {
    if (!data) return;

    console.log("Processing data:", data); // Debug log

    // Extract formatted data from server response
    const extractedData = extractBidirectionalDataFromServerResponse(data);
    if (!extractedData) {
      console.error("Failed to extract data format from server response");
      return;
    }

    const { hasBidirectionalData, recipes } = extractedData;
    setHasBidirectionalData(hasBidirectionalData);

    // Handle multiple recipes
    if (recipes.length > 1) {
      console.log(`Processing ${recipes.length} recipes`);
      setMultipleRecipes(recipes);

      // Make sure currentRecipeIndex is within bounds
      let validIndex = currentRecipeIndex;
      if (validIndex >= recipes.length) {
        validIndex = 0;
        setCurrentRecipeIndex(0);
      }

      // Set current recipe for display
      const currentRecipe = recipes[validIndex];
      setCurrentRecipeData(currentRecipe);

      // Process only the current recipe
      processRecipeData(currentRecipe);
    } else if (recipes.length === 1) {
      // Single recipe case
      setMultipleRecipes([recipes[0]]);
      setCurrentRecipeData(recipes[0]);
      processRecipeData(recipes[0]);
    } else {
      console.warn("No valid recipes found in data");
      setCurrentRecipeData(null);
    }
  };

  // Process a single recipe - separated to improve clarity
  const processRecipeData = (data: any) => {
    if (!data || !data.element) {
      console.warn("Invalid recipe data received:", data);
      return;
    }

    console.log("Processing single recipe:", data.element);

    // Reset state for new recipe processing
    const newForwardElements = new Set<string>([
      "Water",
      "Fire",
      "Earth",
      "Air",
    ]);
    const newBackwardElements = new Set<string>([targetElement]);
    const newMeetingPoints = new Set<string>();
    const newElementConnections: { [key: string]: string[] } = {};

    // Check if we have explicit bidirectional search data
    if (
      data.forwardVisited ||
      data.ForwardVisited ||
      data.backwardVisited ||
      data.BackwardVisited
    ) {
      // We have explicit bidirectional search data
      setHasBidirectionalData(true);

      // Process forward search connections
      const forwardData = data.forwardVisited || data.ForwardVisited || {};
      Object.keys(forwardData).forEach((element) => {
        newForwardElements.add(element);

        // Extract recipe info if available
        const recipeInfo = forwardData[element];
        if (recipeInfo && recipeInfo.Recipe && recipeInfo.Recipe.length > 0) {
          // This element was created from ingredients
          newElementConnections[element] = recipeInfo.Recipe;
        }
      });

      // Process backward search connections
      const backwardData = data.backwardVisited || data.BackwardVisited || {};
      Object.keys(backwardData).forEach((element) => {
        newBackwardElements.add(element);

        // Extract recipe info if available
        const recipeInfo = backwardData[element];
        if (recipeInfo && recipeInfo.Recipe && recipeInfo.Recipe.length > 0) {
          // This element was created from ingredients
          newElementConnections[element] = recipeInfo.Recipe;
        }
      });

      // Extract meeting points
      const meetingArray = data.meetingPoints || data.MeetingPoints || [];
      meetingArray.forEach((element: string) => {
        newMeetingPoints.add(element);
      });
    } else {
      // We're working with a regular recipe tree, not explicit bidirectional data
      setHasBidirectionalData(false);

      // Use depth-first traversal to build fake bidirectional search data
      buildBidirectionalFromRecipeTree(
        data,
        newForwardElements,
        newBackwardElements,
        newElementConnections
      );
    }

    // Find meeting points - elements that appear in both forward and backward sets
    newForwardElements.forEach((element) => {
      if (newBackwardElements.has(element)) {
        newMeetingPoints.add(element);
      }
    });

    // Update state with processed data
    setForwardElements(newForwardElements);
    setBackwardElements(newBackwardElements);
    setMeetingPoints(newMeetingPoints);
    setElementConnections(newElementConnections);

    // Log results for debugging
    console.log("Processed data statistics:");
    console.log(`- Forward elements: ${newForwardElements.size}`);
    console.log(`- Backward elements: ${newBackwardElements.size}`);
    console.log(`- Meeting points: ${newMeetingPoints.size}`);
    console.log(
      `- Connection pairs: ${Object.keys(newElementConnections).length}`
    );
  };

  // Build bidirectional search data from a recipe tree
  const buildBidirectionalFromRecipeTree = (
    node: any,
    forwardElements: Set<string>,
    backwardElements: Set<string>,
    elementConnections: { [key: string]: string[] }
  ) => {
    if (!node || !node.element) {
      console.warn("Invalid node in recipe tree:", node);
      return;
    }

    // Start with basic elements in forward search and target in backward search
    // We'll build up the sets as we traverse the tree

    // Get path from root to target (if this node is in the path)
    const path = findPathToTarget(node, targetElement, []);
    const isInPath = path.length > 0;

    // Process the whole tree to build connections
    const processNode = (currentNode: any, pathToTarget: boolean) => {
      if (!currentNode || !currentNode.element) return;

      // Basic elements always go in forward search
      if (["Water", "Fire", "Earth", "Air"].includes(currentNode.element)) {
        forwardElements.add(currentNode.element);
      }

      // Target element always goes in backward search
      if (currentNode.element === targetElement) {
        backwardElements.add(currentNode.element);
      }

      // Process recipes (ingredients)
      if (
        currentNode.recipes &&
        Array.isArray(currentNode.recipes) &&
        currentNode.recipes.length > 0
      ) {
        // Get valid ingredients
        const ingredients = currentNode.recipes
          .filter((r: any) => r && r.element)
          .map((r: any) => r.element);

        if (ingredients.length > 0) {
          // Store connection (target -> ingredients)
          elementConnections[currentNode.element] = ingredients;

          // For elements on path to target, classify intelligently
          if (pathToTarget || currentNode.element === targetElement) {
            backwardElements.add(currentNode.element);
            // Add ingredients to backward elements too
            ingredients.forEach((ing: any) => backwardElements.add(ing));
          } else {
            // Default to forward search for other branches
            forwardElements.add(currentNode.element);
            // Add ingredients to forward elements
            ingredients.forEach((ing: any) => forwardElements.add(ing));
          }

          // Process each ingredient recursively
          currentNode.recipes.forEach((ingredient: any) => {
            // Check if this ingredient is on path to target
            const ingredientOnPath =
              pathToTarget &&
              ingredients.includes(ingredient.element) &&
              findPathToTarget(ingredient, targetElement, []).length > 0;

            processNode(ingredient, ingredientOnPath);
          });
        }
      } else if (currentNode.element === targetElement) {
        // Handle case where target is a leaf node
        backwardElements.add(currentNode.element);
      } else if (
        ["Water", "Fire", "Earth", "Air"].includes(currentNode.element)
      ) {
        // Handle case where basic element is a leaf node
        forwardElements.add(currentNode.element);
      }
    };

    // Start processing from root node
    processNode(node, isInPath);
  };

  // Helper to find path from a node to the target element
  const findPathToTarget = (
    node: any,
    target: string,
    currentPath: string[]
  ): string[] => {
    if (!node || !node.element) return [];

    // If this is the target, return path including this node
    if (node.element === target) {
      return [...currentPath, node.element];
    }

    // If this node has no recipes, it's a dead end
    if (
      !node.recipes ||
      !Array.isArray(node.recipes) ||
      node.recipes.length === 0
    ) {
      return [];
    }

    // Try each child node
    for (const child of node.recipes) {
      const path = findPathToTarget(child, target, [
        ...currentPath,
        node.element,
      ]);
      if (path.length > 0) {
        return path; // Found a path through this child
      }
    }

    return []; // No path found through any child
  };

  // Connect to WebSocket and start search
  useEffect(() => {
    if (!targetElement) return;

    // Reset state
    setForwardElements(new Set(["Water", "Fire", "Earth", "Air"]));
    setBackwardElements(new Set([targetElement]));
    setMeetingPoints(new Set());
    setElementConnections({});
    setLoading(true);
    setStatus(`Searching for ${targetElement}...`);
    setProgress(0);
    setResultText("Searching...");
    setMultipleRecipes([]);
    setCurrentRecipeIndex(0);
    setCurrentRecipeData(null);
    setHasBidirectionalData(false);
    setStats(null); // Add this line to reset stats

    // Create WebSocket connection
    // const socket = new WebSocket("ws://localhost:8080/ws");
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

          // Update stats from progress
          setStats({
            nodeCount: data.stats.nodeCount,
            stepCount: data.stats.stepCount,
            elapsedTimeMs: data.stats.elapsedTimeMs || 0,
          });

          // Process bidirectional search data
          setTimeout(() => {
            processBidirectionalData(data.path);
          }, 300); // Small delay to allow UI to update

          // Display the result as text
          setResultText(JSON.stringify(data.path, null, 2));
        } else if (data.type === "result") {
          // Show final result
          setLoading(false);

          // Update final stats
          setStats({
            nodeCount: data.stats.nodeCount,
            stepCount: data.stats.stepCount,
            elapsedTimeMs: data.stats.elapsedTimeMs || 0,
          });

          // Check for empty results
          if (
            !data.path ||
            (data.path.recipes &&
              Array.isArray(data.path.recipes) &&
              data.path.recipes.length === 0)
          ) {
            setStatus(
              `Search completed. No recipes found for ${targetElement}.`
            );
          } else {
            // Count recipes
            let recipeCount = 0;
            if (data.path.recipes && Array.isArray(data.path.recipes)) {
              recipeCount = data.path.recipes.length;
              setStatus(
                `Search completed. Found ${recipeCount} recipe(s) for ${targetElement}.`
              );
            } else {
              setStatus(
                `Search completed. Found recipe(s) for ${targetElement}.`
              );
            }
          }

          // Process final data
          processBidirectionalData(data.path);

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

  // Render visualization whenever data changes
  useEffect(() => {
    if (viewMode === "tree") {
      renderBidirectionalVisualization();
    }
  }, [
    forwardElements,
    backwardElements,
    meetingPoints,
    elementConnections,
    viewMode,
    targetElement,
  ]);

  // Handle browser resize
  useEffect(() => {
    const handleResize = () => {
      if (viewMode === "tree") {
        renderBidirectionalVisualization();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [
    forwardElements,
    backwardElements,
    meetingPoints,
    elementConnections,
    viewMode,
  ]);

  // Handle browser resize
  useEffect(() => {
    const handleResize = () => {
      if (viewMode === "tree") {
        renderBidirectionalVisualization();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [viewMode]);

  // Handle recipe changes for multiple mode
  const handlePreviousRecipe = () => {
    if (multipleRecipes.length > 0 && currentRecipeIndex > 0) {
      const newIndex = currentRecipeIndex - 1;
      setCurrentRecipeIndex(newIndex);

      // Process the new recipe data
      const nextRecipe = multipleRecipes[newIndex];
      setCurrentRecipeData(nextRecipe);

      // Reset visualization data
      setForwardElements(new Set(["Water", "Fire", "Earth", "Air"]));
      setBackwardElements(new Set([targetElement]));
      setMeetingPoints(new Set());
      setElementConnections({});

      // Process new recipe with a slight delay
      setTimeout(() => {
        processRecipeData(nextRecipe);
      }, 10);
    }
  };

  const handleNextRecipe = () => {
    if (
      multipleRecipes.length > 0 &&
      currentRecipeIndex < multipleRecipes.length - 1
    ) {
      const newIndex = currentRecipeIndex + 1;
      setCurrentRecipeIndex(newIndex);

      // Process the new recipe data
      const nextRecipe = multipleRecipes[newIndex];
      setCurrentRecipeData(nextRecipe);

      // Reset visualization data
      setForwardElements(new Set(["Water", "Fire", "Earth", "Air"]));
      setBackwardElements(new Set([targetElement]));
      setMeetingPoints(new Set());
      setElementConnections({});

      // Process new recipe with a slight delay
      setTimeout(() => {
        processRecipeData(nextRecipe);
      }, 10);
    }
  };

  return (
    <div className="bidirectional-tree-page">
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
            className="px-4 py-2 rounded-l-full bg-[#d68921] text-white"
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

          {/* <span className="text-sm text-gray-500 ml-4">
            {viewMode === "tree" && "Tip: Use mouse wheel to zoom, drag to pan"}
          </span> */}
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
        {!currentRecipeData && !loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-gray-500">
              No data to display. Start a search to visualize the bidirectional
              search process.
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
            {currentRecipeData && <RecipeDisplay data={currentRecipeData} />}
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

      {/* Bidirectional search stats */}
      {/* <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="text-lg font-medium mb-2">Search Visualization Stats</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-medium">Forward Search Elements:</p>
            <p className="text-sm">{forwardElements.size} elements visited</p>
          </div>
          <div>
            <p className="font-medium">Backward Search Elements:</p>
            <p className="text-sm">{backwardElements.size} elements visited</p>
          </div>
          <div>
            <p className="font-medium">Meeting Points:</p>
            <p className="text-sm">{meetingPoints.size} elements found</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="font-medium">Meeting Points:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {Array.from(meetingPoints).map((element) => (
              <span
                key={element}
                className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs"
              >
                {element}
              </span>
            ))}
          </div>
        </div> */}

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
        <h3 className="text-lg font-medium mb-2">Legend</h3>
        <div className="flex flex-wrap gap-3">
          {/* Basic elements */}
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

          {/* Target element */}
          <div className="flex items-center ml-4">
            <div
              className="w-4 h-4 rounded-full mr-1"
              style={{ backgroundColor: "#FF0000" }}
            ></div>
            <span className="text-sm">Target Element</span>
          </div>

          {/* Bidirectional search visual indicators */}
          <div className="flex items-center ml-4">
            <div
              className="w-4 h-4 rounded-full mr-1"
              style={{ backgroundColor: "#4169E1" }} // RoyalBlue
            ></div>
            <span className="text-sm">
              Forward Search (from basic elements)
            </span>
          </div>
          <div className="flex items-center ml-4">
            <div
              className="w-4 h-4 rounded-full mr-1"
              style={{ backgroundColor: "#FF6347" }} // Tomato
            ></div>
            <span className="text-sm">Backward Search (from target)</span>
          </div>
          <div className="flex items-center ml-4">
            <div
              className="w-4 h-4 rounded-full mr-1"
              style={{ backgroundColor: "#8A2BE2" }} // BlueViolet
            ></div>
            <span className="text-sm">Meeting Point</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidirectionalTreePage;
