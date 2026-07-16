import { ExternalLink, BookOpen, HelpCircle } from 'lucide-react';
import { Source } from '@/lib/chatApi';

interface SourceCardProps {
  source: Source;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  const isArticle = source.source === 'article';
  
  return (
    <div className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-4 hover:border-primary-500/20 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="w-6 h-6 bg-primary-500/10 text-primary-500 rounded-lg flex items-center justify-center text-xs font-medium">
            {index + 1}
          </span>
          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
            isArticle 
              ? 'bg-purple-500/10 text-purple-400' 
              : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            {isArticle ? '文章' : '题目'}
          </span>
          <span className="px-2 py-0.5 bg-[#2a2a38] text-[#8b8b9a] rounded-lg text-xs">
            {source.category}
          </span>
        </div>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-[#5a5a6e] hover:text-primary-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      
      <h4 className="font-medium text-[#e8e8ed] mb-2 line-clamp-2">
        {isArticle ? <BookOpen className="w-4 h-4 inline mr-1" /> : <HelpCircle className="w-4 h-4 inline mr-1" />}
        {source.title}
      </h4>
      
      <p className="text-sm text-[#5a5a6e] line-clamp-3">
        {source.content}
      </p>
    </div>
  );
}
