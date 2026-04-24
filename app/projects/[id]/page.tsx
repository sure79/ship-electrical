'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Project, Bus, Load, CalcResult, ModeResult } from '@/lib/types'

/* ── 상수 ── */
const CLASS_CODES = ['KR','NK','BV','ABS','LR','DNV','KOMSA','기타']
const FREQS = [60,50]
const DG_COUNTS = [1,2,3,4]
const PHASES: Load['phase'][] = ['3P','1P','N/A']
const START_TYPES: Load['startType'][] = ['DOL','Y-D','A-T','SSR','VFD','DC','N/A']
const LOAD_PRIORITIES: {value: Load['priority']; label: string; color: string; bg: string}[] = [
  { value: 'ESSENTIAL', label: '필수', color: '#b71c1c', bg: '#ffebee' },
  { value: 'IMPORTANT', label: '중요', color: '#1565c0', bg: '#e3f2fd' },
  { value: 'NON_ESSENTIAL', label: '비필수', color: '#616161', bg: '#f5f5f5' },
]

const BUS_TEMPLATE_PACK: Omit<Bus,'id'|'projectId'|'sortOrder'>[] = [
  { tag:'ESB', name:'Emergency Switchboard', type:'EMERGENCY', voltage:220, parentTag:'MSB' },
  { tag:'MDP1', name:'Main Distribution Panel 1', type:'PANEL', voltage:220, parentTag:'MSB' },
  { tag:'LDP', name:'Lighting Distribution Panel', type:'PANEL', voltage:220, parentTag:'MDP1' },
  { tag:'NCP', name:'Navigation & Communication Panel', type:'PANEL', voltage:220, parentTag:'ESB' },
]

// 부하명/kW 기준 기동방식 자동 추천
const NON_MOTOR_PATTERN = /패널|반|판넬|컨버터|전등|조명|통신|화재|탐지|충방전|충전|UPS|LDP|NCP|FAS|BCD|ODS|panel|light|lamp|charger/i
function suggestStartType(kw: number, name?: string): Load['startType'] {
  if (name && NON_MOTOR_PATTERN.test(name)) return 'N/A'  // 비모터 부하
  if (kw <= 15)  return 'DOL'    // ≤15kW: 직입기동
  if (kw <= 37)  return 'Y-D'    // ~37kW: 스타-델타
  if (kw <= 200) return 'Y-D'    // ~200kW: Y-D (VFD는 사용자가 선택)
  return 'VFD'                    // >200kW: VFD 권장
}

const SAMPLE_LOADS: Omit<Load,'id'|'projectId'>[] = [
  {circuitNo:'P01',name:'Fire & G/S Pump',fromBus:'MSB',toTag:'P-001',kw:5.5,pf:0.85,efficiency:0.90,priority:'ESSENTIAL',startType:'DOL',demandFactor:0.5,dfSea:0.5,dfWork:0.3,dfArrival:null,dfHarbor:null,dfEmg:0.5,phase:'3P',isEmergency:true,isBattery:false,cableLength:25,location:'Engine Room',notes:'비상겸용',sortOrder:1},
  {circuitNo:'P02',name:'Fire & Bilge Pump',fromBus:'MSB',toTag:'P-002',kw:5.5,pf:0.85,efficiency:0.90,priority:'ESSENTIAL',startType:'DOL',demandFactor:0.3,dfSea:0.3,dfWork:0.2,dfArrival:null,dfHarbor:null,dfEmg:0.3,phase:'3P',isEmergency:true,isBattery:false,cableLength:30,location:'Engine Room',notes:'비상겸용',sortOrder:2},
  {circuitNo:'P03',name:'Air Compressor',fromBus:'MSB',toTag:'C-001',kw:2.2,pf:0.85,efficiency:0.88,priority:'IMPORTANT',startType:'DOL',demandFactor:0.5,dfSea:0.5,dfWork:0.3,dfArrival:null,dfHarbor:null,dfEmg:0.0,phase:'3P',isEmergency:false,isBattery:false,cableLength:20,location:'Engine Room',notes:'',sortOrder:3},
  {circuitNo:'P04',name:'Macerator Pump',fromBus:'MSB',toTag:'P-003',kw:0.4,pf:0.80,efficiency:0.85,priority:'NON_ESSENTIAL',startType:'DOL',demandFactor:0.3,dfSea:0.3,dfWork:0.2,dfArrival:null,dfHarbor:null,dfEmg:0.0,phase:'1P',isEmergency:false,isBattery:false,cableLength:15,location:'Engine Room',notes:'',sortOrder:4},
  {circuitNo:'P05',name:'Fresh Water Pump',fromBus:'MSB',toTag:'P-004',kw:0.6,pf:0.80,efficiency:0.85,priority:'IMPORTANT',startType:'DOL',demandFactor:0.5,dfSea:0.5,dfWork:0.4,dfArrival:null,dfHarbor:null,dfEmg:0.0,phase:'1P',isEmergency:false,isBattery:false,cableLength:18,location:'Engine Room',notes:'',sortOrder:5},
  {circuitNo:'P06',name:'Oil Boom Reel',fromBus:'MSB',toTag:'M-001',kw:5.0,pf:0.85,efficiency:0.90,priority:'NON_ESSENTIAL',startType:'DOL',demandFactor:0.3,dfSea:0.0,dfWork:0.5,dfArrival:null,dfHarbor:null,dfEmg:0.0,phase:'3P',isEmergency:false,isBattery:false,cableLength:40,location:'Deck',notes:'',sortOrder:6},
  {circuitNo:'P07',name:'Hydro Pack Motor',fromBus:'MSB',toTag:'M-002',kw:55.0,pf:0.85,efficiency:0.92,priority:'NON_ESSENTIAL',startType:'Y-D',demandFactor:0.4,dfSea:0.0,dfWork:0.6,dfArrival:null,dfHarbor:null,dfEmg:0.0,phase:'3P',isEmergency:false,isBattery:false,cableLength:35,location:'Engine Room',notes:'TR 220/440V',sortOrder:7},
  {circuitNo:'N01',name:'항해통신패널(NCP)',fromBus:'MSB',toTag:'NCP-001',kw:3.0,pf:1.0,efficiency:1.0,priority:'ESSENTIAL',startType:'DOL',demandFactor:1.0,dfSea:1.0,dfWork:0.8,dfArrival:null,dfHarbor:null,dfEmg:1.0,phase:'1P',isEmergency:true,isBattery:false,cableLength:60,location:'Bridge',notes:'',sortOrder:8},
  {circuitNo:'L01',name:'전등패널(LDP)',fromBus:'MSB',toTag:'LDP-001',kw:5.0,pf:1.0,efficiency:1.0,priority:'IMPORTANT',startType:'DOL',demandFactor:0.8,dfSea:0.8,dfWork:0.7,dfArrival:null,dfHarbor:null,dfEmg:0.5,phase:'3P',isEmergency:false,isBattery:false,cableLength:50,location:'Various',notes:'',sortOrder:9},
  {circuitNo:'C01',name:'배터리충방전(BCD)',fromBus:'ESS',toTag:'BCD-001',kw:2.0,pf:1.0,efficiency:1.0,priority:'ESSENTIAL',startType:'DC',demandFactor:1.0,dfSea:1.0,dfWork:1.0,dfArrival:null,dfHarbor:null,dfEmg:1.0,phase:'1P',isEmergency:true,isBattery:true,cableLength:10,location:'Engine Room',notes:'ESS 공급',sortOrder:10},
  {circuitNo:'F01',name:'화재탐지반(FAS)',fromBus:'MSB',toTag:'FAS-001',kw:0.5,pf:1.0,efficiency:1.0,priority:'ESSENTIAL',startType:'DOL',demandFactor:1.0,dfSea:1.0,dfWork:1.0,dfArrival:null,dfHarbor:null,dfEmg:1.0,phase:'1P',isEmergency:true,isBattery:false,cableLength:55,location:'Bridge',notes:'내화케이블',sortOrder:11},
]

const BEGINNER_LOAD_PACK: Omit<Load,'id'|'projectId'>[] = [
  { circuitNo:'E01', name:'Emergency Lighting', fromBus:'ESB', toTag:'EL-001', kw:1.2, pf:1, efficiency:1, priority:'ESSENTIAL', startType:'N/A', demandFactor:1, dfSea:1, dfArrival:null, dfWork:1, dfHarbor:null, dfEmg:1, phase:'1P', isEmergency:true, isBattery:false, cableLength:45, location:'Accommodation', notes:'초보자 기본 템플릿', sortOrder:1 },
  { circuitNo:'N02', name:'Nav/Com Console', fromBus:'NCP', toTag:'NAV-001', kw:2.5, pf:1, efficiency:1, priority:'ESSENTIAL', startType:'N/A', demandFactor:1, dfSea:1, dfArrival:null, dfWork:0.8, dfHarbor:null, dfEmg:1, phase:'1P', isEmergency:true, isBattery:false, cableLength:35, location:'Bridge', notes:'초보자 기본 템플릿', sortOrder:2 },
  { circuitNo:'L02', name:'Accommodation Lighting', fromBus:'LDP', toTag:'LDP-002', kw:3.5, pf:1, efficiency:1, priority:'IMPORTANT', startType:'N/A', demandFactor:0.8, dfSea:0.8, dfArrival:null, dfWork:0.8, dfHarbor:null, dfEmg:0.5, phase:'3P', isEmergency:false, isBattery:false, cableLength:40, location:'Various', notes:'초보자 기본 템플릿', sortOrder:3 },
]

type SaveState = 'saved'|'saving'|'error'|'idle'

/* ── 전원 구성 카드 정의 ── */
const POWER_SOURCES = [
  {key:'hasDg'   as const, label:'디젤 발전기',   icon:'⚙️',  desc:'DG×N대, KR표준kVA계열',  color:'#1565c0', bg:'#e3f2fd'},
  {key:'hasEg'   as const, label:'비상 발전기',   icon:'🔴',  desc:'SOLAS II-1/42, 45초기동', color:'#c62828', bg:'#ffebee'},
  {key:'hasEss'  as const, label:'ESS/배터리',    icon:'🔋',  desc:'피크컷·비상백업·ESS',      color:'#6a1b9a', bg:'#f3e5f5'},
  {key:'hasFc'   as const, label:'수소연료전지',  icon:'⚗️',  desc:'PEMFC/SOFC+H₂탱크',       color:'#00838f', bg:'#e0f7fa'},
  {key:'hasPv'   as const, label:'태양광(PV)',    icon:'☀️',  desc:'PV패널+MPPT충전',          color:'#e65100', bg:'#fff3e0'},
  {key:'hasShore'as const, label:'육전(Shore)',   icon:'🔌',  desc:'Shore Power연결',          color:'#546e7a', bg:'#eceff1'},
  {key:'hasDc'   as const, label:'전기추진(DC)',  icon:'🚀',  desc:'AC/DC-VFD-추진모터',       color:'#2e7d32', bg:'#e8f5e9'},
] as {key: keyof Pick<Project,'hasDg'|'hasEg'|'hasEss'|'hasFc'|'hasPv'|'hasShore'|'hasDc'>; label:string; icon:string; desc:string; color:string; bg:string}[]

type IntegrationGuide = {
  title: string
  currentInput: string
  editLocation: string
  action: string
  circuit: string
}

const POWER_QUALITY_PATTERN = /converter|rectifier|inverter|pcs|charger|ups|컨버터|인버터|정류기|충전기/i

function formatLoadNames(items:{name:string}[], fallback='없음', limit=3) {
  if(items.length===0) return fallback
  const names = items.slice(0,limit).map(item=>item.name).join(', ')
  return items.length>limit ? `${names} 외 ${items.length-limit}개` : names
}

function buildTripRiskGuide(args:{
  risk: NonNullable<CalcResult['tripRisks']>[number]
  project: Project
  loads: Load[]
  result: CalcResult
}) {
  const { risk, project, loads, result } = args
  const largeDolLoads = loads.filter(load=>load.startType==='DOL' && load.kw>=30)
  const nonlinearLoads = loads.filter(load=>['VFD','DC','SSR'].includes(load.startType) || POWER_QUALITY_PATTERN.test(load.name))
  const batteryLoads = loads.filter(load=>load.isBattery)
  const emergencyLoads = loads.filter(load=>load.isEmergency)

  switch(risk.code) {
    case 'GEN_RESERVE_LOW':
      return {
        currentInput:`DG ${project.dgCount}대, 현재 부하율 ${result.loadFactorPct.toFixed(1)}%, 주요 대형부하 ${formatLoadNames(loads.filter(load=>load.kw>=20))}`,
        editLocation:'계통 설정 > 전원 구성 선택 / ESS·배터리 설정, 부하 입력 > 대형부하 기동방식',
        action:'발전기 여유를 늘리거나 ESS 피크컷을 켜고, 대형 모터를 순차기동 또는 VFD/Soft Starter로 바꿉니다.',
        circuit:'DG -> MSB / ESS <-> PCS <-> MSB 또는 DC BUS / 대형 모터는 별도 기동장치 후단 배치',
      }
    case 'N1_TRIP':
      return {
        currentInput:`N-1 시 차단 필요 ${result.n1ShedKw.toFixed(0)} kW, 비상부하 ${emergencyLoads.length}개, 배터리 부하 ${batteryLoads.length}개`,
        editLocation:'부하 입력 > 우선순위(필수/중요/비필수), 계통 설정 > 버스·패널 등록, ESS·배터리 설정',
        action:'비필수 부하를 분리하고 ESS 블랙아웃 브리지 또는 부하차단 순서를 명확히 설정합니다.',
        circuit:'MSB -> Bus Tie -> 작업부하 패널 분리 / ESB -> 비상부하 / ESS -> PCS -> 비상 또는 피크 보조 버스',
      }
    case 'START_TRIP':
    case 'START_MARGIN_LOW':
      return {
        currentInput:`최대 기동 전압강하 ${result.voltageDipPct.toFixed(1)}%, 영향 부하 ${result.worstStartMotor || formatLoadNames(largeDolLoads)}`,
        editLocation:'부하 입력 > startType, 계통 설정 > ESS 스피닝리저브, 전기추진/전원 구성',
        action:'문제 모터의 startType을 VFD, SSR, A-T 등으로 변경하고 필요한 경우 ESS 기동보조를 활성화합니다.',
        circuit:'MSB -> VFD 또는 Soft Starter -> Motor / ESS <-> PCS가 기동 순간 전력을 보조',
      }
    case 'LARGE_DOL':
      return {
        currentInput:`대형 DOL 부하 ${largeDolLoads.length}개: ${formatLoadNames(largeDolLoads)}`,
        editLocation:'부하 입력 > 기동방식(startType), SLD 구성 시 모터 앞단 장비',
        action:'30kW 이상 모터는 DOL 대신 VFD, Soft Starter, A-T Starter 중 하나로 바꾸는 것이 좋습니다.',
        circuit:'MSB -> MCCB -> VFD/Soft Starter -> 대형 모터',
      }
    case 'SELECTIVITY':
      return {
        currentInput:`보호협조 검토 대상 버스 ${result.coordinationHints.filter(hint=>hint.status==='REVIEW').length}개`,
        editLocation:'계통 설정 > 버스·패널 등록, 전기 해석 > 보호협조 결과, 차단기 용량 설정',
        action:'필수부하와 작업부하를 버스 또는 패널로 분리하고 상하위 차단기 정격과 트립세팅을 다시 잡습니다.',
        circuit:'DG/ACB -> MSB -> Section Breaker -> MDP/LDP/NCP 로 분리, 상하위 차단기 선택차단 여유 확보',
      }
    case 'FC_BUFFER':
      return {
        currentInput:`연료전지 사용 중, ESS 미구성 또는 버퍼 부족`,
        editLocation:'계통 설정 > 전원 구성 선택, ESS·배터리 설정, 연료전지 설정',
        action:'연료전지는 Base Source로 두고 ESS를 Buffer/Peak 보조로 추가합니다.',
        circuit:'FC -> DC/DC -> DC BUS / ESS <-> PCS -> DC BUS / DC BUS -> Inverter 또는 Main Bus',
      }
    case 'POWER_QUALITY':
      return {
        currentInput:`비선형 부하 ${nonlinearLoads.length}개: ${formatLoadNames(nonlinearLoads)}`,
        editLocation:'부하 입력 > 기동방식/부하명, 계통 구성 > 컨버터·인버터 계통 분리',
        action:'고조파가 큰 장비를 한 버스에 몰지 말고 AFE, Reactor, Harmonic Filter 적용을 검토합니다.',
        circuit:'정류기/VFD 군은 별도 패널 또는 DC BUS에 배치하고 메인버스에는 필터를 추가',
      }
    default:
      return {
        currentInput:risk.message,
        editLocation:'계통 설정 / 부하 입력 / 통합 전력 탭',
        action:risk.mitigation,
        circuit:'현재 계통 구성에 맞춰 버스와 부하 연결을 재검토합니다.',
      }
  }
}

