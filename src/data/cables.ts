// 선박용 케이블 데이터베이스
// 출처: IEC 60092-352 Table, 3심 TPYC 케이블 기준
// resistance: Ω/km at 75°C, current: 허용전류(A)

export interface CableSpec {
  size: number;      // mm²
  resistance: number; // Ω/km at 75°C
  reactance: number;  // Ω/km
  current30: number;  // 허용전류 at 30°C
  current45: number;  // 허용전류 at 45°C (선박 기관실 기준)
  label: string;      // 표시용
}

export const CABLE_DATA: CableSpec[] = [
  { size: 1.5,  resistance: 15.3,  reactance: 0.115, current30: 18,  current45: 14,  label: "1.5 mm²" },
  { size: 2.5,  resistance: 9.08,  reactance: 0.110, current30: 25,  current45: 20,  label: "2.5 mm²" },
  { size: 4,    resistance: 5.68,  reactance: 0.107, current30: 34,  current45: 27,  label: "4 mm²" },
  { size: 6,    resistance: 3.78,  reactance: 0.103, current30: 43,  current45: 34,  label: "6 mm²" },
  { size: 10,   resistance: 2.27,  reactance: 0.099, current30: 60,  current45: 48,  label: "10 mm²" },
  { size: 16,   resistance: 1.42,  reactance: 0.095, current30: 80,  current45: 64,  label: "16 mm²" },
  { size: 25,   resistance: 0.907, reactance: 0.091, current30: 106, current45: 85,  label: "25 mm²" },
  { size: 35,   resistance: 0.654, reactance: 0.088, current30: 131, current45: 105, label: "35 mm²" },
  { size: 50,   resistance: 0.483, reactance: 0.086, current30: 159, current45: 127, label: "50 mm²" },
  { size: 70,   resistance: 0.342, reactance: 0.083, current30: 200, current45: 161, label: "70 mm²" },
  { size: 95,   resistance: 0.246, reactance: 0.080, current30: 241, current45: 194, label: "95 mm²" },
  { size: 120,  resistance: 0.196, reactance: 0.078, current30: 278, current45: 224, label: "120 mm²" },
  { size: 150,  resistance: 0.159, reactance: 0.076, current30: 318, current45: 256, label: "150 mm²" },
  { size: 185,  resistance: 0.127, reactance: 0.074, current30: 362, current45: 291, label: "185 mm²" },
  { size: 240,  resistance: 0.098, reactance: 0.072, current30: 424, current45: 341, label: "240 mm²" },
  { size: 300,  resistance: 0.078, reactance: 0.071, current30: 486, current45: 391, label: "300 mm²" },
];
