/* ═══════════════════════════════════════════
   Electric Load Analysis (ELA) 계산 엔진
   — IACS/KR 선급 표준 Load Balance 방식
   — continuous + intermittent / Diversity Factor
═══════════════════════════════════════════ */

import type { Project, Load, LoadKindElaType } from './types'

/* ── 운전조건 ────────────────────────── */
export type ElaModeKey = 'seaGoing' | 'leavingArriving' | 'cargoHandling' | 'harbour'

export const ELA_MODE_META: Record<ElaModeKey, { label: string; labelEn: string; icon: string; description: string }> = {
  seaGoing:        { label: '정상 항해', labelEn: 'Sea Going',           icon: '🚢', description: '일상 항해 — 주기관/보조기 정상 운전' },
  leavingArriving: { label: '출입항',    labelEn: 'Leaving & Arriving',  icon: '⚓', description: '입출항 — 계류장치(윈들래스/무어링) 가동' },
  cargoHandling:   { label: '하역',      labelEn: 'Cargo Handling',      icon: '📦', description: '하역 — 펌프/크레인 집중 가동' },
  harbour:         { label: '항내 정박', labelEn: 'At Port / Harbour',   icon: '🏖️', description: '항내 정박 — 기관 정지, 조명/통신 유지' },
}

export const ELA_MODE_ORDER: ElaModeKey[] = ['seaGoing', 'leavingArriving', 'cargoHandling', 'harbour']

/* ── 기본값 ────────────────────────── */
export const DEFAULT_DIVERSITY = 1.8

export const DEFAULT_STARTING_MULTIPLIER: Record<string, number> = {
  'DOL': 6,
  'Y-D': 2.5,
  'A-T': 2.5,
  'SSR': 3,
  'VFD': 1.5,
  'DC':  1,
  'N/A': 1,
}

/* ── 부하 → 모드별 수요율 / 운전 여부 ────────────────────── */
export function modeDemandFactor(load: Load, mode: ElaModeKey): number {
  switch (mode) {
    case 'seaGoing':        return load.dfSea ?? 0
    case 'leavingArriving': return load.dfArrival ?? 0
    case 'cargoHandling':   return load.dfWork ?? 0
    case 'harbour':         return load.dfHarbor ?? 0
  }
}

export function runsInMode(load: Load, mode: ElaModeKey): boolean {
  return modeDemandFactor(load, mode) > 0.001
}

/* ── 사용자 지정 발전기 운전 대수 / 역률 / Diversity ────────────────────── */
export function runningGenCount(project: Project, mode: ElaModeKey): number {
  switch (mode) {
    case 'seaGoing':        return Math.max(0, project.runCountSea ?? 1)
    case 'leavingArriving': return Math.max(0, project.runCountArrival ?? 2)
    case 'cargoHandling':   return Math.max(0, project.runCountCargo ?? 2)
    case 'harbour':         return Math.max(0, project.runCountHarbor ?? 1)
  }
}

export function diversityFactor(project: Project, mode: ElaModeKey): number {
  const val =
    mode === 'seaGoing' ? project.divFactorSea :
    mode === 'leavingArriving' ? project.divFactorArrival :
    mode === 'cargoHandling' ? project.divFactorCargo :
    project.divFactorHarbor
  return val && val > 0 ? val : DEFAULT_DIVERSITY
}

/** 발전기 1대 정격 kW (사용자 정격 우선, 없으면 계산값 사용) */
export function genUnitKw(project: Project, fallbackKw = 0): number {
  if (project.dgKvaRated && project.dgKvaRated > 0) {
    return project.dgKvaRated * (project.dgPf || 0.8)
  }
  return fallbackKw
}

export function genUnitKva(project: Project, fallbackKva = 0): number {
  if (project.dgKvaRated && project.dgKvaRated > 0) return project.dgKvaRated
  return fallbackKva
}

/* ── 부하율 판단 ────────────────────── */
export type LoadRatioLevel = 'safe' | 'normal' | 'caution' | 'warning' | 'danger'

export interface LoadRatioJudgment {
  level: LoadRatioLevel
  label: string
  color: string       // hex
  bg: string          // 카드 배경
  border: string
  message: string
}

