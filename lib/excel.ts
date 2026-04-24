/* ═══════════════════════════════════════════
   Excel 부하 템플릿 + 업로드 파싱 유틸리티
   클라이언트 전용 (xlsx 패키지 사용)
═══════════════════════════════════════════ */

import * as XLSX from 'xlsx'
import type { Load } from './types'

/** 부하 1행에 해당하는 Excel 컬럼 정의
 *  운전조건별 수요율 5개 (항해/출입항/하역/정박/비상) + IACS ELA 필드
 */
export const LOAD_COLUMNS = [
  { key: 'circuitNo',          label: '회로번호',       example: 'P01',              width: 10 },
  { key: 'name',               label: '부하명',         example: 'M/E C.S.W Pump',   width: 28 },
  { key: 'fromBus',            label: '전원출처',       example: 'MSB',              width: 10 },
  { key: 'toTag',              label: '부하태그',       example: 'CSW-1',            width: 14 },
  { key: 'kw',                 label: 'kW',             example: 15,                 width: 8 },
  { key: 'quantity',           label: '수량',           example: 1,                  width: 6 },
  { key: 'pf',                 label: '역률',           example: 0.85,               width: 7 },
  { key: 'efficiency',         label: '효율',           example: 0.9,                width: 7 },
  { key: 'loadKind',           label: 'ELA유형',        example: 'continuous',       width: 13 },
  { key: 'startType',          label: '기동방식',       example: 'DOL',              width: 10 },
  { key: 'startingMultiplier', label: '기동배수',       example: 6,                  width: 9 },
  { key: 'phase',              label: '위상',           example: '3P',               width: 7 },
  { key: 'dfSea',              label: '항해수요율',     example: 1.0,                width: 11 },
  { key: 'dfArrival',          label: '출입항수요율',   example: 0.8,                width: 12 },
  { key: 'dfWork',             label: '하역수요율',     example: 0.5,                width: 11 },
  { key: 'dfHarbor',           label: '정박수요율',     example: 0.3,                width: 11 },
  { key: 'dfEmg',              label: '비상수요율',     example: 0,                  width: 11 },
  { key: 'priority',           label: '우선순위',       example: 'IMPORTANT',        width: 12 },
  { key: 'isEmergency',        label: '비상부하',       example: 'N',                width: 8 },
  { key: 'isBattery',          label: '배터리공급',     example: 'N',                width: 10 },
  { key: 'isSheddable',        label: '차단가능',       example: 'N',                width: 9 },
  { key: 'shedPriority',       label: '차단우선순위',   example: 0,                  width: 12 },
  { key: 'cableLength',        label: '케이블길이(m)',   example: 20,                width: 12 },
  { key: 'location',           label: '위치',           example: 'E/R',              width: 10 },
  { key: 'notes',              label: '비고',           example: '',                 width: 20 },
] as const

type ColKey = typeof LOAD_COLUMNS[number]['key']

/** 샘플 행 (케미컬탱커 사례 기반)
 *  각 부하마다 4가지 운전조건(항해/출입항/하역/정박) + 비상 + IACS ELA 유형 지정
 */
