/**
 * 限流与 LLM 并发闸门。
 *
 * 为什么手写而不用 express-rate-limit：LLM 调用是这条链路上唯一昂贵的下游，
 * 令牌桶只能限制「请求速率」，限不住「同时在飞的推理数」——后者才是把上游
 * 打爆、把免费额度烧穿的原因。两者共用一套按调用方归因的键。
 *
 * 键的取法：登录用户按 id 归因，匿名按 IP。server.js 已设 trust proxy，
 * 否则在 Render / Cloudflare 后面所有访客会被算成同一个人。
 */

const WINDOW_MS = Number(process.env.GUARD_WINDOW_MS) || 60 * 1000;

function callerKey(req) {
  return req.user && req.user.id ? `u:${req.user.id}` : `ip:${req.ip}`;
}

/** 滑动窗口计数限流。返回 Express 中间件工厂。 */
function chatLimiter({ windowMs = WINDOW_MS, max = Number(process.env.CHAT_RATE_MAX) || 20 } = {}) {
  const hits = new Map();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, stamps] of hits) {
      const live = stamps.filter(t => now - t < windowMs);
      if (live.length) hits.set(key, live);
      else hits.delete(key);
    }
  }, windowMs);
  sweeper.unref();

  return function limit(req, res, next) {
    const key = callerKey(req);
    const now = Date.now();
    const live = (hits.get(key) || []).filter(t => now - t < windowMs);

    if (live.length >= max) {
      hits.set(key, live);
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - live[0])) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `提问太频繁，请 ${retryAfter} 秒后再试` });
    }

    live.push(now);
    hits.set(key, live);
    return next();
  };
}

/** 简历优化更吃 token，单独一条更紧的额度，避免一次长文把聊天额度挤干。 */
function resumeLimiter({ windowMs = WINDOW_MS, max = Number(process.env.RESUME_RATE_MAX) || 5 } = {}) {
  return chatLimiter({ windowMs, max });
}

/**
 * 并发闸门：同时在飞的 LLM 调用不超过 max，超出排队，队列满或等待超时直接 503。
 *
 * 释放点必须覆盖所有终止路径：正常结束走 finish，客户端中途断开（关掉 SSE、
 * 刷新页面）走 close。done 标记防止两条事件都触发时把名额多还一次。
 */
function llmConcurrencyGate({
  max = Number(process.env.LLM_MAX_CONCURRENT) || 2,
  maxQueue = Number(process.env.LLM_MAX_QUEUE) || 10,
  waitMs = Number(process.env.LLM_QUEUE_WAIT_MS) || 15 * 1000,
} = {}) {
  let active = 0;
  const waiting = [];

  const pump = () => {
    while (active < max && waiting.length) {
      const entry = waiting.shift();
      clearTimeout(entry.timer);
      active += 1;
      entry.start();
    }
  };

  const finish = () => {
    active = Math.max(0, active - 1);
    pump();
  };

  function gate(req, res, next) {
    if (waiting.length >= maxQueue) {
      res.set('Retry-After', '5');
      return res.status(503).json({ error: '服务繁忙，请稍后再试' });
    }

    const start = () => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        finish();
      };
      res.on('finish', release);
      res.on('close', release);
      next();
    };

    const entry = { start, timer: null, aborted: false };
    entry.timer = setTimeout(() => {
      const at = waiting.indexOf(entry);
      if (at >= 0) waiting.splice(at, 1);
      if (entry.aborted) return;
      res.set('Retry-After', '5');
      res.status(503).json({ error: '前方排队太久，请稍后再试' });
    }, waitMs);
    entry.timer.unref();

    // 排队期间客户端断开（关页面、断 SSE）：立刻让出队位，别占着名额等超时
    res.on('close', () => {
      entry.aborted = true;
      const at = waiting.indexOf(entry);
      if (at >= 0) {
        waiting.splice(at, 1);
        clearTimeout(entry.timer);
      }
    });

    waiting.push(entry);
    pump();
  }

  gate.stats = () => ({ active, queued: waiting.length, max });
  return gate;
}

module.exports = { chatLimiter, resumeLimiter, llmConcurrencyGate };
