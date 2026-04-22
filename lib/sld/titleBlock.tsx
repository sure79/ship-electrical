/* ═══════════════════════════════════════════
   KR 선급 표준 스타일 표제란 (Title Block)
═══════════════════════════════════════════ */

import React from 'react'
import type { SldMeta } from './model'

interface Props {
  x: number
  y: number
  w: number
  h: number
  meta: SldMeta
}

export function TitleBlock({ x, y, w, h, meta }: Props) {
  const rowH = h / 6
  const colW1 = w * 0.3
  const colW2 = w * 0.7
  const col2X = colW1

  const cells: Array<{ x: number; y: number; w: number; h: number; label: string; value: string; bold?: boolean }> = [
    { x: 0,       y: 0,            w: w,      h: rowH * 2, label: 'SINGLE LINE DIAGRAM', value: '', bold: true },
    { x: 0,       y: rowH * 2,     w: colW1,  h: rowH,     label: 'Vessel',  value: meta.vesselName },
    { x: col2X,   y: rowH * 2,     w: colW2,  h: rowH,     label: 'Hull No', value: meta.hullNo || '—' },
    { x: 0,       y: rowH * 3,     w: colW1,  h: rowH,     label: 'Project', value: meta.projectNo || '—' },
    { x: col2X,   y: rowH * 3,     w: colW2,  h: rowH,     label: 'Class',   value: meta.classCode },
    { x: 0,       y: rowH * 4,     w: colW1,  h: rowH,     label: 'Date',    value: meta.date },
    { x: col2X,   y: rowH * 4,     w: colW2,  h: rowH,     label: 'Rev',     value: meta.revision },
    { x: 0,       y: rowH * 5,     w: colW1,  h: rowH,     label: 'Scale',   value: meta.scale },
    { x: col2X,   y: rowH * 5,     w: colW2,  h: rowH,     label: 'Sheet',   value: `${meta.sheet.index}/${meta.sheet.total}` },
  ]

  return (
    <g transform={`translate(${x},${y})`}>
      {/* outer */}
      <rect x={0} y={0} width={w} height={h} fill="#FFFFFF" stroke="#263238" strokeWidth={1.5} />

      {cells.map((c, i) => (
        <g key={i} transform={`translate(${c.x},${c.y})`}>
          <rect x={0} y={0} width={c.w} height={c.h} fill={c.bold ? '#263238' : 'none'} stroke="#263238" strokeWidth={0.8} />
          {c.bold ? (
            <>
              <text x={c.w / 2} y={c.h / 2 - 6} textAnchor="middle" fontSize={16} fontWeight={800} fill="#FFF">
                SINGLE LINE DIAGRAM
              </text>
              <text x={c.w / 2} y={c.h / 2 + 14} textAnchor="middle" fontSize={10} fill="#CFD8DC">
                MAIN ELECTRICAL SYSTEM · {meta.acVoltage}V {meta.frequency}Hz
              </text>
            </>
          ) : (
            <>
              <text x={6} y={11} fontSize={7.5} fontWeight={700} fill="#607D8B" letterSpacing={0.5}>
                {c.label.toUpperCase()}
              </text>
              <text x={6} y={c.h - 6} fontSize={11} fontWeight={700} fill="#102027">
                {c.value}
              </text>
            </>
          )}
        </g>
      ))}
    </g>
  )
}
