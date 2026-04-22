/* ═══════════════════════════════════════════
   IEC 60617 기반 전기 심볼 (React SVG)
   모든 심볼은 중심을 (0,0) 기준으로 하고,
   상단·하단·좌·우 포트가 꺼내기 쉬운 기하학을 갖는다.
═══════════════════════════════════════════ */

import React from 'react'

export const COLOR = {
  ac: '#1565C0',     // AC 버스 / 라인
  dc: '#C62828',     // DC
  emg: '#E65100',    // 비상
  frame: '#263238',  // 기본 외곽선
  ink: '#102027',    // 텍스트
  muted: '#607D8B',
  fill: '#FFFFFF',
  fillAc: '#E3F2FD',
  fillDc: '#FFEBEE',
  fillEmg: '#FFF3E0',
  fillPanel: '#FAFAFA',
}

export const STROKE = {
  thin: 1,
  mid: 1.5,
  bold: 2,
  heavy: 2.5,
}

interface SymProps {
  x: number
  y: number
  label?: string
  subLabel?: string
  emergency?: boolean
}

/* ── 발전기 (G): 원 40×40 ─────────────────────── */
export function Generator({ x, y, label = 'G', subLabel, emergency }: SymProps) {
  const color = emergency ? COLOR.emg : COLOR.frame
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={0} cy={0} r={22} fill={emergency ? COLOR.fillEmg : '#FFFDE7'} stroke={color} strokeWidth={STROKE.bold} />
      <text x={0} y={6} textAnchor="middle" fontSize={18} fontWeight={700} fill={color} fontFamily="serif">
        {label}
      </text>
      {subLabel && (
        <text x={0} y={44} textAnchor="middle" fontSize={10} fontWeight={600} fill={COLOR.ink}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 전동기 (M) ─────────────────────── */
export function Motor({ x, y, label = 'M', subLabel, emergency }: SymProps) {
  const color = emergency ? COLOR.emg : COLOR.frame
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={0} cy={0} r={18} fill={COLOR.fill} stroke={color} strokeWidth={STROKE.bold} />
      <text x={0} y={5} textAnchor="middle" fontSize={15} fontWeight={700} fill={color} fontFamily="serif">
        {label}
      </text>
      {subLabel && (
        <text x={0} y={36} textAnchor="middle" fontSize={9} fontWeight={600} fill={COLOR.ink}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── ACB (공기차단기) ─────────────────────── */
export function ACB({ x, y, label = 'ACB', subLabel, emergency }: SymProps) {
  const color = emergency ? COLOR.emg : COLOR.frame
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-22} y={-16} width={44} height={32} fill={COLOR.fill} stroke={color} strokeWidth={STROKE.heavy} />
      {/* 3상 접점 표기 */}
      {[-10, 0, 10].map((cx, i) => (
        <line key={i} x1={cx} y1={-10} x2={cx} y2={10} stroke={color} strokeWidth={STROKE.mid} />
      ))}
      {/* 트립 인디케이터 */}
      <line x1={-14} y1={-14} x2={-6} y2={-6} stroke={color} strokeWidth={STROKE.mid} />
      {label && (
        <text x={0} y={28} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
          {label}
        </text>
      )}
      {subLabel && (
        <text x={0} y={40} textAnchor="middle" fontSize={8} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── MCCB (배선용 차단기) ─────────────────────── */
export function MCCB({ x, y, label = 'MCCB', subLabel, emergency }: SymProps) {
  const color = emergency ? COLOR.emg : COLOR.frame
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-14} y={-10} width={28} height={20} fill={COLOR.fill} stroke={color} strokeWidth={STROKE.bold} />
      {/* 트립 기울어진 선 (IEC 60617 MCCB 표기) */}
      <line x1={-10} y1={6} x2={10} y2={-6} stroke={color} strokeWidth={STROKE.mid} />
      {/* 3상 표기 (짧은 직교선) */}
      <line x1={-8} y1={-6} x2={-8} y2={-10} stroke={color} strokeWidth={1} />
      <line x1={0} y1={-6} x2={0} y2={-10} stroke={color} strokeWidth={1} />
      <line x1={8} y1={-6} x2={8} y2={-10} stroke={color} strokeWidth={1} />
      {label && (
        <text x={0} y={21} textAnchor="middle" fontSize={8} fontWeight={700} fill={color}>
          {label}
        </text>
      )}
      {subLabel && (
        <text x={0} y={31} textAnchor="middle" fontSize={7.5} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 퓨즈 ─────────────────────── */
export function Fuse({ x, y, label, subLabel }: SymProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-5} y={-12} width={10} height={24} fill={COLOR.fill} stroke={COLOR.frame} strokeWidth={STROKE.bold} />
      <line x1={0} y1={-12} x2={0} y2={12} stroke={COLOR.frame} strokeWidth={STROKE.thin} />
      {label && (
        <text x={12} y={-2} textAnchor="start" fontSize={8} fontWeight={700} fill={COLOR.frame}>
          {label}
        </text>
      )}
      {subLabel && (
        <text x={12} y={8} textAnchor="start" fontSize={7.5} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 변압기 (이중 원, 수직 배치) ─────────────────────── */
export function Transformer({ x, y, label = 'TR', subLabel }: SymProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={0} cy={-8} r={12} fill="none" stroke={COLOR.frame} strokeWidth={STROKE.bold} />
      <circle cx={0} cy={8} r={12} fill="none" stroke={COLOR.frame} strokeWidth={STROKE.bold} />
      <line x1={0} y1={-20} x2={0} y2={-24} stroke={COLOR.frame} strokeWidth={STROKE.bold} />
      <line x1={0} y1={20} x2={0} y2={24} stroke={COLOR.frame} strokeWidth={STROKE.bold} />
      {label && (
        <text x={20} y={-4} textAnchor="start" fontSize={9} fontWeight={700} fill={COLOR.frame}>
          {label}
        </text>
      )}
      {subLabel && (
        <text x={20} y={7} textAnchor="start" fontSize={8} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 변환기 (AC/DC, DC/AC, DC/DC) — 사다리꼴 ─────────────────────── */
interface ConverterProps extends SymProps {
  variant: 'acdc' | 'dcac' | 'dcdc'
}
export function Converter({ x, y, variant, label, subLabel }: ConverterProps) {
  const fill =
    variant === 'acdc' ? COLOR.fillAc :
    variant === 'dcac' ? '#F3E5F5' :
    '#FFF8E1'
  const stroke =
    variant === 'acdc' ? COLOR.ac :
    variant === 'dcac' ? '#6A1B9A' :
    '#F9A825'
  const symbol =
    variant === 'acdc' ? '~ / =' :
    variant === 'dcac' ? '= / ~' :
    '= / ='
  return (
    <g transform={`translate(${x},${y})`}>
      <polygon
        points="-26,-18 26,-18 20,18 -20,18"
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE.bold}
      />
      <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill={stroke} fontFamily="serif">
        {symbol}
      </text>
      {label && (
        <text x={0} y={30} textAnchor="middle" fontSize={9} fontWeight={700} fill={stroke}>
          {label}
        </text>
      )}
      {subLabel && (
        <text x={0} y={42} textAnchor="middle" fontSize={8} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 초크 / LC 필터 ─────────────────────── */
export function Choke({ x, y, label = 'CHOKE' }: SymProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      {[-10, -3, 4, 11].map((cx, i) => (
        <path key={i} d={`M ${cx},-4 a 3.5,4 0 0 1 7,0`} fill="none" stroke={COLOR.frame} strokeWidth={STROKE.bold} />
      ))}
      <text x={0} y={14} textAnchor="middle" fontSize={8} fontWeight={700} fill={COLOR.frame}>
        {label}
      </text>
    </g>
  )
}

/* ── 배터리 / ESS — 짧은·긴 선 교차 ─────────────────────── */
export function Battery({ x, y, label = 'ESS', subLabel }: SymProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-32} y={-22} width={64} height={44} rx={3} fill="#E8F5E9" stroke="#2E7D32" strokeWidth={STROKE.bold} />
      {/* 배터리 기호 */}
      <line x1={-18} y1={-10} x2={-18} y2={10} stroke="#1B5E20" strokeWidth={3} />
      <line x1={-10} y1={-6} x2={-10} y2={6} stroke="#1B5E20" strokeWidth={STROKE.mid} />
      <line x1={0} y1={-10} x2={0} y2={10} stroke="#1B5E20" strokeWidth={3} />
      <line x1={8} y1={-6} x2={8} y2={6} stroke="#1B5E20" strokeWidth={STROKE.mid} />
      <line x1={18} y1={-10} x2={18} y2={10} stroke="#1B5E20" strokeWidth={3} />
      <text x={0} y={34} textAnchor="middle" fontSize={9} fontWeight={800} fill="#1B5E20">
        {label}
      </text>
      {subLabel && (
        <text x={0} y={46} textAnchor="middle" fontSize={8} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 육전 (Shore) ─────────────────────── */
export function Shore({ x, y, label = 'SHORE', subLabel }: SymProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-30} y={-16} width={60} height={32} rx={4} fill="#E1F5FE" stroke="#0277BD" strokeWidth={STROKE.bold} />
      <path d="M -14,0 L 14,0 M 14,0 L 8,-4 M 14,0 L 8,4" stroke="#01579B" strokeWidth={STROKE.heavy} fill="none" />
      <text x={0} y={28} textAnchor="middle" fontSize={9} fontWeight={800} fill="#01579B">
        {label}
      </text>
      {subLabel && (
        <text x={0} y={40} textAnchor="middle" fontSize={8} fill={COLOR.muted}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 패널 / 분전반 박스 ─────────────────────── */
interface PanelProps extends SymProps {
  w: number
  h: number
}
export function Panel({ x, y, w, h, label, subLabel, emergency }: PanelProps) {
  const stroke = emergency ? COLOR.emg : COLOR.frame
  const fill = emergency ? COLOR.fillEmg : COLOR.fillPanel
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={STROKE.bold} rx={2} />
      {/* 타이틀 밴드 */}
      <rect x={0} y={0} width={w} height={16} fill={stroke} opacity={0.85} />
      <text x={w / 2} y={12} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#FFF">
        {label}
      </text>
      {subLabel && (
        <text x={w / 2} y={h / 2 + 6} textAnchor="middle" fontSize={9} fill={COLOR.ink}>
          {subLabel}
        </text>
      )}
    </g>
  )
}

/* ── 버스바 ─────────────────────── */
interface BusProps {
  x: number
  y: number
  w: number
  label: string
  kind: 'ac' | 'dc' | 'emg'
}
export function BusBar({ x, y, w, label, kind }: BusProps) {
  const fill =
    kind === 'ac' ? COLOR.ac :
    kind === 'dc' ? COLOR.dc :
    COLOR.emg
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={12} fill={fill} />
      <rect x={0} y={0} width={w} height={12} fill="none" stroke="#000" strokeWidth={0.5} />
      <text x={12} y={9} fontSize={9.5} fontWeight={800} fill="#FFF" fontFamily="monospace">
        {label}
      </text>
    </g>
  )
}

/* ── 부하 상자 (명판) ─────────────────────── */
interface LoadBoxProps {
  x: number
  y: number
  w: number
  h: number
  lines: string[]
  emergency?: boolean
}
export function LoadBox({ x, y, w, h, lines, emergency }: LoadBoxProps) {
  const stroke = emergency ? COLOR.emg : COLOR.frame
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={h} fill="#FFFEF7" stroke={stroke} strokeWidth={STROKE.thin} rx={1.5} />
      {lines.map((ln, i) => (
        <text
          key={i}
          x={w / 2}
          y={12 + i * 11}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={i === 0 ? 700 : 400}
          fill={COLOR.ink}
        >
          {ln}
        </text>
      ))}
    </g>
  )
}

/* ── 와이어 접속점 ─────────────────────── */
export function Junction({ x, y, kind = 'ac' }: { x: number; y: number; kind?: 'ac' | 'dc' | 'emg' }) {
  const fill = kind === 'ac' ? COLOR.ac : kind === 'dc' ? COLOR.dc : COLOR.emg
  return <circle cx={x} cy={y} r={3} fill={fill} />
}

/* ── EMS 박스 ─────────────────────── */
export function EMS({ x, y, label = 'EMS', subLabel = 'Energy Mgmt.' }: SymProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-32} y={-14} width={64} height={28} rx={3} fill="#E8F5E9" stroke="#388E3C" strokeWidth={STROKE.mid} />
      <text x={0} y={-1} textAnchor="middle" fontSize={9} fontWeight={800} fill="#1B5E20">
        {label}
      </text>
      <text x={0} y={10} textAnchor="middle" fontSize={7.5} fill={COLOR.muted}>
        {subLabel}
      </text>
    </g>
  )
}
