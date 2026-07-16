/**
 * 认证 API 客户端
 */

import { clearAdminToken } from './adminApi';

const AUTH_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
    github_id: string | null;
    github_username: string | null;
    auth_provider: 'email' | 'github';
    created_at: string;
    updated_at: string;
  };
}

// 邮箱注册
export async function register(
  email: string,
  password: string,
  username?: string
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '注册失败' }));
    throw new Error(error.error || '注册失败');
  }

  return response.json();
}

// 邮箱登录
export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_BASE}/api/auth/login`, {
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

// 获取 GitHub OAuth 授权 URL
export function getGitHubOAuthUrl(): string {
  return `${AUTH_BASE}/api/auth/github`;
}

// 获取当前用户信息
export async function getMe(token: string): Promise<AuthResponse['user']> {
  const response = await fetch(`${AUTH_BASE}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('获取用户信息失败');
  }

  const data = await response.json();
  return data.user;
}

// 获取已存储的 token
export function getStoredToken(): string | null {
  return localStorage.getItem('auth_token');
}

// 存储 token
export function storeToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

// 清除 token（同时清除管理员 token，防止退出登录后 admin 权限残留）
export function clearToken(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  clearAdminToken();
}
