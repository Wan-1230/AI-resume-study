import { useState } from 'react';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, register, getGitHubOAuthUrl } from '@/lib/authApi';
import { useStore } from '@/store';

// GitHub 官方图标组件
function GitHubIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeLogin = useStore(s => s.login);

  const initialError = searchParams.get('error') || null;
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 前端校验
    if (mode === 'register') {
      if (!username.trim()) {
        setError('请输入用户名');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (password.length < 6) {
        setError('密码长度不能少于6位');
        return;
      }
    }

    setLoading(true);
    try {
      const response = mode === 'login'
        ? await login(email, password)
        : await register(email, password, username.trim() || undefined);

      storeLogin(response.token, response.user as any);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-[#5a5a6e] hover:text-primary-500 mb-6 transition-colors btn-hover-scale"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回首页</span>
        </button>

        <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
          {/* 顶部渐变区域 */}
          <div className="bg-gradient-to-r from-primary-500/90 to-purple-600/90 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {mode === 'login' ? '欢迎回来' : '创建账户'}
            </h1>
            <p className="text-white/80 text-sm mt-2">
              {mode === 'login' ? '登录您的账户开始学习' : '注册新账户开启学习之旅'}
            </p>
          </div>

          <div className="p-6">
            {/* GitHub 登录按钮 — 使用 <a> 链接避免浏览器拦截 window.location */}
            <a
              href={getGitHubOAuthUrl()}
              className="w-full py-3 bg-[#24292e] hover:bg-[#2f363d] text-white font-medium rounded-xl transition-all flex items-center justify-center space-x-3 mb-6 btn-hover-scale no-underline"
            >
              <GitHubIcon className="w-5 h-5" />
              <span>{mode === 'login' ? '使用 GitHub 登录' : '使用 GitHub 注册'}</span>
            </a>

            {/* 分隔线 */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#2a2a38]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#141419] px-4 text-[#5a5a6e]">或使用邮箱</span>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 text-rose-400 text-sm">
                {error}
              </div>
            )}

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-[#8b8b9a] text-sm mb-1 font-medium">用户名</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl pl-10 pr-4 py-2.5 text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                      placeholder="输入用户名"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[#8b8b9a] text-sm mb-1 font-medium">邮箱</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl pl-10 pr-4 py-2.5 text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                    placeholder="输入邮箱地址"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#8b8b9a] text-sm mb-1 font-medium">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl pl-10 pr-10 py-2.5 text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                    placeholder="输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a6e] hover:text-[#8b8b9a]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-[#8b8b9a] text-sm mb-1 font-medium">确认密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl pl-10 pr-4 py-2.5 text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                      placeholder="再次输入密码"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 disabled:opacity-50 text-white font-medium rounded-xl transition-all btn-hover-scale flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>处理中...</span>
                  </>
                ) : (
                  <span>{mode === 'login' ? '登录' : '注册'}</span>
                )}
              </button>
            </form>

            {/* 切换登录/注册 */}
            <div className="mt-6 text-center">
              <p className="text-[#5a5a6e] text-sm">
                {mode === 'login' ? '还没有账户？' : '已有账户？'}
                <button
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                  className="ml-1 text-primary-500 hover:text-primary-400 font-medium"
                >
                  {mode === 'login' ? '立即注册' : '立即登录'}
                </button>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[#5a5a6e] text-xs mt-6">
          登录即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
