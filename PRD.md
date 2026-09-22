# AI 面试宝典 · 优化 PRD（基于竞品分析）

| 项 | 内容 |
|---|---|
| 版本 | v1.0（2026-09-21） |
| 产品定位（已确认） | **求职作品集**：主要用途是拿着它去面 AI 应用开发岗，15 分钟内演示可信、技术深度可讲、现场不穿帮 |
| 内容赛道（已确认） | **只做深 AI/大模型应用岗**（RAG / Agent / LLM 基础 / MCP / 向量库 / AI 系统设计），不扩通用后端 |
| 本文档读者 | 自己（排期依据）+ 面试官（间接：所有结论都要能"演示给他看"） |

---

## 0. 结论先行

1. **不跟刷题平台拼题量，也不跟 AI 面试工具拼"数字人面试"。** 竞品分析后的空缺定位是：
   **「面向 AI 应用开发岗、答案可溯源的面试教练」** —— 内容窄而深（竞品在 RAG/Agent/MCP 这类新岗位方向上几乎是空目录），
   且把 RAG 的检索来源当作产品一等公民（所有竞品都没有做引用溯源）。
2. **作品集导向下，最大的扣分项不是"功能少"，而是"点得到但其实是假的"。** 现状有 6 处这样的实现（见 §1），
   面试官只要随手点一次"新增题目→刷新→没了"，前面的 RAG 加分全部抵消。所以 P0 的主线是**消灭假功能 + 补齐持久化闭环**，而不是加新页面。
3. **真正的技术护城河已经埋在后端但没被展示出来**：本地离线 embedding（零 API 成本）、memory/Chroma 双后端、
   cosine 相似度分数已透传到前端但被截断成 3 条、`shuffleOptions.ts` 写好了却 0 引用。
   P1 的主线是把这些"能讲出取舍和度量"的能力显性化（检索质量评估集 + 内联引用角标），而不是堆功能。
4. ~~**前置阻塞：LLM 端点不可用**~~ → **已解决（2026-09-21）**：`backend/.env` 已配 `LLM_API_BASE=https://api.agnes-ai.cn/v1` + `LLM_MODEL=agnes-3.0-flash`，
   `/api/health` 的 `has_llm` 已为 `true`，问答/多轮/简历优化三项真实生成均验证通过（实测数据见 §1.4）。
   仍存的次生风险：该端点**无鉴权、无限流**（见 P0-3），公开演示前必须补护栏。

---

## 1. 产品现状（可验证事实，非印象）

### 1.1 真实可用

| 能力 | 证据 |
|---|---|
| RAG 问答（检索段） | `backend/server.js:158` → `rag/langchain/*`；661 个分块，`/api/health` 实测 `vector_backend: chromadb`，检索分数 0.69~0.83 |
| 题库读取 | `GET /api/questions`（`server.js:223`）+ 前端静态兜底 `/data/questions.json` |
| 简历优化流式 | `POST /api/resume/optimize` SSE（`server.js:235`、`resumeApi.ts:32`）—— 实测单次产出 2845 字、1418 个 SSE 事件 |
| 邮箱注册/登录、JWT、管理员 | `backend/auth/*`，`AdminDashboard.tsx` 用户 CRUD 真实 |
| 引用来源卡片 | `SourceCard.tsx` 真实渲染类型/分类/外链 |

### 1.2 假实现与缺陷（P0 目标）

| # | 问题 | 证据 | 面试官视角后果 |
|---|---|---|---|
| A1 | ~~题目增删改只返回拼装对象~~ **已修复（2026-09-21）**：新建 `custom_questions` 表 + `/api/my/questions` CRUD，按 owner 隔离、他人改删返回 403/404 | `backend/myquestions/index.js`、`src/pages/MyQuestionsPage.tsx` |
| A2 | ~~批量导入数据直接丢弃~~ **已修复（2026-09-21）**：`POST /api/my/questions/import` 逐条校验，失败带行号回报；顺带修掉 CSV 中文乱码（原来用 `arrayBuffer` 解析 CSV，UTF-8 被按 Latin-1 解码，中文标题全成 `åè¡...`） | `src/pages/ImportPage.tsx`（改用 `file.text()` + `type:'string'`） |
| A3 | ~~收藏恒 `[]`~~ **已修复（2026-09-21）**：改为 SQLite + `/api/favorites`，登录后水合、乐观更新失败回滚 | 旧实现 `api.ts:224-249` 已删除；新见 `backend/learning/index.js`、`src/lib/learningApi.ts` |
| A4 | ~~练习结果不落盘~~ **已修复（2026-09-21）**：交卷上报 `/api/practice/sessions`，服务端按题库重算对错；新增统计与错题本接口 | `src/pages/PracticePage.tsx`（submitSession）、`backend/db/index.js` |
| A5 | 聊天历史刷新即丢，`history` 存在但不持久化 | `ChatPage.tsx:31` | **未做**：会话表与聊天持久化留下一迭代（避免先建表无人写） |
| A6 | 聊天**未接流式**：`sendMessageStream` 已写好、零调用 | `chatApi.ts:60` vs `ChatPage.tsx:69` | README 宣称"逐字输出"，现场是整段返回 |
| B1 | 练习题数被夹死在 10：`limit = params?.limit \|\| 10` | `api.ts:144` | 已绕过（2026-09-21：`PracticePage` 显式传 `limit: 500`，选 20/50 题可用）；**服务端筛选分页仍待做**（P0-4） |
| B2 | 题目详情靠拉全量 255 条再 `find()`，分类由前端 `Map` 去重派生 | `api.ts:151`、`api.ts:74-82` | 无服务端筛选/分页，题库无法增长 |
| B3 | ~~255 题 182 题答案为 A（71.4%）~~ **已修复（2026-09-21）**：`A/B/C/D = 64/64/64/63`；难度仍塌陷（等真实正确率回填，见 P0-4） | `scripts/repair-questions.js` |
| B4 | 题型 100% 四选一单选，`answer` 只有字母，**无解析字段、无来源引用**；且**65% 的题（165 道）干扰项是占位文案** → 已修复干扰项，题型扩展待做 | `questions.json`；审计见 `scripts/audit-questions.js` |
| B5 | ~~假指标写死在 UI~~ **已修复（2026-09-21）**：`浏览 1.2k` / `建议用时 5分钟` 换成 `GET /api/questions/:id/stats` 的真实聚合（作答次数、正确率、中位用时；样本 <3 不给中位数、0 作答显示"还没人做过"）；`created_at` 不再伪造，类型收紧为 `string \| null` | `backend/learning/index.js`、`src/pages/QuestionDetail.tsx`、`src/types/index.ts` |
| B6 | 死代码：`shuffleOptions.ts`、`Empty.tsx`、`useTheme.ts`、`mockData.ts`、`MagicBento.tsx`、`Sidebar.tsx` 均 0 引用；`Share2`/`Bookmark` 按钮无 `onClick` | grep 实测 | 说明"写了没收尾"，也说明工程约束缺位 |
| C1 | ~~`/api/chat`、`/api/resume/optimize` 无鉴权、无限流~~ **已修复（2026-09-21）**：问答按 IP/用户限流 + 并发闸门；简历接口要求登录且额度更紧；`trust proxy` 已开 | `backend/guard.js`、`server.js` |
| C2 | ~~OAuth 把 JWT 塞进 URL query~~ **已修复（2026-09-21）**：授权在弹窗内完成，后端回执页用 `postMessage` 交回结果（targetOrigin 取服务端配置的 `FRONTEND_URL`），前端校验 `event.origin`；`AuthCallback.tsx` 与 `/auth/callback` 路由随之删除 | `backend/auth/index.js`、`src/pages/AuthPage.tsx` |
| C3 | ~~GitHub OAuth 未配置仍显示按钮~~ **已修复（2026-09-21）**：新增 `GET /api/auth/providers`，前端探测失败或未配置时整个 GitHub 入口与分隔线都不渲染 | `backend/auth/index.js`、`src/pages/AuthPage.tsx` |
| C4 | 登录不解锁任何功能（无用户维度数据），`users.json` 不存在 | `store/index.ts`、`backend/data/` | "用户体系"是空转的三件套 |
| D1 | README 与代码脱节：宣称 docx 导出（全项目 0 实现）、图片上传（`accept` 不含图片）、目录树里的 `rag/vectorstore.js` 等 5 个文件已不存在 | `README_CN.md:23-27,107-113`、`ResumePage.tsx:238` | **README 是面试官第一入口，比页面穿帮更早发生** |
| D2 | 全仓 0 测试、无 CI；`/api/questions` 每请求同步重读 680KB JSON | `package.json`、`server.js:223` | 工程成熟度直接可见 |