export function getLoadRatioJudgment(loadRatio: number): LoadRatioJudgment {
  if (loadRatio >= 90) {
    return {
      level: 'danger', label: '위험', color: '#C62828', bg: '#FFEBEE', border: '#EF5350',
      message: '발전기 부하율이 90% 이상입니다. 추가 발전기 운전 또는 부하 차단 검토가 필요합니다.',
    }
  }
  if (loadRatio >= 85) {
    return {
      level: 'warning', label: '경고', color: '#EF6C00', bg: '#FFF3E0', border: '#FFB74D',
      message: '발전기 부하율이 85% 이상입니다. 단독 운전 여유가 작으므로 주의가 필요합니다.',
    }
  }
  if (loadRatio >= 80) {
    return {
      level: 'caution', label: '주의', color: '#F9A825', bg: '#FFFDE7', border: '#FFD54F',
      message: '부하율이 다소 높습니다. 대형 모터 기동과 동시부하를 확인하세요.',
    }
  }
  if (loadRatio >= 70) {
    return {
      level: 'normal', label: '적정', color: '#1565C0', bg: '#E3F2FD', border: '#64B5F6',
      message: '일반적인 운전 범위입니다.',
    }
  }
  return {
    level: 'safe', label: '안정', color: '#2E7D32', bg: '#E8F5E9', border: '#81C784',
    message: loadRatio < 30 ? '부하율이 낮아 경부하 운전 구간에 유의하세요.' : '발전기 여유가 충분합니다.',
  }
}

/* ── ELA 1모드 계산 ────────────────────── */
export interface ElaLoadEntry {
  load: Load
  df: number
  demandKw: number      // kw × quantity × df (엔진 기준: kW → 운전 부하)
  running: boolean
}

export interface ElaModeResult {
  mode: ElaModeKey
  label: string
  labelEn: string
  icon: string
  description: string

  continuousKw: number
  intermittentKw: number
  standbyKw: number
  emergencyKw: number

  diversityFactor: number
  requiredKw: number
  requiredKva: number        // requiredKw / avgPf

  runningGenCount: number
  genUnitKw: number
  availableKw: number        // unitKw × runningGenCount
  loadRatioPct: number

  judgment: LoadRatioJudgment

  runningLoads: number
  topLoads: Array<{ circuitNo: string; name: string; loadKind: LoadKindElaType; kw: number; quantity: number; df: number; demandKw: number }>
  entries: ElaLoadEntry[]    // 모드별 모든 부하 엔트리 (N-1 / shedding 에서 사용)

  // 모드별 가중 평균 역률/효율 (참고)
  avgPf: number
  avgEff: number
}

export function calculateElaByMode(
  project: Project,
  loads: Load[],
  mode: ElaModeKey,
  fallbackUnitKw: number,
): ElaModeResult {
  const df_m = diversityFactor(project, mode)
  const unitKw = genUnitKw(project, fallbackUnitKw)

  let continuousKw = 0
  let intermittentKw = 0
  let standbyKw = 0
  let emergencyKw = 0
  let pfSum = 0, pfWt = 0
  let effSum = 0, effWt = 0
  let running = 0
  const entries: ElaLoadEntry[] = []

  for (const ld of loads) {
    const df = modeDemandFactor(ld, mode)
    const qty = ld.quantity && ld.quantity > 0 ? ld.quantity : 1
    const kind: LoadKindElaType = ld.loadKind || (ld.isEmergency ? 'emergency' : 'continuous')

    // 실제 엔진에서 본 운전 부하: kW × qty × df (효율 적용 없음 — IACS 방식은 입력 kW 기준)
    const demandKw = ld.kw * qty * df
    const isRun = df > 0.001 && ld.kw > 0

    entries.push({ load: ld, df, demandKw, running: isRun })
    if (isRun) {
      running++
      if (kind === 'continuous') continuousKw += demandKw
      else if (kind === 'intermittent') intermittentKw += demandKw
      else if (kind === 'standby') standbyKw += demandKw
      else if (kind === 'emergency') emergencyKw += demandKw

      const pf = Math.max(ld.pf || 0.85, 0.5)
      const eta = Math.max(ld.efficiency || 0.88, 0.5)
      pfSum  += demandKw * pf;  pfWt  += demandKw
      effSum += demandKw * eta; effWt += demandKw
    }
  }

  // 표준 ELA 식: 연속부하 전량 + 간헐부하 / Diversity
  // standby는 대기(평상시 0), emergency는 비상모드 전용이라 운전모드 합계에는 미포함
  const requiredKw = continuousKw + (intermittentKw / df_m)
  const avgPf  = pfWt  > 0 ? pfSum / pfWt  : (project.dgPf || 0.8)
  const avgEff = effWt > 0 ? effSum / effWt : 0.88
  const requiredKva = avgPf > 0 ? requiredKw / avgPf : 0

  const runCount = runningGenCount(project, mode)
  const availableKw = unitKw * runCount
  const loadRatioPct = availableKw > 0 ? (requiredKw / availableKw) * 100 : 0
  const judgment = getLoadRatioJudgment(loadRatioPct)

  const topLoads = entries
    .filter(e => e.running)
    .sort((a, b) => b.demandKw - a.demandKw)
    .slice(0, 5)
    .map(e => ({
      circuitNo: e.load.circuitNo,
      name: e.load.name,
      loadKind: (e.load.loadKind || 'continuous') as LoadKindElaType,
      kw: e.load.kw,
      quantity: e.load.quantity || 1,
      df: e.df,
      demandKw: e.demandKw,
    }))

  const meta = ELA_MODE_META[mode]
  return {
    mode,
    label: meta.label,
    labelEn: meta.labelEn,
    icon: meta.icon,
    description: meta.description,
    continuousKw:   round2(continuousKw),
    intermittentKw: round2(intermittentKw),
    standbyKw:      round2(standbyKw),
    emergencyKw:    round2(emergencyKw),
    diversityFactor: df_m,
    requiredKw:  round2(requiredKw),
    requiredKva: round2(requiredKva),
    runningGenCount: runCount,
    genUnitKw: round2(unitKw),
    availableKw: round2(availableKw),
    loadRatioPct: round2(loadRatioPct),
    judgment,
    runningLoads: running,
    topLoads,
    entries,
    avgPf: round3(avgPf),
    avgEff: round3(avgEff),
  }
}

