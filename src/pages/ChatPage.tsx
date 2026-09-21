import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatMessage from '@/components/ChatMessage';
import { ChatMessage as ChatMessageType, sendMessageStream, checkHealth, type HealthStatus } from '@/lib/chatApi';

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
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 检查后端连接
  useEffect(() => {
    checkHealth()
      .then(data => {
        setIsConnected(data.status === 'ok');
        setHealth(data);
      })
      .catch(() => {
        setIsConnected(false);
        setHealth(null);
      });
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessageType = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage, {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    }]);
    setInput('');
    setIsLoading(true);

    const patchLast = (patch: Partial<ChatMessageType>) =>
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });

    try {
      // 流式：先出来源，再逐段追加答案，避免整段等 10 秒以上
      await sendMessageStream(
        userMessage.content,
        messages,
        (chunk) =>
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          }),
        (sources) => patchLast({ sources })
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
          content: last.content
            ? `${last.content}\n\n（回答中断：${reason}）`
            : `抱歉，这次没成功：${reason}`,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (question: string) => {
    setInput(question);
  };

  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
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
            
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h1 className="text-lg font-semibold text-[#e8e8ed]">AI 面试助手</h1>
              {isConnected !== null && (
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              )}
            </div>
            
            <button
              onClick={handleClearChat}
              className="p-2 text-[#5a5a6e] hover:text-[#8b8b9a] hover:bg-[#1a1a22] rounded-xl transition-colors"
              title="清空对话"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
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

          <div className="space-y-6">
            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                message={message}
                isLoading={Boolean(message.streaming) && !message.content}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
          
          {/* 建议问题 */}
          {messages.length === 1 && (
            <div className="mt-8">
              <p className="text-sm text-[#5a5a6e] mb-3">试试问这些：</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(question)}
                    className="px-4 py-2 bg-[#141419] border border-[#1e1e28] rounded-xl text-sm text-[#8b8b9a] hover:border-primary-500/30 hover:text-primary-500 transition-all btn-hover-scale"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="bg-[#0f0f14] border-t border-[#1e1e28] p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isConnected === false ? '后端服务未启动...' : '输入你的问题...'}
              disabled={isLoading || isConnected === false}
              className="flex-1 bg-[#141419] border border-[#1e1e28] rounded-xl px-4 py-3 text-[#e8e8ed] placeholder-[#5a5a6e] focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isConnected === false}
              className="p-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 disabled:opacity-50 text-white rounded-xl transition-all btn-hover-scale btn-ripple"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {isConnected === false && (
            <p className="mt-2 text-sm text-rose-400">
              请先启动后端服务：<code className="bg-rose-500/10 px-1 rounded">cd backend && npm start</code>
            </p>
          )}
        </form>
      </footer>
    </div>
  );
}
