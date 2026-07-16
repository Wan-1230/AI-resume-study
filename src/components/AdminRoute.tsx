import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getStoredAdminToken, getAdminMe, clearAdminToken } from '@/lib/adminApi';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const [status, setStatus] = useState<'loading' | 'authorized' | 'denied'>('loading');

  useEffect(() => {
    const token = getStoredAdminToken();
    if (!token) {
      setStatus('denied');
      return;
    }

    getAdminMe()
      .then(() => setStatus('authorized'))
      .catch(() => {
        // 任何错误都清除 token — adminApi 层未传递 HTTP 状态码，
        // 组件层无法可靠区分认证失败与网络错误，保守清除避免凭据泄漏
        clearAdminToken();
        setStatus('denied');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/60 text-sm">验证管理员身份...</div>
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
