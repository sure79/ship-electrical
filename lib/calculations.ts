/* ═══════════════════════════════════════════
   선박 전장기본설계 계산 엔진 v3.0
   기준: KR 선급 Pt.4 / IEC 60092 / SOLAS
═══════════════════════════════════════════ */
import type {
  Project,
  Load,
  LoadCalc,
  CalcResult,
  ModeResult,
  Warning,
  OperatingMode,
  Bus,
  BusCalcSummary,
  ChainCheck,
  LoadShedPlanItem,
  CoordinationHint,
  LoadPriority,
  SourceStatus,
  TripRisk,
  ArchitectureRecommendation,
} from './types'

// ── 표준 kVA 계열 (ISO 8528-1 / KR 선급) ──
const STD_KVA = [12.5,16,20,25,31.5,40,50,63,75,100,125,160,
                 200,250,315,400,500,630,800,1000,1250,1600,2000,2500]

// ── MCCB 프레임 (IEC 60947-2, 선박용) ──
const MCCB_FRAMES = [15,30,50,100,225,400,630,1000,1600]

// ── ACB 프레임 (선박용 대전류) ──
const ACB_FRAMES = [630,800,1000,1250,1600,2000,2500,3200,4000]

// ── MCCB 차단 용량 계열 (kA, IEC 60947-2) ──
const BREAKING_KA = [6,10,16,25,36,50,65,85,100]

// ── 케이블 허용전류표 (KR 선급, 3심 트레이 40°C) ──
const CABLE = [
  {s:'1.5',a:13,r:12.1},{s:'2.5',a:18,r:7.41},{s:'4',a:24,r:4.61},{s:'6',a:31,r:3.08},
  {s:'10',a:43,r:1.83},{s:'16',a:57,r:1.15},{s:'25',a:75,r:0.727},{s:'35',a:92,r:0.524},
  {s:'50',a:110,r:0.387},{s:'70',a:141,r:0.268},{s:'95',a:170,r:0.193},{s:'120',a:196,r:0.153},
  {s:'150',a:225,r:0.124},{s:'185',a:258,r:0.0991},{s:'240',a:303,r:0.0754},
]
// r = 저항 (Ω/km at 20°C, 구리)
// 리액턴스: 선박 케이블 근사값 0.08 Ω/km (굵기에 무관한 근사)
const CABLE_X = 0.08  // Ω/km

// ── 물리 상수 ──
const SQRT3 = Math.sqrt(3)
const H2_LHV_KWH = 33.3   // 수소 저위발열량 (kWh/kg)
const FC_EFF = 0.55        // PEMFC 효율
const INV_EFF = 0.95       // 인버터 효율

// ── 기동 kVA 배수 (기동방식별) ──
const START_FACTOR: Record<string,number> = {
  DOL: 7.0,    // 직입기동: 기동전류 6~8배 (IEC 60034)
  'Y-D': 2.5,  // 스타-델타: 1/3 × DOL
  'A-T': 2.0,  // 자동변압기: 65%탭 기준 ≈ 2.0배 (IEC 60034)
  SSR: 3.5,    // 소프트스타터
  VFD: 1.5,    // 인버터: 정격의 1.5배 이내
  DC: 1.0,     // DC 직접: 기동전류 제어됨
  'N/A': 1.0,  // 전등·통신·패널 등 기동전류 없음
}

const PRIORITY_WEIGHT: Record<LoadPriority, number> = {
  NON_ESSENTIAL: 0,
  IMPORTANT: 1,
  ESSENTIAL: 2,
}

/* ───────────────────────────────────────── */
export function calcCurrent(kw:number, pf:number, eff:number, phase:string, v:number): number {
  if(kw<=0||v<=0) return 0
  // N/A(패널·컨버터 등)는 3P로 계산 (케이블 선정 보수적 기준)
  return phase==='1P'
    ? (kw*1000)/(v*pf*eff)
    : (kw*1000)/(SQRT3*v*pf*eff)
}

export function selectStdKva(req:number): number {
  return STD_KVA.find(k=>k>=req) ?? Math.ceil(req/100)*100
}

export function selectAcb(iA:number): number {
  return ACB_FRAMES.find(f=>f>=iA*1.25) ?? 4000
}

export function selectMccb(iA:number, start:string): {frame:number; set:number} {
  // 열동 설정: 정격전류 × 1.0~1.25 (케이블 보호)
  const setA = Math.round(iA*1.1/5)*5
  const frame = MCCB_FRAMES.find(f=>f>=setA*1.25) ?? 1600
  const set = Math.min(setA, Math.floor(frame*0.9/5)*5)
  return {frame, set:Math.max(10,set)}
}

export function selectBreakingKa(iscKa:number): number {
  return BREAKING_KA.find(k=>k>=iscKa) ?? 100
}

export function selectCable(iA:number, emg:boolean, phase:string): {size:string;amp:number;code:string;r:number} {
  const need = iA*1.25
  const c = CABLE.find(x=>x.a>=need) ?? {s:'300',a:349,r:0.06}
  const pfx = emg ? 'FD-' : phase==='1P' ? 'D-' : 'T-'
  return {size:c.s, amp:c.a, code:pfx+c.s, r:c.r}
}

// 전압 강하 계산 (IEC 60092-352)
// ΔV% = (√3 × I × L × (R×cosφ + X×sinφ)) / (V × 1000) × 100  [3상]
// ΔV% = (2 × I × L × (R×cosφ + X×sinφ)) / (V × 1000) × 100   [단상]
export function calcVoltageDrop(
  iA: number, pf: number, lengthM: number, phase: string,
  v: number, rOhmKm: number
): number {
  if(iA<=0||lengthM<=0) return 0
  const sinphi = Math.sqrt(Math.max(0,1-pf*pf))
  const impedance = rOhmKm*pf + CABLE_X*sinphi  // Ω/km
  const L = lengthM/1000  // m → km
  const mult = phase==='1P' ? 2 : SQRT3
  return (mult * iA * L * impedance) / v * 100
}

export function calcPropulsion(motorCount:number, motorKw:number, propPf=0.95, df=0.7): {kw:number;kva:number} {
  const out = motorCount*motorKw*df
  // 효율 체인: 모터(0.94) × VFD(0.97) × AC/DC(0.95) × DC버스(0.99)
  const kw = out/(0.94*0.97*0.95*0.99)
  return {kw, kva:kw/propPf}
}

function uniq<T>(arr:T[]): T[] {
  return Array.from(new Set(arr))
}

function getLoadSourceBus(load: Load, loads: Load[], busMap: Map<string, Bus>): Bus | undefined {
  let cursor = load.fromBus || 'MSB'
  const seen = new Set<string>()
  const byToTag = new Map(loads.filter(l=>l.toTag).map(l=>[l.toTag, l]))

  while(cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const bus = busMap.get(cursor)
    if(bus) return bus
    const upstream = byToTag.get(cursor)
    if(!upstream) break
    cursor = upstream.fromBus
  }

  return busMap.get('MSB')
}

