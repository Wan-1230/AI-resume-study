/**
 * 数据导入脚本
 * 从 documents.json 导入到内存向量数据库
 */

const fs = require('fs');
const path = require('path');
const VectorStore = require('../rag/vectorstore');

const DOCUMENTS_PATH = path.join(__dirname, '../data/documents.json');

async function main() {
  console.log('🚀 AI 面试助手 - 知识库导入工具\n');
  console.log('='.repeat(50));

  // 加载文档
  const documents = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf-8'));

  const articles = documents.filter(d => d.metadata.source === 'article');
  const questions = documents.filter(d => d.metadata.source === 'question');

  console.log(`📄 文档总数: ${documents.length}`);
  console.log(`   - 文章: ${articles.length} 个片段`);
  console.log(`   - 题目: ${questions.length} 道`);
  console.log('');

  // 按分类统计
  const byCategory = {};
  documents.forEach(d => {
    const cat = d.metadata.category;
    if (!byCategory[cat]) byCategory[cat] = { articles: 0, questions: 0 };
    if (d.metadata.source === 'article') {
      byCategory[cat].articles++;
    } else {
      byCategory[cat].questions++;
    }
  });

  console.log('📊 分类统计:');
  Object.entries(byCategory).forEach(([cat, counts]) => {
    console.log(`   ${cat}: ${counts.articles} 篇文章, ${counts.questions} 道题`);
  });
  console.log('');

  // 导入到向量数据库
  console.log('📥 导入到向量数据库...');
  const vectorStore = new VectorStore();
  await vectorStore.addDocuments(documents);

  console.log(`✅ 导入完成! 共 ${await vectorStore.getCount()} 个文档已索引`);

  // 测试检索
  console.log('\n🔍 测试检索...');
  const testQueries = [
    '什么是 Token？',
    'RAG 召回率低怎么办？',
    'Agent Loop 是什么？',
    'MCP 和 Function Calling 的区别',
  ];

  for (const query of testQueries) {
    const results = await vectorStore.query(query, 3);
    console.log(`\n  查询: "${query}"`);
    results.forEach((r, i) => {
      const preview = r.text.substring(0, 80).replace(/\n/g, ' ');
      console.log(`    ${i + 1}. [${r.metadata.source}] ${r.metadata.title || r.metadata.question_id} (score: ${(1 - r.distance).toFixed(3)})`);
    });
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 所有操作完成!');
}

main().catch(console.error);
