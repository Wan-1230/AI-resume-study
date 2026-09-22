/**
 * 检索日志与派生统计
 *
 * 这张表存在的唯一理由：阈值和 chunk 参数不能靠感觉调。
 * PRD R5 的残余风险就是"阈值拍脑袋"，没有真实查询的命中分布，
 * P1-1 那套标注集只能证明"离线指标是多少"，证明不了"线上用户在问什么、有没有捞到"。
 *
 * 只记查询与命中元数据（id / 标题 / 分数），不记答案正文。
 */

const { query, queryOne, execute, nowIso } = require('../db');

/** 采样率 0~1；默认 1（本站量级很小，先全记，等真成了负担再降） */
function sampleRate(env = process.env) {
  const raw = Number(env.RETRIEVAL_LOG_SAMPLE_RATE);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0, Math.min(1, raw));
}

function shouldLog(env = process.env) {
  const rate = sampleRate(env);
  return rate >= 1 || (rate > 0 && Math.random() < rate);
}

/**
 * 写一条检索日志。**绝不抛错**：这是观测，不能让观测把用户的回答带崩。
 * @returns {Promise<number|null>} 自增 id，跳过或失败时为 null
 */
async function logRetrieval({ userId, threadId = null, query: text, topK, minScore, documents = [], llmModel = null, abstained = false, latencyMs = null }) {
  try {
    if (!shouldLog() || !text) return null;
    // 兼容两种入参：LangChain Document（metadata 里取）与已展平的来源对象（{id,title,score}）
    const hits = documents.slice(0, topK || 5).map((doc) => ({
      id: doc?.metadata?.doc_id ?? doc?.id ?? null,
      title: doc?.metadata?.title ?? doc?.title ?? null,
      score: typeof doc?.metadata?.score === 'number' ? doc.metadata.score : (typeof doc?.score === 'number' ? doc.score : null),
    }));
    const row = await queryOne(
      `INSERT INTO retrieval_log (user_id, thread_id, query, top_k, min_score, hit_ids_json, llm_model, abstained, latency_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        userId || null,
        threadId,
        String(text).slice(0, 500),
        topK || hits.length,
        minScore ?? 0,
        JSON.stringify(hits),
        llmModel,
        abstained ? 1 : 0,
        latencyMs,
        nowIso(),
      ]
    );
    return row?.id ?? null;
  } catch (error) {
    console.error('[retrieval_log] 写入失败（不影响回答）:', error.message);
    return null;
  }
}

/**
 * 管理端"检索质量"页的数据：真实查询的命中分布 + 拒答率 + 反馈比。
 *
 * 全部只取每次检索的 top1（`(hit_ids_json::jsonb -> 0)`）：
 * 一行一次检索，不去做数组展开 —— 展开会把一条日志变成多行，
 * 后面就得靠"按查询去重"找补，那种统计最容易数错。
 * days 只用来限制扫描范围，走参数绑定，不接受外部拼 SQL。
 */
async function retrievalStats({ days = 7 } = {}) {
  const window = Math.max(1, Math.min(Number(days) || 7, 90));
  // created_at 存的是 ISO 文本（本库全部时间列都这样），和 now() 比较必须显式转，
  // 否则 Postgres 直接报 "operator does not exist: text >= timestamptz"
  const since = "created_at::timestamptz >= now() - make_interval(days => $1)";

  const totals = await queryOne(
    `SELECT COUNT(*)::int AS queries,
            COUNT(*) FILTER (WHERE abstained = 1)::int AS abstained,
            COUNT(*) FILTER (WHERE hit_ids_json = '[]')::int AS empty,
            AVG(latency_ms)::float AS avg_latency_ms
     FROM retrieval_log WHERE ${since}`,
    [window]
  );

  // top1 分数分桶：真实查询落在阈值哪一侧，比均值有用
  const buckets = await query(
    `SELECT bucket, COUNT(*)::int AS n FROM (
       SELECT CASE
         WHEN hit_ids_json = '[]' OR (hit_ids_json::jsonb -> 0 ->> 'score') IS NULL THEN '0 无命中'
         WHEN (hit_ids_json::jsonb -> 0 ->> 'score')::float < 0.4 THEN '1 <0.40'
         WHEN (hit_ids_json::jsonb -> 0 ->> 'score')::float < 0.5 THEN '2 0.40-0.50'
         WHEN (hit_ids_json::jsonb -> 0 ->> 'score')::float < 0.6 THEN '3 0.50-0.60'
         WHEN (hit_ids_json::jsonb -> 0 ->> 'score')::float < 0.7 THEN '4 0.60-0.70'
         ELSE '5 >=0.70' END AS bucket
       FROM retrieval_log WHERE ${since}
     ) t GROUP BY bucket ORDER BY bucket`,
    [window]
  );

  const feedback = await queryOne(
    `SELECT COUNT(*) FILTER (WHERE feedback = 'up')::int AS up,
            COUNT(*) FILTER (WHERE feedback = 'down')::int AS down,
            COUNT(*) FILTER (WHERE feedback IS NULL)::int AS unrated
     FROM chat_messages WHERE role = 'assistant'`
  );

  const recent = await query(
    `SELECT query, abstained, latency_ms, created_at,
            COALESCE(hit_ids_json::jsonb -> 0 ->> 'title', '（无命中）') AS top_title,
            (hit_ids_json::jsonb -> 0 ->> 'score')::float AS top_score
     FROM retrieval_log WHERE ${since} ORDER BY created_at DESC LIMIT 15`,
    [window]
  );

  return {
    window_days: window,
    queries: totals?.queries ?? 0,
    abstained: totals?.abstained ?? 0,
    empty_hits: totals?.empty ?? 0,
    abstain_rate: totals?.queries ? Number((totals.abstained / totals.queries).toFixed(4)) : null,
    avg_latency_ms: totals?.avg_latency_ms ? Math.round(totals.avg_latency_ms) : null,
    top1_score_buckets: buckets,
    feedback: feedback || { up: 0, down: 0, unrated: 0 },
    recent: (recent || []).map((row) => ({
      query: row.query,
      top_title: row.top_title,
      top_score: row.top_score === null ? null : Number(row.top_score),
      abstained: Boolean(row.abstained),
      created_at: row.created_at,
    })),
  };
}

module.exports = { logRetrieval, retrievalStats, sampleRate };
