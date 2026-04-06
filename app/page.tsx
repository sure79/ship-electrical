'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProjectSummary {
  id:string; vesselName:string; hullNo:string; projectNo:string
  classCode:string; acVoltage:number; frequency:number; dgCount:number
  hasDg?:boolean; hasEg?:boolean; hasEss?:boolean; hasFc?:boolean; hasPv?:boolean; hasShore?:boolean; hasDc?:boolean
  updatedAt:string
}

interface NewProjectForm {
  vesselName: string
  hullNo: string
  projectNo: string
  classCode: string
  acVoltage: number
  frequency: number
  dgCount: number
  hasDg: boolean
  hasEg: boolean
  hasEss: boolean
  hasFc: boolean
  hasPv: boolean
  hasShore: boolean
  hasDc: boolean
}

const NEW_PROJECT_POWER_OPTIONS = [
  { key: 'hasDg', label: 'DG', color: '#1565c0', bg: '#e3f2fd' },
  { key: 'hasEg', label: 'EG', color: '#b71c1c', bg: '#fce4ec' },
  { key: 'hasEss', label: 'ESS', color: '#1b5e20', bg: '#e8f5e9' },
  { key: 'hasFc', label: 'FC', color: '#4a148c', bg: '#f3e5f5' },
  { key: 'hasPv', label: 'PV', color: '#e65100', bg: '#fff3e0' },
  { key: 'hasShore', label: 'Shore', color: '#006064', bg: '#e0f7fa' },
  { key: 'hasDc', label: 'DC', color: '#2e7d32', bg: '#e8f5e9' },
] as const

