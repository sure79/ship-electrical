/* ═══════════════════════════════════════════
   SLD v2 — 메인 SVG 렌더러
   Project + CalcResult + Bus[] → <svg/>
═══════════════════════════════════════════ */

'use client'

import React from 'react'
import type { Project, CalcResult, Bus } from '../types'
import {
  Generator, Motor, ACB, MCCB, Transformer,
  Converter, Battery, Shore, Panel, BusBar, LoadBox,
  Junction, EMS, Choke, COLOR, STROKE,
} from './symbols'
import { TitleBlock } from './titleBlock'
import type { SldMeta } from './model'

/* ── A3 가로 기준 (4px = 1mm) ────────────────────────── */
const PAPER_W = 1684   // 420 mm
const PAPER_H = 1191   // 297 mm
const MARGIN  = 32

interface Props {
  project: Project
  result: CalcResult
  buses: Bus[]
  dt: string
  /** svg 요소에 접근할 때 사용 (내보내기 등) */
  svgRef?: React.RefObject<SVGSVGElement>
}

export default function SldSvg({ project: p, result: r, buses, dt, svgRef }: Props) {
  /* ── 메타 ────────────────────────── */
  const meta: SldMeta = {
    vesselName: p.vesselName,
    hullNo: p.hullNo || '—',
    projectNo: p.projectNo || '—',
    classCode: p.classCode,
    revision: 'Rev 01',
    date: dt,
    sheet: { index: 1, total: 1 },
    scale: 'NTS',
    acVoltage: p.acVoltage,
    dcVoltage: p.dcVoltage,
    frequency: p.frequency,
    paperW: PAPER_W,
    paperH: PAPER_H,
    margin: MARGIN,
  }

  /* ── 소스 배치 ────────────────────────── */
  const dgUnits = p.hasDg ? Math.max(1, p.dgCount || 1) : 0
  const DG_X0 = 120
  const DG_STEP = 170

  // 소스별 x 좌표 계산 (top row)
  const sourcePositions: Array<{ id: string; x: number; kind: 'dg' | 'shore' | 'eg' | 'fc' | 'pv' }> = []
  let sx = DG_X0
  for (let i = 0; i < dgUnits; i++) {
    sourcePositions.push({ id: `DG${i + 1}`, x: sx, kind: 'dg' })
    sx += DG_STEP
  }
  if (p.hasFc) {
    sourcePositions.push({ id: 'FC', x: sx, kind: 'fc' })
    sx += DG_STEP
  }
  if (p.hasPv) {
    sourcePositions.push({ id: 'PV', x: sx, kind: 'pv' })
    sx += DG_STEP
  }
  if (p.hasShore) {
    sourcePositions.push({ id: 'SHORE', x: sx, kind: 'shore' })
    sx += DG_STEP
  }

  /* ── 버스바 위치 계산 ────────────────────────── */
  const BUS_Y = 240
  const EMG_BUS_X_START = PAPER_W - MARGIN - 340

  // 비상발전기는 오른쪽 끝에 배치
  const hasEG = p.hasEg && r.egSelKva > 0
  const egX = EMG_BUS_X_START + 200
  if (hasEG) sourcePositions.push({ id: 'EG', x: egX, kind: 'eg' })

  // 메인 AC 버스 범위
  const mainBusXStart = MARGIN + 24
  const mainBusXEnd = hasEG ? EMG_BUS_X_START : (PAPER_W - MARGIN - 24)
  const mainBusW = mainBusXEnd - mainBusXStart

  /* ── 피더: fromBus 단위로 부하를 그룹핑 ────────────────────────── */
  const busMap = new Map(buses.map(b => [b.tag, b]))
  const loadsBySource = new Map<string, typeof r.loads>()
  for (const ld of r.loads) {
    const key = ld.fromBus || 'MSB'
    const g = loadsBySource.get(key) || []
    g.push(ld)
    loadsBySource.set(key, g)
  }

  // 위상 순서 (MSB → 자식들 → 그 외)
  const orderedFeeders: string[] = []
  const visit = (tag: string) => {
    if (orderedFeeders.includes(tag)) return
    if (!loadsBySource.has(tag) && !busMap.has(tag)) return
    orderedFeeders.push(tag)
    // 자식 탐색
    const children = buses.filter(b => b.parentTag === tag)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    children.forEach(c => visit(c.tag))
  }
  if (busMap.has('MSB') || loadsBySource.has('MSB')) visit('MSB')
  buses.filter(b => !b.parentTag && b.tag !== 'MSB').forEach(b => visit(b.tag))
  // 미등록 source
  Array.from(loadsBySource.keys()).filter(k => !orderedFeeders.includes(k)).forEach(k => orderedFeeders.push(k))

  /* ── 피더 컬럼 배치 ────────────────────────── */
  const FEEDER_Y = BUS_Y + 50         // MCCB
  const PANEL_Y  = FEEDER_Y + 60      // Panel 박스
  const LOAD_Y0  = PANEL_Y + 76       // 첫 부하 row
  const LOAD_ROW_H = 120              // 한 row 높이
  const COL_W = 180                   // 컬럼 폭

  const feederLayouts = orderedFeeders.map((tag, idx) => {
    const loads = loadsBySource.get(tag) || []
    const bus = busMap.get(tag)
    const isEmg = bus?.type === 'EMERGENCY' || tag === 'ESB'
    // 부하를 컬럼으로 나눔 (컬럼당 최대 3개 row)
    const ROWS = loads.length >= 10 ? 3 : loads.length >= 5 ? 4 : Math.max(1, loads.length)
    const cols = Math.max(1, Math.ceil(loads.length / ROWS))
    const width = Math.max(COL_W, cols * COL_W)
    return { tag, bus, loads, isEmg, cols, rows: ROWS, width, idx, panelLabel: tag === 'MSB' ? 'MSB · Main Switchboard' : bus ? `${bus.tag} · ${bus.name}` : tag }
  })

  const feederTotalWidth = feederLayouts.reduce((s, f) => s + f.width + 30, 0)
  const feederStartX = Math.max(mainBusXStart + 60, (mainBusXStart + mainBusXEnd - feederTotalWidth) / 2)

  let cursorX = feederStartX
  const feeders = feederLayouts.map(f => {
    const x = cursorX
    cursorX += f.width + 30
    return { ...f, x }
  })

  /* ── DC 영역 ────────────────────────── */
  const hasDc = p.hasDc
  const DC_BUS_Y = 800
  const dcZone = hasDc ? {
    busY: DC_BUS_Y,
    busXStart: MARGIN + 60,
    busXEnd:   PAPER_W - MARGIN - 260,
  } : null

  /* ── 최대 높이 계산 ────────────────────────── */
  const maxFeederRows = feeders.reduce((m, f) => Math.max(m, f.rows), 1)
  const feederBottom = LOAD_Y0 + maxFeederRows * LOAD_ROW_H
  const diagramBottom = hasDc ? Math.max(feederBottom, DC_BUS_Y + 240) : feederBottom
  const TITLE_BLOCK_W = 340
  const TITLE_BLOCK_H = 160
  const TITLE_BLOCK_X = PAPER_W - MARGIN - TITLE_BLOCK_W
  const TITLE_BLOCK_Y = PAPER_H - MARGIN - TITLE_BLOCK_H

  /* ── 렌더 시작 ────────────────────────── */
  const wires: React.ReactElement[] = []
  const nodes: React.ReactElement[] = []

  /* — 시트 프레임 — */
  const frame = (
    <g key="frame">
      <rect x={MARGIN} y={MARGIN} width={PAPER_W - MARGIN * 2} height={PAPER_H - MARGIN * 2}
        fill="#FFFFFF" stroke="#263238" strokeWidth={1.5} />
      <rect x={MARGIN + 4} y={MARGIN + 4} width={PAPER_W - MARGIN * 2 - 8} height={PAPER_H - MARGIN * 2 - 8}
        fill="none" stroke="#90A4AE" strokeWidth={0.5} />
      {/* 도면 타이틀 상단 밴드 */}
      <rect x={MARGIN + 4} y={MARGIN + 4} width={PAPER_W - MARGIN * 2 - 8} height={36}
        fill="#263238" />
      <text x={PAPER_W / 2} y={MARGIN + 28} textAnchor="middle" fontSize={15} fontWeight={800} fill="#FFFFFF" letterSpacing={1}>
        {p.vesselName}  ·  SINGLE LINE DIAGRAM (SLD)  ·  {p.classCode}
      </text>
      <text x={PAPER_W - MARGIN - 14} y={MARGIN + 28} textAnchor="end" fontSize={10} fill="#B0BEC5">
        {dt}
      </text>
    </g>
  )

  /* — 메인 AC 버스바 — */
  nodes.push(
    <g key="main-bus">
      <BusBar x={mainBusXStart} y={BUS_Y} w={mainBusW} label={`MAIN AC BUS  ${p.acVoltage}V  ${p.frequency}Hz  3PH`} kind="ac" />
    </g>
  )

  /* — 상단 소스 — */
  sourcePositions.forEach(src => {
    if (src.kind === 'dg') {
      const idx = Number(src.id.replace('DG', '')) - 1
      const label = dgUnits > 1 ? `DG${idx + 1}` : 'DG'
      nodes.push(
        <g key={src.id}>
          <Generator x={src.x} y={100} label="G" subLabel={`${label}  ${r.selKw}kW`} />
          <ACB x={src.x} y={185} label={`ACB-${idx + 1}`} subLabel={`${r.genAcbA}A`} />
        </g>
      )
      // 와이어: Generator → ACB → Bus
      wires.push(
        <g key={`w-${src.id}`}>
          <line x1={src.x} y1={122} x2={src.x} y2={169} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
          <line x1={src.x} y1={201} x2={src.x} y2={BUS_Y} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
        </g>
      )
    } else if (src.kind === 'eg') {
      nodes.push(
        <g key="eg">
          <Generator x={src.x} y={100} label="G" subLabel={`EG  ${r.egSelKw}kW`} emergency />
          <ACB x={src.x} y={185} label="ACB-E" subLabel={`${Math.round(r.egSelKw * 1000 / (Math.sqrt(3) * p.acVoltage * 0.8) / 50) * 50}A`} emergency />
        </g>
      )
      wires.push(
        <g key="w-eg">
          <line x1={src.x} y1={122} x2={src.x} y2={169} stroke={COLOR.emg} strokeWidth={STROKE.bold} />
          <line x1={src.x} y1={201} x2={src.x} y2={BUS_Y} stroke={COLOR.emg} strokeWidth={STROKE.bold} />
        </g>
      )
    } else if (src.kind === 'shore') {
      nodes.push(
        <g key="shore">
          <Shore x={src.x} y={110} subLabel={`AC ${p.acVoltage}V 3PH`} />
          <MCCB x={src.x} y={185} label="MCCB-SH" subLabel="400/250A" />
        </g>
      )
      wires.push(
        <g key="w-shore">
          <line x1={src.x} y1={126} x2={src.x} y2={175} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
          <line x1={src.x} y1={195} x2={src.x} y2={BUS_Y} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
          {/* 인터록 */}
          {dgUnits > 0 && (
            <path
              d={`M ${src.x - 50} ${190} Q ${src.x - 90} ${180} ${DG_X0 + (dgUnits - 1) * DG_STEP + 40} ${190}`}
              fill="none" stroke={COLOR.emg} strokeWidth={STROKE.mid} strokeDasharray="4,3"
            />
          )}
        </g>
      )
    } else if (src.kind === 'fc') {
      nodes.push(
        <g key="fc">
          <Converter x={src.x} y={120} variant="dcac" label="FC STACK" subLabel={`${r.fcStackKw || 200}kW`} />
          <MCCB x={src.x} y={185} label="MCCB-FC" />
        </g>
      )
      wires.push(
        <g key="w-fc">
          <line x1={src.x} y1={138} x2={src.x} y2={175} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
          <line x1={src.x} y1={195} x2={src.x} y2={BUS_Y} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
        </g>
      )
    } else if (src.kind === 'pv') {
      nodes.push(
        <g key="pv">
          <rect x={src.x - 30} y={96} width={60} height={36} fill="#FFF3E0" stroke="#E65100" strokeWidth={STROKE.bold} rx={3} />
          <text x={src.x} y={117} textAnchor="middle" fontSize={10} fontWeight={800} fill="#E65100">PV Array</text>
          <text x={src.x} y={128} textAnchor="middle" fontSize={8} fill={COLOR.muted}>{p.pvKwp}kWp</text>
          <Converter x={src.x} y={155} variant="dcac" label="PV-INV" />
          <MCCB x={src.x} y={200} label="MCCB-PV" />
        </g>
      )
      wires.push(
        <g key="w-pv">
          <line x1={src.x} y1={132} x2={src.x} y2={136} stroke={COLOR.dc} strokeWidth={STROKE.bold} />
          <line x1={src.x} y1={174} x2={src.x} y2={190} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
          <line x1={src.x} y1={210} x2={src.x} y2={BUS_Y} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
        </g>
      )
    }
  })

  /* — 비상 버스 — */
  if (hasEG) {
    nodes.push(
      <g key="emg-bus">
        <BusBar x={EMG_BUS_X_START} y={BUS_Y + 28} w={340 - 40} label="EMERGENCY BUS (SOLAS)" kind="emg" />
      </g>
    )
    // AC 버스 ↔ 비상 버스 (ACB-Tie)
    wires.push(
      <g key="w-tie">
        <line x1={mainBusXEnd} y1={BUS_Y + 6} x2={EMG_BUS_X_START - 20} y2={BUS_Y + 6} stroke={COLOR.ac} strokeWidth={STROKE.heavy} />
        <rect x={EMG_BUS_X_START - 20} y={BUS_Y - 4} width={20} height={20} fill="#FFF" stroke={COLOR.emg} strokeWidth={STROKE.bold} />
        <text x={EMG_BUS_X_START - 10} y={BUS_Y + 10} textAnchor="middle" fontSize={7} fontWeight={700} fill={COLOR.emg}>TIE</text>
        <line x1={EMG_BUS_X_START} y1={BUS_Y + 6} x2={EMG_BUS_X_START} y2={BUS_Y + 28} stroke={COLOR.emg} strokeWidth={STROKE.bold} />
      </g>
    )
  }

  /* — 피더 (MCCB + Panel + Loads) — */
  feeders.forEach(f => {
    const feederX = f.x + f.width / 2
    const busY = f.isEmg ? BUS_Y + 34 : BUS_Y
    const feederColor = f.isEmg ? COLOR.emg : COLOR.ac

    // MSB 자체는 버스바에 이미 통합됐으니, MSB 피더는 직접 부하만 붙임
    const isMsb = f.tag === 'MSB'

    // Tap wire: bus → MCCB → Panel
    if (!isMsb) {
      wires.push(
        <g key={`fw-${f.tag}`}>
          <line x1={feederX} y1={busY + 12} x2={feederX} y2={FEEDER_Y - 10} stroke={feederColor} strokeWidth={STROKE.bold} />
          <Junction x={feederX} y={busY + 12} kind={f.isEmg ? 'emg' : 'ac'} />
        </g>
      )
      nodes.push(
        <g key={`mccb-${f.tag}`}>
          <MCCB x={feederX} y={FEEDER_Y} label={`MCCB-${f.tag}`} emergency={f.isEmg} />
        </g>
      )
      wires.push(
        <line key={`pw-${f.tag}`} x1={feederX} y1={FEEDER_Y + 10} x2={feederX} y2={PANEL_Y} stroke={feederColor} strokeWidth={STROKE.bold} />
      )
      nodes.push(
        <Panel
          key={`panel-${f.tag}`}
          x={f.x}
          y={PANEL_Y}
          w={f.width}
          h={46}
          label={f.panelLabel}
          subLabel={`${f.loads.length} circuits`}
          emergency={f.isEmg}
        />
      )
    } else {
      // MSB 자체 피더 — 버스바에서 직접 타고 내려가는 분기만 그림
    }

    /* — 부하 — */
    const colCenters = Array.from({ length: f.cols }, (_, c) => f.x + (c + 0.5) * f.width / f.cols)
    const trunkY = isMsb ? BUS_Y + 12 : PANEL_Y + 46 + 14

    f.loads.forEach((ld, i) => {
      const col = Math.floor(i / f.rows)
      const row = i % f.rows
      const cx = colCenters[col] ?? f.x + f.width / 2
      const loadY = LOAD_Y0 + row * LOAD_ROW_H
      const emg = ld.isEmergency || f.isEmg

      // trunk → column → MCCB → motor → nameplate
      wires.push(
        <g key={`lw-${ld.id}`}>
          <line x1={cx} y1={trunkY} x2={cx} y2={loadY - 8} stroke={emg ? COLOR.emg : COLOR.ac} strokeWidth={STROKE.bold} />
          <Junction x={cx} y={trunkY} kind={emg ? 'emg' : 'ac'} />
        </g>
      )
      nodes.push(
        <g key={`mccb-ld-${ld.id}`}>
          <MCCB x={cx} y={loadY + 2} label={`${ld.mccbFrame}AF`} subLabel={`${ld.mccbSet}A`} emergency={emg} />
        </g>
      )
      wires.push(
        <line key={`w-ld-${ld.id}`} x1={cx} y1={loadY + 12} x2={cx} y2={loadY + 40} stroke={emg ? COLOR.emg : COLOR.ac} strokeWidth={STROKE.bold} />
      )
      if (ld.phase !== 'N/A') {
        nodes.push(
          <Motor key={`m-ld-${ld.id}`} x={cx} y={loadY + 58} label={ld.startType === 'VFD' ? 'VFD' : 'M'} emergency={emg} />
        )
      }
      const shortName = ld.name.length > 18 ? ld.name.slice(0, 17) + '…' : ld.name
      const lines = [
        ld.circuitNo || '—',
        shortName,
        `${ld.kw}kW  ${ld.pf}pf`,
        ld.cableCode,
      ]
      nodes.push(
        <LoadBox key={`box-${ld.id}`} x={cx - 60} y={loadY + 82} w={120} h={50} lines={lines} emergency={emg} />
      )
      wires.push(
        <line key={`w2-${ld.id}`} x1={cx} y1={loadY + 76} x2={cx} y2={loadY + 82} stroke={emg ? COLOR.emg : COLOR.ac} strokeWidth={STROKE.bold} />
      )
    })
  })

  /* — DC 영역 (추진) — */
  if (dcZone && hasDc) {
    const { busY, busXStart, busXEnd } = dcZone

    // AC BUS → ISO-TR → Choke → AC/DC → DC BUS
    const acdcX = busXStart + 100
    // 1) Tap from MSB bus
    wires.push(
      <g key="dc-tap">
        <line x1={acdcX} y1={BUS_Y + 12} x2={acdcX} y2={BUS_Y + 40} stroke={COLOR.ac} strokeWidth={STROKE.bold} />
        <Junction x={acdcX} y={BUS_Y + 12} kind="ac" />
      </g>
    )
    nodes.push(<MCCB key="dc-mccb" x={acdcX} y={BUS_Y + 52} label="MCCB-PR" subLabel={`${Math.round(p.isoKva * 1000 / (Math.sqrt(3) * p.acVoltage) * 1.25 / 5) * 5}A`} />)
    wires.push(<line key="w-dc-1" x1={acdcX} y1={BUS_Y + 62} x2={acdcX} y2={BUS_Y + 96} stroke={COLOR.ac} strokeWidth={STROKE.bold} />)
    nodes.push(<Transformer key="dc-iso" x={acdcX} y={BUS_Y + 130} label="ISO-TR" subLabel={`${p.isoKva}kVA`} />)
    wires.push(<line key="w-dc-2" x1={acdcX} y1={BUS_Y + 160} x2={acdcX} y2={BUS_Y + 180} stroke={COLOR.ac} strokeWidth={STROKE.bold} />)
    nodes.push(<Choke key="dc-choke" x={acdcX} y={BUS_Y + 195} label="CHOKE" />)
    wires.push(<line key="w-dc-3" x1={acdcX} y1={BUS_Y + 205} x2={acdcX} y2={BUS_Y + 225} stroke={COLOR.ac} strokeWidth={STROKE.bold} />)
    nodes.push(<Converter key="dc-acdc" x={acdcX} y={BUS_Y + 255} variant="acdc" label="AC/DC" subLabel={`${Math.ceil((r.propKwIn || 200) / 50) * 50}kW`} />)
    wires.push(<line key="w-dc-4" x1={acdcX} y1={BUS_Y + 277} x2={acdcX} y2={busY} stroke={COLOR.dc} strokeWidth={STROKE.bold} />)

    // DC BUS
    nodes.push(<BusBar key="dc-bus" x={busXStart} y={busY} w={busXEnd - busXStart} label={`DC BUS ${p.dcVoltage}VDC`} kind="dc" />)

    // DC/DC (left)
    const ddcX = busXStart + 50
    if (ddcX < acdcX - 40) {
      wires.push(<line key="w-ddc-1" x1={ddcX} y1={busY + 12} x2={ddcX} y2={busY + 36} stroke={COLOR.dc} strokeWidth={STROKE.bold} />)
      nodes.push(<Converter key="ddc" x={ddcX} y={busY + 66} variant="dcdc" label="DC/DC" subLabel="→24VDC" />)
    }

    // VFD + Motors
    const motorStartX = acdcX + 120
    const MOTOR_STEP = 180
    const POS = ['S', 'P', 'C', 'D']
    for (let i = 0; i < p.motorCount; i++) {
      const mx = motorStartX + i * MOTOR_STEP
      if (mx > busXEnd - 20) break
      wires.push(<line key={`w-vfd-${i}`} x1={mx} y1={busY + 12} x2={mx} y2={busY + 36} stroke={COLOR.dc} strokeWidth={STROKE.bold} />)
      nodes.push(<Converter key={`vfd-${i}`} x={mx} y={busY + 66} variant="dcac" label={`VFD${i + 1}`} />)
      wires.push(<line key={`w-vfd2-${i}`} x1={mx} y1={busY + 88} x2={mx} y2={busY + 128} stroke="#6A1B9A" strokeWidth={STROKE.bold} />)
      nodes.push(<Motor key={`mprop-${i}`} x={mx} y={busY + 148} label="M" subLabel={`PROP-${POS[i] || i + 1}`} />)
      nodes.push(
        <text key={`txt-vfd-${i}`} x={mx} y={busY + 200} textAnchor="middle" fontSize={9} fill={COLOR.ink} fontWeight={600}>
          {p.motorKw}kW · {p.acVoltage === 220 ? 440 : p.acVoltage}V
        </text>
      )
    }

    // ESS on right side
    if (p.hasEss) {
      const ex = busXEnd - 100
      wires.push(<line key="w-ess-1" x1={ex} y1={busY + 12} x2={ex} y2={busY + 36} stroke={COLOR.dc} strokeWidth={STROKE.bold} />)
      nodes.push(<Battery key="ess" x={ex} y={busY + 62} label="ESS" subLabel={`${Math.ceil(r.essTotalKwh || 10)}kWh · BMS`} />)
      nodes.push(<EMS key="ems" x={ex + 90} y={busY + 66} />)
    }
  } else if (p.hasEss && !hasDc) {
    // ESS는 있지만 DC 추진이 없을 때, 비상 버스 아래 또는 MSB 근처 표시
    const ex = PAPER_W - MARGIN - 150
    const ey = BUS_Y + 120
    wires.push(<line key="w-ess-ac" x1={ex} y1={BUS_Y + 12} x2={ex} y2={ey - 24} stroke={COLOR.ac} strokeWidth={STROKE.bold} />)
    nodes.push(<Converter key="ess-acdc" x={ex} y={ey - 24} variant="acdc" label="AC/DC" />)
    wires.push(<line key="w-ess-2" x1={ex} y1={ey - 2} x2={ex} y2={ey + 18} stroke={COLOR.dc} strokeWidth={STROKE.bold} />)
    nodes.push(<Battery key="ess-ac" x={ex} y={ey + 40} label="ESS" subLabel={`${Math.ceil(r.essTotalKwh || 10)}kWh`} />)
  }

  /* — 범례 — */
  const LEG_X = PAPER_W - MARGIN - 220
  const LEG_Y = MARGIN + 52
  const legendItems: Array<{ sym: React.ReactElement; label: string }> = [
    { sym: <circle cx={0} cy={0} r={7} fill="none" stroke={COLOR.frame} strokeWidth={1.5} />, label: '발전기 (G) / 전동기 (M)' },
    { sym: <rect x={-7} y={-5} width={14} height={10} fill="none" stroke={COLOR.frame} strokeWidth={1.5} />, label: 'ACB / MCCB' },
    { sym: <line x1={-8} y1={0} x2={8} y2={0} stroke={COLOR.ac} strokeWidth={3} />, label: `AC ${p.acVoltage}V 3PH` },
    { sym: <line x1={-8} y1={0} x2={8} y2={0} stroke={COLOR.dc} strokeWidth={3} />, label: `DC ${p.dcVoltage}V` },
    { sym: <line x1={-8} y1={0} x2={8} y2={0} stroke={COLOR.emg} strokeWidth={2} strokeDasharray="3,2" />, label: '비상/인터록' },
    { sym: <polygon points="-8,-6 8,-6 6,6 -6,6" fill="none" stroke="#6A1B9A" strokeWidth={1.5} />, label: '변환기 (AC/DC · VFD)' },
  ]
  const legendNode = (
    <g key="legend">
      <rect x={LEG_X} y={LEG_Y} width={210} height={legendItems.length * 20 + 28} fill="#FAFAFA" stroke="#90A4AE" strokeWidth={0.8} rx={3} />
      <text x={LEG_X + 10} y={LEG_Y + 16} fontSize={10} fontWeight={800} fill={COLOR.frame}>LEGEND · IEC 60617</text>
      {legendItems.map((it, i) => (
        <g key={i} transform={`translate(${LEG_X + 20},${LEG_Y + 38 + i * 20})`}>
          {it.sym}
          <text x={18} y={3} fontSize={9} fill={COLOR.ink}>{it.label}</text>
        </g>
      ))}
    </g>
  )

  /* ── 최종 SVG 반환 ────────────────────────── */
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${PAPER_W} ${PAPER_H}`}
      width="100%"
      style={{ background: '#ECEFF1', display: 'block', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      {frame}
      {wires}
      {nodes}
      {legendNode}
      <TitleBlock x={TITLE_BLOCK_X} y={TITLE_BLOCK_Y} w={TITLE_BLOCK_W} h={TITLE_BLOCK_H} meta={meta} />
    </svg>
  )
}
