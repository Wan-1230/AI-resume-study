export interface User {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  github_id: string | null;
  github_username: string | null;
  auth_provider?: 'email' | 'github';
  role?: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  /** 系统题库由静态 JSON 派生，本就没有时间戳；不再用写死的 2024-01-01 冒充 */
  created_at: string | null;
  updated_at: string | null;
}

export interface Question {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  content: string;
  options: string[];
  answer: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_public: boolean;
  created_at: string | null;
  updated_at: string | null;
  category?: Category;
}

export interface PracticeResult {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

export interface ImportData {
  title: string;
  content: string;
  options: string[];
  answer: string;
  explanation?: string;
  difficulty: string;
  category: string;
}