const MANUAL = [
  {
    title:'📋 프로그램 개요',
    content:`선박 전장기본설계 자동화 시스템은 부하 데이터를 입력하면 발전기/비상발전기/ESS 용량을 자동으로 산정하고, draw.io SLD(단선결선도)를 자동으로 생성합니다.

적용 기준:
• KR 선급 규칙 Pt.4 (전기설비)
• IEC 60092 선박 전기설비 시리즈
• IEC 60617 전기 심볼 (SLD 표준)
• SOLAS Reg. II-1/42~44 (비상전원)

지원 전원 구성: 디젤발전기, 비상발전기, ESS/배터리, 연료전지, 태양광, 육전, DC버스 — 복수 조합 가능`
  },
  {
    title:'① 계통 설정 탭',
    content:`[기본 정보]
• 선박명, Hull No, Project No, 선급 코드 (KR/NK/BV/ABS/LR/DNV/KOMSA/기타)
• AC 버스 전압: 직접 입력 (V) — 220, 440, 690V 등
• 주파수: 60Hz / 50Hz

[전원 시스템 구성]
전원 소스를 체크박스로 복수 선택:
• 주발전기(DG): 대수, 역률(통상 0.8), X"d(과도리액턴스, 기본값 0.15), 설계여유율(최소 25%)
• 비상발전기(EG): SOLAS 규정 준수, 45초 자동기동
• ESS/배터리: 백업시간(h), ESS여유율(최소 20%)
• 연료전지(FC): 스택 용량(kW)
• 태양광(PV): 설치 용량(kWp), 일조시간(h/day)
• 육전(Shore): AC 외부전원 연결
• DC 버스: DC 버스 전압(V) 설정

[버스/패널 등록]
• MSB(주배전반), EDB(비상배전반), MDP(모터분전함) 등 등록
• 등록된 버스/패널은 부하 입력의 FROM 필드에 자동완성으로 표시됨`
  },
  {
    title:'② 부하 입력 탭',
    content:`[부하 항목]
• 회로번호 (Circuit No): P01, N01, L01 등
• 부하명 (Name): 장비 명칭
• FROM: 전원 출처 — 버스명 또는 장비명 자유 입력 (등록된 버스는 자동완성)
• TO: 부하 태그 — 장비 고유 식별자
• kW: 정격 출력 (부하)
• PF: 역률 (기본값 0.85)
• η: 효율 (기본값 0.88)
• 기동방식: DOL(직입)/Y-D(스타델타)/SSR(소프트스타터)/VFD(인버터)/DC
• 위상: 3P(3상)/1P(단상)

[운전모드별 수요율 (Demand Factor)]
수요율은 운전모드(SEA/WORK/EMG)별로 각각 설정:
• 항해(SEA): 항해 중 수요율 (기본값 = 설정 수요율)
• 작업(WORK): 작업 중 수요율 (기본값 = SEA × 0.6)
• 비상(EMG): 비상시 수요율 (비상부하 체크 시 = SEA, 미체크 = 0)

[체크박스]
• 비상(EMG): 비상발전기 공급 대상 부하
• 배터리: ESS/배터리 공급 부하 분류
• 케이블 길이(m): 전압강하 계산용

[수요율 기준 (KR 선급)]
항해/통신 패널: 1.0 | 전등 패널: 0.8 | 소화/빌지 펌프: 0.3~0.5
공기압축기: 0.5 | 추진보조: 0.3~0.5 | 비상부하: 1.0`
  },
  {
    title:'③ 계산 결과 탭',
    content:`⚡ 계산실행 버튼을 눌러 자동 산정합니다.

[운전모드별 비교표]
항해(SEA) / 작업(WORK) / 비상(EMG) 모드의 kW, kVA 합산 비교
→ 결정 모드(Binding Mode): 가장 큰 kVA 요구 모드

[발전기 선정 결과]
• 필요 kVA = Σ(kVA_demand) × (1 + 설계여유율)
• 표준 kVA 계열로 올림 (ISO 8528-1 기준)
• 선정 kVA × 대수 표시

[N-1 검토]
발전기 2대 이상 시: N-1 기동 시 나머지 발전기 부하율 검토
부하율 > 90% → 경고 / 부하 쉐딩 권장량 표시

[비상발전기]
비상부하 합산 → 25% 여유 → 표준 kVA 선정

[ESS/배터리]
백업 용량(kWh) = 비상부하(kW) × 백업시간(h)
피크컷 용량 + ESS여유율 적용

[부하별 결과표]
연결 kVA, 수요 kW/kVA, MCCB 사양(프레임/설정A), 케이블 사양, 전압강하(%)`
  },
  {
    title:'④ 전기 해석 탭',
    content:`[단락 전류 계산]
Isc = (S_n × N) / (√3 × V × X"d)
X"d: 과도 리액턴스 (기본값 0.15 pu)
→ MCCB 차단용량 선정 기준

[전동기 기동 전압강하]
ΔV% = 기동 kVA / (선정 kVA × N / X"d) × 100
KR 선급 기준: ΔV ≤ 15%
기동전류 배수: DOL 7배, Y-D 2.5배, SSR 3.5배, VFD 1.5배

[케이블 전압강하]
ΔV% = (√3 × I × L × (R·cosφ + X·sinφ)) / V × 100
허용 전압강하: 5% 이하 (KR 선급)
케이블 저항: KR/IEC 표준 사용

[N-1 부하 쉐딩 분석]
N-1 조건에서 비상 우선 유지 부하 vs 쉐딩 권장 부하 표시

[KR 설계 체크리스트]
자동으로 규정 준수 여부 확인:
□ 발전기 용량 ≥ 계산값
□ 발전기 부하율 ≤ 90%
□ 비상발전기 자동기동 45초
□ 전압강하 ≤ 5%
□ 전동기 기동 전압강하 ≤ 15%
□ ESS 백업시간 충족
□ 비상부하 내화케이블(FD-) 적용`
  },
  {
    title:'⑤ SLD 생성 탭',
    content:`draw.io 단선결선도(SLD)를 자동으로 생성합니다.

[생성 요소]
• 발전기 (DG/EG/FC): IEC 60617 심볼 (⊙G)
• 육전 연결점 (Shore Power)
• ACB/MCCB 차단기: 프레임/설정전류 표기
• AC/DC 버스바 (청색/적색 구분)
• AC/DC 컨버터, VFD, ISO 변압기
• ESS/배터리 (BCU/BMS)
• 부하 (모터 ⊙M, 패널 등)

[레이아웃 규칙 (IEC 60617 + KR)]
좌→우: 주발전기 → 육전 → 비상발전기
위→아래: 전원 → 차단기 → 버스바 → 변환기 → 부하
버스바: AC=청색(#0050ef), DC=적색(#FF0000), 비상=주황(#FF8C00)

[파일 저장]
.drawio 파일 다운로드 → draw.io 앱에서 열기 → 편집/인쇄/PDF 출력`
  },
]

