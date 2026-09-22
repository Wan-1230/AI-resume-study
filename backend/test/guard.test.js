// backend/package.json 未声明 type:module，这里统一用 CJS 写法（node --test 直接可跑）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { chatLimiter, resumeLimiter, llmConcurrencyGate } = require('../guard.js');

/** guard.js 只用到 req.user/req.ip 与 res.set/status/json/on('finish'|'close')，用最小替身即可 */
function fakeReq({ ip = '10.0.0.1', user = null } = {}) {
  return { ip, user };
}

function fakeRes() {
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    listeners: {},
    set(key, value) { res.headers[key] = value; return res; },
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    on(event, fn) { res.listeners[event] = fn; return res; },
    emit(event) { res.listeners[event]?.(); },
  };
  return res;
}

const next = () => {};

test('滑动窗口：超过上限后返回 429 并带 Retry-After', () => {
  const limit = chatLimiter({ windowMs: 10_000, max: 3 });
  const req = fakeReq();

  for (let i = 0; i < 3; i += 1) {
    const res = fakeRes();
    limit(req, res, next);
    assert.equal(res.statusCode, null, `第 ${i + 1} 次应当放行`);
  }

  const blocked = fakeRes();
  let calledNext = false;
  limit(req, blocked, () => { calledNext = true; });
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers['Retry-After']) >= 1, 'Retry-After 应当是秒数');
  assert.match(blocked.body.error, /(\d+) 秒后再试/);
  assert.equal(calledNext, false, '被限流时不能继续往下走');
});

test('限流按调用方分别计数：换个 IP 不受影响', () => {
  const limit = resumeLimiter({ windowMs: 10_000, max: 1 });
  const a = fakeRes();
  limit(fakeReq({ ip: '1.1.1.1' }), a, next);
  const b = fakeRes();
  limit(fakeReq({ ip: '2.2.2.2' }), b, next);
  assert.equal(b.statusCode, null, '不同 IP 各自有额度');

  const again = fakeRes();
  limit(fakeReq({ ip: '1.1.1.1' }), again, next);
  assert.equal(again.statusCode, 429, '同一 IP 第二次应当挡住');
});

test('登录用户按 id 归因，换 IP 也只有一份额度', () => {
  const limit = chatLimiter({ windowMs: 10_000, max: 1 });
  const user = { id: 'u42' };
  assert.equal(fakeRes().statusCode, null);
  const first = fakeRes();
  limit(fakeReq({ ip: '9.9.9.9', user }), first, next);
  const second = fakeRes();
  limit(fakeReq({ ip: '8.8.8.8', user }), second, next);
  assert.equal(first.statusCode, null);
  assert.equal(second.statusCode, 429);
});

test('并发闸门：超出上限先排队，队列满则 503', async () => {
  const gate = llmConcurrencyGate({ max: 1, maxQueue: 1, waitMs: 5000 });
  const started = [];

  const run = () => {
    const res = fakeRes();
    gate(fakeReq(), res, () => started.push(res));
    return res;
  };

  const first = run();
  assert.equal(first.statusCode, null, '第一个应当立即放行');
  const queued = run();
  assert.equal(queued.statusCode, null, '第二个进队列，不立刻拒绝');
  const rejected = run();
  assert.equal(rejected.statusCode, 503, '队列满了要拒绝');
  assert.equal(started.length, 1, '放行数不超过 max');

  first.emit('close');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started.length, 2, '释放名额后队列里的请求应当被放行');
});

test('闸门名额必须归还：finish 与 close 同时发生也只减一次', async () => {
  const gate = llmConcurrencyGate({ max: 1, maxQueue: 5, waitMs: 5000 });
  const started = [];
  const res = fakeRes();
  gate(fakeReq(), res, () => started.push(res));
  res.emit('finish');
  res.emit('close');
  await new Promise((r) => setImmediate(r));

  const probe = fakeRes();
  gate(fakeReq(), probe, () => started.push(probe));
  assert.equal(probe.statusCode, null, '重复释放不应把名额吃掉');
});

test('限流中间件挂在真实 express 链路上可工作', async () => {
  const app = express();
  app.get('/x', chatLimiter({ windowMs: 10_000, max: 2 }), (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/x`;

  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(base)).status, 200);
  const third = await fetch(base);
  assert.equal(third.status, 429);
  server.close();
});
