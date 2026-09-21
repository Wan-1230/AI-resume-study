/**
 * LangChain RAG 回答生成模块
 * 职责：组装「检索 → 提示词 → LLM → 输出解析」的 LCEL 链。
 *   - LLM：ChatOpenAI，兼容任意 OpenAI 协议服务（默认 MiMo，通过 LLM_* 变量可整体替换）
 *   - 链：RunnableSequence，输入 { question, history }，输出字符串答案
 *   - 流式：chain.stream() 逐段产出答案，配合 SSE 接口使用
 */

const { ChatOpenAI } = require('@langchain/openai');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableLambda, RunnableSequence } = require('@langchain/core/runnables');

const SYSTEM_PROMPT = `你是一个 AI 面试辅导老师，正在和学生聊天。

说话风格：
- 像朋友聊天一样自然，不要写成文档
- 用口语化表达，少用"首先、其次、最后"
- 重点讲清楚核心概念，不要堆砌信息
- 可以用"打个比方"、"简单来说"、"你可以这样理解"
- 回答要简洁，除非用户要求详细解释
- 如果知识库里没有相关信息，直接说"这个我不太确定"

格式要求：
- 不要用星号 * 来表示强调或列举
- 需要强调的词用中文双引号""标注，例如："Token"、"上下文窗口"
- 小标题请用 **加粗** 格式，让读者一目了然
- 列举内容用数字 1. 2. 3. 或者中文顿号、分号
- 不要使用 * 号开头的列表格式`;

function createLLM(llmConfig) {
  return new ChatOpenAI({
    model: llmConfig.model,
    apiKey: llmConfig.apiKey,
    temperature: llmConfig.temperature,
    maxTokens: llmConfig.maxTokens,
    streaming: true,
    timeout: llmConfig.timeoutMs,
    // 默认会重试一次：429 时等于一次提问烧两份额度，而免费档的额度正是最先撞上的
    maxRetries: llmConfig.maxRetries,
    configuration: { baseURL: llmConfig.apiBase },
  });
}

// 对话历史 [{role, content}] → LangChain BaseMessage[]（最多保留最近 5 轮）
function normalizeHistory(history = []) {
  const recent = Array.isArray(history) ? history.slice(-10) : [];
  return recent
    .filter((m) => m && typeof m.content === 'string' && m.content)
    .map((m) => {
      const role = String(m.role || '').toLowerCase();
      if (role === 'assistant' || role === 'ai' || role === 'bot') {
        return new AIMessage({ content: m.content });
      }
      if (role === 'system') return new SystemMessage({ content: m.content });
      return new HumanMessage({ content: m.content });
    });
}

/**
 * 组装 RAG 链
 * @param {object} params
 * @param {ScoredRetriever} params.retriever      检索器（retriever 模块）
 * @param {ChatOpenAI}      params.llm            对话模型
 * @param {Function}        params.buildContext   上下文打包函数（retriever 模块导出）
 * @param {number}          params.contextMaxChars 上下文字符预算
 */
function buildRagChain({ retriever, llm, buildContext, contextMaxChars }) {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_PROMPT],
    new MessagesPlaceholder('history'),
    ['human', '以下是知识库中可能相关的内容，你可以参考：\n{context}\n\n---\n\n用户问：{question}'],
  ]);

  return RunnableSequence.from([
    // 第一步：检索 + 上下文打包（整条链只检索一次，后续步骤流式产出）
    RunnableLambda.from(async (input) => ({
      question: input.question,
      history: normalizeHistory(input.history),
      context: buildContext(await retriever.invoke(input.question), contextMaxChars),
    })),
    prompt,
    llm,
    new StringOutputParser(),
  ]);
}

module.exports = { createLLM, buildRagChain, normalizeHistory, SYSTEM_PROMPT };
