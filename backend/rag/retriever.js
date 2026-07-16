/**
 * RAG 检索模块
 */

class Retriever {
  constructor(vectorStore) {
    this.vectorStore = vectorStore;
  }

  async retrieve(query, topK = 5) {
    console.log(`\n🔍 检索: "${query}"`);
    
    const results = await this.vectorStore.query(query, topK);
    
    console.log(`  📋 找到 ${results.length} 个相关文档`);
    
    return results.map(doc => ({
      id: doc.id,
      title: doc.metadata.title,
      content: doc.text,
      category: doc.metadata.category,
      source: doc.metadata.source,
      url: doc.metadata.url || null,
      difficulty: doc.metadata.difficulty || null,
      score: doc.distance ? (1 - doc.distance).toFixed(3) : null
    }));
  }

  buildContext(documents, maxTokens = 2000) {
    if (documents.length === 0) {
      return '没有找到相关的知识库内容。';
    }

    let context = '以下是与问题相关的知识库内容：\n\n';
    let currentLength = 0;

    for (const doc of documents) {
      const docText = `【${doc.title}】(${doc.category})\n${doc.content}\n\n`;
      
      if (currentLength + docText.length > maxTokens) {
        break;
      }
      
      context += docText;
      currentLength += docText.length;
    }

    return context;
  }
}

module.exports = Retriever;