const SAMPLE_ROWS: Array<Partial<Record<ColKey, string | number>>> = [
  // 주기관/보조기 (항해·출입항 상시, 정박 부분 가동)
  { circuitNo: 'P01', name: 'M/E C.S.W Pump',          fromBus: 'MSB', toTag: 'CSW-1', kw: 15,   quantity: 1, pf: 0.85, efficiency: 0.88, loadKind: 'continuous',   startType: 'DOL', startingMultiplier: 6,   phase: '3P', dfSea: 1.0, dfArrival: 1.0, dfWork: 0.6, dfHarbor: 0.3, dfEmg: 0,   priority: 'ESSENTIAL',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 20,  location: 'E/R', notes: '' },
  { circuitNo: 'P02', name: 'M/E L.O Pump',            fromBus: 'MSB', toTag: 'LO-1',  kw: 11,   quantity: 1, pf: 0.85, efficiency: 0.88, loadKind: 'continuous',   startType: 'DOL', startingMultiplier: 6,   phase: '3P', dfSea: 1.0, dfArrival: 1.0, dfWork: 0.6, dfHarbor: 0.2, dfEmg: 0,   priority: 'ESSENTIAL',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 20,  location: 'E/R', notes: '' },
  { circuitNo: 'P03', name: 'M/E L/F C.F.W Pump',      fromBus: 'MSB', toTag: 'CFW-1', kw: 7.5,  quantity: 1, pf: 0.85, efficiency: 0.88, loadKind: 'continuous',   startType: 'DOL', startingMultiplier: 6,   phase: '3P', dfSea: 1.0, dfArrival: 1.0, dfWork: 0.6, dfHarbor: 0.2, dfEmg: 0,   priority: 'ESSENTIAL',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 18,  location: 'E/R', notes: '' },
  { circuitNo: 'P04', name: 'M/E Aux. Blower',         fromBus: 'MSB', toTag: 'BLW-1', kw: 30,   quantity: 1, pf: 0.85, efficiency: 0.88, loadKind: 'intermittent', startType: 'Y-D', startingMultiplier: 2.5, phase: '3P', dfSea: 0.8, dfArrival: 0.9, dfWork: 0.3, dfHarbor: 0.0, dfEmg: 0,   priority: 'IMPORTANT',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 25,  location: 'E/R', notes: '' },
  { circuitNo: 'P05', name: 'Engine Room Fan',         fromBus: 'MSB', toTag: 'ERF-1', kw: 22,   quantity: 3, pf: 0.85, efficiency: 0.88, loadKind: 'continuous',   startType: 'DOL', startingMultiplier: 6,   phase: '3P', dfSea: 1.0, dfArrival: 1.0, dfWork: 0.8, dfHarbor: 0.4, dfEmg: 0,   priority: 'IMPORTANT',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 25,  location: 'E/R', notes: '' },
  // 계류장치 (출입항 전용)
  { circuitNo: 'D01', name: 'Windlass Hydraulic Pump', fromBus: 'MSB', toTag: 'WND-1', kw: 55,   quantity: 1, pf: 0.85, efficiency: 0.9,  loadKind: 'intermittent', startType: 'Y-D', startingMultiplier: 2.5, phase: '3P', dfSea: 0.0, dfArrival: 0.9, dfWork: 0.0, dfHarbor: 0.0, dfEmg: 0,   priority: 'IMPORTANT',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 40,  location: 'Bow',  notes: '출입항 전용' },
  { circuitNo: 'D02', name: 'Mooring Winch Pump',      fromBus: 'MSB', toTag: 'MRG-1', kw: 45,   quantity: 2, pf: 0.85, efficiency: 0.9,  loadKind: 'intermittent', startType: 'Y-D', startingMultiplier: 2.5, phase: '3P', dfSea: 0.0, dfArrival: 0.9, dfWork: 0.0, dfHarbor: 0.0, dfEmg: 0,   priority: 'IMPORTANT',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 38,  location: 'Stern', notes: '출입항 전용' },
  // 하역장치 (하역 전용)
  { circuitNo: 'C01', name: 'Cargo Feeding Crane',     fromBus: 'MSB', toTag: 'CRN-1', kw: 110,  quantity: 1, pf: 0.85, efficiency: 0.9,  loadKind: 'intermittent', startType: 'VFD', startingMultiplier: 1.5, phase: '3P', dfSea: 0.0, dfArrival: 0.0, dfWork: 0.8, dfHarbor: 0.0, dfEmg: 0,   priority: 'IMPORTANT',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 50,  location: 'Deck', notes: '하역 전용' },
  { circuitNo: 'C02', name: 'Ballast Pump',            fromBus: 'MSB', toTag: 'BLT-1', kw: 75,   quantity: 2, pf: 0.85, efficiency: 0.9,  loadKind: 'intermittent', startType: 'VFD', startingMultiplier: 1.5, phase: '3P', dfSea: 0.0, dfArrival: 0.1, dfWork: 0.7, dfHarbor: 0.0, dfEmg: 0,   priority: 'IMPORTANT',      isEmergency: 'N', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 35,  location: 'E/R',  notes: '하역 위주' },
  // 조명/일반 (전 조건 가동)
  { circuitNo: 'L01', name: 'Cargo Pump Room Lights',  fromBus: 'MSB', toTag: 'LGT-1', kw: 3.5,  quantity: 1, pf: 0.95, efficiency: 0.95, loadKind: 'continuous',   startType: 'N/A', startingMultiplier: 1,   phase: '1P', dfSea: 0.5, dfArrival: 0.7, dfWork: 1.0, dfHarbor: 0.6, dfEmg: 0,   priority: 'NON_ESSENTIAL',  isEmergency: 'N', isBattery: 'N', isSheddable: 'Y', shedPriority: 2, cableLength: 30,  location: 'Deck', notes: '' },
  // 비상 부하 (SOLAS)
  { circuitNo: 'E01', name: 'Emergency Lighting',      fromBus: 'ESB', toTag: 'EMG-L', kw: 5,    quantity: 1, pf: 0.95, efficiency: 0.95, loadKind: 'emergency',    startType: 'N/A', startingMultiplier: 1,   phase: '1P', dfSea: 1.0, dfArrival: 1.0, dfWork: 1.0, dfHarbor: 1.0, dfEmg: 1.0, priority: 'ESSENTIAL',      isEmergency: 'Y', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 40,  location: 'Ship', notes: 'SOLAS' },
  { circuitNo: 'E02', name: 'Emergency Fire Pump',     fromBus: 'ESB', toTag: 'FP-1',  kw: 37,   quantity: 1, pf: 0.85, efficiency: 0.88, loadKind: 'emergency',    startType: 'DOL', startingMultiplier: 6,   phase: '3P', dfSea: 0.0, dfArrival: 0.0, dfWork: 0.0, dfHarbor: 0.0, dfEmg: 1.0, priority: 'ESSENTIAL',      isEmergency: 'Y', isBattery: 'N', isSheddable: 'N', shedPriority: 0, cableLength: 30,  location: 'E/R',  notes: 'SOLAS' },
]

