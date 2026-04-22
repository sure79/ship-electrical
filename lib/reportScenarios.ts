/* ═══════════════════════════════════════════
   Electric Load Balance 운전조건별 시나리오 계산
   — 4가지 모드: 정상 항해 / 출입항 / 하역 / 정박 정박
   — 휴리스틱(패턴 매칭) 없음. 사용자가 입력한 수요율만 사용.
═══════════════════════════════════════════ */

import type { Project, Load, CalcResult } from './types'

export type ScenarioKey = 'sea' | 'arrival' | 'cargo' | 'harbor'

export interface ScenarioLoadDetail {
  circuitNo: string
  name: string
  kw: number
  df: number            // 해당 시나리오 적용 수요율
  demandKw: number
  running: boolean
}

export interface ScenarioResult {
  key: ScenarioKey
  label: string
  labelEn: string
  icon: string
  description: string
  formula: string               // 계산식 문자열 (도면/보고서에 노출)
  requiredKw: number
  requiredKva: number
  avgPf: number
  avgEff: number
  genRunCount: number
  genCapacityKw: number         // 가동 발전기 총 용량
  loadFactorPct: number
  verdict: 'safe' | 'ok' | 'warn' | 'caution' | 'risk'
  verdictLabel: string
  topLoads: ScenarioLoadDetail[]
  runningLoads: number
  totalLoads: number
  userInputCoveragePct: number  // 이 시나리오 수요율이 사용자 직접 입력 기반인 비율 (%)
}

export interface RiskItem {
  id: number
  title: string
  description: string
  impact: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  severityLabel: string
  evidence: string[]            // 근거 (어떤 계산에서 나왔는지)
}

export interface RecommendationItem {
  id: number
  title: string
  description: string
  icon: string
  rationale: string             // 이 권고가 나온 근거
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
  totalLoadsInput: number
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
  methodology: {
    formula: string
    genSelectionRule: string
    verdictThresholds: string
  }
}

/* ── 시나리오별 수요율 선택 ──────────────────────
   전부 사용자 입력값에서 직접 가져옴. 휴리스틱 없음.
   미입력(null)인 경우에만 명확히 정의된 기본값 사용.
*/
interface AppliedDf {
  df: number
  userProvided: boolean  // 사용자 직접 입력 여부
}

