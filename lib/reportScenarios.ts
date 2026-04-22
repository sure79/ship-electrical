/* ═══════════════════════════════════════════
   Electric Load Balance 운전조건별 시나리오 계산
   — 4가지 모드: 정상 항해 / 출입항 / 하역 / 정박 정박
═══════════════════════════════════════════ */

import type { Project, Load, CalcResult } from './types'

export type ScenarioKey = 'sea' | 'arrival' | 'cargo' | 'harbor'

export interface ScenarioLoadDetail {
  circuitNo: string
  name: string
  kw: number
  demandKw: number
  running: boolean
}

export interface ScenarioResult {
  key: ScenarioKey
  label: string
  icon: string
  description: string
  requiredKw: number
  requiredKva: number
  avgPf: number
  genRunCount: number
  genCapacityKw: number        // 가동 발전기 총 용량
  loadFactorPct: number
  verdict: 'safe' | 'ok' | 'warn' | 'caution' | 'risk'
  verdictLabel: string
  topLoads: ScenarioLoadDetail[]
  runningLoads: number
  totalLoads: number
}

export interface RiskItem {
  id: number
  title: string
  description: string
  impact: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  severityLabel: string
}

export interface RecommendationItem {
  id: number
  title: string
  description: string
  icon: string
}

export interface LoadBalanceReport {
  vesselName: string
  hullNo: string
  projectNo: string
  classCode: string
  vesselType: string
  genSelKw: number
  genSelKva: number
  genCount: number
  egSelKw: number
  egSelKva: number
  scenarios: ScenarioResult[]
  bindingScenario: ScenarioKey
  maxLoadFactor: number
  risks: RiskItem[]
  recommendations: RecommendationItem[]
  overallVerdict: {
    title: string
    summary: string[]
    tone: 'safe' | 'caution' | 'risk'
  }
  generatedAt: string
}

/* ── 부하 → 시나리오 활성 여부 판정 ────────────────────── */
const PATTERNS = {
  mooring: /windlass|mooring|anchor|capstan|winch|무어링|앵커|윈치/i,
  cargo:   /cargo|crane|ballast|hold|grab|hatch|ramp|화물|크레인|밸러스트|창구/i,
  propulsion: /propulsion|propeller|thruster|bow thruster|추진|스러스터/i,
  aux:     /pump|fan|blower|compressor|hvac|cooler|chiller|펌프|팬|블로워/i,
  hotel:   /light|lamp|galley|laundry|accom|panel|radio|nav|comm|조명|갤리|통신|항해/i,
}

function classifyLoad(load: Load) {
  const name = String(load.name || '').toLowerCase()
  if (PATTERNS.mooring.test(name)) return 'mooring'
  if (PATTERNS.cargo.test(name)) return 'cargo'
  if (PATTERNS.propulsion.test(name)) return 'propulsion'
  if (PATTERNS.hotel.test(name)) return 'hotel'
  if (PATTERNS.aux.test(name)) return 'aux'
  return 'general'
}

/** 시나리오별 부하 활성 / 수요율 산출
 *  return: { df, running }
 *    - df: 적용 수요율 (0이면 해당 시나리오에서 동작 안 함)
 *    - running: 시나리오에서 운전 중인지
 */
function scenarioFactor(load: Load, scenario: ScenarioKey): { df: number; running: boolean } {
  const kind = classifyLoad(load)
  const base = load.dfSea ?? load.demandFactor ?? 0.8
  const work = load.dfWork ?? base * 0.6

  // 비상부하는 일반 모드에선 동작 안 함 (비상 모드 보고서는 별도)
  if (load.isEmergency && scenario !== 'harbor') {
    // 비상부하라도 일부는 상시 대기 (조명·통신 등). 여기선 항상 0으로 두고 비상 모드에서만 고려
    // 단, 항해·하역·출입항에서도 조명류 비상부하는 대기 수요 0.3으로 반영
    if (kind === 'hotel') return { df: 0.3, running: true }
    return { df: 0, running: false }
  }

  switch (scenario) {
    case 'sea':
      // 정상 항해: 추진보조·항해통신 상시, 하역·무어링 OFF
      if (kind === 'mooring' || kind === 'cargo') return { df: 0, running: false }
      return { df: base, running: base > 0.01 }

    case 'arrival':
      // 출입항: 무어링 활성화, 하역은 비활성 (아직 하역 전)
      if (kind === 'cargo') return { df: 0, running: false }
      if (kind === 'mooring') return { df: Math.max(work, 0.9), running: true }
      if (kind === 'propulsion') return { df: Math.min(base * 1.2, 1), running: true }
      return { df: base, running: base > 0.01 }

    case 'cargo':
      // 하역: 하역펌프·크레인 집중 가동, 무어링·추진 OFF
      if (kind === 'mooring' || kind === 'propulsion') return { df: 0, running: false }
      if (kind === 'cargo') return { df: Math.max(work, 0.75), running: true }
      return { df: base * 0.6, running: base > 0.01 }

    case 'harbor':
      // 정박 정박: 추진·하역·무어링 OFF, aux·hotel 저부하 유지
      if (kind === 'mooring' || kind === 'cargo' || kind === 'propulsion') return { df: 0, running: false }
      if (kind === 'hotel') return { df: base, running: true }
      if (kind === 'aux') return { df: base * 0.4, running: base > 0.01 }
      return { df: base * 0.5, running: base > 0.01 }
  }
}

