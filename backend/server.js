/**
 * AI 面试助手 RAG 后端服务
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { createRagService } = require('./rag/langchain');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const authRoutes = require('./auth');
const learningRoutes = require('./learning');
const myQuestionsRoutes = require('./myquestions');
const { requireAdmin, authenticateToken, optionalAuth } = require('./auth/middleware');
const { chatLimiter, resumeLimiter, llmConcurrencyGate } = require('./guard');
const usersManager = require('./auth/users');

const app = express();
const PORT = process.env.PORT || 3001;

// Render / Cloudflare 在应用前面，不开启 trust proxy 时 req.ip 会是代理地址，
// 限流会把所有访客当成同一个人一起限死
app.set('trust proxy', 1);

const limitChat = chatLimiter();
const limitResume = resumeLimiter();
const gateLlm = llmConcurrencyGate();

// 中间件
const corsOptions = {
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（如 Postman、服务器间调用、curl）
    if (!origin) {
      callback(null, true);
      return;
    }

    // 明确的允许域名列表
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // 允许所有 Cloudflare Pages 子域名（支持预览部署）
    if (origin.match(/^https:\/\/.*\.pages\.dev$/)) {
      callback(null, true);
      return;
    }

    // FRONTEND_URL 未设置时（开发环境），允许所有来源
    if (!process.env.FRONTEND_URL) {
      callback(null, true);
      return;
    }

    console.warn(`[CORS] 拒绝来自未授权来源的请求: ${origin}`);
    callback(new Error('CORS 策略不允许此来源'));
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// 认证路由
app.use('/api/auth', authRoutes);

// 学习数据路由（收藏 / 练习记录 / 统计 / 错题本），逐条自带鉴权
app.use('/api', learningRoutes);

// 我的题库（用户自建题），整个前缀要求登录
app.use('/api/my/questions', myQuestionsRoutes);

// ==================== 管理员 API ====================

// 获取用户列表（支持搜索和分页）
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    let allUsers = usersManager.readUsers().map(usersManager.sanitizeUser);

    if (search) {
      const q = String(search).toLowerCase();
      allUsers = allUsers.filter(
        u =>
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }

    const total = allUsers.length;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, Math.max(1, parseInt(limit)));
    const start = (p - 1) * l;
    const items = allUsers.slice(start, start + l);

    // 统计
    const all = usersManager.readUsers();
    const stats = {
      total: all.length,
      emailUsers: all.filter(u => u.auth_provider === 'email').length,
      githubUsers: all.filter(u => u.auth_provider === 'github').length,
    };

    res.json({ users: items, total, page: p, limit: l, stats });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 获取用户详情
app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const user = usersManager.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: usersManager.sanitizeUser(user) });
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// 删除用户
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const allUsers = usersManager.readUsers();
    const index = allUsers.findIndex(u => u.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }
    allUsers.splice(index, 1);
    usersManager.writeUsers(allUsers);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// RAG 组件（LangChain 管线：加载 → 分块 → 嵌入 → 存储 → 检索 → 生成，见 LANGCHAIN_RAG.md）
let ragService = null;

// 初始化 RAG 系统
async function initializeRAG() {
  console.log('🚀 初始化 AI 面试助手 RAG 系统\n');

  ragService = await createRagService();

  // 检查是否需要导入数据
  const docCount = await ragService.count();
  if (docCount === 0) {
    console.log('\n📥 数据库为空，开始导入数据...');
    await ragService.ingest();
  }

  console.log('\n✅ RAG 系统初始化完成\n');
}

// API 路由

// 问答接口（公开可试用，但按 IP 限流 + 并发闸门，防止 API Key 被路人刷爆）
app.post('/api/chat', optionalAuth, limitChat, gateLlm, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }

    // 检索 + 生成（service 内部处理 LLM 不可用的降级）
    const { answer, sources } = await ragService.chat(message, history);

    res.json({ answer, sources });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: '处理请求时出错' });
  }
});

// 流式问答接口
app.post('/api/chat/stream', optionalAuth, limitChat, gateLlm, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 检索 → 发送来源 → 流式生成（service 内部处理 LLM 不可用的降级）
    await ragService.chatStream(message, history, {
      onSources: (sources) => {
        res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
      },
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    });

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: '处理请求时出错' })}\n\n`);
    res.end();
  }
});

// 获取文章列表
app.get('/api/articles', (req, res) => {
  const articlesPath = path.join(__dirname, 'data', 'articles.json');
  
  if (fs.existsSync(articlesPath)) {
    const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
    res.json(articles);
  } else {
    res.json([]);
  }
});

// 获取题目列表
app.get('/api/questions', (req, res) => {
  const questionsPath = path.join(__dirname, 'data', 'questions.json');
  
  if (fs.existsSync(questionsPath)) {
    const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
    res.json(questions);
  } else {
    res.json([]);
  }
});

// 简历优化接口（流式）
// 要求登录：整份简历要外送第三方推理服务，额度也比问答紧
app.post('/api/resume/optimize', authenticateToken, limitResume, gateLlm, async (req, res) => {
  try {
    const { jd, resume } = req.body;
    
    if (!jd || !resume) {
      return res.status(400).json({ error: '请提供 JD 和简历内容' });
    }
    
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    if (!ragService || ragService.llmStatus !== 'ready') {
      const reason = ragService ? `（${ragService.llmStatus}: ${ragService.llmError || '未配置'}）` : '';
      res.write(`data: ${JSON.stringify({ type: 'error', error: `LLM 服务当前不可用${reason}` })}\n\n`);
      res.end();
      return;
    }
    
    const systemPrompt = `你是一位资深的 HR 和职业规划顾问，擅长根据职位描述（JD）优化简历。

你的任务：
1. 分析 JD 的核心要求（技能、经验、职责、加分项）
2. 对比用户简历，找出匹配度高的部分和需要强化的部分
3. 生成优化后的简历，保持用户原有格式，但增强与 JD 的匹配度
4. 在简历末尾给出具体的修改建议说明

输出格式：
- 直接输出优化后的简历正文（保持原有格式结构）
- 简历结束后，空两行，输出"---修改建议---"
- 在修改建议部分，列出具体的优化点和原因

注意：
- 保持简历的真实性，不要编造经历
- 优化措辞使其更专业、更匹配 JD
- 突出与 JD 相关的技能和经验
- 使用专业但易读的语言`;

    const userMessage = `请根据以下 JD 优化我的简历：

【职位描述】
${jd}

【我的简历】
${resume}

请输出优化后的完整简历，并在最后给出修改建议。`;

    const stream = await ragService.llm.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage)
    ]);

    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
      }
    }
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Resume optimize error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: '优化过程中出错' })}\n\n`);
    res.end();
  }
});

// 健康检查
app.get('/api/health', async (req, res) => {
  const docCount = ragService ? await ragService.count() : 0;
  const health = ragService
    ? ragService.health()
    : { vector_backend: null, has_llm: false, rag_engine: 'langchain' };
  res.json({ status: 'ok', documents_count: docCount, ...health });
});

// 统一 JSON 错误响应：路由内抛出的异常默认会被 Express 以 HTML 堆栈返回，前端 JSON 解析直接崩
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error(`[api] ${req.method} ${req.originalUrl} →`, error.message);
  if (res.headersSent) return;
  res.status(error.status || 500).json({ error: '服务器处理请求时出错' });
});

// 启动服务
async function start() {
  try {
    await initializeRAG();
    
    app.listen(PORT, () => {
      console.log(`🌐 服务运行在 http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

start();