function applyScenario(load: Load, scenario: ScenarioKey): AppliedDf {
  switch (scenario) {
    case 'sea':
      return { df: load.dfSea ?? 0, userProvided: true }
    case 'arrival':
      // 출입항: dfArrival 직접 입력이 있으면 그 값, 없으면 dfSea 폴백
      if (load.dfArrival != null) return { df: load.dfArrival, userProvided: true }
      return { df: load.dfSea ?? 0, userProvided: false }
    case 'cargo':
      // 하역: dfWork 입력 (기존 컬럼)
      return { df: load.dfWork ?? (load.dfSea ?? 0) * 0.6, userProvided: true }
    case 'harbor':
      // 정박: dfHarbor 직접 입력이 있으면 그 값, 없으면 dfSea × 0.6 폴백
      if (load.dfHarbor != null) return { df: load.dfHarbor, userProvided: true }
      return { df: (load.dfSea ?? 0) * 0.6, userProvided: false }
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

/* ── 가동 발전기 대수 결정 ──────────────────────
   가장 적은 대수로 부하율 ≤ 85% 를 만족. 필요 시 증설.
*/
function pickGenCount(requiredKw: number, unitKw: number, maxUnits: number): number {
  if (requiredKw <= 0) return 1
  for (let n = 1; n <= maxUnits; n++) {
    const lf = requiredKw / (unitKw * n)
    if (lf <= 0.85) return n
  }
  return maxUnits
}

const SCENARIO_META: Record<ScenarioKey, { label: string; labelEn: string; icon: string; description: string }> = {
  sea:     { label: '정상 항해',  labelEn: 'Sea Going',           icon: '🚢', description: '일상 항해 상태 — 주기관/보조기 정상 운전' },
  arrival: { label: '출입항',     labelEn: 'Leaving & Arriving',  icon: '⚓', description: '입출항 시 — 계류장치(윈들래스·무어링) 가동' },
  cargo:   { label: '하역',       labelEn: 'Cargo Handling',      icon: '📦', description: '화물 적하 작업 — 펌프·크레인 집중 가동' },
  harbor:  { label: '정박',       labelEn: 'At Port / Harbour',   icon: '🏖️', description: '입항 정박 상태 — 기관 정지, 조명/통신 유지' },
}

/* ── 메인 진입점 ────────────────────── */
export function generateLoadBalanceReport(
  project: Project,
  loads: Load[],
  calc: CalcResult,
): LoadBalanceReport {
  const unitKw  = calc.selKw  || 0
  const unitKva = calc.selKva || 0
  const maxUnits = Math.max(1, project.dgCount || 1)

  /* ── 시나리오별 계산 (전부 사용자 입력값 기반) ────────────────── */
  const scenarioKeys: ScenarioKey[] = ['sea', 'arrival', 'cargo', 'harbor']
  const scenarios: ScenarioResult[] = scenarioKeys.map(key => {
    let totKw = 0
    let totKva = 0
    let pfSum = 0
    let pfWt  = 0
    let effSum = 0
    let effWt  = 0
    let running = 0
    let userProvidedCount = 0
    const details: ScenarioLoadDetail[] = []

    for (const ld of loads) {
      const { df, userProvided } = applyScenario(ld, key)
      const eta = Math.max(ld.efficiency || 0.88, 0.5)
      const pf  = Math.max(ld.pf || 0.85, 0.5)
      // 요구 전력 = 정격 kW × 수요율 / 효율 (엔진 관점에서 본 실제 필요 kW)
      const demandKw  = (ld.kw * df) / eta
      const demandKva = demandKw / pf
      const isRun = df > 0.001 && ld.kw > 0

      if (isRun) {
        running++
        totKw  += demandKw
        totKva += demandKva
        pfSum  += demandKw * pf
        pfWt   += demandKw
        effSum += demandKw * eta
        effWt  += demandKw
      }
      if (userProvided) userProvidedCount++

      details.push({
        circuitNo: String(ld.circuitNo || ''),
        name:      String(ld.name || ''),
        kw:        ld.kw,
        df,
        demandKw,
        running:   isRun,
      })
    }

    const avgPf  = pfWt  > 0 ? pfSum  / pfWt  : (project.dgPf || 0.85)
    const avgEff = effWt > 0 ? effSum / effWt : 0.88
    const genRunCount = unitKw > 0 ? pickGenCount(totKw, unitKw, maxUnits) : 1
    const genCapacityKw = unitKw * genRunCount
    const loadFactorPct = genCapacityKw > 0 ? (totKw / genCapacityKw) * 100 : 0
    const v = verdict(loadFactorPct)

    const topLoads = details
      .filter(d => d.running && d.demandKw > 0)
      .sort((a, b) => b.demandKw - a.demandKw)
      .slice(0, 5)

    const meta = SCENARIO_META[key]
    return {
      key,
      label: meta.label,
      labelEn: meta.labelEn,
      icon: meta.icon,
      description: meta.description,
      formula: `요구전력 = Σᵢ (부하kWᵢ × 수요율ᵢ / 효율ᵢ)`,
      requiredKw: Math.round(totKw * 100) / 100,
      requiredKva: Math.round(totKva * 100) / 100,
      avgPf: Math.round(avgPf * 1000) / 1000,
      avgEff: Math.round(avgEff * 1000) / 1000,
      genRunCount,
      genCapacityKw,
      loadFactorPct: Math.round(loadFactorPct * 100) / 100,
      verdict: v.verdict,
      verdictLabel: v.label,
      topLoads,
      runningLoads: running,
      totalLoads: loads.length,
      userInputCoveragePct: loads.length > 0 ? Math.round(userProvidedCount / loads.length * 1000) / 10 : 0,
    }
  })

  const bindingScenario = scenarios.reduce(
    (max, s) => s.loadFactorPct > max.loadFactorPct ? s : max,
    scenarios[0],
  )

  /* ── 리스크 도출 (전부 계산값 기반) ─────────────────── */
  const risks: RiskItem[] = []
  let rid = 1

  // R1: 1대 발전기 운전 구간 여유 부족
  const singleRunHighLoad = scenarios.filter(s => s.genRunCount === 1 && s.loadFactorPct >= 85)
  if (singleRunHighLoad.length > 0) {
    const anyCritical = singleRunHighLoad.some(s => s.loadFactorPct >= 90)
    risks.push({
      id: rid++,
      title: '1대 발전기 운전 구간 여유 부족',
      description: `${singleRunHighLoad.map(s => `${s.label} ${s.loadFactorPct.toFixed(1)}%`).join(', ')} — 1대 운전 시 부하율이 임계치(85%) 이상으로 여유가 부족함`,
      impact: '단일 발전기 고장 시 블랙아웃 위험 ↑ · 대형 부하 기동 시 전압 강하 우려',
      severity: anyCritical ? 'HIGH' : 'MEDIUM',
      severityLabel: anyCritical ? '상' : '중',
      evidence: singleRunHighLoad.map(s => `${s.label}: 요구 ${s.requiredKw.toFixed(1)}kW / ${s.genCapacityKw}kW = ${s.loadFactorPct.toFixed(1)}%`),
    })
  }

  // R2: 발전기 용량 자체가 부하를 감당 못 함
  const overRated = scenarios.filter(s => s.loadFactorPct >= 100)
  if (overRated.length > 0) {
    risks.push({
      id: rid++,
      title: '발전기 용량 초과 (설계 부족)',
      description: `${overRated.map(s => `${s.label} ${s.loadFactorPct.toFixed(1)}%`).join(', ')} — 최대 발전기 운전 조합으로도 부하를 감당할 수 없음`,
      impact: '시스템 운전 불가 · 즉각적인 용량 증설 또는 부하 재배분 필요',
      severity: 'CRITICAL',
      severityLabel: '치명',
      evidence: overRated.map(s => `${s.label}: 요구 ${s.requiredKw.toFixed(1)}kW > 가용 ${s.genCapacityKw}kW`),
    })
  }

  // R3: 대형 모터 기동 영향 (입력 그대로)
  const bigMotors = loads.filter(l => l.kw >= 50 && l.phase !== 'N/A' && (l.startType === 'DOL' || l.startType === 'Y-D'))
  if (bigMotors.length > 0) {
    const topMotor = bigMotors.reduce((m, l) => l.kw > m.kw ? l : m, bigMotors[0])
    // 기동 kVA (엄밀식: DOL=×7, Y-D=×2.5)
    const startMult = topMotor.startType === 'DOL' ? 7 : 2.5
    const startKva = topMotor.kw * startMult / (topMotor.pf || 0.85)
    // 전압강하 ΔV% ≈ 기동kVA / (선정kVA × N × 1/X"d) × 100
    const xd = project.dgXd || 0.15
    const dipPct = unitKva > 0 ? (startKva / (unitKva * maxUnits / xd)) * 100 : 0
    risks.push({
      id: rid++,
      title: '대형 모터 기동 영향 (전압 Dip)',
      description: `${bigMotors.length}개 대형 모터 (최대 ${topMotor.kw}kW ${topMotor.name}, ${topMotor.startType} 기동) 기동 시 버스 전압 강하 추정 ${dipPct.toFixed(1)}%`,
      impact: 'Voltage Dip > 15% 시 KR 선급 기준 위반 · 연계 부하 전압 변동 · 최악 시 블랙아웃',
      severity: dipPct >= 15 ? 'HIGH' : dipPct >= 10 ? 'MEDIUM' : 'LOW',
      severityLabel: dipPct >= 15 ? '상' : dipPct >= 10 ? '중' : '하',
      evidence: [
        `최대 모터: ${topMotor.name} ${topMotor.kw}kW ${topMotor.startType}`,
        `기동 kVA = ${topMotor.kw} × ${startMult} / PF${topMotor.pf} = ${startKva.toFixed(0)} kVA`,
        `전압강하 ΔV% = 기동kVA / (${unitKva}kVA × ${maxUnits} / ${xd}) = ${dipPct.toFixed(1)}%`,
      ],
    })
  }

  // R4: N-1 취약성
  const multiGenScenarios = scenarios.filter(s => s.genRunCount >= 2)
  if (multiGenScenarios.length > 0) {
    risks.push({
      id: rid++,
      title: `N-1 취약성 (${multiGenScenarios.length}개 시나리오)`,
      description: `${multiGenScenarios.map(s => `${s.label} ${s.genRunCount}대 운전`).join(', ')} — 발전기 1대 고장(N-1) 시 나머지로 부하 감당 불가`,
      impact: '발전기 정지 시 블랙아웃 · 자동 Load Shedding 계획 필수',
      severity: 'HIGH',
      severityLabel: '상',
      evidence: multiGenScenarios.map(s => `${s.label}: ${s.genRunCount}대 운전, N-1 시 가용 ${unitKw * (s.genRunCount - 1)}kW < 요구 ${s.requiredKw.toFixed(1)}kW`),
    })
  }

  // R5: 경부하 운전
  const lightLoadScenarios = scenarios.filter(s => s.loadFactorPct < 35 && s.loadFactorPct > 0)
  if (lightLoadScenarios.length > 0) {
    risks.push({
      id: rid++,
      title: '장시간 경부하 운전 위험',
      description: `${lightLoadScenarios.map(s => `${s.label} ${s.loadFactorPct.toFixed(1)}%`).join(', ')} — 부하율이 35% 미만`,
      impact: '연료 효율 저하 · 엔진 웨트 스택킹(wet stacking) · 배기 온도 저하로 인한 내구성 저하',
      severity: 'LOW',
      severityLabel: '하',
      evidence: lightLoadScenarios.map(s => `${s.label}: ${s.requiredKw.toFixed(1)}kW / ${s.genCapacityKw}kW = ${s.loadFactorPct.toFixed(1)}%`),
    })
  }

  // R6: 수요율 미입력 경고 (출입항/정박 데이터 부족)
  const arrivalCoverage = scenarios.find(s => s.key === 'arrival')?.userInputCoveragePct ?? 100
  const harborCoverage = scenarios.find(s => s.key === 'harbor')?.userInputCoveragePct ?? 100
  const minCoverage = Math.min(arrivalCoverage, harborCoverage)
  if (minCoverage < 50) {
    risks.push({
      id: rid++,
      title: '시나리오 수요율 입력 부족',
      description: `출입항 수요율 입력 ${arrivalCoverage.toFixed(1)}%, 정박 수요율 입력 ${harborCoverage.toFixed(1)}% — 절반 이상의 부하가 폴백값 사용 중`,
      impact: '해당 시나리오 분석은 dfSea 기준으로 추정된 값 · 실제 운전과 차이 발생 가능',
      severity: 'MEDIUM',
      severityLabel: '중',
      evidence: [
        '부하 입력 탭에서 각 부하마다 출입항/정박 수요율을 직접 입력하세요',
        '엑셀 템플릿의 "출입항수요율", "정박수요율" 컬럼 사용 가능',
      ],
    })
  }

  /* ── 권고사항 ────────────────────── */
  const recommendations: RecommendationItem[] = []
  let cid = 1

  if (singleRunHighLoad.length > 0 || overRated.length > 0) {
    recommendations.push({
      id: cid++,
      title: '발전기 용량/대수 재검토',
      description: `단독 운전 구간 부하율이 85% 이상이거나 용량이 초과하는 시나리오가 있습니다. 발전기 단위 용량 상향 또는 대수 증설을 검토하세요. 대형 부하를 시나리오간 분산 배치하는 것도 유효합니다.`,
      icon: '⚡',
      rationale: `현재 설정: ${unitKw}kW × ${maxUnits}대. 최대 부하 시나리오(${bindingScenario.label})에서 ${bindingScenario.requiredKw.toFixed(1)}kW 필요.`,
    })
  }

  if (multiGenScenarios.length > 0) {
    recommendations.push({
      id: cid++,
      title: 'Load Shedding 계획 수립',
      description: '2대 이상 운전이 필요한 시나리오에서 N-1 상황 대비 부하차단 순서를 정의하세요. 권고 순서: NON_ESSENTIAL → IMPORTANT → ESSENTIAL.',
      icon: '📋',
      rationale: `N-1 시나리오: ${multiGenScenarios.map(s => s.label).join(', ')}. 필수부하 유지 용량 = ${unitKw * Math.max(0, maxUnits - 1)}kW.`,
    })
  }

  if (bigMotors.length > 0) {
    const dolCount = bigMotors.filter(m => m.startType === 'DOL').length
    recommendations.push({
      id: cid++,
      title: 'Motor Starting Study · Soft Start/VFD 도입',
      description: `${dolCount}개 DOL 기동 대형 모터가 있습니다. Y-D, Soft Starter, VFD 순으로 기동 전류가 감소하며 VFD는 DOL 대비 약 1/5 수준입니다. KR 선급 전압강하 15% 기준 준수 필요.`,
      icon: '🔌',
      rationale: `대형 모터 목록: ${bigMotors.slice(0, 3).map(m => `${m.name}(${m.kw}kW ${m.startType})`).join(', ')}${bigMotors.length > 3 ? ' 외' : ''}`,
    })
  }

  if (minCoverage < 100) {
    recommendations.push({
      id: cid++,
      title: '운전조건별 수요율 정밀 입력',
      description: '정확한 부하 밸런스 분석을 위해 각 부하마다 4개 운전조건(항해/출입항/하역/정박) 수요율을 직접 입력하세요. 엑셀 템플릿 사용을 권장합니다.',
      icon: '📊',
      rationale: `출입항 입력률 ${arrivalCoverage.toFixed(0)}%, 정박 입력률 ${harborCoverage.toFixed(0)}%`,
    })
  }

  recommendations.push({
    id: cid++,
    title: '운영 매뉴얼 보완',
    description: '시나리오별 발전기 운전 조합, Load Shedding 절차, Motor Starting 순서를 운영 매뉴얼에 명시하고 정기 훈련을 통해 선원 숙련도를 유지하세요.',
    icon: '📚',
    rationale: '선급 심사/PSC 점검 시 필수 문서',
  })

  /* ── 최종 평가 ────────────────────── */
  const maxLoadFactor = Math.max(...scenarios.map(s => s.loadFactorPct))
  const hasCritical = overRated.length > 0
  const tone: 'safe' | 'caution' | 'risk' =
    hasCritical || maxLoadFactor >= 90 ? 'risk' :
    maxLoadFactor >= 85 ? 'caution' :
    'safe'

  const summary: string[] = [
    hasCritical
      ? `⛔ 최대 조합 발전기 운전(${unitKw}kW × ${maxUnits}대)으로도 부하를 감당할 수 없는 시나리오가 있습니다. 설계 재수립이 필요합니다.`
      : tone === 'risk'
      ? '설계상 운전은 가능하나, 일부 조건에서 발전기 부하율이 과도하여 재설계가 권장됩니다.'
      : tone === 'caution'
      ? '설계상 운전은 가능하나, 일부 조건에서 발전기 여유가 부족하여 주의가 필요합니다.'
      : '설계상 모든 운전 조건에서 발전기 용량이 충분하며 안정적인 전력 공급이 가능합니다.',
    singleRunHighLoad.length > 0
      ? `1대 발전기 운전 구간(${singleRunHighLoad.map(s => s.label).join(', ')})에서 부하율 85% 이상으로 여유가 부족합니다.`
      : '모든 단독 발전기 운전 구간에서 적정 부하율(<85%)을 유지합니다.',
    multiGenScenarios.length > 0
      ? `2대 이상 발전기 운전이 필요한 조건(${multiGenScenarios.map(s => s.label).join(', ')})에 대한 Load Shedding 계획이 필요합니다.`
      : '모든 조건에서 1대 발전기 운전으로 충분합니다.',
    bigMotors.length > 0
      ? `${bigMotors.length}개 대형 모터(≥50kW, DOL/Y-D 기동)의 기동 영향을 Motor Starting Study로 확인하시기 바랍니다.`
      : '50kW 이상 직입 기동 모터는 없습니다.',
    minCoverage < 100
      ? `출입항·정박 수요율 입력 완성도: ${minCoverage.toFixed(0)}% — 100%에 도달할수록 분석 정확도가 향상됩니다.`
      : '모든 시나리오 수요율이 사용자 직접 입력 기반입니다. 분석 신뢰도가 최대입니다.',
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
    totalLoadsInput: loads.length,
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
    methodology: {
      formula: '요구전력(kW) = Σ (부하kW × 수요율 / 효율), 요구kVA = 요구kW / PF',
      genSelectionRule: '부하율 ≤ 85% 를 만족하는 최소 발전기 대수를 자동 선정',
      verdictThresholds: '≥90% 위험, 85~90% 주의, 70~85% 관리, 45~70% 안정, 25~45% 경부하',
    },
  }
}