### 1.3 内容资产（唯一被低估的东西）

`backend/data/documents.json` 307 条（277 article + 30 question），主题 100% 是 2026 年大模型/AI 应用开发面试材料 →
已灌成 661 分块向量库；`questions.json` 255 题、8 分类。**这套语料宽度正好落在竞品的空档上**（见 §2.4），
但注意其首条含"星球专属"字样 → 来源疑似付费知识社群，公开展示前必须核授权（见 §7 风险 R3）。

### 1.4 真实 LLM 验证结果（2026-09-21，`agnes-3.0-flash`）

| 场景 | 实测结果 |
|---|---|
| `/api/health` | `has_llm: true`、`llm_model: agnes-3.0-flash`、`vector_backend: chromadb`、661 分块 |
| 单轮问答 | "RAG 召回率低怎么排查" → 12.5s；答案严格落在检索到的排查步骤上（解析→候选池→排序→上下文→生成），风格符合 `SYSTEM_PROMPT` 的口语化与"不用 `*` 列举"约束 |
| 多轮指代 | 带 history 问"那**它**和微调该怎么选？" → 正确解析"它"=RAG，给出可复述类比与分场景结论 |
| 流式问答 | `/api/chat/stream` → 1 个 sources + 276 个 chunk + 1 个 done，5.4s，逐段产出正常 |
| 简历优化 | `/api/resume/optimize` → HTTP 200，2845 字完整改写简历 |

**由此暴露的 4 个新问题**（并入 P0-4 / P1-2 / P1-5）：

| # | 问题 | 证据 |
|---|---|---|
| B7 | 题库文本里的 `答案: A` 残渣被切进知识块并**直接进入 LLM 上下文**，与选择题答案字母一起泄漏进问答语境 | 诊断打印的 context 含两处 `答案: A` |
| B8 | 部分 chunk 从半句开始（"但它提醒了一个变化：…""工程难点不在 while 循环本身…"），检索命中但语义不自洽 | `documents.json` 分块后 chunk 未携带标题/上级语境 |
| B9 | 简历优化在"不要编造经历"的指令下，仍把"2 年 Java 后端"改写成"专注于 LLM 应用落地"，并生成占位电话 | `/api/resume/optimize` 输出 |
| B10 | `chatStream` 会转发 `content` 为空的 chunk（276 中 4 个），而 resume 接口有 `if (content)` 过滤 → 两接口行为不一致 | `service.js:151` vs `server.js:288` |

> 另一条度量线索：5 条检索结果只用了 765/2000 的上下文预算（38%），说明 `RAG_TOP_K` / `RAG_CONTEXT_MAX_CHARS` 尚有调参空间 —— 正是 P1-1 评估集要回答的问题，而不是拍脑袋加大。

---

## 2. 竞品分析

> 情报来源为公开评测与产品页（见 §8），中文横评多数带软文性质，功能/价格**已标注可信度**，用于判断趋势足够，用于精确对标需官网复核。

### 2.1 玩家地图（五类）

| 类别 | 代表 | 他们赢在哪 | 他们留出的空档 |
|---|---|---|---|
| A 刷题内容平台 | 面试鸭、牛客网（部分免费、题量导向）、力扣 | 题量、分类体系、社区、会员制成熟 | **AI/大模型应用方向题目稀薄**；纯背题，无追问、无"为什么错" |
| B AI 模拟面试 | 鹅来面（分层追问 + 六维复盘 + 简历 JD 匹配）、Final Round AI（英文语音，评测称 ~$99/月）、interviewing.io（真人+AI 技术模拟、匿名复盘）、OphyAI（简历上下文 + 实时提示 + 评分 + tracking）、白瓜面试 / 面试狗（轻量语音） | 完整"面试→评分→复盘"闭环、语音真实感 | 通用技术/行为面为主，**不讲检索依据**；垂直 AI 岗深度不足；贵的不开放 |
| C 表达训练 | Yoodli（填充词/语速/眼神）、面试猫（微表情/语速） | 非语言维度量化 | 纯形式，不管内容对错 —— 单人项目做这个性价比最低 |
| D 简历-JD 匹配 | 鹅来面、OphyAI、（Jobscan/Teal 一类 ATS 匹配工具） | 给出匹配度拆解与改写 | 多为"改写文本"，**少有人给可解释的逐条 gap 依据** |
| E 通用大模型 | ChatGPT / Kimi / 豆包 / DeepSeek | 免费、什么都能问 | **无题库、无岗位结构、会编、无溯源、无练习记录** |

