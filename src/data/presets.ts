import type { LoadType, StartMethod, BusId } from "@/types";

export interface LoadPreset {
  name: string;
  type: LoadType;
  kw: number;
  pf: number;
  efficiency: number;
  start: StartMethod;
  startMult: number;
  loadFactor: number;
  isEmergency?: boolean;
  defaultBus?: BusId;
}

export const PRESETS: Record<string, LoadPreset[]> = {
  "기관실 보조기계": [
    { name: "Main L.O. Pump",     type: "pump",       kw: 15,  pf: 0.85, efficiency: 0.88, start: "DOL",     startMult: 6, loadFactor: 0.8 },
    { name: "Main C.W. Pump",     type: "pump",       kw: 30,  pf: 0.85, efficiency: 0.88, start: "DOL",     startMult: 6, loadFactor: 0.8 },
    { name: "Main S.W. Pump",     type: "pump",       kw: 22,  pf: 0.85, efficiency: 0.88, start: "DOL",     startMult: 6, loadFactor: 0.8 },
    { name: "F.O. Purifier",      type: "pump",       kw: 15,  pf: 0.80, efficiency: 0.88, start: "DOL",     startMult: 5, loadFactor: 0.8 },
    { name: "L.O. Purifier",      type: "pump",       kw: 11,  pf: 0.80, efficiency: 0.88, start: "DOL",     startMult: 5, loadFactor: 0.8 },
    { name: "Air Compressor",     type: "compressor", kw: 22,  pf: 0.85, efficiency: 0.88, start: "Y-Delta", startMult: 3, loadFactor: 0.7 },
    { name: "E/R Vent. Fan",      type: "fan",        kw: 30,  pf: 0.85, efficiency: 0.88, start: "DOL",     startMult: 6, loadFactor: 0.8 },
    { name: "F.W. Generator",     type: "other",      kw: 18,  pf: 0.80, efficiency: 0.88, start: "DOL",     startMult: 5, loadFactor: 0.8 },
    { name: "Oily Water Sep.",    type: "pump",       kw: 7.5, pf: 0.80, efficiency: 0.88, start: "DOL",     startMult: 5, loadFactor: 0.5 },
    { name: "Sewage Treatment",   type: "other",      kw: 3,   pf: 0.80, efficiency: 0.88, start: "DOL",     startMult: 5, loadFactor: 0.6 },
  ],
  "갑판기계": [
    { name: "Steering Gear",      type: "motor",      kw: 30,  pf: 0.85, efficiency: 0.92, start: "DOL",     startMult: 6, loadFactor: 0.7 },
    { name: "Bow Thruster",       type: "motor",      kw: 200, pf: 0.85, efficiency: 0.92, start: "DOL",     startMult: 6, loadFactor: 0.8 },
    { name: "Stern Thruster",     type: "motor",      kw: 200, pf: 0.85, efficiency: 0.92, start: "DOL",     startMult: 6, loadFactor: 0.8 },
    { name: "Windlass",           type: "motor",      kw: 50,  pf: 0.80, efficiency: 0.90, start: "DOL",     startMult: 6, loadFactor: 0.5 },
    { name: "Mooring Winch",      type: "motor",      kw: 30,  pf: 0.80, efficiency: 0.90, start: "DOL",     startMult: 6, loadFactor: 0.5 },
    { name: "Deck Crane",         type: "motor",      kw: 55,  pf: 0.80, efficiency: 0.90, start: "DOL",     startMult: 6, loadFactor: 0.5 },
  ],
  "선내 서비스": [
    { name: "Lighting Transformer",   type: "transformer", kw: 50,  pf: 0.95, efficiency: 0.97, start: "None", startMult: 1, loadFactor: 0.8 },
    { name: "A/C Plant",              type: "motor",       kw: 80,  pf: 0.85, efficiency: 0.92, start: "DOL",  startMult: 6, loadFactor: 0.8 },
    { name: "Galley Equipment",       type: "heater",      kw: 30,  pf: 1.00, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 0.7 },
    { name: "Provision Refer.",       type: "motor",       kw: 15,  pf: 0.85, efficiency: 0.92, start: "DOL",  startMult: 6, loadFactor: 0.9 },
    { name: "Laundry Machine",        type: "motor",       kw: 5,   pf: 0.85, efficiency: 0.90, start: "DOL",  startMult: 6, loadFactor: 0.5 },
    { name: "Water Maker",            type: "pump",        kw: 18,  pf: 0.85, efficiency: 0.88, start: "DOL",  startMult: 6, loadFactor: 0.8 },
  ],
  "항해/통신": [
    { name: "Navigation Equip.",  type: "navigation",    kw: 5,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0 },
    { name: "Communication",      type: "communication", kw: 3,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0 },
    { name: "Radar",              type: "navigation",    kw: 5,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0 },
    { name: "GMDSS",              type: "communication", kw: 2,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0 },
  ],
  "비상부하 (SOLAS)": [
    { name: "Emergency Lighting",   type: "lighting",      kw: 10, pf: 0.95, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "Emergency Fire Pump",  type: "pump",          kw: 30, pf: 0.85, efficiency: 0.88, start: "DOL",  startMult: 6, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "Steering Gear (E)",    type: "motor",         kw: 15, pf: 0.85, efficiency: 0.92, start: "DOL",  startMult: 6, loadFactor: 0.7, isEmergency: true, defaultBus: "emergency" },
    { name: "Fire Detection",       type: "other",         kw: 2,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "Nav. Equip. (E)",      type: "navigation",    kw: 5,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "Radio (E)",            type: "communication", kw: 3,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "General Alarm",        type: "other",         kw: 1,  pf: 0.80, efficiency: 1.00, start: "None", startMult: 1, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "Watertight Doors",     type: "motor",         kw: 10, pf: 0.85, efficiency: 0.92, start: "DOL",  startMult: 6, loadFactor: 0.5, isEmergency: true, defaultBus: "emergency" },
    { name: "Emergency Bilge Pump", type: "pump",          kw: 15, pf: 0.85, efficiency: 0.88, start: "DOL",  startMult: 6, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
    { name: "Sprinkler Pump (E)",   type: "pump",          kw: 22, pf: 0.85, efficiency: 0.88, start: "DOL",  startMult: 6, loadFactor: 1.0, isEmergency: true, defaultBus: "emergency" },
  ],
};

// 선종별 기본 발전기 구성
export const VESSEL_PRESETS = [
  { id: "general_cargo",  label: "일반화물선",  gens: [{kw: 500}, {kw: 500}],           eg: {kw: 150} },
  { id: "container",      label: "컨테이너선",  gens: [{kw: 1000}, {kw: 1000}, {kw: 1000}], eg: {kw: 300} },
  { id: "tanker",         label: "유조선",      gens: [{kw: 800}, {kw: 800}, {kw: 800}], eg: {kw: 200} },
  { id: "bulk",           label: "벌크선",      gens: [{kw: 600}, {kw: 600}],           eg: {kw: 150} },
  { id: "tugboat",        label: "예인선",      gens: [{kw: 200}, {kw: 200}],           eg: {kw: 50}  },
  { id: "special",        label: "특수선",      gens: [{kw: 300}, {kw: 300}],           eg: {kw: 100} },
  { id: "ferry",          label: "여객선",      gens: [{kw: 1500}, {kw: 1500}, {kw: 1500}], eg: {kw: 400} },
];

// SOLAS 비상부하 체크리스트
export const SOLAS_CHECKLIST = [
  { id: "emerg_lighting",   name: "비상조명",           regulation: "SOLAS II-1/42.3.1", keyword: "Emergency Lighting" },
  { id: "nav_lights",       name: "항해등",             regulation: "SOLAS II-1/42.3.2", keyword: "Navigation" },
  { id: "internal_comm",    name: "내부통신",           regulation: "SOLAS II-1/42.3.3", keyword: "Communication" },
  { id: "fire_detection",   name: "화재탐지경보",       regulation: "SOLAS II-1/42.3.4", keyword: "Fire Detection" },
  { id: "general_alarm",    name: "일반경보",           regulation: "SOLAS II-1/42.3.5", keyword: "General Alarm" },
  { id: "wt_doors",         name: "수밀문",             regulation: "SOLAS II-1/42.3.6", keyword: "Watertight" },
  { id: "fire_pump",        name: "비상소화펌프",       regulation: "SOLAS II-1/42.3.8", keyword: "Fire Pump" },
  { id: "steering",         name: "조타장치",           regulation: "SOLAS II-1/42.3.9", keyword: "Steering" },
  { id: "bilge_pump",       name: "비상빌지펌프",       regulation: "SOLAS II-1/42.3.10", keyword: "Bilge Pump" },
  { id: "radio",            name: "VHF/MF/HF 통신",    regulation: "SOLAS IV/13",        keyword: "Radio" },
  { id: "nav_equip",        name: "항해장비",           regulation: "SOLAS V/19",         keyword: "Nav. Equip" },
];
