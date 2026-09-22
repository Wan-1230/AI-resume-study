import { useState } from 'react';
import { ExternalLink, BookOpen, HelpCircle, ChevronDown } from 'lucide-react';
import { Source } from '@/lib/chatApi';

interface SourceCardProps {
  source: Source;
  index: number;
  /** 答案正文里点了 [n] 角标时高亮对应来源 */
  highlighted?: boolean;
}

export default function SourceCard({ source, index, highlighted }: SourceCardProps) {
  const isArticle = source.source === 'article';
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={`source-card-${index + 1}`}
      className={`bg-raised border rounded-xl p-4 transition-colors ${
        highlighted ? 'border-primary-500/70 ring-1 ring-primary-500/30' : 'border-edge hover:border-primary-500/20'
      }`}
    >
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
          <span className="px-2 py-0.5 bg-edge text-muted rounded-lg text-xs">
            {source.category}
          </span>
        </div>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-faint hover:text-primary-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      
      <h4 className="font-medium text-bright mb-2 line-clamp-2">
        {isArticle ? <BookOpen className="w-4 h-4 inline mr-1" /> : <HelpCircle className="w-4 h-4 inline mr-1" />}
        {source.title}
      </h4>
      
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
        title={expanded ? '收起原文' : '展开原文'}
      >
        <p className={`text-sm text-muted ${expanded ? '' : 'line-clamp-3'}`}>{source.content}</p>
        <span className="mt-1 flex items-center space-x-1 text-[11px] text-faint">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          <span>{expanded ? '收起' : '展开原文'}</span>
        </span>
      </button>
    </div>
  );
}