**E 类才是真实对手**：用户的默认替代行为是"把面试题丢给通用大模型"。本站唯一能赢的点是
**结构化（岗位路径 + 练习闭环）+ 可溯源（答案对应知识库出处）**。这条判断决定了 P1 的优先级。

### 2.2 功能矩阵（✅完整 / 🟡部分 / ❌无）

| 能力 | 刷题平台 | AI 模拟面试 | 通用大模型 | **本站现状** |
|---|---|---|---|---|
| 岗位垂直题库（RAG/Agent/MCP/向量库） | ❌/🟡 | ❌ | ❌ | **✅（661 分块 + 255 题，8 分类）** ← 唯一领先项 |
| 语义检索问答 | ❌ | 🟡（多走通用模型） | ✅ | ✅ |
| **答案引用溯源（可点到出处）** | ❌ | ❌ | ❌ | 🟡（有 SourceCard，但截断 3 条、正文无 [1][2] 角标）← 差异化机会 |
| 检索质量可度量（hit-rate/阈值/拒答） | ❌ | ❌ | ❌ | ❌（分数已透传但未用）← 差异化机会 |
| 题库搜索/分类/难度 | ✅ | 🟡 | ❌ | 🟡（前端过滤，难度塌陷、71% 答案为 A） |
| 收藏 / 错题本 | ✅ | 🟡 | ❌ | ❌（假实现） |
| 练习记录与掌握度趋势 | ✅ | ✅ | ❌ | ❌（不落盘） |
| 模考计时 + 交卷复盘 | 🟡 | ✅ | ❌ | 🟡（只有正计时） |
| 追问式多轮面试 | ❌ | ✅ | ✅ | ❌ |
| 语音输入 / 转写 / 表达分析 | ❌ | ✅ | 🟡 | ❌ |
| 简历 + JD 匹配（可解释 gap） | ❌ | ✅ | ✅ | 🟡（能改写，无评分与依据） |
| 零成本/离线 embedding | ❌ | ❌ | ❌ | ✅（本地嵌入模型，成本结构优势）← 值得讲 |
| 用户体系 / 管理后台 | ✅ | ✅ | ❌ | 🟡（代码齐备但空转） |
| 自动化测试 / CI | ✅ | ✅ | — | ❌ |

### 2.3 形态与定价（据公开评测，未逐一核官网）

| 产品 | 形态 | 价格锚点 | 可信度 |
|---|---|---|---|
| 面试鸭 | Web + 小程序 | 免费部分 + 会员解锁题库 | 中（官网自评） |
| 牛客网 | Web + App | 刷题免费，AI 面试模拟间为增值 | 中 |
| 鹅来面 | Web | 限时试用 | 低（软文倾向） |
| Final Round AI | Web | 评测称 ~$99/月 | 低-中 |
| interviewing.io | 真人排期 + AI 模拟 | 按次/订阅 | 中 |
| Google Interview Warmup | 免费 Web | 免费，仅转写无评分 | 中 |
| Yoodli | Web | 免费 + 订阅 | 中 |

→ **付费墙全部落在"模拟面试 + 复盘报告"上**，而不是题库。这说明：把练习闭环和复盘做出来，才是产品价值曲线的拐点；
只补题库数量的投入是低回报的。

### 2.4 竞品共识 vs 空白

**共识（不做 = 不合格）**：分类题库、搜索、收藏/错题、练习记录与趋势、限时模考、简历结合、账号体系。
**空白（做了 = 差异化）**：
1. 没有任何竞品提供**可点击的答案出处**（全部是"AI 说的"）。本站有向量库 + metadata + score，做这个是降维。
2. 没有竞品在**AI 应用开发岗**这个新职种上做深（RAG 68 题、Agent 66 题的分类体系在面试鸭/牛客里基本不存在）。
3. 没有竞品公开**检索质量指标**（召回命中、阈值过滤、无相关结果时明确拒答）。这恰好是 AI 岗面试最容易被追问的点。

---

## 3. 目标、非目标与指标

### 3.1 目标（按作品集权重排序）

- **G1｜演示零穿帮**：README 里写的每句话、页面上每个可点的东西，行为与描述一致。
- **G2｜技术深度可讲**：能就 RAG 的检索质量、chunk 策略、后端选型、成本结构拿出**数字**，而不是"我用了 LangChain"。
- **G3｜产品闭环可自证**：自己用 7 天准备一场真实面试，全程记录留下数据 —— 这既是 dogfooding 素材，也是演示时的真实数据。
- **非目标（明确不做）**：数字人视频面试、微表情/语音情感分析、真人面试官撮合、通用 Java/前端题库、App 端、社区 UGC、付费系统。

### 3.2 指标

| 层级 | 指标 | 目标值（首版） | 说明 |
|---|---|---|---|
| **北极星** | **演示通过率**：按 §5 的 14 步演示脚本连续跑通且无假反馈 | 12/12，3 次重跑稳定 | 作品集场景专用指标，替代 DAU |
| 质量 | 检索 hit-rate@5（在评估集上） | ≥ 85% | 现状抽样 4 题全命中，需正式评估集 |
| 质量 | 答案引用命中率（正文 [n] 角标指向的 chunk 确实被检索到） | ≥ 90% | P1-2 |
| 质量 | 无相关结果时的正确拒答率 | ≥ 80% | `RAG_MIN_SCORE` 调参依据 |
| 使用 | 练习完成率（进入练习→交卷） | ≥ 60% |  dogfooding 自测即可 |
| 成本 | 单次问答平均 token 与费用 | 有面板可见、可预算 | 上线前必答题 |
| 反指标 | 不看 DAU / 注册数 / 题量堆砌 | — | 防止把精力错投到"再补 500 题" |

---

## 4. 需求规划

### P0 · 可信度工程（不完成就不要对外给链接）

#### P0-1 学习数据持久化层（解锁 A3/A4/A5，是后续一切的依赖）

