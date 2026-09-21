import { create } from 'zustand';
import { Question, Category, User, PracticeResult } from '@/types';
import { getStoredToken, clearToken } from '@/lib/authApi';
import { learningApi } from '@/lib/learningApi';

interface AppState {
  // 用户认证
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // 题目相关
  questions: Question[];
  categories: Category[];
  currentQuestion: Question | null;
  practiceResults: PracticeResult[];
  favorites: string[];
  favoritesError: string | null;
  loading: boolean;
  error: string | null;

  // 用户 actions
  setUser: (user: User | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  initializeAuth: () => void;

  // 题目 actions
  setQuestions: (questions: Question[]) => void;
  setCategories: (categories: Category[]) => void;
  setCurrentQuestion: (question: Question | null) => void;
  addPracticeResult: (result: PracticeResult) => void;
  clearPracticeResults: () => void;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (questionId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // 初始状态
  user: null,
  token: null,
  isAuthenticated: false,
  questions: [],
  categories: [],
  currentQuestion: null,
  practiceResults: [],
  favorites: [],
  favoritesError: null,
  loading: false,
  error: null,

  // 认证 actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: (token, user) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
    void get().loadFavorites();
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false, favorites: [], favoritesError: null });
  },

  initializeAuth: () => {
    const token = getStoredToken();
    const storedUser = localStorage.getItem('auth_user');
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        set({ token, user, isAuthenticated: true });
        void get().loadFavorites();
      } catch {
        clearToken();
        set({ token: null, user: null, isAuthenticated: false });
      }
    }
  },

  // 题目 actions
  setQuestions: (questions) => set({ questions }),
  setCategories: (categories) => set({ categories }),
  setCurrentQuestion: (question) => set({ currentQuestion: question }),
  addPracticeResult: (result) => set((state) => ({
    practiceResults: [...state.practiceResults, result]
  })),
  clearPracticeResults: () => set({ practiceResults: [] }),

  loadFavorites: async () => {
    if (!get().token) {
      set({ favorites: [], favoritesError: null });
      return;
    }
    try {
      const items = await learningApi.favorites.list();
      set({ favorites: items.map((item) => item.question_id), favoritesError: null });
    } catch (e) {
      set({ favoritesError: e instanceof Error ? e.message : '收藏列表加载失败' });
    }
  },

  /** 先乐观更新再落库、失败回滚：收藏是个开关，反馈必须即时 */
  toggleFavorite: async (questionId) => {
    const { token, favorites } = get();
    if (!token) {
      set({ favoritesError: '登录后可收藏题目' });
      return;
    }

    const adding = !favorites.includes(questionId);
    set({
      favorites: adding ? [...favorites, questionId] : favorites.filter((id) => id !== questionId),
      favoritesError: null,
    });

    try {
      if (adding) await learningApi.favorites.add(questionId);
      else await learningApi.favorites.remove(questionId);
    } catch (e) {
      set({ favorites, favoritesError: e instanceof Error ? e.message : '收藏状态保存失败' });
    }
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
