import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const KEY = 'theme';

function readStored(): Theme {
  // 默认暗色：整套视觉（发光描边、玻璃层、渐变）是按暗色调的，
  // 跟着 prefers-color-scheme 走会让大多数桌面访客第一眼看到的是没调过的亮色。
  return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