> **进度（2026-09-21）**：收藏 + 练习会话/逐题作答/统计/错题本已落地并验证（存储用 Node 内置 `node:sqlite`，
> 零新增依赖；`backend/db/index.js` + `backend/learning/index.js`，部署基镜因此升到 `node:24-alpine`、`engines` 改 `>=22.5`）。
> 未做：会话（chat_threads/messages）持久化 —— 与聊天会话列表 UI 一起落。
> 验证记录：注册→收藏→**强制杀进程重启**→数据仍在（WAL 重放）；浏览器端登录→交卷 5 题→结算显示"已保存到练习记录（累计 6 题）"→刷新显示"2 次 · 6 题 · 正确率 33%"。

- **用户故事**：作为准备面试的人，我收藏错题、练习记录跨设备/刷新后仍在。
- **功能要求**
  - 新增 4 张表：`favorites(user_id,question_id,created_at)`、`practice_sessions(id,user_id,mode,config_json,started_at,finished_at)`、`practice_answers(session_id,question_id,chosen,correct,answered_at,duration_ms)`、`chat_threads(id,user_id,title,created_at)` + `chat_messages(thread_id,role,content,sources_json,created_at)`。
  - 存储：**SQLite（better-sqlite3）** 直接替掉 JSON 同步读写；迁移与并发收益都在面试可讲。用户表暂留 JSON 或一并迁入（建议一并）。
  - REST：`/api/favorites`、`/api/practice/sessions`(+`/answers`)、`/api/threads`(+`/messages`)，全部要求 JWT。
- **验收**：写入后**刷新页面 + 重启后端 + 换浏览器登录同一账号**，三处数据均在；`favorites.getAll` 不再返回 `[]`；`store/index.ts` 无死字段。
- **范围外**：不做多端实时同步、不做导出。

#### P0-2 假功能清零（A1/A2/B5 + C3）

> **进度（2026-09-21）**：A1（自建题 CRUD）、A2（CSV/Excel 导入）、B5（写死假指标与伪造时间戳）、C3（GitHub 按钮）
> 均已完成；`collections` 假模块与 `questions.create/update/delete/importQuestions` 假实现已从 `api.ts` 删除；
> "加入我的题库"由死按钮变为复制系统题入库（按 `source_id` 幂等）。
> 同批顺手清掉的：Header 里从未渲染输入的"搜索框"死控件（含 3 个未使用变量与死 import）、
> 无 `onClick` 的 Bookmark 按钮、指向占位仓库 `Wan-1230/-` 的 Header 链接、
> Share 按钮改为真复制链接（浏览器拒绝授权时给可操作提示而非静默失败）。
> **P0-2 剩余**：B6 里其余死组件（`Empty.tsx`/`MagicBento.tsx`/`Sidebar.tsx`/`mockData.ts`/`useTheme.ts`）
> 与 C4（登录不解锁功能）—— 现在登录后已解锁收藏/练习/题库，C4 基本闭环，只剩组件清理。
- **原则**：每个假实现只有两个合法去向 —— **做成真的**，或 **从导航与 README 摘掉并在页面标注"实验性/规划中"**。不允许保留"点了提示成功然后消失"。
- 具体处置（含推荐项）
  - `我的题库 CRUD`：**做成真的**（复用 P0-1 的 SQLite，`questions` 加 `owner_user_id`，服务端做权限与分页）。若时间不足则整页降级为"只读的个人题库视图（来自收藏）"。
  - `批量导入`：**做成真的但缩范围** —— 只支持 CSV（`XLSX` 依赖与拖拽解析已在，保留），走服务端事务写入 + 逐行错误报告（现有 `api.ts:191` 的 `delay(1000)` 删除）。
  - `浏览 1.2k / 建议用时 5分钟 / created_at 2024-01-01`：**删除或换真实字段**（`practice_answers` 可算真实作答人数与平均用时；`created_at` 用导入时间）。
  - GitHub OAuth（`GITHUB_CLIENT_ID` 为空）：**要么配好真实 OAuth App，要么从登录页移除按钮**。保持"可点但报错"是最差选项。
- **验收**：全站 grep 无 `mock-user-id`；点击→反馈→刷新三致；无写死指标文案。

#### P0-3 LLM 真实可用 + 护栏（前置阻塞 + C1/C2）

> **进度（2026-09-21，09-22 修正）**：LLM 端点已接（`agnes-3.0-flash`）；护栏已落地 ——
> `backend/guard.js`（零依赖**滑动窗口**限流 + 带队列的 LLM 并发闸门，`app.set('trust proxy', 1)` 保证按真实 IP 分桶）、
> `/api/chat*` 公开但限流、`/api/resume/optimize` 要求登录、`/api/health` 增加 `llm_status`/`llm_error`、
> 启动即探一次 `/models`。OAuth 的 JWT 已从 URL 查询参数改为弹窗 `postMessage`（`/auth/callback` 页随之删除）。
> 同批修掉两个静默失效：SSE 解析的 `catch` 把服务端 `error` 事件一起吞了（chat + resume 两处）、
> 简历页把 401 显示成"请确保后端服务已启动"。
> 09-22 复查时发现一个真隐患：`backend/guard.js` 与 `backend/guard.js` **同时存在**，
> 而 Node 的 `require('./guard')` 优先解析同名文件 —— 线上跑的一直是其中一份，文档描述的是另一份的变量名与语义。
> 已删除目录版、只留 `guard.js`，`.env.example` 与两个 README 的护栏变量名改成代码里真正读的那六个，
> 并实测：3 次/窗口 → 第 4 次 `429 + Retry-After: 2`，窗口滑过恢复 200；并发 1 + 排队超时 300ms < 处理 600ms → 队列请求按预期 `503`。
> **唯一未验证项**：GitHub OAuth 成功回路 —— 需要真实 OAuth App（见 R7）。
- **功能要求**
  - 接任意 OpenAI 兼容端点（`LLM_API_KEY/BASE/MODEL` 已支持，代码零改动）；启动时做 `/v1/models` 或一次 1-token 探针，**失败即在 `/api/health` 显式 `llm_status: "unreachable"`**，前端把"AI 未就绪"作为一等状态展示，而不是静默降级成检索原文。
  - 护栏：`/api/chat*`、`/api/resume/*` 加 JWT + 按用户与 IP 的限流（`express-rate-limit`）+ `maxTokens` 预算 + 单次请求 20s 超时 → 明确降级文案。
  - OAuth 回传 token 从 URL query 改为 `postMessage` 或一次性 code 交换（C2，安全面试必问）。
