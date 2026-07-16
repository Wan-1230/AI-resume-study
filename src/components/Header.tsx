import { useState } from 'react';
import { Search, User, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import PillNav from './PillNav';
import { useStore } from '@/store';

// GitHub 官方图标组件
function GitHubIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export default function Header({ onSearch }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, user, logout } = useStore();
  const displayName = user?.username || user?.email?.split('@')[0] || '用户';

  const handleSearch = () => {
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href === '/' && location.pathname === '/') {
      // 在首页时，点击首页按钮返回第一页
      e.preventDefault();
      const goToFirst = (window as any).__goToFirstPage;
      if (goToFirst) {
        goToFirst();
      }
    }
  };

  const navItems = [
    { label: '首页', href: '/' },
    { label: 'AI 助手', href: '/chat' },
    { label: '简历优化', href: '/resume' },
    { label: '数据导入', href: '/import' },
    { label: '练习模式', href: '/practice' },
    { label: '我的题库', href: '/my-questions' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <PillNav
          items={navItems}
          activeHref={location.pathname}
          baseColor="#0f0f14"
          pillColor="#1a1a22"
          hoveredPillTextColor="#06d6a0"
          pillTextColor="#8b8b9a"
          initialLoadAnimation={false}
          onItemClick={handleNavClick}
          logo="/logo.png"
          onMobileMenuClick={() => {}}
        />

        <div className="flex items-center space-x-2 sm:space-x-3">
          <a
            href="https://github.com/Wan-1230/-"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:p-2.5 text-[#8b8b9a] hover:text-[#e8e8ed] hover:bg-[#1a1a22] rounded-lg transition-all duration-200"
            title="GitHub"
          >
            <GitHubIcon className="w-5 h-5" />
          </a>

          {isAuthenticated ? (
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* 用户头像 */}
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={displayName}
                  className="w-8 h-8 rounded-lg border border-[#2a2a38]"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-500" />
                </div>
              )}
              <span className="text-[#8b8b9a] text-sm font-medium hidden sm:inline">
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-[#5a5a6e] hover:text-rose-400 hover:bg-[#1a1a22] rounded-lg transition-all duration-200"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-[#e8e8ed] hover:bg-white text-[#0a0a0f] font-semibold transition-all duration-200 btn-hover-scale"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">登录</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
