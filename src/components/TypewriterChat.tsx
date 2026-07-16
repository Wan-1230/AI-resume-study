import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const chatScripts: Message[][] = [
  [
    { role: 'user', content: 'RAG 和微调应该怎么选？' },
    { role: 'assistant', content: '根据使用场景选择：\n• RAG：知识频繁更新、需要引用来源\n• 微调：固定输出风格、特定领域能力' },
    { role: 'user', content: '什么是 GraphRAG？' },
    { role: 'assistant', content: '通过构建知识图谱解决向量 RAG 在跨文档关系、多跳推理上的短板...' },
  ],
  [
    { role: 'user', content: 'Agent Loop 是什么？' },
    { role: 'assistant', content: 'Agent 的核心运行循环：\n1. 观察环境状态\n2. 推理下一步行动\n3. 执行工具调用\n4. 获取反馈结果\n循环执行直到任务完成。' },
    { role: 'user', content: 'MCP 解决什么问题？' },
    { role: 'assistant', content: 'MCP 实现了工具接入的标准化，就像 USB-C 统一了设备接口...' },
  ],
  [
    { role: 'user', content: 'Token 预算怎么分配？' },
    { role: 'assistant', content: '建议分配方式：\n• 系统提示词：固定\n• 历史消息：可压缩\n• RAG 证据：只放最相关片段\n• 输出预留：设定上限' },
    { role: 'user', content: '为什么要做 Prompt Engineering？' },
    { role: 'assistant', content: '清晰的指令能让模型输出更可控、更稳定，减少幻觉...' },
  ],
];

export default function TypewriterChat() {
  const [currentScript, setCurrentScript] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const script = chatScripts[currentScript];

  useEffect(() => {
    if (currentMessageIndex >= script.length) {
      // 当前对话结束，等待后开始下一轮
      const timer = setTimeout(() => {
        setCurrentScript((prev) => (prev + 1) % chatScripts.length);
        setVisibleMessages([]);
        setCurrentMessageIndex(0);
        setDisplayedText('');
      }, 2000);
      return () => clearTimeout(timer);
    }

    const message = script[currentMessageIndex];
    let charIndex = 0;

    // 开始打字效果
    setIsTyping(true);
    setDisplayedText('');

    const typeInterval = setInterval(() => {
      if (charIndex < message.content.length) {
        setDisplayedText(message.content.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        
        // 打字完成后，添加到可见消息列表
        setTimeout(() => {
          setVisibleMessages((prev) => [...prev, message]);
          setDisplayedText('');
          setCurrentMessageIndex((prev) => prev + 1);
        }, 300);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, [currentMessageIndex, currentScript]);

  return (
    <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-6 shadow-2xl h-[500px] flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center space-x-2 mb-4 pb-4 border-b border-[#1e1e28]">
        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        <span className="ml-2 text-[#5a5a6e] text-xs">AI 助手</span>
      </div>
      
      {/* 对话区域 */}
      <div className="flex-1 overflow-hidden space-y-4">
        {visibleMessages.map((msg, i) => (
          <div
            key={`${currentScript}-${i}`}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            {msg.role === 'user' ? (
              <div className="bg-primary-500/20 text-[#e8e8ed] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm whitespace-pre-line">
                {msg.content}
              </div>
            ) : (
              <div className="bg-[#1a1a22] text-[#8b8b9a] px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] border border-[#2a2a38] text-sm whitespace-pre-line">
                {msg.content}
              </div>
            )}
          </div>
        ))}
        
        {/* 正在打字的消息 */}
        {displayedText && (
          <div
            className={`flex ${
              script[currentMessageIndex]?.role === 'user' ? 'justify-end' : 'justify-start'
            } animate-fade-in`}
          >
            {script[currentMessageIndex]?.role === 'user' ? (
              <div className="bg-primary-500/20 text-[#e8e8ed] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm whitespace-pre-line">
                {displayedText}
                {isTyping && <span className="animate-pulse">|</span>}
              </div>
            ) : (
              <div className="bg-[#1a1a22] text-[#8b8b9a] px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] border border-[#2a2a38] text-sm whitespace-pre-line">
                {displayedText}
                {isTyping && <span className="animate-pulse">|</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
