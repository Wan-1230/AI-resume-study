export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * 难度配色的唯一来源。
 *
 * 之前这里用 green/yellow/red，而 QuestionCard、QuestionDetail、MyQuestionsPage 各自
 * 又写了一份 emerald/amber/rose —— 同一个"困难"标签在不同页面是两种红，
 * 而且没有编译错误，只能靠人眼发现。所有难度色一律从这里取，不要再在组件里抄一份。
 */
const palette: Record<Difficulty, { dot: string; text: string; soft: string; border: string }> = {
  easy: { dot: 'bg-emerald-500', text: 'text-success', soft: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  medium: { dot: 'bg-amber-500', text: 'text-warning', soft: 'bg-amber-500/10', border: 'border-amber-500/20' },
  hard: { dot: 'bg-rose-500', text: 'text-danger', soft: 'bg-rose-500/10', border: 'border-rose-500/20' },
};

export const difficultyConfig = {
  easy: { label: '简单', ...palette.easy, color: palette.easy.dot, textColor: palette.easy.text, bgColor: palette.easy.soft },
  medium: { label: '中等', ...palette.medium, color: palette.medium.dot, textColor: palette.medium.text, bgColor: palette.medium.soft },
  hard: { label: '困难', ...palette.hard, color: palette.hard.dot, textColor: palette.hard.text, bgColor: palette.hard.soft },
};

/** 徽标形态（背景 + 文字 + 圆点 + 描边），给详情页与我的题库共用 */
export const difficultyBadge = {
  easy: { bg: palette.easy.soft, text: palette.easy.text, dot: palette.easy.dot, border: palette.easy.border },
  medium: { bg: palette.medium.soft, text: palette.medium.text, dot: palette.medium.dot, border: palette.medium.border },
  hard: { bg: palette.hard.soft, text: palette.hard.text, dot: palette.hard.dot, border: palette.hard.border },
};

/** 上面那组要整体套进一个 class 时的字符串形态，避免各组件再拼一次 */
export const difficultyPill = {
  easy: `${palette.easy.soft} ${palette.easy.text} ${palette.easy.border}`,
  medium: `${palette.medium.soft} ${palette.medium.text} ${palette.medium.border}`,
  hard: `${palette.hard.soft} ${palette.hard.text} ${palette.hard.border}`,
};

export const difficultyDot = {
  easy: palette.easy.dot,
  medium: palette.medium.dot,
  hard: palette.hard.dot,
};

export const difficulties = (['easy', 'medium', 'hard'] as const).map((value) => ({
  value,
  label: difficultyConfig[value].label,
  color: palette[value].dot,
}));

/** 收藏/练习里用到的分类统计条配色，同样集中定义 */
export const statsBar = 'bg-gradient-to-r from-primary-500/80 to-purple-600/80';

/**
 * 需要"颜色字符串"而非 Tailwind 类名时的唯一来源：SVG、动画组件的 color props、内联 style。
 * className 场景不要用这里，写语义 token 类（bg-raised / text-muted）。
 *
 * 会随主题翻的走 CSS 变量（值在 index.css 的 :root / html.light 里）；
 * 品牌色两套主题共用，保持字面量 —— 画布（ctx.strokeStyle）认不了 var()，
 * 所以凡是要喂给 canvas 的颜色都必须是能在 CSS 之外求值的字面量。
 */
export const uiColors: Record<string, string> = {
  ink: 'rgb(var(--c-ink))',
  inkSoft: 'rgb(var(--c-ink-soft))',
  surface: 'rgb(var(--c-surface))',
  raised: 'rgb(var(--c-raised))',
  edge: 'rgb(var(--c-edge))',
  muted: 'rgb(var(--c-muted))',
  brand: 'rgb(var(--c-brand))',
  primary: '#06d6a0',
};
