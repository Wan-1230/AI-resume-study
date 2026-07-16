import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useStore } from '@/store';
import { User } from '@/types';

/**
 * GitHub OAuth 回调处理页面
 * 后端重定向到 /auth/callback?token=xxx&user=xxx
 * 解析参数后存储 token 并跳转到首页
 *
 * 修复记录：
 * 1. 移除多余的 decodeURIComponent — useSearchParams.get() 已自动解码
 * 2. 使用 useNavigate 替代 window.location.replace — SPA 内导航，避免整页刷新
 * 3. 所有中文错误信息使用 encodeURIComponent 编码
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const processed = useRef(false);

  useEffect(() => {
    // 防止 React StrictMode 双重执行和重复处理
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const error = searchParams.get('error');

    // 错误处理（后端重定向时携带 error 参数）
    if (error) {
      console.error('[AuthCallback] OAuth 错误:', error);
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    // 成功：存储 token 并跳转首页
    if (token && userParam) {
      try {
        // searchParams.get() 已自动进行 URL 解码，无需再 decodeURIComponent
        const user = JSON.parse(userParam) as User;
        login(token, user);
        console.log('[AuthCallback] 登录成功，跳转首页');
        navigate('/', { replace: true });
      } catch (err) {
        console.error('[AuthCallback] 用户数据解析失败:', err);
        navigate(`/login?error=${encodeURIComponent('登录数据解析失败')}`, { replace: true });
      }
      return;
    }

    // 缺少参数
    console.warn('[AuthCallback] 缺少 token/user 参数');
    navigate(`/login?error=${encodeURIComponent('授权回调参数缺失')}`, { replace: true });
  }, [searchParams, navigate, login]);

  // 超时兜底：如果 6 秒内未完成登录，强制跳转
  useEffect(() => {
    const timer = setTimeout(() => {
      if (processed.current) return;
      processed.current = true;
      console.warn('[AuthCallback] 登录超时，跳转登录页');
      navigate(`/login?error=${encodeURIComponent('登录超时，请重试')}`, { replace: true });
    }, 6000);
    return () => clearTimeout(timer);
  }, [navigate]);

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
