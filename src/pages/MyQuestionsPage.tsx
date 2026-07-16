import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, FolderOpen, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Question, Category } from '@/types';
import { difficultyConfig } from '@/constants/config';

export default function MyQuestionsPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Question>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpToPage, setJumpToPage] = useState('');
  const questionsPerPage = 20;
  const [newQuestion, setNewQuestion] = useState<Omit<Question, 'id' | 'created_at' | 'updated_at' | 'category'>>({
    user_id: 'mock-user-id',
    category_id: '',
    title: '',
    content: '',
    options: ['', '', '', ''],
    answer: '',
    explanation: '',
    difficulty: 'medium',
    is_public: false,
  });

  useEffect(() => {
    fetchQuestions();
    fetchCategories();
  }, []);

  const fetchQuestions = async () => {
    const result = await api.questions.getAll({ limit: 500 });
    setQuestions(result.data);
  };

  const fetchCategories = async () => {
    const result = await api.categories.getAll();
    setCategories(result);
  };

  // 筛选条件变化时重置页码并滚动到顶部
  useEffect(() => {
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const filteredQuestions = questions.filter(q => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (!q.title.toLowerCase().includes(searchLower) && !q.content.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (selectedCategory && q.category_id !== selectedCategory) return false;
    if (selectedDifficulty && q.difficulty !== selectedDifficulty) return false;
    return true;
  });

  // 分页
  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * questionsPerPage,
    currentPage * questionsPerPage
  );

  // 跳转到指定页
  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setJumpToPage('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这道题目吗？')) {
      await api.questions.delete(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const handleEditStart = (question: Question) => {
    setEditingId(question.id);
    setEditData({
      title: question.title,
      content: question.content,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      category_id: question.category_id,
    });
  };

  const handleEditSave = async (id: string) => {
    const { id: _id, created_at: _created_at, updated_at: _updated_at, category: _category, ...updateData } = editData as Question;
    await api.questions.update(id, updateData);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...editData } as Question : q));
    setEditingId(null);
    setEditData({});
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.title || !newQuestion.content) {
      alert('请填写题目标题和内容');
      return;
    }
    const created = await api.questions.create(newQuestion);
    setQuestions(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewQuestion({
      user_id: 'mock-user-id',
      category_id: '',
      title: '',
      content: '',
      options: ['', '', '', ''],
      answer: '',
      explanation: '',
      difficulty: 'medium',
      is_public: false,
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...newQuestion.options];
    newOptions[index] = value;
    setNewQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const difficultyColors = {
    easy: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    hard: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0f0f14]/90 backdrop-blur-xl border-b border-[#1e1e28] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#8b8b9a] hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            <h1 className="text-lg font-semibold text-[#e8e8ed]">我的题库</h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 text-white rounded-xl transition-all btn-hover-scale"
            >
              <Plus className="w-5 h-5" />
              <span>添加题目</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
              <input
                type="text"
                placeholder="搜索题目..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl pl-10 pr-4 py-2.5 text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a6e]" />
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl pl-10 pr-8 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 appearance-none"
                >
                  <option value="">全部分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <select
                value={selectedDifficulty || ''}
                onChange={(e) => setSelectedDifficulty(e.target.value || null)}
                className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
              >
                <option value="">全部难度</option>
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#1e1e28] flex items-center space-x-2">
            <FolderOpen className="w-5 h-5 text-primary-500" />
            <span className="font-semibold text-[#e8e8ed]">我的题目</span>
            <span className="text-[#5a5a6e] text-sm">({filteredQuestions.length} 道)</span>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-[#2a2a38] mx-auto mb-4" />
              <p className="text-[#5a5a6e]">暂无题目</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all btn-hover-scale"
              >
                添加第一道题目
              </button>
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#1e1e28]">
                {paginatedQuestions.map((question) => {
                const difficulty = difficultyConfig[question.difficulty];
                const colors = difficultyColors[question.difficulty as keyof typeof difficultyColors];

                return (
                  <div key={question.id} className="p-4 hover:bg-[#1a1a22] transition-colors">
                    {editingId === question.id ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={(editData.title || '') as string}
                          onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                          placeholder="题目标题"
                        />
                        <textarea
                          value={(editData.content || '') as string}
                          onChange={(e) => setEditData(prev => ({ ...prev, content: e.target.value }))}
                          className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                          rows={3}
                          placeholder="题目内容"
                        />
                        <select
                          value={(editData.category_id || '') as string}
                          onChange={(e) => setEditData(prev => ({ ...prev, category_id: e.target.value }))}
                          className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                        >
                          <option value="">选择分类</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditSave(question.id)}
                            className="px-4 py-2 bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all btn-hover-scale"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-[#1a1a22] text-[#8b8b9a] rounded-xl hover:bg-[#2a2a38] transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 text-xs rounded-lg font-medium">
                              {question.category?.name || '未分类'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${colors.bg} ${colors.text}`}>
                              {difficulty.label}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-[#e8e8ed] mb-1">{question.title}</h3>
                          <p className="text-[#5a5a6e] text-sm line-clamp-2">{question.content}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-[#5a5a6e]">
                            <span>答案: {question.answer}</span>
                            <span>选项: {question.options.length}个</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEditStart(question)}
                            className="p-2 text-[#5a5a6e] hover:text-primary-500 hover:bg-primary-500/10 rounded-xl transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="p-2 text-[#5a5a6e] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
              
              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-[#1e1e28] flex items-center justify-between">
                  <span className="text-sm text-[#5a5a6e]">
                    第 {currentPage} / {totalPages} 页，共 {filteredQuestions.length} 道题
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-[#1a1a22] border border-[#2a2a38] rounded-xl text-[#8b8b9a] hover:text-primary-500 hover:border-primary-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                    >
                      上一页
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => { setCurrentPage(pageNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className={`w-10 h-10 rounded-xl font-medium transition-all text-sm ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
                              : 'bg-[#1a1a22] border border-[#2a2a38] text-[#8b8b9a] hover:text-primary-500 hover:border-primary-500/30'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-[#1a1a22] border border-[#2a2a38] rounded-xl text-[#8b8b9a] hover:text-primary-500 hover:border-primary-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                    >
                      下一页
                    </button>
                    {/* 跳转到指定页 */}
                    <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-[#2a2a38]">
                      <span className="text-sm text-[#5a5a6e]">前往</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={jumpToPage}
                        onChange={(e) => setJumpToPage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
                        placeholder="页码"
                        className="w-14 h-10 bg-[#1a1a22] border border-[#2a2a38] rounded-lg px-2 text-center text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 text-sm"
                      />
                      <button
                        onClick={handleJumpToPage}
                        disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > totalPages}
                        className="px-3 h-10 bg-[#1a1a22] border border-[#2a2a38] rounded-lg text-[#8b8b9a] hover:text-primary-500 hover:border-primary-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#1e1e28] flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#e8e8ed]">添加新题目</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#5a5a6e] hover:text-[#8b8b9a] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">题目标题</label>
                <input
                  type="text"
                  value={newQuestion.title}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                  placeholder="输入题目标题"
                />
              </div>
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">题目内容</label>
                <textarea
                  value={newQuestion.content}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                  rows={4}
                  placeholder="输入题目内容"
                />
              </div>
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">题目分类</label>
                <select
                  value={newQuestion.category_id}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                >
                  <option value="">选择分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">难度</label>
                <div className="flex space-x-2">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const config = difficultyConfig[diff];
                    const colors = difficultyColors[diff];
                    return (
                      <button
                        key={diff}
                        onClick={() => setNewQuestion(prev => ({ ...prev, difficulty: diff }))}
                        className={`flex-1 py-2.5 rounded-xl font-medium transition-all btn-hover-scale ${
                          newQuestion.difficulty === diff
                            ? `${colors.bg} ${colors.text} border ${colors.border}`
                            : 'bg-[#1a1a22] text-[#8b8b9a] hover:bg-[#2a2a38]'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">选项</label>
                {newQuestion.options.map((option, index) => (
                  <input
                    key={index}
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 mt-2"
                    placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                  />
                ))}
              </div>
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">正确答案</label>
                <select
                  value={newQuestion.answer}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, answer: e.target.value }))}
                  className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                >
                  <option value="">选择正确答案</option>
                  {['A', 'B', 'C', 'D'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#8b8b9a] mb-1 font-medium">答案解析</label>
                <textarea
                  value={newQuestion.explanation || ''}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, explanation: e.target.value }))}
                  className="w-full bg-[#1a1a22] border border-[#2a2a38] rounded-xl px-4 py-2.5 text-[#e8e8ed] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20"
                  rows={3}
                  placeholder="输入答案解析（可选）"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#1e1e28] flex space-x-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-[#1a1a22] text-[#8b8b9a] rounded-xl hover:bg-[#2a2a38] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddQuestion}
                className="flex-1 py-2.5 bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all btn-hover-scale btn-ripple"
              >
                添加题目
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
