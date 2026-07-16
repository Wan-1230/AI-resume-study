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
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Collection {
  id: string;
  user_id: string;
  question_id: string;
  created_at: string;
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
