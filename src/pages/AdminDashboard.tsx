import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Mail,
  Github,
  Trash2,
  Search,
  Loader2,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { getUsers, deleteUser, clearAdminToken } from '@/lib/adminApi';

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

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ total: 0, emailUsers: 0, githubUsers: 0 });
  const [searchInput, setSearchInput] = useState('');  // 即时更新的输入框值
  const [searchTerm, setSearchTerm] = useState('');     // 防抖后实际用于 API 调用的值
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limit = 15;

  // 输入框变化时防抖 300ms 再触发 API 调用
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setPage(1);
    }, 300);
  };

  // 显式点击搜索按钮时立即触发
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTerm(searchInput);
    setPage(1);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers({ search: searchTerm, page, limit });
      setUsers(data.users);
      setTotal(data.total);
      setStats(data.stats);
    } catch {
      clearAdminToken();
      navigate('/admin/login');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, page, navigate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      alert('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    navigate('/admin/login');
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* 顶部栏 */}
      <header className="bg-[#12121a] border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#5a5a6e] hover:text-primary-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-primary-500" />
              <span className="font-semibold">管理后台</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-[#5a5a6e] hover:text-red-400 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#12121a] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-[#5a5a6e] text-sm">总用户数</div>
              </div>
            </div>
          </div>
          <div className="bg-[#12121a] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.emailUsers}</div>
                <div className="text-[#5a5a6e] text-sm">邮箱用户</div>
              </div>
            </div>
          </div>
          <div className="bg-[#12121a] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Github className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.githubUsers}</div>
                <div className="text-[#5a5a6e] text-sm">GitHub 用户</div>
              </div>
            </div>
          </div>
        </div>

        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex space-x-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                placeholder="搜索用户名或邮箱..."
                className="w-full pl-11 pr-4 py-2.5 bg-[#12121a] border border-white/[0.06] rounded-xl text-white placeholder-[#3a3a4e] focus:outline-none focus:border-primary-500/50 transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              搜索
            </button>
          </div>
        </form>

        {/* 用户表格 */}
        <div className="bg-[#12121a] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3.5 text-[#5a5a6e] font-medium">用户</th>
                  <th className="text-left px-5 py-3.5 text-[#5a5a6e] font-medium">邮箱</th>
                  <th className="text-left px-5 py-3.5 text-[#5a5a6e] font-medium">登录方式</th>
                  <th className="text-left px-5 py-3.5 text-[#5a5a6e] font-medium">注册时间</th>
                  <th className="text-right px-5 py-3.5 text-[#5a5a6e] font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#5a5a6e]">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#5a5a6e]">
                      暂无用户数据
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-3">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-primary-400" />
                            </div>
                          )}
                          <span className="text-white">{u.username || '未设置'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#8a8a9e]">{u.email || '-'}</td>
                      <td className="px-5 py-3.5">
                        {u.auth_provider === 'github' ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-xs">
                            <Github className="w-3.5 h-3.5" />
                            <span>GitHub</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs">
                            <Mail className="w-3.5 h-3.5" />
                            <span>邮箱</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#5a5a6e]">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setDetailUser(u)}
                            className="px-3 py-1.5 text-xs text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                          >
                            详情
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center justify-between text-sm">
              <span className="text-[#5a5a6e]">
                共 {total} 个用户，第 {page}/{totalPages} 页
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition-colors text-[#5a5a6e]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition-colors text-[#5a5a6e]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a24] rounded-2xl p-6 w-full max-w-sm border border-white/[0.06] mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">确认删除</h3>
            <p className="text-[#8a8a9e] text-sm mb-1">
              确定要删除以下用户吗？此操作不可撤销。
            </p>
            <div className="bg-[#0a0a0f] rounded-lg p-3 mb-5 mt-3">
              <div className="text-white text-sm font-medium">
                {deleteTarget.username || '未设置'}
              </div>
              <div className="text-[#5a5a6e] text-xs mt-0.5">{deleteTarget.email}</div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-[#8a8a9e] hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>删除中...</span>
                  </>
                ) : (
                  <span>确认删除</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 用户详情弹窗 */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a24] rounded-2xl p-6 w-full max-w-md border border-white/[0.06] mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">用户详情</h3>
              <button
                onClick={() => setDetailUser(null)}
                className="text-[#5a5a6e] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-4 mb-5">
              {detailUser.avatar_url ? (
                <img
                  src={detailUser.avatar_url}
                  alt=""
                  className="w-14 h-14 rounded-full"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <UserIcon className="w-7 h-7 text-primary-400" />
                </div>
              )}
              <div>
                <div className="text-white font-medium text-lg">
                  {detailUser.username || '未设置'}
                </div>
                <div className="text-[#5a5a6e] text-sm">{detailUser.email}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                <span className="text-[#5a5a6e] text-sm">用户 ID</span>
                <span className="text-white text-sm font-mono">{detailUser.id}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                <span className="text-[#5a5a6e] text-sm">登录方式</span>
                <span className="text-white text-sm">
                  {detailUser.auth_provider === 'github' ? 'GitHub' : '邮箱'}
                </span>
              </div>
              {detailUser.github_username && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-[#5a5a6e] text-sm">GitHub 用户名</span>
                  <span className="text-white text-sm">{detailUser.github_username}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                <span className="text-[#5a5a6e] text-sm flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>注册时间</span>
                </span>
                <span className="text-white text-sm">{formatDate(detailUser.created_at)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#5a5a6e] text-sm flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>更新时间</span>
                </span>
                <span className="text-white text-sm">{formatDate(detailUser.updated_at)}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 text-sm bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
