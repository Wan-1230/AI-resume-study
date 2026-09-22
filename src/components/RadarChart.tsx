import type { DimensionScore } from '@/lib/interviewApi';

/**
 * 六维能力雷达图。手写 SVG，不引图表库 —— 六个点一条折线，
 * 为一这个组件加 40KB 依赖不值得，而且评分卡这种图本来就只需要静态展示。
 */
const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 82;
const MAX = 5;

export default function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const count = dimensions.length;
  if (count < 3) return null;

  const point = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return { x: CENTER + Math.cos(angle) * RADIUS * ratio, y: CENTER + Math.sin(angle) * RADIUS * ratio };
  };

  const shape = dimensions
    .map((dim, i) => {
      const value = dim.score ?? 0;
      const { x, y } = point(i, value / MAX);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[300px] mx-auto" role="img" aria-label="六维能力雷达图">
      {[1, 2, 3, 4, 5].map((ring) => (
        <polygon
          key={ring}
          points={dimensions.map((_, i) => {
            const { x, y } = point(i, ring / MAX);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke="#2a2a38"
          strokeWidth={ring === MAX ? 1.2 : 0.7}
        />
      ))}

      {dimensions.map((dim, i) => {
        const { x, y } = point(i, 1);
        return <line key={dim.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#2a2a38" strokeWidth={0.7} />;
      })}

      <polygon points={shape} fill="rgba(6,214,160,0.18)" stroke="#06d6a0" strokeWidth={1.8} strokeLinejoin="round" />

      {dimensions.map((dim, i) => {
        const dot = point(i, (dim.score ?? 0) / MAX);
        const label = point(i, 1.32);
        return (
          <g key={dim.key}>
            <circle cx={dot.x} cy={dot.y} r={3} fill="#06d6a0" />
            <text
              x={label.x}
              y={label.y}
              textAnchor={Math.abs(label.x - CENTER) < 12 ? 'middle' : label.x > CENTER ? 'start' : 'end'}
              className="fill-[#8b8b9a]"
              fontSize="10"
            >
              {dim.name}
            </text>
            <text
              x={label.x}
              y={label.y + 11}
              textAnchor={Math.abs(label.x - CENTER) < 12 ? 'middle' : label.x > CENTER ? 'start' : 'end'}
              className="fill-[#e8e8ed]"
              fontSize="10"
              fontWeight="600"
            >
              {dim.score ?? '未评'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
