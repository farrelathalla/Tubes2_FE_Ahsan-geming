// app/tree/page.tsx or pages/tree.tsx
"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

type ElementNode = {
  element: string;
  recipes: ElementNode[];
};

export default function PixiTreePage() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Step 1: Create PIXI app safely
    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
    });

    if (canvasRef.current) {
      canvasRef.current.innerHTML = "";
      canvasRef.current.appendChild(app.view);
    }

    // Step 2: Load and draw tree
    fetch("/test.json")
      .then((res) => res.json())
      .then((data: ElementNode) => {
        const drawNode = (
          node: ElementNode,
          x: number,
          y: number
        ): { x: number; y: number } => {
          const nodeWidth = 120;
          const nodeHeight = 40;

          const graphics = new PIXI.Graphics();
          graphics.beginFill(0x38bdf8);
          graphics.drawRoundedRect(0, 0, nodeWidth, nodeHeight, 8);
          graphics.endFill();
          graphics.x = x;
          graphics.y = y;

          const text = new PIXI.Text(
            node.element,
            new PIXI.TextStyle({
              fill: "#ffffff",
              fontSize: 14,
              fontWeight: "bold",
            })
          );
          text.x = 10;
          text.y = 10;

          const container = new PIXI.Container();
          container.addChild(graphics);
          container.addChild(text);

          app.stage.addChild(container);

          let nextX = x - ((node.recipes.length - 1) * 150) / 2;
          const nextY = y + 100;

          node.recipes.forEach((child) => {
            const childPos = drawNode(child, nextX, nextY);

            const line = new PIXI.Graphics();
            line.lineStyle(2, 0xffffff, 0.6);
            line.moveTo(x + nodeWidth / 2, y + nodeHeight);
            line.lineTo(childPos.x + nodeWidth / 2, childPos.y);
            app.stage.addChild(line);

            nextX += 150;
          });

          return { x, y };
        };

        drawNode(data, app.renderer.width / 2 - 60, 40);
      })
      .catch((err) => {
        console.error("Failed to load test.json:", err);
      });

    return () => {
      app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={canvasRef} style={{ width: "100%", height: "100vh" }} />;
}