function modeDemandFactor(load: Load, mode: OperatingMode): number {
  if(mode==='SEA') return load.dfSea ?? 0
  if(mode==='ARRIVAL') return load.dfArrival ?? 0
  if(mode==='WORK') return load.dfWork ?? 0
  if(mode==='HARBOR') return load.dfHarbor ?? 0
  return load.dfEmg ?? 0
}

function getExpandedBusList(p:Project, buses:Bus[], loads:Load[]): Bus[] {
  const busMap = new Map<string, Bus>()
  const addBus = (bus:Bus) => {
    if(!busMap.has(bus.tag)) busMap.set(bus.tag, bus)
  }

  addBus({
    id:'__msb__', projectId:p.id, tag:'MSB', name:'Main Switchboard',
    type:'AC-BUS', voltage:p.acVoltage, parentTag:'', sortOrder:0,
  })
  if(p.hasEg) {
    addBus({
      id:'__esb__', projectId:p.id, tag:'ESB', name:'Emergency Switchboard',
      type:'EMERGENCY', voltage:p.acVoltage, parentTag:'MSB', sortOrder:1,
    })
  }
  if(p.hasEss) {
    addBus({
      id:'__ess__', projectId:p.id, tag:'ESS', name:'ESS DC Bus',
      type:'DC-BUS', voltage:p.dcVoltage||650, parentTag:'', sortOrder:2,
    })
  }
  buses.forEach(addBus)

  for(const tag of uniq(loads.map(load=>load.fromBus).filter(Boolean))) {
    if(!busMap.has(tag)) {
      addBus({
        id:`__${tag}__`, projectId:p.id, tag, name:`${tag} Source`,
        type: tag.startsWith('E') ? 'EMERGENCY' : 'PANEL',
        voltage:p.acVoltage, parentTag:tag==='ESB' ? 'MSB' : '', sortOrder:busMap.size+10,
      })
    }
  }

  return Array.from(busMap.values()).sort((a,b)=>a.sortOrder-b.sortOrder||a.tag.localeCompare(b.tag))
}

function buildChainChecks(loads:Load[], buses:Bus[]): ChainCheck[] {
  const busTags = new Set(buses.map(bus=>bus.tag))
  const outputMap = new Map<string, Load>()
  for(const load of loads) {
    if(load.toTag) outputMap.set(load.toTag, load)
  }

  return loads.map(load=>{
    if(!load.fromBus) {
      return {
        loadId:load.id, circuitNo:load.circuitNo, name:load.name, fromBus:'',
        path:[], status:'ORPHAN', message:`${load.circuitNo||load.name}: 전원출처가 비어 있습니다.`,
      }
    }

    if(busTags.has(load.fromBus)) {
      return {
        loadId:load.id, circuitNo:load.circuitNo, name:load.name, fromBus:load.fromBus,
        path:[load.fromBus, load.toTag||load.name], status:'BUS',
        message:`${load.circuitNo||load.name}: ${load.fromBus} 버스에서 직접 공급됩니다.`,
      }
    }

    const seen = new Set<string>()
    const path = [load.toTag||load.name]
    let cursor = load.fromBus

    while(cursor) {
      path.unshift(cursor)
      if(busTags.has(cursor)) {
        return {
          loadId:load.id, circuitNo:load.circuitNo, name:load.name, fromBus:load.fromBus,
          path, status:'OK', message:`${load.circuitNo||load.name}: ${path.join(' -> ')}`,
        }
      }
      if(seen.has(cursor)) {
        return {
          loadId:load.id, circuitNo:load.circuitNo, name:load.name, fromBus:load.fromBus,
          path, status:'LOOP', message:`${load.circuitNo||load.name}: 장비 체인 루프가 감지되었습니다. (${path.join(' -> ')})`,
        }
      }
      seen.add(cursor)
      const upstream = outputMap.get(cursor)
      if(!upstream) {
        return {
          loadId:load.id, circuitNo:load.circuitNo, name:load.name, fromBus:load.fromBus,
          path, status:'ORPHAN', message:`${load.circuitNo||load.name}: ${cursor} 상위 전원 체인을 찾을 수 없습니다.`,
        }
      }
      cursor = upstream.fromBus
    }

    return {
      loadId:load.id, circuitNo:load.circuitNo, name:load.name, fromBus:load.fromBus,
      path, status:'ORPHAN', message:`${load.circuitNo||load.name}: 전원 체인이 끊어져 있습니다.`,
    }
  })
}

function buildBusSummaries(
  p:Project,
  buses:Bus[],
  lc:LoadCalc[],
  warns:Warning[],
): BusCalcSummary[] {
  const busMap = new Map(buses.map(bus=>[bus.tag, bus]))
  const childMap = new Map<string, string[]>()
  const localLoads = new Map<string, LoadCalc[]>()

  for(const bus of buses) {
    const parentTag = bus.parentTag || ''
    if(parentTag) {
      if(parentTag===bus.tag) {
        warns.push({type:'ERROR', code:'BUS_PARENT_SELF', message:`버스 ${bus.tag}: 자기 자신을 부모로 지정할 수 없습니다.`})
      } else if(!busMap.has(parentTag)) {
        warns.push({type:'WARN', code:'BUS_PARENT_MISSING', message:`버스 ${bus.tag}: 상위 버스 ${parentTag}가 없습니다.`})
      }
      const list = childMap.get(parentTag) || []
      list.push(bus.tag)
      childMap.set(parentTag, list)
    }
  }

  for(const load of lc) {
    const src = load.fromBus || 'MSB'
    const list = localLoads.get(src) || []
    list.push(load)
    localLoads.set(src, list)
  }

  const memo = new Map<string, BusCalcSummary>()
  const walk = (tag:string, trail = new Set<string>()): BusCalcSummary => {
    const cached = memo.get(tag)
    if(cached) return cached
    if(trail.has(tag)) {
      warns.push({type:'ERROR', code:'BUS_LOOP', message:`버스 계층 루프가 감지되었습니다. (${Array.from(trail).join(' -> ')} -> ${tag})`})
      const loopBus = busMap.get(tag)
      const fallback: BusCalcSummary = {
        tag,
        name:loopBus?.name||tag,
        type:loopBus?.type||'PANEL',
        parentTag:loopBus?.parentTag||'',
        voltage:loopBus?.voltage||p.acVoltage,
        loadCount:0,
        downstreamTags:[],
        connectedKw:0,
        demandKw:0,
        demandKva:0,
        emergencyKw:0,
        batteryKw:0,
        currentA:0,
      }
      memo.set(tag, fallback)
      return fallback
    }

    const bus = busMap.get(tag)
    const ownLoads = localLoads.get(tag) || []
    const nextTrail = new Set(trail)
    nextTrail.add(tag)
    const childTags = childMap.get(tag) || []
    const childSummaries = childTags.map(child=>walk(child, nextTrail))

    const connectedKw = ownLoads.reduce((s,l)=>s+l.kw,0) + childSummaries.reduce((s,b)=>s+b.connectedKw,0)
    const demandKw = ownLoads.reduce((s,l)=>s+l.kwDemand,0) + childSummaries.reduce((s,b)=>s+b.demandKw,0)
    const demandKva = ownLoads.reduce((s,l)=>s+l.kvaDemand,0) + childSummaries.reduce((s,b)=>s+b.demandKva,0)
    const emergencyKw = ownLoads.filter(l=>l.isEmergency).reduce((s,l)=>s+l.kwDemand,0) + childSummaries.reduce((s,b)=>s+b.emergencyKw,0)
    const batteryKw = ownLoads.filter(l=>l.isBattery).reduce((s,l)=>s+l.kwDemand,0) + childSummaries.reduce((s,b)=>s+b.batteryKw,0)
    const loadCount = ownLoads.length + childSummaries.reduce((s,b)=>s+b.loadCount,0)
    const avgPf = demandKva>0 ? Math.max(0.7, demandKw/demandKva) : 0.85
    const currentA = demandKw>0
      ? calcCurrent(demandKw, avgPf, 1, bus?.type==='DC-BUS' ? '1P' : '3P', bus?.voltage || p.acVoltage)
      : 0

    const summary: BusCalcSummary = {
      tag,
      name:bus?.name||tag,
      type:bus?.type||'PANEL',
      parentTag:bus?.parentTag||'',
      voltage:bus?.voltage||p.acVoltage,
      loadCount,
      downstreamTags:uniq(childTags.flatMap(child=>[child, ...walk(child).downstreamTags])),
      connectedKw,
      demandKw,
      demandKva,
      emergencyKw,
      batteryKw,
      currentA,
    }
    memo.set(tag, summary)
    return summary
  }

  return buses.map(bus=>walk(bus.tag))
}

