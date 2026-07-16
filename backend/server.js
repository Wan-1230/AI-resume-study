/**
 * AI 面试助手 RAG 后端服务
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const VectorStore = require('./rag/vectorstore');
const Retriever = require('./rag/retriever');
const Generator = require('./rag/generator');
const authRoutes = require('./auth');
const { requireAdmin } = require('./auth/middleware');
const usersManager = require('./auth/users');

const app = express();
const PORT = process.env.PORT || 3001;

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

// RAG 组件
let vectorStore = null;
let retriever = null;
let generator = null;

// 初始化 RAG 系统
async function initializeRAG() {
  console.log('🚀 初始化 AI 面试助手 RAG 系统\n');
  
  // 初始化向量数据库
  vectorStore = new VectorStore(process.env.CHROMA_DB_PATH);
  await vectorStore.initialize();
  
  // 初始化检索器
  retriever = new Retriever(vectorStore);
  
  // 初始化生成器
  const apiKey = process.env.MIMO_API_KEY;
  const apiBase = process.env.MIMO_API_BASE;
  
  if (apiKey) {
    generator = new Generator(apiKey, apiBase);
    console.log('  ✅ MiMo LLM 已配置');
  } else {
    console.log('  ⚠️ 未配置 MiMo API Key，将仅返回检索结果');
  }
  
  // 检查是否需要导入数据
  const docCount = await vectorStore.getCount();
  if (docCount === 0) {
    console.log('\n📥 数据库为空，开始导入数据...');
    await importData();
  }
  
  console.log('\n✅ RAG 系统初始化完成\n');
}

// 导入数据
async function importData() {
  const documentsPath = path.join(__dirname, 'data', 'documents.json');
  
  if (fs.existsSync(documentsPath)) {
    const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf-8'));
    await vectorStore.addDocuments(documents);
  } else {
    console.log('  ⚠️ 未找到文档数据，请先运行: node scripts/ingest.js');
  }
}

// API 路由

// 问答接口
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }
    
    // 1. 检索相关文档
    const documents = await retriever.retrieve(message, 5);
    const context = retriever.buildContext(documents, 2000);
    
    // 2. 生成回答
    let answer;
    if (generator) {
      try {
        answer = await generator.generate(message, context, history);
      } catch (llmError) {
        console.error('LLM Error:', llmError.message);
        // LLM 失败时，返回检索结果
        answer = `⚠️ LLM 暂时不可用，以下是知识库检索结果：\n\n${context}`;
      }
    } else {
      // 未配置 LLM，仅返回检索结果
      answer = `根据知识库检索，找到以下相关内容：\n\n${context}`;
    }
    
    // 3. 返回结果
    res.json({
      answer,
      sources: documents.map(doc => ({
        title: doc.title,
        category: doc.category,
        url: doc.url,
        source: doc.source,
        content: doc.content.substring(0, 200) + '...'
      }))
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: '处理请求时出错' });
  }
});

// 流式问答接口
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }
    
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 1. 检索相关文档
    const documents = await retriever.retrieve(message, 5);
    const context = retriever.buildContext(documents, 2000);
    
    // 2. 发送来源信息
    res.write(`data: ${JSON.stringify({ type: 'sources', sources: documents })}\n\n`);
    
    // 3. 流式生成回答
    if (generator) {
      try {
        await generator.generateStream(message, context, history, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        });
      } catch (llmError) {
        console.error('LLM Stream Error:', llmError.message);
        const fallback = `⚠️ LLM 暂时不可用，以下是知识库检索结果：\n\n${context}`;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: fallback })}\n\n`);
      }
    } else {
      const fallback = `根据知识库检索，找到以下相关内容：\n\n${context}`;
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: fallback })}\n\n`);
    }
    
    // 4. 发送完成信号
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
app.post('/api/resume/optimize', async (req, res) => {
  try {
    const { jd, resume } = req.body;
    
    if (!jd || !resume) {
      return res.status(400).json({ error: '请提供 JD 和简历内容' });
    }
    
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    if (!generator) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'LLM 服务未配置' })}\n\n`);
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

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const stream = await generator.client.chat.completions.create({
      model: 'mimo-v2.5',
      messages: messages,
      temperature: 0.7,
      max_tokens: 3000,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
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
  const docCount = vectorStore ? await vectorStore.getCount() : 0;
  res.json({
    status: 'ok',
    documents_count: docCount,
    has_llm: !!generator
  });
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