/* ── ELA 전체 계산 (4 모드) ────────────────────── */
export interface ElaFullResult {
  modes: ElaModeResult[]
  bindingMode: ElaModeKey
  maxLoadRatioPct: number
}

export function calculateElaAll(project: Project, loads: Load[], fallbackUnitKw: number): ElaFullResult {
  const results = ELA_MODE_ORDER.map(m => calculateElaByMode(project, loads, m, fallbackUnitKw))
  const binding = results.reduce((max, r) => r.loadRatioPct > max.loadRatioPct ? r : max, results[0])
  return {
    modes: results,
    bindingMode: binding.mode,
    maxLoadRatioPct: binding.loadRatioPct,
  }
}

/* ── N-1 검토 ────────────────────── */
export interface NMinusOneResult {
  mode: ElaModeKey
  label: string
  applicable: boolean          // N-1 검토 대상인지 (운전대수 ≥ 2)
  runCount: number
  unitKw: number
  requiredKw: number
  remainingKw: number          // (runCount - 1) × unitKw
  deficitKw: number            // requiredKw - remainingKw (+ 이면 부족)
  loadRatioPct: number         // requiredKw / remainingKw × 100
  verdict: 'not_applicable' | 'pass' | 'fail'
  message: string
}

export function calculateNMinusOne(ela: ElaModeResult): NMinusOneResult {
  if (ela.runningGenCount <= 1) {
    return {
      mode: ela.mode, label: ela.label,
      applicable: false,
      runCount: ela.runningGenCount, unitKw: ela.genUnitKw,
      requiredKw: ela.requiredKw,
      remainingKw: ela.runningGenCount * ela.genUnitKw,
      deficitKw: 0,
      loadRatioPct: 0,
      verdict: 'not_applicable',
      message: '1대 운전이므로 N-1 검토 대상이 아닙니다.',
    }
  }
  const remainingKw = (ela.runningGenCount - 1) * ela.genUnitKw
  const deficitKw = ela.requiredKw - remainingKw
  const loadRatioPct = remainingKw > 0 ? (ela.requiredKw / remainingKw) * 100 : 999
  const pass = deficitKw <= 0
  return {
    mode: ela.mode, label: ela.label,
    applicable: true,
    runCount: ela.runningGenCount, unitKw: ela.genUnitKw,
    requiredKw: ela.requiredKw,
    remainingKw: round2(remainingKw),
    deficitKw: round2(Math.max(0, deficitKw)),
    loadRatioPct: round2(loadRatioPct),
    verdict: pass ? 'pass' : 'fail',
    message: pass
      ? `${ela.label}: ${ela.runningGenCount}대 운전 중 1대 탈락 시 잔여 ${round2(remainingKw)}kW가 필요전력 ${ela.requiredKw}kW를 감당합니다.`
      : `${ela.label}: ${ela.runningGenCount}대 운전 중 1대 탈락 시 잔여 ${round2(remainingKw)}kW로 필요전력 ${ela.requiredKw}kW를 감당할 수 없습니다. 부족 ${round2(deficitKw)}kW — Load Shedding 또는 발전기 추가 기동이 필요합니다.`,
  }
}

