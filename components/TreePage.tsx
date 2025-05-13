import React from "react";
import StandardTreePage from "./StandardTreePage"; // Your original TreePage renamed
import BidirectionalTreePage from "./BidirectionalTreePage";
import DFSTreePage from "./DFSTreePage";

// Define props for the TreePage component
interface TreePageProps {
  targetElement: string;
  algorithm: string; // "dfs", "bfs", or "bidirectional"
  mode: string; // "shortest" or "multiple"
  limit?: number; // Number of recipes for multiple mode
}

// This is the main TreePage component that chooses the appropriate visualization
const TreePage: React.FC<TreePageProps> = (props) => {
  // Use the bidirectional visualization specifically for bidirectional search
  if (props.algorithm === "bidirectional") {
    return <BidirectionalTreePage {...props} />;
  } else if (props.algorithm === "dfs") {
    return <DFSTreePage {...props} />;
  }

  // Otherwise use the standard tree visualization for BFS and DFS
  return <StandardTreePage {...props} />;
};

export default TreePage;
