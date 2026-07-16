import { User, Bot, Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/lib/chatApi';
import SourceCard from './SourceCard';

interface ChatMessageProps {
  message: ChatMessageType;
  isLoading?: boolean;
}

export default function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
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
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {message.content}
            </div>
          )}
        </div>
        
        {/* 来源卡片 */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#5a5a6e] font-medium">参考来源：</p>
            <div className="grid grid-cols-1 gap-2">
              {message.sources.slice(0, 3).map((source, index) => (
                <SourceCard key={index} source={source} index={index} />
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
