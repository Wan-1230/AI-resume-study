import { ArrowRight, Star, Clock, MessageSquare } from 'lucide-react';
import { Question } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { difficultyConfig } from '@/constants/config';

interface QuestionCardProps {
  question: Question;
}

export default function QuestionCard({ question }: QuestionCardProps) {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useStore();
  const isFavorited = favorites.includes(question.id);

  const difficultyColors = {
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const difficultyDotColors = {
    easy: 'bg-emerald-500',
    medium: 'bg-amber-500',
    hard: 'bg-rose-500',
  };

  return (
    <div 
      className="group relative bg-[#141419] border border-[#1e1e28] rounded-2xl p-6 hover:border-primary-500/20 hover:bg-[#1a1a22] transition-all duration-300 cursor-pointer overflow-hidden btn-hover-scale"
      onClick={() => navigate(`/question/${question.id}`)}
    >
      {/* Hover gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Content */}
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1.5 bg-[#1a1a22] border border-[#2a2a38] text-[#8b8b9a] text-xs rounded-lg font-mono">
              {question.category?.name || '未分类'}
            </span>
            <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${difficultyColors[question.difficulty as keyof typeof difficultyColors]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${difficultyDotColors[question.difficulty as keyof typeof difficultyDotColors]}`}></span>
              <span className="text-xs font-medium">{difficultyConfig[question.difficulty].label}</span>
            </span>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(question.id);
            }}
            className={`p-2 rounded-xl transition-all duration-200 btn-hover-scale ${
              isFavorited
                ? 'text-amber-400 bg-amber-500/10'
                : 'text-[#5a5a6e] hover:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[#e8e8ed] mb-3 line-clamp-2 group-hover:text-primary-500 transition-colors leading-relaxed">
          {question.title}
        </h3>

        {/* Content preview */}
        <p className="text-[#5a5a6e] text-sm mb-5 line-clamp-2 leading-relaxed">
          {question.content}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1e1e28]">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-[#5a5a6e] text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>5分钟</span>
            </div>
            <div className="flex items-center space-x-1.5 text-[#5a5a6e] text-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{question.options?.length || 4}个选项</span>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/question/${question.id}`);
            }}
            className="flex items-center space-x-1.5 text-primary-500 hover:text-primary-400 font-medium text-sm transition-colors group/btn"
          >
            <span>查看详情</span>
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
