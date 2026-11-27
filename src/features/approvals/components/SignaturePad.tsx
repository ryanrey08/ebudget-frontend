"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Draw or upload an e-signature. Calls onChange with a PNG Blob (or the
 * uploaded PNG/JPEG file), or null when cleared. The backend accepts PNG or
 * JPEG up to 1 MB and 2000 × 2000 px.
 */
export function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * e.currentTarget.width) / rect.width, y: ((e.clientY - rect.top) * e.currentTarget.height) / rect.height };
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    canvas.current?.toBlob((blob) => onChange(blob), "image/png");
  };

  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    setUploaded(null);
    setError("");
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {uploaded ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-700">Using {uploaded}</p>
      ) : (
        <canvas
          ref={canvas}
          width={600}
          height={180}
          aria-label="Signature pad: draw your signature"
          className="h-36 w-full touch-none rounded-lg border border-dashed border-gray-300 bg-white"
          onPointerDown={(e) => {
            const ctx = e.currentTarget.getContext("2d");
            if (!ctx) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const p = point(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d");
            const p = point(e);
            ctx?.lineTo(p.x, p.y);
            ctx?.stroke();
            setHasInk(true);
          }}
          onPointerUp={finish}
          onPointerLeave={finish}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={clear} disabled={!hasInk && !uploaded}>
          <Eraser className="size-3.5" /> Clear
        </Button>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <Upload className="size-3.5" /> Upload image
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (!["image/png", "image/jpeg"].includes(file.type)) return setError("Use a PNG or JPEG image.");
              if (file.size > 1024 * 1024) return setError("The signature can be at most 1 MB.");
              setError("");
              setUploaded(file.name);
              onChange(file);
            }}
          />
        </label>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
