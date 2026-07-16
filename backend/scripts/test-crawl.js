const axios = require('axios');
const cheerio = require('cheerio');

const testUrls = [
  { id: 'llm-interview', url: 'https://javaguide.cn/ai/interview-questions/llm-interview-questions.html' },
  { id: 'agent-basis', url: 'https://javaguide.cn/ai/agent/agent-basis.html' },
  { id: 'rag-basis', url: 'https://javaguide.cn/ai/rag/rag-basis.html' },
];

async function test() {
  for (const { id, url } of testUrls) {
    console.log(`\n=== Testing ${id} ===`);
    console.log(`URL: ${url}`);

    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    console.log(`Status: ${resp.status}`);
    console.log(`Content length: ${resp.data.length}`);

    const $ = cheerio.load(resp.data);

    // Check for captcha elements
    const hasForm = $('form').length;
    const hasInput = $('input').length;
    console.log(`Forms: ${hasForm}, Inputs: ${hasInput}`);

    // Check for verification keywords in full HTML
    const keywords = ['验证码', 'captcha', 'verify', 'challenge', 'cloudflare', 'cf-', 'waf'];
    for (const kw of keywords) {
      const found = resp.data.toLowerCase().includes(kw.toLowerCase());
      if (found) console.log(`  Found keyword: "${kw}"`);
    }

    // Check selectors
    const selectors = ['.article-content', '.markdown-body', '#content-container', 'article', '.post-content', '.entry-content', 'main', '.content', '.vp-doc'];
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length) {
        const text = el.text().trim();
        console.log(`  Selector "${sel}": found, text length=${text.length}`);
        if (text.length > 100) {
          console.log(`  First 200 chars: ${text.substring(0, 200)}`);
          break;
        }
      }
    }
  }
}

test().catch(console.error);
