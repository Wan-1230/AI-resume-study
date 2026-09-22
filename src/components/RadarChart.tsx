import type { DimensionScore } from '@/lib/interviewApi';
import { uiColors } from '@/constants/config';

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

  // viewBox 左右各留 28：标签在 1.32 倍半径处、向外展开，六维里最宽的"实操经验关联"
  // 按 0..260 算会伸出画布被裁掉（390px 与 1280px 截图上都只看得见前四个字）。
  return (
    <svg viewBox="-28 0 316 260" className="w-full max-w-[320px] mx-auto" role="img" aria-label="六维能力雷达图">
      {[1, 2, 3, 4, 5].map((ring) => (
        <polygon
          key={ring}
          points={dimensions.map((_, i) => {
            const { x, y } = point(i, ring / MAX);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke={uiColors.edge}
          strokeWidth={ring === MAX ? 1.2 : 0.7}
        />
      ))}

      {dimensions.map((dim, i) => {
        const { x, y } = point(i, 1);
        return <line key={dim.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={uiColors.edge} strokeWidth={0.7} />;
      })}

      <polygon points={shape} fill={uiColors.primary} fillOpacity={0.18} stroke={uiColors.primary} strokeWidth={1.8} strokeLinejoin="round" />

      {dimensions.map((dim, i) => {
        const dot = point(i, (dim.score ?? 0) / MAX);
        const label = point(i, 1.32);
        return (
          <g key={dim.key}>
            <circle cx={dot.x} cy={dot.y} r={3} fill={uiColors.primary} />
            <text
              x={label.x}
              y={label.y}
              textAnchor={Math.abs(label.x - CENTER) < 12 ? 'middle' : label.x > CENTER ? 'start' : 'end'}
              className="fill-muted"
              fontSize="10"
            >
              {dim.name}
            </text>
            <text
              x={label.x}
              y={label.y + 11}
              textAnchor={Math.abs(label.x - CENTER) < 12 ? 'middle' : label.x > CENTER ? 'start' : 'end'}
              className="fill-bright"
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
