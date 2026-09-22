import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Share2, Users, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type QuestionStats } from '@/lib/api';
import { Question } from '@/types';
import { useStore } from '@/store';
import { difficultyConfig, difficultyBadge } from '@/constants/config';

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const { favorites, toggleFavorite, isAuthenticated, favoritesError } = useStore();

  const isFavorited = question ? favorites.includes(question.id) : false;
  const [inLibrary, setInLibrary] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [stats, setStats] = useState<QuestionStats | null>(null);

  /** 顶部一句话反馈，自动消失 —— 够用于"已复制/已加入"这类确认，不值得引入 toast 系统 */
  const showNote = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(null), 2500);
  };

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showNote('题目链接已复制');
    } catch {
      showNote('浏览器不允许自动复制，可复制地址栏链接');
    }
  };

  /** 把系统题复制进自己的题库（可改写后自用）；explanation 留空，因为系统题没有真正的解析 */
  const addToLibrary = async () => {
    if (!question) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      const { already } = await api.myQuestions.create({
        title: question.title,
        content: question.content,
        options: question.options,
        answer: question.answer,
        explanation: '',
        difficulty: question.difficulty,
        category_id: question.category_id,
        source_id: question.id,
      });
      setInLibrary(true);
      showNote(already ? '这道题已经在你的题库里了' : '已加入我的题库');
    } catch (e) {
      showNote(e instanceof Error ? e.message : '加入题库失败');
    }
  };

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
    setStats(null);
    api.questions.stats(id).then(setStats);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-xl animate-pulse"></div>
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin relative"></div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-line rounded-full blur-xl"></div>
            <XCircle className="w-16 h-16 text-edge relative" />
          </div>
          <p className="text-muted text-lg mb-6">题目不存在</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-on-brand rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all shadow-lg shadow-primary-500/10 btn-hover-scale btn-ripple"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const difficulty = difficultyConfig[question.difficulty];

  const difficultyColors = difficultyBadge;

  const diffColors = difficultyColors[question.difficulty as keyof typeof difficultyColors];

  return (
    <div className="min-h-screen bg-ink">
      {/* Header */}
      <header className="bg-ink-soft/90 backdrop-blur-xl border-b border-line sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-muted hover:text-brand transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">返回列表</span>
            </button>
            
            <h1 className="text-lg font-semibold text-bright">题目详情</h1>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={shareLink}
                title="复制本题链接"
                className="p-2.5 text-faint hover:text-brand hover:bg-primary-500/10 rounded-xl transition-all btn-hover-scale"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Question Card */}
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          {/* Question Header */}
          <div className="p-8 border-b border-line">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1.5 bg-raised border border-edge text-muted text-xs rounded-lg font-mono">
                  {question.category?.name || '未分类'}
                </span>
                <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${diffColors.bg} ${diffColors.text} ${diffColors.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${diffColors.dot}`}></span>
                  <span className="text-xs font-medium">{difficulty.label}</span>
                </span>
              </div>
              
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('/login');
                    return;
                  }
                  void toggleFavorite(question.id);
                }}
                title={isAuthenticated ? '收藏本题' : '登录后可收藏'}
                className={`p-2.5 rounded-xl transition-all duration-200 btn-hover-scale ${
                  isFavorited
                    ? 'text-warning bg-amber-500/10'
                    : 'text-faint hover:text-warning hover:bg-amber-500/10'
                }`}
              >
                <Star className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
              </button>
            </div>

            {favoritesError && (
              <p className="-mt-4 mb-6 text-sm text-danger">{favoritesError}</p>
            )}

            <h2 className="text-2xl md:text-3xl font-bold text-bright mb-6 leading-relaxed">{question.title}</h2>

            <div className="flex items-center space-x-6 text-sm text-muted">
              {stats && stats.attempts > 0 ? (
                <>
                  <span className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>大家做了 {stats.attempts} 次，答对 {stats.accuracy}%</span>
                  </span>
                  {stats.median_duration_s !== null && (
                    <span className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        多数人用时{' '}
                        {stats.median_duration_s >= 60
                          ? `${Math.round(stats.median_duration_s / 60)} 分钟`
                          : `${stats.median_duration_s} 秒`}
                      </span>
                    </span>
                  )}
                </>
              ) : (
                <span>这道题还没人做过，你答完就会看到统计</span>
              )}
            </div>
          </div>

          {/* Question Content */}
          <div className="p-8">
            {/* Content Section */}
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-primary-500/10 p-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4 text-brand" />
                </div>
                <h3 className="text-lg font-semibold text-bright">题目描述</h3>
              </div>
              <div className="bg-raised border border-edge rounded-xl p-6 text-muted leading-relaxed">
                {question.content}
              </div>
            </div>

            {/* Options Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-bright mb-5">选项</h3>
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
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-success'
                          : showWrong
                          ? 'bg-rose-500/10 border-rose-500/30 text-danger'
                          : isSelected
                          ? 'bg-primary-500/10 border-primary-500/30 text-brand'
                          : 'bg-raised border-edge text-muted hover:border-primary-500/20 hover:bg-lift'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm ${
                          showCorrect
                            ? 'bg-emerald-500 text-ink'
                            : showWrong
                            ? 'bg-rose-500 text-white'
                            : isSelected
                            ? 'bg-primary-500 text-ink'
                            : 'bg-edge text-faint'
                        }`}>
                          {optionLetter}
                        </span>
                        <span className="flex-1 text-sm leading-relaxed">{option.replace(`${optionLetter}. `, '')}</span>
                        {showCorrect && (
                          <span className="flex items-center space-x-1.5 text-success font-medium text-sm">
                            <CheckCircle className="w-5 h-5" />
                            <span>正确答案</span>
                          </span>
                        )}
                        {showWrong && (
                          <span className="flex items-center space-x-1.5 text-danger font-medium text-sm">
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
            <div className="border-t border-line pt-8">
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="w-full flex items-center justify-between p-5 bg-raised border border-edge hover:border-primary-500/20 hover:bg-lift rounded-xl transition-all duration-200 btn-hover-scale"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-500/10 p-2 rounded-lg">
                    <Sparkles className="w-4 h-4 text-brand" />
                  </div>
                  <span className="font-semibold text-bright">答案与解析</span>
                </div>
                {showAnswer ? (
                  <ChevronUp className="w-5 h-5 text-faint" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-faint" />
                )}
              </button>

              {showAnswer && (
                <div className="mt-4 space-y-4 animate-slide-up">
                  <div className="bg-gradient-to-br from-primary-500/10 to-purple-500/10 border border-primary-500/20 rounded-xl p-6">
                    <h4 className="font-semibold text-brand mb-3 text-sm">正确答案</h4>
                    <p className="text-bright text-2xl font-bold font-mono">{question.answer}</p>
                  </div>

                  {question.explanation && (
                    <div className="bg-raised border border-edge rounded-xl p-6">
                      <h4 className="font-semibold text-bright mb-3 text-sm">详细解析</h4>
                      <p className="text-muted leading-relaxed">{question.explanation}</p>
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
            className="flex-1 py-4 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 text-on-brand font-medium rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20 btn-hover-scale btn-ripple"
          >
            开始练习
          </button>
          <button
            onClick={addToLibrary}
            className="flex-1 py-4 bg-surface border border-line hover:border-primary-500/20 hover:bg-raised text-muted hover:text-brand font-medium rounded-xl transition-all duration-200 btn-hover-scale"
          >
            {inLibrary ? '已在我的题库' : '加入我的题库'}
          </button>
        </div>

        {note && <p className="mt-3 text-sm text-muted">{note}</p>}
      </main>
    </div>
  );
}
