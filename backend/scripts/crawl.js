/**
 * JavaGuide 文章爬虫
 * 从 JavaGuide 网站爬取 AI 应用开发相关文章
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// JavaGuide 基础 URL
const BASE_URL = 'https://javaguide.cn';

// 数据文件路径
const ARTICLES_PATH = path.join(__dirname, '../data/articles.json');
const QUESTIONS_PATH = path.join(__dirname, '../data/questions.json');
const DOCUMENTS_PATH = path.join(__dirname, '../data/documents.json');

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 从 URL 提取文章内容
 */
async function fetchArticleContent(url, retryCount = 0) {
  try {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

    console.log(`  Fetching: ${fullUrl}`);

    const response = await axios.get(fullUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    const $ = cheerio.load(response.data);
    let content = '';

    // 优先使用 VuePress 的 .vp-doc 选择器
    const selectors = [
      '.vp-doc',
      '.article-content',
      '.markdown-body',
      '#content-container',
      'article',
      '.post-content',
      '.entry-content',
      'main'
    ];

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        content = extractTextWithStructure($, element);
        if (content.length > 100) {
          break;
        }
      }
    }

    // 如果没找到内容，尝试提取 body
    if (content.length < 100) {
      content = extractTextWithStructure($, $('body'));
    }

    content = cleanContent(content);
    return content;
  } catch (error) {
    if (retryCount < 2) {
      console.log(`  ⚠ Retry ${retryCount + 1}... (${error.message})`);
      await delay(2000 * (retryCount + 1));
      return await fetchArticleContent(url, retryCount + 1);
    }
    console.error(`  ✗ Error: ${error.message}`);
    return null;
  }
}

/**
 * 提取文本并保留结构
 */
function extractTextWithStructure($, element) {
  let text = '';

  element.children().each((i, child) => {
    const $child = $(child);
    const tagName = child.tagName ? child.tagName.toLowerCase() : '';

    // 跳过脚本、样式和导航
    if (tagName === 'script' || tagName === 'style' || tagName === 'nav' || tagName === 'header' || tagName === 'footer') {
      return;
    }

    // 标题
    if (/^h[1-6]$/.test(tagName)) {
      const level = tagName.charAt(1);
      text += '\n' + '#'.repeat(parseInt(level)) + ' ' + $child.text().trim() + '\n\n';
    }
    // 段落
    else if (tagName === 'p') {
      const pText = $child.text().trim();
      if (pText) {
        text += pText + '\n\n';
      }
    }
    // 列表
    else if (tagName === 'ul' || tagName === 'ol') {
      $child.find('li').each((j, li) => {
        const prefix = tagName === 'ol' ? `${j + 1}. ` : '- ';
        text += prefix + $(li).text().trim() + '\n';
      });
      text += '\n';
    }
    // 代码块
    else if (tagName === 'pre') {
      const code = $child.find('code').text() || $child.text();
      text += '```\n' + code.trim() + '\n```\n\n';
    }
    // 表格
    else if (tagName === 'table') {
      const rows = [];
      $child.find('tr').each((j, tr) => {
        const cells = [];
        $(tr).find('td, th').each((k, cell) => {
          cells.push($(cell).text().trim().replace(/\|/g, '\\|'));
        });
        rows.push('| ' + cells.join(' | ') + ' |');
        if (j === 0) {
          rows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        }
      });
      text += rows.join('\n') + '\n\n';
    }
    // 引用
    else if (tagName === 'blockquote') {
      const quoteText = $child.text().trim();
      if (quoteText) {
        text += '> ' + quoteText.split('\n').join('\n> ') + '\n\n';
      }
    }
    // 其他块元素
    else if (['div', 'section', 'article', 'main', 'details', 'summary'].includes(tagName)) {
      text += extractTextWithStructure($, $child);
    }
    // 内联元素直接取文本
    else if ($child.text().trim()) {
      text += $child.text().trim() + '\n\n';
    }
  });

  return text;
}

/**
 * 清理内容
 */
function cleanContent(content) {
  return content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * 将内容切分成 chunks
 */
function chunkContent(text, maxChunkSize = 1500) {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * 加载题目数据
 */
function loadQuestions() {
  const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));
  return questions.map(q => ({
    id: q.id,
    text: `${q.title}\n\n${q.content}\n\n答案: ${q.answer}`,
    metadata: {
      source: 'question',
      question_id: q.id,
      title: q.title,
      category: q.category,
      difficulty: q.difficulty,
      answer: q.answer
    }
  }));
}

/**
 * 主函数
 */
async function main() {
  console.log('=== JavaGuide 文章爬虫 ===\n');

  const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
  console.log(`Found ${articles.length} articles to crawl\n`);

  const documents = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}] ${article.title}`);

    const content = await fetchArticleContent(article.url);

    if (content && content.length > 100) {
      const chunks = chunkContent(content);

      chunks.forEach((chunk, index) => {
        documents.push({
          id: `${article.id}_chunk_${index}`,
          text: chunk,
          metadata: {
            source: 'article',
            article_id: article.id,
            title: article.title,
            url: `${BASE_URL}${article.url}`,
            category: article.category,
            chunk_index: index,
            total_chunks: chunks.length
          }
        });
      });

      console.log(`  ✓ ${chunks.length} chunks (${content.length} chars)`);
    } else {
      console.log(`  ✗ Failed to extract content`);
      documents.push({
        id: `${article.id}_chunk_0`,
        text: `[文章内容待填充 - ${article.url}]`,
        metadata: {
          source: 'article',
          article_id: article.id,
          title: article.title,
          url: `${BASE_URL}${article.url}`,
          category: article.category,
          chunk_index: 0,
          total_chunks: 1
        }
      });
    }

    // 随机延迟 1-3 秒
    await delay(1000 + Math.random() * 2000);
  }

  // 加载题目
  const questions = loadQuestions();
  documents.push(...questions);

  console.log(`\n=== Results ===`);
  console.log(`Total documents: ${documents.length}`);
  console.log(`- Articles: ${documents.filter(d => d.metadata.source === 'article').length}`);
  console.log(`- Questions: ${documents.filter(d => d.metadata.source === 'question').length}`);

  // 统计成功/失败
  const articleDocs = documents.filter(d => d.metadata.source === 'article');
  const success = articleDocs.filter(d => !d.text.startsWith('[文章内容待填充')).length;
  const failed = articleDocs.filter(d => d.text.startsWith('[文章内容待填充')).length;
  console.log(`- Article success: ${success}, failed: ${failed}`);

  fs.writeFileSync(DOCUMENTS_PATH, JSON.stringify(documents, null, 2), 'utf-8');
  console.log(`\nSaved to ${DOCUMENTS_PATH}`);
  console.log('\nDone!');
}

main().catch(console.error);
