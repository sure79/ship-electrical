/* ═══════════════════════════════════════════
   샘플 프로젝트 정의 — 대시보드에서 "샘플 ELA 불러오기" 버튼용
═══════════════════════════════════════════ */

import type { Project, Load } from './types'

type ProjectInit = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
type LoadInit    = Omit<Load, 'id' | 'projectId'>

export interface SampleProjectBundle {
  label: string
  icon: string
  description: string
  project: ProjectInit
  loads: LoadInit[]
}

/* ── Chemical Tanker 40,000t — Electric Load Balance 레퍼런스 사례 ─────────────
   발전기: 625 kVA × PF 0.8 × 3대 (500 kW/unit), 비상: 156.25 kVA (125 kW)
   예상 요구전력 (Diversity Factor 1.8):
     · Sea Going          435 kW  → 1대 운전 87% 부하율
     · Leaving & Arriving 575 kW  → 2대 운전 57%
     · Cargo Handling     733 kW  → 2대 운전 73%
     · At Port / Harbour  443 kW  → 1대 운전 89%
─────────────────────────────────────────── */
const chemicalTankerProject: ProjectInit = {
  vesselName: 'Chemical Tanker 40,000t',
  hullNo: 'H-4001',
  projectNo: 'CT4001',
  classCode: 'KR',
  acVoltage: 450,
  frequency: 60,
  hasDg: true,
  hasEg: true,
  hasEss: false,
  hasFc: false,
  hasPv: false,
  hasShore: true,
  hasDc: false,
  dgCount: 3,
  dgPf: 0.8,
  designMargin: 0.25,
  dgXd: 0.15,
  essBackupH: 0.5,
  essMargin: 0.2,
  essPeakThreshPct: 75,
  essPeakDurMin: 15,
  essSpinReserve: false,
  dcVoltage: 750,
  motorCount: 0,
  motorKw: 0,
  isoKva: 0,
  propPf: 0.95,
  operationHours: 18,
  chargeHours: 6,
  fcStackKw: 0,
  pvKwp: 0,
  pvSunHours: 4,
  // ELA settings
  dgKvaRated: 625,
  egKvaRated: 156.25,
  egPf: 0.8,
  runCountSea: 1,
  runCountArrival: 2,
  runCountCargo: 2,
  runCountHarbor: 1,
  divFactorSea: 1.8,
  divFactorArrival: 1.8,
  divFactorCargo: 1.8,
  divFactorHarbor: 1.8,
}

/**
 * 부하 리스트 설계 — IACS 방식으로 목표 요구전력에 근접하도록 조정
 * 요구전력 = 연속부하 + 간헐부하 ÷ 1.8
 *
 * 목표:
 *   Sea:     continuous ≈ 330 kW, intermittent ≈ 190 kW (1.8 나누면 105.6)  → 435 kW
 *   Arrival: continuous ≈ 363 kW, intermittent ≈ 382 kW                      → 575 kW
 *   Cargo:   continuous ≈ 145 kW, intermittent ≈ 1058 kW                     → 733 kW
 *   Harbor:  continuous ≈ 181 kW, intermittent ≈ 471 kW                      → 443 kW
 */
