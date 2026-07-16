import { FolderOpen, Filter, Sparkles, ChevronRight } from 'lucide-react';
import { Category as CategoryType } from '@/types';
import { difficulties } from '@/constants/config';

interface SidebarProps {
  categories: CategoryType[];
  selectedCategory: string | null;
  selectedDifficulty: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onDifficultyChange: (difficulty: string | null) => void;
}

export default function Sidebar({
  categories,
  selectedCategory,
  selectedDifficulty,
  onCategoryChange,
  onDifficultyChange,
}: SidebarProps) {
  const difficultyColors = {
    easy: 'bg-emerald-500',
    medium: 'bg-amber-500',
    hard: 'bg-rose-500',
  };

  return (
    <aside className="w-72 shrink-0">
      <div className="space-y-6">
        {/* Categories Section */}
        <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-5">
          <div className="flex items-center space-x-2 mb-5">
            <div className="bg-primary-500/10 p-2 rounded-lg">
              <FolderOpen className="w-4 h-4 text-primary-500" />
            </div>
            <h3 className="font-semibold text-[#e8e8ed] text-sm">题目分类</h3>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onCategoryChange(null)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm btn-hover-scale ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white shadow-lg shadow-primary-500/10'
                  : 'text-[#8b8b9a] hover:text-primary-500 hover:bg-[#1a1a22]'
              }`}
            >
              <span>全部分类</span>
              {selectedCategory === null && <ChevronRight className="w-4 h-4" />}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm btn-hover-scale ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white shadow-lg shadow-primary-500/10'
                    : 'text-[#8b8b9a] hover:text-primary-500 hover:bg-[#1a1a22]'
                }`}
              >
                <span className="truncate">{category.name}</span>
                {selectedCategory === category.id && <ChevronRight className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Section */}
        <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-5">
          <div className="flex items-center space-x-2 mb-5">
            <div className="bg-purple-500/10 p-2 rounded-lg">
              <Filter className="w-4 h-4 text-purple-500" />
            </div>
            <h3 className="font-semibold text-[#e8e8ed] text-sm">难度筛选</h3>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onDifficultyChange(null)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm btn-hover-scale ${
                selectedDifficulty === null
                  ? 'bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white shadow-lg shadow-purple-500/10'
                  : 'text-[#8b8b9a] hover:text-purple-400 hover:bg-[#1a1a22]'
              }`}
            >
              <span>全部难度</span>
              {selectedDifficulty === null && <ChevronRight className="w-4 h-4" />}
            </button>
            {difficulties.map((diff) => (
              <button
                key={diff.value}
                onClick={() => onDifficultyChange(diff.value)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 text-sm btn-hover-scale ${
                  selectedDifficulty === diff.value
                    ? 'bg-gradient-to-r from-purple-500/90 to-purple-600/90 text-white shadow-lg shadow-purple-500/10'
                    : 'text-[#8b8b9a] hover:text-purple-400 hover:bg-[#1a1a22]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${difficultyColors[diff.value as keyof typeof difficultyColors]}`}></span>
                  <span>{diff.label}</span>
                </div>
                {selectedDifficulty === diff.value && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tip Card */}
        <div className="relative overflow-hidden bg-[#141419] border border-[#1e1e28] rounded-2xl p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl"></div>
          
          <div className="relative">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-primary-500/10 p-2 rounded-lg">
                <Sparkles className="w-4 h-4 text-primary-500" />
              </div>
              <h3 className="font-semibold text-[#e8e8ed] text-sm">学习提示</h3>
            </div>
            <p className="text-sm text-[#5a5a6e] leading-relaxed">
              上传你的私有题库数据，打造个性化学习体验！支持 Excel 和 CSV 格式。
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
