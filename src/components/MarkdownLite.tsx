import { useState } from 'react';
import { Check, Copy, Code2 } from 'lucide-react';

/**
 * 极简 Markdown 渲染（只覆盖 AI 回答真正会用到的语法）：
 * 代码块 / 行内代码 / **加粗** / # 标题 / 数字与圆点列表 / 段落。
 *
 * 不引入 markdown 库、也不用 innerHTML：LLM 的输出属于不可信文本，
 * 只拼 React 元素就不存在注入面；将来要支持表格、链接等再换库也不影响调用方。
 */

interface Block {
  type: 'code' | 'heading' | 'list' | 'paragraph';
  lang?: string;
  text?: string;
  items?: string[];
  ordered?: boolean;
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过闭合围栏（未闭合时到文末也走这里）
      blocks.push({ type: 'code', lang: fence[1] || '', text: body.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[2].trim() });
      i += 1;
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)[.、)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (i < lines.length) {
        const b = lines[i].match(/^\s*[-*]\s+(.*)$/);
        const n = lines[i].match(/^\s*(?:\d+)[.、)]\s+(.*)$/);
        if ((ordered && n) || (!ordered && b)) {
          items.push((ordered ? n?.[1] : b?.[1]) || '');
          i += 1;
        } else break;
      }
      blocks.push({ type: 'list', items, ordered });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^(#{1,4})\s/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*(?:\d+)[.、)]\s+/.test(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

/** 引用角标：只认纯数字 [1] [12]，且后面不能紧跟 ( —— 否则那是 Markdown 链接的标题 */
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d{1,2}\](?!\())/g;

function renderInline(text: string, keyBase: string, onCite?: (n: number) => void) {
  // 带 g 的复用正则会记住 lastIndex，每次调用新建一个，避免串行渲染时漏匹配
  const pattern = new RegExp(INLINE_PATTERN.source, 'g');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyBase}-b${n++}`} className="font-semibold text-[#e8e8ed]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('[')) {
      const index = Number(token.slice(1, -1));
      nodes.push(
        <button
          key={`${keyBase}-cite${n++}`}
          type="button"
          onClick={() => onCite?.(index)}
          title="跳到对应来源"
          className="align-super mx-0.5 px-1 rounded bg-primary-500/15 text-primary-400 text-[10px] leading-4 hover:bg-primary-500/30 transition-colors"
        >
          {index}
        </button>
      );
    } else {
      nodes.push(
        <code key={`${keyBase}-c${n++}`} className="px-1.5 py-0.5 bg-[#1a1a22] border border-[#2a2a38] rounded-md text-[13px] text-primary-400 font-mono">
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板被拒时不做跳转，用户仍可手动选中复制
    }
  };

  return (
    <div className="my-3 bg-[#0f0f14] border border-[#1e1e28] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e1e28] bg-[#141419]">
        <span className="flex items-center space-x-1.5 text-[11px] text-[#5a5a6e] font-mono">
          <Code2 className="w-3.5 h-3.5" />
          <span>{lang || 'code'}</span>
        </span>
        <button
          onClick={copy}
          className="flex items-center space-x-1 text-[11px] text-[#5a5a6e] hover:text-primary-500 transition-colors"
          title="复制代码"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed text-[#e8e8ed] font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

export default function MarkdownLite({ content, onCite }: { content: string; onCite?: (n: number) => void }) {
  const blocks = parseBlocks(content);

  return (
    <div className="text-sm leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={index} code={block.text || ''} lang={block.lang} />;
          case 'heading':
            return (
              <p key={index} className="mt-3 mb-1.5 font-semibold text-[#e8e8ed]">
                {renderInline(block.text || '', `h${index}`, onCite)}
              </p>
            );
          case 'list': {
            const items = block.items || [];
            return block.ordered ? (
              <ol key={index} className="my-2 space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex space-x-2">
                    <span className="text-primary-500/80 font-mono shrink-0">{i + 1}.</span>
                    <span className="flex-1">{renderInline(item, `li${index}-${i}`, onCite)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="my-2 space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="flex space-x-2">
                    <span className="text-[#5a5a6e] shrink-0">•</span>
                    <span className="flex-1">{renderInline(item, `ul${index}-${i}`, onCite)}</span>
                  </li>
                ))}
              </ul>
            );
          }
          default:
            return (
              <p key={index} className="my-1.5 whitespace-pre-wrap">
                {renderInline(block.text || '', `p${index}`, onCite)}
              </p>
            );
        }
      })}
    </div>
  );
}