function buildRecommendationGuide(args:{
  item: NonNullable<CalcResult['architectureRecommendations']>[number]
  project: Project
  loads: Load[]
}) {
  const { item, project, loads } = args
  const largeMotors = loads.filter(load=>load.kw>=30)
  const batteryLoads = loads.filter(load=>load.isBattery)

  if(item.category==='STARTING') {
    return {
      currentInput:`대형 모터 ${largeMotors.length}개: ${formatLoadNames(largeMotors)}`,
      editLocation:'부하 입력 > startType, SLD 생성 > 모터 앞단 장비 반영',
      action:'대형 모터 각각에 VFD, Soft Starter, A-T 중 하나를 지정하고, 기동 시퀀스를 분리합니다.',
      circuit:'MSB -> 보호기기 -> VFD/Soft Starter -> Motor',
    }
  }

  if(item.category==='PEAK') {
    return {
      currentInput:`ESS 사용 ${project.hasEss ? '예' : '아니오'}, 배터리 체크 부하 ${batteryLoads.length}개, ESS 총용량 ${project.hasEss ? '계산 반영 대상' : '미구성'}`,
      editLocation:'계통 설정 > ESS·배터리 설정, 부하 입력 > 배터리 체크 / 우선순위',
      action:'ESS를 Peak Shaving, Motor Start Support, Blackout Bridge 용도로 역할을 명확히 두고 설정값을 채웁니다.',
      circuit:'DG -> MSB / ESS <-> PCS <-> AC BUS 또는 DC BUS / Peak 시 ESS가 부족분 보조',
    }
  }

  if(item.category==='ARCHITECTURE' && project.hasFc) {
    return {
      currentInput:`연료전지 사용 중, FC 스택 ${project.fcStackKw>0 ? `${project.fcStackKw} kW` : '자동산정'}`,
      editLocation:'계통 설정 > 연료전지 설정, 전원 구성 선택, 버스·패널 등록',
      action:'연료전지는 안정 출력용, ESS는 변동 대응용으로 역할을 분리해 DC BUS 기반 구조로 구성합니다.',
      circuit:'FC -> DC/DC -> DC BUS / ESS <-> PCS -> DC BUS / DC BUS -> Inverter -> 대형부하',
    }
  }

  if(item.category==='ARCHITECTURE') {
    return {
      currentInput:`전기추진 ${project.hasDc ? '사용' : '미사용'}, 대형 구동부 ${largeMotors.length}개`,
      editLocation:'계통 설정 > 전기추진 설정, 버스·패널 등록, 부하 입력 > fromBus / toTag',
      action:'대형 가변속 부하는 AC 메인버스 직접 연결보다 DC BUS + Inverter/VFD 체인으로 분리합니다.',
      circuit:'DG/Converter -> DC BUS -> Inverter/VFD -> 추진 또는 대형 모터',
    }
  }

  if(item.category==='PROTECTION') {
    return {
      currentInput:`비상부하/작업부하 혼재 여부와 Bus Section 분리 상태를 함께 봐야 합니다.`,
      editLocation:'계통 설정 > 버스·패널 등록, 전기 해석 > 보호협조 힌트',
      action:'필수부하, 비상부하, 작업부하를 버스 또는 패널별로 분리하고 Bus Tie/Section Breaker를 배치합니다.',
      circuit:'MSB -> Section A(필수) / Section B(작업) / ESB(비상)로 분리',
    }
  }

  return {
    currentInput:item.detail,
    editLocation:'계통 설정 / 부하 입력 / 통합 전력 탭',
    action:item.detail,
    circuit:item.equipment,
  }
}

function buildSourceConfigGuide(source: NonNullable<CalcResult['sourceStatuses']>[number]) {
  switch(source.key) {
    case 'DG':
      return {
        editLocation:'계통 설정 > 전원 구성 선택, 발전기 설정',
        action:'발전기 대수, PF, 여유율을 조정해 Base Source 여유를 확보합니다.',
      }
    case 'EG':
      return {
        editLocation:'계통 설정 > 전원 구성 선택, 부하 입력 > 비상체크',
        action:'비상부하가 실제로 ESB 또는 비상 버스에 연결되는지 함께 확인합니다.',
      }
    case 'ESS':
      return {
        editLocation:'계통 설정 > ESS / 배터리 설정, 부하 입력 > 배터리체크',
        action:'운전시간, 백업시간, 피크컷, 스피닝리저브와 배터리 부하를 함께 맞춰야 합니다.',
      }
    case 'FC':
      return {
        editLocation:'계통 설정 > 수소연료전지 설정, 전원 구성 선택',
        action:'FC는 안정출력 영역에 두고 ESS와 DC BUS 버퍼 구성을 같이 검토합니다.',
      }
    case 'PV':
      return {
        editLocation:'계통 설정 > 태양광 설정',
        action:'kWp와 일조시간을 입력한 뒤, 보조전원 성격으로만 보는 것이 안전합니다.',
      }
    case 'SHORE':
      return {
        editLocation:'계통 설정 > 전원 구성 선택',
        action:'항만 정박 시 Shore 공급 기준으로 부하 분담을 따로 검토합니다.',
      }
    default:
      return {
        editLocation:'계통 설정',
        action:'전원별 역할과 연결 버스를 다시 확인합니다.',
      }
  }
}

