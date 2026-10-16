#!/usr/bin/env node
// spec-schema-org 오케스트레이터 — 엔진 독립(claude / codex / mock)
//
//   node run.mjs --dir <작업폴더> --check
//   node run.mjs --dir <작업폴더> --run A|B [--fresh] [--engine claude|codex|mock] [--mock-reject S5]
//
// - 에이전트 호출 1회 = 헤드리스 CLI 1회 (claude -p / codex exec). 프롬프트는 stdin 으로 넘긴다.
// - 결과는 에이전트가 BASE/.run/out/<seq>-<label>.json 에 쓴다 → 오케스트레이터가 검증해 읽는다.
// - 커밋은 오케스트레이터가 직접 한다 (단계·반복마다 1개).
// - 상태는 BASE/.run/state.json — 같은 명령을 다시 실행하면 이어서 한다.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// ── 인자
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  if (i < 0) return def
  const v = argv[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const BASE = path.resolve(opt('dir', '.'))
const RUN = String(opt('run', '')).toUpperCase()
const CHECK = opt('check', false) === true
const FRESH = opt('fresh', false) === true
const ENGINE_OVERRIDE = opt('engine', null)
const MOCK_REJECT = opt('mock-reject', null)

const cfgPath = path.join(BASE, 'config.json')
if (!fs.existsSync(cfgPath)) die(`config.json 이 없다: ${cfgPath} (init.mjs 로 작업 폴더를 먼저 만든다)`)
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
const P = path.join(BASE, 'prompts')
const RUN_DIR = path.join(BASE, '.run')
const OUT_DIR = path.join(RUN_DIR, 'out')
const LOG_DIR = path.join(RUN_DIR, 'logs')
const STATE = path.join(RUN_DIR, 'state.json')
for (const d of [OUT_DIR, LOG_DIR]) fs.mkdirSync(d, { recursive: true })

function die(msg) { console.error(`✖ ${msg}`); process.exit(1) }
function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`) }
function sh(cmd, args, o = {}) { return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...o }) }

// ── 단계 정의
const STAGES = [
  { id: 'S0', title: '정본 정리', role: 'S0-spec-curator', kind: 'produce', brief: false },
  { id: 'S1', title: '요구사항 분석', role: 'S1-requirements-analyst', kind: 'produce', brief: true },
  { id: 'S2', title: '도메인 모델', role: 'S2-domain-modeler', kind: 'produce', brief: true },
  { id: 'S3', title: '물리 스키마', role: 'S3-physical-designer', kind: 'produce', brief: true },
  { id: 'S4', title: '추적성 검증', role: 'S4-traceability-checker', kind: 'review', brief: true },
  { id: 'S5', title: '레드팀', role: 'S5-red-team', kind: 'review', brief: true },
  { id: 'S6', title: '기계 검증', role: 'S6-mechanical-verifier', kind: 'review', brief: true },
  { id: 'S7', title: '문서화', role: 'S7-documenter', kind: 'produce', brief: true },
  { id: 'S8', title: '최종 평가', role: 'S8-auditor', kind: 'final', brief: false },
]
const IDS = STAGES.map(s => s.id)
const idx = id => IDS.indexOf(id)

// ── 결과 형식 (에이전트에게 보여주는 설명 + 최소 검증)
const SHAPES = {
  WORK: {
    doc: '{"summary": string, "outputs": string[], "counts"?: string, "warnings"?: string[]}',
    ok: o => typeof o.summary === 'string' && Array.isArray(o.outputs),
  },
  BRIEF: {
    doc: '{"briefingPath": string, "scenarioCount"?: number, "questionCount"?: number}',
    ok: o => typeof o.briefingPath === 'string',
  },
  DISCUSS: {
    doc: '{"summary": string, "newScenarioIds"?: string[], "newDecisionIds"?: string[]}',
    ok: o => typeof o.summary === 'string',
  },
  VERDICT: {
    doc: `{"pass": boolean, "summary": string, "rejects": [{"target": ${IDS.slice(0, 8).map(s => `"${s}"`).join('|')}, "reqIds"?: string[], "problem": string, "evidence": string}], "escalations"?: string[]}  — pass=true 면 rejects 는 []`,
    ok: o => typeof o.pass === 'boolean' && typeof o.summary === 'string' && Array.isArray(o.rejects) &&
      o.rejects.every(r => IDS.slice(0, 8).includes(r.target) && typeof r.problem === 'string') &&
      (o.pass || o.rejects.length > 0),
  },
  ESCALATION: {
    doc: '{"decision": "proceed"|"stop", "reason": string, "decisionIds"?: string[]}',
    ok: o => ['proceed', 'stop'].includes(o.decision) && typeof o.reason === 'string',
  },
}

// ── 엔진
const engineFor = key => {
  if (ENGINE_OVERRIDE) return ENGINE_OVERRIDE
  const e = cfg.engines || {}
  return e[key] || e.default || 'claude'
}
const TIMEOUT = (cfg.timeoutMinutes || 60) * 60 * 1000

function runEngine(engine, prompt, logFile) {
  const extra = (cfg.engineArgs && cfg.engineArgs[engine]) || []
  let r
  if (engine === 'claude') {
    r = sh('claude', ['-p', ...extra], { cwd: BASE, input: prompt, timeout: TIMEOUT })
  } else if (engine === 'codex') {
    r = sh('codex', ['exec', '-C', BASE, '--skip-git-repo-check', ...extra, '-'], { cwd: BASE, input: prompt, timeout: TIMEOUT })
  } else {
    throw new Error(`알 수 없는 엔진: ${engine}`)
  }
  fs.writeFileSync(logFile, `# engine=${engine} status=${r.status} signal=${r.signal || ''}\n\n## PROMPT\n${prompt}\n\n## STDOUT\n${r.stdout || ''}\n\n## STDERR\n${r.stderr || ''}\n`)
  if (r.error) log(`  ⚠ 엔진 실행 오류: ${r.error.message}`)
  return r
}

