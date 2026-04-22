/* ═══════════════════════════════════════════
   SLD v2 — 중간표현 (IR) 타입 정의
   사양: docs/SLD_SPEC.md
═══════════════════════════════════════════ */

export type EdgeKind = 'ac' | 'dc' | 'emg' | 'interlock' | 'signal'

export type NodeKind =
  | 'generator'
  | 'emg-generator'
  | 'shore'
  | 'fuel-cell'
  | 'pv'
  | 'ac-bus'
  | 'dc-bus'
  | 'emg-bus'
  | 'panel'
  | 'acb'
  | 'mccb'
  | 'fuse'
  | 'transformer'
  | 'choke'
  | 'converter-acdc'
  | 'converter-dcac'
  | 'converter-dcdc'
  | 'motor'
  | 'battery'
  | 'ems'
  | 'load-box'
  | 'junction'

export interface SldNode {
  id: string
  kind: NodeKind
  x: number
  y: number
  w: number
  h: number
  label?: string
  subLabel?: string
  meta?: Record<string, string | number | boolean>
  emergency?: boolean
}

export interface SldEdge {
  id: string
  kind: EdgeKind
  /** Manhattan-routed polyline — absolute coordinates. 최소 두 점 */
  points: Array<{ x: number; y: number }>
  label?: string
}

export interface SldGroup {
  id: string
  label: string
  x: number; y: number; w: number; h: number
  color?: string      // border
  bg?: string         // fill (very light)
}

export interface SldMeta {
  vesselName: string
  hullNo: string
  projectNo: string
  classCode: string
  revision: string
  date: string
  sheet: { index: number; total: number }
  scale: string
  acVoltage: number
  dcVoltage: number
  frequency: number
  paperW: number    // px
  paperH: number    // px
  margin: number    // px
}

export interface SldDiagram {
  meta: SldMeta
  nodes: SldNode[]
  edges: SldEdge[]
  groups: SldGroup[]
}
