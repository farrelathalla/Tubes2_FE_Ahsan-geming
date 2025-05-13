"use client";
import { useState, useEffect, useRef } from "react";

const SlidingTabs = () => {
  const [method, setMethod] = useState("bfs");
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Update indicator position when method changes
  useEffect(() => {
    if (!tabsContainerRef.current || !indicatorRef.current) return;

    // Calculate position based on container width
    const containerWidth = tabsContainerRef.current.offsetWidth;
    const buttonWidth = containerWidth / 2;

    indicatorRef.current.style.width = `${buttonWidth}px`;
    indicatorRef.current.style.transform =
      method === "bfs" ? "translateX(0)" : `translateX(${buttonWidth}px)`;
  }, [method]);

  return (
    <div className="w-full mt-5 mb-4">
      <div
        ref={tabsContainerRef}
        className="relative bg-gray-200 rounded-full w-full overflow-hidden"
      >
        {/* Sliding Background */}
        <div
          ref={indicatorRef}
          className="absolute top-0 h-full bg-[#f8b763] rounded-full transition-transform duration-300 ease-in-out z-0"
          style={{ width: "50%" }}
        />

        {/* Buttons Container */}
        <div className="flex w-full relative">
          <button
            onClick={() => setMethod("bfs")}
            className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
              method === "bfs" ? "text-black" : "text-gray-700"
            }`}
          >
            Breadth First Search
          </button>
          <button
            onClick={() => setMethod("dfs")}
            className={`py-2 text-center flex-1 z-10 font-medium transition-colors duration-300 ${
              method === "dfs" ? "text-black" : "text-gray-700"
            }`}
          >
            Depth First Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlidingTabs;