type Row = Omit<LoadInit, 'sortOrder'>
const sampleLoads: Row[] = [
  /* ── 주기관 보조기 (연속·항해중 필수) ────────────────────── */
  { circuitNo:'M01', name:'M/E C.S.W Pump',        fromBus:'MSB', toTag:'CSW-1',  kw:75,  pf:0.85, efficiency:0.90, priority:'ESSENTIAL', startType:'DOL', demandFactor:0.9,
    dfSea:0.95, dfArrival:0.95, dfWork:0.30, dfHarbor:0.30, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:30, location:'E/R', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  { circuitNo:'M02', name:'M/E L.O Pump',          fromBus:'MSB', toTag:'LO-1',   kw:55,  pf:0.85, efficiency:0.90, priority:'ESSENTIAL', startType:'Y-D', demandFactor:0.9,
    dfSea:0.95, dfArrival:0.95, dfWork:0.10, dfHarbor:0.10, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:30, location:'E/R', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:2.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'M03', name:'M/E F.O Supply Pump',   fromBus:'MSB', toTag:'FO-1',   kw:22,  pf:0.85, efficiency:0.88, priority:'ESSENTIAL', startType:'DOL', demandFactor:0.9,
    dfSea:0.95, dfArrival:0.95, dfWork:0.10, dfHarbor:0.20, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:25, location:'E/R', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  { circuitNo:'M04', name:'Engine Room Fan',       fromBus:'MSB', toTag:'ERF-1',  kw:37,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'Y-D', demandFactor:0.9,
    dfSea:0.95, dfArrival:0.95, dfWork:0.60, dfHarbor:0.40, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:30, location:'E/R', notes:'',
    loadKind:'continuous', quantity:3, startingMultiplier:2.5, isSheddable:false, shedPriority:0 },

  /* ── Boiler / 냉난방 / HVAC ────────────────────── */
  { circuitNo:'B01', name:'Aux Boiler Feed Pump',  fromBus:'MSB', toTag:'BFP-1',  kw:15,  pf:0.85, efficiency:0.88, priority:'ESSENTIAL', startType:'DOL', demandFactor:0.9,
    dfSea:0.80, dfArrival:0.80, dfWork:0.60, dfHarbor:0.60, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:30, location:'E/R', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  { circuitNo:'H01', name:'HVAC Compressor',       fromBus:'MSB', toTag:'HVAC-1', kw:45,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'Y-D', demandFactor:0.8,
    dfSea:0.80, dfArrival:0.80, dfWork:0.80, dfHarbor:0.80, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:40, location:'E/R', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:2.5, isSheddable:true, shedPriority:2 },

  { circuitNo:'H02', name:'Provision Refrig. Plant', fromBus:'MSB', toTag:'RFG-1', kw:11,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'DOL', demandFactor:0.8,
    dfSea:0.80, dfArrival:0.80, dfWork:0.80, dfHarbor:0.80, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:40, location:'Galley', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  /* ── 항해·통신 (상시) ────────────────────── */
  { circuitNo:'N01', name:'Navigation Panel (NCP)', fromBus:'MSB', toTag:'NCP',   kw:8,   pf:0.95, efficiency:0.95, priority:'ESSENTIAL', startType:'N/A', demandFactor:1.0,
    dfSea:1.0, dfArrival:1.0, dfWork:1.0, dfHarbor:1.0, dfEmg:1.0,
    phase:'1P', isEmergency:true, isBattery:false, cableLength:60, location:'Bridge', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:1, isSheddable:false, shedPriority:0 },

  { circuitNo:'L01', name:'Lighting Panel (LDP)',   fromBus:'MSB', toTag:'LDP',   kw:50,  pf:0.95, efficiency:0.95, priority:'IMPORTANT', startType:'N/A', demandFactor:0.7,
    dfSea:0.70, dfArrival:0.80, dfWork:0.90, dfHarbor:0.80, dfEmg:0.50,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:50, location:'Various', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:1, isSheddable:true, shedPriority:3 },

  { circuitNo:'G01', name:'Galley Equipment',      fromBus:'MSB', toTag:'GAL-1',  kw:35,  pf:0.9, efficiency:0.92, priority:'NON_ESSENTIAL', startType:'N/A', demandFactor:0.6,
    dfSea:0.60, dfArrival:0.70, dfWork:0.80, dfHarbor:0.80, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:45, location:'Galley', notes:'',
    loadKind:'continuous', quantity:1, startingMultiplier:1, isSheddable:true, shedPriority:1 },

  /* ── 간헐 부하 (SEA) ────────────────────── */
  { circuitNo:'P01', name:'Bilge Pump',            fromBus:'MSB', toTag:'BLG-1',  kw:22,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'DOL', demandFactor:0.3,
    dfSea:0.30, dfArrival:0.30, dfWork:0.30, dfHarbor:0.30, dfEmg:0.5,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:35, location:'E/R', notes:'',
    loadKind:'intermittent', quantity:2, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  { circuitNo:'P02', name:'Fresh Water Pump',      fromBus:'MSB', toTag:'FWP-1',  kw:11,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'DOL', demandFactor:0.4,
    dfSea:0.40, dfArrival:0.50, dfWork:0.80, dfHarbor:0.80, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:25, location:'E/R', notes:'',
    loadKind:'intermittent', quantity:2, startingMultiplier:6, isSheddable:true, shedPriority:4 },

  { circuitNo:'P03', name:'Main Air Compressor',   fromBus:'MSB', toTag:'AIR-1',  kw:55,  pf:0.85, efficiency:0.88, priority:'ESSENTIAL', startType:'Y-D', demandFactor:0.5,
    dfSea:0.60, dfArrival:0.90, dfWork:0.50, dfHarbor:0.50, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:30, location:'E/R', notes:'',
    loadKind:'intermittent', quantity:2, startingMultiplier:2.5, isSheddable:false, shedPriority:0 },

  /* ── 계류 장치 (ARRIVAL) ────────────────────── */
  { circuitNo:'D01', name:'Windlass Hydraulic Pump Unit', fromBus:'MSB', toTag:'WND-1', kw:95,  pf:0.85, efficiency:0.90, priority:'IMPORTANT', startType:'Y-D', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.95, dfWork:0.0, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:45, location:'Bow', notes:'출입항 전용',
    loadKind:'intermittent', quantity:1, startingMultiplier:2.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'D02', name:'Mooring Winch Hydraulic Pump', fromBus:'MSB', toTag:'MRG-1', kw:65,  pf:0.85, efficiency:0.90, priority:'IMPORTANT', startType:'Y-D', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.95, dfWork:0.0, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:45, location:'Stern', notes:'출입항 전용',
    loadKind:'intermittent', quantity:2, startingMultiplier:2.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'D03', name:'Bow Thruster Aux.',     fromBus:'MSB', toTag:'BT-1',   kw:45,  pf:0.85, efficiency:0.90, priority:'IMPORTANT', startType:'VFD', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.70, dfWork:0.0, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:50, location:'Bow', notes:'출입항/접안',
    loadKind:'intermittent', quantity:1, startingMultiplier:1.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'P04', name:'Fire & G/S Pump',       fromBus:'MSB', toTag:'FGS-1',  kw:62,  pf:0.85, efficiency:0.88, priority:'ESSENTIAL', startType:'DOL', demandFactor:0.3,
    dfSea:0.30, dfArrival:0.60, dfWork:0.40, dfHarbor:0.30, dfEmg:1.0,
    phase:'3P', isEmergency:true,  isBattery:false, cableLength:35, location:'E/R', notes:'비상 겸용',
    loadKind:'intermittent', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  /* ── 하역 장치 (CARGO) ────────────────────── */
  { circuitNo:'C01', name:'Cargo Handling Crane',  fromBus:'MSB', toTag:'CRN-1',  kw:485, pf:0.85, efficiency:0.92, priority:'IMPORTANT', startType:'VFD', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.0, dfWork:0.85, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:60, location:'Deck', notes:'하역 전용',
    loadKind:'intermittent', quantity:1, startingMultiplier:1.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'C02', name:'Ballast Pump',          fromBus:'MSB', toTag:'BLT-1',  kw:151, pf:0.85, efficiency:0.90, priority:'IMPORTANT', startType:'VFD', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.05, dfWork:0.80, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:40, location:'E/R', notes:'하역 전용',
    loadKind:'intermittent', quantity:2, startingMultiplier:1.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'C03', name:'Grab Control Device',   fromBus:'MSB', toTag:'GRB-1',  kw:108, pf:0.85, efficiency:0.92, priority:'IMPORTANT', startType:'VFD', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.0, dfWork:0.70, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:55, location:'Deck', notes:'하역 전용',
    loadKind:'intermittent', quantity:1, startingMultiplier:1.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'C04', name:'Cargo Hold Washing Pump', fromBus:'MSB', toTag:'CHW-1', kw:37,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'DOL', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.0, dfWork:0.60, dfHarbor:0.0, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:35, location:'E/R', notes:'하역 후 세정',
    loadKind:'intermittent', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  /* ── 하역 지원 (Harbor/일반) ────────────────────── */
  { circuitNo:'H03', name:'ACC Air Compressor',    fromBus:'MSB', toTag:'ACC-1',  kw:30,  pf:0.85, efficiency:0.88, priority:'IMPORTANT', startType:'Y-D', demandFactor:0.6,
    dfSea:0.40, dfArrival:0.60, dfWork:0.80, dfHarbor:0.70, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:30, location:'E/R', notes:'제어용',
    loadKind:'intermittent', quantity:1, startingMultiplier:2.5, isSheddable:false, shedPriority:0 },

  { circuitNo:'P05', name:'F.O Heater',            fromBus:'MSB', toTag:'FOH-1',  kw:45,  pf:0.95, efficiency:0.95, priority:'IMPORTANT', startType:'N/A', demandFactor:0.8,
    dfSea:0.50, dfArrival:0.60, dfWork:0.80, dfHarbor:0.80, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:25, location:'E/R', notes:'',
    loadKind:'intermittent', quantity:1, startingMultiplier:1, isSheddable:true, shedPriority:3 },

  { circuitNo:'L02', name:'Laundry & Misc. (Hotel)', fromBus:'MSB', toTag:'HTL-1', kw:25,  pf:0.9, efficiency:0.92, priority:'NON_ESSENTIAL', startType:'N/A', demandFactor:0.5,
    dfSea:0.40, dfArrival:0.50, dfWork:0.70, dfHarbor:0.80, dfEmg:0,
    phase:'3P', isEmergency:false, isBattery:false, cableLength:45, location:'Accommodation', notes:'',
    loadKind:'intermittent', quantity:1, startingMultiplier:1, isSheddable:true, shedPriority:1 },

  /* ── 비상 부하 ────────────────────── */
  { circuitNo:'E01', name:'Emergency Lighting',    fromBus:'ESB', toTag:'EMG-L',  kw:12,  pf:0.95, efficiency:0.95, priority:'ESSENTIAL', startType:'N/A', demandFactor:1.0,
    dfSea:0.0, dfArrival:0.0, dfWork:0.0, dfHarbor:0.0, dfEmg:1.0,
    phase:'1P', isEmergency:true, isBattery:false, cableLength:50, location:'Ship', notes:'SOLAS',
    loadKind:'emergency', quantity:1, startingMultiplier:1, isSheddable:false, shedPriority:0 },

  { circuitNo:'E02', name:'Emergency Fire Pump',   fromBus:'ESB', toTag:'EFP-1',  kw:55,  pf:0.85, efficiency:0.90, priority:'ESSENTIAL', startType:'DOL', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.0, dfWork:0.0, dfHarbor:0.0, dfEmg:1.0,
    phase:'3P', isEmergency:true, isBattery:false, cableLength:40, location:'E/R', notes:'SOLAS',
    loadKind:'emergency', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },

  { circuitNo:'E03', name:'Emergency Steering',    fromBus:'ESB', toTag:'EST-1',  kw:30,  pf:0.85, efficiency:0.88, priority:'ESSENTIAL', startType:'DOL', demandFactor:0.0,
    dfSea:0.0, dfArrival:0.0, dfWork:0.0, dfHarbor:0.0, dfEmg:1.0,
    phase:'3P', isEmergency:true, isBattery:false, cableLength:45, location:'Steering Gear', notes:'SOLAS',
    loadKind:'emergency', quantity:1, startingMultiplier:6, isSheddable:false, shedPriority:0 },
]

export const SAMPLE_PROJECTS: SampleProjectBundle[] = [
  {
    label: '케미컬탱커 4만톤급 (ELA 레퍼런스)',
    icon: '⚓',
    description: '625 kVA × 3 / 비상 156.25 kVA · 4가지 운전조건별 ELA 검증 샘플',
    project: chemicalTankerProject,
    loads: sampleLoads.map((r, i) => ({ ...r, sortOrder: i + 1 })),
  },
]

export function getChemicalTankerSample(): SampleProjectBundle {
  return SAMPLE_PROJECTS[0]
}
