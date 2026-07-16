import { useState } from 'react';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, storeAdminToken } from '@/lib/adminApi';

export default function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      const response = await adminLogin(email, password);
      storeAdminToken(response.token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
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

        {/* 登录卡片 */}
        <div className="bg-[#12121a] rounded-2xl p-8 border border-white/[0.06]">
          {/* 标题 */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-primary-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">管理员登录</h1>
            <p className="text-[#5a5a6e] mt-2 text-sm">此页面仅限管理员访问</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium text-[#8a8a9e] mb-2">
                管理员邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-[#0a0a0f] border border-white/[0.06] rounded-xl text-white placeholder-[#3a3a4e] focus:outline-none focus:border-primary-500/50 transition-colors"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-[#8a8a9e] mb-2">
                管理员密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className="w-full pl-11 pr-12 py-3 bg-[#0a0a0f] border border-white/[0.06] rounded-xl text-white placeholder-[#3a3a4e] focus:outline-none focus:border-primary-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a6e] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2 btn-hover-scale"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>验证中...</span>
                </>
              ) : (
                <span>登录管理后台</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