- **验收**：断网/错 key 时页面显示"AI 未就绪 + 原因"，而不是假装有答案；压测 100 QPS 不产生无上限 LLM 调用。

#### P0-4 题库内容质量（B1/B3/B4）

> **进度（2026-09-21）**：先做了度量（`scripts/audit-questions.js`），结果比预估严重 ——
> **255 题里 165 题的干扰项是占位文案**（"参考答案内容"/"请查看详细解析"/"以上都不对"），
> 等于 65% 的题白送分；正确答案 71% 落在 A 位。
> `scripts/repair-questions.js`（LLM 重生成干扰项 → 再按"当前最少的位置"重排，种子固定可复现）跑完：
> 占位干扰项 **165 → 0**，答案分布 **A/B/C/D = 64/64/64/63**。
> `scripts/clean-corpus-answers.js` 清掉了 RAG 语料里 30 块的 `答案: X` 残渣（重排后这些字母已经是错的），
> 重建向量库后检索分数不降反升（如"RAG 召回率低" 0.697 → 0.727）。
> 练习时的选项乱序已启用（原来 0 引用的 `shuffleOptions.ts` 正式接线），
> 判分改为**服务端按选项文本比对**（`display_options` 上报），乱序不会把对的判错 —— 已用接口双向验证。
>
> **未做（需要单独决策/设计）**：难度重标定（85%~95% 都是 medium，应等真实作答正确率积累后回填，
> 现在改纯属拍脑袋）；开放简答题 `type:'open'` + LLM 按 `answer_points` 评分（与 P1-3 的复盘打分器一起做）；
> 服务端题库分页/筛选（`/api/questions` 仍每请求读整个 680KB JSON、前端自己切页 —— 归入 P2 性能）。

- **功能要求**
  - **启用已有 `shuffleOptions.ts`**：作答时选项顺序随机化、正确答案位置重算，并写入作答日志（现状：写好了、0 引用，是"烂尾"的直接证据）。
  - 服务端取题：`GET /api/questions?category=&difficulty=&limit=&offset=&exclude_answered_by=` —— 修掉 `api.ts:144` 的 limit=10 与 `PracticePage.tsx:57` 的不传参。
  - 答案分布再平衡：以脚本把 A 占比 71.4% 打散到 **每位置 22%~28%**（与乱序同源，避免人工改）。
  - 难度重标定：`medium` 85% → 目标 easy/medium/hard ≈ 25/55/20（依据真实作答正确率回填，初期人工规则）。
  - 内容补齐：`analysis`（解析）与 `refs`（`documents.json` 的 chunk id 数组）两个字段 → 让每题都能"跳到出处"。优先补 4 个不足 8 题的分类（Agent Memory 4、向量库 5、MCP 7、Prompt 7）。
  - 新增题型：**开放简答题**（`type: 'open'`，无 options），用 LLM 按 `answer_points[]` 打分 + 给出改进建议 —— 与 AI 岗真实面法一致，且和"模拟面试"共用打分器（P1-3）。
- **验收**：任一题重进两次选项顺序不同、答案恒对；4 个空分类题量 ≥ 15；≥ 20 题为开放题且带评分标准。

#### P0-5 README 与演示环境（D1）

> **进度（2026-09-21/22）**：`README.md` 与 `README_CN.md` 已按"只写能用的"重写 —— 删掉未实现的
> docx 导出、图片上传、`AuthCallback` 与旧 `backend/rag/*.js` 目录树、`MIMO_*`/`CHROMA_DB_PATH` 变量、
> Node ≥18（实为 ≥22.5）；补上真实后端（LangChain + memory/Chroma + SQLite）、限流护栏、
> 脚本清单、"已知限制"一节。新增 `DEMO.md`：预热 + LLM 验活 + 演示账号 + 14 步演示脚本 +
> "看着像 bug 其实不是"清单 + 回归清单。
> 为了让 README 里"错题本"这句不算夸口，顺手补了 UI：练习页显示错题列表（后端返回题目标题）与"只练错题"入口。
> **待部署后补**：线上地址（`DEMO.md` 第 4 节留了清单）。

- 重写 `README.md` / `README_CN.md`：删掉未实现的 docx 导出、图片上传；`backend/rag/` 目录树改为实际 `rag/langchain/*`；向量检索描述改为 `memory` / `chromadb` 双后端（TF-IDF 已在本次迁移中移除）；补"架构 + 取舍 + 已知限制"三段（面试官最想看的部分）。
- 加 `DEMO.md`：公开访问地址、种子测试账号、14 步演示脚本、**预热说明**（Render 免费档休眠 + 本地嵌入模型首次加载耗时 → 演示前先打一次冷启动请求）。
- **验收**：README 每句话能在页面上演示出来；把 README 交给不了解项目的人能独立跑起来。

### P1 · 差异化（把已有的技术资产变成可讲的产品价值）

#### P1-1 RAG 评估集与指标面板（G2 的核心弹药）

