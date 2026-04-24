/* ═══════════════════════════════════════════
   선박 전장기본설계 자동화 v3.0 — 타입 정의
   기준: KR 선급 Pt.4 / IEC 60092 / SOLAS
═══════════════════════════════════════════ */

export type OperatingMode = 'SEA' | 'ARRIVAL' | 'WORK' | 'HARBOR' | 'EMG'
export type LoadPriority = 'ESSENTIAL' | 'IMPORTANT' | 'NON_ESSENTIAL'

/** 부하 운전 유형 — IACS/KR ELA 표준 */
export type LoadKindElaType = 'continuous' | 'intermittent' | 'standby' | 'emergency'

export interface Project {
  id: string; vesselName: string; hullNo: string; projectNo: string
  classCode: string; acVoltage: number; frequency: number

  // ── 전원 구성 (복수 선택, 자유 조합) ──
  hasDg: boolean       // 디젤발전기
  hasEg: boolean       // 비상발전기
  hasEss: boolean      // 배터리/ESS
  hasFc: boolean       // 수소연료전지 (PEMFC/SOFC)
  hasPv: boolean       // 태양광 (PV)
  hasShore: boolean    // 육전 (Shore Power)
  hasDc: boolean       // 전기추진 (DC Propulsion)

  // ── 발전기 설정 ──
  dgCount: number; dgPf: number; designMargin: number
  dgXd: number         // 발전기 과도 리액턴스 X"d (pu, 기본 0.15)

  // ── 발전기 정격 (ELA 검토용, 선택 입력) ──
  dgKvaRated: number          // 1대당 정격 kVA (0=runCalculation 자동산정값 사용)
  egKvaRated: number          // 비상발전기 1대 정격 kVA (0=자동)
  egPf: number                // 비상발전기 역률 (기본 0.8)

  // ── ELA 운전조건별 발전기 운전 대수 (사용자 지정) ──
  runCountSea: number          // 정상 항해 시 발전기 운전 대수
  runCountArrival: number      // 출입항 시
  runCountCargo: number        // 하역 시
  runCountHarbor: number       // 항내 정박 시

  // ── ELA Diversity Factor (운전조건별, 간헐부하에만 적용) ──
  divFactorSea: number         // 기본 1.8
  divFactorArrival: number
  divFactorCargo: number
  divFactorHarbor: number

  // ── ESS 공통 ──
  essBackupH: number; essMargin: number
  essPeakThreshPct: number   // 피크컷 임계값 (발전기 정격 대비 %, 기본 75)
  essPeakDurMin: number      // 피크컷 지속시간 (분, 기본 15)
  essSpinReserve: boolean    // 기동보조(스피닝리저브) 포함 여부

  // ── DC / 전기추진 ──
  dcVoltage: number; motorCount: number; motorKw: number; isoKva: number
  propPf: number       // 추진 입력 역률 (AFE: 0.97, 기본 0.95)

  // ── 운항·충전 ──
  operationHours: number   // 일 운항시간
  chargeHours: number      // 충전 가용시간

  // ── 연료전지 ──
  fcStackKw: number        // FC 스택 kW (0=자동산정)

  // ── 태양광 ──
  pvKwp: number; pvSunHours: number

  createdAt: string; updatedAt: string
}

export interface Bus {
  id: string; projectId: string; tag: string; name: string
  type: 'AC-BUS' | 'DC-BUS' | 'PANEL' | 'EMERGENCY'
  voltage: number; parentTag: string; sortOrder: number
}

export interface Load {
  id: string; projectId: string; circuitNo: string; name: string
  fromBus: string; toTag: string
  kw: number; pf: number; efficiency: number
  priority: LoadPriority
  startType: 'DOL' | 'Y-D' | 'A-T' | 'SSR' | 'VFD' | 'DC' | 'N/A'
  // 운전 모드별 수요율 (4가지 운전조건 + 비상)
  demandFactor: number     // 기본값 (이전 버전 호환, = dfSea)
  dfSea: number            // ① 정상 항해 (Sea Going)
  dfArrival: number | null // ② 출입항 (Leaving & Arriving) — null=미입력
  dfWork: number           // ③ 하역 (Cargo Handling) — 레거시 이름 유지
  dfHarbor: number | null  // ④ 정박 정박 (At Port / Harbour) — null=미입력
  dfEmg: number            // 비상 모드 수요율 (SOLAS)
  phase: '3P' | '1P' | 'N/A'
  isEmergency: boolean; isBattery: boolean
  cableLength: number      // 케이블 포설 길이 (m), 전압강하 계산용
  location: string; notes: string; sortOrder: number

  // ── ELA 확장 필드 (IACS/KR Electric Load Balance) ──
  loadKind: LoadKindElaType       // continuous / intermittent / standby / emergency
  quantity: number                 // 동일 장비 수량 (기본 1)
  startingMultiplier: number       // 기동전류 배수 (DOL=6, Y-D=2.5, SS=3, VFD=1.5, N/A=1)
  isSheddable: boolean             // Load Shedding 가능 여부
  shedPriority: number             // 차단 우선순위 (1=최우선, 0=미지정)
}

