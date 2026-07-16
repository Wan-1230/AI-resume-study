import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, ArrowDown, Upload, FileCheck } from 'lucide-react';
import Header from '@/components/Header';
import QuestionCard from '@/components/QuestionCard';
import ScrollReveal from '@/components/ScrollReveal';
import Threads from '@/components/Threads';
import DotNav from '@/components/DotNav';
import Footer from '@/components/Footer';
import TypewriterChat from '@/components/TypewriterChat';
import { useFullPageScroll } from '@/hooks/useFullPageScroll';
import { api } from '@/lib/api';
import { Question } from '@/types';

const PAGE_COUNT = 5; // 总页数（Hero、AI助手、简历优化、题库、页脚）

export default function Home() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const { currentPage, goToPage, goToFirst, transformStyle } = useFullPageScroll({
    totalPages: PAGE_COUNT,
    animationDuration: 800
  });

  // 暴露 goToFirst 到全局，供导航使用
  useEffect(() => {
    (window as any).__goToFirstPage = goToFirst;
    return () => {
      delete (window as any).__goToFirstPage;
    };
  }, [goToFirst]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.questions.getAll({ limit: 6 });
      setQuestions(result.data);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const pageLabels = ['首页', 'AI 助手', '简历优化', '题库', '关于'];

  return (
    <div className="bg-[#0a0a0f] relative">
      <Header />

      {/* 全屏滚动容器 */}
      <div
        className="fixed inset-0"
        style={{
          ...transformStyle,
          willChange: 'transform',
        }}
      >
        {/* Page 1: Hero */}
        <section className="h-screen w-full relative overflow-hidden flex items-center justify-center">
          {/* Threads 背景 */}
          <div className="absolute inset-0 bg-[#0a0a0f]">
            <Threads
              color={[0.5, 0.2, 0.8]}
              amplitude={1.2}
              distance={0}
              enableMouseInteraction={true}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/50 z-[1]"></div>
          
          <div className="relative z-10 text-center max-w-4xl mx-auto px-4 sm:px-6">
            <div className="inline-flex items-center space-x-2 px-3 sm:px-4 py-1.5 bg-[#1a1a22]/80 backdrop-blur-sm border border-[#2a2a38] mb-6 sm:mb-8">
              <span className="px-2 py-0.5 bg-[#e8e8ed] text-[#0a0a0f] text-xs font-bold">NEW</span>
              <span className="text-[#8b8b9a] text-xs sm:text-sm">AI 面试准备平台，已收录 27 篇文章 + 255 道题目</span>
            </div>

            <ScrollReveal
              baseOpacity={0}
              enableBlur={true}
              baseRotation={3}
              blurStrength={8}
              containerClassName="mb-3 sm:mb-4"
              textClassName="text-[#e8e8ed] text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
            >
              掌握 AI Agent 面试核心知识
            </ScrollReveal>

            <ScrollReveal
              baseOpacity={0}
              enableBlur={true}
              baseRotation={2}
              blurStrength={6}
              containerClassName="mb-6 sm:mb-8"
              textClassName="text-[#e8e8ed]/80 text-lg sm:text-xl md:text-2xl"
            >
              平滑的知识体系让学习更加完美
            </ScrollReveal>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => navigate('/practice')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-[#e8e8ed] hover:bg-white text-[#0a0a0f] font-semibold transition-all duration-200 btn-hover-scale"
              >
                开始学习
              </button>
              <button
                onClick={() => goToPage(2)}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-transparent border border-purple-500/50 text-[#e8e8ed] hover:bg-purple-500/20 font-semibold transition-all duration-200 btn-hover-scale"
              >
                浏览题库
              </button>
            </div>

            {/* 滚动提示 */}
            <div className="mt-10 sm:mt-16 flex flex-col items-center animate-bounce">
              <span className="text-[#5a5a6e] text-xs mb-2">向下滚动</span>
              <ArrowDown className="w-4 h-4 text-[#5a5a6e]" />
            </div>
          </div>
        </section>

        {/* Page 2: AI 助手介绍 */}
        <section className="h-screen w-full relative overflow-hidden flex items-center justify-center bg-[#0a0a0f]">
          {/* 机器人背景 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
            <svg viewBox="0 0 200 200" className="w-[600px] h-[600px] text-primary-500" fill="currentColor">
              <circle cx="100" cy="70" r="45" stroke="currentColor" strokeWidth="2" fill="none"/>
              <circle cx="82" cy="60" r="8" fill="currentColor"/>
              <circle cx="118" cy="60" r="8" fill="currentColor"/>
              <path d="M80 82 Q100 95 120 82" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <rect x="60" y="115" width="80" height="50" rx="10" stroke="currentColor" strokeWidth="2" fill="none"/>
              <line x1="100" y1="125" x2="100" y2="155" stroke="currentColor" strokeWidth="2"/>
              <line x1="85" y1="140" x2="115" y2="140" stroke="currentColor" strokeWidth="2"/>
              <rect x="40" y="125" width="20" height="40" rx="5" stroke="currentColor" strokeWidth="2" fill="none"/>
              <rect x="140" y="125" width="20" height="40" rx="5" stroke="currentColor" strokeWidth="2" fill="none"/>
              <line x1="75" y1="115" x2="60" y2="135" stroke="currentColor" strokeWidth="2"/>
              <line x1="125" y1="115" x2="140" y2="135" stroke="currentColor" strokeWidth="2"/>
              <circle cx="60" cy="40" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
              <line x1="70" y1="30" x2="65" y2="25" stroke="currentColor" strokeWidth="2"/>
              <circle cx="140" cy="40" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
              <line x1="130" cy="40" y1="30" x2="135" y2="25" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          
<div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            {/* 左侧内容 */}
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-primary-500/10 border border-primary-500/20 mb-4 sm:mb-6">
                <span className="text-primary-500 text-sm font-medium">AI 驱动</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#e8e8ed] mb-4 sm:mb-6 leading-tight">
                智能问答助手<br/>
                <span className="text-primary-500">精准解答</span>面试难题
              </h2>
              <p className="text-[#8b8b9a] text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed">
                基于 27 篇 AI 应用开发文章构建的知识库，覆盖 LLM、RAG、Agent、MCP 等核心领域。输入任何面试相关问题，AI 助手为你提供专业、准确的解答。
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <button
                  onClick={() => navigate('/chat')}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-all duration-200 btn-hover-scale"
                >
                  立即体验
                </button>
                <div className="flex items-center space-x-2 text-[#5a5a6e]">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">免费使用</span>
                </div>
              </div>
            </div>

            {/* 右侧对话预览 */}
            <div className="order-1 md:order-2">
              <TypewriterChat />
            </div>
          </div>
        </section>

        {/* Page 3: 简历优化介绍 */}
        <section className="h-screen w-full relative overflow-hidden flex items-center justify-center bg-[#0a0a0f]">
          {/* 背景装饰 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.05]">
            <svg viewBox="0 0 200 280" className="w-[400px] h-[560px] text-purple-500" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="30" y="20" width="140" height="240" rx="8" />
              <line x1="50" y1="50" x2="150" y2="50" />
              <line x1="50" y1="70" x2="130" y2="70" />
              <line x1="50" y1="90" x2="140" y2="90" />
              <line x1="50" y1="110" x2="120" y2="110" />
              <rect x="50" y="140" width="40" height="40" rx="4" />
              <line x1="100" y1="145" x2="150" y2="145" />
              <line x1="100" y1="155" x2="140" y2="155" />
              <line x1="100" y1="165" x2="130" y2="165" />
              <circle cx="160" cy="220" r="30" strokeWidth="2" />
              <path d="M150 220 L157 227 L172 212" strokeWidth="2.5" />
            </svg>
          </div>
          
<div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            {/* 左侧功能展示 */}
            <div className="order-2 md:order-1">
              <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-4 sm:p-6 shadow-2xl">
                <div className="space-y-4">
                  {/* 拖拽上传区 */}
                  <div className="border-2 border-dashed border-[#2a2a38] rounded-xl p-6 sm:p-8 text-center hover:border-purple-500/50 transition-colors">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-[#3a3a4a] mx-auto mb-3" />
                    <p className="text-[#5a5a6e] text-sm">拖拽文件到此处</p>
                    <p className="text-[#3a3a4a] text-xs mt-1">支持 PDF、Word、Markdown</p>
                  </div>

                  {/* 支持格式 */}
                  <div className="flex items-center justify-center gap-2 sm:gap-4">
                    {['PDF', 'DOCX', 'MD'].map((format) => (
                      <div key={format} className="flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 bg-[#1a1a22] border border-[#2a2a38] rounded-lg">
                        <FileCheck className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs text-[#8b8b9a]">.{format.toLowerCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧介绍 */}
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 mb-4 sm:mb-6">
                <span className="text-purple-400 text-sm font-medium">智能优化</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#e8e8ed] mb-4 sm:mb-6 leading-tight">
                AI 简历优化<br/>
                <span className="text-purple-400">精准匹配</span>目标岗位
              </h2>
              <p className="text-[#8b8b9a] text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed">
                粘贴或上传简历，输入目标岗位 JD，AI 自动分析匹配度，生成优化建议和改进后的简历，让你的简历更符合岗位要求。
              </p>

              {/* 特性列表 */}
              <div className="space-y-3 mb-6 sm:mb-8">
                {[
                  '智能分析 JD 核心要求',
                  '对比简历找出差距',
                  '生成针对性优化建议',
                  '支持多种文件格式'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <FileCheck className="w-3 h-3 text-purple-400" />
                    </div>
                    <span className="text-[#8b8b9a] text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate('/resume')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-all duration-200 btn-hover-scale"
              >
                优化简历
              </button>
            </div>
          </div>
        </section>

        {/* Page 4: Questions */}
        <section className="h-screen w-full relative overflow-hidden flex items-center justify-center bg-[#0a0a0f]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#e8e8ed] text-center mb-6 sm:mb-8">热门题目</h2>
            {loading ? (
              <div className="flex justify-center">
                <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary-500 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {questions.slice(0, 6).map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))}
              </div>
            )}
            <div className="text-center mt-6 sm:mt-8">
              <button
                onClick={() => navigate('/practice')}
                className="px-6 py-3 bg-[#e8e8ed] hover:bg-white text-[#0a0a0f] font-semibold transition-all"
              >
                查看全部题目
              </button>
            </div>
          </div>
        </section>

        {/* Page 5: Footer */}
        <section className="h-screen w-full relative overflow-hidden flex items-center justify-center bg-[#0a0a0f]">
          <Footer />
        </section>
      </div>

      {/* 圆点导航 */}
      <DotNav 
        total={PAGE_COUNT} 
        current={currentPage} 
        onChange={goToPage}
        labels={pageLabels}
      />

      {/* 页码显示 */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 text-sm text-[#5a5a6e]">
        <span className="text-primary-500 font-semibold">{String(currentPage + 1).padStart(2, '0')}</span>
        <span> / </span>
        <span>{String(PAGE_COUNT).padStart(2, '0')}</span>
      </div>
    </div>
  );
}