> **进度（2026-09-22）**：评估集与脚本已落地，A/B 跑完并据此换了默认 embedding 模型。
>
> 标注 60 条 = 25 条题干改写 + 20 条文章级改写 + 15 条负样本（`backend/data/retrieval-eval.json`，
> 按**文档级相关**判定，同一篇文章的任意分块命中都算对）。脚本 `backend/scripts/eval-retrieval.js`
> 一条命令出表，`--compare=a.json,b.json` 出差值；快照存在 `backend/data/eval-reports/`。
>
> | 配置（memory，60 条） | hit@1 | hit@3 | hit@5 | MRR |
> |---|---|---|---|---|
> | `all-MiniLM-L6-v2`（原默认） | 13.3% | 31.1% | 46.7% | 0.240 |
> | `bge-small-zh-v1.5`（现默认） | **53.3%** | **66.7%** | **73.3%** | **0.614** |
>
> 换模型是这里性价比最高的一次改动：只改 `EMBEDDING_LOCAL_MODEL_DEFAULT`，索引重建后四项指标全涨 ≥26 个百分点。
> Chroma 后端在同一模型下与 memory **逐项完全一致**（53.3/66.7/73.3、MRR 0.614），两后端已用同一模型重建，不再是新旧向量混用。
> 代价可忽略：模型加载 0.5s、单条查询嵌入 + 检索约 7ms（首问 0.35s 后进入热态），演示时慢的仍然是 LLM 首 token。
>
> 阈值扫描（同一批分数，看"拒掉多少噪声"换"丢掉多少真命中"）：
>
> | RAG_MIN_SCORE | 负样本拒答 | 正样本命中保留 |
> |---|---|---|
> | ≤0.45 | 0% → 6.7% | 73.3%（无损） |
> | **0.50** | **20.0%** | **73.3%（无损）** |
> | 0.55 | 26.7% | 71.1% |
> | 0.60 | 66.7% | 57.8% |
>
> **结论有两个，第二个比第一个重要**：
> 1. 0.50 是免费的——过滤 20% 无关查询且不伤任何真命中，已作为 `RAG_MIN_SCORE` 的代码默认值上线（P1-2 一并做的空上下文分支）；
> 2. 但**单靠 cosine 阈值做不到可靠拒答**。负样本 top1 分数区间 0.426~0.728，正样本 0.532~0.762，两者大面积重叠：
>    想拒掉 2/3 的噪声就得牺牲 15% 的真命中，这不是可接受的交换。所以 0.5 只当噪声闸门用，
>    "知识库中没有相关内容"由过滤到空结果的专门分支给出，而不是继续往上调这个数。
>
> 另外 12/45 条正样本 top5 未命中，其中 8 条是**文章标题的口语化改写**（如"最近很火的技能包机制到底是什么"→《Skills 详解》），
> 即长句语义漂移；这是 chunkSize/查询改写要解决的问题，不是阈值问题。
>
> **未做**：管理后台"检索质量"页与真实查询分数分布（依赖 §6 的 `retrieval_log` 表）；`chunkSize` 400/60 的 A/B 尚未跑。

- 人工标注 60 条「查询 → 应命中的 chunk id」评估集（含 15 条**知识库中无答案**的负样本）；
  脚本化输出 `hit-rate@1/5`、`MRR`、`负样本正确拒答率`。
- 支持 A/B 对比并落表：`chunkSize/overlap`（800/120 vs 400/60）、`VECTOR_BACKEND`（memory vs chromadb）、`RAG_TOP_K`、`RAG_MIN_SCORE`。
- 管理后台新增"检索质量"页：展示上述指标 + 最近 50 条真实查询的命中分数分布。
- **验收**：一条命令产出对比表；PR 里能附"改动前/后 hit-rate@5"。

#### P1-2 答案内联引用与可跳转溯源

> **进度（2026-09-22）**：已上线并实测。
> `buildContext` 给每块资料打 `[1] [2] …` 编号，提示词要求"用了哪条就在句末标哪个编号、没有依据的句子不要标、
> 编号只能是资料里真实出现过的"；前端 `MarkdownLite` 把 `[n]` 渲染成上标角标按钮，点击滚到第 n 张来源卡片并高亮 2.4s，
> 卡片可展开原文；`slice(0, 3)` 截断去掉，来源全给（数量与编号严格对齐，截断只砍尾部）。
> 拒答分支在 `service.js`：检索被 `RAG_MIN_SCORE`（默认值已从 0 提到 0.5）过滤成空时**直接返回固定文案、不调 LLM**，
> `/api/chat` 带 `abstained: true`。实测对比：正常提问首字 1305ms，拒答路径 42ms —— 省掉一次推理，
> 也堵死了"空上下文喂给模型 → 它用参数记忆编一段像样答案"这个失败模式。
>
> 已验证：非流式与 SSE 两条路径的答案都带角标（`[1] [2] [3]`）、无越界；浏览器里点角标能命中对应卡片（`3:ON`）；
> "推荐几本杭州的餐厅"→ 0 来源 + 拒答文案。
>
> 角标审计（评估集前 14 条正样本，逐条走真实 `/api/chat`）：**14/14 带角标、29 个角标、越界 0 个**；
> 14 条全部过阈值（无误伤成拒答），其中一条只有 3 条来源过阈值 —— 说明 `0.5` 确实在过滤，
> 而编号与来源仍然对齐（角标最大不超过该条的来源数）。
> 还差的一步：`≥90% 角标指向的原文确实支撑该句`属于语义判断，脚本只能保证编号合法，需要人工抽查或加一个 LLM 评审（留给 P1-3 的打分器一起做）。
> **视觉回归没做**：内嵌浏览器 viewport 是 0×0，截图不可用，只做到 DOM 层面验证。

- 提示词改造（`chains.js`）：要求 LLM 在句末输出 `[1]`/`[2]`，编号与送入的 context 块顺序一致；
  前端渲染角标 → 点击展开对应 chunk 原文与 `metadata.url`。
- `ChatMessage.tsx` 去掉 `slice(0, 3)` 硬截断；`RAG_MIN_SCORE` 上线到能过滤噪声后再定值；
  检索为空/低分时**明确回答"知识库中没有相关内容"**（现在会硬塞弱相关内容）。
- **验收**：抽查 20 条回答，角标指向的原文确实支撑该句（≥ 90%）；问一个库里没有的问题，得到拒答而非编造。

#### P1-3 模拟面试闭环（竞品共识里唯一本站完全缺失的一项，且是竞品付费点）

