import { useState, useEffect } from 'react';
import { ArrowLeft, Play, RotateCcw, Clock, CheckCircle, XCircle, Trophy, Target, Timer, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Question, PracticeResult } from '@/types';
import { difficultyConfig } from '@/constants/config';

type PracticeState = 'ready' | 'playing' | 'finished';

export default function PracticePage() {
  const navigate = useNavigate();
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

  useEffect(() => {
    const fetchCategories = async () => {
      const result = await api.categories.getAll();
      setCategories(result);
    };
    fetchCategories();
  }, []);

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

  const startPractice = async () => {
    setPracticeState('playing');
    setTimeElapsed(0);
    setResults([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowAnswer(false);

    const result = await api.questions.getAll({
      categoryId: selectedCategory || undefined,
      difficulty: selectedDifficulty || undefined,
    });

    const allQuestions = result.data;
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length));
    setQuestions(selected);
    setQuestionStartTime(Date.now());
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
  };

  const currentQuestion = questions[currentIndex];
  const correctCount = results.filter(r => r.isCorrect).length;
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0f0f14]/90 backdrop-blur-xl border-b border-[#1e1e28] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#8b8b9a] hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            <h1 className="text-lg font-semibold text-[#e8e8ed]">练习模式</h1>
            <div className="flex items-center space-x-2 text-[#5a5a6e]">
              <Clock className="w-5 h-5" />
              <span className="font-mono">{formatTime(timeElapsed)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {practiceState === 'ready' && (
          <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-[#e8e8ed] mb-6 text-center">配置练习</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-[#8b8b9a] mb-2 font-medium">题目数量</label>
                <div className="flex items-center space-x-4">
                  {[5, 10, 20, 50].map(count => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                        questionCount === count
                          ? 'bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white shadow-md'
                          : 'bg-[#1a1a22] text-[#8b8b9a] hover:bg-[#2a2a38]'
                      }`}
                    >
                      {count} 题
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#8b8b9a] mb-2 font-medium">题目分类</label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="w-full bg-[#141419] border border-[#1e1e28] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:ring-1 focus:ring-primary-500/20 focus:border-primary-500/50"
                >
                  <option value="">全部分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8b8b9a] mb-2 font-medium">难度筛选</label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedDifficulty(null)}
                    className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                      selectedDifficulty === null
                        ? 'bg-gradient-to-r from-accent-500/90 to-accent-600/90 text-white shadow-md'
                        : 'bg-[#1a1a22] text-[#8b8b9a] hover:bg-[#2a2a38]'
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
                            : 'bg-[#1a1a22] text-[#8b8b9a] hover:bg-[#2a2a38]'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={startPractice}
                className="w-full py-4 bg-gradient-to-r from-primary-500/90 to-accent-500/90 hover:from-primary-500 hover:to-accent-500 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-lg shadow-lg hover:shadow-xl btn-hover-scale"
              >
                <Play className="w-6 h-6" />
                <span>开始练习</span>
              </button>
            </div>
          </div>
        )}

        {practiceState === 'playing' && currentQuestion && (
          <div className="space-y-6">
            <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-[#5a5a6e]">进度</span>
                  <span className="text-[#e8e8ed] font-medium">{currentIndex + 1} / {questions.length}</span>
                </div>
                <div className="flex items-center space-x-2 text-[#5a5a6e]">
                  <Timer className="w-4 h-4" />
                  <span className="font-mono">{formatTime(timeElapsed)}</span>
                </div>
              </div>
              <div className="mt-2 h-2 bg-[#1a1a22] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500/90 to-accent-500/90 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-[#1e1e28]">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-primary-500/10 text-primary-500 text-sm rounded-full font-medium">
                    {currentQuestion.category?.name || '未分类'}
                  </span>
                  <span className={`flex items-center space-x-1 ${difficultyConfig[currentQuestion.difficulty].textColor}`}>
                    <span className={`w-2 h-2 rounded-full ${difficultyConfig[currentQuestion.difficulty].color}`}></span>
                    <span className="text-sm">{difficultyConfig[currentQuestion.difficulty].label}</span>
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#e8e8ed]">{currentQuestion.title}</h2>
              </div>

              <div className="p-6">
                <div className="mb-6 bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-4">
                  <p className="text-[#8b8b9a] leading-relaxed">{currentQuestion.content}</p>
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
                            : 'bg-[#1a1a22] border-[#2a2a38] text-[#8b8b9a] hover:border-primary-500/20 hover:bg-[#222228]'
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
                              : 'bg-[#2a2a38] text-[#8b8b9a]'
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
                  <div className="mt-6 p-4 bg-[#1a1a22] border border-[#2a2a38] rounded-xl">
                    <h4 className="font-semibold text-[#e8e8ed] mb-2">解析</h4>
                    <p className="text-[#5a5a6e] text-sm">{currentQuestion.explanation}</p>
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
          <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500/90 to-accent-500/90 p-8 text-center">
              <Trophy className="w-16 h-16 text-white mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">练习完成!</h2>
              <p className="text-white/80">太棒了，继续加油!</p>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-[#e8e8ed]">{questions.length}</div>
                  <div className="text-[#5a5a6e] text-sm">总题数</div>
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
                <span className="text-[#5a5a6e]">用时</span>
                <span className="text-[#e8e8ed] font-mono font-bold">{formatTime(timeElapsed)}</span>
              </div>

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
                        <span className="text-[#8b8b9a] text-sm line-clamp-1 flex-1">{question.title}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-[#5a5a6e]">
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
                  className="flex-1 py-3 bg-[#1a1a22] hover:bg-[#2a2a38] text-[#8b8b9a] font-medium rounded-xl transition-all flex items-center justify-center space-x-2 btn-hover-scale"
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
