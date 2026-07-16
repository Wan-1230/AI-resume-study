import { useState, useRef } from 'react';
import { ArrowLeft, FileText, Briefcase, Sparkles, Loader2, Copy, Check, RotateCcw, Upload, X, File } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { optimizeResume } from '@/lib/resumeApi';

// 文件解析函数
async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'md' || ext === 'markdown') {
    return await file.text();
  }
  
  if (ext === 'txt') {
    return await file.text();
  }
  
  if (ext === 'pdf') {
    // 使用 PDF.js 解析
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    
    return text;
  }
  
  if (ext === 'docx') {
    // 使用 Mammoth 解析 DOCX
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}

interface UploadedFile {
  file: File;
  name: string;
  size: string;
  type: string;
}

export default function ResumePage() {
  const navigate = useNavigate();
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOptimize = async () => {
    if (!jd.trim() || !resume.trim() || isLoading) return;

    setIsLoading(true);
    setResult('');

    try {
      await optimizeResume(jd.trim(), resume.trim(), (chunk) => {
        setResult(prev => prev + chunk);
      });
    } catch (error) {
      setResult('抱歉，优化过程中出错。请确保后端服务已启动。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // 复制失败
    }
  };

  const handleReset = () => {
    setJd('');
    setResume('');
    setResult('');
    setUploadedFile(null);
  };

  const processFile = async (file: File) => {
    const validExtensions = ['pdf', 'docx', 'md', 'markdown', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (!validExtensions.includes(ext)) {
      alert('支持的文件格式：PDF、DOCX、MD、TXT');
      return;
    }

    setParsingFile(true);
    try {
      const text = await parseFile(file);
      setResume(text);
      setUploadedFile({
        file,
        name: file.name,
        size: formatFileSize(file.size),
        type: ext.toUpperCase()
      });
    } catch (error) {
      alert('文件解析失败，请尝试其他格式');
      console.error('Parse error:', error);
    } finally {
      setParsingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const removeFile = () => {
    setUploadedFile(null);
    setResume('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="bg-[#0f0f14]/90 backdrop-blur-xl border-b border-[#1e1e28] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#8b8b9a] hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h1 className="text-lg font-semibold text-[#e8e8ed]">简历优化</h1>
            </div>

            <button
              onClick={handleReset}
              className="p-2 text-[#5a5a6e] hover:text-[#8b8b9a] hover:bg-[#1a1a22] rounded-xl transition-colors"
              title="重置"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
            {/* 左侧：输入区 */}
            <div className="flex flex-col gap-4">
              {/* JD 输入 */}
              <div className="flex-1 flex flex-col bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
                <div className="flex items-center space-x-2 px-4 py-3 border-b border-[#1e1e28]">
                  <Briefcase className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-[#e8e8ed]">职位描述 (JD)</span>
                  <span className="text-xs text-[#5a5a6e]">粘贴目标岗位的 JD</span>
                </div>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder={`例如：\n\n高级 Java 开发工程师\n\n岗位职责：\n1. 负责核心系统设计与开发\n2. 参与技术方案评审\n3. 解决线上疑难问题\n\n任职要求：\n1. 3年以上 Java 开发经验\n2. 熟悉 Spring Boot、微服务架构\n3. 有高并发系统经验优先`}
                  className="flex-1 w-full bg-transparent px-4 py-3 text-[#e8e8ed] placeholder-[#3a3a4a] focus:outline-none resize-none text-sm leading-relaxed"
                />
              </div>

              {/* 简历输入 */}
              <div 
                className={`relative flex-1 flex flex-col bg-[#141419] border rounded-2xl overflow-hidden transition-colors ${
                  isDragging ? 'border-purple-500 bg-purple-500/5' : 'border-[#1e1e28]'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e28]">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-primary-500" />
                    <span className="text-sm font-medium text-[#e8e8ed]">我的简历</span>
                    <span className="text-xs text-[#5a5a6e]">粘贴或拖拽文件</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.md,.markdown,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={parsingFile}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs text-[#8b8b9a] hover:text-purple-400 hover:bg-[#1a1a22] rounded-lg transition-colors disabled:opacity-50"
                    >
                      {parsingFile ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{parsingFile ? '解析中...' : '上传文件'}</span>
                    </button>
                  </div>
                </div>
                
                {/* 已上传文件显示 */}
                {uploadedFile && (
                  <div className="flex items-center justify-between px-4 py-2 bg-purple-500/10 border-b border-purple-500/20">
                    <div className="flex items-center space-x-2">
                      <File className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-[#e8e8ed]">{uploadedFile.name}</span>
                      <span className="text-xs text-[#5a5a6e]">{uploadedFile.size}</span>
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">{uploadedFile.type}</span>
                    </div>
                    <button
                      onClick={removeFile}
                      className="p-1 text-[#5a5a6e] hover:text-rose-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* 拖拽提示 */}
                {isDragging && (
                  <div className="absolute inset-0 bg-purple-500/10 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                      <p className="text-purple-400 font-medium">释放文件以上传</p>
                    </div>
                  </div>
                )}
                
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder={uploadedFile ? '文件内容已加载，可在下方编辑...' : `拖拽文件到此处，或点击"上传文件"按钮\n\n支持格式：PDF、DOCX、MD、TXT\n\n也可以直接粘贴简历内容`}
                  className="flex-1 w-full bg-transparent px-4 py-3 text-[#e8e8ed] placeholder-[#3a3a4a] focus:outline-none resize-none text-sm leading-relaxed relative"
                />
                
                {/* 底部导入文件按钮 */}
                {!uploadedFile && !resume && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={parsingFile}
                      className="w-full py-6 border-2 border-dashed border-[#2a2a38] rounded-xl flex flex-col items-center justify-center space-y-2 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all disabled:opacity-50"
                    >
                      {parsingFile ? (
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-[#5a5a6e]" />
                      )}
                      <span className="text-sm text-[#8b8b9a]">
                        {parsingFile ? '正在解析文件...' : '点击或拖拽上传简历文件'}
                      </span>
                      <span className="text-xs text-[#5a5a6e]">支持 PDF、DOCX、MD、TXT 格式</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 优化按钮 */}
              <button
                onClick={handleOptimize}
                disabled={!jd.trim() || !resume.trim() || isLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-[#2a2a38] disabled:to-[#2a2a38] disabled:text-[#5a5a6e] text-white font-semibold rounded-2xl transition-all duration-200 btn-hover-scale flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>AI 正在优化中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>开始优化</span>
                  </>
                )}
              </button>
            </div>

            {/* 右侧：结果区 */}
            <div className="flex flex-col bg-[#141419] border border-[#1e1e28] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e28]">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-[#e8e8ed]">优化结果</span>
                </div>
                {result && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs text-[#8b8b9a] hover:text-purple-400 hover:bg-[#1a1a22] rounded-lg transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {result ? (
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-[#c8c8d8] leading-relaxed font-sans">
                      {result}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#1a1a22] border border-[#2a2a38] flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-[#3a3a4a]" />
                    </div>
                    <p className="text-[#5a5a6e] text-sm mb-1">粘贴 JD 和简历后</p>
                    <p className="text-[#3a3a4a] text-xs">AI 将为你生成优化建议</p>
                  </div>
                )}
                
                {isLoading && !result && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
                      <Loader2 className="w-10 h-10 text-purple-500 animate-spin relative" />
                    </div>
                    <p className="text-[#5a5a6e] text-sm mt-4">AI 正在分析 JD 并优化简历...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
