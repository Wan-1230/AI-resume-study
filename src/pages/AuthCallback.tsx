import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useStore } from '@/store';
import { User } from '@/types';

type CallbackState = 'loading' | 'error' | 'timeout';

/**
 * 安全的页面导航：优先使用 React Router navigate（SPA 内导航），
 * 失败时回退到 window.location.replace（完整页面导航）。
 * 返回清理函数，组件卸载时取消兜底定时器。
 */
function safeNavigate(
  navigate: ReturnType<typeof useNavigate>,
  path: string,
  mountedRef: React.MutableRefObject<boolean>
): () => void {
  try {
    navigate(path, { replace: true });
  } catch {
    // navigate 抛出异常时（如 Router 上下文不可用），直接使用 location
    window.location.replace(path);
    return () => {};
  }

  // 验证 navigate 是否真的生效了：如果 100ms 后 URL 没变，使用 location 兜底
  const timerId = setTimeout(() => {
    if (!mountedRef.current) return; // 组件已卸载，不做任何事
    if (!window.location.pathname.startsWith(path.split('?')[0])) {
      window.location.replace(path);
    }
  }, 100);

  return () => clearTimeout(timerId);
}

/** 验证 userParam JSON 至少包含有效的 id 字段 */
function validateUser(data: unknown): data is User {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === 'string' && obj.id.length > 0;
}

/** 处理阶段：用单一状态机替代两个 effect 的 fragile interlock */
type ProcessingStage = 'idle' | 'done';

/**
 * GitHub OAuth 回调处理页面
 * 后端重定向到 /auth/callback?token=xxx&user=xxx
 * 解析参数后存储 token 并跳转到首页
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const mountedRef = useRef(true);
  const stageRef = useRef<ProcessingStage>('idle');
  const [state, setState] = useState<CallbackState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // 组件卸载时标记
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 统一的登录处理逻辑（单一 effect，避免两个 effect 竞态）
  useEffect(() => {
    if (stageRef.current !== 'idle') return;
    stageRef.current = 'done';

    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const error = searchParams.get('error');

    // 立即从 URL 中清除敏感参数，防止泄漏到浏览器历史/Referer/日志
    // CSRF 防护由后端在 GitHub OAuth 回调中通过 oauth_state cookie 验证
    window.history.replaceState(null, '', '/auth/callback');

    // 错误处理（后端重定向时携带 error 参数）
    if (error) {
      console.error('[AuthCallback] OAuth 错误:', error);
      setErrorMsg(error);
      setState('error');
      return;
    }

    // 成功：存储 token 并跳转首页
    if (token && userParam) {
      let user: User;
      try {
        // 先解析 JSON
        const parsed = JSON.parse(userParam);
        // 运行时验证
        if (!validateUser(parsed)) {
          throw new Error('用户数据缺少有效 id');
        }
        user = parsed;
      } catch (err) {
        console.error('[AuthCallback] 用户数据解析失败:', err);
        setErrorMsg('登录数据异常，请重新登录');
        setState('error');
        return;
      }

      // 解析成功后执行登录和导航
      try {
        login(token, user);
        console.log('[AuthCallback] 登录成功，跳转首页');
      } catch (err) {
        console.error('[AuthCallback] 登录存储失败:', err);
        setErrorMsg('登录失败，请重试');
        setState('error');
        return;
      }

      // 导航到首页（返回清理函数用于取消 100ms 兜底定时器）
      const cancelSafeNav = safeNavigate(navigate, '/', mountedRef);

      // 同时启动超时检测：5 秒后若仍在当前页面则标记超时
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        if (window.location.pathname.startsWith('/auth/callback')) {
          console.warn('[AuthCallback] 登录导航超时');
          setErrorMsg('登录超时，请重试');
          setState('timeout');
        }
      }, 5000);

      return () => {
        cancelSafeNav();
        clearTimeout(timer);
      };
    }

    // 缺少参数
    console.warn('[AuthCallback] 缺少 token/user 参数');
    setErrorMsg('授权回调参数缺失');
    setState('error');
  }, [searchParams, navigate, login]);

  const handleRetry = useCallback(() => {
    safeNavigate(navigate, '/login', mountedRef);
  }, [navigate]);

  const handleGoHome = useCallback(() => {
    safeNavigate(navigate, '/', mountedRef);
  }, [navigate]);

  // 加载状态
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-xl animate-pulse" />
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin relative" />
        </div>
        <h2 className="text-[#e8e8ed] text-lg font-medium mb-2">正在完成登录...</h2>
        <p className="text-[#5a5a6e] text-sm">请稍候，正在验证身份信息</p>
      </div>
    );
  }

  // 错误/超时状态
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-[#e8e8ed] text-lg font-semibold mb-2">
          {state === 'timeout' ? '登录超时' : '登录异常'}
        </h2>
        <p className="text-[#8b8b9a] text-sm mb-6">
          {errorMsg || '发生了意外错误，请重新登录'}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleRetry}
            className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            返回登录页
          </button>
          <button
            onClick={handleGoHome}
            className="w-full py-2.5 bg-[#1a1a22] hover:bg-[#2a2a38] text-[#8b8b9a] hover:text-[#e8e8ed] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
