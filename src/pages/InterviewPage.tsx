import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ClipboardList, Link2, Loader2, LogIn, Mic,
  Send, Share2, Sparkles, Target, XCircle, CheckCircle, MinusCircle,
} from 'lucide-react';
import { useStore } from '@/store';
import { getStoredToken } from '@/lib/authApi';
import RadarChart from '@/components/RadarChart';
import {
  interviewApi, InterviewApiError, type AnswerResult, type InterviewDirectionOption,
  type InterviewItem, type InterviewReport, type InterviewSessionView, type SessionSummary,
} from '@/lib/interviewApi';

type Phase = 'loading' | 'setup' | 'running' | 'report' | 'shared' | 'unavailable';

export default function InterviewPage() {
  const { id: sharedId } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState<string | null>(null);

  const [directions, setDirections] = useState<InterviewDirectionOption[]>([]);
  const [graderReady, setGraderReady] = useState(true);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [picked, setPicked] = useState('full');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [directionName, setDirectionName] = useState('');
  const [items, setItems] = useState<InterviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [followDraft, setFollowDraft] = useState('');
  const [busy, setBusy] = useState<'answer' | 'follow' | 'finish' | null>(null);

  const [report, setReport] = useState<InterviewReport | null>(null);
  const [sessionView, setSessionView] = useState<InterviewSessionView | null>(null);
  const [shared, setShared] = useState<InterviewSessionView | null>(null);
  const [sharedByLink, setSharedByLink] = useState(false);
  const [visibility, setVisibility] = useState('private');

  const item = items[index];

  const fail = (error: unknown) => {
    setNotice(error instanceof InterviewApiError ? error.message : '操作失败，请稍后再试');
  };

  // /interview/:id：自己的会话走带鉴权的接口（没分享也能看），别人的走公开接口。
  // 先按"自己的"试一次，404 再退回公开接口 —— 顺序反过来会让登录用户看不了任何分享链接。
  // 用 getStoredToken() 而不是 store.isAuthenticated：store 是挂载后才水合的，
  // 跟着它异步判断会让"刷新自己的报告"先发一次注定 404 的公开请求（截图时实测到了）。
  useEffect(() => {
    if (!sharedId) return;
    const load = async () => {
      let view: InterviewSessionView | null = null;
      if (getStoredToken()) {
        view = await interviewApi.get(sharedId).catch(() => null);
      }
      if (view) {
        setShared(view);
        setSharedByLink(false);
        setPhase('shared');
        return;
      }
      try {
        setShared(await interviewApi.shared(sharedId));
        setSharedByLink(true);
        setPhase('shared');
      } catch (error) {
        setNotice(error instanceof InterviewApiError ? error.message : '报告读不到了');
        setPhase('unavailable');
      }
    };
    void load();
  }, [sharedId]);

  const loadSetup = useCallback(async () => {
    try {
      const meta = await interviewApi.directions();
      setDirections(meta.directions);
      setGraderReady(meta.grader_ready);
      if (!isAuthenticated) { setPhase('setup'); return; }
      setHistory(await interviewApi.list(6));
      setPhase('setup');
    } catch (error) { fail(error); setPhase('setup'); }
  }, [isAuthenticated]);

  useEffect(() => { if (!sharedId) void loadSetup(); }, [sharedId, loadSetup]);

  const start = async () => {
    setNotice(null);
    try {
      const session = await interviewApi.start(picked);
      setSessionId(session.id);
      setDirectionName(session.direction);
      setItems(session.items);
      setGraderReady(session.grader_ready);
      setIndex(0); setChosen(null); setDraft(''); setResult(null); setFollowDraft('');
      setPhase('running');
    } catch (error) { fail(error); }
  };

  const submitAnswer = async () => {
    if (!sessionId || !item) return;
    const answer = item.kind === 'mcq' ? chosen : draft.trim();
    if (!answer) { setNotice(item.kind === 'mcq' ? '先选一个选项' : '写两句再交给面试官'); return; }

    setBusy('answer'); setNotice(null);
    try {
      const r = await interviewApi.answer(sessionId, item.id, answer as string);
      setResult(r.item);
    } catch (error) { fail(error); } finally { setBusy(null); }
  };

  const nextItem = async () => {
    if (!sessionId || !item) return;
    setBusy('follow'); setNotice(null);
    try {
      if (result?.follow_up) await interviewApi.followUp(sessionId, item.id, followDraft.trim() || '（跳过）');
      setResult(null); setChosen(null); setDraft(''); setFollowDraft('');
      if (index + 1 >= items.length) {
        setBusy('finish');
        setReport(await interviewApi.finish(sessionId));
        // 逐题回看要读服务端存的作答记录（含追问），前端只留了当前一题的状态
        setSessionView(await interviewApi.get(sessionId));
        setPhase('report');
      } else {
        setIndex(index + 1);
      }
    } catch (error) { fail(error); } finally { setBusy(null); }
  };

  const toggleShare = async () => {
    if (!sessionId) return;
    const open = visibility !== 'public';
    try {
      const r = await interviewApi.share(sessionId, open);
      setVisibility(r.visibility);
    } catch (error) { fail(error); }
  };

  const copyLink = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/interview/${sessionId}`);
      setNotice('链接已复制');
    } catch { setNotice('浏览器拒绝了剪贴板，手动复制地址栏即可'); }
  };

  if (phase === 'loading') {
    return <Shell onBack={() => navigate('/')} title="模拟面试"><Skelton /></Shell>;
  }

  if (phase === 'unavailable') {
    return (
      <Shell onBack={() => navigate('/')} title="模拟面试">
        <div className="bg-surface border border-line rounded-2xl p-8 text-center">
          <p className="text-bright mb-4">{notice || '这份报告打不开'}</p>
          <button onClick={() => navigate('/interview')} className="px-4 py-2 bg-primary-500/15 text-primary-500 rounded-xl">回到模拟面试</button>
        </div>
      </Shell>
    );
  }

  if (phase === 'shared' && shared) {
    return (
      <Shell onBack={() => navigate('/')} title={sharedByLink ? '面试复盘报告（分享）' : '面试复盘报告'}>
        <div className="bg-surface border border-line rounded-2xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-muted text-xs mb-1">
              {sharedByLink ? '分享的报告' : '我的报告'} · {new Date(shared.created_at).toLocaleString('zh-CN')}
            </p>
            <h2 className="text-lg font-semibold text-bright">{shared.direction}</h2>
          </div>
          {sharedByLink && <span className="text-xs text-muted">只读</span>}
        </div>
        <ReportView report={shared.report} objective={shared.objective} transcript={shared.transcript} items={shared.items} />
      </Shell>
    );
  }

  if (phase === 'setup') {
    return (
      <Shell onBack={() => navigate('/')} title="模拟面试">
        <div className="bg-surface border border-line rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-bright mb-2">一轮 8 题，讲完就出复盘报告</h2>
          <p className="text-sm text-muted leading-relaxed">
            6 道选择 + 2 道口头展开。每题面试官会针对你说的话追问一层，最后按六个维度打分并给出改进清单 ——
            分数低不是坏事，看清差在哪才是这轮的目的。
          </p>
          {!graderReady && (
            <p className="mt-3 text-sm text-amber-400">
              当前后端没配生成能力：客观题照常判分，但六维点评与追问会缺失（报告里会写明哪部分没跑）。
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {directions.map((d) => (
            <button
              key={d.key}
              onClick={() => setPicked(d.key)}
              className={`text-left p-4 rounded-2xl border transition-colors ${
                picked === d.key ? 'border-primary-500/70 bg-primary-500/10' : 'border-line bg-surface hover:border-edge'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-bright">{d.name}</span>
                <span className="text-xs text-muted">{d.available} 题可选</span>
              </div>
              {picked === d.key && <span className="mt-1 inline-block text-xs text-primary-500">已选择</span>}
            </button>
          ))}
        </div>

        {notice && <p className="text-sm text-rose-400 mb-4">{notice}</p>}

        {isAuthenticated ? (
          <button
            onClick={start}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-purple-600 text-ink font-medium flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity"
          >
            <Mic className="w-4 h-4" /><span>开始面试</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-2xl bg-raised border border-edge text-bright font-medium flex items-center justify-center space-x-2"
          >
            <LogIn className="w-4 h-4" /><span>登录后开始（成绩要存进你的账号）</span>
          </button>
        )}

        {history.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-muted mb-3 flex items-center space-x-2">
              <ClipboardList className="w-4 h-4" /><span>最近的面试</span>
            </h3>
            <div className="space-y-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/interview/${h.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-line rounded-xl hover:border-primary-500/30 transition-colors"
                >
                  <span className="text-sm text-bright">{h.direction}</span>
                  <span className="text-xs text-muted flex items-center space-x-3">
                    <span>{h.answered} 题</span>
                    <span className="text-bright">{h.finished ? (h.score_total ?? '—') : '未交卷'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Shell>
    );
  }

  if (phase === 'running' && item) {
    const answered = Boolean(result);
    return (
      <Shell onBack={() => navigate('/interview')} title="面试进行中">
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-muted mb-2">
            <span>第 {index + 1} / {items.length} 题 · {item.category}</span>
            <span>{directionName}</span>
          </div>
          <div className="h-1 bg-line rounded-full overflow-hidden">
            <div className="h-full bg-primary-500/70 transition-all" style={{ width: `${((index + (answered ? 1 : 0)) / items.length) * 100}%` }} />
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-6 mb-4">
          <p className="text-bright leading-relaxed">{item.question}</p>
          {item.kind === 'open' && (
            <p className="mt-2 text-xs text-muted">口头题：像面试时那样把想法说出来，两到四句。</p>
          )}
        </div>

        {!answered ? (
          <>
            {item.kind === 'mcq' ? (
              <div className="space-y-2 mb-4">
                {item.options.map((option) => {
                  const letter = option.charAt(0);
                  return (
                    <button
                      key={option}
                      onClick={() => { setChosen(letter); setNotice(null); }}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                        chosen === letter ? 'border-primary-500/70 bg-primary-500/10 text-bright' : 'border-line bg-surface text-muted hover:border-edge'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setNotice(null); }}
                rows={5}
                placeholder="把你的理解讲出来…"
                className="w-full px-4 py-3 bg-surface border border-line rounded-xl text-sm text-bright mb-4 focus:outline-none focus:border-primary-500/50 resize-none"
              />
            )}
            {notice && <p className="text-sm text-rose-400 mb-3">{notice}</p>}
            <button
              onClick={submitAnswer}
              disabled={busy !== null}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-purple-600 text-ink font-medium flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              {busy === 'answer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{busy === 'answer' ? '面试官在听…' : '回答这题'}</span>
            </button>
          </>
        ) : (
          <Verdict result={result} item={item} followDraft={followDraft} setFollowDraft={setFollowDraft} onNext={nextItem} busy={busy === 'finish' || busy === 'follow'} last={index + 1 >= items.length} />
        )}
      </Shell>
    );
  }

  if (phase === 'report' && report && sessionId) {
    return (
      <Shell onBack={() => navigate('/interview')} title="复盘报告">
        {notice && <p className="text-sm text-amber-400 mb-4">{notice}</p>}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-muted mb-1">{directionName}</p>
            <h2 className="text-lg font-semibold text-bright">这一轮的复盘</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={toggleShare} className={`px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 border transition-colors ${visibility === 'public' ? 'border-primary-500/50 bg-primary-500/10 text-primary-500' : 'border-edge text-muted'}`}>
              <Share2 className="w-3.5 h-3.5" /><span>{visibility === 'public' ? '已公开' : '开启分享'}</span>
            </button>
            {visibility === 'public' && (
              <button onClick={copyLink} className="px-3 py-2 rounded-xl text-xs border border-edge text-muted flex items-center space-x-1.5">
                <Link2 className="w-3.5 h-3.5" /><span>复制链接</span>
              </button>
            )}
          </div>
        </div>
        <ReportView report={report} objective={report.objective} transcript={sessionView?.transcript ?? []} items={items} />
        <button onClick={loadSetup} className="mt-6 w-full py-3 rounded-2xl bg-raised border border-edge text-bright font-medium">
          再来一轮
        </button>
      </Shell>
    );
  }

  return <Shell onBack={() => navigate('/')} title="模拟面试"><Skelton /></Shell>;
}

function Shell({ onBack, title, children }: { onBack: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink">
      <header className="bg-ink-soft/90 backdrop-blur-xl border-b border-line sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={onBack} className="flex items-center space-x-2 text-muted hover:text-primary-500 transition-colors">
              <ArrowLeft className="w-5 h-5" /><span>返回</span>
            </button>
            <h1 className="text-lg font-semibold text-bright">{title}</h1>
            <span className="w-16" />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

function Verdict({ result, item, followDraft, setFollowDraft, onNext, busy, last }: {
  result: AnswerResult; item: InterviewItem; followDraft: string; setFollowDraft: (v: string) => void;
  onNext: () => void; busy: boolean; last: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-2xl p-5">
        {item.kind === 'mcq' ? (
          <div className="flex items-center space-x-2 mb-3">
            {result.correct ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}
            <span className="text-bright">{result.correct ? '选对了' : `正确选项是 ${result.correct_answer}`}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 mb-3 text-muted">
            <MinusCircle className="w-5 h-5" /><span className="text-sm">口头题不判对错，看的是说得清不清楚</span>
          </div>
        )}

        {result.feedback ? (
          <p className="text-sm text-bright leading-relaxed whitespace-pre-wrap">{result.feedback}</p>
        ) : (
          <p className="text-sm text-amber-400">点评没生成（LLM 不可用或这次没返回合法结果），客观题成绩仍然算数。</p>
        )}

        {result.reference && (
          <details className="mt-3">
            <summary className="text-xs text-muted cursor-pointer hover:text-primary-500">看这个考点的参考要点</summary>
            <p className="mt-2 text-sm text-muted leading-relaxed">{result.reference}</p>
          </details>
        )}
      </div>

      {result.follow_up && (
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-xs text-muted mb-2 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" /><span>面试官顺着你的话追问</span>
          </p>
          <p className="text-bright mb-3">{result.follow_up}</p>
          <textarea
            value={followDraft}
            onChange={(e) => setFollowDraft(e.target.value)}
            rows={3}
            placeholder="补充一句（不想答可以留空跳过）"
            className="w-full px-4 py-3 bg-ink-soft border border-line rounded-xl text-sm text-bright focus:outline-none focus:border-primary-500/50 resize-none"
          />
        </div>
      )}

      <button
        onClick={onNext}
        disabled={busy}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-purple-600 text-ink font-medium flex items-center justify-center space-x-2 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        <span>{busy ? '正在整理…' : last ? '答完，交卷出报告' : '下一题'}</span>
      </button>
    </div>
  );
}

function ReportView({ report, objective, transcript, items }: {
  report: InterviewReport | null;
  objective: InterviewReport['objective'];
  transcript: { item_id: string; question: string; answer: string; correct: boolean | null; category: string; feedback: string | null }[];
  items: InterviewItem[];
}) {
  const dimensions = report?.dimensions ?? [];
  const dimensionsReady = Boolean(report && !report.error && dimensions.length);
  const titleOf = useMemo(() => new Map(items.map((i) => [i.id, i.question])), [items]);
  const rows = transcript.length ? transcript : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
        <div className="bg-surface border border-line rounded-2xl p-4">
          {dimensionsReady ? <RadarChart dimensions={dimensions} /> : (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted px-6 text-center">
              六维评分没生成，右边是客观题的真实成绩
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-2xl p-5">
            <p className="text-xs text-muted mb-1">综合评分</p>
            <div className="flex items-end space-x-3">
              <span className="text-4xl font-bold text-bright">{report?.score_total ?? '—'}</span>
              <span className="text-sm text-muted mb-1.5">/ 5</span>
              <span className="ml-auto text-sm text-muted mb-1.5 flex items-center space-x-1.5">
                <Target className="w-4 h-4" />
                <span>选择 {objective.mcq_correct}/{objective.mcq_answered} 对</span>
              </span>
            </div>
            {report?.error && <p className="mt-3 text-sm text-amber-400">评审未完成：{report.error}</p>}
            {report?.summary && <p className="mt-3 text-sm text-bright leading-relaxed">{report.summary}</p>}
          </div>

          {dimensionsReady && (
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
              {dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-bright">{d.name}</span>
                    <span className="text-muted font-mono">{d.score ?? '未评'}</span>
                  </div>
                  <div className="h-1 bg-line rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-primary-500/70" style={{ width: `${((d.score ?? 0) / 5) * 100}%` }} />
                  </div>
                  {d.reason && <p className="text-xs text-muted leading-relaxed">{d.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {report?.strengths?.length ? (
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm font-medium text-bright mb-2">这轮做对的</p>
          <ul className="space-y-1.5">
            {report.strengths.map((s, i) => <li key={i} className="text-sm text-muted">· {s}</li>)}
          </ul>
        </div>
      ) : null}

      {report?.improvements?.length ? (
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm font-medium text-bright mb-3">改进清单</p>
          <div className="space-y-3">
            {report.improvements.map((row, i) => (
              <div key={i} className="flex space-x-3">
                <span className="shrink-0 w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 text-xs flex items-center justify-center font-mono">{row.priority}</span>
                <div>
                  <p className="text-sm text-bright">{row.what}</p>
                  {row.how && <p className="text-xs text-muted mt-1 leading-relaxed">{row.how}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {objective.categories?.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm font-medium text-bright mb-3">按分类看</p>
          <div className="space-y-2">
            {objective.categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <span className="text-muted">{c.category}</span>
                <span className="text-bright font-mono">
                  {c.correct}/{c.total - c.open} 选择对{c.open ? ` · ${c.open} 口头` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm font-medium text-bright mb-3">逐题回看</p>
          <div className="space-y-3">
            {rows.map((t) => (
              <details key={t.item_id}>
                <summary className="text-sm text-muted cursor-pointer hover:text-primary-500">
                  {t.correct === null ? '（口头）' : t.correct ? '✓ ' : '✗ '}
                  {titleOf.get(t.item_id) || t.question}
                </summary>
                <p className="mt-2 text-xs text-muted">你说：{t.answer}</p>
                {t.feedback && <p className="mt-1 text-xs text-muted">点评：{t.feedback}</p>}
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Skelton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 bg-surface border border-line rounded-2xl animate-pulse" />)}
    </div>
  );
}
