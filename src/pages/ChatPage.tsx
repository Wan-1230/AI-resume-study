import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Sparkles, Loader2, Trash2, Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatMessage from '@/components/ChatMessage';
import Empty from '@/components/Empty';
import { useStore } from '@/store';
import {
  ChatMessage as ChatMessageType, sendMessageStream, checkHealth, type HealthStatus,
} from '@/lib/chatApi';
import { threadApi, type ThreadSummary, type MessageFeedback } from '@/lib/threadApi';

const WELCOME_MESSAGE: ChatMessageType = {
  role: 'assistant',
  content: `你好！我是 AI 面试助手 👋

我可以帮你：
• 解答 AI 应用开发相关问题
• 解释大模型、Agent、RAG 等核心概念
• 提供面试准备建议
• 梳理知识点和最佳实践

请问有什么可以帮助你的？`,
  timestamp: Date.now()
};

const SUGGESTED_QUESTIONS = [
  '什么是 RAG？',
  'Agent 和 Workflow 的区别？',
  'Token 是什么？',
  'MCP 解决什么问题？',
  '如何设计 Agent 记忆系统？'
];

export default function ChatPage() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 检查后端连接
  useEffect(() => {
    checkHealth()
      .then(data => { setIsConnected(data.status === 'ok'); setHealth(data); })
      .catch(() => { setIsConnected(false); setHealth(null); });
  }, []);

  const refreshThreads = useCallback(() => {
    if (!isAuthenticated) { setThreads([]); return; }
    threadApi.list().then(setThreads).catch(() => setThreads([]));
  }, [isAuthenticated]);

  useEffect(() => { refreshThreads(); }, [refreshThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const patchLast = (patch: Partial<ChatMessageType>) =>
    setMessages(prev => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });

  /** 一轮问答结束后落库。失败只在界面留一行提示，不打断已经看到的回答 */
  const persistRound = async (question: string, answer: { content: string; sources?: ChatMessageType['sources'] }) => {
    if (!isAuthenticated || !answer.content) return;
    try {
      const threadId = activeId ?? (await threadApi.create()).id;
      if (!activeId) setActiveId(threadId);
      const saved = await threadApi.append(threadId, [
        { role: 'user', content: question },
        { role: 'assistant', content: answer.content, sources: answer.sources || [] },
      ]);
      const assistant = saved.find(m => m.role === 'assistant');
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, serverId: assistant?.id };
        return next;
      });
      refreshThreads();
    } catch (error) {
      setNote(error instanceof Error ? error.message : '这次回答没存上');
    }
  };

  /** 流式过程中攒下来的这轮回答。用 ref 是因为 setMessages 的回调里做副作用不可靠（StrictMode 会双调用） */
  const draftRef = useRef<{ content: string; sources: ChatMessageType['sources'] }>({ content: '', sources: undefined });

  const runStream = async (question: string, history: ChatMessageType[]) => {
    draftRef.current = { content: '', sources: undefined };
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), streaming: true }]);
    setIsLoading(true);
    try {
      await sendMessageStream(
        question,
        history,
        (chunk) => {
          draftRef.current.content += chunk;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          });
        },
        (sources) => {
          draftRef.current.sources = sources;
          patchLast({ sources });
        }
      );
      patchLast({ streaming: false });
    } catch (error) {
      const reason = error instanceof Error ? error.message : '处理请求时出错';
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        // 已经吐出部分内容时保留内容并标注中断，别把用户已经看到的字抹掉
        next[next.length - 1] = {
          ...last,
          streaming: false,
          content: last.content ? `${last.content}\n\n（回答中断：${reason}）` : `抱歉，这次没成功：${reason}`,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
    return draftRef.current;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    // 问候语是界面文案，不该作为对话历史送给模型
    const history = messages.filter(m => m !== WELCOME_MESSAGE);
    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: Date.now() }]);
    setInput('');
    setNote(null);

    const answer = await runStream(question, history);
    void persistRound(question, answer);
  };

  const handleRegenerate = async () => {
    if (isLoading) return;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // 丢掉上一则回答再重问：保留原问题与之前的上下文
    const nextMessages = [...messages];
    if (nextMessages[nextMessages.length - 1]?.role === 'assistant') nextMessages.pop();
    setMessages(nextMessages);
    setNote(null);

    const cutAt = nextMessages.lastIndexOf(lastUser);
    const history = nextMessages.slice(0, cutAt).filter(m => m !== WELCOME_MESSAGE);
    await runStream(lastUser.content, history);
  };

  const handleFeedback = async (index: number, feedback: MessageFeedback) => {
    const target = messages[index];
    if (!activeId || !target.serverId) { setNote('登录后才会记录反馈'); return; }
    setMessages(prev => prev.map((m, i) => (i === index ? { ...m, feedback } : m)));
    try {
      await threadApi.feedback(activeId, target.serverId, feedback);
    } catch (error) {
      setMessages(prev => prev.map((m, i) => (i === index ? { ...m, feedback: target.feedback ?? null } : m)));
      setNote(error instanceof Error ? error.message : '反馈没记下');
    }
  };

  const openThread = async (id: string) => {
    try {
      const { messages: stored } = await threadApi.read(id);
      setActiveId(id);
      setSidebar(false);
      setMessages(stored.map(m => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
        timestamp: Date.parse(m.created_at) || Date.now(),
        serverId: m.id,
        feedback: m.feedback,
      })));
      if (!stored.length) setMessages([WELCOME_MESSAGE]);
    } catch (error) {
      setNote(error instanceof Error ? error.message : '这个会话打不开');
    }
  };

  const startNewThread = () => {
    setActiveId(null);
    setMessages([WELCOME_MESSAGE]);
    setSidebar(false);
    setNote(null);
  };

  const removeThread = async (id: string) => {
    try {
      await threadApi.remove(id);
      if (id === activeId) startNewThread();
      refreshThreads();
    } catch (error) {
      setNote(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleSuggestionClick = (question: string) => setInput(question);

  const lastIndex = messages.length - 1;

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      <header className="bg-ink-soft/90 backdrop-blur-xl border-b border-line sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebar(v => !v)}
                className="p-2 text-muted hover:text-primary-500 hover:bg-raised rounded-xl transition-colors"
                title="历史会话"
              >
                {sidebar ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-muted hover:text-primary-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">返回首页</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h1 className="text-lg font-semibold text-bright">AI 面试助手</h1>
              {isConnected !== null && (
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              )}
            </div>

            <button
              onClick={startNewThread}
              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-muted hover:text-primary-500 hover:bg-raised rounded-xl transition-colors"
              title="开始新对话"
            >
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">新对话</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-6xl w-full mx-auto">
        {sidebar && (
          <aside className="w-60 shrink-0 border-r border-line bg-ink-soft overflow-y-auto">
            <div className="p-3 space-y-1">
              <p className="px-2 py-1 text-xs text-faint">历史会话</p>
              {!isAuthenticated && (
                <button onClick={() => navigate('/login')} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-primary-500 hover:bg-raised rounded-xl">
                  <LogIn className="w-4 h-4" /><span>登录后保留历史</span>
                </button>
              )}
              {isAuthenticated && !threads.length && (
                <Empty
                  title="还没有存下来的会话"
                  description="登录后提第一个问题就会自动存成一条会话。"
                  className="mx-1 mt-1 px-3 py-6 text-left items-start"
                  icon={<MessageSquare className="w-5 h-5" />}
                />
              )}
              {threads.map(t => (
                <div key={t.id} className={`group flex items-center gap-1 rounded-xl ${t.id === activeId ? 'bg-raised' : 'hover:bg-surface'}`}>
                  <button onClick={() => openThread(t.id)} className="flex-1 flex items-start space-x-2 px-3 py-2 text-left min-w-0">
                    <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-faint" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-bright">{t.title}</span>
                      <span className="block text-[11px] text-faint">{t.message_count} 条 · {new Date(t.updated_at).toLocaleDateString('zh-CN')}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => removeThread(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 text-faint hover:text-rose-400 transition-all"
                    title="删除这个会话"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {health && health.llm_status && health.llm_status !== 'ready' && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-400">
                  AI 生成当前不可用，回答只会是知识库里检索到的原文。
                  <span className="block text-amber-400/70 mt-0.5 break-all">
                    {health.llm_status === 'disabled' ? '未配置 LLM_API_KEY' : health.llm_error || '端点不可达'}
                  </span>
                </p>
              </div>
            )}

            {note && <p className="mb-3 text-sm text-rose-400">{note}</p>}

            <div className="space-y-6">
              {messages.map((message, index) => (
                <ChatMessage
                  key={`${message.timestamp}-${index}`}
                  message={message}
                  isLoading={Boolean(message.streaming) && !message.content}
                  canRegenerate={index === lastIndex && message.role === 'assistant' && !message.streaming}
                  onRegenerate={handleRegenerate}
                  onFeedback={message.role === 'assistant' && message.serverId ? (v) => handleFeedback(index, v) : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {messages.length === 1 && (
              <div className="mt-8">
                <p className="text-sm text-faint mb-3">试试问这些：</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(question)}
                      className="px-4 py-2 bg-surface border border-line rounded-xl text-sm text-muted hover:border-primary-500/30 hover:text-primary-500 transition-all"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="bg-ink-soft border-t border-line p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isConnected === false ? '后端服务未启动...' : '输入你的问题...'}
              disabled={isLoading || isConnected === false}
              className="flex-1 bg-surface border border-line rounded-xl px-4 py-3 text-bright placeholder-faint focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isConnected === false}
              className="p-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 disabled:opacity-50 text-white rounded-xl transition-all"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>

          {isConnected === false && (
            <p className="mt-2 text-sm text-rose-400">
              请先启动后端服务：<code className="bg-rose-500/10 px-1 rounded">cd backend && npm start</code>
            </p>
          )}
          {!isAuthenticated && isConnected !== false && (
            <p className="mt-2 text-xs text-faint">未登录时对话不会被保存；登录后可以回看历史会话并对回答点赞/踩。</p>
          )}
        </form>
      </footer>
    </div>
  );
}