/* ── Load Shedding 계획 ────────────────────── */
export interface ShedLoadItem {
  circuitNo: string
  name: string
  priority: number
  shedKw: number
  cumulativeKw: number
  essentialType: 'essential' | 'important' | 'non_essential'
}

export interface LoadSheddingPlan {
  mode: ElaModeKey
  label: string
  deficitKw: number
  shedItems: ShedLoadItem[]
  totalShedKw: number
  resolved: boolean             // 부족분 해소 여부
  message: string
  conflicts: string[]           // Essential 부하가 sheddable로 잘못 지정된 등의 경고
}

export function calculateLoadSheddingPlan(ela: ElaModeResult, deficitKw: number): LoadSheddingPlan {
  const conflicts: string[] = []
  if (deficitKw <= 0) {
    return {
      mode: ela.mode, label: ela.label,
      deficitKw: 0, shedItems: [], totalShedKw: 0, resolved: true,
      message: `${ela.label}: 부족 전력 없음.`,
      conflicts,
    }
  }

  // 차단 가능 부하 (우선순위 1 → 9, 0=미지정은 뒤로)
  const sheddable = ela.entries
    .filter(e => e.running && e.load.isSheddable)
    .map(e => ({
      entry: e,
      sortKey: e.load.shedPriority > 0 ? e.load.shedPriority : 999,
    }))
    .sort((a, b) => a.sortKey - b.sortKey)

  for (const { entry } of sheddable) {
    if (entry.load.priority === 'ESSENTIAL') {
      conflicts.push(`⚠ "${entry.load.name}" 는 Essential 부하인데 Load Shedding 대상으로 지정됨 — 재검토 필요`)
    }
  }

  let cumulative = 0
  const items: ShedLoadItem[] = []
  for (const { entry } of sheddable) {
    const shedKw = entry.demandKw
    cumulative += shedKw
    items.push({
      circuitNo: entry.load.circuitNo,
      name: entry.load.name,
      priority: entry.load.shedPriority > 0 ? entry.load.shedPriority : 9,
      shedKw: round2(shedKw),
      cumulativeKw: round2(cumulative),
      essentialType:
        entry.load.priority === 'ESSENTIAL' ? 'essential' :
        entry.load.priority === 'IMPORTANT' ? 'important' :
        'non_essential',
    })
    if (cumulative >= deficitKw) break
  }

  const resolved = cumulative >= deficitKw

  return {
    mode: ela.mode, label: ela.label,
    deficitKw: round2(deficitKw),
    shedItems: items,
    totalShedKw: round2(cumulative),
    resolved,
    message: resolved
      ? `${ela.label}: 부족 ${round2(deficitKw)}kW를 ${items.length}개 부하 차단으로 해소 (총 ${round2(cumulative)}kW).`
      : `${ela.label}: 부족 ${round2(deficitKw)}kW 대비 차단 가능 부하 ${round2(cumulative)}kW 로 부족분 미해소. 추가 차단 대상 설정 필요.`,
    conflicts,
  }
}

/* ── Motor Starting 검토 ────────────────────── */
export type MotorStartingVerdict = 'safe' | 'caution' | 'warning' | 'danger'

export interface MotorStartingItem {
  circuitNo: string
  name: string
  kw: number
  startType: Load['startType']
  startingMultiplier: number
  pf: number
  efficiency: number
  startingKva: number          // 기동 kVA ≈ kW / (PF × η) × mult
  availableKvaSea: number      // Sea Going 운전기준 가용 kVA (참고)
  startingRatioPct: number     // startingKva / availableKva × 100
  verdict: MotorStartingVerdict
  verdictLabel: string
  message: string
}

