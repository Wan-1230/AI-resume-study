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

export interface ResumeOptimizeResult {
  optimizedResume: string;
  suggestions: string[];
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
