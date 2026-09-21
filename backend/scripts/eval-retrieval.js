#!/usr/bin/env node
/**
 * RAG 检索质量评估（P1-1）
 *
 * 指标全部基于「未过滤阈值的原始 top-K」计算，因此同一份结果可以回答两个不同的问题：
 *   - 检索本身好不好 → hit-rate@k、MRR
 *   - 阈值该定多少   → 负样本的 top1 分数分布（拒答率随阈值变化）
 * 直接用 service.retrieve() 会被 RAG_MIN_SCORE 先过滤掉，两个指标就会互相污染。
 *
 * 用法：
 *   node scripts/eval-retrieval.js
 *   node scripts/eval-retrieval.js --min-score=0.35
 *   node scripts/eval-retrieval.js --json=baseline.json
 *   node scripts/eval-retrieval.js --compare=a.json,b.json
 *
 * 换 chunkSize / chunkOverlap 前先 `npm run ingest` 重建，否则测的还是旧分块的向量。
 */

const fs = require('fs');
const path = require('path');

const EVAL_FILE = path.join(__dirname, '..', 'data', 'retrieval-eval.json');
const K = 5; // 固定评估深度，保证不同配置之间可比

const argNum = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : null;
};
const argList = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1].split(',').filter(Boolean) : null;
};

function loadCorpusIndex() {
  const docs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'documents.json'), 'utf-8'));
  const byId = new Map();
  const byArticle = new Map();
  for (const d of docs) {
    byId.set(d.id, d);
    const articleId = d.metadata?.article_id;
    if (articleId) {
      if (!byArticle.has(articleId)) byArticle.set(articleId, new Set());
      byArticle.get(articleId).add(d.id);
    }
  }
  return { byId, byArticle };
}

/** 把一条标注展开成「可接受的分块 id 集合」 */
function acceptableSet(expected, corpus) {
  const ids = new Set(Array.isArray(expected.doc_ids) ? expected.doc_ids : []);
  const articles = [
    ...(Array.isArray(expected.article_ids) ? expected.article_ids : []),
    ...(expected.article_id ? [expected.article_id] : []),
  ];
  for (const articleId of articles) {
    for (const id of corpus.byArticle.get(articleId) || []) ids.add(id);
  }
  return ids;
}

/** 标注文件自身的体检：期望 id 必须在语料里存在，否则指标是假的 */
function validateCases(cases, corpus) {
  const problems = [];
  for (const item of cases) {
    if (item.kind === 'negative') continue;
    const articles = [
      ...(Array.isArray(item.expect?.article_ids) ? item.expect.article_ids : []),
      ...(item.expect?.article_id ? [item.expect.article_id] : []),
    ];
    for (const articleId of articles) {
      if (!corpus.byArticle.has(articleId)) problems.push(`${item.id}: 语料中不存在文章 ${articleId}`);
    }
    for (const id of item.expect?.doc_ids || []) {
      if (!corpus.byId.has(id)) problems.push(`${item.id}: 语料中不存在分块 ${id}`);
    }
    if (item.kind !== 'negative' && acceptableSet(item.expect, corpus).size === 0) {
      problems.push(`${item.id}: 可接受分块为空`);
    }
  }
  return problems;
}

const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
};

const SWEEP = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];