export function calculateMotorStartingRisk(
  project: Project,
  loads: Load[],
  refMode: ElaModeKey = 'seaGoing',
  fallbackUnitKva = 0,
): MotorStartingItem[] {
  const unitKva = genUnitKva(project, fallbackUnitKva)
  const runCount = runningGenCount(project, refMode)
  const availableKvaRef = unitKva * runCount

  // 대상: 3상 모터 중 정격 50kW 이상 또는 기동 배수 > 2
  const candidates = loads.filter(l => {
    if (l.phase === 'N/A' || l.startType === 'N/A' || l.startType === 'DC') return false
    const mult = l.startingMultiplier && l.startingMultiplier > 0
      ? l.startingMultiplier
      : DEFAULT_STARTING_MULTIPLIER[l.startType] ?? 1
    return l.kw >= 50 || mult > 2
  })

  return candidates
    .sort((a, b) => b.kw - a.kw)
    .map(l => {
      const mult = l.startingMultiplier && l.startingMultiplier > 0
        ? l.startingMultiplier
        : DEFAULT_STARTING_MULTIPLIER[l.startType] ?? 1
      const pf = Math.max(l.pf || 0.85, 0.5)
      const eta = Math.max(l.efficiency || 0.88, 0.5)
      const startingKva = (l.kw / (pf * eta)) * mult
      const ratioPct = availableKvaRef > 0 ? (startingKva / availableKvaRef) * 100 : 0
      const verdict: MotorStartingVerdict =
        ratioPct >= 50 ? 'danger' :
        ratioPct >= 35 ? 'warning' :
        ratioPct >= 20 ? 'caution' :
        'safe'
      const verdictLabel =
        verdict === 'danger' ? '위험' :
        verdict === 'warning' ? '경고' :
        verdict === 'caution' ? '주의' :
        '안정'

      const msgs: Record<MotorStartingVerdict, string> = {
        safe:    `${l.name}: 기동 비율 ${round2(ratioPct)}% — 영향 미미.`,
        caution: `${l.name}: 기동 비율 ${round2(ratioPct)}% — 동시기동 제한 권장.`,
        warning: `${l.name}: 기동 비율 ${round2(ratioPct)}% — Soft Starter / VFD 적용 검토 필요.`,
        danger:  `${l.name}: 기동 비율 ${round2(ratioPct)}% — 발전기 전압강하 위험 큼. VFD 또는 기동 보조 필수.`,
      }

      return {
        circuitNo: l.circuitNo,
        name: l.name,
        kw: l.kw,
        startType: l.startType,
        startingMultiplier: mult,
        pf: l.pf, efficiency: l.efficiency,
        startingKva: round2(startingKva),
        availableKvaSea: round2(availableKvaRef),
        startingRatioPct: round2(ratioPct),
        verdict,
        verdictLabel,
        message: msgs[verdict],
      }
    })
}

/* ── 경고 메시지 ────────────────────── */
export interface ElaWarning {
  level: 'info' | 'caution' | 'warning' | 'danger'
  message: string
  context?: string
}

export function collectWarnings(
  ela: ElaFullResult,
  n1: NMinusOneResult[],
  sheds: LoadSheddingPlan[],
  motors: MotorStartingItem[],
  loads: Load[],
): ElaWarning[] {
  const ws: ElaWarning[] = []

  for (const m of ela.modes) {
    if (m.loadRatioPct >= 90) {
      ws.push({ level: 'danger', message: `[${m.label}] 부하율 ${m.loadRatioPct.toFixed(1)}% — 발전기 추가 운전 또는 부하 조정이 필요합니다.`, context: m.label })
    } else if (m.loadRatioPct >= 85) {
      ws.push({ level: 'warning', message: `[${m.label}] 부하율 ${m.loadRatioPct.toFixed(1)}% — 단독 운전 여유가 작습니다.`, context: m.label })
    }
  }

  for (const r of n1) {
    if (r.applicable && r.verdict === 'fail') {
      ws.push({ level: 'danger', message: r.message, context: `${r.label} N-1` })
    }
  }

  for (const s of sheds) {
    for (const c of s.conflicts) ws.push({ level: 'warning', message: c, context: `${s.label} Shedding` })
    if (s.deficitKw > 0 && !s.resolved) {
      ws.push({ level: 'danger', message: `[${s.label}] Load Shedding 계획으로도 ${round2(s.deficitKw - s.totalShedKw)}kW 부족합니다. 추가 차단 대상 지정 필요.`, context: `${s.label} Shedding` })
    }
  }

  for (const m of motors) {
    if (m.verdict === 'danger' || m.verdict === 'warning') {
      ws.push({ level: m.verdict === 'danger' ? 'danger' : 'warning', message: m.message, context: `Motor: ${m.name}` })
    }
  }

  // Essential / sheddable 충돌
  for (const l of loads) {
    if (l.priority === 'ESSENTIAL' && l.isSheddable) {
      ws.push({ level: 'warning', message: `"${l.name}"는 Essential 부하인데 Load Shedding 대상으로 지정되어 있습니다.`, context: '부하 설정' })
    }
  }

  return ws
}

/* ── 헬퍼 ────────────────────────── */
function round2(v: number) { return Math.round(v * 100) / 100 }
function round3(v: number) { return Math.round(v * 1000) / 1000 }