export interface LoadCalc extends Load {
  // 연결 / 수요
  kvaConn: number; kwDemand: number; kvaDemand: number
  // 전류
  currentA: number
  // 기동 분석
  startKva: number         // 기동 kVA (DOL: ×7, Y-D: ×2.5, SSR: ×3.5, VFD: ×1.5)
  // MCCB
  mccbFrame: number; mccbSet: number; breakingKa: number
  // 케이블
  cableSize: string; cableAmpacity: number; cableCode: string
  cableMarginPct: number; mccbOk: boolean
  // 전압 강하
  voltageDrop: number      // ΔV (%)
  voltageDropOk: boolean   // ≤ 5% 기준
}

// 운전 모드별 계산 결과
export interface ModeResult {
  mode: OperatingMode; label: string
  totKwDemand: number; totKvaDemand: number; avgPf: number
  totKwAll: number; totKvaAll: number
  emgKwDemand: number; emgKvaDemand: number
  reqKva: number; selKva: number; selKw: number
  genAcbA: number; loadFactorPct: number
}

export interface BusCalcSummary {
  tag: string; name: string; type: Bus['type']; parentTag: string
  voltage: number; loadCount: number; downstreamTags: string[]
  connectedKw: number; demandKw: number; demandKva: number
  emergencyKw: number; batteryKw: number; currentA: number
}

export interface ChainCheck {
  loadId: string; circuitNo: string; name: string
  fromBus: string; path: string[]
  status: 'BUS' | 'OK' | 'ORPHAN' | 'LOOP'
  message: string
}

export interface LoadShedPlanItem {
  id: string; circuitNo: string; name: string
  fromBus: string; priority: LoadPriority
  kwDemand: number; cumulativeKw: number
  selected: boolean
}

export interface CoordinationHint {
  sourceTag: string; largestBranch: string
  largestBranchSetA: number; recommendedBreakerA: number
  marginPct: number; status: 'OK' | 'REVIEW'
}

export interface SourceStatus {
  key: 'DG' | 'EG' | 'ESS' | 'FC' | 'PV' | 'SHORE'
  label: string
  role: string
  availableKw: number
  assignedKw: number
  reserveKw: number
  status: 'OK' | 'WARN' | 'OFF'
  note: string
}

export interface TripRisk {
  code: string
  title: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  mitigation: string
}

export interface ArchitectureRecommendation {
  category: 'STARTING' | 'PEAK' | 'PROTECTION' | 'ARCHITECTURE' | 'POWER_QUALITY'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  detail: string
  equipment: string
}

export interface CalcResult {
  loads: LoadCalc[]
  busSummaries: BusCalcSummary[]
  chainChecks: ChainCheck[]
  loadSheddingPlan: LoadShedPlanItem[]
  coordinationHints: CoordinationHint[]
  sourceStatuses: SourceStatus[]
  tripRisks: TripRisk[]
  architectureRecommendations: ArchitectureRecommendation[]

  // ── 3모드 계산 결과 ──
  modes: ModeResult[]          // [SEA, ARRIVAL, WORK, HARBOR, EMG]
  bindingMode: OperatingMode   // 발전기 결정 모드 (최대 kVA 모드)

  // ── 최종 발전기 선정 (binding mode 기준) ──
  selKva: number; selKw: number; genAcbA: number
  reqKva: number; loadFactorPct: number

  // ── N-1 이중화 검토 ──
  n1LoadFactorPct: number      // N-1 시 부하율
  n1Ok: boolean                // N-1 부하율 ≤ 100%
  n1ShedKw: number             // N-1 시 차단 필요 kW

  // ── 비상발전기 ──
  egReqKva: number; egSelKva: number; egSelKw: number

  // ── ESS ──
  essBackupKwh: number; essPeakKwh: number; essSpinKwh: number; essTotalKwh: number
  battEssKwh: number; chargeKw: number
  batteryLoadKw: number; batteryLoadCount: number
  essPeakThreshKw: number   // 피크컷 임계 kW

  // ── 연료전지 ──
  fcStackKw: number; h2ConsKgH: number; h2TankKg: number; fcEssKwh: number

  // ── 태양광 ──
  pvGenKwhDay: number; pvDeficitKwh: number; solarEssKwh: number

  // ── 육전 ──
  shoreKva: number

  // ── 단락전류 ──
  iscBusKa: number             // MSB 3상 단락전류 (kA)
  requiredBreakingKa: number   // 필요 차단 용량 (kA)

  // ── 전동기 기동 분석 ──
  worstStartKva: number        // 최대 기동 kVA (단일 전동기)
  worstStartMotor: string      // 해당 전동기 명칭
  voltageDipPct: number        // 버스바 전압 강하 (%)
  voltageDipOk: boolean        // ≤ 15% 기준

  // ── 추진 ──
  propKwIn: number; propKvaIn: number

  // ── 공통 합계 (항해 모드 기준) ──
  totKwConn: number; totKvaConn: number
  totKwDemand: number; totKvaDemand: number; avgPf: number
  totKwAll: number; totKvaAll: number; avgPfAll: number
  emgKwDemand: number; emgKvaDemand: number

  warnings: Warning[]
}

export interface Warning {
  type: 'ERROR' | 'WARN'
  code: string
  message: string
}
