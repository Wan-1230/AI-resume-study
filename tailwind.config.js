/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#06d6a0',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#f72585',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        purple: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // 语义底色与文字色：组件里只写这些名字，不要再写字面 hex。
        // 取值来自 src/index.css 的 --c-* 三元组（换主题就是换这组变量，类名一个都不用动）；
        // 需要"颜色字符串"的 SVG / 动画组件从 src/constants/config.ts 的 uiColors 取。
        // <alpha-value> 是必须的：没有它 bg-ink/90 这类带透明度的写法会失效。
        ink: 'rgb(var(--c-ink) / <alpha-value>)',        // 页面底色
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)', // 顶栏与输入区底色
        panel: 'rgb(var(--c-panel) / <alpha-value>)',    // 管理后台面板
        surface: 'rgb(var(--c-surface) / <alpha-value>)',  // 卡片
        raised: 'rgb(var(--c-raised) / <alpha-value>)',    // hover 与输入框
        lift: 'rgb(var(--c-lift) / <alpha-value>)',        // raised 再亮一档：可点卡片的 hover
        line: 'rgb(var(--c-line) / <alpha-value>)',        // 分隔线与进度轨道
        edge: 'rgb(var(--c-edge) / <alpha-value>)',        // 更强的描边
        ghost: 'rgb(var(--c-ghost) / <alpha-value>)',      // 只用于描边与装饰，压在任何底色上都不到 2:1，别当文字色
        faint: 'rgb(var(--c-faint) / <alpha-value>)',      // 次要图标与提示
        muted: 'rgb(var(--c-muted) / <alpha-value>)',      // 次要正文
        bright: 'rgb(var(--c-bright) / <alpha-value>)',    // 主要正文

        // 语义"角色色"：同一类信息在不同主题下要换明暗，所以也走变量。
        // 之前这些位置直接写 text-primary-500 / text-rose-400，暗色没问题，
        // 亮色下薄荷压白底只有 1.7:1 —— 角色名换掉，值在 index.css 里成对翻。
        brand: 'rgb(var(--c-brand) / <alpha-value>)',        // 品牌色文字（链接、强调、选中态）
        'on-brand': '#0a0a0f',                                // 压在薄荷/品红实色上的文字，两个主题都必须是深色
        danger: 'rgb(var(--c-danger) / <alpha-value>)',       // 错误、危险操作
        success: 'rgb(var(--c-success) / <alpha-value>)',     // 成功、答对
        warning: 'rgb(var(--c-warning) / <alpha-value>)',     // 提醒、待处理
        'accent-fg': 'rgb(var(--c-accent-fg) / <alpha-value>)', // 紫色系强调文字
        info: 'rgb(var(--c-info) / <alpha-value>)',           // 中性提示（如"邮箱注册"标签）
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out forwards',
        'gradient': 'gradient-shift 3s ease infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(6, 214, 160, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(6, 214, 160, 0.4)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
