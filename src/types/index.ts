// ================================================================
// 기본 타입
// ================================================================
export type VoltageLevel = 220 | 380 | 440 | 450 | 480 | 690 | 6600;
export type Frequency = 50 | 60;
export type ClassRule = "KR" | "ABS" | "DNV" | "LR" | "BV" | "NK";
export type StartMethod = "DOL" | "Y-Delta" | "SoftStarter" | "VFD" | "None";
export type BusId = "port" | "stbd" | "emergency";

export type LoadType =
  | "motor"
  | "pump"
  | "compressor"
  | "fan"
  | "transformer"
  | "heater"
  | "lighting"
  | "navigation"
  | "communication"
  | "other";

export type OperatingCondition =
  | "sea_going"
  | "maneuvering"
  | "port_loading"
  | "port_idle"
  | "emergency";

export const CONDITION_LABELS: Record<OperatingCondition, string> = {
  sea_going: "항해",
  maneuvering: "입출항",
  port_loading: "정박(하역)",
  port_idle: "정박(무하역)",
  emergency: "비상",
};

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  motor: "모터",
  pump: "펌프",
  compressor: "압축기",
  fan: "팬",
  transformer: "변압기",
  heater: "히터",
  lighting: "조명",
  navigation: "항해장비",
  communication: "통신장비",
  other: "기타",
};

export const LOAD_TYPE_DEFAULTS: Record<
  LoadType,
  { pf: number; start: StartMethod; startMult: number; efficiency: number }
> = {
  motor: { pf: 0.85, start: "DOL", startMult: 6, efficiency: 0.92 },
  pump: { pf: 0.85, start: "DOL", startMult: 6, efficiency: 0.88 },
  compressor: { pf: 0.85, start: "Y-Delta", startMult: 3, efficiency: 0.88 },
  fan: { pf: 0.85, start: "DOL", startMult: 6, efficiency: 0.88 },
  transformer: { pf: 0.95, start: "None", startMult: 1, efficiency: 0.97 },
  heater: { pf: 1.0, start: "None", startMult: 1, efficiency: 1.0 },
  lighting: { pf: 0.95, start: "None", startMult: 1, efficiency: 1.0 },
  navigation: { pf: 0.8, start: "None", startMult: 1, efficiency: 1.0 },
  communication: { pf: 0.8, start: "None", startMult: 1, efficiency: 1.0 },
  other: { pf: 0.85, start: "DOL", startMult: 6, efficiency: 0.9 },
};

// ================================================================
// 발전기
// ================================================================
export interface Generator {
  id: string;
  name: string;
  type: "main" | "emergency";
  ratedPowerKW: number;
  ratedVoltage: VoltageLevel;
  powerFactor: number;
  subtransientReactance: number; // X"d pu, 보통 0.10~0.20
}

// ================================================================
// 부하
// ================================================================
export interface Load {
  id: string;
  name: string;
  type: LoadType;
  ratedPowerKW: number;
  powerFactor: number;
  efficiency: number;
  busId: BusId;
  startMethod: StartMethod;
  startCurrentMultiplier: number;
  loadFactor: number; // 운전 중 부하율 (0~1), 기본 0.8
  activeConditions: OperatingCondition[]; // 이 조건들에서 켜짐
  isEmergency: boolean; // SOLAS 비상부하
  isEssential: boolean; // 필수부하
  cableLength: number; // m
  cableSize?: string; // 자동 선정 결과
}

// ================================================================
// 프로젝트 설정
// ================================================================
export interface ProjectSettings {
  vesselName: string;
  vesselType: string;
  voltage: VoltageLevel;
  frequency: Frequency;
  phase: 1 | 3;
  classRule: ClassRule;
}

// ================================================================
// 프로젝트 전체
// ================================================================
export interface Project {
  id: string;
  name: string;
  settings: ProjectSettings;
  generators: Generator[];
  loads: Load[];
  activeGeneratorsByCondition: Record<string, string[]>; // condition → generator IDs
  conditions: OperatingCondition[];
  createdAt: string;
  updatedAt: string;
}

// ================================================================
// 계산 결과
// ================================================================
export interface LoadBalanceRow {
  loadId: string;
  loadName: string;
  busId: BusId;
  ratedKW: number;
  values: Record<OperatingCondition, number>; // 조건별 실제 kW
}

export interface LoadBalanceSummary {
  condition: OperatingCondition;
  totalLoadKW: number;
  totalGenKW: number;
  loadPercentage: number;
  marginKW: number;
  isAcceptable: boolean; // <= 90%
  isWarning: boolean; // 80~90%
  isCritical: boolean; // > 90%
}

export interface ShortCircuitResult {
  busId: BusId;
  busName: string;
  symmetricalKA: number;
  peakKA: number;
  requiredBreakingKA: number;
}

export interface VoltageDropResult {
  loadId: string;
  loadName: string;
  ratedCurrentA: number;
  recommendedSizeMm2: number;
  cableType: string;
  runningDropPercent: number;
  startingDropPercent: number;
  isAcceptable: boolean;
}

// 경고 메시지
export interface Warning {
  id: string;
  type: "info" | "warning" | "error";
  message: string;
  detail?: string;
}
