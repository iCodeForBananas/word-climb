import { GRADES } from "./lib/wordClimbContent";
import type { LevelReport } from "./lib/readingLog";

// The kid's view of the ladder: a trail winding up a mountain, one stop per
// level, kindergarten at the bottom and the end of grade 3 at the summit.

const W = 400;
const H = 560;

/** Where level `i` of `n` sits on the trail. */
function stop(i: number, n: number) {
  const t = n > 1 ? i / (n - 1) : 0;
  const width = 150 * (1 - 0.65 * t); // the trail narrows toward the peak
  return { x: W / 2 + width * Math.sin(t * Math.PI * 4.5), y: H - 40 - t * (H - 110) };
}

const GRADE_LABEL: Record<string, string> = { Kindergarten: "K", "Grade 1": "1st", "Grade 2": "2nd", "Grade 3": "3rd" };

export default function Mountain({ levels }: { levels: LevelReport[] }) {
  const n = levels.length;
  const points = levels.map((_, i) => stop(i, n));
  const trail = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const current = levels.findIndex((l) => l.status === "current");
  const summit = { x: W / 2, y: 22 };
  const reachedTop = levels.every((l) => l.status === "done");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className='w-full h-full' role='img' aria-label={`Climbing map: level ${current + 1} of ${n}`}>
      <polygon points={`0,${H} ${W / 2},${summit.y} ${W},${H}`} fill='#b9c7d8' />
      <polygon points={`${W / 2},${summit.y} ${W / 2 - 62},150 ${W / 2 - 30},140 ${W / 2},162 ${W / 2 + 28},138 ${W / 2 + 64},150`} fill='var(--snow)' />
      <polygon points={`0,${H} 90,${H - 150} 170,${H} `} fill='#a7b8cc' />
      <polygon points={`${W - 160},${H} ${W - 80},${H - 120} ${W},${H}`} fill='#a7b8cc' />

      <path d={trail} fill='none' stroke='#ffffff' strokeWidth='9' strokeLinecap='round' strokeLinejoin='round' opacity='0.85' />
      {current > 0 && (
        <path
          d={points.slice(0, current + 1).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill='none'
          stroke='var(--trail)'
          strokeWidth='9'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      )}

      {GRADES.map((grade) => {
        const first = levels.findIndex((l) => l.grade === grade);
        const p = points[first];
        const left = p.x > W / 2;
        return (
          <g key={grade}>
            <rect x={left ? p.x - 66 : p.x + 18} y={p.y - 13} width='48' height='24' rx='12' fill='var(--card)' stroke='var(--line)' />
            <text x={left ? p.x - 42 : p.x + 42} y={p.y + 4} textAnchor='middle' fontSize='13' fontWeight='700' fill='var(--ink)'>
              {GRADE_LABEL[grade] ?? grade}
            </text>
          </g>
        );
      })}

      {points.map((p, i) => {
        const l = levels[i];
        const fill = l.status === "done" ? "var(--trail)" : l.status === "current" ? "var(--primary)" : "#ffffff";
        return (
          <g key={l.id}>
            {i === current && <circle cx={p.x} cy={p.y} r='11' fill='var(--primary)' className='pulse-ring' />}
            <circle cx={p.x} cy={p.y} r={i === current ? 11 : 6.5} fill={fill} stroke={l.status === "locked" ? "#9aabbf" : "#ffffff"} strokeWidth='2.5' />
          </g>
        );
      })}

      <line x1={summit.x} y1={summit.y} x2={summit.x} y2={summit.y - 20} stroke='var(--ink)' strokeWidth='2.5' />
      <polygon points={`${summit.x},${summit.y - 20} ${summit.x + 18},${summit.y - 14} ${summit.x},${summit.y - 8}`} fill={reachedTop ? "var(--trail)" : "var(--again)"} />
    </svg>
  );
}