function buildLoadSheddingPlan(lc:LoadCalc[], requiredKw:number): LoadShedPlanItem[] {
  let cumulativeKw = 0
  return lc
    .filter(load=>load.kwDemand>0)
    .sort((a,b)=>{
      const diff = PRIORITY_WEIGHT[a.priority]-PRIORITY_WEIGHT[b.priority]
      if(diff!==0) return diff
      return b.kwDemand-a.kwDemand
    })
    .map(load=>{
      const selected = !load.isEmergency && cumulativeKw < requiredKw
      if(selected) cumulativeKw += load.kwDemand
      return {
        id:load.id,
        circuitNo:load.circuitNo,
        name:load.name,
        fromBus:load.fromBus,
        priority:load.priority,
        kwDemand:load.kwDemand,
        cumulativeKw,
        selected,
      }
    })
}

function buildCoordinationHints(busSummaries:BusCalcSummary[], lc:LoadCalc[]): CoordinationHint[] {
  return busSummaries
    .filter(summary=>summary.loadCount>0)
    .map(summary=>{
      const related = lc.filter(load=>load.fromBus===summary.tag || summary.downstreamTags.includes(load.fromBus))
      const largest = related.length>0
        ? related.slice(1).reduce((max, load)=>load.mccbSet>max.mccbSet?load:max, related[0])
        : null
      const recommendedBreakerA = summary.currentA>0
        ? (summary.currentA>=630 ? selectAcb(summary.currentA) : selectMccb(summary.currentA, 'N/A').frame)
        : 0
      const largestBranchSetA = largest?.mccbSet || 0
      const marginPct = largestBranchSetA>0
        ? Math.round((recommendedBreakerA/largestBranchSetA-1)*100)
        : 999
      return {
        sourceTag:summary.tag,
        largestBranch:largest ? `${largest.circuitNo||largest.name}` : '-',
        largestBranchSetA,
        recommendedBreakerA,
        marginPct,
        status: largestBranchSetA>0 && marginPct<35 ? 'REVIEW' : 'OK',
      }
    })
}

function buildSourceStatuses(args:{
  p:Project
  demandKw:number
  dgAvailableKw:number
  egAvailableKw:number
  essAvailableKw:number
  fcAvailableKw:number
  pvAvailableKw:number
  shoreAvailableKw:number
  voltageDipPct:number
}): SourceStatus[] {
  const { p, demandKw, dgAvailableKw, egAvailableKw, essAvailableKw, fcAvailableKw, pvAvailableKw, shoreAvailableKw, voltageDipPct } = args
  let remaining = demandKw
  const statuses: SourceStatus[] = []

  const assign = (availableKw:number, preferredKw:number) => {
    const assignedKw = Math.max(0, Math.min(availableKw, preferredKw, remaining))
    remaining = Math.max(0, remaining - assignedKw)
    return assignedKw
  }

  const pvAssigned = p.hasPv ? assign(pvAvailableKw, Math.min(demandKw * 0.15, pvAvailableKw)) : 0
  if(p.hasPv) {
    statuses.push({
      key:'PV',
      label:'태양광',
      role:'Aux Renewable',
      availableKw:pvAvailableKw,
      assignedKw:pvAssigned,
      reserveKw:Math.max(0, pvAvailableKw-pvAssigned),
      status:pvAvailableKw>0?'OK':'WARN',
      note:'주간 보조전원 및 ESS 충전 보조',
    })
  }

  const shoreAssigned = p.hasShore ? assign(shoreAvailableKw, p.hasDg || p.hasFc ? demandKw * 0.35 : demandKw) : 0
  if(p.hasShore) {
    statuses.push({
      key:'SHORE',
      label:'육전',
      role:'Harbor / Maintenance',
      availableKw:shoreAvailableKw,
      assignedKw:shoreAssigned,
      reserveKw:Math.max(0, shoreAvailableKw-shoreAssigned),
      status:shoreAvailableKw>=demandKw || !p.hasDg ? 'OK' : 'WARN',
      note:'정박 및 점검 시 주전원, DG와는 인터록 운전 권장',
    })
  }

  const fcPreferred = p.hasFc ? (p.hasEss ? demandKw * 0.45 : demandKw * 0.65) : 0
  const fcAssigned = p.hasFc ? assign(fcAvailableKw, fcPreferred) : 0
  if(p.hasFc) {
    statuses.push({
      key:'FC',
      label:'연료전지',
      role:p.hasEss ? 'Base Source' : 'Supplemental Source',
      availableKw:fcAvailableKw,
      assignedKw:fcAssigned,
      reserveKw:Math.max(0, fcAvailableKw-fcAssigned),
      status:!p.hasEss && voltageDipPct>10 ? 'WARN' : 'OK',
      note:p.hasEss ? 'ESS와 조합해 피크/램프 응답 보조 권장' : '단독으로는 급격한 기동 피크 대응 한계 가능',
    })
  }

  const dgAssigned = p.hasDg ? assign(dgAvailableKw, demandKw) : 0
  if(p.hasDg) {
    const reserveKw = Math.max(0, dgAvailableKw-dgAssigned)
    statuses.push({
      key:'DG',
      label:'디젤 발전기',
      role:p.hasEss || p.hasFc ? 'Base / Reserve' : 'Main Source',
      availableKw:dgAvailableKw,
      assignedKw:dgAssigned,
      reserveKw,
      status:reserveKw < Math.max(0, demandKw*0.12) ? 'WARN' : 'OK',
      note:reserveKw < Math.max(0, demandKw*0.12)
        ? '예비출력이 낮아 모터 기동 및 피크 시 트립 위험 검토 필요'
        : '주전원 역할 수행 가능',
    })
  }

  const essPreferred = p.hasEss ? Math.max(remaining, demandKw*0.15) : 0
  const essAssigned = p.hasEss ? Math.min(essAvailableKw, essPreferred) : 0
  if(p.hasEss) {
    statuses.push({
      key:'ESS',
      label:'ESS / 배터리',
      role:p.hasDg || p.hasFc ? 'Peak / Start Support' : 'Main Source',
      availableKw:essAvailableKw,
      assignedKw:essAssigned,
      reserveKw:Math.max(0, essAvailableKw-essAssigned),
      status:essAvailableKw>0 ? 'OK' : 'WARN',
      note:p.hasDg || p.hasFc ? '피크컷, 블랙아웃 브리지, 모터 기동 보조' : '주전원 운전 가능 여부 별도 확인 필요',
    })
    remaining = Math.max(0, remaining - essAssigned)
  }

  if(p.hasEg) {
    statuses.push({
      key:'EG',
      label:'비상 발전기',
      role:'Emergency Backup',
      availableKw:egAvailableKw,
      assignedKw:0,
      reserveKw:egAvailableKw,
      status:egAvailableKw>0 ? 'OK' : 'OFF',
      note:'비상부하 전용, 평상시 분리 운전',
    })
  }

  return statuses
}