/** 템플릿 엑셀 파일 다운로드 */
export function downloadLoadTemplate() {
  const wb = XLSX.utils.book_new()

  /* Sheet 1: 부하 입력 (실제 샘플 + 헤더) */
  const headerRow = LOAD_COLUMNS.map(c => c.label)
  const dataRows = SAMPLE_ROWS.map(row => LOAD_COLUMNS.map(c => row[c.key] ?? ''))
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  ws['!cols'] = LOAD_COLUMNS.map(c => ({ wch: c.width }))
  XLSX.utils.book_append_sheet(wb, ws, '부하 입력')

  /* Sheet 2: 작성 안내 */
  const guide: Array<[string, string]> = [
    ['항목', '설명'],
    ['회로번호',   'P01, L01, E01 등 — 부하 고유 식별 코드'],
    ['부하명',     '장비명 (M/E C.S.W Pump, Cargo Crane 등)'],
    ['전원출처',   'MSB / ESB / EDB / MDP 등 버스 태그 (계통 설정에서 등록한 것)'],
    ['부하태그',   '부하 고유 태그 (자유 입력)'],
    ['kW',         '정격 출력 (숫자)'],
    ['역률',       '0.5 ~ 1.0 (일반 0.85)'],
    ['효율',       '0.5 ~ 1.0 (일반 0.88 ~ 0.92)'],
    ['수량',         '동일 장비 수량 (기본 1) — ELA 계산 시 kW × 수량 × 수요율'],
    ['ELA유형',      'continuous / intermittent / standby / emergency 중 하나 — IACS ELA 방식'],
    ['기동방식',     'DOL / Y-D / SSR / VFD / DC / N/A 중 하나'],
    ['기동배수',     '기동전류 배수 (DOL 6 / Y-D 2.5 / SSR 3 / VFD 1.5) — Motor Starting 검토'],
    ['위상',         '3P / 1P / N/A 중 하나'],
    ['항해수요율',   '정상 항해 (Sea Going) 시 수요율 (0 ~ 1)'],
    ['출입항수요율', '출입항 (Leaving & Arriving) 시 수요율 (0 ~ 1) — 계류장치 가동'],
    ['하역수요율',   '하역 (Cargo Handling) 시 수요율 (0 ~ 1) — 화물 작업'],
    ['정박수요율',   '정박 정박 (At Port) 시 수요율 (0 ~ 1) — 기관 정지, 조명 유지'],
    ['비상수요율',   '비상 모드 (Emergency) 시 수요율 (0 ~ 1) — SOLAS'],
    ['차단가능',     'Y / N — Load Shedding 대상 (N-1 부족 시 자동 차단 후보)'],
    ['차단우선순위', '1~9 (1=최우선 차단, 0=미지정) — Load Shedding 순서'],
    ['우선순위',   'ESSENTIAL / IMPORTANT / NON_ESSENTIAL'],
    ['비상부하',   'Y / N — 비상발전기 공급 대상'],
    ['배터리공급', 'Y / N — ESS/배터리 공급 대상'],
    ['케이블길이', '케이블 포설 길이 (m) — 전압강하 계산용'],
    ['위치',       '설치 위치 (E/R, Deck, Bow 등)'],
    ['비고',       '자유 입력'],
    ['', ''],
    ['수요율 기준 (KR 선급)', ''],
    ['항해/통신 패널', '1.0'],
    ['전등 패널',     '0.8'],
    ['소화/빌지 펌프', '0.3 ~ 0.5'],
    ['공기압축기',    '0.5'],
    ['추진보조',      '0.3 ~ 0.5'],
    ['비상부하',      '1.0 (비상 모드에서)'],
  ]
  const gws = XLSX.utils.aoa_to_sheet(guide)
  gws['!cols'] = [{ wch: 22 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, gws, '작성 안내')

  const dt = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `부하_입력_템플릿_${dt}.xlsx`)
}

