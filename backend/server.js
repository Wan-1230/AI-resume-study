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
const db = require('./db');

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
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const { users, total, page: p, limit: l } = await usersManager.listUsers({ search, page, limit });
    const stats = await usersManager.userStats();

    res.json({ users, total, page: p, limit: l, stats });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 获取用户详情
app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await usersManager.findById(req.params.id);
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
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const removed = await usersManager.deleteUser(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// RAG 组件（LangChain 管线：加载 → 分块 → 嵌入 → 存储 → 检索 → 生成，见 LANGCHAIN_RAG.md）
let ragService = null;
/** initializing | ready | empty | failed —— 决定 /api/health 的对外表述与接口是否可用 */
let ragState = 'initializing';
let ragError = null;

/**
 * 加载向量索引（不生成）。索引由 `npm run ingest` 产出：本地开发跑一次，
 * Render 上由 buildCommand 在构建阶段跑（见 render.yaml）。
 * 运行时绝不做嵌入：实测批量嵌入 64 个分块峰值 RSS 2.2GB，免费实例 512MB 必被 OOM 杀掉。
 */
async function initializeRAG() {
  console.log('🚀 初始化 AI 面试助手 RAG 系统\n');

  ragService = await createRagService();
  const docCount = await ragService.count();

  if (docCount === 0) {
    ragState = 'empty';
    console.error('❌ 向量索引为空。请先执行 `npm run ingest` 生成 vector_store_data/memory_vectors.json');
    return;
  }

  ragState = 'ready';
  console.log(`\n✅ RAG 系统就绪（${docCount} 条向量）\n`);
}

// 索引没起来之前不要放行业务请求：否则用户拿到的是"没有知识库依据"的回答
function requireRag(req, res, next) {
  if (ragState === 'ready') return next();
  res.status(503).json({
    error: 'AI 索引尚未就绪，请稍后重试',
    rag_state: ragState,
    rag_error: ragError,
  });
}

/**
 * SSE 心跳。反向代理对静默连接会掐线（Render 未公布具体秒数，Cloudflare 约 100s），
 * 而 LLM 首个 token 之前还有检索与并发排队两段静默期。注释行不是 data: 事件，
 * 前端 chatApi.ts 的解析器会直接跳过，因此无需改前端。
 */
function startSseHeartbeat(res, intervalMs = 15_000) {
  const timer = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(timer);
      return;
    }
    res.write(': ping\n\n');
  }, intervalMs);
  timer.unref();
  res.on('close', () => clearInterval(timer));
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// API 路由

// 问答接口（公开可试用，但按 IP 限流 + 并发闸门，防止 API Key 被路人刷爆）
app.post('/api/chat', optionalAuth, requireRag, limitChat, gateLlm, async (req, res) => {
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
app.post('/api/chat/stream', optionalAuth, requireRag, limitChat, gateLlm, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    startSseHeartbeat(res);

    // 检索 → 发送来源 → 流式生成（service 内部处理 LLM 不可用的降级）
    await ragService.chatStream(message, history, {
      onSources: (sources) => {
        sendSse(res, { type: 'sources', sources });
      },
      onChunk: (chunk) => {
        sendSse(res, { type: 'chunk', content: chunk });
      }
    });

    // 发送完成信号
    sendSse(res, { type: 'done' });
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    sendSse(res, { type: 'error', error: '处理请求时出错' });
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
app.post('/api/resume/optimize', authenticateToken, requireRag, limitResume, gateLlm, async (req, res) => {
  try {
    const { jd, resume } = req.body;
    
    if (!jd || !resume) {
      return res.status(400).json({ error: '请提供 JD 和简历内容' });
    }
    
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    startSseHeartbeat(res);

    if (ragService.llmStatus !== 'ready') {
      const reason = `（${ragService.llmStatus}: ${ragService.llmError || '未配置'}）`;
      sendSse(res, { type: 'error', error: `LLM 服务当前不可用${reason}` });
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
        sendSse(res, { type: 'chunk', content });
      }
    }
    
    sendSse(res, { type: 'done' });
    res.end();
  } catch (error) {
    console.error('Resume optimize error:', error);
    sendSse(res, { type: 'error', error: '优化过程中出错' });
    res.end();
  }
});

// 健康检查。永远返回 200：Render 用这个路径判定部署是否存活，
// 返回 4xx/5xx 会把「索引还在加载」误判成「服务坏了」并反复重启，真实状态放在响应体里。
app.get('/api/health', async (req, res) => {
  let db_ok = true;
  try {
    await db.queryOne('SELECT 1 AS ok');
  } catch (error) {
    db_ok = false;
    console.error('[health] 数据库不可用:', error.message);
  }

  const docCount = ragService ? await ragService.count() : 0;
  const health = ragService
    ? ragService.health()
    : { vector_backend: null, has_llm: false, rag_engine: 'langchain' };
  res.json({ status: 'ok', documents_count: docCount, rag_state: ragState, rag_error: ragError, db_ok, ...health });
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
  // 建表必须先成功：DATABASE_URL 配错时要立刻退出并留在日志里，
  // 而不是起来一个"能连上但什么都查不到"的实例
  try {
    await db.initSchema();
  } catch (error) {
    console.error('❌ 数据库初始化失败（检查 DATABASE_URL）:', error.message);
    process.exit(1);
  }

  // 先监听、再后台加载索引：索引加载要几秒到几十秒，放在 listen 之前会让
  // 健康检查在启动窗口内一直连不上，Render 会判部署失败并循环重启
  app.listen(PORT, () => {
    console.log(`🌐 服务运行在 http://localhost:${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
  });

  try {
    await initializeRAG();
  } catch (error) {
    ragState = 'failed';
    ragError = String(error.message || error).slice(0, 200);
    console.error('❌ RAG 初始化失败，AI 接口将返回 503:', error);
  }
}

start();