function buildTripRisks(args:{
  p:Project
  lc:LoadCalc[]
  loadFactorPct:number
  n1Ok:boolean
  n1ShedKw:number
  voltageDipPct:number
  voltageDipOk:boolean
  worstStartMotor:string
  coordinationHints:CoordinationHint[]
  sourceStatuses:SourceStatus[]
}): TripRisk[] {
  const { p, lc, loadFactorPct, n1Ok, n1ShedKw, voltageDipPct, voltageDipOk, worstStartMotor, coordinationHints, sourceStatuses } = args
  const risks: TripRisk[] = []
  const largeDolLoads = lc.filter(load=>load.startType==='DOL' && load.kw>=30)
  const nonlinearLoads = lc.filter(load=>['VFD','DC','SSR'].includes(load.startType) || /converter|rectifier|inverter|pcs|charger|ups|컨버터|인버터|정류기/i.test(load.name))
  const essStatus = sourceStatuses.find(source=>source.key==='ESS')
  const fcStatus = sourceStatuses.find(source=>source.key==='FC')

  if(p.hasDg && loadFactorPct>=85) {
    risks.push({
      code:'GEN_RESERVE_LOW',
      title:'발전기 예비율 부족',
      severity:loadFactorPct>=92 ? 'HIGH' : 'MEDIUM',
      message:`현재 발전기 부하율이 ${loadFactorPct}% 수준이라 추가 피크 또는 동시기동 시 트립 위험이 있습니다.`,
      mitigation:'ESS 피크컷, 대형 모터 순차기동, 발전기 대수 증가 또는 부하 분산이 필요합니다.',
    })
  }

  if(!n1Ok) {
    risks.push({
      code:'N1_TRIP',
      title:'N-1 탈락 시 전원 유지 실패',
      severity:'HIGH',
      message:`발전기 1대 탈락 시 약 ${n1ShedKw.toFixed(0)} kW의 부하 차단이 필요합니다.`,
      mitigation:'Load Shedding 자동화, ESS 블랙아웃 브리지, 비필수 부하 분리, Bus Tie 구간화가 필요합니다.',
    })
  }

  if(!voltageDipOk) {
    risks.push({
      code:'START_TRIP',
      title:'모터 기동 시 저전압 트립 위험',
      severity:'HIGH',
      message:`${worstStartMotor||'대형 모터'} 기동 시 예상 전압강하가 ${voltageDipPct.toFixed(1)}%입니다.`,
      mitigation:'VFD 또는 Soft Starter 적용, 기동 순차제어, ESS 순간보조, 발전기 여유 확보가 필요합니다.',
    })
  } else if(voltageDipPct>10) {
    risks.push({
      code:'START_MARGIN_LOW',
      title:'모터 기동 여유 부족',
      severity:'MEDIUM',
      message:`최대 기동 시 전압강하가 ${voltageDipPct.toFixed(1)}%로 높습니다.`,
      mitigation:'대형 모터 기동 방식 개선과 ESS 스피닝리저브 검토가 필요합니다.',
    })
  }

  if(largeDolLoads.length>0) {
    risks.push({
      code:'LARGE_DOL',
      title:'대형 DOL 기동 부하 존재',
      severity:'MEDIUM',
      message:`${largeDolLoads.length}개의 대형 모터가 직입기동(DOL)으로 설정돼 있습니다.`,
      mitigation:'30kW 이상 모터는 VFD, Soft Starter, A-T Starter 적용 우선 검토가 필요합니다.',
    })
  }

  if(coordinationHints.some(hint=>hint.status==='REVIEW')) {
    risks.push({
      code:'SELECTIVITY',
      title:'보호협조 재검토 필요',
      severity:'MEDIUM',
      message:'일부 버스에서 상위 차단기와 하위 분기 차단기 여유가 부족합니다.',
      mitigation:'ACB/MCCB 설정 재조정과 선택차단 표 검토가 필요합니다.',
    })
  }

  if(fcStatus && !essStatus) {
    risks.push({
      code:'FC_BUFFER',
      title:'연료전지 단독 피크 대응 한계',
      severity:'MEDIUM',
      message:'연료전지는 응답속도 특성상 급격한 기동/피크를 단독으로 받기 어렵습니다.',
      mitigation:'FC 앞단 또는 DC BUS 측 ESS 버퍼와 PCS 추가가 필요합니다.',
    })
  }

  if(nonlinearLoads.length>=3) {
    risks.push({
      code:'POWER_QUALITY',
      title:'전력품질 관리 필요',
      severity:'LOW',
      message:'VFD, 정류기, 컨버터 계열 부하가 많아 고조파 및 역률 영향 검토가 필요합니다.',
      mitigation:'AFE, Line Reactor, Harmonic Filter, DC Link Choke 적용을 검토해야 합니다.',
    })
  }

  return risks
}

