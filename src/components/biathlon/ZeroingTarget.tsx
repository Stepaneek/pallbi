import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { BLACK_DIAMETER_MM, groupCenter, type Shot, type ZeroStance } from "@/lib/zeroing";

export function ZeroingTarget({ stance, shots, onShot, compact = false }: { stance: ZeroStance; shots: Shot[]; onShot?: (shot: Shot) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const center = groupCenter(shots);
  const record = (event: MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix || !onShot) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onShot({ x: Math.round(point.x * 10) / 10, y: Math.round(-point.y * 10) / 10 });
  };
  return (
    <svg viewBox="-75 -75 150 150" role="img" aria-label={t("zeroing.target")} onClick={onShot ? record : undefined}
      className={`zeroing-target block aspect-square w-full select-none ${onShot ? "cursor-crosshair" : ""}`}>
      <defs>
        <filter id="shot-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="black-sheen" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="hsl(var(--target-black))" stopOpacity="0.82" />
          <stop offset="100%" stopColor="hsl(var(--target-black))" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect x="-75" y="-75" width="150" height="150" className="target-paper" />
      <circle r="57.5" className="target-ring" strokeWidth="0.5" />
      <circle r={BLACK_DIAMETER_MM[stance] / 2} fill="url(#black-sheen)" />
      {[10, 20, 30, 40, 50].map(r => <circle key={r} r={r} className="target-grid" strokeWidth="0.2" strokeOpacity="0.55" />)}
      <path d="M -65 0 H 65 M 0 -65 V 65" className="target-grid" strokeWidth="0.25" strokeOpacity="0.55" strokeDasharray="1.5 1.5" />
      {center && !compact && <text x="-72" y="72" fontSize="4" className="target-number" style={{ fill: "hsl(var(--target-grid))", fontVariantNumeric: "tabular-nums", letterSpacing: "0.2px" }}>
        X {center.x > 0 ? "+" : ""}{center.x.toFixed(1)} · Y {center.y > 0 ? "+" : ""}{center.y.toFixed(1)} mm
      </text>}
      {shots.map((shot, index) => <g key={index} transform={`translate(${shot.x},${-shot.y})`}>
        <circle r={compact ? 5 : 3.2} className="target-shot" strokeWidth="0.5" />
        {!compact && <text textAnchor="middle" dominantBaseline="central" fontSize="3.6" fontWeight="bold" className="target-number">{index + 1}</text>}
      </g>)}
      {center && <g transform={`translate(${center.x},${-center.y})`} className="target-center" strokeWidth="0.7">
        <circle r="4.5" fill="none" /><path d="M -6 0 H 6 M 0 -6 V 6" />
      </g>}
    </svg>
  );
}