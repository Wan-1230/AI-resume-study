/**
 * 向量数据库模块 - 使用内存存储 + TF-IDF 相似度
 * 无需外部服务，适合本地开发
 */

const fs = require('fs');
const path = require('path');

class VectorStore {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'chroma_db');
    this.documents = [];
    this.vocab = new Map();
    this.idf = new Map();
  }

  async initialize() {
    console.log('📦 初始化向量数据库（内存模式）...');
    
    // 尝试从文件加载已有数据
    const dataFile = path.join(this.dbPath, 'documents.json');
    if (fs.existsSync(dataFile)) {
      try {
        this.documents = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        this.buildVocab();
        console.log(`  ✅ 从文件加载 ${this.documents.length} 个文档`);
      } catch (e) {
        console.log('  ⚠️ 数据文件损坏，使用空数据库');
        this.documents = [];
      }
    }
    
    return this;
  }

  buildVocab() {
    this.vocab.clear();
    this.idf.clear();
    
    const docCount = this.documents.length;
    const termDocCount = new Map();
    
    for (const doc of this.documents) {
      const terms = this.tokenize(doc.text);
      const uniqueTerms = new Set(terms);
      
      for (const term of uniqueTerms) {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      }
    }
    
    // 计算 IDF
    for (const [term, count] of termDocCount) {
      this.idf.set(term, Math.log(docCount / (1 + count)));
    }
  }

  tokenize(text) {
    // 简单的分词：按空格和标点分割，转换为小写
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  tfidfVector(text) {
    const terms = this.tokenize(text);
    const tf = new Map();
    
    for (const term of terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }
    
    const vector = new Map();
    for (const [term, count] of tf) {
      const tfidf = (count / terms.length) * (this.idf.get(term) || 0);
      vector.set(term, tfidf);
    }
    
    return vector;
  }

  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const [term, value] of vec1) {
      if (vec2.has(term)) {
        dotProduct += value * vec2.get(term);
      }
      norm1 += value * value;
    }
    
    for (const [, value] of vec2) {
      norm2 += value * value;
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async addDocuments(documents) {
    console.log(`\n📥 添加 ${documents.length} 个文档到向量数据库...`);

    this.documents = [...this.documents, ...documents];
    this.buildVocab();
    
    // 保存到文件
    this.saveToFile();
    
    console.log(`  ✅ 数据库中共 ${this.documents.length} 个文档`);
  }

  async query(text, nResults = 5) {
    console.log(`\n🔍 检索: "${text}"`);
    
    const queryVec = this.tfidfVector(text);
    
    // 计算所有文档的相似度
    const scores = this.documents.map((doc, index) => {
      const docVec = this.tfidfVector(doc.text);
      const score = this.cosineSimilarity(queryVec, docVec);
      return { index, score };
    });
    
    // 按相似度排序
    scores.sort((a, b) => b.score - a.score);
    
    // 返回 Top-K
    const results = scores.slice(0, nResults).map(item => ({
      id: this.documents[item.index].id,
      text: this.documents[item.index].text,
      metadata: this.documents[item.index].metadata,
      distance: 1 - item.score
    }));
    
    return results;
  }

  async getCount() {
    return this.documents.length;
  }

  saveToFile() {
    const dataFile = path.join(this.dbPath, 'documents.json');
    
    // 确保目录存在
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
    
    fs.writeFileSync(dataFile, JSON.stringify(this.documents, null, 2));
  }

  async deleteAll() {
    this.documents = [];
    this.vocab.clear();
    this.idf.clear();
    console.log('  🗑️ 已清空数据库');
  }
}

module.exports = VectorStore;
