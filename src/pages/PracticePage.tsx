import { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock, CheckCircle, XCircle, Trophy, Target, Timer, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { shuffleOptions } from '@/lib/shuffleOptions';
import { learningApi, type PracticeStats, type WrongItem } from '@/lib/learningApi';
import { useStore } from '@/store';
import { Question, PracticeResult } from '@/types';
import { difficultyConfig } from '@/constants/config';

type PracticeState = 'ready' | 'playing' | 'finished';
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export default function PracticePage() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [practiceState, setPracticeState] = useState<PracticeState>('ready');
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wrong, setWrong] = useState<WrongItem[]>([]);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const result = await api.categories.getAll();
      setCategories(result);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setStats(null);
      setWrong([]);
      return;
    }
    learningApi.practice.stats().then(setStats).catch(() => setStats(null));
    learningApi.practice.wrong(20).then(setWrong).catch(() => setWrong([]));
  }, [isAuthenticated]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (practiceState === 'playing') {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [practiceState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /** source = 'wrong' 时只从错题本抽题，忽略分类/难度筛选 */
  const startPractice = async (source: 'filters' | 'wrong' = 'filters') => {
    setStartError(null);
    setPracticeState('playing');
    setTimeElapsed(0);
    setResults([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowAnswer(false);

    // limit 不传时 api.questions.getAll 默认只给 10 题，选 20/50 题会被静默夹死，故显式取足量再抽题
    const result = await api.questions.getAll({
      categoryId: source === 'wrong' ? undefined : (selectedCategory || undefined),
      difficulty: source === 'wrong' ? undefined : (selectedDifficulty || undefined),
      limit: 500,
    });

    let pool = result.data;
    if (source === 'wrong') {
      const wrongIds = new Set(wrong.map((w) => w.question_id));
      pool = pool.filter((q) => wrongIds.has(q.id));
    }
    if (!pool.length) {
      setPracticeState('ready');
      setStartError(source === 'wrong' ? '错题本是空的 —— 先做一轮练习再回来' : '这个筛选条件下没有题目，换个分类或难度');
      return;
    }

    const allQuestions = pool;
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    // 选项也乱序：防止"记住第 3 个是答案"，也避免整卷正确项都落在同一位置
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length)).map(shuffleOptions);
    setQuestions(selected);
    setQuestionStartTime(Date.now());
  };

  const refreshStats = () => {
    learningApi.practice.stats().then(setStats).catch(() => {});
  };

  /** 交卷后把逐题作答上报；服务端按题库重算对错，所以这里只报「选了哪个选项」 */
  const submitSession = async (answered: PracticeResult[]) => {
    if (!isAuthenticated || answered.length === 0) return;
    setSaveState('saving');
    setSaveError(null);
    const now = Date.now();
    try {
      await learningApi.practice.createSession({
        mode: 'drill',
        config: { count: questionCount, category: selectedCategory, difficulty: selectedDifficulty },
        started_at: new Date(now - timeElapsed * 1000).toISOString(),
        finished_at: new Date(now).toISOString(),
        answers: answered.map((r) => ({
          question_id: r.questionId,
          chosen: r.userAnswer,
          duration_s: r.timeSpent,
          // 本次展示的选项顺序：服务端按文本比对判分，不传的话字母会被当成题库原序
          display_options: questions.find((q) => q.id === r.questionId)?.options,
        })),
      });
      setSaveState('saved');
      refreshStats();
    } catch (e) {
      setSaveState('failed');
      setSaveError(e instanceof Error ? e.message : '练习记录保存失败');
    }
  };

  const handleAnswer = (option: string) => {
    if (showAnswer) return;
    setSelectedOption(option);
    setShowAnswer(true);

    const question = questions[currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    const result: PracticeResult = {
      questionId: question.id,
      userAnswer: option,
      correctAnswer: question.answer,
      isCorrect: option === question.answer,
      timeSpent,
    };
    setResults(prev => [...prev, result]);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowAnswer(false);
      setQuestionStartTime(Date.now());
    } else {
      setPracticeState('finished');
      void submitSession(results);
    }
  };

  const restartPractice = () => {
    setPracticeState('ready');
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowAnswer(false);
    setResults([]);
    setTimeElapsed(0);
    setSaveState('idle');
    setSaveError(null);
  };

  const currentQuestion = questions[currentIndex];
  const correctCount = results.filter(r => r.isCorrect).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-ink">
      <header className="bg-ink-soft/90 backdrop-blur-xl border-b border-line sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-muted hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            <h1 className="text-lg font-semibold text-bright">练习模式</h1>
            <div className="flex items-center space-x-2 text-faint">
              <Clock className="w-5 h-5" />
              <span className="font-mono">{formatTime(timeElapsed)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {practiceState === 'ready' && (
          <div className="bg-surface border border-line rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-bright mb-6 text-center">配置练习</h2>

            {!isAuthenticated && (
              <div className="mb-6 flex items-center justify-between gap-4 bg-raised border border-edge rounded-xl px-4 py-3">
                <span className="text-sm text-muted">登录后可保存练习记录、统计正确率与错题本</span>
                <button
                  onClick={() => navigate('/login')}
                  className="shrink-0 text-sm text-primary-500 hover:text-primary-400 font-medium"
                >
                  去登录
                </button>
              </div>
            )}

            {stats && stats.answers > 0 && (
              <div className="mb-6 bg-raised border border-edge rounded-xl p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">历史练习</span>
                  <span className="text-bright font-medium">
                    {stats.sessions} 次 · {stats.answers} 题 · 正确率 {stats.accuracy}%
                  </span>
                </div>
                {stats.by_category
                  .filter((c) => c.category)
                  .slice()
                  .sort((a, b) => a.accuracy - b.accuracy)
                  .slice(0, 3)
                  .map((c) => (
                    <div key={c.category as string} className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted">薄弱：{c.category}</span>
                        <span className="text-faint">{c.correct}/{c.total} · {c.accuracy}%</span>
                      </div>
                      <div className="h-1.5 bg-line rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-500/80 to-amber-500/80" style={{ width: `${c.accuracy}%` }}></div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {wrong.length > 0 && (
              <div className="mb-6 bg-raised border border-edge rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-muted font-medium text-sm">错题本</span>
                  <span className="text-faint text-xs">最近一次答错的 {wrong.length} 题</span>
                </div>
                <ul className="space-y-1.5">
                  {wrong.slice(0, 6).map((w) => (
                    <li key={w.question_id}>
                      <button
                        onClick={() => navigate(`/question/${w.question_id}`)}
                        className="w-full text-left text-sm text-bright hover:text-primary-500 transition-colors flex items-center justify-between gap-3"
                      >
                        <span className="line-clamp-1 flex-1">{w.title || w.question_id}</span>
                        <span className="text-faint text-xs shrink-0">
                          {w.category ? `${w.category} · ` : ''}错 {w.wrong_count} 次
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-muted mb-2 font-medium">题目数量</label>
                <div className="flex items-center space-x-4">
                  {[5, 10, 20, 50].map(count => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                        questionCount === count
                          ? 'bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white shadow-md'
                          : 'bg-raised text-muted hover:bg-edge'
                      }`}
                    >
                      {count} 题
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-muted mb-2 font-medium">题目分类</label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-bright focus:outline-none focus:ring-1 focus:ring-primary-500/20 focus:border-primary-500/50"
                >
                  <option value="">全部分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted mb-2 font-medium">难度筛选</label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedDifficulty(null)}
                    className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                      selectedDifficulty === null
                        ? 'bg-gradient-to-r from-accent-500/90 to-accent-600/90 text-white shadow-md'
                        : 'bg-raised text-muted hover:bg-edge'
                    }`}
                  >
                    全部
                  </button>
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const config = difficultyConfig[diff];
                    return (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                          selectedDifficulty === diff
                            ? `${config.color} text-white shadow-md`
                            : 'bg-raised text-muted hover:bg-edge'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {startError && (
                <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                  {startError}
                </p>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => startPractice('filters')}
                  className="flex-1 py-4 bg-gradient-to-r from-primary-500/90 to-accent-500/90 hover:from-primary-500 hover:to-accent-500 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-lg shadow-lg hover:shadow-xl btn-hover-scale"
                >
                  <Play className="w-6 h-6" />
                  <span>开始练习</span>
                </button>
                {isAuthenticated && wrong.length > 0 && (
                  <button
                    onClick={() => startPractice('wrong')}
                    title="只抽最近一次答错的题"
                    className="flex-1 py-4 bg-raised border border-edge hover:border-rose-500/30 hover:text-rose-400 text-muted font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-lg btn-hover-scale"
                  >
                    <Target className="w-6 h-6" />
                    <span>只练错题 ({wrong.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {practiceState === 'playing' && currentQuestion && (
          <div className="space-y-6">
            <div className="bg-surface border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-faint">进度</span>
                  <span className="text-bright font-medium">{currentIndex + 1} / {questions.length}</span>
                </div>
                <div className="flex items-center space-x-2 text-faint">
                  <Timer className="w-4 h-4" />
                  <span className="font-mono">{formatTime(timeElapsed)}</span>
                </div>
              </div>
              <div className="mt-2 h-2 bg-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500/90 to-accent-500/90 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-line">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-primary-500/10 text-primary-500 text-sm rounded-full font-medium">
                    {currentQuestion.category?.name || '未分类'}
                  </span>
                  <span className={`flex items-center space-x-1 ${difficultyConfig[currentQuestion.difficulty].textColor}`}>
                    <span className={`w-2 h-2 rounded-full ${difficultyConfig[currentQuestion.difficulty].color}`}></span>
                    <span className="text-sm">{difficultyConfig[currentQuestion.difficulty].label}</span>
                  </span>
                </div>
                <h2 className="text-xl font-bold text-bright">{currentQuestion.title}</h2>
              </div>

              <div className="p-6">
                <div className="mb-6 bg-raised border border-edge rounded-xl p-4">
                  <p className="text-muted leading-relaxed">{currentQuestion.content}</p>
                </div>

                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const optionLetter = String.fromCharCode(65 + index);
                    const isCorrect = optionLetter === currentQuestion.answer;
                    const isSelected = selectedOption === optionLetter;
                    const showCorrect = showAnswer && isCorrect;
                    const showWrong = showAnswer && isSelected && !isCorrect;

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswer(optionLetter)}
                        disabled={showAnswer}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          showCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : showWrong
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : isSelected
                            ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                            : 'bg-raised border-edge text-muted hover:border-primary-500/20 hover:bg-lift'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                            showCorrect
                              ? 'bg-emerald-500 text-white'
                              : showWrong
                              ? 'bg-rose-500 text-white'
                              : isSelected
                              ? 'bg-primary-500 text-white'
                              : 'bg-edge text-muted'
                          }`}>
                            {optionLetter}
                          </span>
                          <span className="flex-1">{option.replace(`${optionLetter}. `, '')}</span>
                          {showCorrect && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                          {showWrong && <XCircle className="w-5 h-5 text-rose-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {showAnswer && currentQuestion.explanation && (
                  <div className="mt-6 p-4 bg-raised border border-edge rounded-xl">
                    <h4 className="font-semibold text-bright mb-2">解析</h4>
                    <p className="text-faint text-sm">{currentQuestion.explanation}</p>
                  </div>
                )}

                {showAnswer && (
                  <button
                    onClick={nextQuestion}
                    className="mt-6 w-full py-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 text-white font-medium rounded-xl transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg btn-hover-scale"
                  >
                    <span>{currentIndex < questions.length - 1 ? '下一题' : '查看结果'}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {practiceState === 'finished' && (
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500/90 to-accent-500/90 p-8 text-center">
              <Trophy className="w-16 h-16 text-white mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">练习完成!</h2>
              <p className="text-white/80">太棒了，继续加油!</p>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-raised border border-edge rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-bright">{questions.length}</div>
                  <div className="text-faint text-sm">总题数</div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400">{correctCount}</div>
                  <div className="text-emerald-400/70 text-sm">正确</div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-rose-400">{questions.length - correctCount}</div>
                  <div className="text-rose-400/70 text-sm">错误</div>
                </div>
                <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-primary-500">{accuracy}%</div>
                  <div className="text-primary-500/70 text-sm">正确率</div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2 mb-6">
                <Target className="w-5 h-5 text-primary-500" />
                <span className="text-faint">用时</span>
                <span className="text-bright font-mono font-bold">{formatTime(timeElapsed)}</span>
              </div>

              {!isAuthenticated ? (
                <p className="text-center text-sm text-faint mb-6">
                  未登录，本次成绩不会被保存。
                  <button onClick={() => navigate('/login')} className="ml-1 text-primary-500 hover:text-primary-400">
                    登录后练习
                  </button>
                </p>
              ) : (
                <p
                  className={`text-center text-sm mb-6 ${
                    saveState === 'saved' ? 'text-emerald-400' : saveState === 'failed' ? 'text-rose-400' : 'text-faint'
                  }`}
                >
                  {saveState === 'saving' && '正在保存练习记录…'}
                  {saveState === 'saved' && `已保存到练习记录${stats ? `（累计 ${stats.answers} 题）` : ''}`}
                  {saveState === 'failed' && `保存失败：${saveError}`}
                  {saveState === 'idle' && '练习记录未上报'}
                </p>
              )}

              <div className="space-y-3 mb-8">
                {questions.map((question, index) => {
                  const result = results[index];
                  return (
                    <div
                      key={question.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        result?.isCorrect ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {result?.isCorrect ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                        <span className="text-muted text-sm line-clamp-1 flex-1">{question.title}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-faint">
                          你的答案: <span className={result?.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>{result?.userAnswer}</span>
                        </span>
                        {!result?.isCorrect && (
                          <span className="text-emerald-400">正确答案: {result?.correctAnswer}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={restartPractice}
                  className="flex-1 py-3 bg-raised hover:bg-edge text-muted font-medium rounded-xl transition-all flex items-center justify-center space-x-2 btn-hover-scale"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>重新练习</span>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 py-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 text-white font-medium rounded-xl transition-all shadow-md btn-hover-scale"
                >
                  返回首页
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