interface ParsedLoad extends Omit<Partial<Load>, 'id' | 'projectId'> {
  _row: number
  _errors: string[]
}

/** 업로드된 Excel/CSV 파일에서 부하 행을 파싱 */
export async function parseLoadFile(file: File): Promise<{ loads: ParsedLoad[]; errors: string[] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.includes('부하')) || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  if (rows.length < 2) {
    return { loads: [], errors: ['파일이 비어있거나 헤더만 있습니다.'] }
  }

  const header = (rows[0] as string[]).map(h => String(h).trim())
  const errors: string[] = []
  const loads: ParsedLoad[] = []

  /* 헤더 매핑: 한글 라벨 → key */
  const labelToKey = new Map<string, string>()
  LOAD_COLUMNS.forEach(c => labelToKey.set(c.label, c.key))
  // 영문 헤더도 허용 (CSV export 호환성)
  const aliases: Record<string, string> = {
    'CircuitNo': 'circuitNo', 'Name': 'name', 'FromBus': 'fromBus', 'ToTag': 'toTag',
    'kW': 'kw', 'PF': 'pf', 'Eff': 'efficiency',
    'StartType': 'startType', 'Phase': 'phase',
    'Quantity': 'quantity', 'Qty': 'quantity',
    'LoadKind': 'loadKind', 'ELAType': 'loadKind',
    'StartMult': 'startingMultiplier', 'StartingMult': 'startingMultiplier',
    'DFsea': 'dfSea', 'DFarrival': 'dfArrival', 'DFwork': 'dfWork', 'DFharbor': 'dfHarbor', 'DFemg': 'dfEmg',
    'DFcargo': 'dfWork',   // 별칭: DFcargo 도 dfWork로 매핑
    'Priority': 'priority', 'Emergency': 'isEmergency', 'Battery': 'isBattery',
    'Sheddable': 'isSheddable', 'ShedPriority': 'shedPriority',
    'CableLen': 'cableLength', 'Location': 'location', 'Notes': 'notes',
  }
  Object.entries(aliases).forEach(([k, v]) => labelToKey.set(k, v))

  const columnMap: (string | null)[] = header.map(h => labelToKey.get(h) || null)

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    // 빈 행 건너뜀
    if (!row || row.every(c => c === '' || c == null)) continue

    const record: Record<string, unknown> = {}
    columnMap.forEach((key, idx) => {
      if (key) record[key] = row[idx]
    })

    const rowErrors: string[] = []
    const asStr = (v: unknown, def = '') => v == null || v === '' ? def : String(v).trim()
    const asNum = (v: unknown, def = 0) => {
      if (v == null || v === '') return def
      const n = Number(v)
      return Number.isFinite(n) ? n : def
    }
    const asYN = (v: unknown) => {
      const s = String(v ?? '').trim().toUpperCase()
      return s === 'Y' || s === 'YES' || s === '1' || s === 'TRUE' || s === 'O'
    }

    const name = asStr(record.name)
    const kw = asNum(record.kw)
    if (!name) rowErrors.push('부하명 누락')
    if (kw <= 0) rowErrors.push('kW 값이 0 이하')

    const startType = (asStr(record.startType, 'DOL') as Load['startType'])
    const phase = (asStr(record.phase, '3P') as Load['phase'])
    const priority = (asStr(record.priority, 'IMPORTANT') as Load['priority'])

    const df = asNum(record.dfSea, 0.8)
    // 출입항/정박 수요율: 셀이 비어있으면 null(미입력) 유지, 값 있으면 숫자 변환
    const dfArrival = record.dfArrival != null && record.dfArrival !== '' ? asNum(record.dfArrival) : null
    const dfHarbor  = record.dfHarbor  != null && record.dfHarbor  !== '' ? asNum(record.dfHarbor)  : null

    // ELA 유형 정규화 (영문/한글 모두 수용)
    const loadKindRaw = asStr(record.loadKind, 'continuous').toLowerCase()
    const loadKind: 'continuous'|'intermittent'|'standby'|'emergency' =
      loadKindRaw.startsWith('int') || loadKindRaw.startsWith('간헐') ? 'intermittent' :
      loadKindRaw.startsWith('stand') || loadKindRaw.startsWith('대기') ? 'standby' :
      loadKindRaw.startsWith('emer') || loadKindRaw.startsWith('비상') ? 'emergency' :
      'continuous'

    const load: ParsedLoad = {
      circuitNo: asStr(record.circuitNo) || `L${String(i).padStart(2, '0')}`,
      name,
      fromBus: asStr(record.fromBus, 'MSB'),
      toTag: asStr(record.toTag),
      kw,
      pf: asNum(record.pf, 0.85),
      efficiency: asNum(record.efficiency, 0.88),
      priority,
      startType,
      phase,
      demandFactor: df,
      dfSea: df,
      dfArrival,
      dfWork: record.dfWork != null && record.dfWork !== '' ? asNum(record.dfWork) : 0,
      dfHarbor,
      dfEmg: record.dfEmg != null && record.dfEmg !== '' ? asNum(record.dfEmg) : 0,
      isEmergency: asYN(record.isEmergency),
      isBattery: asYN(record.isBattery),
      cableLength: asNum(record.cableLength),
      location: asStr(record.location),
      notes: asStr(record.notes),
      // ELA 확장
      loadKind,
      quantity: Math.max(1, asNum(record.quantity, 1) || 1),
      startingMultiplier: asNum(record.startingMultiplier, 1) || 1,
      isSheddable: asYN(record.isSheddable),
      shedPriority: asNum(record.shedPriority, 0) || 0,
      sortOrder: i,
      _row: i + 1,
      _errors: rowErrors,
    }

    if (rowErrors.length) errors.push(`Row ${i + 1}: ${rowErrors.join(', ')}`)
    loads.push(load)
  }

  return { loads, errors }
}
