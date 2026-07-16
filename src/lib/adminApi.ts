/**
 * 管理员 API 客户端
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const ADMIN_TOKEN_KEY = 'admin_token';

interface AdminAuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: 'admin';
  };
}

interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  github_id: string | null;
  github_username: string | null;
  auth_provider?: 'email' | 'github';
  created_at: string;
  updated_at: string;
}

interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  stats: {
    total: number;
    emailUsers: number;
    githubUsers: number;
  };
}

function getAdminHeaders(): Record<string, string> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 管理员登录
export async function adminLogin(email: string, password: string): Promise<AdminAuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '登录失败' }));
    throw new Error(error.error || '登录失败');
  }

  return response.json();
}

// 验证管理员 token
export async function getAdminMe(): Promise<AdminAuthResponse['user']> {
  const response = await fetch(`${API_BASE}/api/auth/admin/me`, {
    headers: getAdminHeaders(),
  });

  if (!response.ok) {
    throw new Error('验证失败');
  }

  const data = await response.json();
  return data.user;
}

// 获取用户列表
export async function getUsers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<UserListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const response = await fetch(`${API_BASE}/api/admin/users?${query}`, {
    headers: getAdminHeaders(),
  });

  if (!response.ok) {
    throw new Error('获取用户列表失败');
  }

  return response.json();
}

// 获取用户详情
export async function getUserDetail(id: string): Promise<{ user: AdminUser }> {
  const response = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    headers: getAdminHeaders(),
  });

  if (!response.ok) {
    throw new Error('获取用户详情失败');
  }

  return response.json();
}

// 删除用户
export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });

  if (!response.ok) {
    throw new Error('删除用户失败');
  }
}

// Token 管理
export function storeAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}