function score(cases, hits, corpus, minScore) {
  const positives = cases.filter((c) => c.kind !== 'negative');
  const negatives = cases.filter((c) => c.kind === 'negative');

  const hit = [0, 0, 0]; // @1 / @3 / @5
  let reciprocalRankSum = 0;
  const miss = [];
  const positiveTop1 = [];
  // 每条正样本「最相关分块的分数」= 阈值过滤后仍能保住这条命中的最高分
  const bestRelevant = [];

  for (const item of positives) {
    const expected = acceptableSet(item.expect, corpus);
    const ranks = hits.get(item.id);
    const rank = ranks.findIndex((h) => h.ids.some((id) => expected.has(id)));
    const relevantScores = ranks.filter((h) => h.ids.some((id) => expected.has(id))).map((h) => h.score);

    positiveTop1.push(ranks.length ? ranks[0].score : 0);
    // -1 是哨兵：未命中的正样本在任何阈值下都算「没保住」，否则 sweep 的保留率会虚高
    bestRelevant.push(relevantScores.length ? Math.max(...relevantScores) : -1);

    if (rank < 0) {
      miss.push(`${item.id} 「${item.query.slice(0, 24)}…」top${K} 未命中`);
      continue;
    }
    if (rank < 1) hit[0] += 1;
    if (rank < 3) hit[1] += 1;
    if (rank < 5) hit[2] += 1;
    reciprocalRankSum += 1 / (rank + 1);
  }

  // 负样本：top1 分数低于阈值即算「正确拒答」
  const negativeTop1 = [];
  for (const item of negatives) {
    const top = hits.get(item.id)[0];
    negativeTop1.push(top ? top.score : 0);
  }
  positiveTop1.sort((a, b) => a - b);
  negativeTop1.sort((a, b) => a - b);

  const shareBelow = (values, t) => values.filter((v) => v < t).length / (values.length || 1);

  return {
    config: { k: K, min_score: minScore, positives: positives.length, negatives: negatives.length },
    metrics: {
      hit_rate_at_1: +(hit[0] / positives.length).toFixed(4),
      hit_rate_at_3: +(hit[1] / positives.length).toFixed(4),
      hit_rate_at_5: +(hit[2] / positives.length).toFixed(4),
      mrr_at_5: +(reciprocalRankSum / positives.length).toFixed(4),
      negative_abstain_rate: negatives.length ? +(shareBelow(negativeTop1, minScore)).toFixed(4) : null,
      positive_hit_retention: +(1 - shareBelow(bestRelevant, minScore)).toFixed(4),
      positive_top1_score: {
        min: positiveTop1[0] ?? null,
        p50: percentile(positiveTop1, 0.5),
        p90: percentile(positiveTop1, 0.9),
        max: positiveTop1[positiveTop1.length - 1] ?? null,
      },
      negative_top1_score: {
        min: negativeTop1[0] ?? null,
        p50: percentile(negativeTop1, 0.5),
        p90: percentile(negativeTop1, 0.9),
        max: negativeTop1[negativeTop1.length - 1] ?? null,
      },
      // 阈值不是越高越好：这一列直接给出「拒答多少噪声」换「丢掉多少真命中」
      threshold_sweep: SWEEP.map((t) => ({
        threshold: t,
        negative_abstain: +(shareBelow(negativeTop1, t)).toFixed(4),
        positive_hit_kept: +(1 - shareBelow(bestRelevant, t)).toFixed(4),
      })),
    },
    misses: miss.slice(0, 15),
  };
}

function printReport(label, result) {
  const m = result.metrics;
  console.log(`\n=== ${label} ===`);
  console.log(`配置: top${result.config.k}, min_score=${result.config.min_score}, 正样本 ${result.config.positives} 条, 负样本 ${result.config.negatives} 条`);
  console.log(`hit-rate@1/3/5 : ${(m.hit_rate_at_1 * 100).toFixed(1)}% / ${(m.hit_rate_at_3 * 100).toFixed(1)}% / ${(m.hit_rate_at_5 * 100).toFixed(1)}%`);
  console.log(`MRR@${result.config.k}       : ${m.mrr_at_5}`);
  console.log(`负样本正确拒答  : ${m.negative_abstain_rate === null ? 'n/a' : `${(m.negative_abstain_rate * 100).toFixed(1)}%`}（阈值 ${result.config.min_score}）`);
  console.log(`正样本命中保留  : ${(m.positive_hit_retention * 100).toFixed(1)}%（同一阈值下）`);
  console.log(`负样本 top1 分数 : min=${m.negative_top1_score.min} p50=${m.negative_top1_score.p50} p90=${m.negative_top1_score.p90} max=${m.negative_top1_score.max}`);
  console.log(`正样本 top1 分数 : min=${m.positive_top1_score.min} p50=${m.positive_top1_score.p50} p90=${m.positive_top1_score.p90} max=${m.positive_top1_score.max}`);
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  console.log(`阈值扫描（拒答噪声 vs 保住真命中）:`);
  console.log('  阈值'.padEnd(12), '拒答率'.padStart(10), '命中保留'.padStart(10));
  for (const row of m.threshold_sweep) {
    console.log(
      `  ${row.threshold}`.padEnd(12),
      pct(row.negative_abstain).padStart(10),
      pct(row.positive_hit_kept).padStart(10)
    );
  }
  if (result.misses.length) {
    console.log(`未命中（前 ${result.misses.length} 条）:`);
    for (const line of result.misses) console.log('  -', line);
  }
}