export default function ProjectPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [project, setProject] = useState<Project|null>(null)
  const [buses, setBuses] = useState<Bus[]>([])
  const [loads, setLoads] = useState<Load[]>([])
  const [calcResult, setCalcResult] = useState<CalcResult|null>(null)
  const [sldXml, setSldXml] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcAt, setCalcAt] = useState<string|null>(null)

  const [newBus, setNewBus] = useState({tag:'',name:'',type:'AC-BUS' as Bus['type'],voltage:220,parentTag:'MSB'})
  const [addingBus, setAddingBus] = useState(false)
  // 수요율은 이제 5개 모드(항해/출입항/하역/정박/비상) 직접 편집. 상세 토글 제거됨.

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const projectTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const loadsRef = useRef<Load[]>([])
  loadsRef.current = loads
  const projectRef = useRef<Project|null>(null)
  projectRef.current = project

  const [loadError, setLoadError] = useState<string|null>(null)

  useEffect(()=>{ loadAll() },[id])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/projects/${id}`)
      if(!res.ok) throw new Error(`서버 오류 ${res.status}`)
      const data = await res.json()
      if(data.project) {
        setProject(data.project)
        setBuses(data.buses||[])
        setLoads(data.loads||[])
        if(data.calcResult) {
          setCalcResult(data.calcResult)
          setSldXml(data.sldXml||'')
          setCalcAt(data.calculatedAt||null)
        }
      }
    } catch(e) {
      console.error('loadAll error:', e)
      setLoadError(e instanceof Error ? e.message : '데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  /* debounced project save */
  const saveProject = useCallback((upd: Partial<Project>) => {
    setProject(prev => {
      if(!prev) return prev
      return {...prev,...upd}
    })
    setSaveState('saving')
    if(projectTimer.current) clearTimeout(projectTimer.current)
    projectTimer.current = setTimeout(async()=>{
      const current = projectRef.current
      if(!current) return
      try {
        await fetch(`/api/projects/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)})
        setSaveState('saved')
      } catch { setSaveState('error') }
      setTimeout(()=>setSaveState('idle'),1500)
    },500)
  },[id])

  function onLoadChange(loadId:string, field:string, val:unknown) {
    // kW 또는 name 변경 시 기동방식 자동 추천 (사용자가 이미 N/A·DC로 고정한 경우 유지)
    setLoads(prev=>prev.map(l=>{
      if(l.id!==loadId) return l
      const updated = {...l,[field]:val}
      if(field==='kw' && l.startType!=='DC') {
        updated.startType = suggestStartType(Number(val), l.name)
      }
      if(field==='name') {
        updated.startType = suggestStartType(l.kw, String(val))
        if(NON_MOTOR_PATTERN.test(String(val))) {
          updated.pf = 1.0
          updated.efficiency = 1.0
        }
      }
      return updated
    }))
    clearTimeout(saveTimers.current[loadId])
    saveTimers.current[loadId] = setTimeout(async()=>{
      setSaveState('saving')
      const current = loadsRef.current.find(l=>l.id===loadId)
      if(!current) return
      const merged = {...current,[field]:val}
      if(field==='kw' && current.startType!=='DC') {
        merged.startType = suggestStartType(Number(val), current.name)
      }
      if(field==='name') {
        merged.startType = suggestStartType(current.kw, String(val))
        if(NON_MOTOR_PATTERN.test(String(val))) {
          merged.pf = 1.0
          merged.efficiency = 1.0
        }
      }
      try {
        await fetch(`/api/loads/${id}/${loadId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(merged)})
        setSaveState('saved')
      } catch { setSaveState('error') }
      setTimeout(()=>setSaveState('idle'),1500)
    },400)
  }

  // onDfSeaSimple 제거됨 — 사용자가 각 모드별 수요율을 직접 입력

  async function addLoad() {
    const fromBus = buses[0]?.tag||'MSB'
    const df = 0.8
    const body = {
      circuitNo:`L${String(loads.length+1).padStart(2,'0')}`,
      name:'신규 부하',fromBus,toTag:'',
      kw:1.0,pf:0.85,efficiency:0.90,priority:'IMPORTANT' as Load['priority'],
      startType:'DOL' as Load['startType'],demandFactor:df,
      dfSea:df, dfArrival: null, dfWork:0, dfHarbor: null, dfEmg:0,
      phase:'3P' as Load['phase'],
      isEmergency:false,isBattery:false,cableLength:0,location:'',notes:'',
      sortOrder:loads.length+1
    }
    const res = await fetch(`/api/loads/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    const data = await res.json()
    if(data.id) setLoads(prev=>[...prev,{...body,id:data.id,projectId:id}])
  }

  async function loadSample() {
    if(!confirm('청항선 H-1041 샘플 데이터를 불러옵니까? 기존 부하가 모두 삭제됩니다.')) return
    for(const l of loads) await fetch(`/api/loads/${id}/${l.id}`,{method:'DELETE'})
    const newLoads:Load[] = []
    for(const sl of SAMPLE_LOADS) {
      const res = await fetch(`/api/loads/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sl)})
      const data = await res.json()
      if(data.id) newLoads.push({...sl,id:data.id,projectId:id})
    }
    setLoads(newLoads)
  }

  async function deleteLoad(loadId:string) {
    await fetch(`/api/loads/${id}/${loadId}`,{method:'DELETE'})
    setLoads(prev=>prev.filter(l=>l.id!==loadId))
  }

  async function addBus() {
    if(!newBus.tag.trim()) return alert('버스 태그를 입력하세요')
    if(buses.some(bus=>bus.tag===newBus.tag.trim())) return alert('같은 버스 태그가 이미 있습니다')
    setAddingBus(true)
    const res = await fetch(`/api/buses/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newBus)})
    const data = await res.json()
    if(data.id) {
      setBuses(prev=>[...prev,{...newBus,id:data.id,projectId:id,sortOrder:prev.length+1}])
      setNewBus({tag:'',name:'',type:'AC-BUS',voltage:220,parentTag:'MSB'})
    }
    setAddingBus(false)
  }

  async function updateBus(busId:string, patch:Partial<Bus>) {
    const current = buses.find(bus=>bus.id===busId)
    if(!current) return
    const next = {...current, ...patch}
    setBuses(prev=>prev.map(bus=>bus.id===busId ? next : bus))
    setSaveState('saving')
    try {
      await fetch(`/api/buses/${id}/${busId}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(next),
      })
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
    setTimeout(()=>setSaveState('idle'),1500)
  }

  async function addBusTemplatePack() {
    const missing = BUS_TEMPLATE_PACK.filter(template=>!buses.some(bus=>bus.tag===template.tag))
    if(missing.length===0) return alert('표준 버스 템플릿이 이미 모두 추가되어 있습니다')
    setAddingBus(true)
    const created: Bus[] = []
    for (const template of missing) {
      const payload = {
        ...template,
        voltage: template.tag==='ESB' ? project?.acVoltage || template.voltage : template.voltage,
      }
      const res = await fetch(`/api/buses/${id}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.id) created.push({...payload, id:data.id, projectId:id, sortOrder:buses.length + created.length})
    }
    if (created.length>0) setBuses(prev=>[...prev, ...created])
    setAddingBus(false)
  }

  async function addBeginnerLoadPack() {
    const pack = BEGINNER_LOAD_PACK.filter(load=>!loads.some(existing=>existing.toTag===load.toTag))
    if(pack.length===0) return alert('기본 부하 템플릿이 이미 추가되어 있습니다')
    const created: Load[] = []
    for (const template of pack) {
      const payload = {...template, sortOrder: loads.length + created.length + 1}
      const res = await fetch(`/api/loads/${id}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.id) created.push({...payload, id:data.id, projectId:id})
    }
    if (created.length>0) setLoads(prev=>[...prev, ...created])
  }

  async function deleteBus(busId:string) {
    await fetch(`/api/buses/${id}/${busId}`,{method:'DELETE'})
    setBuses(prev=>prev.filter(b=>b.id!==busId))
  }

  async function runCalc() {
    setCalcLoading(true)
    try {
      const res = await fetch(`/api/calculate/${id}`,{method:'POST'})
      const data = await res.json()
      if(data.result) {
        setCalcResult(data.result)
        setSldXml(data.sldXml||'')
        setCalcAt(new Date().toLocaleString('ko-KR'))
        setTab(2)
      }
    } catch(e) { alert('계산 오류: '+e) }
    setCalcLoading(false)
  }

  function downloadSLD() {
    if(!sldXml) return
    const hull = project?.hullNo||'SLD'
    const dt = new Date().toISOString().slice(0,10)
    const blob = new Blob([sldXml],{type:'application/xml'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`SLD_${hull}_${dt}.drawio`
    a.click(); URL.revokeObjectURL(url)
  }

  function exportCsv() {
    const hdr = 'CircuitNo,Name,FromBus,ToTag,kW,PF,Eff,Priority,StartType,DFsea,DFarrival,DFwork,DFharbor,DFemg,Phase,Emergency,Battery,CableLen,Location,Notes'
    const rows = loads.map(l=>[
      l.circuitNo,l.name,l.fromBus,l.toTag,
      l.kw,l.pf,l.efficiency,l.priority,l.startType,
      l.dfSea??l.demandFactor,l.dfArrival??'',l.dfWork??0,l.dfHarbor??'',l.dfEmg??0,
      l.phase,l.isEmergency?'Y':'N',l.isBattery?'Y':'N',
      l.cableLength,l.location,l.notes
    ].join(','))
    const csv = [hdr,...rows].join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`loads_${project?.hullNo||id}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  /** Excel 템플릿 다운로드 */
  async function downloadExcelTemplate() {
    const { downloadLoadTemplate } = await import('@/lib/excel')
    downloadLoadTemplate()
  }

  /** Excel 업로드 → 부하 일괄 import */
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if(!file) return
    const { parseLoadFile } = await import('@/lib/excel')
    try {
      const { loads: parsed, errors } = await parseLoadFile(file)
      if(parsed.length === 0) {
        alert('업로드된 파일에서 유효한 부하 데이터를 찾을 수 없습니다.\n헤더가 "회로번호, 부하명, 전원출처, ..." 로 시작해야 합니다.')
        e.target.value = ''
        return
      }
      const errMsg = errors.length ? `\n\n경고 (${errors.length}건):\n${errors.slice(0,5).join('\n')}${errors.length>5?`\n...외 ${errors.length-5}건`:''}` : ''
      const replace = confirm(
        `엑셀 파일에서 ${parsed.length}개의 부하를 불러왔습니다.${errMsg}\n\n` +
        `[확인] 기존 부하를 모두 삭제하고 교체\n` +
        `[취소] 기존 부하 유지하고 추가만 수행`
      )
      if(replace) {
        for(const l of loads) await fetch(`/api/loads/${id}/${l.id}`,{method:'DELETE'})
      }
      const payload = parsed.map(({_row,_errors,...rest}) => rest)
      const res = await fetch(`/api/loads/${id}?action=csv-import`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({loads: payload})
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error || '업로드 실패')
      // 부하 목록 재로드
      const r2 = await fetch(`/api/loads/${id}`)
      const d2 = await r2.json()
      setLoads(d2.loads || [])
      alert(`✅ ${parsed.length}개 부하가 업로드되었습니다.`)
    } catch(err) {
      alert('엑셀 파싱 오류: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      e.target.value = ''
    }
  }

  function exportBusSummaryCsv() {
    if(!calcResult?.busSummaries?.length) return
    const hdr = 'Tag,Name,Parent,Type,Voltage,LoadCount,DemandKW,DemandKVA,EmergencyKW,BatteryKW,CurrentA'
    const rows = calcResult.busSummaries.map(bus=>[
      bus.tag, bus.name, bus.parentTag, bus.type, bus.voltage, bus.loadCount,
      bus.demandKw.toFixed(2), bus.demandKva.toFixed(2), bus.emergencyKw.toFixed(2),
      bus.batteryKw.toFixed(2), bus.currentA.toFixed(2),
    ].join(','))
    const blob = new Blob([[hdr, ...rows].join('\n')],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bus_summary_${project?.hullNo||id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportShedPlanCsv() {
    if(!calcResult?.loadSheddingPlan?.length) return
    const hdr = 'CircuitNo,Name,Priority,FromBus,KWdemand,Selected,CumulativeKW'
    const rows = calcResult.loadSheddingPlan.map(item=>[
      item.circuitNo, item.name, item.priority, item.fromBus,
      item.kwDemand.toFixed(2), item.selected ? 'Y' : 'N', item.cumulativeKw.toFixed(2),
    ].join(','))
    const blob = new Blob([[hdr, ...rows].join('\n')],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `load_shedding_${project?.hullNo||id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if(loading) return <div className="empty"><div className="empty-icon">⏳</div>로딩 중...</div>
  if(loadError) return (
    <div className="empty">
      <div className="empty-icon">⚠️</div>
      <p style={{color:'var(--red)',marginBottom:12}}>{loadError}</p>
      <button className="btn bg" onClick={()=>loadAll()}>다시 시도</button>
    </div>
  )
  if(!project) return <div className="empty"><div className="empty-icon">❌</div>프로젝트를 찾을 수 없습니다</div>

  // 전원출처 자동완성: 버스 태그 + 다른 부하의 toTag (컨버터·변압기 등 중간장비 체인 지원)
  const equipTags = Array.from(new Set(loads.map(l=>l.toTag).filter(t=>!!t)))
  const busOptions = Array.from(new Set([
    ...buses.map(b=>b.tag),
    ...(project.hasEss ? ['ESS'] : []),
    ...equipTags.filter(t=>!buses.find(b=>b.tag===t)),
  ]))
  const emgLoads = loads.filter(l=>l.isEmergency)
  const r = calcResult
  const busSummaries = r?.busSummaries || []
  const chainChecks = r?.chainChecks || []
  const loadSheddingPlan = r?.loadSheddingPlan || []
  const coordinationHints = r?.coordinationHints || []
  const sourceStatuses = r?.sourceStatuses || []
  const tripRisks = r?.tripRisks || []
  const architectureRecommendations = r?.architectureRecommendations || []

  /* 하위 호환: hasDg 기본값 true */
  const hasDg   = project.hasDg   ?? true
  const hasEg   = project.hasEg   ?? false
  const hasEss  = project.hasEss  ?? false
  const hasFc   = project.hasFc   ?? false
  const hasPv   = project.hasPv   ?? false
  const hasShore= project.hasShore?? false
  const hasDc   = project.hasDc   ?? false

  /* 계통 설명 조합 */
  const activeSources = POWER_SOURCES.filter(s=>project[s.key])
  const systemDesc = activeSources.length>0
    ? activeSources.map(s=>s.label).join(' + ')
    : '전원 미선택'

  const lf = r ? r.loadFactorPct/100 : 0
  const batteryLoads = loads.filter(load=>load.isBattery)
  const largeStartingLoads = loads.filter(load=>['DOL','Y-D','A-T'].includes(load.startType) && load.kw>=30)
  const nonlinearLoads = loads.filter(load=>['VFD','DC','SSR'].includes(load.startType) || POWER_QUALITY_PATTERN.test(load.name))
  const rootBuses = buses.filter(bus=>!bus.parentTag)
  const integrationInputGuides: IntegrationGuide[] = [
    {
      title:'전원 구성',
      currentInput:`현재 선택 전원: ${activeSources.length>0 ? activeSources.map(source=>source.label).join(', ') : '없음'}`,
      editLocation:'계통 설정 > 전원 구성 선택',
      action:'DG, EG, ESS, FC, PV, Shore, DC 추진 중 실제 적용 전원을 먼저 켭니다. 이 선택이 통합전력 계산의 출발점입니다.',
      circuit:'전원 종류를 먼저 결정한 뒤 MSB, ESB, DC BUS 중 어느 버스에 연결할지 이어서 구성',
    },
    {
      title:'ESS / 배터리',
      currentInput:`배터리 체크 부하 ${batteryLoads.length}개, ESS 운전시간 ${project.operationHours}h, 백업시간 ${project.essBackupH}h`,
      editLocation:'계통 설정 > ESS / 배터리 설정, 부하 입력 > 배터리 체크',
      action:'배터리 체크 부하와 ESS 운전시간을 같이 잡아야 ESS 총용량, 기동보조, 피크컷 판단이 정확해집니다.',
      circuit:'ESS <-> PCS -> AC BUS 또는 DC BUS / 비상 또는 피크 보조 부하로 연결',
    },
    {
      title:'버스 계층',
      currentInput:`등록 버스 ${buses.length}개, 루트 버스 ${rootBuses.length}개 (${rootBuses.map(bus=>bus.tag).join(', ')||'없음'})`,
      editLocation:'계통 설정 > 버스 / 패널 등록',
      action:'MSB, ESB, MDP, LDP, NCP 같은 계층을 먼저 분리해야 통합전력 탭에서 버스별 역할과 보호 구분이 명확해집니다.',
      circuit:'MSB -> MDP/LDP / ESB -> NCP 같은 상하위 버스 구조를 먼저 구성',
    },
    {
      title:'부하 모델링',
      currentInput:`전체 부하 ${loads.length}개, 비상부하 ${emgLoads.length}개, 대형 기동부하 ${largeStartingLoads.length}개`,
      editLocation:'부하 입력 > fromBus / startType / priority / 비상 / 배터리',
      action:'통합전력 판단은 부하 kW보다도 연결 버스, 기동방식, 우선순위, 비상/배터리 체크에 크게 좌우됩니다.',
      circuit:'버스마다 어떤 부하가 붙는지, 대형 모터 앞단에 어떤 기동장치를 둘지 여기서 결정',
    },
  ]
  const tripRiskGuides = tripRisks.map(risk=>({
    risk,
    guide: buildTripRiskGuide({ risk, project, loads, result: r! }),
  }))
  const recommendationGuides = architectureRecommendations.map(item=>({
    item,
    guide: buildRecommendationGuide({ item, project, loads }),
  }))
  const architectureExamples = [
    hasDg && hasEss ? 'DG -> MSB / ESS <-> PCS <-> MSB : 평상시 DG가 Base, ESS가 Peak Shaving과 기동보조 담당' : '',
    hasFc ? 'FC -> DC/DC -> DC BUS / ESS <-> PCS -> DC BUS : FC는 안정출력, ESS는 피크 및 응답 보조' : '',
    hasEg || emgLoads.length>0 ? 'EG 또는 비상 ESS -> ESB -> NCP/FAS/비상조명 : 비상부하는 메인 작업부하와 분리' : '',
    hasDc ? 'AC BUS 또는 DC BUS -> Inverter/VFD -> 추진모터 : 추진부하는 메인 부하와 분리해 기동충격 완화' : '',
  ].filter(Boolean)

  /* ── 바인딩 모드 라벨 ── */
  const modeLabelMap: Record<string,string> = {SEA:'항해',ARRIVAL:'출입항',WORK:'하역',HARBOR:'정박',EMG:'비상'}

  return (
    <>
    {/* ── 헤더 ── */}
    <div className="hdr">
      <div>
        <div className="hdr-title">
          <button style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:20,padding:'0 4px'}}
            onClick={()=>router.push('/')}>←</button>
          🚢 {project.vesselName}
        </div>
        <div className="hdr-sub">
          {project.hullNo&&`Hull: ${project.hullNo}`}
          {project.projectNo&&` | ${project.projectNo}`}
          {` | ${project.classCode} | AC ${project.acVoltage}V ${project.frequency}Hz`}
          {hasDc&&` | DC ${project.dcVoltage}V`}
          {` | ${systemDesc}`}
        </div>
      </div>
      <div className="hdr-right">
        <div>
          <span className="hi-lbl">저장 상태</span>
          <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#fff'}}>
            <span className={`save-dot ${saveState==='idle'?'saved':saveState}`}/>
            {saveState==='saving'?'저장 중':saveState==='error'?'오류':saveState==='saved'?'저장됨':'자동저장'}
          </span>
        </div>
        <button className="btn bsm"
          style={{background:'rgba(255,255,255,.15)',color:'#fff',border:'1px solid rgba(255,255,255,.3)'}}
          onClick={runCalc} disabled={calcLoading}>
          {calcLoading?'계산 중...':'⚡ 계산 실행'}
        </button>
      </div>
    </div>

    <div className="page">
      {/* ── 탭바 ── */}
      <div className="tabs">
        {[
          ['⚙️ 계통 설정','시스템·버스'],
          ['📋 부하 입력',`${loads.length}개`],
          ['📊 계산 결과',r?'완료':'미실행'],
          ['🔋 통합 전력',r?'관제':'대기'],
          ['⚡ 전기 해석',r?'분석':'안내'],
          ['🗺️ SLD 생성',sldXml?'준비됨':'미생성'],
        ].map(([t,b],i)=>(
          <button key={i} className={`tab${tab===i?' on':''}`} onClick={()=>setTab(i)}>
            {t}<span className="tab-badge">{b}</span>
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════
          탭 0: 계통 설정
      ════════════════════════════════════ */}
      {tab===0 && (
        <>
        {/* ── 전원 구성 체크박스 ── */}
        <div className="card">
          <div className="card-title">⚡ 전원 구성 선택 (복수 선택 가능)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8}}>
            {POWER_SOURCES.map(src=>{
              const active = Boolean(project[src.key])
              return (
                <div key={src.key}
                  onClick={()=>saveProject({[src.key]:!active})}
                  style={{
                    padding:'12px 6px',borderRadius:10,cursor:'pointer',
                    border:`2px solid ${active?src.color:'var(--border)'}`,
                    background:active?src.bg:'#fff',
                    transition:'.2s',textAlign:'center',userSelect:'none',
                  }}>
                  <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
                    <input type="checkbox" checked={active} readOnly
                      style={{width:14,height:14,accentColor:src.color,cursor:'pointer'}}/>
                  </div>
                  <div style={{fontSize:20,marginBottom:3}}>{src.icon}</div>
                  <div style={{fontSize:11,fontWeight:800,color:active?src.color:'var(--text)'}}>{src.label}</div>
                  <div style={{fontSize:10,color:'var(--gray)',marginTop:2,lineHeight:1.3}}>{src.desc}</div>
                </div>
              )
            })}
          </div>
          {activeSources.length===0&&(
            <div className="sbar warn" style={{marginTop:12,marginBottom:0}}>
              전원을 하나 이상 선택하세요. 발전기·ESS·연료전지·PV·육전을 자유 조합할 수 있습니다.
            </div>
          )}
          {activeSources.length>0&&(
            <div className="sbar info" style={{marginTop:12,marginBottom:0}}>
              선택된 전원: <b>{systemDesc}</b>
            </div>
          )}
        </div>

        {/* ── 프로젝트 기본 정보 ── */}
        <div className="card">
          <div className="card-title">📋 프로젝트 기본 정보</div>
          <div className="g4">
            <div><label>선박명</label>
              <input type="text" value={project.vesselName}
                onChange={e=>saveProject({vesselName:e.target.value})}/></div>
            <div><label>Hull No.</label>
              <input type="text" value={project.hullNo}
                onChange={e=>saveProject({hullNo:e.target.value})}/></div>
            <div><label>Project No.</label>
              <input type="text" value={project.projectNo}
                onChange={e=>saveProject({projectNo:e.target.value})}/></div>
            <div><label>선급 (Classification)</label>
              <div style={{display:'flex',gap:6}}>
                <select style={{flex:'0 0 auto',width:110}}
                  value={CLASS_CODES.slice(0,-2).includes(project.classCode)?project.classCode:
                         project.classCode==='KOMSA'?'KOMSA':'기타'}
                  onChange={e=>{
                    if(e.target.value!=='기타') saveProject({classCode:e.target.value})
                    else saveProject({classCode:''})
                  }}>
                  {CLASS_CODES.map(c=><option key={c}>{c}</option>)}
                </select>
                {(!CLASS_CODES.slice(0,-2).includes(project.classCode)&&project.classCode!=='KOMSA')&&(
                  <input type="text" placeholder="직접 입력" value={project.classCode}
                    onChange={e=>saveProject({classCode:e.target.value})} style={{flex:1}}/>
                )}
              </div></div>
          </div>
        </div>

        {/* ── 전압 / 주파수 ── */}
        <div className="card">
          <div className="card-title">⚡ 전압 · 주파수</div>
          <div className="g4">
            <div><label>AC 버스 전압 (V)</label>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input type="number" value={project.acVoltage} min={100} max={15000} style={{flex:1}}
                  onChange={e=>saveProject({acVoltage:+e.target.value})}/>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  {[220,380,440,690].map(v=>(
                    <button key={v} onClick={()=>saveProject({acVoltage:v})}
                      style={{padding:'1px 6px',fontSize:10,border:'1px solid var(--border)',borderRadius:3,
                        cursor:'pointer',lineHeight:1.5,
                        background:project.acVoltage===v?'var(--blue)':'#f5f5f5',
                        color:project.acVoltage===v?'#fff':'var(--gray)'}}>
                      {v}V
                    </button>
                  ))}
                </div>
              </div></div>
            <div><label>주파수</label>
              <select value={project.frequency} onChange={e=>saveProject({frequency:+e.target.value})}>
                {FREQS.map(f=><option key={f} value={f}>{f}Hz</option>)}
              </select></div>
            <div><label>DC 버스 전압 (V)</label>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input type="number" value={project.dcVoltage} min={12} max={1500} style={{flex:1}}
                  onChange={e=>saveProject({dcVoltage:+e.target.value})}/>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  {[24,48,650,750].map(v=>(
                    <button key={v} onClick={()=>saveProject({dcVoltage:v})}
                      style={{padding:'1px 6px',fontSize:10,border:'1px solid var(--border)',borderRadius:3,
                        cursor:'pointer',lineHeight:1.5,
                        background:project.dcVoltage===v?'var(--red)':'#f5f5f5',
                        color:project.dcVoltage===v?'#fff':'var(--gray)'}}>
                      {v}V
                    </button>
                  ))}
                </div>
              </div></div>
            <div><label>설계 여유율 (%)</label>
              <input type="number" min={10} max={50} value={Math.round(project.designMargin*100)}
                onChange={e=>saveProject({designMargin:+e.target.value/100})}/>
              <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>KR 최소 25%</div></div>
          </div>
        </div>

        {/* ── 발전기 설정 (hasDg) ── */}
        {hasDg&&(
          <div className="card">
            <div className="card-title">⚙️ 디젤 발전기 설정</div>
            <div className="g4">
              <div><label>발전기 대수</label>
                <select value={project.dgCount} onChange={e=>saveProject({dgCount:+e.target.value})}>
                  {DG_COUNTS.map(n=><option key={n} value={n}>{n}대</option>)}
                </select>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>500톤이상: 최소 2대 (KR)</div></div>
              <div><label>발전기 역률 (PF)</label>
                <input type="number" min={0.7} max={1} step={0.01} value={project.dgPf}
                  onChange={e=>saveProject({dgPf:+e.target.value})}/></div>
              <div><label>과도 리액턴스 X&#34;d (pu)</label>
                <input type="number" min={0.05} max={0.35} step={0.01} value={project.dgXd||0.15}
                  onChange={e=>saveProject({dgXd:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>단락전류 계산 기준 (통상 0.15)</div></div>
              <div><label>설계 여유율 (%)</label>
                <input type="number" min={10} max={50} value={Math.round(project.designMargin*100)}
                  onChange={e=>saveProject({designMargin:+e.target.value/100})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>KR 최소 25%</div></div>
            </div>
          </div>
        )}

        {/* ── 비상 발전기 설정 (hasEg) ── */}
        {hasEg&&(
          <div className="card">
            <div className="card-title">🔴 비상 발전기 설정</div>
            <div className="g4">
              <div><label>설계 여유율 (%)</label>
                <input type="number" min={10} max={50} value={Math.round(project.designMargin*100)}
                  onChange={e=>saveProject({designMargin:+e.target.value/100})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>주발전기와 공용 (KR 최소 25%)</div></div>
              <div><label>기동 방식</label>
                <input type="text" readOnly value="자동기동 45초 이내"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
              <div><label>연료 탱크 용량</label>
                <input type="text" readOnly value="18시간 연속운전 (SOLAS)"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
              <div><label>적용 기준</label>
                <input type="text" readOnly value="SOLAS Reg. II-1/42~44"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
            </div>
            <div style={{marginTop:8,padding:'8px 10px',background:'#fff3cd',borderRadius:6,fontSize:11,color:'#856404'}}>
              💡 비상 발전기 용량은 부하 입력 탭에서 <strong>비상 체크된 부하</strong>의 수요 kVA 합산으로 자동 산정됩니다.
            </div>
          </div>
        )}

        {/* ── ESS 설정 (hasEss) ── */}
        {hasEss&&(
          <div className="card">
            <div className="card-title">🔋 ESS / 배터리 설정</div>
            <div className="g4">
              <div><label>비상 백업 시간 (h)</label>
                <input type="number" min={0.25} max={24} step={0.25} value={project.essBackupH}
                  onChange={e=>saveProject({essBackupH:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>비상부하 × 백업시간</div></div>
              <div><label>ESS 여유율 (%)</label>
                <input type="number" min={10} max={50} value={Math.round(project.essMargin*100)}
                  onChange={e=>saveProject({essMargin:+e.target.value/100})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>SOC 20~80% 기준, 최소 20%</div></div>
              <div><label>충전 가용시간 (h)</label>
                <input type="number" min={0.5} max={24} step={0.5} value={project.chargeHours}
                  onChange={e=>saveProject({chargeHours:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>충전기 kW 자동 산정</div></div>
              <div><label>ESS 운전 시간 (h)</label>
                <input type="number" min={0.5} max={24} step={0.5} value={project.operationHours}
                  onChange={e=>saveProject({operationHours:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>배터리 체크 부하의 운전 에너지 산정 기준</div></div>
            </div>
            <div className="sbar info" style={{marginTop:10,marginBottom:0}}>
              배터리 체크된 부하: <b>{loads.filter(l=>l.isBattery).length}개</b>
              {' '}| 체크된 부하는 ESS 총용량의 운전분으로 반영됩니다.
              {' '}| 순수 ESS 선박은 배터리 체크가 없어도 전체 부하를 ESS 운전 부하로 계산합니다.
            </div>
            {hasDg&&<>
              <div style={{fontSize:11,fontWeight:700,margin:'12px 0 6px',color:'var(--gray)'}}>피크컷 설정</div>
              <div className="g4">
                <div><label>피크컷 임계값 (%)</label>
                  <input type="number" min={50} max={95} step={5} value={project.essPeakThreshPct??75}
                    onChange={e=>saveProject({essPeakThreshPct:+e.target.value})}/>
                  <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>발전기 정격 대비, 초과분을 ESS 공급</div></div>
                <div><label>피크컷 지속시간 (분)</label>
                  <input type="number" min={5} max={60} step={5} value={project.essPeakDurMin??15}
                    onChange={e=>saveProject({essPeakDurMin:+e.target.value})}/>
                  <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>피크 지속시간 (통상 15~30분)</div></div>
              </div>
            </>}
            <div style={{marginTop:10}}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <input type="checkbox" checked={project.essSpinReserve??false}
                  onChange={e=>saveProject({essSpinReserve:e.target.checked})}/>
                <span style={{fontSize:12}}>기동보조(스피닝 리저브) — 발전기 기동 45초간 비상부하 공급</span>
              </label>
            </div>
          </div>
        )}

        {/* ── 연료전지 설정 (hasFc) ── */}
        {hasFc&&(
          <div className="card">
            <div className="card-title">⚗️ 수소연료전지 (FC) 설정</div>
            <div className="g4">
              <div><label>FC 스택 kW (0=자동산정)</label>
                <input type="number" min={0} step={5} value={project.fcStackKw}
                  onChange={e=>saveProject({fcStackKw:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>0 입력 시 총부하×1.1 자동</div></div>
              <div><label>FC 효율</label>
                <input type="text" readOnly value="55% (PEMFC 기준)"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
              <div><label>H₂ LHV</label>
                <input type="text" readOnly value="33.3 kWh/kg"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
              <div><label>적용 규정</label>
                <input type="text" readOnly value="IMO IGF Code 2015"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
            </div>
          </div>
        )}

        {/* ── 태양광 설정 (hasPv) ── */}
        {hasPv&&(
          <div className="card">
            <div className="card-title">☀️ 태양광 (PV) 설정</div>
            <div className="g4">
              <div><label>태양광 패널 (kWp)</label>
                <input type="number" min={0} step={1} value={project.pvKwp}
                  onChange={e=>saveProject({pvKwp:+e.target.value})}/></div>
              <div><label>일 평균 일조시간 (h)</label>
                <input type="number" min={1} max={12} step={0.5} value={project.pvSunHours}
                  onChange={e=>saveProject({pvSunHours:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>한국 평균: 3.5~4.5h</div></div>
              <div><label>시스템 효율</label>
                <input type="text" readOnly value="85% (음영·온도·인버터 손실)"
                  style={{background:'#f5f5f5',color:'var(--gray)'}}/></div>
              <div><label>일 발전량 (예상)</label>
                <input type="text" readOnly
                  value={project.pvKwp>0?`${(project.pvKwp*project.pvSunHours*0.85).toFixed(1)} kWh/day`:'kWp 입력 후 표시'}
                  style={{background:'#f5f5f5',fontWeight:700,color:'var(--teal)'}}/></div>
            </div>
          </div>
        )}

        {/* ── 전기추진 설정 (hasDc) ── */}
        {hasDc&&(
          <div className="card">
            <div className="card-title">🚀 전기추진 (DC Propulsion) 설정</div>
            <div className="g4">
              <div><label>추진모터 수량</label>
                <input type="number" min={1} max={4} value={project.motorCount}
                  onChange={e=>saveProject({motorCount:+e.target.value})}/></div>
              <div><label>추진모터 kW (대당)</label>
                <input type="number" min={10} value={project.motorKw}
                  onChange={e=>saveProject({motorKw:+e.target.value})}/></div>
              <div><label>ISO 변압기 kVA</label>
                <input type="number" min={0} value={project.isoKva}
                  onChange={e=>saveProject({isoKva:+e.target.value})}/></div>
              <div><label>추진 입력 역률 (AFE)</label>
                <input type="number" min={0.85} max={1} step={0.01} value={project.propPf||0.95}
                  onChange={e=>saveProject({propPf:+e.target.value})}/>
                <div style={{fontSize:10,color:'var(--gray)',marginTop:3}}>AFE: 0.97, 기본: 0.95</div></div>
            </div>
            <div className="sbar info" style={{marginTop:10,marginBottom:0}}>
              추진 입력 kW = 모터kW / (η_VFD×η_Motor) = {project.motorCount}대 × {project.motorKw}kW / (0.97×0.94) ≈ {(project.motorCount*project.motorKw/(0.97*0.94)).toFixed(0)} kW
            </div>
          </div>
        )}

        {/* ── 버스/패널 등록 ── */}
        <div className="card">
          <div className="card-title">🔌 버스 / 패널 등록</div>
          <div className="sbar info" style={{marginBottom:12}}>
            From(전원출처)에 사용할 버스·패널을 등록하세요. 상위 버스를 연결하면 버스별 부하집계와 계층 검토에 반영됩니다.
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            <button className="btn bg2 bsm" onClick={addBusTemplatePack} disabled={addingBus}>표준 버스 템플릿 추가</button>
          </div>
          <div className="tw" style={{marginBottom:14}}>
            <table>
              <thead><tr><th>태그</th><th>명칭</th><th>타입</th><th>상위 버스</th><th>전압</th><th>삭제</th></tr></thead>
              <tbody>
                {buses.map(b=>(
                  <tr key={b.id}>
                    <td style={{fontWeight:800,color:'var(--blue)'}}>{b.tag}</td>
                    <td style={{textAlign:'left'}}>
                      <input value={b.name} onChange={e=>updateBus(b.id,{name:e.target.value})}/>
                    </td>
                    <td>
                      <select value={b.type} onChange={e=>updateBus(b.id,{type:e.target.value as Bus['type']})}>
                        <option value="AC-BUS">AC-BUS</option>
                        <option value="DC-BUS">DC-BUS</option>
                        <option value="EMERGENCY">EMERGENCY</option>
                        <option value="PANEL">PANEL</option>
                      </select>
                    </td>
                    <td>
                      <select value={b.parentTag||''} onChange={e=>updateBus(b.id,{parentTag:e.target.value})}>
                        <option value="">ROOT</option>
                        {buses.filter(parent=>parent.tag!==b.tag).map(parent=>(
                          <option key={parent.id} value={parent.tag}>{parent.tag}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" value={b.voltage} onChange={e=>updateBus(b.id,{voltage:+e.target.value})}/>
                    </td>
                    <td>{b.tag!=='MSB'&&(
                      <button className="btn bd bsm" onClick={()=>deleteBus(b.id)}>🗑</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="g4">
            <div><label>태그</label>
              <input type="text" value={newBus.tag}
                onChange={e=>setNewBus(n=>({...n,tag:e.target.value.toUpperCase()}))} placeholder="MDP1"/></div>
            <div><label>명칭</label>
              <input type="text" value={newBus.name}
                onChange={e=>setNewBus(n=>({...n,name:e.target.value}))} placeholder="Main Dist. Panel 1"/></div>
            <div><label>타입</label>
              <select value={newBus.type} onChange={e=>setNewBus(n=>({...n,type:e.target.value as Bus['type']}))}>
                <option value="AC-BUS">AC 버스/패널</option>
                <option value="DC-BUS">DC 버스</option>
                <option value="EMERGENCY">비상 버스</option>
                <option value="PANEL">분전반</option>
              </select></div>
            <div><label>전압 (V)</label>
              <input type="number" value={newBus.voltage}
                onChange={e=>setNewBus(n=>({...n,voltage:+e.target.value}))}/></div>
            <div><label>상위 버스</label>
              <select value={newBus.parentTag} onChange={e=>setNewBus(n=>({...n,parentTag:e.target.value}))}>
                <option value="">ROOT</option>
                {buses.map(bus=><option key={bus.id} value={bus.tag}>{bus.tag}</option>)}
              </select></div>
          </div>
          <button className="btn bp bsm" style={{marginTop:10}} onClick={addBus} disabled={addingBus}>
            + 버스/패널 추가
          </button>
        </div>
        </>
      )}

      {/* ════════════════════════════════════
          탭 1: 부하 입력
      ════════════════════════════════════ */}
      {tab===1 && (
        <>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <button className="btn bp bsm" onClick={addLoad}>+ 부하 추가</button>
          <button className="btn bg2 bsm" onClick={addBeginnerLoadPack}>초보자 기본부하 추가</button>
          <button className="btn bsm"
            style={{background:'#fff3e0',color:'var(--orange)',border:'1px solid var(--orange3)'}}
            onClick={loadSample}>📦 샘플 (청항선 H-1041)</button>
          <div style={{display:'inline-flex',gap:0,border:'1px solid #00897b',borderRadius:6,overflow:'hidden'}}>
            <button className="btn bsm" style={{background:'#e0f2f1',color:'#00695c',border:'none',borderRight:'1px solid #00897b',borderRadius:0}} onClick={downloadExcelTemplate}>
              📑 엑셀 템플릿
            </button>
            <label className="btn bsm" style={{background:'#00897b',color:'#fff',border:'none',borderRadius:0,cursor:'pointer',margin:0}}>
              ⬆ 엑셀 업로드
              <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={handleExcelUpload} />
            </label>
          </div>
          <button className="btn bg2 bsm" onClick={exportCsv}>⬇ CSV</button>
          <div style={{marginLeft:'auto',fontSize:11,color:'var(--gray)'}}>
            총 {loads.length}개 | 비상 {emgLoads.length}개 | 배터리 {loads.filter(l=>l.isBattery).length}개 | 자동저장
          </div>
        </div>

        <div className="sbar info" style={{marginBottom:10,padding:'8px 12px'}}>
          <b>전원출처</b>: 버스 태그(MSB, ESB…) 또는 중간장비 태그 · 자동완성 지원 |
          <b> 5가지 수요율</b>: 항해/출입항/하역/정박/비상 (0~1) — 모든 값은 독립 수동 입력이며 빈칸은 해당 모드 0으로 계산 |
          <b>우선순위</b>: N-1 자동 부하차단 계획에 반영 |
          <b>비상체크</b>: 비상발전기 산정 포함 · 내화케이블(FD) 자동 적용 |
          <b>배터리체크</b>: ESS/배터리 공급 분류 및 ESS 운전용량 산정
        </div>

        <datalist id="bus-datalist">
          {busOptions.map(b=><option key={b} value={b}/>)}
        </datalist>

        {loads.length===0 ? (
          <div className="empty"><div className="empty-icon">📋</div>부하를 추가하거나 샘플 데이터를 불러오세요</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th style={{width:52}}>회로번호</th>
                  <th style={{width:130}}>부하명</th>
                  <th style={{width:80}}>전원출처</th>
                  <th style={{width:72}}>부하태그</th>
                  <th style={{width:50}}>용량(kW)</th>
                  <th style={{width:42}}>역률</th>
                  <th style={{width:42}}>효율</th>
                  <th style={{width:56}}>기동방식</th>
                  <th style={{width:46}} title="정상 항해 수요율">항해</th>
                  <th style={{width:44}} title="출입항 수요율 (0~1) — 직접 입력, 빈칸은 0으로 계산">출입항</th>
                  <th style={{width:44}} title="하역 수요율 (0~1) — Cargo Handling 모드">하역</th>
                  <th style={{width:44}} title="정박 수요율 (0~1) — 직접 입력, 빈칸은 0으로 계산">정박</th>
                  <th style={{width:40}} title="비상 수요율 (SOLAS 모드)">비상</th>
                  <th style={{width:40}}>위상</th>
                  <th style={{width:58}} title="자동 부하차단 우선순위">우선순위</th>
                  <th style={{width:40}} title="비상부하 여부">비상</th>
                  <th style={{width:40}} title="배터리/ESS 공급 여부">배터리</th>
                  <th style={{width:50}} title="케이블 길이(m)">케이블길이(m)</th>
                  <th style={{width:80}}>위치</th>
                  <th style={{width:80}}>비고</th>
                  <th style={{width:32}}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {loads.map(l=>(
                  <tr key={l.id} className={l.isEmergency?'row-emg':''}>
                    <td><input value={l.circuitNo}
                      onChange={e=>onLoadChange(l.id,'circuitNo',e.target.value)}
                      style={{textAlign:'center',fontWeight:700}}/></td>
                    <td><input value={l.name} onChange={e=>onLoadChange(l.id,'name',e.target.value)}/></td>
                    <td>
                      {busOptions.includes(l.fromBus) ? (
                        <select value={l.fromBus}
                          onChange={e=>{
                            if(e.target.value==='__custom__') onLoadChange(l.id,'fromBus','')
                            else onLoadChange(l.id,'fromBus',e.target.value)
                          }}
                          style={{color:'var(--blue)',fontWeight:700}}>
                          {busOptions.map(b=><option key={b} value={b}>{b}</option>)}
                          <option value="__custom__">직접입력...</option>
                        </select>
                      ) : (
                        <input value={l.fromBus}
                          onChange={e=>onLoadChange(l.id,'fromBus',e.target.value)}
                          onBlur={e=>{if(!e.target.value)onLoadChange(l.id,'fromBus',busOptions[0]||'MSB')}}
                          style={{color:'var(--blue)',fontWeight:700,width:'100%'}}
                          placeholder="태그 입력"/>
                      )}
                    </td>
                    <td><input value={l.toTag}
                      onChange={e=>onLoadChange(l.id,'toTag',e.target.value)}
                      style={{fontFamily:'Consolas,monospace',fontSize:11}}/></td>
                    <td><input type="number" value={l.kw} min={0} step={0.1}
                      onChange={e=>onLoadChange(l.id,'kw',+e.target.value)}/></td>
                    <td><input type="number" value={l.pf} min={0.5} max={1} step={0.01}
                      onChange={e=>onLoadChange(l.id,'pf',+e.target.value)}/></td>
                    <td><input type="number" value={l.efficiency} min={0.5} max={1} step={0.01}
                      onChange={e=>onLoadChange(l.id,'efficiency',+e.target.value)}/></td>
                    <td>
                      <select value={l.startType}
                        onChange={e=>onLoadChange(l.id,'startType',e.target.value as Load['startType'])}
                        style={l.startType==='N/A'?{color:'var(--gray)',fontStyle:'italic'}:{}}>
                        {START_TYPES.map(s=><option key={s} value={s}>{s==='N/A'?'N/A (해당없음)':s}</option>)}
                      </select>
                    </td>
                    {/* ── 수요율: 항해 / 출입항 / 하역 / 정박 / 비상 ─────── */}
                    <td>
                      <input type="number" value={l.dfSea??l.demandFactor} min={0} max={1} step={0.05}
                        onChange={e=>onLoadChange(l.id,'dfSea',+e.target.value)}
                        style={{color:'var(--blue)'}}
                        title="정상 항해 수요율"/>
                    </td>
                    <td>
                      <input type="number"
                        value={l.dfArrival ?? ''}
                        min={0} max={1} step={0.05}
                        placeholder="직접 입력"
                        onChange={e=>onLoadChange(l.id,'dfArrival', e.target.value==='' ? null : +e.target.value)}
                        style={{color:l.dfArrival==null?'var(--gray)':'#6a1b9a',fontStyle:l.dfArrival==null?'italic':'normal'}}
                        title={l.dfArrival==null ? '미입력 — 자동 계산하지 않음' : '출입항 수요율'}/>
                    </td>
                    <td>
                      <input type="number" value={l.dfWork??0} min={0} max={1} step={0.05}
                        onChange={e=>onLoadChange(l.id,'dfWork',+e.target.value)}
                        style={{color:'#e65100'}}
                        title="하역 수요율 (Cargo Handling)"/>
                    </td>
                    <td>
                      <input type="number"
                        value={l.dfHarbor ?? ''}
                        min={0} max={1} step={0.05}
                        placeholder="직접 입력"
                        onChange={e=>onLoadChange(l.id,'dfHarbor', e.target.value==='' ? null : +e.target.value)}
                        style={{color:l.dfHarbor==null?'var(--gray)':'var(--green)',fontStyle:l.dfHarbor==null?'italic':'normal'}}
                        title={l.dfHarbor==null ? '미입력 — 자동 계산하지 않음' : '정박 수요율'}/>
                    </td>
                    <td>
                      <input type="number" value={l.dfEmg??0} min={0} max={1} step={0.05}
                        onChange={e=>onLoadChange(l.id,'dfEmg',+e.target.value)}
                        style={{color:'var(--red)'}}
                        title="비상 수요율 (SOLAS)"/>
                    </td>
                    <td>
                      <select value={l.phase}
                        onChange={e=>onLoadChange(l.id,'phase',e.target.value as Load['phase'])}
                        style={l.phase==='N/A'?{color:'var(--gray)',fontStyle:'italic'}:{}}>
                        {PHASES.map(p=><option key={p} value={p}>{p==='N/A'?'N/A':p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={l.priority} onChange={e=>onLoadChange(l.id,'priority',e.target.value as Load['priority'])}>
                        {LOAD_PRIORITIES.map(priority=>(
                          <option key={priority.value} value={priority.value}>{priority.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <input type="checkbox" checked={l.isEmergency}
                        onChange={e=>onLoadChange(l.id,'isEmergency',e.target.checked)}
                        title="비상부하: EG 계산 포함, FD 내화케이블"/>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <input type="checkbox" checked={l.isBattery}
                        onChange={e=>onLoadChange(l.id,'isBattery',e.target.checked)}
                        title="배터리/ESS 공급 부하"/>
                    </td>
                    <td><input type="number" value={l.cableLength||0} min={0} step={1}
                      onChange={e=>onLoadChange(l.id,'cableLength',+e.target.value)}
                      title="케이블 포설 길이 (m)"/></td>
                    <td><input value={l.location||''} onChange={e=>onLoadChange(l.id,'location',e.target.value)}/></td>
                    <td><input value={l.notes||''} onChange={e=>onLoadChange(l.id,'notes',e.target.value)}/></td>
                    <td>
                      <button className="btn bd bsm" style={{padding:'2px 5px'}}
                        onClick={()=>deleteLoad(l.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tf">
                  <td colSpan={4}>합 계</td>
                  <td>{loads.reduce((s,l)=>s+l.kw,0).toFixed(1)} kW</td>
                  <td colSpan={14}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div style={{marginTop:14,textAlign:'center'}}>
          <button className="btn bg blg" onClick={runCalc} disabled={calcLoading||loads.length===0}>
            {calcLoading?'⏳ 계산 중...':'⚡ 계산 실행 → 결과 보기'}
          </button>
        </div>
        </>
      )}

      {/* ════════════════════════════════════
          탭 2: 계산 결과
      ════════════════════════════════════ */}
      {tab===2 && (
        <>
        {!r ? (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <p>아직 계산이 실행되지 않았습니다.</p>
            <button className="btn bg" style={{marginTop:14}} onClick={runCalc} disabled={calcLoading}>
              {calcLoading?'계산 중...':'⚡ 계산 실행'}
            </button>
          </div>
        ) : (
          <>
          {calcAt&&<div className="sbar ok" style={{marginBottom:12}}>
            ✅ 마지막 계산: {calcAt} | {systemDesc}
          </div>}

          {/* ── 3모드 비교 테이블 ── */}
          {r.modes&&r.modes.length>0&&(
            <div className="card">
              <div className="card-title">📊 운전 모드별 계산 결과 (5-Mode Comparison)</div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>항목</th>
                      {r.modes.map((m:ModeResult)=>(
                        <th key={m.mode} style={{
                          background:m.mode==='SEA'?'#1565c0':m.mode==='ARRIVAL'?'#6a1b9a':m.mode==='WORK'?'#e65100':m.mode==='HARBOR'?'#2e7d32':'#c62828'
                        }}>
                          {m.mode==='SEA'?'⚓ 항해(SEA)':m.mode==='ARRIVAL'?'↔ 출입항(ARRIVAL)':m.mode==='WORK'?'⚙ 하역(WORK)':m.mode==='HARBOR'?'⚑ 정박(HARBOR)':'🆘 비상(EMG)'}
                          {r.bindingMode===m.mode&&<span style={{display:'block',fontSize:10}}>★ 결정모드</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['수요 kW', (m:ModeResult)=>`${m.totKwDemand?.toFixed(1)||m.totKwAll?.toFixed(1)||'0.0'} kW`],
                      ['수요 kVA', (m:ModeResult)=>`${(m.totKvaDemand??0).toFixed(1)} kVA`],
                      ['평균 역률', (m:ModeResult)=>`${((m.avgPf??0)*100).toFixed(1)}%`],
                      ['필요 kVA (여유포함)', (m:ModeResult)=>`${(m.reqKva??0).toFixed(0)} kVA`],
                      ['선정 kVA', (m:ModeResult)=>`${m.selKva??0} kVA`],
                      ['선정 kW', (m:ModeResult)=>`${(m.selKw??0).toFixed(0)} kW`],
                      ['부하율', (m:ModeResult)=>`${(m.loadFactorPct??0).toFixed(1)}%`],
                    ].map(([lbl,fn])=>(
                      <tr key={String(lbl)}>
                        <td style={{textAlign:'left',fontWeight:700,color:'var(--gray)'}}>{String(lbl)}</td>
                        {r.modes.map((m:ModeResult)=>(
                          <td key={m.mode} style={{
                            fontWeight:r.bindingMode===m.mode?800:400,
                            color:r.bindingMode===m.mode?'var(--blue)':'inherit'
                          }}>
                            {(fn as (m:ModeResult)=>string)(m)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sbar info" style={{marginTop:10,marginBottom:0}}>
                결정 모드: <b>{modeLabelMap[r.bindingMode]||r.bindingMode}</b> 모드가 최대 kVA로 발전기 선정 기준이 됩니다.
              </div>
            </div>
          )}

          {/* ── 요약 카드 ── */}
          <div className="g4" style={{marginBottom:14}}>
            {hasDg&&<>
              <div className="rc bl">
                <div className="rl">주 발전기 선정 용량</div>
                <div className="rv">{r.selKva} kVA</div>
                <div className="rd">{(r.selKw??0).toFixed(0)} kW × {project.dgCount}대<br/>필요: {(r.reqKva??0).toFixed(0)} kVA</div>
                <div className="pbar" style={{marginTop:8}}>
                  <div className="pfill" style={{width:`${Math.min(lf*100,100)}%`,background:'var(--blue)'}}/>
                </div>
                <div className="rd" style={{marginTop:3}}>부하율 {(lf*100).toFixed(1)}%</div>
              </div>
            </>}

            {hasEg&&<div className="rc og">
              <div className="rl">비상 발전기</div>
              <div className="rv og">{r.egSelKva>0?`${r.egSelKva} kVA`:'미산정'}</div>
              <div className="rd">
                비상 수요: {r.emgKwDemand?.toFixed(1)||'0.0'} kW<br/>
                필요: {r.egReqKva?.toFixed(0)||'0'} kVA (SOLAS)
              </div>
            </div>}

            {hasEss&&<div className="rc gn">
              <div className="rl">ESS 총 용량</div>
              <div className="rv gn">{(r.essTotalKwh??0).toFixed(0)} kWh</div>
              <div className="rd">
                {(r.battEssKwh??0)>0&&<>배터리 운전분: {(r.battEssKwh??0).toFixed(1)} kWh ({r.batteryLoadCount??0}개 / {(r.batteryLoadKw??0).toFixed(1)} kW)<br/></>}
                비상백업: {(r.essBackupKwh??0).toFixed(1)} kWh<br/>
                피크컷: {(r.essPeakKwh??0).toFixed(1)} kWh
                {(r.essPeakThreshKw??0)>0&&<> (임계 {(r.essPeakThreshKw??0).toFixed(0)} kW)</>}<br/>
                {(r.essSpinKwh??0)>0&&<>기동보조: {((r.essSpinKwh??0)*1000).toFixed(0)} Wh<br/></>}
                충전기: {r.chargeKw} kW<br/>
                여유율 포함: {Math.round(project.essMargin*100)}%
              </div>
            </div>}

            {hasFc&&<div className="rc tl">
              <div className="rl">연료전지 스택</div>
              <div className="rv" style={{color:'var(--teal)'}}>{(r.fcStackKw??0).toFixed(0)} kW</div>
              <div className="rd">H₂: {(r.h2ConsKgH??0).toFixed(2)} kg/h<br/>탱크: {r.h2TankKg??0} kg</div>
            </div>}

            {hasPv&&<div className="rc og">
              <div className="rl">태양광 일 발전량</div>
              <div className="rv og">{(r.pvGenKwhDay??0).toFixed(1)} kWh</div>
              <div className="rd">{project.pvKwp} kWp × {project.pvSunHours}h × 85%<br/>
                {(r.pvDeficitKwh??0)>0?<span style={{color:'var(--red)'}}>부족 {(r.pvDeficitKwh??0).toFixed(1)} kWh</span>:'충분'}
              </div>
            </div>}

            {hasShore&&<div className="rc bl">
              <div className="rl">육전 용량</div>
              <div className="rv">{r.shoreKva} kVA</div>
              <div className="rd">총수요 {(r.totKvaDemand??0).toFixed(0)} kVA<br/>여유 {(project.designMargin*100).toFixed(0)}% 포함</div>
            </div>}

            <div className="rc pp">
              <div className="rl">평균 역률 (항해)</div>
              <div className="rv pp">{(r.avgPf*100).toFixed(1)}%</div>
              <div className="rd">수요 kW: {r.totKwDemand.toFixed(1)}<br/>수요 kVA: {r.totKvaDemand.toFixed(1)}</div>
            </div>
          </div>

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">🧭 버스 계층 요약 / 체인 검증</div>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <button className="btn bg2 bsm" onClick={exportBusSummaryCsv}>버스 요약 CSV</button>
              <button className="btn bo bsm" onClick={exportShedPlanCsv}>부하차단 계획 CSV</button>
            </div>
            <div className="tw" style={{marginBottom:12}}>
              <table>
                <thead>
                  <tr>
                    <th>버스</th><th>상위</th><th>타입</th><th>부하수</th>
                    <th>수요 kW</th><th>수요 kVA</th><th>비상 kW</th><th>배터리 kW</th><th>전류 A</th>
                  </tr>
                </thead>
                <tbody>
                  {busSummaries.map(bus=>(
                    <tr key={bus.tag}>
                      <td style={{fontWeight:700,color:'var(--blue)'}}>{bus.tag}</td>
                      <td>{bus.parentTag||'ROOT'}</td>
                      <td><span className="bge norm-badge">{bus.type}</span></td>
                      <td>{bus.loadCount}</td>
                      <td>{bus.demandKw.toFixed(1)}</td>
                      <td>{bus.demandKva.toFixed(1)}</td>
                      <td>{bus.emergencyKw.toFixed(1)}</td>
                      <td>{bus.batteryKw.toFixed(1)}</td>
                      <td>{bus.currentA.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>회로번호</th><th>부하명</th><th>전원체인</th><th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {chainChecks.map(check=>(
                    <tr key={check.loadId}>
                      <td style={{fontWeight:700}}>{check.circuitNo}</td>
                      <td style={{textAlign:'left'}}>{check.name}</td>
                      <td style={{textAlign:'left',fontFamily:'Consolas,monospace',fontSize:11}}>{check.path.join(' -> ')}</td>
                      <td><span className={`bge ${check.status==='ORPHAN'||check.status==='LOOP'?'err':'ok'}`}>{check.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── N-1 이중화 검토 ── */}
          {hasDg&&project.dgCount>1&&(
            <div className="card" style={{border:`2px solid ${r.n1Ok?'var(--green)':'var(--red)'}`}}>
              <div className="card-title" style={{color:r.n1Ok?'var(--green)':'var(--red)'}}>
                {r.n1Ok?'✅':'❌'} N-1 이중화 검토 (KR 권장)
              </div>
              <div className="g4">
                <div className="rc" style={{background:r.n1Ok?'var(--green2)':'#ffebee'}}>
                  <div className="rl">N-1 시 부하율</div>
                  <div className="rv" style={{color:r.n1Ok?'var(--green)':'var(--red)'}}>{r.n1LoadFactorPct>=999?'—':r.n1LoadFactorPct.toFixed(1)+'%'}</div>
                  <div className="rd">기준: 100% 이하</div>
                </div>
                <div className="rc bl">
                  <div className="rl">발전기 구성</div>
                  <div className="rv">{project.dgCount}대</div>
                  <div className="rd">N-1 = {project.dgCount-1}대 운전</div>
                </div>
                <div className="rc" style={{background:r.n1Ok?'var(--green2)':'#ffebee'}}>
                  <div className="rl">N-1 판정</div>
                  <div className="rv" style={{color:r.n1Ok?'var(--green)':'var(--red)',fontSize:20}}>
                    {r.n1Ok?'PASS':'FAIL'}
                  </div>
                  <div className="rd">{r.n1Ok?'이중화 기준 충족':'차단 필요 kW: '+r.n1ShedKw.toFixed(0)+'kW'}</div>
                </div>
                {!r.n1Ok&&<div className="rc" style={{background:'#ffebee'}}>
                  <div className="rl" style={{color:'var(--red)'}}>부하 차단 필요</div>
                  <div className="rv" style={{color:'var(--red)'}}>{r.n1ShedKw.toFixed(0)} kW</div>
                  <div className="rd">Load Shedding 계획 필요</div>
                </div>}
              </div>
            </div>
          )}

          {/* ── 경고 ── */}
          {r.warnings&&r.warnings.length>0&&(
            <div className="card" style={{marginBottom:14}}>
              <div className="card-title">⚠️ 설계 검토 항목</div>
              <div className="warn-list">
                {r.warnings.map((w,i)=>(
                  <div key={i} className={`warn-item ${w.type==='ERROR'?'E':'W'}`}>
                    <span>{w.type==='ERROR'?'🔴':'🟡'}</span>
                    <span><b>[{w.code}]</b> {w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 부하별 상세 ── */}
          <div className="card">
            <div className="card-title">📋 부하별 상세 계산 결과</div>
            {/* 계산식 안내 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12,fontSize:11.5}}>
              <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:6,padding:'8px 12px',lineHeight:1.8}}>
                <b style={{color:'#2e7d32'}}>① 정격전류 (In)</b><br/>
                <span style={{fontFamily:'monospace'}}>
                  3상: In = kW×1000 / (√3×V×PF×η)<br/>
                  단상: In = kW×1000 / (V×PF×η)
                </span><br/>
                <span style={{color:'var(--gray)'}}>→ 케이블 선정, MCCB 설정 기준</span>
              </div>
              <div style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:6,padding:'8px 12px',lineHeight:1.8}}>
                <b style={{color:'#e65100'}}>② 기동전류 (Ist)</b><br/>
                <span style={{fontFamily:'monospace'}}>
                  Ist = In × 배율 (DOL:7 / Y-D:2.5 / SSR:3.5 / VFD:1.5)<br/>
                  기동kVA = Ist × √3 × V / 1000
                </span><br/>
                <span style={{color:'var(--gray)'}}>→ 전압강하·MCCB 순시트립 설정 기준</span>
              </div>
              <div style={{background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:6,padding:'8px 12px',lineHeight:1.8}}>
                <b style={{color:'#1565c0'}}>③ 수요 kW / kVA</b><br/>
                <span style={{fontFamily:'monospace'}}>
                  kW_demand = kW × DF (수요율)<br/>
                  kVA_demand = kW_demand / PF
                </span><br/>
                <span style={{color:'var(--gray)'}}>→ 발전기 용량 산정 기준 합계</span>
              </div>
              <div style={{background:'#f3e5f5',border:'1px solid #ce93d8',borderRadius:6,padding:'8px 12px',lineHeight:1.8}}>
                <b style={{color:'#6a1b9a'}}>④ 발전기 용량</b><br/>
                <span style={{fontFamily:'monospace'}}>
                  필요kVA = Σ(kVA_demand) × (1 + 여유율)<br/>
                  → 표준 kVA 계열로 올림 (ISO 8528-1)
                </span><br/>
                <span style={{color:'var(--gray)'}}>여유율 KR 최소 25% | 부하율 25~90%</span>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>회로번호</th><th>부하명</th><th>전원출처</th>
                    <th>용량(kW)</th><th>연결(kVA)</th>
                    <th>항해수요율</th><th>수요(kW)</th><th>수요(kVA)</th>
                    <th>정격전류(A)</th><th>차단기(MCCB)</th><th>케이블</th><th>우선순위</th>
                    <th>전압강하(%)</th><th>비상</th><th>배터리</th>
                  </tr>
                </thead>
                <tbody>
                  {r.loads.map(l=>(
                    <tr key={l.id} className={l.isEmergency?'row-emg':''}>
                      <td style={{fontWeight:700}}>{l.circuitNo}</td>
                      <td style={{textAlign:'left'}}>{l.name}</td>
                      <td style={{fontWeight:700,color:'var(--blue)',fontSize:11}}>{l.fromBus}</td>
                      <td>{l.kw.toFixed(1)}</td>
                      <td>{l.kvaConn.toFixed(1)}</td>
                      <td style={{color:'var(--blue)'}}>{(l.dfSea??l.demandFactor).toFixed(2)}</td>
                      <td style={{fontWeight:700}}>{l.kwDemand.toFixed(1)}</td>
                      <td style={{fontWeight:700}}>{l.kvaDemand.toFixed(1)}</td>
                      <td style={{fontWeight:700,color:'var(--blue)'}}>{l.currentA.toFixed(1)}</td>
                      <td>
                        <span className={`bge ${l.mccbOk!==false?'norm-badge':'emg-badge'}`}>
                          {l.mccbFrame}/{l.mccbSet}A
                        </span>
                      </td>
                      <td>
                        <span className="bge" style={{background:'#f3e5f5',color:'var(--purple)'}}>
                          {l.cableCode}
                        </span>
                      </td>
                      <td>{LOAD_PRIORITIES.find(priority=>priority.value===l.priority)?.label || l.priority}</td>
                      <td style={{color:l.voltageDropOk===false?'var(--red)':'inherit'}}>
                        {l.voltageDrop>0?`${l.voltageDrop.toFixed(1)}%`:'-'}
                      </td>
                      <td>{l.isEmergency?<span className="bge emg-badge">EMG</span>:'-'}</td>
                      <td>{l.isBattery?<span className="bge" style={{background:'#e3f2fd',color:'#1565c0'}}>🔋</span>:'-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="tf">
                    <td colSpan={3}>합 계</td>
                    <td>{r.loads.reduce((s,l)=>s+l.kw,0).toFixed(1)}</td>
                    <td>{r.loads.reduce((s,l)=>s+l.kvaConn,0).toFixed(1)}</td>
                    <td>-</td>
                    <td>{r.totKwDemand.toFixed(1)}</td>
                    <td>{r.totKvaDemand.toFixed(1)}</td>
                    <td colSpan={7}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── 타입별 상세 ── */}
          <div className="g2" style={{gap:14}}>
            {hasDg&&<div className="card">
              <div className="card-title">⚙️ 발전기 용량 산정 상세</div>
              <table className="detail-table">
                <tbody>
                  <tr><td>총 수요 kW</td><td>{r.totKwDemand.toFixed(1)} kW</td></tr>
                  <tr><td>총 수요 kVA</td><td>{r.totKvaDemand.toFixed(1)} kVA</td></tr>
                  <tr><td>설계 여유율</td><td>{(project.designMargin*100).toFixed(0)}% (KR 최소 25%)</td></tr>
                  <tr><td>필요 kVA</td><td>{r.reqKva.toFixed(1)} kVA</td></tr>
                  <tr className="sel-row"><td>선정 kVA (표준 계열)</td><td>{r.selKva} kVA</td></tr>
                  <tr><td>선정 kW</td><td>{r.selKw.toFixed(0)} kW × {project.dgCount}대</td></tr>
                  <tr><td>주발전기 ACB</td><td>{r.genAcbA} A</td></tr>
                  <tr><td>결정 모드</td><td>{modeLabelMap[r.bindingMode]||r.bindingMode}</td></tr>
                  <tr><td>부하율</td>
                    <td style={{color:lf>0.9?'var(--red)':lf<0.25?'var(--orange)':'var(--green)'}}>
                      {(lf*100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>}

            <div className="card">
              <div className="card-title">🔴 비상 부하 요약</div>
              <table className="detail-table">
                <tbody>
                  <tr><td>비상 부하 수</td><td>{emgLoads.length}개</td></tr>
                  <tr><td>비상 수요 kW</td><td>{r.emgKwDemand?.toFixed(1)||'0.0'} kW</td></tr>
                  <tr><td>비상 수요 kVA</td><td>{(r.emgKvaDemand||0).toFixed(1)} kVA</td></tr>
                  {hasEg&&<>
                    <tr><td>적용 기준</td><td>SOLAS Reg.II-1/42</td></tr>
                    <tr><td>기동 시간</td><td>45초 이내 (KR 선급)</td></tr>
                    <tr className="sel-row"><td>비상발전기</td>
                      <td>{r.egSelKva>0?`${r.egSelKva} kVA`:'미포함'}</td>
                    </tr>
                  </>}
                  {hasEss&&<>
                    <tr><td>ESS 총 용량</td><td><b>{r.essTotalKwh.toFixed(0)} kWh</b></td></tr>
                    {r.battEssKwh>0&&<tr><td>　배터리 운전분</td><td>{r.battEssKwh.toFixed(1)} kWh ({r.batteryLoadCount}개 / {r.batteryLoadKw.toFixed(1)} kW, {project.operationHours}h)</td></tr>}
                    <tr><td>　비상백업</td><td>{r.essBackupKwh.toFixed(1)} kWh ({project.essBackupH}h)</td></tr>
                    <tr><td>　피크컷</td><td>{r.essPeakKwh.toFixed(1)} kWh ({project.essPeakDurMin??15}분)</td></tr>
                    {r.essSpinKwh>0&&<tr><td>　기동보조</td><td>{(r.essSpinKwh*1000).toFixed(0)} Wh (45초)</td></tr>}
                    <tr><td>충전기 용량</td><td>{r.chargeKw} kW</td></tr>
                  </>}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{textAlign:'center',marginTop:14,display:'flex',gap:10,justifyContent:'center'}}>
            <button className="btn bp" onClick={()=>setTab(3)}>🔋 통합 전력 보기 →</button>
            <button className="btn bg" onClick={()=>setTab(4)}>⚡ 전기 해석 보기 →</button>
          </div>
          </>
        )}
        </>
      )}

      {/* ════════════════════════════════════
          탭 3: 통합 전력
      ════════════════════════════════════ */}
      {tab===3 && (
        <>
        {!r ? (
          <div className="empty">
            <div className="empty-icon">🔋</div>
            <p>계산을 먼저 실행하면 전원 통합 운전과 트립 위험, 권장 회로 구성이 표시됩니다.</p>
            <button className="btn bg" style={{marginTop:14}} onClick={runCalc} disabled={calcLoading}>
              {calcLoading?'계산 중...':'⚡ 계산 실행'}
            </button>
          </div>
        ) : (
          <>
          <div className="sbar ok" style={{marginBottom:12}}>
            ✅ 통합 전력 분석 완료 | 전원 역할, 트립 위험, 권장 장비/회로 구성 반영
          </div>

          {/* Electric Load Balance 보고서 진입 카드 */}
          <div className="card" style={{background:'linear-gradient(135deg,#1565C0,#0D47A1)',color:'#FFF',border:'none',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{fontSize:32}}>📊</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,marginBottom:4}}>Electric Load Balance 운영성 검토 보고서</div>
                <div style={{fontSize:11.5,opacity:0.9,lineHeight:1.5}}>
                  5가지 운전조건(항해/출입항/하역/정박/비상)별 요구전력·부하율·리스크 분석
                  <br/>케미컬탱커 ELA 보고서 포맷 · 인쇄/PDF 출력 가능
                </div>
              </div>
              <a href={`/projects/${id}/report`} target="_blank" rel="noreferrer"
                style={{background:'#FFEB3B',color:'#263238',padding:'10px 20px',borderRadius:6,fontSize:14,fontWeight:800,textDecoration:'none',whiteSpace:'nowrap'}}>
                보고서 열기 →
              </a>
            </div>
          </div>

          <div className="sbar info" style={{marginBottom:12}}>
            이 탭은 <b>결과표</b>만 보는 화면이 아니라, <b>어디를 수정해야 현재 결과가 바뀌는지</b>를 같이 보여주는 가이드 화면입니다.
            먼저 아래 <b>입력 출처 / 수정 위치</b>를 보고, 그 다음 <b>리스크 상세</b>와 <b>권장 회로 구성</b> 순서로 확인하면 됩니다.
          </div>

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">🧭 입력 출처 / 수정 위치</div>
            <div className="g4">
              {integrationInputGuides.map((item,index)=>(
                <div key={index} className="rc" style={{background:'#fafcff',border:'1px solid #d6e4ff'}}>
                  <div className="rl">{item.title}</div>
                  <div className="rd" style={{marginTop:6,textAlign:'left'}}>
                    <b>현재 입력</b><br/>{item.currentInput}
                  </div>
                  <div className="rd" style={{marginTop:8,textAlign:'left'}}>
                    <b>수정 위치</b><br/>{item.editLocation}
                  </div>
                  <div className="rd" style={{marginTop:8,textAlign:'left'}}>
                    <b>해야 할 일</b><br/>{item.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {architectureExamples.length>0 && (
            <div className="card" style={{marginBottom:14}}>
              <div className="card-title">🗺️ 현재 프로젝트 기준 권장 회로 배치 예시</div>
              <div style={{display:'grid',gap:10}}>
                {architectureExamples.map((example,index)=>(
                  <div key={index} className="sbar info" style={{marginBottom:0,fontFamily:'Consolas,monospace',whiteSpace:'pre-wrap'}}>
                    {example}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">🔋 전원 통합 운전 현황</div>
            <div className="g4" style={{marginBottom:12}}>
              {sourceStatuses.map(source=>(
                <div key={source.key} className="rc" style={{background:source.status==='WARN'?'#fff3e0':source.status==='OFF'?'#f5f5f5':'var(--green2)'}}>
                  <div className="rl">{source.label}</div>
                  <div className="rv" style={{color:source.status==='WARN'?'var(--orange)':source.status==='OFF'?'var(--gray)':'var(--green)'}}>
                    {source.availableKw.toFixed(0)} kW
                  </div>
                  <div className="rd">
                    역할: {source.role}<br/>
                    분담: {source.assignedKw.toFixed(0)} kW | 예비: {source.reserveKw.toFixed(0)} kW
                  </div>
                </div>
              ))}
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>전원</th><th>역할</th><th>가용 kW</th><th>분담 kW</th><th>예비 kW</th><th>상태</th><th>비고</th><th>수정 위치</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStatuses.map(source=>(
                    <tr key={source.key}>
                      <td style={{fontWeight:700}}>{source.label}</td>
                      <td>{source.role}</td>
                      <td>{source.availableKw.toFixed(1)}</td>
                      <td>{source.assignedKw.toFixed(1)}</td>
                      <td>{source.reserveKw.toFixed(1)}</td>
                      <td><span className={`bge ${source.status==='OK'?'ok':source.status==='WARN'?'err':'norm-badge'}`}>{source.status}</span></td>
                      <td style={{textAlign:'left'}}>{source.note}</td>
                      <td style={{textAlign:'left'}}>
                        <b>{buildSourceConfigGuide(source).editLocation}</b><br/>
                        <span style={{color:'var(--gray)'}}>{buildSourceConfigGuide(source).action}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sbar info" style={{marginTop:10,marginBottom:0}}>
              전원 표에서 <b>예비 kW</b>가 작거나 <b>WARN</b>이 뜨면, 오른쪽 <b>수정 위치</b> 열에 나온 탭으로 가서 값을 먼저 조정하면 됩니다.
            </div>
          </div>

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">🚨 트립 위험 / 통합 운전 리스크</div>
            {tripRisks.length===0 ? (
              <div className="sbar ok" style={{marginBottom:0}}>
                현재 계산 기준으로 치명적인 통합 운전 리스크는 크지 않습니다.
              </div>
            ) : (
              <div className="warn-list">
                {tripRisks.map((risk,index)=>(
                  <div key={index} className={`warn-item ${risk.severity==='HIGH'?'E':'W'}`}>
                    <span>{risk.severity==='HIGH'?'🔴':risk.severity==='MEDIUM'?'🟠':'🟡'}</span>
                    <span>
                      <b>{risk.title}</b><br/>
                      {risk.message}<br/>
                      <span style={{color:'var(--gray)'}}>대응: {risk.mitigation}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {tripRiskGuides.length>0 && (
              <div style={{display:'grid',gap:12,marginTop:12}}>
                {tripRiskGuides.map(({risk,guide},index)=>(
                  <div key={index} style={{border:'1px solid #ffe0b2',background:'#fffaf3',borderRadius:12,padding:14}}>
                    <div style={{fontWeight:800,color:risk.severity==='HIGH'?'#b71c1c':risk.severity==='MEDIUM'?'#ef6c00':'#827717',marginBottom:8}}>
                      {risk.severity==='HIGH'?'🔴':risk.severity==='MEDIUM'?'🟠':'🟡'} {risk.title}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
                      <div className="sbar" style={{marginBottom:0,background:'#fff'}}>
                        <b>왜 떴는가</b><br/>{guide.currentInput}
                      </div>
                      <div className="sbar" style={{marginBottom:0,background:'#fff'}}>
                        <b>어디서 수정하나</b><br/>{guide.editLocation}
                      </div>
                      <div className="sbar" style={{marginBottom:0,background:'#fff'}}>
                        <b>무엇을 바꾸나</b><br/>{guide.action}
                      </div>
                      <div className="sbar" style={{marginBottom:0,background:'#fff',fontFamily:'Consolas,monospace',whiteSpace:'pre-wrap'}}>
                        <b>권장 회로</b><br/>{guide.circuit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">🧩 권장 장비 / 회로 구성</div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>분류</th><th>우선순위</th><th>권장안</th><th>설명</th><th>적용 장비</th><th>어디에 반영</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendationGuides.map(({item,guide},index)=>(
                    <tr key={index}>
                      <td><span className="bge norm-badge">{item.category}</span></td>
                      <td><span className={`bge ${item.priority==='HIGH'?'err':item.priority==='MEDIUM'?'norm-badge':'ok'}`}>{item.priority}</span></td>
                      <td style={{fontWeight:700,textAlign:'left'}}>{item.title}</td>
                      <td style={{textAlign:'left'}}>{item.detail}</td>
                      <td style={{textAlign:'left'}}>{item.equipment}</td>
                      <td style={{textAlign:'left'}}>{guide.editLocation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recommendationGuides.length>0 && (
              <div style={{display:'grid',gap:12,marginTop:12}}>
                {recommendationGuides.map(({item,guide},index)=>(
                  <div key={index} style={{border:'1px solid #d6e4ff',background:'#fafcff',borderRadius:12,padding:14}}>
                    <div style={{fontWeight:800,color:'#1565c0',marginBottom:8}}>
                      {item.title}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
                      <div className="sbar" style={{marginBottom:0,background:'#fff'}}>
                        <b>현재 기준</b><br/>{guide.currentInput}
                      </div>
                      <div className="sbar" style={{marginBottom:0,background:'#fff'}}>
                        <b>어디에 반영하나</b><br/>{guide.editLocation}
                      </div>
                      <div className="sbar" style={{marginBottom:0,background:'#fff'}}>
                        <b>권장 조치</b><br/>{guide.action}
                      </div>
                      <div className="sbar" style={{marginBottom:0,background:'#fff',fontFamily:'Consolas,monospace',whiteSpace:'pre-wrap'}}>
                        <b>권장 회로 배치</b><br/>{guide.circuit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="sbar info" style={{marginTop:10,marginBottom:0}}>
              이제는 권장안마다 <b>어디에서 값을 바꾸고</b>, <b>회로를 어떻게 구성해야 하는지</b>를 같이 확인할 수 있습니다.
            </div>
          </div>
          </>
        )}
        </>
      )}

      {/* ════════════════════════════════════
          탭 4: 전기 해석
      ════════════════════════════════════ */}
      {tab===4 && (
        <>
        {!r ? (
          <div>
            <div className="sbar info" style={{marginBottom:14}}>
              계산을 먼저 실행하면 상세 전기 해석 결과가 표시됩니다. 아래는 설계 가이드입니다.
            </div>
            {/* 가이드 패널 */}
            <div className="guide">
              <div className="guide-title">⚡ KR 선급 필수 전기 해석 항목</div>
              {[
                ['단락전류 분석','IEC 60909 기준. 주배전반 3상 단락전류 ≥ 차단기(MCCB) 차단 용량 확인'],
                ['전동기 기동 해석','최대 기동 시 주배전반 전압강하 ≤ 15% (KR 선급 Pt.4 Ch.2)'],
                ['전압 강하 분석','종단 전압강하 ΔV ≤ 5% (케이블 길이·단면적 기준)'],
                ['N-1 이중화 (Redundancy)','1대 탈락 시 나머지 발전기 부하율 ≤ 100%'],
                ['비상부하 확인 (SOLAS)','비상발전기 용량 ≥ 비상부하 × 1.25. 45초 내 자동 기동'],
              ].map(([t,d],i)=>(
                <div key={i} className="guide-step">
                  <div className="guide-num">{i+1}</div>
                  <div className="guide-txt"><b>{String(t)}</b><br/>{String(d)}</div>
                </div>
              ))}
            </div>
            <div style={{textAlign:'center',marginTop:14}}>
              <button className="btn bg blg" onClick={runCalc} disabled={calcLoading}>
                {calcLoading?'⏳ 계산 중...':'⚡ 계산 실행하여 전기 해석 보기'}
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="sbar ok" style={{marginBottom:12}}>
            ✅ 전기 해석 완료 | {calcAt}
          </div>

          {/* ── 단락전류 분석 ── */}
          <div className="card">
            <div className="card-title">⚡ 단락전류 분석 (Short Circuit Analysis)</div>
            <div className="g4">
              <div className="rc bl">
                <div className="rl">주배전반 3상 단락전류</div>
                <div className="rv">{r.iscBusKa?.toFixed(2)||'—'} kA</div>
                <div className="rd">과도리액턴스 = {project.dgXd||0.15} pu<br/>버스전압 = {project.acVoltage}V</div>
              </div>
              <div className="rc" style={{background:r.requiredBreakingKa>=r.iscBusKa?'var(--green2)':'#ffebee'}}>
                <div className="rl">차단기 필요 차단용량</div>
                <div className="rv" style={{color:r.requiredBreakingKa>=r.iscBusKa?'var(--green)':'var(--red)'}}>
                  {r.requiredBreakingKa?.toFixed(1)||'—'} kA
                </div>
                <div className="rd">IEC 60947 차단기 선정 기준<br/>
                  {r.requiredBreakingKa>=r.iscBusKa?'✅ 차단기 용량 충족':'❌ 차단 용량 부족'}
                </div>
              </div>
              <div className="rc pp">
                <div className="rl">발전기 과도 리액턴스</div>
                <div className="rv pp">{project.dgXd||0.15} pu</div>
                <div className="rd">단락전류 계산 기준값<br/>통상 0.12 ~ 0.20 pu</div>
              </div>
              <div className="rc bl">
                <div className="rl">AC 버스 전압</div>
                <div className="rv">{project.acVoltage} V</div>
                <div className="rd">{project.frequency}Hz, 3φ<br/>{project.classCode} 선급</div>
              </div>
            </div>
            <div style={{background:'#f0f4ff',border:'1px solid #c5d5f5',borderRadius:8,padding:'10px 14px',marginTop:10,fontSize:12,lineHeight:1.9}}>
              <b>📐 계산식 (IEC 60909 / KR 선급)</b><br/>
              <span style={{fontFamily:'monospace'}}>
                I"sc = S_gen × N / (√3 × V × X"d)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp; = {r.selKva} kVA × {project.dgCount}대 × 1000 / (√3 × {project.acVoltage}V × {project.dgXd||0.15} pu)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp; ≈ <b>{r.iscBusKa?.toFixed(2)||'—'} kA</b>
              </span><br/>
              <span style={{color:'var(--gray)'}}>X"d: 과도 리액턴스 — 발전기 단락 초기 수십ms 구간의 등가 리액턴스. 값이 작을수록 단락전류 큼. 통상 0.12~0.20 pu</span>
            </div>
          </div>

          {/* ── 전동기 기동 분석 ── */}
          <div className="card">
            <div className="card-title">🔄 전동기 기동 해석 (Motor Starting Analysis)</div>
            {/* 계산식 설명 */}
            <div style={{background:'#f0f4ff',border:'1px solid #c5d5f5',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,lineHeight:1.9}}>
              <b>📐 계산식 적용 흐름</b><br/>
              <span style={{fontFamily:'monospace',display:'block',marginTop:4}}>
                ① 정격전류: In = kW×1000 / (√3×V×PF×η) &nbsp;← 정상 운전 시 전류<br/>
                ② 기동전류: Ist = In × 기동배율 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ← DOL:7배 / Y-D:2.5배 / SSR:3.5배 / VFD:1.5배<br/>
                ③ 기동kVA: kVA_start = Ist × √3 × V / 1000 &nbsp;← 발전기에 걸리는 순간 충격<br/>
                ④ 전압강하: ΔV% = kVA_start / (kVA_gen × N / X"d) × 100 &nbsp;← KR 기준 ≤ 15%
              </span>
              <span style={{color:'var(--gray)'}}>케이블 선정·MCCB 설정은 정격전류(In) 기준. 기동전류는 전압강하·MCCB 순시트립 설정에만 사용.</span>
            </div>
            <div className="g4" style={{marginBottom:14}}>
              <div className="rc" style={{background:r.voltageDipOk?'var(--green2)':'#ffebee'}}>
                <div className="rl">최대 전압 강하</div>
                <div className="rv" style={{color:r.voltageDipOk?'var(--green)':'var(--red)'}}>
                  {r.voltageDipPct?.toFixed(1)||'—'}%
                </div>
                <div className="rd">기준: ≤ 15% (KR)<br/>{r.voltageDipOk?'✅ 적합':'❌ 부적합'}</div>
              </div>
              <div className="rc bl">
                <div className="rl">최대 기동 kVA</div>
                <div className="rv">{r.worstStartKva?.toFixed(0)||'—'} kVA</div>
                <div className="rd">{r.worstStartMotor||'—'}</div>
              </div>
              <div className="rc pp">
                <div className="rl">발전기 kVA (기준)</div>
                <div className="rv pp">{r.selKva} kVA</div>
                <div className="rd">전압강하 = 기동kVA / (발전기kVA × N / 과도리액턴스)</div>
              </div>
              <div className="rc" style={{background:'#f5f5f5'}}>
                <div className="rl">기동 방식별 배율</div>
                <div className="rv" style={{fontSize:12,color:'var(--gray)',lineHeight:1.9,fontWeight:400}}>
                  직입(DOL): 7배<br/>스타-델타(Y-D): 2.5배<br/>소프트스타터(SSR): 3.5배<br/>인버터(VFD): 1.5배
                </div>
              </div>
            </div>
            {/* 전동기별 기동 테이블 */}
            {r.loads.some(l=>l.kw>1&&l.startType!=='DC')&&(
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>회로번호</th><th>부하명</th><th>용량(kW)</th>
                      <th>기동방식</th><th>기동용량(kVA)</th><th>전압강하(%)</th><th>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.loads
                      .filter(l=>l.kw>1&&l.startType!=='DC'&&l.startKva>0)
                      .sort((a,b)=>b.startKva-a.startKva)
                      .slice(0,10)
                      .map(l=>{
                        const dipPct = r.selKva>0 ? (l.startKva/r.selKva)*100*(project.dgXd||0.15) : 0
                        const ok = dipPct<=15
                        return (
                          <tr key={l.id}>
                            <td style={{fontWeight:700}}>{l.circuitNo}</td>
                            <td style={{textAlign:'left'}}>{l.name}</td>
                            <td>{l.kw.toFixed(1)}</td>
                            <td><span className="bge norm-badge">{l.startType}</span></td>
                            <td style={{fontWeight:700}}>{l.startKva.toFixed(0)}</td>
                            <td style={{color:ok?'inherit':'var(--red)',fontWeight:ok?400:700}}>
                              {dipPct.toFixed(1)}%
                            </td>
                            <td><span className={`bge ${ok?'ok':'err'}`}>{ok?'적합':'검토'}</span></td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 전압 강하 분석 ── */}
          {r.loads.some(l=>(l.cableLength||0)>0)&&(
            <div className="card">
              <div className="card-title">📏 전압 강하 분석 (Voltage Drop, ΔV ≤ 5%)</div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>회로번호</th><th>부하명</th><th>용량(kW)</th>
                      <th>케이블</th><th>길이(m)</th><th>전류(A)</th>
                      <th>전압강하(%)</th><th>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.loads
                      .filter(l=>(l.cableLength||0)>0)
                      .sort((a,b)=>(b.voltageDrop||0)-(a.voltageDrop||0))
                      .map(l=>{
                        const ok = l.voltageDropOk!==false
                        return (
                          <tr key={l.id} className={!ok?'row-emg':''}>
                            <td style={{fontWeight:700}}>{l.circuitNo}</td>
                            <td style={{textAlign:'left'}}>{l.name}</td>
                            <td>{l.kw.toFixed(1)}</td>
                            <td><span className="bge" style={{background:'#f3e5f5',color:'var(--purple)'}}>{l.cableCode}</span></td>
                            <td>{l.cableLength||0}</td>
                            <td>{l.currentA.toFixed(1)}</td>
                            <td style={{fontWeight:700,color:ok?'var(--green)':'var(--red)'}}>
                              {(l.voltageDrop||0).toFixed(2)}%
                            </td>
                            <td><span className={`bge ${ok?'ok':'err'}`}>{ok?'적합':'초과'}</span></td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
              <div style={{background:'#f0f4ff',border:'1px solid #c5d5f5',borderRadius:8,padding:'10px 14px',marginTop:10,fontSize:12,lineHeight:1.9}}>
                <b>📐 계산식 (IEC 60092-352 / KR 선급)</b><br/>
                <span style={{fontFamily:'monospace',display:'block',marginTop:2}}>
                  3상: ΔV% = (√3 × I × L × (R·cosφ + X·sinφ)) / V × 100<br/>
                  단상: ΔV% = (2 × I × L × (R·cosφ + X·sinφ)) / V × 100
                </span>
                <span style={{color:'var(--gray)'}}>R: 케이블 저항(Ω/km) | X: 리액턴스 ≈ 0.08Ω/km | L: 길이(km) | 기준: ΔV ≤ 5%. 초과 시 케이블 단면적 증가 또는 경로 단축 필요.</span>
              </div>
            </div>
          )}

          {/* ── 보호협조 힌트 ── */}
          {coordinationHints.length>0&&(
            <div className="card">
              <div className="card-title">🛡️ 보호협조 / 선택차단 힌트</div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>버스</th><th>최대 하위 분기</th><th>하위 설정 A</th><th>권장 상위 차단기 A</th><th>여유율</th><th>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coordinationHints.map(hint=>(
                      <tr key={hint.sourceTag}>
                        <td style={{fontWeight:700,color:'var(--blue)'}}>{hint.sourceTag}</td>
                        <td style={{textAlign:'left'}}>{hint.largestBranch}</td>
                        <td>{hint.largestBranchSetA||'-'}</td>
                        <td>{hint.recommendedBreakerA||'-'}</td>
                        <td>{hint.marginPct===999?'-':`${hint.marginPct}%`}</td>
                        <td><span className={`bge ${hint.status==='OK'?'ok':'err'}`}>{hint.status==='OK'?'양호':'검토'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sbar info" style={{marginTop:10}}>
                상위 차단기와 하위 분기 차단기의 정격 차이가 충분하지 않으면 실제 선택차단(Selective Coordination) 검토가 필요합니다.
              </div>
            </div>
          )}

          {/* ── N-1 부하 차단 분석 ── */}
          {hasDg&&project.dgCount>1&&(
            <div className="card">
              <div className="card-title">🔁 N-1 부하 차단 분석 (발전기 1대 탈락 시 부하 차단)</div>
              <div className="g2">
                <div>
                  <table className="detail-table">
                    <tbody>
                      <tr><td>발전기 구성</td><td>{project.dgCount}대 × {r.selKva} kVA</td></tr>
                      <tr><td>N-1 잔류 용량</td><td>{(r.selKva*(project.dgCount-1)).toFixed(0)} kVA</td></tr>
                      <tr><td>현재 수요 kVA</td><td>{r.totKvaDemand.toFixed(1)} kVA</td></tr>
                      <tr><td>N-1 부하율</td><td style={{color:r.n1Ok?'var(--green)':'var(--red)',fontWeight:700}}>
                        {r.n1LoadFactorPct.toFixed(1)}%
                      </td></tr>
                      <tr className="sel-row"><td>N-1 판정</td>
                        <td style={{color:r.n1Ok?'var(--green)':'var(--red)'}}>{r.n1Ok?'PASS ✅':'FAIL ❌'}</td>
                      </tr>
                      {!r.n1Ok&&<tr><td>차단 필요 kW</td>
                        <td style={{color:'var(--red)',fontWeight:700}}>{r.n1ShedKw.toFixed(0)} kW</td>
                      </tr>}
                    </tbody>
                  </table>
                </div>
                <div>
                  {!r.n1Ok&&(
                    <div className="sbar warn">
                      N-1 시 과부하 발생. 우선순위 낮은 부하 {r.n1ShedKw.toFixed(0)}kW 자동 차단 계획 수립 필요.
                      AMS(선박 자동화 시스템) 부하 차단(Load Shedding) 기능 적용 권장.
                    </div>
                  )}
                  {r.n1Ok&&(
                    <div className="sbar ok">
                      N-1 조건에서도 부하율 {r.n1LoadFactorPct.toFixed(1)}%로 정상 운전 가능합니다.
                    </div>
                  )}
                  <div className="sbar info" style={{marginTop:8}}>
                    비상 차단 우선순위 (예시):<br/>
                    1순위: 비필수 작업부하 (Hydro Pack, Oil Boom 등)<br/>
                    2순위: 일반 보조기계 (에어컨, 냉장 등)<br/>
                    3순위: 필수 보조기계 (소화펌프, 항해기기 등)<br/>
                    최우선 유지: 비상부하 (FAS, NCP, 비상조명)
                  </div>
                </div>
              </div>
              {loadSheddingPlan.length>0&&(
                <div className="tw" style={{marginTop:12}}>
                  <table>
                    <thead>
                      <tr>
                        <th>회로번호</th><th>부하명</th><th>우선순위</th><th>전원출처</th><th>수요 kW</th><th>차단대상</th><th>누적차단 kW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadSheddingPlan.map(item=>(
                        <tr key={item.id} className={item.selected?'row-emg':''}>
                          <td style={{fontWeight:700}}>{item.circuitNo}</td>
                          <td style={{textAlign:'left'}}>{item.name}</td>
                          <td>{LOAD_PRIORITIES.find(priority=>priority.value===item.priority)?.label || item.priority}</td>
                          <td>{item.fromBus}</td>
                          <td>{item.kwDemand.toFixed(1)}</td>
                          <td><span className={`bge ${item.selected?'err':'norm-badge'}`}>{item.selected?'차단':'유지'}</span></td>
                          <td>{item.selected?item.cumulativeKw.toFixed(1):'-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── KR 설계 체크리스트 ── */}
          <div className="card">
            <div className="card-title">✅ KR 선급 필수 계산 항목 체크리스트</div>
            <div className="tw">
              <table>
                <thead><tr><th>항목</th><th>기준</th><th>계산값</th><th>판정</th></tr></thead>
                <tbody>
                  {[
                    {item:'발전기 부하율',std:'25~90%',val:`${(lf*100).toFixed(1)}%`,ok:lf>=0.25&&lf<=0.9},
                    {item:'발전기 여유율',std:'≥ 25%',val:`${(project.designMargin*100).toFixed(0)}%`,ok:project.designMargin>=0.25},
                    ...(hasDg&&project.dgCount>1?[{item:'N-1 이중화',std:'부하율 ≤ 100%',val:`${r.n1LoadFactorPct.toFixed(1)}%`,ok:r.n1Ok}]:[]),
                    ...(hasEg?[{item:'비상발전기 여유율',std:'≥ 25% (SOLAS)',val:r.egSelKva>0?`${r.egSelKva} kVA`:'미산정',ok:r.egSelKva>0}]:[]),
                    {item:'전동기 기동 전압강하',std:'≤ 15%',val:`${r.voltageDipPct?.toFixed(1)||'—'}%`,ok:r.voltageDipOk!==false},
                    {item:'단락전류 차단용량',std:'MCCB ≥ Isc',val:`${r.iscBusKa?.toFixed(2)||'—'} kA`,ok:r.requiredBreakingKa>=r.iscBusKa},
                    {item:'평균 역률',std:'≥ 0.80',val:`${(r.avgPf).toFixed(3)}`,ok:r.avgPf>=0.80},
                  ].map((row,i)=>(
                    <tr key={i}>
                      <td style={{textAlign:'left',fontWeight:700}}>{row.item}</td>
                      <td>{row.std}</td>
                      <td style={{fontWeight:700}}>{row.val}</td>
                      <td><span className={`bge ${row.ok?'ok':'err'}`}>{row.ok?'적합':'검토필요'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
        </>
      )}

      {/* ════════════════════════════════════
          탭 4: SLD 생성
      ════════════════════════════════════ */}
      {tab===5 && (
        <>
        {!sldXml ? (
          <div className="empty">
            <div className="empty-icon">🗺️</div>
            <p>계산을 먼저 실행하면 SLD가 자동 생성됩니다.</p>
            <button className="btn bg" style={{marginTop:14}} onClick={runCalc} disabled={calcLoading}>
              {calcLoading?'계산 중...':'⚡ 계산 후 SLD 생성'}
            </button>
          </div>
        ) : (
          <>
          <div className="card" style={{background:'linear-gradient(135deg,#263238,#37474F)',color:'#ECEFF1',border:'none'}}>
            <div className="card-title" style={{color:'#ECEFF1'}}>🆕 웹 전용 다이어그램 뷰어 (SVG · A3)</div>
            <div style={{fontSize:12,color:'#B0BEC5',marginBottom:12}}>
              IEC 60617 심볼 · KR 선급 표제란 · Zoom/Pan · SVG/PNG/PDF 내보내기. draw.io 없이 웹에서 바로 확인/인쇄 가능합니다.
            </div>
            <a href={`/projects/${id}/sld`} target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:6,background:'#00BCD4',color:'#263238',padding:'10px 20px',borderRadius:6,fontSize:14,fontWeight:800,textDecoration:'none'}}>
              🗺️ 다이어그램 뷰어 열기 →
            </a>
          </div>

          <div className="card">
            <div className="card-title">🗺️ draw.io SLD 자동 생성 완료 (레거시)</div>
            <div className="sbar ok" style={{marginBottom:12}}>
              ✅ IEC 60617 + KR 선급 심볼 기준 | {systemDesc}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <button className="btn bg" onClick={downloadSLD}>⬇ .drawio 파일 저장</button>
              <button className="btn bo bsm"
                onClick={()=>{navigator.clipboard.writeText(sldXml);alert('XML이 클립보드에 복사되었습니다.')}}>
                📋 XML 복사
              </button>
              <button className="btn bp bsm" onClick={runCalc} disabled={calcLoading}>
                🔄 재계산 후 갱신
              </button>
            </div>
            <div className="sbar info" style={{marginBottom:12,fontSize:11}}>
              ① .drawio 저장 → ② draw.io 앱 열기 (app.diagrams.net 또는 데스크톱) → ③ 편집·출력
            </div>
            <div className="xml-area">{sldXml}</div>
          </div>

          <div className="card">
            <div className="card-title">📊 SLD 구성 요소 요약</div>
            <div className="g4">
              {hasDg&&(
                <div style={{background:'#fff2cc',border:'1px solid #e6ac0030',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>디젤 발전기</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#e6ac00',marginTop:4}}>DG × {project.dgCount}</div>
                  <div style={{fontSize:11,color:'var(--gray)',marginTop:4}}>{r?.selKva} kVA</div>
                </div>
              )}
              {hasEg&&(
                <div style={{background:'#f8cecc',border:'1px solid #c6282830',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>비상 발전기</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#c62828',marginTop:4}}>
                    {r&&r.egSelKva>0?`EG ${r.egSelKva} kVA`:'EG'}
                  </div>
                </div>
              )}
              {hasEss&&(
                <div style={{background:'#dae8fc',border:'1px solid #1565c030',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>ESS / 배터리</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#1565c0',marginTop:4}}>
                    {r&&r.essTotalKwh>0?`${r.essTotalKwh.toFixed(0)} kWh`:'ESS'}
                  </div>
                </div>
              )}
              {hasFc&&(
                <div style={{background:'#e0f7fa',border:'1px solid #00838f30',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>연료전지</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#00838f',marginTop:4}}>
                    {r&&r.fcStackKw>0?`${r.fcStackKw.toFixed(0)} kW`:'FC'}
                  </div>
                </div>
              )}
              {hasPv&&(
                <div style={{background:'#fff3e0',border:'1px solid #e6510030',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>태양광(PV)</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#e65100',marginTop:4}}>{project.pvKwp} kWp</div>
                </div>
              )}
              {hasShore&&(
                <div style={{background:'#eceff1',border:'1px solid #546e7a30',borderRadius:10,padding:14,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>육전(Shore)</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#546e7a',marginTop:4}}>
                    {r&&r.shoreKva>0?`${r.shoreKva} kVA`:'Shore'}
                  </div>
                </div>
              )}
              <div style={{background:'#d5e8d4',border:'1px solid #2e7d3230',borderRadius:10,padding:14,textAlign:'center'}}>
                <div style={{fontSize:11,color:'var(--gray)',fontWeight:700}}>부하 회로</div>
                <div style={{fontSize:18,fontWeight:900,color:'var(--green)',marginTop:4}}>{loads.length}회로</div>
                <div style={{fontSize:11,color:'var(--gray)',marginTop:4}}>비상 {emgLoads.length}개</div>
              </div>
            </div>

            {/* 심볼 범례 */}
            <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border)'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--gray)',marginBottom:8}}>SLD 심볼 범례 (IEC 60617)</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11}}>
                {[
                  ['⊙G','발전기 (DG)','#fff2cc','#e6ac00'],
                  ['⊙EG','비상발전기','#f8cecc','#c62828'],
                  ['⊙M','유도전동기','#f5f5f5','#546e7a'],
                  ['━','ACB (strokeW=3)','#e3f2fd','#1565c0'],
                  ['─','MCCB 3P','#f5f5f5','#546e7a'],
                  ['▬','ESS/배터리','#dae8fc','#1565c0'],
                  ['▼','AC/DC 변환기','#dae8fc','#1565c0'],
                  ['▲','VFD (DC/AC)','#e1d5e7','#6a1b9a'],
                ].map(([sym,lbl,bg,col])=>(
                  <div key={String(sym)} style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{display:'inline-block',width:28,height:18,background:bg,border:`1px solid ${col}`,borderRadius:3,textAlign:'center',lineHeight:'18px',fontSize:10,color:col,fontWeight:700}}>{String(sym)}</span>
                    <span style={{color:'var(--gray)'}}>{String(lbl)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </>
        )}
        </>
      )}
    </div>
    </>
  )
}