> **进度（2026-09-22）**：已上线，`/interview` 全流程可演示。
>
> 实现：`backend/interview/`（组卷 + 逐题评审 + 复盘报告）、`interview_sessions` 表（Postgres）、
> `InterviewPage.tsx` + `RadarChart.tsx`（手写 SVG，不引图表库）。
> 4 个方向按题库真实分类取题（RAG 73 / Agent 77 / 系统设计 48 / 综合 255），
> 每题 1 次 LLM 调用产出「点评 + 顺着这话的一层追问」，交卷再 1 次出六维报告；
> 选项在建会话时就地乱序并重算答案字母，发给客户端的视图里没有答案与参考要点。
>
> **判分正确性**：组卷 300 次、6000 条选项映射逐条核对，0 条不一致；答案字母分布均匀
> （A 1489 / B 1512 / C 1465 / D 1534），不是"记住第几个"能蒙的。
>
> **区分度实测**（同一套评审器，同一方向，各一轮 8 题）：
>
> | 这轮怎么答的 | 客观题 | 总分 | 六维 |
> |---|---|---|---|
> | 选择题一律蒙 A、口头题给一句套话 | 0/6 | **0.83** | 概念 0.5｜结构 0.5｜实操 0｜深度 0.5｜自洽 1.5｜表达 2 |
> | 选择题答对、口头题用考点解析展开 | 6/6 | **3.58** | 概念 4.5｜结构 4｜实操 2｜深度 3.5｜自洽 4.5｜表达 3 |
>
> 拉开 2.75 分，而且**没有一味抬高**：第二轮给的都是背得出来的正确内容，评审照样把「实操经验关联」压到 2 分，
> 总评写"重理论、轻实践、面对追问给不出具体框架和踩过的坑" —— 这是对的判断，不是客套。
> 加上之前两轮故意答差的（1.42、0.58），共 4 轮的分数与人工读同一份记录后的判断一致（±1 档内）。
> 诚实说明：这里的"人工判断"是我读逐字记录给出的，不是第三方评分者。
>
> **顺带修掉两个自己写出来的坑**：
> 1. 公开分享链接原来会把每题的 `reference` / `correct_answer` 一起发出去 —— 等于把答案本挂到公网。
>    现在公开视图只保留"他说了什么 + 面试官怎么评"。
> 2. 登录用户打开别人的分享链接必然 404（先打了带鉴权的接口就没再退回公开接口）。已改成先试自己的、失败再走公开路由。
>
> 另外发现并纠正一处评审器 bug：LangChain 1.x 的 ChatOpenAI 上没有 `.bind()`，
> `model.bind(...).invoke()` 会抛 `model.bind is not a function` 被 catch 吞掉，
> 表现是"点评全部为空但接口 200"。现在按点评/报告分别构造实例来区分 token 与温度。
>
> **未做**：面试分数还没有回填到 `/practice` 的分类掌握度里（两者各算各的）；报告不评语音与流畅度（本就不在范围内）。

- 流程：选方向（RAG/Agent/系统设计）→ 8 题（6 单选 + 2 开放）→ 每题追问一层（依据上一答）→ 交卷生成复盘报告。
- 报告维度（对齐竞品的"多维复盘"，但只评**内容**不做语音）：概念准确性、结构完整度、项目/实操经验关联、深度（是否讲到 trade-off）、引用一致性、改进清单。
- 全部维度打分与理由入库（P0-1 表），形成分类掌握度雷达图。
- **验收**：连续 3 轮模拟面试，分数与人工判断一致（±1 档）；报告可分享为只读链接（也是演示素材）。

#### P1-4 对话体验收尾（A6 + 渲染）

> **进度（2026-09-21）**：聊天已接 `sendMessageStream`（逐段渲染 + 结束光标、出错时保留已吐出的内容并标注中断原因）；
> 新增 `MarkdownLite`（代码块带复制、行内代码、加粗、标题、有序/无序列表），只用 React 元素、不碰 `innerHTML`；
> 消息级"复制回答"已加。实测一次问答内容按 6→118→289→…→1123 字增长，渲染出 1 个代码块 / 1 个列表 / 5 处加粗。
> **未做**：会话列表与持久化（A5，与 chat_threads 一起落）、重新生成、赞/踩反馈（等 P1-1 的 retrieval_log 一起做）。

- 接 `sendMessageStream`（已存在）；`ChatMessage.tsx` 加 Markdown + 代码块高亮 + 复制；
  消息级操作：重新生成、赞/踩（反馈写库，供 P1-1 调参用）；会话列表与标题自动生成。
- **验收**：首 token 可见延迟 < 1.5s（本地 Chroma + 端点正常时）；代码块不再是裸文本。

#### P1-5 简历-JD 匹配报告（从"改写"升级为"可解释"）
- 复用 RAG：把 JD 当 query，检索用户简历片段与题库要点，输出
  ①匹配度评分（技能/经验/项目三类分项）②逐条 gap 及依据 ③改写建议（保留现有流式改写）。
- 导出：`docx`/PDF —— 依赖 `docx` 已在 `package.json`（当前是未使用依赖，正好收尾）。
- **验收**：同一份简历对两个不同 JD 产出可区分报告；导出文件能在 Word 打开。

### P2 · 工程与体验（有余力再做，但两项会被面试官直接看到）

| 项 | 内容 | 备注 |
|---|---|---|
| 测试 | RAG 管线的单测（loaders/splitters/retriever 用固定向量替换）+ 1 条 e2e（`/api/health`→`/api/chat`）；CI 跑 `tsc + eslint + test` | 现状 **0 测试**，`package.json` 无 `test` 脚本；作品集里这是最常见的追问 |
| 性能 | 题库接口从"每请求同步读 680KB"改为启动载入/索引化；`/api/questions` 加 ETag | 有数字可讲 |
| 设计一致性 | 字面 hex（`#0a0a0f` 等 8 个）收敛为 Tailwind token；难度色三处冲突（`constants/config.ts` vs `QuestionDetail.tsx:69` vs `MyQuestionsPage.tsx:139`）统一 | 有 `design-token` 话题可聊 |
| 交互 | `alert/confirm` → toast/对话框；`Empty.tsx` 接入各页；补 Skeleton；`ErrorBoundary` 之外加路由级 errorElement | 组件已写好，属收尾 |
| 移动端 | `AdminDashboard.tsx`（0 个 `md:`）表格降级；非 Home 页响应式 | 演示若用手机打开会露馅 |
| 主题/i18n | `useTheme.ts` 接上（`darkMode:"class"` 已配但无入口）；README 双语→UI 双语文案集中 | 低成本高可见度 |
| 依赖清理 | Tailwind v3 与 `@tailwindcss/vite@4` 混用；未使用依赖（`pptxgenjs` 等） | 顺手 |

---

## 5. 里程碑（单人业余，按 6~8h/周）

| 迭代 | 周期 | 主题 | 交付 | 迭代结束的演示话术 |
|---|---|---|---|---|
| M1 | 2 周 | **止血**：LLM 接通 + 假功能清零 + 持久化层 | P0-1、P0-3、P0-2（CRUD 与导入完成，其余降级）；SQLite 落地 | "所有反馈都是真的，数据能跨刷新和重启" |
| M2 | 2 周 | **可信**：内容质量 + 文档与演示脚本 + 流式与渲染 | P0-4、P0-5、P1-4 | "选项乱序、答案分布均衡，README 每句可演示" |
| M3 | 3 周 | **差异化**：检索可评估 + 引用溯源 | P1-1、P1-2 | "我能给出 hit-rate@5 和负样本拒答率，并解释 chunk 参数为什么这么定" |
| M4 | 3 周 | **产品闭环**：模拟面试 + 简历匹配报告 | P1-3、P1-5 | "从练习到模考到简历，一个完整求职工作流" |
| 机动 | — | P2 按需插空，测试与 CI 建议**在 M3 末尾**插入一次（避免 M4 期间改坏无人知） | | |

