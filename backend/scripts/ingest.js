/**
 * 知识库导入脚本（LangChain RAG 管线）
 * 流程：加载 → 分块 → 嵌入 → 写入向量库，随后跑测试查询验证检索效果。
 * 说明：
 *   - 导入是全量重建（先清空后写入），可重复执行
 *   - 数据源由 RAG_SOURCES 指定（逗号分隔：.json 知识库 / .txt·.md 文件 / 目录）
 *   - 调试时可用 RAG_INGEST_LIMIT=N 只导入前 N 个文档
 */

const { createRagService } = require('../rag/langchain');

const TEST_QUERIES = [
  '什么是 Token？',
  'RAG 召回率低怎么办？',
  'Agent Loop 是什么？',
  'MCP 和 Function Calling 的区别',
];

async function main() {
  console.log('🚀 AI 面试助手 - LangChain RAG 知识库导入\n' + '='.repeat(50));

  const service = await createRagService();

  const { documents, chunks, count } = await service.ingest();
  console.log(`\n📊 导入统计: ${documents} 个文档 → ${chunks} 个分块 → ${count} 条向量记录`);

  console.log('\n🔍 测试检索...');
  for (const query of TEST_QUERIES) {
    const docs = await service.retrieve(query);
    console.log(`\n  查询: "${query}"`);
    docs.slice(0, 3).forEach((doc, i) => {
      const preview = doc.pageContent.slice(0, 60).replace(/\n/g, ' ');
      console.log(`    ${i + 1}. [${doc.metadata.source}] ${doc.metadata.title || doc.metadata.doc_id} (score: ${doc.metadata.score})`);
    });
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 所有操作完成!');
}

main().catch((error) => {
  console.error('❌ 导入失败:', error);
  process.exit(1);
});
