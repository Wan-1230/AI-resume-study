import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Share2, Bookmark, Eye, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Question } from '@/types';
import { useStore } from '@/store';
import { difficultyConfig } from '@/constants/config';

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const { favorites, toggleFavorite } = useStore();

  const isFavorited = question ? favorites.includes(question.id) : false;

  useEffect(() => {
    const fetchQuestion = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const result = await api.questions.getById(id);
        setQuestion(result);
      } catch (error) {
        console.error('Failed to fetch question:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestion();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-xl animate-pulse"></div>
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin relative"></div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-[#1e1e28] rounded-full blur-xl"></div>
            <XCircle className="w-16 h-16 text-[#2a2a38] relative" />
          </div>
          <p className="text-[#8b8b9a] text-lg mb-6">题目不存在</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all shadow-lg shadow-primary-500/10 btn-hover-scale btn-ripple"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const difficulty = difficultyConfig[question.difficulty];

  const difficultyColors = {
    easy: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/20' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500/20' },
    hard: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-500', border: 'border-rose-500/20' },
  };

  const diffColors = difficultyColors[question.difficulty as keyof typeof difficultyColors];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="bg-[#0f0f14]/90 backdrop-blur-xl border-b border-[#1e1e28] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#8b8b9a] hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">返回列表</span>
            </button>
            
            <h1 className="text-lg font-semibold text-[#e8e8ed]">题目详情</h1>
            
            <div className="flex items-center space-x-2">
              <button className="p-2.5 text-[#5a5a6e] hover:text-primary-500 hover:bg-primary-500/10 rounded-xl transition-all btn-hover-scale">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2.5 text-[#5a5a6e] hover:text-primary-500 hover:bg-primary-500/10 rounded-xl transition-all btn-hover-scale">
                <Bookmark className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Question Card */}
        <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
          {/* Question Header */}
          <div className="p-8 border-b border-[#1e1e28]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1.5 bg-[#1a1a22] border border-[#2a2a38] text-[#8b8b9a] text-xs rounded-lg font-mono">
                  {question.category?.name || '未分类'}
                </span>
                <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${diffColors.bg} ${diffColors.text} ${diffColors.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${diffColors.dot}`}></span>
                  <span className="text-xs font-medium">{difficulty.label}</span>
                </span>
              </div>
              
              <button
                onClick={() => toggleFavorite(question.id)}
                className={`p-2.5 rounded-xl transition-all duration-200 btn-hover-scale ${
                  isFavorited
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-[#5a5a6e] hover:text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <Star className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
              </button>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-[#e8e8ed] mb-6 leading-relaxed">{question.title}</h2>

            <div className="flex items-center space-x-6 text-sm text-[#5a5a6e]">
              <span className="flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>浏览 1.2k</span>
              </span>
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>建议用时 5分钟</span>
              </span>
            </div>
          </div>

          {/* Question Content */}
          <div className="p-8">
            {/* Content Section */}
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-primary-500/10 p-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary-500" />
                </div>
                <h3 className="text-lg font-semibold text-[#e8e8ed]">题目描述</h3>
              </div>
              <div className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-6 text-[#8b8b9a] leading-relaxed">
                {question.content}
              </div>
            </div>

            {/* Options Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-[#e8e8ed] mb-5">选项</h3>
              <div className="space-y-3">
                {question.options.map((option, index) => {
                  const optionLetter = String.fromCharCode(65 + index);
                  const isCorrect = optionLetter === question.answer;
                  const isSelected = selectedOption === optionLetter;
                  const showCorrect = showAnswer && isCorrect;
                  const showWrong = showAnswer && isSelected && !isCorrect;

                  return (
                    <button
                      key={index}
                      onClick={() => !showAnswer && setSelectedOption(optionLetter)}
                      disabled={showAnswer}
                      className={`w-full text-left p-5 rounded-xl border transition-all duration-200 btn-hover-scale ${
                        showCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : showWrong
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : isSelected
                          ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                          : 'bg-[#1a1a22] border-[#2a2a38] text-[#8b8b9a] hover:border-primary-500/20 hover:bg-[#222228]'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm ${
                          showCorrect
                            ? 'bg-emerald-500 text-white'
                            : showWrong
                            ? 'bg-rose-500 text-white'
                            : isSelected
                            ? 'bg-primary-500 text-white'
                            : 'bg-[#2a2a38] text-[#5a5a6e]'
                        }`}>
                          {optionLetter}
                        </span>
                        <span className="flex-1 text-sm leading-relaxed">{option.replace(`${optionLetter}. `, '')}</span>
                        {showCorrect && (
                          <span className="flex items-center space-x-1.5 text-emerald-400 font-medium text-sm">
                            <CheckCircle className="w-5 h-5" />
                            <span>正确答案</span>
                          </span>
                        )}
                        {showWrong && (
                          <span className="flex items-center space-x-1.5 text-rose-400 font-medium text-sm">
                            <XCircle className="w-5 h-5" />
                            <span>错误</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Answer Section */}
            <div className="border-t border-[#1e1e28] pt-8">
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="w-full flex items-center justify-between p-5 bg-[#1a1a22] border border-[#2a2a38] hover:border-primary-500/20 hover:bg-[#222228] rounded-xl transition-all duration-200 btn-hover-scale"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-500/10 p-2 rounded-lg">
                    <Sparkles className="w-4 h-4 text-primary-500" />
                  </div>
                  <span className="font-semibold text-[#e8e8ed]">答案与解析</span>
                </div>
                {showAnswer ? (
                  <ChevronUp className="w-5 h-5 text-[#5a5a6e]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#5a5a6e]" />
                )}
              </button>

              {showAnswer && (
                <div className="mt-4 space-y-4 animate-slide-up">
                  <div className="bg-gradient-to-br from-primary-500/10 to-purple-500/10 border border-primary-500/20 rounded-xl p-6">
                    <h4 className="font-semibold text-primary-400 mb-3 text-sm">正确答案</h4>
                    <p className="text-[#e8e8ed] text-2xl font-bold font-mono">{question.answer}</p>
                  </div>

                  {question.explanation && (
                    <div className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-6">
                      <h4 className="font-semibold text-[#e8e8ed] mb-3 text-sm">详细解析</h4>
                      <p className="text-[#8b8b9a] leading-relaxed">{question.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex space-x-4">
          <button
            onClick={() => navigate('/practice')}
            className="flex-1 py-4 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20 btn-hover-scale btn-ripple"
          >
            开始练习
          </button>
          <button
            onClick={() => navigate('/my-questions')}
            className="flex-1 py-4 bg-[#141419] border border-[#1e1e28] hover:border-primary-500/20 hover:bg-[#1a1a22] text-[#8b8b9a] hover:text-primary-500 font-medium rounded-xl transition-all duration-200 btn-hover-scale"
          >
            加入我的题库
          </button>
        </div>
      </main>
    </div>
  );
}
