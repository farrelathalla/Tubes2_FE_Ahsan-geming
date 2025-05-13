// components/AlchemyNode.tsx
import { Handle, Position } from "reactflow";

export default function AlchemyNode({ data }: any) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 12,
        backgroundColor: "#1e293b",
        color: "#fff",
        border: "2px solid #38bdf8",
        minWidth: 120,
        textAlign: "center",
        fontWeight: "bold",
        boxShadow: "0 0 10px rgba(56,189,248,0.5)",
      }}
    >
      {data.label}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
