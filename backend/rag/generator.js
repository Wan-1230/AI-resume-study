/**
 * MiMo LLM 生成模块
 */

const OpenAI = require('openai');

class Generator {
  constructor(apiKey, apiBase) {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: apiBase || 'https://api.mimo.com/v1'
    });
  }

  async generate(query, context, history = []) {
    console.log('\n🤖 生成回答...');
    
    const systemPrompt = `你是一个 AI 面试辅导老师，正在和学生聊天。

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

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `以下是知识库中可能相关的内容，你可以参考：\n${context}\n\n---\n\n用户问：${query}` }
    ];

    // 添加历史对话（最多保留最近5轮）
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.splice(-1, 0, {
        role: msg.role,
        content: msg.content
      });
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'mimo-v2.5', // MiMo 模型名称
        messages: messages,
        temperature: 0.85,
        max_tokens: 1500,
        stream: false
      });

      const answer = completion.choices[0].message.content;
      console.log('  ✅ 回答生成完成');
      
      return answer;
    } catch (error) {
      console.error('  ❌ 生成失败:', error.message);
      throw error;
    }
  }

  async generateStream(query, context, history = [], onChunk) {
    console.log('\n🤖 流式生成回答...');
    
    const systemPrompt = `你是一个 AI 面试辅导老师，正在和学生聊天。

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

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `以下是知识库中可能相关的内容，你可以参考：\n${context}\n\n---\n\n用户问：${query}` }
    ];

    try {
      const stream = await this.client.chat.completions.create({
        model: 'mimo-v2.5',
        messages: messages,
        temperature: 0.85,
        max_tokens: 1500,
        stream: true
      });

      let fullAnswer = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullAnswer += content;
          if (onChunk) onChunk(content);
        }
      }
      
      console.log('  ✅ 流式生成完成');
      return fullAnswer;
    } catch (error) {
      console.error('  ❌ 流式生成失败:', error.message);
      throw error;
    }
  }
}

module.exports = Generator;