function printCompare(aPath, bPath) {
  const a = JSON.parse(fs.readFileSync(aPath, 'utf-8'));
  const b = JSON.parse(fs.readFileSync(bPath, 'utf-8'));
  const keys = ['hit_rate_at_1', 'hit_rate_at_3', 'hit_rate_at_5', 'mrr_at_5', 'negative_abstain_rate', 'positive_hit_retention'];
  console.log(`\n=== 对比 ${aPath} → ${bPath} ===`);
  console.log('指标'.padEnd(22), 'A'.padStart(10), 'B'.padStart(10), 'Δ'.padStart(10));
  for (const key of keys) {
    const av = a.metrics[key];
    const bv = b.metrics[key];
    if (av == null || bv == null) continue;
    console.log(key.padEnd(22), String(av).padStart(10), String(bv).padStart(10), (bv - av >= 0 ? '+' : '') + (bv - av).toFixed(4));
  }
  if (a.metrics.threshold_sweep && b.metrics.threshold_sweep) {
    console.log('\n阈值扫描 A(拒答/保留) → B(拒答/保留):');
    a.metrics.threshold_sweep.forEach((row, i) => {
      const other = b.metrics.threshold_sweep[i];
      if (!other) return;
      console.log(
        `  ${row.threshold}`.padEnd(10),
        `${(row.negative_abstain * 100).toFixed(0)}%/${(row.positive_hit_kept * 100).toFixed(0)}%`.padStart(12),
        '→'.padStart(2),
        `${(other.negative_abstain * 100).toFixed(0)}%/${(other.positive_hit_kept * 100).toFixed(0)}%`.padStart(12)
      );
    });
  }
}

async function main() {
  const compare = argList('compare');
  if (compare && compare.length === 2) return printCompare(compare[0], compare[1]);

  const minScore = argNum('min-score') ?? Number(process.env.RAG_MIN_SCORE ?? 0.3);

  const evalSet = JSON.parse(fs.readFileSync(EVAL_FILE, 'utf-8'));
  const corpus = loadCorpusIndex();

  const problems = validateCases(evalSet.cases, corpus);
  if (problems.length) {
    console.error('标注文件有问题，指标不可信：');
    for (const p of problems.slice(0, 10)) console.error('  -', p);
    process.exitCode = 1;
    return;
  }

  // 评估用的检索深度与阈值解耦：始终取 top5 原始结果，阈值只用于算拒答
  process.env.RAG_MIN_SCORE = '0';
  process.env.RAG_TOP_K = String(K);
  if (argNum('chunk-size')) process.env.RAG_CHUNK_SIZE = String(argNum('chunk-size'));
  if (argNum('chunk-overlap')) process.env.RAG_CHUNK_OVERLAP = String(argNum('chunk-overlap'));

  const { createRagService } = require('../rag/langchain');
  const service = await createRagService();
  console.log(`后端=${service.health().vector_backend} embedding=${service.health().embedding} 用例=${evalSet.cases.length} 条`);

  const hits = new Map();
  for (const item of evalSet.cases) {
    const results = await service.vectorStore.similaritySearchWithScore(item.query, K);
    hits.set(
      item.id,
      results.map((r) => ({
        // 向量库里的 id 字段在不同后端下不一定是标注用的块 id，doc_id 才是稳定来源
        ids: [r.document?.id, r.document?.metadata?.doc_id].filter(Boolean).map(String),
        score: Number(r.score.toFixed(4)),
      }))
    );
  }

  const result = score(evalSet.cases, hits, corpus, minScore);
  printReport(service.health().vector_backend, result);

  const jsonPath = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1];
  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify({ ...result, backend: service.health().vector_backend }, null, 2));
    console.log(`结果已存 ${jsonPath}（用 --compare=a.json,b.json 看差异）`);
  }
}

main().catch((e) => {
  console.error('评估失败:', e.message);
  process.exitCode = 1;
});