function buildArchitectureRecommendations(args:{
  p:Project
  lc:LoadCalc[]
  voltageDipPct:number
  sourceStatuses:SourceStatus[]
  tripRisks:TripRisk[]
}): ArchitectureRecommendation[] {
  const { p, lc, voltageDipPct, sourceStatuses, tripRisks } = args
  const recommendations: ArchitectureRecommendation[] = []
  const largeMotors = lc.filter(load=>load.kw>=30)
  const nonlinearLoads = lc.filter(load=>['VFD','DC','SSR'].includes(load.startType) || /converter|rectifier|inverter|pcs|charger|ups|컨버터|인버터|정류기/i.test(load.name))

  if(largeMotors.some(load=>load.startType==='DOL' || load.startType==='Y-D')) {
    recommendations.push({
      category:'STARTING',
      priority:'HIGH',
      title:'대형 모터 기동장치 고도화',
      detail:'대형 모터는 직입기동 또는 Y-D만으로는 발전기 순간충격이 큽니다. 가변속 또는 소프트 기동 방식으로 전환하는 것이 좋습니다.',
      equipment:'VFD, Soft Starter, Auto Transformer Starter',
    })
  }

  if(p.hasDg && p.hasEss) {
    recommendations.push({
      category:'PEAK',
      priority:'HIGH',
      title:'DG + ESS 피크보조 구조 적용',
      detail:'디젤 발전기는 Base Source로 유지하고 ESS는 Peak Shaving, Motor Starting Support, Blackout Bridge에 사용하도록 구성합니다.',
      equipment:'Bidirectional PCS, EMS/PMS, Load Shedding Logic',
    })
  } else if(p.hasDg && !p.hasEss && voltageDipPct>10) {
    recommendations.push({
      category:'PEAK',
      priority:'HIGH',
      title:'ESS 보조전원 추가',
      detail:'현재 구조는 발전기가 모든 기동충격과 피크를 직접 부담합니다. 순간 여유 확보용 ESS를 추가하는 것이 유리합니다.',
      equipment:'ESS Rack, PCS, DC Link Support',
    })
  }

  if(p.hasFc) {
    recommendations.push({
      category:'ARCHITECTURE',
      priority:'HIGH',
      title:'연료전지는 Base, ESS는 Buffer로 구성',
      detail:'연료전지는 안정 출력 영역에서 지속 공급하고, ESS가 급격한 부하변동과 기동 피크를 흡수하는 하이브리드 구조가 적합합니다.',
      equipment:'Fuel Cell Module, DC/DC Converter, ESS, PCS, DC BUS',
    })
  }

  if(p.hasDc || largeMotors.length>0) {
    recommendations.push({
      category:'ARCHITECTURE',
      priority:'MEDIUM',
      title:'대형 구동부는 DC BUS 기반으로 분리',
      detail:'추진 또는 대형 가변속 모터는 AC BUS에서 직접 기동하기보다 DC BUS + Inverter/VFD 체인으로 분리하는 것이 안정적입니다.',
      equipment:'AC/DC Converter, DC BUS, Inverter, VFD, Bus Tie',
    })
  }

  if(nonlinearLoads.length>=3) {
    recommendations.push({
      category:'POWER_QUALITY',
      priority:'MEDIUM',
      title:'전력품질 보상장치 추가',
      detail:'인버터, 컨버터, 정류기 부하가 많으면 고조파와 역률 저하에 대한 사전 대책이 필요합니다.',
      equipment:'AFE, Line Reactor, Harmonic Filter, Active Filter',
    })
  }

  if(tripRisks.some(risk=>risk.code==='SELECTIVITY')) {
    recommendations.push({
      category:'PROTECTION',
      priority:'MEDIUM',
      title:'Bus Section 분리와 선택차단 보강',
      detail:'비필수 작업부하와 필수부하를 같은 버스에 두기보다 Bus Tie와 Section Breaker로 구분하는 것이 좋습니다.',
      equipment:'Bus Tie Breaker, Section Breaker, ACB/MCCB Setting Review',
    })
  }

  if(!p.hasEg && lc.some(load=>load.isEmergency)) {
    recommendations.push({
      category:'PROTECTION',
      priority:'HIGH',
      title:'비상전원 계통 분리',
      detail:'비상부하가 존재하는 경우 Emergency Source와 Emergency Bus 분리 구성이 필요합니다.',
      equipment:'Emergency Generator 또는 ESS Emergency Bus, Emergency Switchboard',
    })
  }

  return recommendations
}

/* ─── 운전 모드별 부하 계산 ─── */
function calcLoadsByMode(
  p:Project, loads:Load[], mode:OperatingMode,
  warns:Warning[], iscBusKa:number, buses:Bus[]
): {lc:LoadCalc[]; modeResult:ModeResult} {
  const label = {
    SEA:'항해 모드',
    ARRIVAL:'출입항 모드',
    WORK:'하역 모드',
    HARBOR:'정박 모드',
    EMG:'비상 모드',
  }[mode]
  const modeLabel = label
  const busMap = new Map(buses.map(bus=>[bus.tag, bus]))

  const lc: LoadCalc[] = loads.map(ld=>{
    const df = modeDemandFactor(ld, mode)
    const sourceBus = getLoadSourceBus(ld, loads, busMap)
    const loadVoltage = sourceBus?.voltage || p.acVoltage
    const loadPhase = sourceBus?.type==='DC-BUS' ? '1P' : ld.phase

    const kvaConn   = ld.pf>0 ? ld.kw/ld.pf : 0
    const kwDemand  = ld.kw*df
    const kvaDemand = ld.pf>0 ? kwDemand/ld.pf : 0
    const currentA  = calcCurrent(ld.kw, ld.pf, ld.efficiency, loadPhase, loadVoltage)

    // 기동 kVA
    const startFactor = START_FACTOR[ld.startType]??1.0
    const startKva = kvaConn*startFactor

    // MCCB
    const {frame:mccbFrame, set:mccbSet} = selectMccb(currentA, ld.startType)
    const breakingKa = selectBreakingKa(iscBusKa)

    // 케이블
    const {size:cableSize, amp:cableAmpacity, code:cableCode, r:cableR} =
      selectCable(currentA, ld.isEmergency, loadPhase)
    const cableMarginPct = currentA>0 ? Math.round((cableAmpacity/currentA-1)*100) : 999
    const mccbOk = mccbSet<=cableAmpacity

    // 전압 강하
    const voltageDrop = calcVoltageDrop(
      currentA, ld.pf, ld.cableLength||0, loadPhase, loadVoltage, cableR
    )
    const voltageDropOk = ld.cableLength>0 ? voltageDrop<=5.0 : true

    // 경고 (항해 모드에서만 중복 경고 방지)
    if(mode==='SEA') {
      if(cableMarginPct<25 && ld.kw>0)
        warns.push({type:'WARN',code:'CABLE_LOW',
          message:`${ld.circuitNo||ld.name}: 케이블 여유율 ${cableMarginPct}% (25% 미만)`})
      if(!mccbOk)
        warns.push({type:'WARN',code:'MCCB_CABLE',
          message:`${ld.circuitNo||ld.name}: MCCB(${mccbSet}A) > 케이블 허용전류(${cableAmpacity}A) 검토`})
      if(!voltageDropOk && ld.cableLength>0)
        warns.push({type:'WARN',code:'VD_HIGH',
          message:`${ld.circuitNo||ld.name}: 전압강하 ${voltageDrop.toFixed(1)}% (한계 5%) — 케이블 증설 검토`})
    }

    return {
      ...ld, kvaConn, kwDemand, kvaDemand, currentA, startKva,
      mccbFrame, mccbSet, breakingKa,
      cableSize, cableAmpacity, cableCode, cableMarginPct, mccbOk,
      voltageDrop, voltageDropOk,
      // override demand factor with mode-specific
      demandFactor: df,
    }
  })

  const totKwConn    = lc.reduce((s,l)=>s+l.kw, 0)
  const totKvaConn   = lc.reduce((s,l)=>s+l.kvaConn, 0)
  const totKwDemand  = lc.reduce((s,l)=>s+l.kwDemand, 0)
  const totKvaDemand = lc.reduce((s,l)=>s+l.kvaDemand, 0)
  const avgPf        = totKvaDemand>0 ? totKwDemand/totKvaDemand : 0.85

  const emg = lc.filter(l=>l.isEmergency)
  const emgKwDemand  = emg.reduce((s,l)=>s+l.kwDemand,0)
  const emgKvaDemand = emg.reduce((s,l)=>s+l.kvaDemand,0)

  // 추진 (SEA/WORK 모드에서만)
  let propKwIn=0, propKvaIn=0
  if(p.hasDc && p.motorCount && p.motorKw && mode!=='EMG') {
    const pr = calcPropulsion(p.motorCount, p.motorKw, p.propPf||0.95)
    propKwIn=pr.kw; propKvaIn=pr.kva
  }
  const totKwAll  = totKwDemand + propKwIn
  const totKvaAll = totKvaDemand + propKvaIn

  // 발전기 산정
  const dgCount = Math.max(1, p.dgCount||1)
  const reqKva1 = p.hasDg ? totKvaAll*(1+p.designMargin)/dgCount : 0
  const selKva  = p.hasDg ? selectStdKva(reqKva1) : 0
  const selKw   = selKva ? Math.round(selKva*(p.dgPf||0.8)) : 0
  const genAcbA = selKva ? selectAcb((selKva*1000)/(SQRT3*p.acVoltage)) : 0
  const loadFactorPct = selKw*dgCount>0
    ? Math.round(totKwAll/(selKw*dgCount)*100) : 0

  const modeResult: ModeResult = {
    mode, label:modeLabel,
    totKwDemand, totKvaDemand, avgPf,
    totKwAll, totKvaAll,
    emgKwDemand, emgKvaDemand,
    reqKva: reqKva1*dgCount, selKva, selKw, genAcbA, loadFactorPct,
  }

  return {lc, modeResult}
}

