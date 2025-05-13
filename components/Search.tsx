"use client";
import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { buildFlowData, ElementNode } from "../lib/buildFlowData";
import AlchemyNode from "../components/AlchemyNode";
import TreePage from "../components/TreePage";

const nodeTypes = { alchemy: AlchemyNode };

export default function Search() {
  const [elements, setElements] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [method, setMethod] = useState("bfs");
  const [pathMethod, setPathMethod] = useState("shortest"); // Default method for path
  const [numRecipes, setNumRecipes] = useState(1);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [result, setResult] = useState<ElementNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1); // For paging
  const [showVisualization, setShowVisualization] = useState(false); // Changed from showLiveVisualization
  const itemsPerPage = 7 * 7; // 7 columns x 7 rows

  // Reset visualization when element or algorithm settings change
  useEffect(() => {
    setShowVisualization(false);
  }, [selectedElement, method, pathMethod, numRecipes]);

  useEffect(() => {
    fetch("/little_alchemy_elements.json")
      .then((res) => res.json())
      .then((data) => {
        const flat: string[] = [];
        Object.values(data).forEach((group: any) => {
          group.forEach((item: any) => flat.push(item.element));
        });
        setElements(flat.sort());
      });
  }, []);

  const handleSubmit = async () => {
    if (!selectedElement) {
      alert("Please select an element first");
      return;
    }

    setLoading(true);
    setShowVisualization(true); // Only show visualization after search is clicked

    try {
      // Legacy API call for ReactFlow visualization
      const res = await fetch("/test.json"); // Or change to /search
      const tree: ElementNode = await res.json();
      setResult(tree);
    } catch (err) {
      alert("Failed to load result");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered elements based on search
  const filteredElements = elements.filter((el) =>
    el.toLowerCase().includes(target.toLowerCase())
  );

  // Recalculate total pages based on filtered elements
  const totalPages = Math.ceil(filteredElements.length / itemsPerPage);

  // Image grid logic
  const paginatedElements = filteredElements.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Reset page number when target changes
  useEffect(() => {
    setPage(1); // Reset page when search term changes
  }, [target]);

  return (
    <section>
      <div className="bg-gradient-to-b from-[#3d002c] to-[#a0491e] border-[#d68921] w-[80%] flex flex-col items-center m-auto mt-20 rounded-2xl border-[3px] h-fit">
        <h2 className="w-full bg-[#d68921] text-center border-t-[3px] border-[#d68921] rounded-t-xl py-3 sing tracking-wider text-3xl">
          What are we cooking today?
        </h2>

        {/* Algorithm Toggle - Sliding Tabs (Now with 3 options) */}
        <div className="w-full px-5 mt-5 mb-4">
          <div className="relative bg-gray-200 rounded-xl w-full overflow-hidden">
            <div
              className={`absolute top-0 h-full bg-[#d68921] rounded-xl transition-transform duration-300 ease-in-out z-0 w-1/3 ${
                method === "bfs"
                  ? "translate-x-0"
                  : method === "dfs"
                  ? "translate-x-full"
                  : "translate-x-[200%]"
              }`}
            />

            <div className="flex w-full relative sing text-2xl tracking-wide">
              <button
                onClick={() => setMethod("bfs")}
                className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
                  method === "bfs" ? "text-black" : "text-gray-700"
                }`}
              >
                BFS
              </button>
              <button
                onClick={() => setMethod("dfs")}
                className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
                  method === "dfs" ? "text-black" : "text-gray-700"
                }`}
              >
                DFS
              </button>
              <button
                onClick={() => setMethod("bidirectional")}
                className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
                  method === "bidirectional" ? "text-black" : "text-gray-700"
                }`}
              >
                Bidirectional
              </button>
            </div>
          </div>
        </div>

        {/* Path Method - Sliding Tabs */}
        <div className="w-full px-5 mb-4 sing text-2xl tracking-wide">
          <div className="relative bg-gray-200 rounded-xl w-full overflow-hidden">
            <div
              className={`absolute top-0 h-full bg-[#d68921] rounded-xl transition-transform duration-300 ease-in-out z-0 w-1/2 ${
                pathMethod === "shortest" ? "translate-x-0" : "translate-x-full"
              }`}
            />

            <div className="flex w-full relative">
              <button
                onClick={() => setPathMethod("shortest")}
                className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
                  pathMethod === "shortest" ? "text-black" : "text-gray-700"
                }`}
              >
                Shortest Path
              </button>
              <button
                onClick={() => setPathMethod("multiple")}
                className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
                  pathMethod === "multiple" ? "text-black" : "text-gray-700"
                }`}
              >
                Multiple Recipe
              </button>
            </div>
          </div>
        </div>

        {/* Input for multiple recipes */}
        {pathMethod === "multiple" && (
          <div className="mb-4 flex flex-col items-center">
            <p className="text-white text-center mb-2"> How many recipe? </p>
            <input
              type="number"
              min="1"
              required
              value={numRecipes}
              onChange={(e) => setNumRecipes(Number(e.target.value))}
              className="px-4 py-2 rounded-full border-2 border-[#d68921] text-white w-[30%]"
              placeholder="Enter number of recipes"
            />
          </div>
        )}

        {/* Element search bar */}
        <input
          type="text"
          className="px-4 py-2 rounded-2xl border-2 border-[#d68921] text-white mb-10 mt-10 w-[80%] focus:outline-none"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Search element"
        />

        {/* Element grid display */}
        <div className="grid grid-cols-7 gap-4">
          {paginatedElements.map((el) => (
            <div
              key={el}
              className={`flex flex-col items-center cursor-pointer ${
                selectedElement === el
                  ? "border-[2px] p-2 rounded-xl border-[#d68921]"
                  : ""
              }`}
              onClick={() => setSelectedElement(el)}
            >
              <img
                src={`/elements/${el.replace(" ", "_")}.png`}
                alt={el}
                className="w-16 h-16"
              />
              <p className="text-white text-center">{el}</p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-center mt-10 items-center mb-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className={`px-4 py-2 rounded-full ${
              page === 1 ? "bg-gray-400" : "bg-[#d68921]"
            } text-white`}
          >
            Previous
          </button>
          <span className="mx-4 text-white">
            {page} / {totalPages}
          </span>
          <button
            disabled={page * itemsPerPage >= filteredElements.length}
            onClick={() => setPage(page + 1)}
            className={`px-4 py-2 rounded-full ${
              page * itemsPerPage >= filteredElements.length
                ? "bg-gray-400"
                : "bg-[#d68921]"
            } text-white`}
          >
            Next
          </button>
        </div>

        {/* Show selected element */}
        {selectedElement && (
          <div className="mt-4 text-white text-center">
            <p className="text-sm">Selected Element: {selectedElement}</p>
            <button
              onClick={handleSubmit}
              className="px-20 py-2 rounded-full bg-gradient-to-r from-[#d68921] to-[#eab166] text-black mt-2 mb-6 sing text-2xl tracking-wider"
            >
              Search
            </button>
          </div>
        )}
      </div>

      {/* Graph Result */}
      {/* <h2 className="text-white mt-5 text-center text-2xl">Graph Result:</h2> */}

      {/* Show live visualization only after search is clicked */}
      {showVisualization && selectedElement ? (
        <div className="mt-4 mx-auto max-w-[1000px] bg-white p-6 rounded-lg">
          <TreePage
            targetElement={selectedElement}
            algorithm={method}
            mode={pathMethod}
            limit={numRecipes}
          />
        </div>
      ) : !loading && selectedElement && !showVisualization ? (
        <p className="text-white text-center"></p>
      ) : (
        !loading && <p className="text-white text-center">No result yet.</p>
      )}
    </section>
  );
}
