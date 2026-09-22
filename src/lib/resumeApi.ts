/**
 * 简历优化 API 客户端
 */

import { useStore } from '@/store';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function getAuthHeaders(): Record<string, string> {
  const token = useStore.getState().token;
  if (token) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }
  return { 'Content-Type': 'application/json' };
}

export interface ResumeOptimizeRequest {
  jd: string;
  resume: string;
}

export async function optimizeResume(
  jd: string,
  resume: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/resume/optimize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ jd, resume })
    });
  } catch {
    // fetch 抛异常说明请求根本没发出去（后端没起 / 地址不对），与 401、429 是不同的排查方向
    throw new Error('无法连接后端服务，请确认 http://localhost:3001 已启动');
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const reason = detail && typeof detail.error === 'string' ? detail.error : null;
    // 401 一律翻成人话：「未提供认证令牌」对使用者没有指导意义
    if (response.status === 401) throw new Error('请先登录后再优化简历');
    throw new Error(reason || `请求失败（${response.status}）`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      // 只有"这一行不是完整 JSON"可以跳过；服务端明确发来的 error 事件必须冒泡
      let data: { type?: string; content?: string; error?: string };
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue;
      }

      switch (data.type) {
        case 'chunk':
          if (typeof data.content === 'string' && data.content) onChunk(data.content);
          break;
        case 'error':
          throw new Error(data.error || '服务端返回错误');
      }
    }
  }
}

export type MatchVerdict = 'hit' | 'partial' | 'missing';

export interface MatchItem {
  id: string;
  text: string;
  kind: 'skill' | 'experience' | 'project';
  verdict: MatchVerdict;
  /** 简历里的原句片段；null 表示没找到支撑 */
  evidence: string | null;
  note: string | null;
  /** 模型说有命中但给不出原文，服务端降级成 partial 时会带上这个标记 */
  demoted?: boolean;
  /** 站内知识库里相关的条目，用来指"这条想补该看什么" */
  study?: string[];
}

export interface MatchReport {
  scores: {
    overall: number;
    groups: { skill: number | null; experience: number | null; project: number | null };
    counts: { hit: number; partial: number; missing: number };
  };
  items: MatchItem[];
  gaps: string[];
  strengths: string[];
  sections: number;
}

/** POST 匹配分析。两次生成调用，正常要 15~40 秒，调用方需要 loading 态 */
export async function matchResume(jd: string, resume: string): Promise<MatchReport> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/resume/match`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ jd, resume }),
    });
  } catch {
    throw new Error('无法连接后端服务，请确认后端已启动');
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    if (response.status === 401) throw new Error('请先登录后再做匹配分析');
    throw new Error((detail as { error?: string })?.error || `请求失败（${response.status}）`);
  }
  return response.json() as Promise<MatchReport>;
}