/* ═══════════════════════════════════════════
   메인 계산 함수
═══════════════════════════════════════════ */
export function runCalculation(p:Project, loads:Load[], buses:Bus[] = []): CalcResult {
  const warns: Warning[] = []
  const expandedBuses = getExpandedBusList(p, buses, loads)

  if(loads.length===0) {
    warns.push({type:'WARN',code:'NO_LOADS',message:'부하 입력이 없습니다.'})
  }
  const emgLoads = loads.filter(l=>l.isEmergency)
  if(emgLoads.length===0)
    warns.push({type:'WARN',code:'NO_EMG',message:'비상부하 항목이 없습니다. 비상여부 체크를 확인하세요.'})

  // ── 단락전류 사전 계산 (MCCB 차단 용량 선정에 사용) ──
  const dgCount  = Math.max(1, p.dgCount||1)
  const dgXd     = p.dgXd||0.15
  // Isc = Sn[kVA] × 1000 / (√3 × V × X"d)  [전부하 단락]
  // 단, 전원 없으면 최소값 사용
  let iscBusKa = 0
  if(p.hasDg) {
    // 초기 추정: 총 발전기 용량 기준 (정확한 Isc는 발전기 선정 후 재계산)
    const estKva = loads.reduce((s,l)=>s+l.kw/Math.max(l.pf,0.8),0)*1.3
    const estSelKva = selectStdKva(estKva/dgCount)
    iscBusKa = (estSelKva*1000*dgCount)/(SQRT3*p.acVoltage*dgXd)/1000
  }
  if(p.hasFc) {
    const fcKva = (p.fcStackKw||100)/0.9
    iscBusKa = Math.max(iscBusKa, (fcKva*1000)/(SQRT3*p.acVoltage*0.12)/1000)
  }
  iscBusKa = Math.max(iscBusKa, 6)  // 최소 6kA

  const missingManualDf = loads.filter(load=>load.dfArrival==null || load.dfHarbor==null)
  if(missingManualDf.length>0) {
    warns.push({
      type:'WARN',
      code:'DF_MANUAL_MISSING',
      message:`출입항/정박 수요율이 비어 있는 부하 ${missingManualDf.length}개는 해당 모드에서 0으로 계산됩니다. 각 운전조건 수요율을 직접 입력하세요.`,
    })
  }

  // ── 5개 운전 모드 계산: 항해 / 출입항 / 하역 / 정박 / 비상 ──
  const MODES: OperatingMode[] = ['SEA','ARRIVAL','WORK','HARBOR','EMG']
  const modeCalcs = MODES.map(mode=>calcLoadsByMode(p, loads, mode, warns, iscBusKa, expandedBuses))
  const modeResults: ModeResult[] = modeCalcs.map(calc=>calc.modeResult)
  const seaLoads = modeCalcs.find(calc=>calc.modeResult.mode==='SEA') || modeCalcs[0]

  // 항해 모드 기준으로 상세 LoadCalc 사용
  const lc = seaLoads.lc
  const chainChecks = buildChainChecks(loads, expandedBuses)
  chainChecks
    .filter(check=>check.status==='ORPHAN' || check.status==='LOOP')
    .forEach(check=>{
      warns.push({
        type: check.status==='LOOP' ? 'ERROR' : 'WARN',
        code: check.status==='LOOP' ? 'CHAIN_LOOP' : 'CHAIN_ORPHAN',
        message: check.message,
      })
    })
  const busSummaries = buildBusSummaries(p, expandedBuses, lc, warns)

  // ── 발전기 결정 모드 (가장 큰 kVA 요구 모드) ──
  const bindingModeResult = modeResults.reduce((a,b)=>b.reqKva>a.reqKva?b:a, modeResults[0])
  const bindingMode = bindingModeResult.mode

  const selKva = bindingModeResult.selKva
  const selKw  = bindingModeResult.selKw
  const reqKva = bindingModeResult.reqKva
  const loadFactorPct = bindingModeResult.loadFactorPct
  const genAcbA = bindingModeResult.genAcbA

  // ── 단락전류 재계산 (최종 발전기 용량 기준) ──
  const finalIscBusKa = selKva>0
    ? Math.round((selKva*1000*dgCount)/(SQRT3*p.acVoltage*dgXd)/1000*10)/10
    : iscBusKa
  const requiredBreakingKa = selectBreakingKa(finalIscBusKa)

  // ── N-1 이중화 검토 ──
  const n1Kw = seaLoads.modeResult.totKwAll
  const n1Capacity = selKw*(dgCount-1)
  const n1LoadFactorPct = n1Capacity>0 ? Math.round(n1Kw/n1Capacity*100) : 999
  const n1Ok = dgCount<=1 ? true : n1LoadFactorPct<=100
  const n1ShedKw = !n1Ok ? Math.ceil(n1Kw-n1Capacity*0.9) : 0
  const loadSheddingPlan = buildLoadSheddingPlan(lc, n1ShedKw)

  if(p.hasDg) {
    if(loadFactorPct<25) warns.push({type:'WARN',code:'GEN_LOW',
      message:`발전기 부하율 ${loadFactorPct}% (${bindingModeResult.label}) — 저부하 보호 검토 (최소 25%)`})
    if(loadFactorPct>90) warns.push({type:'ERROR',code:'GEN_HIGH',
      message:`발전기 부하율 ${loadFactorPct}% (${bindingModeResult.label}) — 과부하! 용량 재검토`})
    if(dgCount>=2 && !n1Ok)
      warns.push({type:'ERROR',code:'N1_FAIL',
        message:`N-1 이중화 실패: 1대 트립 시 부하율 ${n1LoadFactorPct}% — ${n1ShedKw} kW 부하 차단 필요`})
    if(!n1Ok) {
      const shedableKw = loadSheddingPlan
        .filter(item=>item.selected)
        .reduce((sum,item)=>sum+item.kwDemand,0)
      if(shedableKw<n1ShedKw) {
        warns.push({type:'ERROR', code:'SHED_SHORT',
          message:`우선순위 기반 부하 차단으로도 ${n1ShedKw.toFixed(0)} kW를 확보하지 못합니다. 필수부하 분류를 재검토하세요.`})
      }
    }
  }

  // ── 전동기 기동 전압강하 분석 ──
  const motorLoads = lc.filter(l=>['DOL','Y-D','A-T','SSR'].includes(l.startType) && l.kw>5)
  let worstStartKva=0, worstStartMotor='', voltageDipPct=0, voltageDipOk=true
  if(motorLoads.length>0 && selKva>0) {
    const worst = motorLoads.reduce((a,b)=>b.startKva>a.startKva?b:a, motorLoads[0])
    worstStartKva = worst.startKva
    worstStartMotor = `${worst.circuitNo} ${worst.name}`
    // 전압강하 ΔV% = Isc_start / (Isc_gen + Isc_start) × 100 (근사)
    // 더 정확: ΔV% = startKVA / (genKVA/X"d) × 100
    const genSubKva = selKva*dgCount/dgXd
    voltageDipPct = Math.round(worstStartKva/genSubKva*100*10)/10
    voltageDipOk = voltageDipPct<=15
    if(!voltageDipOk)
      warns.push({type:'ERROR',code:'VOLT_DIP',
        message:`전압강하 ${voltageDipPct}% (한계 15%, KR Pt.4 Ch.4) — ${worstStartMotor} 기동 시. Y-D·SSR·VFD 기동 검토`})
    else if(voltageDipPct>10)
      warns.push({type:'WARN',code:'VOLT_DIP_WARN',
        message:`전압강하 ${voltageDipPct}% — 10% 초과. 정밀 해석 또는 기동방식 재검토 권장`})
  }

  // ── 비상발전기 ──
  const emgKvaDemand = seaLoads.modeResult.emgKvaDemand
  const emgKwDemand  = seaLoads.modeResult.emgKwDemand
  const egReqKva = emgKvaDemand*(1+p.designMargin)
  const egSelKva = p.hasEg ? selectStdKva(egReqKva) : 0
  const egSelKw  = egSelKva ? Math.round(egSelKva*0.8) : 0

  // ── ESS ──
  let essBackupKwh=0, essPeakKwh=0, essSpinKwh=0, essTotalKwh=0
  let battEssKwh=0, chargeKw=0, essPeakThreshKw=0
  const batteryLoadsSea = lc.filter(l=>l.isBattery)
  const batteryLoadCount = batteryLoadsSea.length
  const batteryLoadKw = batteryLoadsSea.reduce((s,l)=>s+l.kwDemand,0)
  const batteryEmergencyKw = batteryLoadsSea
    .filter(l=>l.isEmergency)
    .reduce((s,l)=>s+l.kwDemand,0)
  const operationHours = Math.max(0, p.operationHours||0)
  const chargeHours = Math.max(0.5, p.chargeHours||6)

  if(batteryLoadCount>0 && !p.hasEss) {
    warns.push({type:'ERROR',code:'BAT_NO_ESS',
      message:`배터리 지정 부하 ${batteryLoadCount}개가 있으나 ESS가 선택되지 않았습니다. 계통 설정에서 ESS를 활성화하세요.`})
  }

  if(p.hasEss) {
    const margin = p.essMargin||0.2

    // 1) 비상 백업: 비상부하 중 운전용 ESS 부하와 중복되지 않는 부분만 산정
    const backupBaseKw = Math.max(0, emgKwDemand-batteryEmergencyKw)
    essBackupKwh = backupBaseKw*(p.essBackupH||0.5)

    // 2) 피크컷: 발전기 정격 × 임계율(%) 초과분 × 지속시간
    if(p.hasDg) {
      const threshPct = (p.essPeakThreshPct??75)/100
      essPeakThreshKw = selKw*dgCount*threshPct
      const peakKw = Math.max(0, seaLoads.modeResult.totKwAll - essPeakThreshKw)
      const durH   = (p.essPeakDurMin??15)/60
      essPeakKwh   = peakKw*durH
    }

    // 3) 기동보조(스피닝 리저브): 발전기 기동 45초 동안 비상부하 공급
    if(p.essSpinReserve) {
      essSpinKwh = emgKwDemand*(45/3600)  // 45초 = 0.0125h
    }

    // 4) 운전용 ESS: 배터리 체크된 부하를 운전시간 동안 공급
    // 순수 ESS 선박은 배터리 체크가 없어도 전체 부하를 운전용 ESS 부하로 간주
    const batteryBaseKw = batteryLoadCount>0 ? batteryLoadKw : (!p.hasDg ? seaLoads.modeResult.totKwAll : 0)
    battEssKwh = batteryBaseKw*operationHours

    essTotalKwh = (essBackupKwh+essPeakKwh+essSpinKwh+battEssKwh)*(1+margin)
    chargeKw = Math.ceil(essTotalKwh/chargeHours*1.2/10)*10

    if(batteryLoadCount>0 && batteryLoadKw<=0) {
      warns.push({type:'WARN',code:'BAT_ZERO',
        message:'배터리 지정 부하가 있으나 현재 운전모드 수요율 기준 ESS 운전 부하가 0 kW입니다. 수요율을 확인하세요.'})
    }
    if(batteryLoadCount===0 && p.hasDg && essBackupKwh===0 && essPeakKwh===0 && essSpinKwh===0) {
      warns.push({type:'WARN',code:'ESS_IDLE',
        message:'ESS가 선택되었지만 배터리 지정 부하·비상 백업·피크컷 조건이 없어 총용량이 0으로 계산됩니다.'})
    }
    if(operationHours<=0 && (batteryLoadCount>0 || !p.hasDg)) {
      warns.push({type:'ERROR',code:'ESS_OP_HOURS',
        message:'ESS 운전시간이 0시간입니다. ESS/배터리 설정에서 운전시간을 입력하세요.'})
    }
    if(battEssKwh>500) {
      warns.push({type:'WARN',code:'BATT_LARGE',
        message:`ESS 운전분 ${battEssKwh.toFixed(0)} kWh 대용량 — 무게·공간·비용 검토 필요`})
    }
  }

  // ── 연료전지 ──
  let fcStackKw=0, h2ConsKgH=0, h2TankKg=0, fcEssKwh=0
  if(p.hasFc) {
    const totKw = seaLoads.modeResult.totKwAll
    fcStackKw = p.fcStackKw>0 ? p.fcStackKw : Math.ceil(totKw*1.1/5)*5
    h2ConsKgH = fcStackKw/(H2_LHV_KWH*FC_EFF*INV_EFF)
    h2TankKg  = Math.ceil(h2ConsKgH*(p.operationHours||8)*1.2)
    const peakKw = Math.max(...loads.map(l=>l.kw*l.demandFactor), 0)
    fcEssKwh  = Math.max(peakKw*0.25*(1+(p.essMargin||0.2)), emgKwDemand*(p.essBackupH||0.5))
    if(h2TankKg>500) warns.push({type:'WARN',code:'H2_LARGE',
      message:`H₂ 탱크 ${h2TankKg} kg — IMO IGF Code 적용. 방폭구역(Zone 1) 설계 필요`})
  }

  // ── 태양광 ──
  let pvGenKwhDay=0, pvDeficitKwh=0, solarEssKwh=0
  if(p.hasPv) {
    pvGenKwhDay  = (p.pvKwp||0)*(p.pvSunHours||4)*0.85
    const dailyKwh = seaLoads.modeResult.totKwAll*(p.operationHours||8)
    pvDeficitKwh = Math.max(0, dailyKwh-pvGenKwhDay)
    const nightKwh = seaLoads.modeResult.totKwAll*Math.max(0,(p.operationHours||8)-(p.pvSunHours||4))
    solarEssKwh = (nightKwh+pvDeficitKwh)*(1+(p.essMargin||0.2))
    chargeKw = Math.max(chargeKw, Math.ceil((p.pvKwp||0)*1.1/5)*5)
    if(!p.pvKwp) warns.push({type:'ERROR',code:'PV_ZERO',
      message:'태양광 패널 용량(kWp)이 0입니다. 계통 설정에서 입력하세요.'})
    if(pvDeficitKwh>0) warns.push({type:'WARN',code:'PV_DEFICIT',
      message:`일 발전 부족: ${pvDeficitKwh.toFixed(1)} kWh — ESS 또는 보조 전원 검토`})
  }

  // ── 육전 ──
  const shoreKva = p.hasShore
    ? Math.ceil(seaLoads.modeResult.totKvaAll*(1+(p.designMargin||0.25))/10)*10
    : 0

  // ── 추진 (항해 모드 기준) ──
  let propKwIn=0, propKvaIn=0
  if(p.hasDc && p.motorCount && p.motorKw) {
    const pr = calcPropulsion(p.motorCount, p.motorKw, p.propPf||0.95)
    propKwIn=pr.kw; propKvaIn=pr.kva
  }

  // ── 전원 없음 경고 ──
  if(!p.hasDg && !p.hasEss && !p.hasFc && !p.hasPv && !p.hasShore)
    warns.push({type:'ERROR',code:'NO_SOURCE',message:'전원 구성이 선택되지 않았습니다. 계통 설정에서 전원을 선택하세요.'})

  // ── 복합 전원 조합 안내 ──
  const sourceCount = [p.hasDg,p.hasFc,p.hasPv,p.hasShore].filter(Boolean).length
  if(sourceCount>=2 && p.hasEss)
    warns.push({type:'WARN',code:'MULTI_SRC',
      message:'복합 전원 구성 — ESS 충방전 제어 (PMS/EMS) 및 전원 우선순위 설계 검토 필요'})

  const coordinationHints = buildCoordinationHints(busSummaries, lc)
  coordinationHints
    .filter(hint=>hint.status==='REVIEW')
    .forEach(hint=>{
      warns.push({
        type:'WARN',
        code:'COORD_REVIEW',
        message:`${hint.sourceTag}: 하위 최대 차단기 ${hint.largestBranchSetA}A 대비 권장 상위 차단기 ${hint.recommendedBreakerA}A 여유가 ${hint.marginPct}%입니다. 선택차단 검토가 필요합니다.`,
      })
    })

  const sourceStatuses = buildSourceStatuses({
    p,
    demandKw: seaLoads.modeResult.totKwAll,
    dgAvailableKw: p.hasDg ? selKw*dgCount : 0,
    egAvailableKw: egSelKw,
    essAvailableKw: p.hasEss ? Math.max(chargeKw, Math.min(seaLoads.modeResult.totKwAll, Math.max(batteryLoadKw, Math.round((essTotalKwh||0)/0.25)))) : 0,
    fcAvailableKw: fcStackKw,
    pvAvailableKw: p.hasPv ? Math.round((p.pvKwp||0)*0.85) : 0,
    shoreAvailableKw: p.hasShore ? Math.round(shoreKva*0.9) : 0,
    voltageDipPct,
  })
  const tripRisks = buildTripRisks({
    p,
    lc,
    loadFactorPct,
    n1Ok,
    n1ShedKw,
    voltageDipPct,
    voltageDipOk,
    worstStartMotor,
    coordinationHints,
    sourceStatuses,
  })
  const architectureRecommendations = buildArchitectureRecommendations({
    p,
    lc,
    voltageDipPct,
    sourceStatuses,
    tripRisks,
  })

  const seaMR = seaLoads.modeResult
  const totKwConn = lc.reduce((sum, load)=>sum+load.kw, 0)
  const totKvaConn = lc.reduce((sum, load)=>sum+load.kvaConn, 0)

  return {
    loads: lc,
    busSummaries,
    chainChecks,
    loadSheddingPlan,
    coordinationHints,
    sourceStatuses,
    tripRisks,
    architectureRecommendations,
    modes: modeResults,
    bindingMode,
    // 발전기
    selKva, selKw, reqKva, loadFactorPct, genAcbA,
    // N-1
    n1LoadFactorPct, n1Ok, n1ShedKw,
    // 비상발전기
    egReqKva, egSelKva, egSelKw,
    // ESS
    essBackupKwh, essPeakKwh, essSpinKwh, essTotalKwh, battEssKwh, chargeKw, batteryLoadKw, batteryLoadCount, essPeakThreshKw,
    // FC
    fcStackKw, h2ConsKgH, h2TankKg, fcEssKwh,
    // PV
    pvGenKwhDay, pvDeficitKwh, solarEssKwh,
    // Shore
    shoreKva,
    // 단락전류
    iscBusKa: finalIscBusKa, requiredBreakingKa,
    // 전동기 기동
    worstStartKva, worstStartMotor, voltageDipPct, voltageDipOk,
    // 추진
    propKwIn, propKvaIn,
    // 공통 합계 (항해 모드)
    totKwConn, totKvaConn,
    totKwDemand: seaMR.totKwDemand, totKvaDemand: seaMR.totKvaDemand,
    avgPf: seaMR.avgPf,
    totKwAll: seaMR.totKwAll, totKvaAll: seaMR.totKvaAll, avgPfAll: seaMR.avgPf,
    emgKwDemand: seaMR.emgKwDemand, emgKvaDemand: seaMR.emgKvaDemand,
    warnings: warns,
  }
}
