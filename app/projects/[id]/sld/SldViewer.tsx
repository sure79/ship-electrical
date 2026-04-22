'use client'

import React, { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import type { Project, CalcResult, Bus } from '@/lib/types'
import SldSvg from '@/lib/sld/SldSvg'

interface Props {
  project: Project
  result: CalcResult
  buses: Bus[]
  dt: string
}

export default function SldViewer({ project, result, buses, dt }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 })

  /* ── 초기 Fit to view ────────────────────── */
  useEffect(() => {
    const fit = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const scale = Math.min(rect.width / 1684, rect.height / 1191) * 0.95
      setZoom(scale)
      setPan({ x: (rect.width - 1684 * scale) / 2, y: (rect.height - 1191 * scale) / 2 })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  /* ── 휠 줌 ────────────────────── */
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newZoom = Math.max(0.1, Math.min(4, zoom * factor))
    // 마우스 기준 확대
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const dx = (mx - pan.x) * (newZoom / zoom - 1)
      const dy = (my - pan.y) * (newZoom / zoom - 1)
      setPan(p => ({ x: p.x - dx, y: p.y - dy }))
    }
    setZoom(newZoom)
  }

  /* ── 드래그 팬 ────────────────────── */
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setPan({ x: dragStart.px + (e.clientX - dragStart.x), y: dragStart.py + (e.clientY - dragStart.y) })
  }
  const onMouseUp = () => setDragging(false)

  const doFit = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scale = Math.min(rect.width / 1684, rect.height / 1191) * 0.95
    setZoom(scale)
    setPan({ x: (rect.width - 1684 * scale) / 2, y: (rect.height - 1191 * scale) / 2 })
  }

  /* ── 내보내기 ────────────────────── */
  const exportSvg = () => {
    if (!svgRef.current) return
    const xml = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SLD_${project.hullNo || project.vesselName}_${new Date().toISOString().slice(0, 10)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPng = async () => {
    if (!svgRef.current) return
    const xml = new XMLSerializer().serializeToString(svgRef.current)
    const svg64 = btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.src = `data:image/svg+xml;base64,${svg64}`
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
    })
    const canvas = document.createElement('canvas')
    canvas.width = 1684 * 2   // 2x resolution
    canvas.height = 1191 * 2
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SLD_${project.hullNo || project.vesselName}_${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const printPdf = () => {
    window.print()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#263238', color: '#ECEFF1' }}>
      {/* Toolbar */}
      <div className="sld-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#37474F', borderBottom: '1px solid #455A64' }}>
        <Link href={`/projects/${project.id}`} style={{ color: '#B0BEC5', textDecoration: 'none', fontSize: 13 }}>
          ← 프로젝트로
        </Link>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
          🗺️ {project.vesselName} SLD · {project.classCode} · {dt}
        </div>
        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} style={tbBtn}>−</button>
        <span style={{ fontSize: 12, minWidth: 48, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(4, z * 1.2))} style={tbBtn}>＋</button>
        <button onClick={doFit} style={tbBtn}>⤢ Fit</button>
        <div style={{ width: 1, height: 20, background: '#546E7A', margin: '0 6px' }} />
        <button onClick={exportSvg} style={tbBtn}>⬇ SVG</button>
        <button onClick={exportPng} style={tbBtn}>⬇ PNG</button>
        <button onClick={printPdf} style={tbBtn}>🖨 PDF</button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', position: 'relative' }}
      >
        <div
          className="sld-print-area"
          style={{
            position: 'absolute',
            left: pan.x,
            top: pan.y,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            width: 1684,
            height: 1191,
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            background: '#fff',
          }}
        >
          <SldSvg project={project} result={result} buses={buses} dt={dt} svgRef={svgRef} />
        </div>
      </div>

      {/* Print CSS: A3 landscape */}
      <style jsx global>{`
        @media print {
          @page {
            size: A3 landscape;
            margin: 0;
          }
          body { background: white !important; }
          .sld-toolbar { display: none !important; }
          .sld-print-area {
            position: static !important;
            transform: none !important;
            box-shadow: none !important;
            width: 100% !important;
            height: 100vh !important;
          }
        }
      `}</style>
    </div>
  )
}

const tbBtn: React.CSSProperties = {
  background: '#455A64',
  color: '#ECEFF1',
  border: '1px solid #546E7A',
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600,
}