**顺序理由**：先做"不做就减分"的（P0），再做"做了才加分"的（P1）；
P1-1/P1-2 排在 P1-3 之前，是因为**评估集是模拟面试打分器质量的前提**（否则复盘报告只能凭感觉），
而"可溯源 + 可度量"才是相对竞品的差异化，模拟面试反而是竞品标配、我们只能做到 70% 相似。

---

## 6. 数据模型草案（新增部分）

```
questions(id, title, content, type['single'|'open'], category, difficulty,
          options_json, answer, answer_points_json, analysis, refs_json,
          owner_user_id NULLABLE, created_at, updated_at)
favorites(user_id, question_id, created_at)                      -- PK(user_id,question_id)
practice_sessions(id, user_id, mode['drill'|'mock'], config_json,
                  score_json, started_at, finished_at)
practice_answers(session_id, question_id, chosen, correct,
                 display_options_json, duration_ms, answered_at)  -- 乱序映射落库，便于复盘还原
chat_threads(id, user_id, title, created_at, updated_at)
chat_messages(id, thread_id, role, content, sources_json,
              feedback NULLABLE['up'|'down'], created_at)
retrieval_log(id, query, top_k_json, min_score, hit_ids_json,
              llm_model, tokens_in, tokens_out, latency_ms, created_at)  -- P1-1/P1-3 的数据源
users(id, email, github_id, password_hash, role, created_at)  -- 由 users.json 迁入
```

迁移策略：`better-sqlite3` + 一个 `scripts/migrate.js`（幂等 upsert 现有 JSON）；
`retrieval_log` 允许采样写入（`RETRIEVAL_LOG_SAMPLE_RATE`），避免免费档磁盘与写放大。

---

## 7. 风险

| # | 风险 | 影响 | 应对 |
|---|---|---|---|
| R1 | ~~LLM 端点未落实~~ 已接入 `agnes-3.0-flash`（2026-09-21 验证通过）。残余风险：**依赖单一第三方中转**（额度/稳定性/隐私均不受控），且 `/api/chat*` 与 `/api/resume/*` 仍无鉴权限流 | 演示期成本与可用性不可控；简历原文经第三方 | P0-3 的限流与预算必须做；`chains.js` 的端点保持可用 `LLM_API_BASE` 一键切换（含 DeepSeek/GLM/Ollama 备案）；对外演示版用只读低额度 key |
| R2 | 单人时间不持续，PRD 烂尾 | 现状已经有一批"写好未接线"的产物（§1.2 B6），会重演 | 每迭代只承诺"可演示的一件事"；假功能一律"降级"而非"以后做"；里程碑表进 `DEMO.md` |
| R3 | **语料版权**：`documents.json` 首条含"星球专属"，疑似来自付费社群 | 公开作品集上商用/展示有侵权风险，且面试官可能追问 | 上线前核授权；拿不到则换成自写/公开资料重建语料（管线不动，只换 `data/`），并把它当作"数据可插拔"的说明素材 |
| R4 | 免费档冷启动 + CPU 嵌入慢（本地嵌入模型首次加载数秒） | 演示时首个请求卡住 | `DEMO.md` 预热脚本；或常驻后端（Render 付费档/UptimeRobot 心跳） |
| R5 | ~~无鉴权接口被刷，产生真金白银 token 费~~ 已由 P0-3 缓解（限流 + 并发闸门 + 简历要求登录）；残余风险是阈值凭经验设定、缺用量观测 | 阈值拍错会影响真实试用者 | 接 P1-1 的 `retrieval_log` 记录 tokens 与延迟后回头校准阈值 |
| R6 | 模拟面试 LLM 打分不稳定 | 复盘报告不可信，反成穿帮点 | 先用 `answer_points` 做规则对齐（覆盖率）再叠加 LLM 主观维度；打分器纳入评估集回归 |
| R7 | GitHub OAuth 成功回路无法自证 —— 需要一个真实 OAuth App（当前 `GITHUB_CLIENT_ID` 为空） | 该登录方式对用户不可见（前端已按 `providers` 自动隐藏入口），但代码路径未被跑通过 | 需要时由你创建 OAuth App（Callback URL 填 `http://localhost:3001/api/auth/github/callback`，生产再换域名）并写入 `backend/.env`；在那之前不要对外宣称"GitHub 登录已验证" |
| R8 | 上游 agnes-ai 为**免费档速率限制**：并发 3 批量生成 165 题时大面积 429，期间线上问答也被限流降级 | 演示时可能突然变成"只给检索原文" | 批量任务一律串行 + 指数退避（`repair-questions.js` 已这么做，实测 143 题降到 1 题失败）；降级提示必须带 429 原文（`service.js` 的 `degradedPrefix`）；对外演示前先跑一次 `/api/health` 与一问验活；要稳定就得升 Token Plan 或换端点 |

---

## 8. 竞品情报来源（中文横评多为软文，需官网复核）

- 2026 年 6 款 AI 面试工具横评（鹅来面 / Final Round AI / 面试猫 / 面试狗 / 牛客 / 白瓜面试）：https://www.cnblogs.com/nut-king/p/21596363
- Best AI Interview Tools 2026（OphyAI / interviewing.io / Pramp / Yoodli / Google Warmup 功能与评分维度）：https://ophyai.com/blog/interview-tips/best-ai-interview-tools-2026
- 15 个 AI 模拟面试平台与真人平台合集（Final Round、Interviews.chat、Google Warmup、Himalayas、Exponent、interviewing.io）：https://blog.csdn.net/2301_79306982/article/details/148902903
- 面试鸭产品页（题库/会员自评，可信度低）：https://www.mianshiya.com/about 、 https://www.mianshiya.com/vip
- 面试鸭第三方评测：https://www.mianlingai.com/blog/mianshiya-review-2026/
- 2026 秋招 AI 面试工具横评补充：https://post.m.smzdm.com/p/ak802v34/ 、 https://m.toutiao.com/article/7677894837349450286/
- 本站现状证据：仓库内 `src/lib/api.ts`、`src/pages/*`、`backend/server.js`、`backend/data/questions.json`（实测 255 题、答案分布 A182/D26/C26/B21）
