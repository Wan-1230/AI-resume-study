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
import { notify } from '@/lib/toast';
import Empty from '@/components/Empty';
import Skeleton from '@/components/Skeleton';
import { getUsers, deleteUser, clearAdminToken, getRetrievalStats, type RetrievalStats } from '@/lib/adminApi';

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
  const [retrieval, setRetrieval] = useState<RetrievalStats | null>(null);
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

  // 检索质量读不到不该把用户列表也带崩，所以单独一条 effect 且失败静默
  useEffect(() => {
    getRetrievalStats(7).then(setRetrieval).catch(() => setRetrieval(null));
  }, []);

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
      notify('删除失败', 'error');
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
    <div className="min-h-screen bg-ink text-bright">
      {/* 顶部栏 */}
      <header className="bg-panel border-b border-line px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-faint hover:text-brand transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-brand" />
              <span className="font-semibold">管理后台</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-muted hover:text-danger transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-panel rounded-xl p-5 border border-line">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-brand" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-muted text-sm">总用户数</div>
              </div>
            </div>
          </div>
          <div className="bg-panel rounded-xl p-5 border border-line">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-info" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.emailUsers}</div>
                <div className="text-muted text-sm">邮箱用户</div>
              </div>
            </div>
          </div>
          <div className="bg-panel rounded-xl p-5 border border-line">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Github className="w-5 h-5 text-accent-fg" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.githubUsers}</div>
                <div className="text-muted text-sm">GitHub 用户</div>
              </div>
            </div>
          </div>
        </div>

        {/* 检索质量：阈值是不是拍脑袋定的，看这里 */}
        {retrieval && (
          <section className="mb-8 bg-panel border border-line rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">检索质量（近 {retrieval.window_days} 天）</h2>
              <span className="text-xs text-muted">数据来自 retrieval_log，只记查询与命中元数据，不存答案正文</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
              <div>
                <div className="text-xl font-bold">{retrieval.queries}</div>
                <div className="text-muted text-xs">真实查询数</div>
              </div>
              <div>
                <div className="text-xl font-bold">{retrieval.abstain_rate === null ? '—' : `${(retrieval.abstain_rate * 100).toFixed(1)}%`}</div>
                <div className="text-muted text-xs">拒答率（{retrieval.abstained} 次）</div>
              </div>
              <div>
                <div className="text-xl font-bold">{retrieval.avg_latency_ms ?? '—'}<span className="text-xs text-muted">ms</span></div>
                <div className="text-muted text-xs">平均问答耗时</div>
              </div>
              <div>
                <div className="text-xl font-bold">{retrieval.feedback.up} / {retrieval.feedback.down}</div>
                <div className="text-muted text-xs">赞 / 踩（{retrieval.feedback.unrated} 条未评）</div>
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              {retrieval.top1_score_buckets.map((b) => (
                <div key={b.bucket} className="flex items-center space-x-3 text-xs">
                  <span className="w-24 text-muted font-mono">{b.bucket}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500/70"
                      style={{ width: `${retrieval.queries ? Math.min(100, (b.n / retrieval.queries) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-faint">{b.n}</span>
                </div>
              ))}
              {!retrieval.top1_score_buckets.length && <p className="text-xs text-muted">还没有检索记录。</p>}
            </div>

            {retrieval.recent.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-faint">
                    <tr className="text-left border-b border-line">
                      <th className="py-2 font-medium">问了什么</th>
                      <th className="py-2 font-medium">top1 命中</th>
                      <th className="py-2 font-medium text-right">分数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retrieval.recent.map((row, i) => (
                      <tr key={`${row.created_at}-${i}`} className="border-b border-white/[0.03]">
                        <td className="py-2 pr-3 text-bright/90 max-w-xs truncate">{row.query}</td>
                        <td className="py-2 pr-3 text-muted max-w-xs truncate">
                          {row.abstained ? <span className="text-warning">已拒答（无过阈值内容）</span> : row.top_title}
                        </td>
                        <td className="py-2 text-right font-mono text-muted">{row.top_score === null ? '—' : row.top_score.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex space-x-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-faint" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                placeholder="搜索用户名或邮箱..."
                className="w-full pl-11 pr-4 py-2.5 bg-panel border border-line rounded-xl text-bright placeholder-ghost focus:outline-none focus:border-primary-500/50 transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-on-brand text-sm font-medium rounded-xl transition-colors"
            >
              搜索
            </button>
          </div>
        </form>

        {/* 用户表格 */}
        <div className="bg-panel rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-5 py-3.5 text-faint font-medium">用户</th>
                  <th className="text-left px-5 py-3.5 text-faint font-medium">邮箱</th>
                  <th className="text-left px-5 py-3.5 text-faint font-medium hidden sm:table-cell">登录方式</th>
                  <th className="text-left px-5 py-3.5 text-faint font-medium hidden sm:table-cell">注册时间</th>
                  <th className="text-right px-5 py-3.5 text-faint font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8">
                      {/* 骨架占位而不是转圈：表格高度不变，数据到了不跳版 */}
                      <div className="space-y-3">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-4 w-20 ml-auto" />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6">
                      <Empty
                        title={searchTerm ? "没有匹配的用户" : "还没有注册用户"}
                        description={searchTerm ? `「${searchTerm}」在用户名和邮箱里都没命中，换个关键词试试。` : '注册第一个账号后，用户会出现在这里。'}
                        className="border-line bg-transparent"
                      />
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
                              <UserIcon className="w-4 h-4 text-brand" />
                            </div>
                          )}
                          <span className="text-bright">{u.username || '未设置'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{u.email || '-'}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        {u.auth_provider === 'github' ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-purple-500/10 text-accent-fg rounded-lg text-xs">
                            <Github className="w-3.5 h-3.5" />
                            <span>GitHub</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-500/10 text-info rounded-lg text-xs">
                            <Mail className="w-3.5 h-3.5" />
                            <span>邮箱</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-faint hidden sm:table-cell">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setDetailUser(u)}
                            className="px-3 py-1.5 text-xs text-brand hover:bg-primary-500/10 rounded-lg transition-colors"
                          >
                            详情
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="px-3 py-1.5 text-xs text-danger hover:bg-red-500/10 rounded-lg transition-colors"
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
            <div className="px-5 py-3.5 border-t border-line flex items-center justify-between text-sm">
              <span className="text-faint">
                共 {total} 个用户，第 {page}/{totalPages} 页
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition-colors text-faint"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition-colors text-faint"
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
          <div className="bg-raised rounded-2xl p-6 w-full max-w-sm border border-line mx-4">
            <h3 className="text-lg font-semibold text-bright mb-2">确认删除</h3>
            <p className="text-muted text-sm mb-1">
              确定要删除以下用户吗？此操作不可撤销。
            </p>
            <div className="bg-ink rounded-lg p-3 mb-5 mt-3">
              <div className="text-bright text-sm font-medium">
                {deleteTarget.username || '未设置'}
              </div>
              <div className="text-muted text-xs mt-0.5">{deleteTarget.email}</div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-muted hover:text-white transition-colors"
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
          <div className="bg-raised rounded-2xl p-6 w-full max-w-md border border-line mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-bright">用户详情</h3>
              <button
                onClick={() => setDetailUser(null)}
                className="text-faint hover:text-white transition-colors"
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
                  <UserIcon className="w-7 h-7 text-brand" />
                </div>
              )}
              <div>
                <div className="text-bright font-medium text-lg">
                  {detailUser.username || '未设置'}
                </div>
                <div className="text-muted text-sm">{detailUser.email}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                <span className="text-muted text-sm">用户 ID</span>
                <span className="text-bright text-sm font-mono">{detailUser.id}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                <span className="text-muted text-sm">登录方式</span>
                <span className="text-bright text-sm">
                  {detailUser.auth_provider === 'github' ? 'GitHub' : '邮箱'}
                </span>
              </div>
              {detailUser.github_username && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-muted text-sm">GitHub 用户名</span>
                  <span className="text-bright text-sm">{detailUser.github_username}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                <span className="text-muted text-sm flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>注册时间</span>
                </span>
                <span className="text-bright text-sm">{formatDate(detailUser.created_at)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted text-sm flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>更新时间</span>
                </span>
                <span className="text-bright text-sm">{formatDate(detailUser.updated_at)}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 text-sm bg-white/[0.05] hover:bg-white/[0.1] text-bright rounded-lg transition-colors"
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
