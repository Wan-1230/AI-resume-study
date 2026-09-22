/**
 * 题库 / 文章库的共享只读缓存
 *
 * 之前 /api/questions 每次请求都 readFileSync + JSON.parse 一份 713KB 的文件，
 * 一个页面加载就是两次（题目列表 + 详情）。这里改成进程内缓存，
 * 并用文件 mtime 失效 —— 修题库的脚本（repair-questions.js 等）会直接改写文件，
 * 只缓存不失效就得重启才生效，那种"改了不生效"最容易把人绕进去。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');

const cache = new Map();

/**
 * @param {string} name 文件名（不含路径），如 questions.json
 * @returns {{data: any[], etag: string, bytes: number}}
 */
function readJsonCached(name) {
  const file = path.join(DATA_DIR, name);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    // 文件不存在时不缓存这个结论：补上文件后应当立刻能用
    return { data: [], etag: 'W/"absent"', bytes: 0, body: '[]' };
  }

  const stamp = `${stat.mtimeMs}:${stat.size}`;
  const hit = cache.get(name);
  if (hit && hit.stamp === stamp) return hit.view;

  const raw = fs.readFileSync(file);
  const data = JSON.parse(raw.toString('utf-8'));
  const list = Array.isArray(data) ? data : [];
  const etag = `W/"${crypto.createHash('sha1').update(raw).digest('base64').slice(0, 16)}"`;
  // 连序列化结果一起缓存：677KB 的 JSON.stringify 每次要 ~7ms，光缓存 parse 等于没到底
  const view = { data: list, etag, bytes: raw.length, body: raw.toString('utf-8') };

  cache.set(name, { stamp, view });
  return view;
}

const getQuestions = () => readJsonCached('questions.json');
const getArticles = () => readJsonCached('articles.json');

/** 列表接口的可选过滤；不传参数时返回全量，保持既有前端契约不变 */
function filterList(list, query) {
  const { category, difficulty, limit } = query || {};
  let out = list;
  if (category) out = out.filter((item) => item.category === category);
  if (difficulty) out = out.filter((item) => item.difficulty === difficulty);
  const max = Number(limit);
  if (Number.isFinite(max) && max > 0) out = out.slice(0, Math.min(max, 500));
  return out;
}

/**
 * 带 ETag 的读取响应：命中 If-None-Match 直接 304，正文一个字都不发。
 * 304 响应按规范不能带 body，所以这里绝不调 res.json。
 */
function sendWithCache(req, res, { data, etag, body }) {
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('ETag', etag);
  // 题库是低频变更的共享内容，允许公有缓存但要带校验，避免 CDN 拿旧版打不掉
  res.set('Cache-Control', 'public, max-age=60, must-revalidate');
  if (typeof body === 'string') return res.type('application/json').send(body);
  return res.json(data);
}

module.exports = { getQuestions, getArticles, filterList, sendWithCache, readJsonCached };
