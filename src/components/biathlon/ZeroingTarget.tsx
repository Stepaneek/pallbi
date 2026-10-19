import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { BLACK_DIAMETER_MM, groupCenter, type Shot, type ZeroStance } from "@/lib/zeroing";

export function ZeroingTarget({ stance, shots, onShot }: { stance: ZeroStance; shots: Shot[]; onShot?: (shot: Shot) => void }) {
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
      <rect x="-75" y="-75" width="150" height="150" className="target-paper" />
      <circle r="57.5" className="target-ring" strokeWidth="0.5" />
      <circle r={BLACK_DIAMETER_MM[stance] / 2} className="target-black" />
      {[10, 20, 30, 40, 50].map(r => <circle key={r} r={r} className="target-grid" strokeWidth="0.2" />)}
      <path d="M -65 0 H 65 M 0 -65 V 65" className="target-grid" strokeWidth="0.25" />
      {shots.map((shot, index) => <g key={index} transform={`translate(${shot.x},${-shot.y})`}>
        <circle r="3.2" className="target-shot" strokeWidth="0.5" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="3.6" fontWeight="bold" className="target-number">{index + 1}</text>
      </g>)}
      {center && <g transform={`translate(${center.x},${-center.y})`} className="target-center" strokeWidth="0.7">
        <circle r="4.5" fill="none" /><path d="M -6 0 H 6 M 0 -6 V 6" />
      </g>}
    </svg>
  );
}