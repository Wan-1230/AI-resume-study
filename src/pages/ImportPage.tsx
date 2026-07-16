import { useState, useCallback } from 'react';
import { ArrowLeft, Upload, FileSpreadsheet, FileText, CheckCircle, AlertCircle, Trash2, Download, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { ImportData } from '@/types';

export default function ImportPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [importData, setImportData] = useState<ImportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type.includes('excel') || file.type.includes('spreadsheet') || file.name.endsWith('.csv')
    );
    if (droppedFiles.length > 0) {
      setFiles([...files, ...droppedFiles]);
      processFiles(droppedFiles);
    }
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(file =>
      file.type.includes('excel') || file.type.includes('spreadsheet') || file.name.endsWith('.csv')
    );
    if (selectedFiles.length > 0) {
      setFiles([...files, ...selectedFiles]);
      processFiles(selectedFiles);
    }
  };

  const processFiles = async (selectedFiles: File[]) => {
    setLoading(true);
    setError(null);
    try {
      for (const file of selectedFiles) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsedData: ImportData[] = jsonData.map((row: Record<string, unknown>) => ({
          title: String(row['title'] || row['标题'] || ''),
          content: String(row['content'] || row['题目内容'] || ''),
          options: [
            String(row['option_a'] || row['选项A'] || ''),
            String(row['option_b'] || row['选项B'] || ''),
            String(row['option_c'] || row['选项C'] || ''),
            String(row['option_d'] || row['选项D'] || ''),
          ].filter(Boolean),
          answer: String(row['answer'] || row['正确答案'] || ''),
          explanation: String(row['explanation'] || row['解析'] || ''),
          difficulty: String(row['difficulty'] || row['难度'] || 'medium'),
          category: String(row['category'] || row['分类'] || '未分类'),
        }));

        setImportData(prev => [...prev, ...parsedData]);
      }
    } catch (_err) {
      setError('文件解析失败，请确保文件格式正确');
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const removeRow = (index: number) => {
    setImportData(importData.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (importData.length === 0) {
      setError('请先上传文件');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      await api.questions.importQuestions(importData, 'mock-user-id');
      setSuccess(true);
      setImportData([]);
      setFiles([]);
    } catch (_err) {
      setError('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      { title: '示例题目', content: '题目描述内容', option_a: 'A. 选项一', option_b: 'B. 选项二', option_c: 'C. 选项三', option_d: 'D. 选项四', answer: 'A', explanation: '答案解析', difficulty: 'medium', category: 'Prompt Engineering' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '题库模板');
    XLSX.writeFile(workbook, '题库导入模板.xlsx');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="bg-[#0f0f14]/90 backdrop-blur-xl border-b border-[#1e1e28] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#8b8b9a] hover:text-primary-500 transition-colors btn-hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回首页</span>
            </button>
            <h1 className="text-lg font-semibold text-[#e8e8ed]">数据导入</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-emerald-400 font-medium">导入成功</p>
              <p className="text-[#5a5a6e] text-sm">已成功导入 {importData.length} 道题目</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6 flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-rose-500" />
            <p className="text-rose-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-[#e8e8ed] mb-4">上传文件</h2>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[#2a2a38] rounded-xl p-8 text-center hover:border-primary-500/30 transition-colors bg-[#1a1a22]"
            >
              <Upload className="w-12 h-12 text-[#5a5a6e] mx-auto mb-4" />
              <p className="text-[#8b8b9a] mb-2">拖拽文件到此处，或点击选择文件</p>
              <p className="text-[#5a5a6e] text-sm">支持 Excel (.xlsx, .xls) 和 CSV 文件</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="mt-4 inline-block px-6 py-2 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 text-white rounded-xl cursor-pointer transition-all btn-hover-scale"
              >
                选择文件
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-3">
                    <div className="flex items-center space-x-3">
                      {file.name.endsWith('.csv') ? (
                        <FileText className="w-5 h-5 text-amber-500" />
                      ) : (
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                      )}
                      <span className="text-[#8b8b9a] text-sm">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-[#5a5a6e] hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-[#1a1a22] border border-[#2a2a38] rounded-xl">
              <p className="text-[#5a5a6e] text-sm mb-3">文件格式要求：</p>
              <ul className="text-[#5a5a6e] text-xs space-y-1">
                <li>• 列名：title, content, option_a, option_b, option_c, option_d, answer, explanation, difficulty, category</li>
                <li>• 支持中文列名：标题, 题目内容, 选项A-D, 正确答案, 解析, 难度, 分类</li>
                <li>• difficulty 值：easy, medium, hard</li>
              </ul>
              <button
                onClick={downloadTemplate}
                className="mt-3 flex items-center space-x-2 text-primary-500 hover:text-primary-400 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>下载导入模板</span>
              </button>
            </div>
          </div>

          <div className="bg-[#141419] border border-[#1e1e28] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#e8e8ed]">数据预览</h2>
              <span className="text-[#5a5a6e] text-sm">共 {importData.length} 条</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : importData.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 text-[#2a2a38] mx-auto mb-4" />
                <p className="text-[#5a5a6e]">上传文件后预览数据</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {importData.map((item, index) => (
                  <div key={index} className="bg-[#1a1a22] border border-[#2a2a38] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-[#5a5a6e]">第 {index + 1} 条</span>
                      <button
                        onClick={() => removeRow(index)}
                        className="p-1 text-[#5a5a6e] hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-medium text-[#e8e8ed] text-sm mb-2">{item.title}</h4>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 rounded">{item.category}</span>
                      <span className={`px-2 py-0.5 rounded ${
                        item.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                        item.difficulty === 'hard' ? 'bg-rose-500/10 text-rose-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>{item.difficulty}</span>
                      <span className="text-[#5a5a6e]">答案: {item.answer}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {importData.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full mt-6 py-3 bg-gradient-to-r from-primary-500/90 to-primary-600/90 hover:from-primary-500 hover:to-primary-600 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center space-x-2 btn-hover-scale btn-ripple"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>确认导入 ({importData.length} 条)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
