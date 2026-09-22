import { useState } from 'react';
import { User, Bot, Loader2, Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/lib/chatApi';
import SourceCard from './SourceCard';
import MarkdownLite from './MarkdownLite';

interface ChatMessageProps {
  message: ChatMessageType;
  isLoading?: boolean;
  /** 传了才会渲染赞/踩（要能落到具体某条服务端消息上才有意义） */
  onFeedback?: (feedback: 'up' | 'down' | null) => void;
  onRegenerate?: () => void;
  /** 只有最后一则回答给"重新生成"，中间的重跑会把上下文顺序搞乱 */
  canRegenerate?: boolean;
}

export default function ChatMessage({ message, isLoading, onFeedback, onRegenerate, canRegenerate }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [cited, setCited] = useState<number | null>(null);

  // 点角标 → 滚到对应来源并高亮一下，让人能核对这句话到底从哪儿来的
  const jumpToSource = (index: number) => {
    setCited(index);
    document.getElementById(`source-card-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setCited((cur) => (cur === index ? null : cur)), 2400);
  };

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 浏览器拒绝剪贴板时保持原文可选，不做跳转
    }
  };

  return (
    <div className={`flex space-x-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500/80 to-purple-600/80 rounded-xl flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div className={`rounded-2xl p-4 ${
          isUser 
            ? 'bg-gradient-to-r from-primary-500/90 to-primary-600/90 text-white' 
            : 'bg-[#141419] border border-[#1e1e28] text-[#e8e8ed]'
        }`}>
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">思考中...</span>
            </div>
          ) : isUser ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
          ) : (
            <>
              <MarkdownLite content={message.content} onCite={jumpToSource} />
              {message.streaming && message.content && (
                <span className="inline-block w-1.5 h-4 bg-primary-500/70 align-middle animate-pulse" />
              )}
            </>
          )}
        </div>

        {!isUser && !isLoading && message.content && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={copyAnswer}
              className="flex items-center space-x-1.5 text-xs text-[#5a5a6e] hover:text-primary-500 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制回答'}</span>
            </button>

            {canRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center space-x-1.5 text-xs text-[#5a5a6e] hover:text-primary-500 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重新生成</span>
              </button>
            )}

            {onFeedback && (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => onFeedback(message.feedback === 'up' ? null : 'up')}
                  title="这条有用"
                  aria-pressed={message.feedback === 'up'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    message.feedback === 'up' ? 'bg-emerald-500/15 text-emerald-400' : 'text-[#5a5a6e] hover:bg-[#1a1a22] hover:text-emerald-400'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(message.feedback === 'down' ? null : 'down')}
                  title="这条不对或没用"
                  aria-pressed={message.feedback === 'down'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    message.feedback === 'down' ? 'bg-rose-500/15 text-rose-400' : 'text-[#5a5a6e] hover:bg-[#1a1a22] hover:text-rose-400'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* 来源卡片：数量与答案里的 [n] 编号一一对应，不做截断 */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#5a5a6e] font-medium">参考来源（{message.sources.length} 条）：</p>
            <div className="grid grid-cols-1 gap-2">
              {message.sources.map((source, index) => (
                <SourceCard
                  key={`${source.id || 'src'}-${index}`}
                  source={source}
                  index={index}
                  highlighted={cited === index + 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="w-10 h-10 bg-[#1a1a22] rounded-xl flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-[#8b8b9a]" />
        </div>
      )}
    </div>
  );
}