// JIS F 3003 케이블 규격표 데이터
// TPYCY (3심), DPYCY (2심), FR-TPYCY (3심 내화)
const JIS_CABLE = [
  // size, TPYCY허용(A), DPYCY허용(A)
  { size:'1.5',  tpy:16,  dpy:20  },
  { size:'2.5',  tpy:22,  dpy:27  },
  { size:'4',    tpy:29,  dpy:36  },
  { size:'6',    tpy:37,  dpy:46  },
  { size:'10',   tpy:51,  dpy:63  },
  { size:'16',   tpy:67,  dpy:84  },
  { size:'25',   tpy:88,  dpy:109 },
  { size:'35',   tpy:107, dpy:133 },
  { size:'50',   tpy:129, dpy:160 },
  { size:'70',   tpy:163, dpy:202 },
  { size:'95',   tpy:197, dpy:245 },
  { size:'120',  tpy:228, dpy:283 },
  { size:'150',  tpy:261, dpy:324 },
  { size:'185',  tpy:299, dpy:371 },
  { size:'240',  tpy:351, dpy:436 },
  { size:'300',  tpy:399, dpy:495 },
]

// 전류로 케이블 선정 (25% 여유)
function selectCable(iA: number, type: '3P'|'1P'|'DC') {
  const use3core = type === '3P'
  const tbl = use3core ? JIS_CABLE.map(r=>({size:r.size, allow:r.tpy})) : JIS_CABLE.map(r=>({size:r.size, allow:r.dpy}))
  const need = iA * 1.25
  const found = tbl.find(r=>r.allow >= need)
  const prefix = use3core ? 'TPYCY' : 'DPYCY'
  return found ? `${prefix}-${found.size}` : `${prefix}-300+`
}

// 전압 / 전류 / 케이블 참조표 생성
function getPowerRows(volt: number, phases: '3P'|'1P'|'DC') {
  const kws = phases==='DC'
    ? [0.1, 0.2, 0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500]
    : [0.4, 0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315]
  return kws.map(kw => {
    const eta = 0.92
    let I: number
    if (phases === '3P') {
      I = (kw * 1000) / (Math.sqrt(3) * volt * 0.85 * eta)
    } else if (phases === '1P') {
      I = (kw * 1000) / (volt * 0.85 * eta)
    } else {
      // DC: I = P / (V × η), 역률 없음
      I = (kw * 1000) / (volt * eta)
    }
    const cable = selectCable(I, phases)
    const frCable = cable.replace('TPYCY','FR-TPYCY').replace('DPYCY','FR-DPYCY')
    return { kw, I: Math.round(I*10)/10, cable, frCable }
  })
}