/* ── 평가 등급 ────────────────────── */
function verdict(lfPct: number): { verdict: ScenarioResult['verdict']; label: string } {
  if (lfPct >= 90) return { verdict: 'risk',    label: '위험 (과부하)' }
  if (lfPct >= 85) return { verdict: 'caution', label: '주의 (여유 부족)' }
  if (lfPct >= 70) return { verdict: 'warn',    label: '관리 필요' }
  if (lfPct >= 45) return { verdict: 'ok',      label: '안정적' }
  if (lfPct >= 25) return { verdict: 'safe',    label: '경부하 (연료 효율↓)' }
  return { verdict: 'risk', label: '심각한 경부하' }
}

/* ── 시나리오별 발전기 수 결정 ──────────────────────
   가장 적은 대수로 부하율 ≤ 85% 목표, 필요 시 2대/3대 운전 */
function pickGenCount(requiredKw: number, unitKw: number, maxUnits: number): number {
  if (requiredKw <= 0) return 1
  for (let n = 1; n <= maxUnits; n++) {
    const lf = requiredKw / (unitKw * n)
    if (lf <= 0.85) return n
  }
  return maxUnits
}

/* ── 메인 진입점 ────────────────────── */
const SCENARIO_META: Record<ScenarioKey, { label: string; icon: string; description: string }> = {
  sea:     { label: '정상 항해', icon: '🚢', description: 'Sea Going — 일상 항해 상태' },
  arrival: { label: '출입항',     icon: '⚓', description: 'Leaving & Arriving — 계류장치 가동' },
  cargo:   { label: '하역',       icon: '📦', description: 'Cargo Handling — 화물 적하 작업' },
  harbor:  { label: '정박',       icon: '🏖️', description: 'At Port / Harbour — 입항 정박 상태' },
}

