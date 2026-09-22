import { useState, useRef } from 'react';
import { ArrowLeft, FileText, Briefcase, Sparkles, Loader2, Copy, Check, RotateCcw, Upload, X, File, Download, Gauge, CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notify } from '@/lib/toast';
import { optimizeResume, matchResume, type MatchReport, type MatchItem } from '@/lib/resumeApi';
import { downloadResumeDocx } from '@/lib/exportDocx';

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
      const pieces = (content.items as Array<{ str?: string }>).map((item) => item.str ?? '');
      text += pieces.join(' ') + '\n';
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
  const [report, setReport] = useState<MatchReport | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMatch = async () => {
    if (!jd.trim() || !resume.trim() || matching) return;
    setMatching(true);
    setMatchError(null);
    setReport(null);
    try {
      setReport(await matchResume(jd.trim(), resume.trim()));
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : '匹配分析失败');
    } finally {
      setMatching(false);
    }
  };

  const handleExport = async () => {
    try {
      const bytes = await downloadResumeDocx('简历-JD匹配报告.docx', {
        jd: jd.trim(),
        resume: resume.trim(),
        optimized: result.trim(),
        report,
      });
      setExported(`已导出 ${(bytes / 1024).toFixed(0)} KB`);
      setTimeout(() => setExported(null), 4000);
    } catch (error) {
      setExported(error instanceof Error ? `导出失败：${error.message}` : '导出失败');
    }
  };

  const handleOptimize = async () => {
    if (!jd.trim() || !resume.trim() || isLoading) return;

    setIsLoading(true);
    setResult('');

    try {
      await optimizeResume(jd.trim(), resume.trim(), (chunk) => {
        setResult(prev => prev + chunk);
      });
    } catch (error) {
      // 透出服务端原因：401「请先登录」被写成「后端未启动」会把人引向完全错误的排查方向
      setResult(error instanceof Error ? `优化失败：${error.message}` : '优化失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板被浏览器拒绝时静默失败，界面已有"已复制"状态可重试
    }
  };

  const handleReset = () => {
    setJd('');
    setResume('');
    setResult('');
    setUploadedFile(null);
    setReport(null);
    setMatchError(null);
    setExported(null);
  };

  const processFile = async (file: File) => {
    const validExtensions = ['pdf', 'docx', 'md', 'markdown', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (!validExtensions.includes(ext)) {
      notify('支持的文件格式：PDF、DOCX、MD、TXT', 'error');
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
      notify('文件解析失败，请尝试其他格式', 'error');
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
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Header */}
      <header className="bg-ink-soft/90 backdrop-blur-xl border-b border-line sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-muted hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h1 className="text-lg font-semibold text-bright">简历优化</h1>
            </div>

            <button
              onClick={handleReset}
              className="p-2 text-faint hover:text-muted hover:bg-raised rounded-xl transition-colors"
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
              <div className="flex-1 flex flex-col bg-surface border border-line rounded-2xl overflow-hidden">
                <div className="flex items-center space-x-2 px-4 py-3 border-b border-line">
                  <Briefcase className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-bright">职位描述 (JD)</span>
                  <span className="text-xs text-faint">粘贴目标岗位的 JD</span>
                </div>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder={`例如：\n\n高级 Java 开发工程师\n\n岗位职责：\n1. 负责核心系统设计与开发\n2. 参与技术方案评审\n3. 解决线上疑难问题\n\n任职要求：\n1. 3年以上 Java 开发经验\n2. 熟悉 Spring Boot、微服务架构\n3. 有高并发系统经验优先`}
                  className="flex-1 w-full bg-transparent px-4 py-3 text-bright placeholder-ghost focus:outline-none resize-none text-sm leading-relaxed"
                />
              </div>

              {/* 简历输入 */}
              <div 
                className={`relative flex-1 flex flex-col bg-surface border rounded-2xl overflow-hidden transition-colors ${
                  isDragging ? 'border-purple-500 bg-purple-500/5' : 'border-line'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-primary-500" />
                    <span className="text-sm font-medium text-bright">我的简历</span>
                    <span className="text-xs text-faint">粘贴或拖拽文件</span>
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
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs text-muted hover:text-purple-400 hover:bg-raised rounded-lg transition-colors disabled:opacity-50"
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
                      <span className="text-sm text-bright">{uploadedFile.name}</span>
                      <span className="text-xs text-faint">{uploadedFile.size}</span>
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">{uploadedFile.type}</span>
                    </div>
                    <button
                      onClick={removeFile}
                      className="p-1 text-faint hover:text-rose-400 transition-colors"
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
                  className="flex-1 w-full bg-transparent px-4 py-3 text-bright placeholder-ghost focus:outline-none resize-none text-sm leading-relaxed relative"
                />
                
                {/* 底部导入文件按钮 */}
                {!uploadedFile && !resume && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={parsingFile}
                      className="w-full py-6 border-2 border-dashed border-edge rounded-xl flex flex-col items-center justify-center space-y-2 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all disabled:opacity-50"
                    >
                      {parsingFile ? (
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-faint" />
                      )}
                      <span className="text-sm text-muted">
                        {parsingFile ? '正在解析文件...' : '点击或拖拽上传简历文件'}
                      </span>
                      <span className="text-xs text-faint">支持 PDF、DOCX、MD、TXT 格式</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 优化按钮 */}
              <button
                onClick={handleOptimize}
                disabled={!jd.trim() || !resume.trim() || isLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-edge disabled:to-edge disabled:text-faint text-white font-semibold rounded-2xl transition-all duration-200 btn-hover-scale flex items-center justify-center space-x-2"
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

              {/* 匹配报告：不改写，只逐条核对 JD 要求与简历证据 */}
              <button
                type="button"
                onClick={handleMatch}
                disabled={!jd.trim() || !resume.trim() || matching}
                className="w-full py-3 border border-edge hover:border-primary-500/50 disabled:opacity-50 text-bright rounded-2xl transition-colors flex items-center justify-center space-x-2"
              >
                {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
                <span>{matching ? '逐条核对中（约 20~40 秒）…' : '生成匹配报告'}</span>
              </button>
              {matchError && <p className="text-sm text-rose-400">{matchError}</p>}
              {exported && <p className="text-sm text-muted">{exported}</p>}
            </div>

            {/* 右侧：结果区 */}
            <div className="flex flex-col bg-surface border border-line rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-bright">优化结果</span>
                </div>
                {result && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs text-muted hover:text-purple-400 hover:bg-raised rounded-lg transition-colors"
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
                    <pre className="whitespace-pre-wrap text-sm text-bright/80 leading-relaxed font-sans">
                      {result}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-raised border border-edge flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-ghost" />
                    </div>
                    <p className="text-faint text-sm mb-1">粘贴 JD 和简历后</p>
                    <p className="text-ghost text-xs">AI 将为你生成优化建议</p>
                  </div>
                )}
                
                {isLoading && !result && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
                      <Loader2 className="w-10 h-10 text-purple-500 animate-spin relative" />
                    </div>
                    <p className="text-faint text-sm mt-4">AI 正在分析 JD 并优化简历...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {report && (
            <div className="mt-6 bg-surface border border-line rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center space-x-3">
                  <Gauge className="w-5 h-5 text-primary-500" />
                  <h3 className="text-lg font-semibold text-bright">匹配报告</h3>
                  <span className="text-2xl font-bold text-primary-500">{report.scores.overall}%</span>
                  <span className="text-xs text-faint">总体</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted">
                  <span>技能 {fmtScore(report.scores.groups.skill)}</span>
                  <span>·</span>
                  <span>经验 {fmtScore(report.scores.groups.experience)}</span>
                  <span>·</span>
                  <span>项目 {fmtScore(report.scores.groups.project)}</span>
                </div>
              </div>

              <p className="text-xs text-faint mb-4">
                JD 拆出 {report.items.length} 条要求，命中 {report.scores.counts.hit} · 部分 {report.scores.counts.partial} · 未命中 {report.scores.counts.missing}。
                分数是按逐条判定汇总算的（命中 1 / 部分 0.5 / 未命中 0），不是模型直接报的数；证据一栏是简历原句，可直接回去核对。
              </p>

              <div className="space-y-2">
                {report.items.map((item) => <MatchRow key={item.id} item={item} />)}
              </div>

              {report.strengths.length > 0 && (
                <div className="mt-5 pt-5 border-t border-line">
                  <p className="text-sm font-medium text-bright mb-2">已经站得住的部分</p>
                  <ul className="space-y-1">
                    {report.strengths.map((text) => (
                      <li key={text} className="text-sm text-muted flex items-start space-x-2">
                        <CircleCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleExport}
                className="mt-6 w-full py-3 rounded-2xl bg-raised border border-edge hover:border-primary-500/40 text-bright font-medium flex items-center justify-center space-x-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>导出 .docx（简历 + 优化稿 + 这份报告）</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function fmtScore(value: number | null) {
  return value === null ? 'JD 未涉及' : `${value}%`;
}

const VERDICT_STYLE: Record<MatchItem['verdict'], { icon: typeof CircleCheck; label: string; className: string }> = {
  hit: { icon: CircleCheck, label: '命中', className: 'text-emerald-400' },
  partial: { icon: CircleDashed, label: '部分命中', className: 'text-amber-400' },
  missing: { icon: CircleX, label: '未命中', className: 'text-rose-400' },
};

function MatchRow({ item }: { item: MatchItem }) {
  const style = VERDICT_STYLE[item.verdict];
  const Icon = style.icon;
  return (
    <div className="px-4 py-3 bg-ink-soft border border-line rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-bright">{item.text}</p>
        <span className={`flex items-center space-x-1 text-xs shrink-0 ${style.className}`}>
          <Icon className="w-4 h-4" /><span>{style.label}</span>
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        证据：{item.evidence ? <span className="text-bright">“{item.evidence}”</span> : '简历里没找到支撑的原句'}
        {item.demoted && <span className="text-amber-400">（判定被下调：说命中但给不出原文）</span>}
      </p>
      {item.note && <p className="mt-1 text-xs text-faint">说明：{item.note}</p>}
      {item.study?.length ? <p className="mt-1 text-xs text-primary-400">可补：{item.study.join('、')}</p> : null}
    </div>
  );
}
