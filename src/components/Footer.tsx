import { Github, Mail, FileText, Shield, Scale } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0f0f14] border-t border-[#1e1e28] py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-12">
          {/* 品牌信息 */}
          <div className="md:col-span-1">
            <h3 className="text-xl font-bold text-[#e8e8ed] mb-4">AI 面试题库</h3>
            <p className="text-[#5a5a6e] text-sm leading-relaxed mb-4">
              专注 AI 应用开发面试准备，涵盖大模型、Agent、RAG 等核心领域。
            </p>
            <a
              href="https://github.com/Wan-1230/-"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-10 h-10 bg-[#1a1a22] border border-[#2a2a38] hover:border-[#3a3a4a] text-[#5a5a6e] hover:text-[#e8e8ed] transition-all duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>

          {/* 快速链接 */}
          <div>
            <h4 className="text-sm font-semibold text-[#e8e8ed] mb-4 uppercase tracking-wider">快速链接</h4>
            <ul className="space-y-3">
              <li>
                <a href="/practice" className="text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  练习模式
                </a>
              </li>
              <li>
                <a href="/chat" className="text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  AI 助手
                </a>
              </li>
              <li>
                <a href="/my-questions" className="text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  我的题库
                </a>
              </li>
              <li>
                <a href="/import" className="text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  数据导入
                </a>
              </li>
            </ul>
          </div>

          {/* 法律条款 */}
          <div>
            <h4 className="text-sm font-semibold text-[#e8e8ed] mb-4 uppercase tracking-wider">法律条款</h4>
            <ul className="space-y-3">
              <li>
                <a href="/about" className="flex items-center space-x-2 text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  <FileText className="w-4 h-4" />
                  <span>关于我们</span>
                </a>
              </li>
              <li>
                <a href="/privacy" className="flex items-center space-x-2 text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  <Shield className="w-4 h-4" />
                  <span>隐私政策</span>
                </a>
              </li>
              <li>
                <a href="/terms" className="flex items-center space-x-2 text-[#5a5a6e] hover:text-primary-500 text-sm transition-colors">
                  <Scale className="w-4 h-4" />
                  <span>用户协议</span>
                </a>
              </li>
            </ul>
          </div>

          {/* 联系方式 */}
          <div>
            <h4 className="text-sm font-semibold text-[#e8e8ed] mb-4 uppercase tracking-wider">联系我们</h4>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2 text-[#5a5a6e] text-sm">
                <Mail className="w-4 h-4" />
                <span>wth123500@qq.com</span>
              </li>
              <li className="flex items-center space-x-2 text-[#5a5a6e] text-sm">
                <Github className="w-4 h-4" />
                <a href="https://github.com/Wan-1230/-" target="_blank" rel="noopener noreferrer" className="hover:text-primary-500 transition-colors">
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 底部版权信息 */}
        <div className="border-t border-[#1e1e28] pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-[#5a5a6e] text-sm">
            © {currentYear} AI 面试题库. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span className="text-[#5a5a6e] text-xs">
              京ICP备XXXXXXXX号-1
            </span>
            <span className="text-[#2a2a38]">|</span>
            <span className="text-[#5a5a6e] text-xs">
              京公网安备XXXXXXXXXXXXXX号
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
