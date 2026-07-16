import { create } from 'zustand';
import { Question, Category, User, PracticeResult } from '@/types';
import { getStoredToken, clearToken } from '@/lib/authApi';

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
  toggleFavorite: (questionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // 初始状态
  user: null,
  token: null,
  isAuthenticated: false,
  questions: [],
  categories: [],
  currentQuestion: null,
  practiceResults: [],
  favorites: [],
  loading: false,
  error: null,

  // 认证 actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: (token, user) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false, favorites: [] });
  },

  initializeAuth: () => {
    const token = getStoredToken();
    const storedUser = localStorage.getItem('auth_user');
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        set({ token, user, isAuthenticated: true });
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
  toggleFavorite: (questionId) => set((state) => ({
    favorites: state.favorites.includes(questionId)
      ? state.favorites.filter(id => id !== questionId)
      : [...state.favorites, questionId]
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