export default function Dashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<NewProjectForm>({
    vesselName:'', hullNo:'', projectNo:'', classCode:'KR', acVoltage:220, frequency:60, dgCount:1,
    hasDg:true, hasEg:false, hasEss:false, hasFc:false, hasPv:false, hasShore:false, hasDc:false
  })
  const [creating, setCreating] = useState(false)
  const [delId, setDelId] = useState<string|null>(null)
  const [openManual, setOpenManual] = useState<number|null>(null)
  const [cableVolt, setCableVolt] = useState<number>(220)
  const [cablePhase, setCablePhase] = useState<'3P'|'1P'|'DC'>('3P')

  useEffect(()=>{ load() },[])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if(!res.ok) throw new Error(`서버 오류 ${res.status}`)
      const data = await res.json()
      setProjects(data.projects||[])
    } catch(e) {
      console.error('load error:', e)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    if(!form.vesselName.trim()) return alert('선박명을 입력하세요')
    if(!Object.entries(form).some(([k,v]) => k.startsWith('has') && v === true)) {
      return alert('전원 구성을 하나 이상 선택하세요')
    }
    setCreating(true)
    const res = await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const data = await res.json()
    setCreating(false)
    if(data.id) router.push(`/projects/${data.id}`)
  }

  async function del(id:string) {
    await fetch(`/api/projects/${id}`,{method:'DELETE'})
    setDelId(null)
    load()
  }

  const fmt = (s:string) => new Date(s).toLocaleDateString('ko-KR')

  function powerBadges(p: ProjectSummary) {
    const badges: {label:string; color:string; bg:string}[] = []
    if(p.hasDg !== false) badges.push({label:'DG', color:'#1565c0', bg:'#e3f2fd'})
    if(p.hasEg) badges.push({label:'EG', color:'#b71c1c', bg:'#fce4ec'})
    if(p.hasEss) badges.push({label:'ESS', color:'#1b5e20', bg:'#e8f5e9'})
    if(p.hasFc) badges.push({label:'FC', color:'#4a148c', bg:'#f3e5f5'})
    if(p.hasPv) badges.push({label:'PV', color:'#e65100', bg:'#fff3e0'})
    if(p.hasShore) badges.push({label:'Shore', color:'#006064', bg:'#e0f7fa'})
    if(p.hasDc) badges.push({label:'DC', color:'#2e7d32', bg:'#e8f5e9'})
    if(badges.length === 0) badges.push({label:`DG×${p.dgCount}`, color:'#1565c0', bg:'#e3f2fd'})
    return badges
  }

  const cableRows = getPowerRows(cableVolt, cablePhase)

  return (
    <>
    <div className="hdr">
      <div>
        <div className="hdr-title">🚢 선박 전장기본설계 자동화</div>
        <div className="hdr-sub">Ship Electrical Design Automation v3.0 | Turso DB + Vercel | KR 선급 / IEC 60092 / JIS F 3003</div>
      </div>
    </div>

    <div className="page">
      {/* Hero */}
      <div className="dash-hero">
        <h1>⚡ 선박 전장기본설계 자동화 시스템</h1>
        <p>부하 입력 → From-To 회로 구성 → 발전기/ESS 자동 산정 → draw.io SLD 자동 생성</p>
        <div className="dash-badges">
          {['KR 선급 기준','IEC 60617 심볼','JIS F 3003 케이블','자동 저장','프로젝트별 관리','draw.io SLD'].map(b=>(
            <span key={b} className="dash-badge">{b}</span>
          ))}
        </div>
      </div>

      {/* 사용 설명서 */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <h2 style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>📖 사용 설명서</h2>
          <span style={{fontSize:12,color:'var(--gray)'}}>항목을 클릭하면 내용을 볼 수 있습니다</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {MANUAL.map((item, i) => (
            <div key={i} style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
              <div
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',cursor:'pointer',background: openManual===i ? '#f0f4ff' : 'var(--surface)',userSelect:'none'}}
                onClick={()=>setOpenManual(openManual===i ? null : i)}
              >
                <span style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>{item.title}</span>
                <span style={{fontSize:16,color:'var(--gray)',transform: openManual===i ? 'rotate(90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▶</span>
              </div>
              {openManual===i && (
                <div style={{padding:'12px 16px',background:'#fafbff',borderTop:'1px solid var(--border)'}}>
                  <pre style={{fontFamily:'inherit',fontSize:12.5,lineHeight:1.8,color:'var(--text)',whiteSpace:'pre-wrap',margin:0}}>
                    {item.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* JIS 케이블 규격표 */}
      <div style={{marginBottom:28}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10,flexWrap:'wrap'}}>
          <h2 style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>🔌 JIS F 3003 케이블 규격표</h2>
          <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:'auto',flexWrap:'wrap'}}>
            <label style={{fontSize:12,color:'var(--gray)'}}>전원 종류</label>
            <select value={cablePhase} onChange={e=>{
              const v = e.target.value as '3P'|'1P'|'DC'
              setCablePhase(v)
              if(v==='DC') setCableVolt(650)
              else setCableVolt(220)
            }} style={{fontSize:12,padding:'3px 6px',borderRadius:4,border:'1px solid var(--border)'}}>
              <option value="3P">AC 3상 (3P)</option>
              <option value="1P">AC 단상 (1P)</option>
              <option value="DC">DC</option>
            </select>
            <label style={{fontSize:12,color:'var(--gray)'}}>전압</label>
            <select value={cableVolt} onChange={e=>setCableVolt(+e.target.value)} style={{fontSize:12,padding:'3px 6px',borderRadius:4,border:'1px solid var(--border)'}}>
              {cablePhase==='DC' ? <>
                <option value={24}>24V DC</option>
                <option value={48}>48V DC</option>
                <option value={110}>110V DC</option>
                <option value={220}>220V DC</option>
                <option value={450}>450V DC</option>
                <option value={650}>650V DC</option>
                <option value={750}>750V DC</option>
                <option value={800}>800V DC</option>
              </> : <>
                <option value={220}>220V</option>
                <option value={440}>440V</option>
                <option value={690}>690V</option>
              </>}
            </select>
          </div>
        </div>

        {/* 허용전류 기준표 */}
        <div style={{overflowX:'auto',marginBottom:14}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <caption style={{textAlign:'left',fontSize:11,color:'var(--gray)',marginBottom:4}}>
              {cablePhase==='DC'
                ? `※ DC 전원 계산식: I = kW × 1000 / (V × η), η=0.92 | DPYCY: 2심 DC 케이블 | FR-DPYCY: 내화형`
                : `※ AC 전원 계산식: I = kW×1000 / (${cablePhase==='3P'?'√3 × ':''}V × PF × η), PF=0.85, η=0.92 | FR-TPYCY: 내화형 (비상/소화계통 필수)`}
            </caption>
            <thead>
              <tr style={{background: cablePhase==='DC'?'#fff3e0':'#f0f4ff'}}>
                <th style={th}>kW</th>
                <th style={th}>전류 (A)</th>
                <th style={th}>케이블 (일반)</th>
                <th style={th}>케이블 (내화)</th>
                <th style={th}>비고</th>
              </tr>
            </thead>
            <tbody>
              {cableRows.map((r,i)=>(
                <tr key={i} style={{background: i%2===0?'#fff':'#f9f9f9'}}>
                  <td style={td}>{r.kw} kW</td>
                  <td style={td}>{r.I} A</td>
                  <td style={{...td, fontFamily:'monospace', fontWeight:600, color: cablePhase==='DC'?'#e65100':'#1565c0'}}>{r.cable} mm²</td>
                  <td style={{...td, fontFamily:'monospace', fontWeight:600, color:'#b71c1c'}}>{r.frCable} mm²</td>
                  <td style={{...td, color:'var(--gray)', fontSize:11}}>
                    {cablePhase==='DC'
                      ? (r.I > 400 ? '병렬 케이블 검토' : r.I > 200 ? '대용량 DC 회로' : '')
                      : (r.kw >= 55 ? '전동기 Y-D 기동 검토' : r.kw >= 22 ? 'VFD/Y-D 검토' : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 케이블 허용전류 기준표 */}
        <div style={{overflowX:'auto'}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--text)',marginBottom:6}}>케이블 사양별 허용전류 (JIS F 3003 기준)</div>
          <table style={{borderCollapse:'collapse',fontSize:12,minWidth:500}}>
            <thead>
              <tr style={{background:'#f0f4ff'}}>
                <th style={th}>단면적 (mm²)</th>
                <th style={th}>TPYCY 3심 (A)</th>
                <th style={th}>FR-TPYCY 3심 내화 (A)</th>
                <th style={th}>DPYCY 2심 (A)</th>
                <th style={th}>FR-DPYCY 2심 내화 (A)</th>
              </tr>
            </thead>
            <tbody>
              {JIS_CABLE.map((r,i)=>(
                <tr key={i} style={{background: i%2===0?'#fff':'#f9f9f9'}}>
                  <td style={{...td, fontWeight:700}}>{r.size} mm²</td>
                  <td style={{...td, color:'#1565c0'}}>{r.tpy} A</td>
                  <td style={{...td, color:'#b71c1c'}}>{r.tpy} A</td>
                  <td style={{...td, color:'#2e7d32'}}>{r.dpy} A</td>
                  <td style={{...td, color:'#6a1b9a'}}>{r.dpy} A</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{fontSize:11,color:'var(--gray)',marginTop:6}}>
            ※ TPYCY: 3심 동심 케이블 (3상 동력) | DPYCY: 2심 (단상/DC) | FR-: 내화형 (비상/소화/화재탐지 계통)<br/>
            ※ 선정 기준: 허용전류 ≥ 정격전류 × 1.25 (25% 여유) | 비상부하: 반드시 FR- 내화 케이블 적용 (KR 선급)
          </div>
        </div>
      </div>

      {/* 프로젝트 목록 */}
      <div style={{display:'flex',alignItems:'center',marginBottom:14}}>
        <h2 style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>📁 프로젝트 목록</h2>
        <button className="btn bp bsm" style={{marginLeft:'auto'}} onClick={()=>setShowNew(true)}>+ 새 프로젝트</button>
      </div>

      {loading ? (
        <div className="empty"><div className="empty-icon">⏳</div>로딩 중...</div>
      ) : (
        <div className="proj-grid">
          <div className="new-card" onClick={()=>setShowNew(true)}>
            <div className="new-card-icon">+</div>
            <div className="new-card-txt">새 프로젝트 만들기</div>
          </div>

          {projects.map(p=>(
            <div key={p.id} className="proj-card" onClick={()=>router.push(`/projects/${p.id}`)}>
              <div className="proj-name">🚢 {p.vesselName}</div>
              <div className="proj-info">{p.hullNo && `Hull No: ${p.hullNo}`}{p.projectNo && ` | ${p.projectNo}`}</div>
              <div className="proj-meta">
                <span className="bge norm-badge">{p.classCode}</span>
                <span className="bge" style={{background:'#e3f2fd',color:'#1565c0'}}>{p.acVoltage}V {p.frequency}Hz</span>
                {powerBadges(p).map(b=>(
                  <span key={b.label} className="bge" style={{background:b.bg,color:b.color}}>{b.label}</span>
                ))}
                <span className="bge" style={{background:'#f5f5f5',color:'#546e7a'}}>{fmt(p.updatedAt)}</span>
              </div>
              <div className="proj-actions" onClick={e=>e.stopPropagation()}>
                <button className="btn bp bsm" onClick={()=>router.push(`/projects/${p.id}`)}>▶ 열기</button>
                <button className="btn bd bsm" onClick={()=>setDelId(p.id)}>🗑 삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* 새 프로젝트 모달 */}
    {showNew && (
      <div className="modal-bg" onClick={()=>setShowNew(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">🚢 새 프로젝트 만들기</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              { label:'선박명 *', type:'text', key:'vesselName' as const, placeholder:'청항선' },
              { label:'Hull No.', type:'text', key:'hullNo' as const, placeholder:'H-1041' },
              { label:'Project No.', type:'text', key:'projectNo' as const, placeholder:'GNTP2' },
            ].map(field=>(
              <div key={field.key}>
                <label>{field.label}</label>
                <input type={field.type} placeholder={field.placeholder} value={form[field.key]}
                  onChange={e=>setForm(f=>({...f,[field.key]:e.target.value}))} />
              </div>
            ))}
            <div className="g2">
              <div>
                <label>선급</label>
                <select value={form.classCode} onChange={e=>setForm(f=>({...f,classCode:e.target.value}))}>
                  {['KR','NK','BV','ABS','LR','DNV','KOMSA','기타'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>AC 버스 전압 (V)</label>
                <input type="number" value={form.acVoltage} onChange={e=>setForm(f=>({...f,acVoltage:+e.target.value}))} />
              </div>
            </div>
            <div className="g2">
              <div>
                <label>주파수</label>
                <select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:+e.target.value}))}>
                  <option value={60}>60 Hz</option><option value={50}>50 Hz</option>
                </select>
              </div>
              <div>
                <label>발전기 대수</label>
                <select value={form.dgCount} onChange={e=>setForm(f=>({...f,dgCount:+e.target.value}))}>
                  {[1,2,3].map(n=><option key={n} value={n}>{n}대</option>)}
                </select>
              </div>
            </div>
            <div>
              <label>전원 구성</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {NEW_PROJECT_POWER_OPTIONS.map(opt=>(
                  <label key={opt.key}
                    style={{
                      display:'flex',alignItems:'center',gap:6,padding:'8px 10px',border:'1px solid var(--border)',
                      borderRadius:8,cursor:'pointer',background:form[opt.key]?opt.bg:'#fff',color:form[opt.key]?opt.color:'var(--text)'
                    }}>
                    <input
                      type="checkbox"
                      checked={form[opt.key]}
                      onChange={e=>setForm(f=>({
                        ...f,
                        [opt.key]: e.target.checked,
                        ...(opt.key==='hasDg' && !e.target.checked && !f.hasEg && !f.hasEss && !f.hasFc && !f.hasPv && !f.hasShore && !f.hasDc
                          ? { hasDg: true }
                          : {}),
                      }))}
                    />
                    <span style={{fontSize:12,fontWeight:700}}>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div style={{fontSize:11,color:'var(--gray)',marginTop:6}}>
                복수 선택 가능합니다. 최소 하나의 전원은 선택하는 것을 권장합니다.
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:18}}>
            <button className="btn bg" style={{flex:1}} onClick={create} disabled={creating}>
              {creating?'생성 중...':'✅ 프로젝트 만들기'}
            </button>
            <button className="btn bg2" onClick={()=>setShowNew(false)}>취소</button>
          </div>
        </div>
      </div>
    )}

    {/* 삭제 확인 모달 */}
    {delId && (
      <div className="modal-bg">
        <div className="modal" style={{maxWidth:360}}>
          <div className="modal-title" style={{color:'var(--red)'}}>🗑️ 프로젝트 삭제</div>
          <p style={{fontSize:13,color:'var(--gray)',marginBottom:18}}>이 프로젝트와 모든 부하 데이터가 영구 삭제됩니다. 계속하시겠습니까?</p>
          <div style={{display:'flex',gap:8}}>
            <button className="btn br" style={{flex:1}} onClick={()=>del(delId)}>삭제</button>
            <button className="btn bg2" style={{flex:1}} onClick={()=>setDelId(null)}>취소</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

const th: React.CSSProperties = {
  padding:'6px 10px', textAlign:'left', borderBottom:'2px solid #dde',
  fontWeight:700, fontSize:12, whiteSpace:'nowrap'
}
const td: React.CSSProperties = {
  padding:'5px 10px', borderBottom:'1px solid #eee', whiteSpace:'nowrap'
}