export function generateLoadBalanceReport(
  project: Project,
  loads: Load[],
  calc: CalcResult,
): LoadBalanceReport {
  const unitKw = calc.selKw || 500
  const unitKva = calc.selKva || 625
  const maxUnits = Math.max(1, project.dgCount || 1)

  /* ── 시나리오별 계산 ────────────────────── */
  const scenarioKeys: ScenarioKey[] = ['sea', 'arrival', 'cargo', 'harbor']
  const scenarios: ScenarioResult[] = scenarioKeys.map(key => {
    let totKw = 0
    let totKva = 0
    let pfSum = 0
    let pfWt = 0
    let running = 0
    const details: ScenarioLoadDetail[] = []

    for (const ld of loads) {
      const { df, running: isRun } = scenarioFactor(ld, key)
      const demandKw = ld.kw * df * (ld.efficiency ? 1 / ld.efficiency : 1)
      const demandKva = demandKw / Math.max(ld.pf || 0.85, 0.5)
      if (isRun) running++
      totKw += demandKw
      totKva += demandKva
      if (isRun && ld.pf) {
        pfSum += demandKw * ld.pf
        pfWt  += demandKw
      }
      details.push({
        circuitNo: ld.circuitNo,
        name: ld.name,
        kw: ld.kw,
        demandKw,
        running: isRun,
      })
    }

    const avgPf = pfWt > 0 ? pfSum / pfWt : 0.85
    const genRunCount = pickGenCount(totKw, unitKw, maxUnits)
    const genCapacityKw = unitKw * genRunCount
    const loadFactorPct = genCapacityKw > 0 ? (totKw / genCapacityKw) * 100 : 0
    const v = verdict(loadFactorPct)

    // 상위 부하 5개 (운전 중인 것만, demandKw 내림차순)
    const topLoads = details
      .filter(d => d.running && d.demandKw > 0)
      .sort((a, b) => b.demandKw - a.demandKw)
      .slice(0, 5)

    return {
      key,
      label: SCENARIO_META[key].label,
      icon: SCENARIO_META[key].icon,
      description: SCENARIO_META[key].description,
      requiredKw: Math.round(totKw * 100) / 100,
      requiredKva: Math.round(totKva * 100) / 100,
      avgPf: Math.round(avgPf * 1000) / 1000,
      genRunCount,
      genCapacityKw,
      loadFactorPct: Math.round(loadFactorPct * 100) / 100,
      verdict: v.verdict,
      verdictLabel: v.label,
      topLoads,
      runningLoads: running,
      totalLoads: loads.length,
    }
  })

  /* ── 가장 부하율 높은 시나리오 ────────────────────── */
  const bindingScenario = scenarios.reduce((max, s) => s.loadFactorPct > max.loadFactorPct ? s : max, scenarios[0])

  /* ── 리스크 도출 ────────────────────── */
  const risks: RiskItem[] = []
  let rid = 1

  // R1: 1대 발전기 운전 구간의 여유 부족
  const singleRunHighLoad = scenarios.filter(s => s.genRunCount === 1 && s.loadFactorPct >= 85)
  if (singleRunHighLoad.length > 0) {
    risks.push({
      id: rid++,
      title: '1대 발전기 운전 구간 여유 부족',
      description: `${singleRunHighLoad.map(s => `${s.label} ${s.loadFactorPct.toFixed(1)}%`).join(', ')} — 1대 운전 시 부하율이 높아 여유가 부족함`,
      impact: '단일 발전기 고장 시 블랙아웃 위험 ↑, 대형 부하 기동 시 전압 강하 우려',
      severity: singleRunHighLoad.some(s => s.loadFactorPct >= 90) ? 'HIGH' : 'MEDIUM',
      severityLabel: singleRunHighLoad.some(s => s.loadFactorPct >= 90) ? '상' : '중',
    })
  }

  // R2: Diversity Factor 설정치 리스크
  risks.push({
    id: rid++,
    title: 'Diversity Factor 설정치 타당성',
    description: '설계상 수요율(Diversity Factor) 가정에 따른 부하 산정 리스크. 실제 운전 시 동시부하가 계산치를 초과할 수 있음',
    impact: '실제 운전 부하율이 계산치와 다를 수 있으며, 마진이 부족할 경우 블랙아웃 가능성',
    severity: 'MEDIUM',
    severityLabel: '중',
  })

  // R3: 대형 모터 기동 영향
  const bigMotors = loads.filter(l => l.kw >= 50 && l.phase !== 'N/A' && (l.startType === 'DOL' || l.startType === 'Y-D'))
  if (bigMotors.length > 0) {
    const topMotor = bigMotors.reduce((m, l) => l.kw > m.kw ? l : m, bigMotors[0])
    risks.push({
      id: rid++,
      title: '대형 모터 기동 영향',
      description: `${bigMotors.length}개 대형 모터 (최대 ${topMotor.kw}kW ${topMotor.name}) 기동 시 전압 강하 발생 가능`,
      impact: 'Voltage Dip 발생, 타부하 전압 변동 및 블랙아웃 유발 가능',
      severity: topMotor.kw >= 110 ? 'HIGH' : 'MEDIUM',
      severityLabel: topMotor.kw >= 110 ? '상' : '중',
    })
  }

  // R4: N-1 취약성
  const multiGenScenarios = scenarios.filter(s => s.genRunCount >= 2)
  if (multiGenScenarios.length > 0) {
    risks.push({
      id: rid++,
      title: `N-1 취약성 (${multiGenScenarios.length}개 시나리오)`,
      description: `${multiGenScenarios.map(s => s.label).join(', ')} 조건에서 발전기 2대 이상 운전 필요 — 1대 고장(N-1) 시 나머지로 부하 감당 불가`,
      impact: '발전기 정지 시 블랙아웃, Load Shedding 계획 및 자동 절차 필수',
      severity: 'HIGH',
      severityLabel: '상',
    })
  }

  // R5: 경부하 운전
  const lightLoadScenarios = scenarios.filter(s => s.loadFactorPct < 35 && s.loadFactorPct > 0)
  if (lightLoadScenarios.length > 0) {
    risks.push({
      id: rid++,
      title: '장시간 경부하 운전 위험',
      description: `${lightLoadScenarios.map(s => `${s.label} ${s.loadFactorPct.toFixed(1)}%`).join(', ')} 조건에서 부하율이 낮음`,
      impact: '연료 효율 저하, 엔진 슬로징(wet stacking), 배기온도 저하로 인한 내구성 저하',
      severity: 'LOW',
      severityLabel: '하',
    })
  }

  /* ── 권고사항 ────────────────────── */
  const recommendations: RecommendationItem[] = []
  let cid = 1

  if (singleRunHighLoad.length > 0) {
    recommendations.push({
      id: cid++,
      title: '발전기 용량/대수 재검토',
      description: '단독 운전 구간(항해/정박) 부하율이 85% 이상이면 발전기 용량 상향 또는 대수 증설을 검토하세요. 대형 부하 재배분도 유효합니다.',
      icon: '⚡',
    })
  }

  if (multiGenScenarios.length > 0) {
    recommendations.push({
      id: cid++,
      title: 'Load Shedding 계획 수립',
      description: '2대 이상 운전 시나리오에서 N-1 상황 대비 부하차단 순서를 정의하세요. NON_ESSENTIAL → IMPORTANT → ESSENTIAL 순 자동 차단이 원칙입니다.',
      icon: '📋',
    })
  }

  if (bigMotors.length > 0) {
    recommendations.push({
      id: cid++,
      title: 'Motor Starting Study',
      description: '대형 모터에 Soft Starter 또는 VFD 적용을 검토하세요. Y-D → VFD 전환 시 기동전류가 1/5 이하로 감소합니다.',
      icon: '🔌',
    })
  }

  recommendations.push({
    id: cid++,
    title: '운영 매뉴얼 보완',
    description: '시나리오별 발전기 운전 조합과 Load Shedding 절차를 운영 매뉴얼에 명시하고, 정기 훈련을 통해 선원 숙련도를 유지하세요.',
    icon: '📚',
  })

  /* ── 최종 평가 ────────────────────── */
  const maxLoadFactor = Math.max(...scenarios.map(s => s.loadFactorPct))
  const tone: 'safe' | 'caution' | 'risk' =
    maxLoadFactor >= 90 ? 'risk' :
    maxLoadFactor >= 85 ? 'caution' :
    'safe'
  const summary: string[] = [
    tone === 'risk'
      ? '설계상 운전은 가능하나, 일부 조건에서 발전기 부하율이 과도하여 재설계가 권장됩니다.'
      : tone === 'caution'
      ? '설계상 운전은 가능하나, 일부 조건에서 발전기 여유가 부족하여 주의가 필요합니다.'
      : '설계상 모든 운전 조건에서 발전기 용량이 충분하며 안정적인 전력 공급이 가능합니다.',
    singleRunHighLoad.length > 0
      ? `1대 발전기 운전 구간(${singleRunHighLoad.map(s => s.label).join(', ')})에서 여유가 부족합니다.`
      : '단독 발전기 운전 구간 모두 적정 부하율을 유지합니다.',
    multiGenScenarios.length > 0
      ? `2대 이상 발전기 운전이 필요한 조건(${multiGenScenarios.map(s => s.label).join(', ')})에 대한 Load Shedding 계획이 필요합니다.`
      : '모든 조건에서 1대 발전기로 충분합니다.',
    bigMotors.length > 0
      ? `대형 모터 ${bigMotors.length}개의 기동 영향을 별도 검토하시기 바랍니다.`
      : '대형 모터 기동 영향은 미미합니다.',
  ]

  return {
    vesselName: project.vesselName,
    hullNo: project.hullNo,
    projectNo: project.projectNo,
    classCode: project.classCode,
    vesselType: '선박',
    genSelKw: unitKw,
    genSelKva: unitKva,
    genCount: maxUnits,
    egSelKw: calc.egSelKw || 0,
    egSelKva: calc.egSelKva || 0,
    scenarios,
    bindingScenario: bindingScenario.key,
    maxLoadFactor,
    risks,
    recommendations,
    overallVerdict: {
      title:
        tone === 'risk' ? '🚨 설계 재검토 권장' :
        tone === 'caution' ? '⚠️ 주의 구간 존재' :
        '✅ 설계 적정',
      summary,
      tone,
    },
    generatedAt: new Date().toLocaleString('ko-KR'),
  }
}