// ── 상태
let S = null
function freshState() {
  return { run: RUN, status: 'running', seq: 0, cur: null, iter: {}, pending: {}, pairCount: {}, totalRegress: 0, history: [], startedRunB: false, stopped: null }
}
function save() { fs.writeFileSync(STATE, JSON.stringify(S, null, 2)) }

// ── 에이전트 호출
const slug = s => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)
function mockResult(shape, label) {
  if (shape === 'VERDICT') {
    const m = label.match(/^(S\d)#(\d+) 검토$/)
    if (MOCK_REJECT && m && m[1] === MOCK_REJECT && m[2] === '1') {
      const target = STAGES.slice(0, idx(m[1])).filter(s => s.kind === 'produce').pop().id
      return { pass: false, summary: `mock reject from ${m[1]}`, rejects: [{ target, reqIds: ['REQ-MOCK-1'], problem: 'mock 문제', evidence: 'mock' }] }
    }
    if (label.startsWith('부장 중재') && MOCK_REJECT) {
      const target = STAGES.slice(0, idx(MOCK_REJECT)).filter(s => s.kind === 'produce').pop().id
      return { pass: false, summary: 'mock 리젝 유지', rejects: [{ target, problem: 'mock 문제', evidence: 'mock' }] }
    }
    return { pass: true, summary: 'mock pass', rejects: [] }
  }
  if (shape === 'ESCALATION') return { decision: 'proceed', reason: 'mock' }
  if (shape === 'BRIEF') return { briefingPath: 'log/briefings/mock.md' }
  return { summary: 'mock', outputs: [] }
}

function callAgent(roleKey, label, prompt, shape) {
  S.seq++
  save()
  const name = `${String(S.seq).padStart(3, '0')}-${slug(label)}`
  const outRel = `.run/out/${name}.json`
  const outAbs = path.join(BASE, outRel)
  const engine = engineFor(roleKey)
  const full = `${prompt}

## 결과 반환 (필수)
작업을 마치면 결과를 **유효한 JSON 하나**로 \`${outAbs}\` 에 쓴다 (설명 문장 없이 JSON 만). 형식:
${SHAPES[shape].doc}`

  if (engine === 'mock') {
    const res = mockResult(shape, label)
    fs.writeFileSync(outAbs, JSON.stringify(res, null, 2))
    log(`  · ${label} [mock] → ${shape === 'VERDICT' ? (res.pass ? 'PASS' : 'REJECT') : 'ok'}`)
    return res
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    log(`  · ${label} [${engine}]${attempt > 1 ? ' (재시도)' : ''}`)
    try { fs.rmSync(outAbs, { force: true }) } catch {}
    const p = attempt === 1 ? full : `${full}\n\n(직전 시도에서 결과 파일이 없거나 형식이 틀렸다. 작업 산출물은 이미 있을 수 있으니 확인 후 결과 JSON 을 반드시 쓴다.)`
    runEngine(engine, p, path.join(LOG_DIR, `${name}${attempt > 1 ? '-retry' : ''}.log`))
    try {
      const obj = JSON.parse(fs.readFileSync(outAbs, 'utf8'))
      if (SHAPES[shape].ok(obj)) return obj
      log(`  ⚠ 결과 형식 불일치: ${outRel}`)
    } catch {
      log(`  ⚠ 결과 파일 없음/파싱 실패: ${outRel}`)
    }
  }
  return null
}

// ── git
function commit(subject, body = '') {
  if (cfg.git && cfg.git.commit === false) return
  const git = (...a) => sh('git', ['-C', BASE, ...a])
  git('add', '-A')
  if (git('diff', '--cached', '--quiet').status === 0) return
  const msg = [subject, '', body, cfg.git && cfg.git.trailer ? `\n${cfg.git.trailer}` : ''].join('\n').trim() + '\n'
  const r = sh('git', ['-C', BASE, 'commit', '-q', '-F', '-'], { input: msg })
  if (r.status !== 0) log(`  ⚠ 커밋 실패: ${r.stderr}`)
  else log(`  ⎇ ${subject}`)
}
const verdictBody = v => [
  `판정: ${v.pass ? 'PASS' : 'REJECT'} — ${v.summary}`,
  ...(v.rejects || []).map(r => `- 리젝 → ${r.target} [${(r.reqIds || []).join(', ')}] ${r.problem}`),
  ...(v.escalations || []).map(e => `- 에스컬레이션: ${e}`),
].join('\n')

// ── 프롬프트 조립
const head = file => `너는 아래 조직의 구성원이다. 먼저 ${P}/00-common-rules.md 와 ${file} 를 읽고 그대로 따른다. 프로젝트 전제는 ${cfgPath}, 문서 양식은 ${P}/02-templates.md.`
const bossHead = head(`${P}/01-boss.md`)
const roleHead = st => head(`${P}/roles/${st.role}.md`)
const ctx = (st, k, rejects) =>
  `BASE=${BASE}\nRun=${S.run}\n단계=${st ? st.id : '-'}\n반복차수=${k}\n` +
  (rejects && rejects.length
    ? `이번 반복은 회귀 재작업이다. 아래 리젝 항목만 고친다(델타 원칙):\n${JSON.stringify(rejects, null, 2)}`
    : '이 단계의 이번 반복은 첫 실행이다.')

// ── 단계 실행
function runStage(st) {
  S.iter[st.id] = (S.iter[st.id] || 0) + 1
  const k = S.iter[st.id]
  const rejects = S.pending[st.id] || []
  const c = ctx(st, k, rejects)
  log(`▶ ${st.id} ${st.title} (iter ${k})`)

  if (st.brief) {
    callAgent(st.id, `${st.id}#${k} 브리핑`,
      `${roleHead(st)}\n${c}\n\n[모드: 브리핑] 공통 규칙 §7 대로 ${BASE}/log/briefings/${st.id}-iter${k}.md 만 작성한다. 산출물은 만들지 않는다.`, 'BRIEF')
    callAgent('boss', `부장 토론 ${st.id}#${k}`,
      `${bossHead}\n${c}\n\n[모드: 토론] ${BASE}/log/briefings/${st.id}-iter${k}.md 를 읽고 토론 절차를 수행해 log/discussions.md · scenarios.md · decisions.md 에 기록한다.`, 'DISCUSS')
  }

  let v
  if (st.kind === 'final') {
    callAgent(st.id, `S8#${k} 감사`, `${roleHead(st)}\n${c}\n\n[모드: 수행] 감사를 수행하고 ${BASE}/S8-final/audit.md 를 작성한다.`, 'WORK')
    v = callAgent('boss', `부장 최종 평가#${k}`,
      `${bossHead}\n${c}\n\n[모드: 최종 평가] S8-final/audit.md 와 전체 산출물로 S8-final/boss-evaluation.md 를 작성하고 완료 기준마다 판정한다. 미통과는 원인 단계로 리젝(REG 등록).`, 'VERDICT')
  } else if (st.kind === 'produce') {
    callAgent(st.id, `${st.id}#${k} 수행`,
      `${roleHead(st)}\n${c}\n\n[모드: 수행] 역할 파일의 아웃풋을 작성한다. log/discussions.md 의 ${st.id} 반복 ${k} 토론 지시를 반드시 반영한다.`, 'WORK')
    v = callAgent('boss', `부장 게이트 ${st.id}#${k}`,
      `${bossHead}\n${c}\n\n[모드: 게이트] ${st.id} 산출물을 역할 파일(${P}/roles/${st.role}.md)의 완료 기준과 부장 점검표로 직접 열어 판정한다. 리젝 시 REG 등록.`, 'VERDICT')
  } else {
    const r = callAgent(st.id, `${st.id}#${k} 검토`, `${roleHead(st)}\n${c}\n\n[모드: 수행] 검토를 수행하고 산출물을 쓴 뒤 판정한다.`, 'VERDICT')
    if (r && r.pass && !(r.escalations && r.escalations.length)) v = r
    else if (r) {
      v = callAgent('boss', `부장 중재 ${st.id}#${k}`,
        `${bossHead}\n${c}\n\n[모드: 중재] ${st.id} 검토자 판정:\n${JSON.stringify(r, null, 2)}\n리젝·escalation 항목마다 유지/기각(DEC)/target 정정을 판정한다. 유지 리젝마다 REG 등록.`, 'VERDICT')
    }
  }
  fs.appendFileSync(path.join(BASE, 'log/run-state.md'),
    `- ${st.id} iter ${k}: ${!v ? 'FAILED' : v.pass ? 'PASS' : `REJECT→${v.rejects.map(r => r.target).join(',')}`}\n`)
  S.pending[st.id] = []
  return v
}

// ── 점검
function check() {
  const res = []
  const ok = (name, pass, detail = '') => res.push(`${pass ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`)
  const engines = new Set([cfg.engines?.default || 'claude', ...Object.values(cfg.engines || {})])
  for (const e of engines) ok(`엔진 CLI: ${e}`, sh('which', [e]).status === 0)
  ok('git', sh('git', ['--version']).status === 0)
  ok('docker (S6 용)', sh('docker', ['info']).status === 0, '꺼져 있으면 S6 은 escalation')
  for (const f of cfg.spec?.files || []) ok(`명세서: ${f}`, fs.existsSync(path.join(BASE, f)))
  if (cfg.existingSchema?.mode === 'extend') {
    const { repo, ref, path: p } = cfg.existingSchema
    ok(`기존 스키마: ${ref}:${p}`, sh('git', ['-C', repo, 'cat-file', '-e', `${ref}:${p}`]).status === 0, repo)
  }
  const bin = (cfg.db?.validate || '').split(' ')[0]
  if (bin && bin.startsWith('/')) ok(`validate 실행 파일`, fs.existsSync(bin), bin)
  ok('prompts', fs.existsSync(path.join(P, '01-boss.md')))
  console.log(res.join('\n'))
  if (res.some(l => l.startsWith('✖'))) process.exitCode = 1
}

// ── 메인
if (CHECK) { check(); process.exit() }
if (!['A', 'B'].includes(RUN)) die('--run A 또는 --run B 를 지정한다 (점검은 --check)')

const LOCK = path.join(RUN_DIR, 'lock')
if (fs.existsSync(LOCK)) die(`이미 실행 중이다 (${LOCK}). 이전 실행이 죽었다면 lock 파일을 지운다.`)
fs.writeFileSync(LOCK, String(process.pid))
process.on('exit', () => { try { fs.rmSync(LOCK) } catch {} })
process.on('SIGINT', () => process.exit(130))

const prev = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null
if (prev && !FRESH && prev.run === RUN && prev.status === 'running') {
  S = prev
  log(`이어서 실행: Run ${RUN}, ${S.cur} 부터`)
} else {
  S = freshState()
  if (prev) S.seq = prev.seq // 결과 파일 번호는 계속 증가
}

const START = RUN === 'A' ? 0 : 2
const END = RUN === 'A' ? 1 : 8
const MAX_PAIR = cfg.limits?.maxPair ?? 3
const MAX_TOTAL = cfg.limits?.maxTotal ?? 10
if (S.cur === null) S.cur = IDS[START]
save()

if (RUN === 'B' && !S.startedRunB) {
  callAgent('boss', '부장 결정 반영', `${bossHead}\n${ctx(null, 1)}\n\n[모드: 결정 반영] log/contradictions.md 의 사용자 결정을 DEC 로 등록한다.`, 'DISCUSS')
  commit('[RunB] 부장 결정 반영 — 사용자 결정 → DEC')
  S.startedRunB = true
  save()
}

while (idx(S.cur) <= END) {
  const st = STAGES[idx(S.cur)]
  const v = runStage(st)
  if (!v) {
    S.stopped = { stage: st.id, reason: '에이전트 결과를 받지 못함 (.run/logs 확인)' }
    break
  }
  S.history.push({ stage: st.id, iter: S.iter[st.id], pass: v.pass, summary: v.summary })
  const first = v.pass ? null : v.rejects.map(r => r.target).sort((a, b) => idx(a) - idx(b))[0]
  commit(`[${st.id}#${S.iter[st.id]}] ${st.title} — ${v.pass ? 'PASS' : `REJECT→${first}`}`, verdictBody(v))

  if (v.pass) {
    S.cur = IDS[idx(st.id) + 1] || 'END'
    save()
    if (S.cur === 'END') break
    continue
  }

  const key = `${st.id}->${first}`
  S.pairCount[key] = (S.pairCount[key] || 0) + 1
  S.totalRegress++
  log(`↩ ${st.id} 리젝 → ${first} (구간 ${S.pairCount[key]}회, 전체 ${S.totalRegress}회)`)

  if (S.pairCount[key] > MAX_PAIR || S.totalRegress > MAX_TOTAL) {
    const esc = callAgent('boss', `부장 에스컬레이션 ${key}`,
      `${bossHead}\n${ctx(st, S.iter[st.id])}\n\n[모드: 에스컬레이션] 회귀 한도 초과(${key} ${S.pairCount[key]}회 / 전체 ${S.totalRegress}회).\n마지막 판정:\n${JSON.stringify(v, null, 2)}\n진단 후 proceed 또는 stop 을 결정한다.`, 'ESCALATION')
    commit(`[ESC] ${key} 회귀 한도 초과 — ${esc ? esc.decision : 'fail'}`, esc ? esc.reason : '')
    if (!esc || esc.decision === 'stop') {
      S.stopped = { stage: st.id, reason: esc ? esc.reason : '에스컬레이션 실패' }
      break
    }
    S.cur = IDS[idx(st.id) + 1] || 'END'
    save()
    if (S.cur === 'END') break
    continue
  }

  for (const r of v.rejects) (S.pending[r.target] = S.pending[r.target] || []).push(r)
  S.cur = first
  save()
}

if (!S.stopped && RUN === 'A') {
  callAgent('boss', '부장 모순 보고', `${bossHead}\n${ctx(null, 1)}\n\n[모드: 모순 보고] log/contradictions.md 에 "사용자 보고 — Run A" 섹션을 작성한다.`, 'DISCUSS')
  commit('[RunA] 부장 모순 보고 — 사용자 결정 대기')
}
S.status = S.stopped ? 'stopped' : 'done'
save()
commit(S.stopped ? `[STOP] ${S.stopped.stage} 에서 중단` : `[Run${RUN}] 완료`, S.stopped ? S.stopped.reason : '')

const summary = {
  run: RUN,
  status: S.stopped ? 'STOPPED' : 'DONE',
  stopped: S.stopped,
  regressions: S.totalRegress,
  pairCount: S.pairCount,
  history: S.history.map(h => `${h.stage}#${h.iter} ${h.pass ? 'PASS' : 'REJECT'}`),
  next: RUN === 'A'
    ? `${BASE}/00-spec/INDEX.md 확인 → ${BASE}/log/contradictions.md 의 "사용자 결정" 칸을 채운 뒤 --run B`
    : `${BASE}/S7-docs/, ${BASE}/S8-final/boss-evaluation.md 확인`,
}
console.log(JSON.stringify(summary, null, 2))
