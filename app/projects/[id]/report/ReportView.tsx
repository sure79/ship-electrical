'use client'

import React from 'react'
import Link from 'next/link'
import type { LoadBalanceReport, ScenarioResult, RiskItem, RecommendationItem } from '@/lib/reportScenarios'
import type {
  ElaFullResult, ElaModeResult, NMinusOneResult,
  LoadSheddingPlan, MotorStartingItem, ElaWarning,
} from '@/lib/ela'

interface Props {
  report: LoadBalanceReport
  projectId: string
  ela: ElaFullResult
  nMinusOne: NMinusOneResult[]
  shedding: LoadSheddingPlan[]
  motorStarting: MotorStartingItem[]
  warnings: ElaWarning[]
}

/* ── 색상 팔레트 (운전 조건별) ────────────────── */
const SCENARIO_COLORS: Record<string, { main: string; light: string; dark: string }> = {
  sea:     { main: '#1976D2', light: '#E3F2FD', dark: '#0D47A1' },
  arrival: { main: '#7B1FA2', light: '#F3E5F5', dark: '#4A148C' },
  cargo:   { main: '#F57C00', light: '#FFF3E0', dark: '#E65100' },
  harbor:  { main: '#388E3C', light: '#E8F5E9', dark: '#1B5E20' },
}

const VERDICT_COLORS: Record<ScenarioResult['verdict'], { bg: string; fg: string; border: string }> = {
  safe:    { bg: '#FFF3E0', fg: '#E65100', border: '#FFB74D' },
  ok:      { bg: '#E8F5E9', fg: '#2E7D32', border: '#81C784' },
  warn:    { bg: '#FFFDE7', fg: '#F57F17', border: '#FFD54F' },
  caution: { bg: '#FFF3E0', fg: '#E65100', border: '#FFB74D' },
  risk:    { bg: '#FFEBEE', fg: '#C62828', border: '#EF5350' },
}

const SEVERITY_COLORS: Record<RiskItem['severity'], { bg: string; fg: string }> = {
  LOW:      { bg: '#E8F5E9', fg: '#2E7D32' },
  MEDIUM:   { bg: '#FFF3E0', fg: '#E65100' },
  HIGH:     { bg: '#FFEBEE', fg: '#C62828' },
  CRITICAL: { bg: '#B71C1C', fg: '#FFFFFF' },
}

/* ── 도넛 차트 ────────────────── */
function DonutChart({ pct, color, size = 140 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 12
  const circ = 2 * Math.PI * r
  const pctClamped = Math.max(0, Math.min(100, pct))
  const dash = (pctClamped / 100) * circ
  const cx = size / 2
  const cy = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E0E0E0" strokeWidth={12} />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s' }}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size / 5.5} fontWeight={800} fill="#212121">
        {pct.toFixed(1)}%
      </text>
      <text x={cx} y={cy + size / 6.5} textAnchor="middle" fontSize={10} fill="#757575">
        Load Factor
      </text>
    </svg>
  )
}

/* ── 바 차트 ────────────────── */
function BarChart({ scenarios }: { scenarios: ScenarioResult[] }) {
  const maxPct = Math.max(100, ...scenarios.map(s => s.loadFactorPct))
  const W = 640
  const H = 200
  const pad = { t: 24, r: 20, b: 52, l: 40 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const barW = innerW / scenarios.length - 24

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block' }}>
      {/* y축 눈금 */}
      {[0, 25, 50, 75, 100].map(y => {
        const yy = pad.t + innerH - (y / maxPct) * innerH
        return (
          <g key={y}>
            <line x1={pad.l} y1={yy} x2={pad.l + innerW} y2={yy} stroke="#E0E0E0" strokeDasharray="2,2" />
            <text x={pad.l - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#999">{y}%</text>
          </g>
        )
      })}
      {/* 위험선 (85%) */}
      {(() => {
        const yy = pad.t + innerH - (85 / maxPct) * innerH
        return (
          <g>
            <line x1={pad.l} y1={yy} x2={pad.l + innerW} y2={yy} stroke="#D32F2F" strokeWidth={1} strokeDasharray="4,3" />
            <text x={pad.l + innerW - 4} y={yy - 3} textAnchor="end" fontSize={9} fill="#D32F2F" fontWeight={700}>
              85% 주의선
            </text>
          </g>
        )
      })()}

      {scenarios.map((s, i) => {
        const x = pad.l + 12 + i * (innerW / scenarios.length)
        const h = (s.loadFactorPct / maxPct) * innerH
        const y = pad.t + innerH - h
        const color = SCENARIO_COLORS[s.key].main
        return (
          <g key={s.key}>
            <rect x={x} y={y} width={barW} height={h} fill={color} rx={3} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={800} fill={color}>
              {s.loadFactorPct.toFixed(1)}%
            </text>
            <text x={x + barW / 2} y={pad.t + innerH + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#424242">
              {s.icon} {s.label}
            </text>
            <text x={x + barW / 2} y={pad.t + innerH + 32} textAnchor="middle" fontSize={9} fill="#757575">
              {s.requiredKw.toFixed(0)} kW / {s.genCapacityKw} kW
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ReportView({ report, projectId, ela, nMinusOne, shedding, motorStarting, warnings }: Props) {
  const printReport = () => window.print()
  const anyN1Fail = nMinusOne.some(n => n.applicable && n.verdict === 'fail')
  const anyShedResolved = shedding.some(s => s.deficitKw > 0)
  const anyMotorHigh = motorStarting.some(m => m.verdict === 'danger' || m.verdict === 'warning')

  return (
    <div style={{ background: '#F5F5F5', minHeight: '100vh', padding: '16px 0' }}>
      {/* Toolbar */}
      <div className="report-toolbar" style={{
        maxWidth: 920, margin: '0 auto 16px',
        background: '#263238', color: '#ECEFF1',
        borderRadius: 8, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href={`/projects/${projectId}`} style={{ color: '#B0BEC5', textDecoration: 'none', fontSize: 13 }}>
          ← 프로젝트로
        </Link>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
          Electric Load Balance 운영성 검토 보고서
        </div>
        <button onClick={printReport} style={{
          background: '#00BCD4', color: '#263238', border: 'none',
          padding: '6px 14px', borderRadius: 4, fontSize: 13, fontWeight: 800, cursor: 'pointer',
        }}>
          🖨 인쇄/PDF
        </button>
      </div>

      {/* Page 1 — Executive Summary */}
      <Page pageNum={1} section="요약">
        <Header report={report} />

        <h2 style={h2}>1. Executive Summary</h2>

        <div style={{
          background: report.overallVerdict.tone === 'safe' ? '#E8F5E9' : report.overallVerdict.tone === 'caution' ? '#FFF3E0' : '#FFEBEE',
          border: `1px solid ${report.overallVerdict.tone === 'safe' ? '#81C784' : report.overallVerdict.tone === 'caution' ? '#FFB74D' : '#EF5350'}`,
          borderLeft: `5px solid ${report.overallVerdict.tone === 'safe' ? '#2E7D32' : report.overallVerdict.tone === 'caution' ? '#E65100' : '#C62828'}`,
          borderRadius: 6, padding: '14px 18px', marginBottom: 18,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, color: '#212121' }}>
            {report.overallVerdict.title}
          </div>
          <ul style={{ fontSize: 13, color: '#424242', margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {report.overallVerdict.summary.map((s, i) => (<li key={i}>{s}</li>))}
          </ul>
        </div>

        {/* 시나리오 요약 테이블 */}
        <table style={tbl}>
          <thead>
            <tr style={{ background: '#263238' }}>
              <th style={{ ...th, textAlign: 'left' }}>운전 조건</th>
              <th style={th}>요구 전력 (kW)</th>
              <th style={th}>발전기 운전</th>
              <th style={th}>부하율</th>
              <th style={th}>평가</th>
            </tr>
          </thead>
          <tbody>
            {report.scenarios.map(s => {
              const vc = VERDICT_COLORS[s.verdict]
              const sc = SCENARIO_COLORS[s.key]
              return (
                <tr key={s.key} style={{ borderBottom: '1px solid #E0E0E0' }}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    <span style={{ color: sc.main }}>{s.icon}</span> {s.label}
                    <div style={{ fontSize: 10, color: '#757575', fontWeight: 400 }}>{s.description}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace', fontWeight: 700 }}>
                    {s.requiredKw.toFixed(2)}
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace' }}>
                    {report.genSelKw} kW × {s.genRunCount}대
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: sc.main, fontSize: 14 }}>
                    {s.loadFactorPct.toFixed(1)}%
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 11,
                      fontSize: 11, fontWeight: 700,
                      background: vc.bg, color: vc.fg, border: `1px solid ${vc.border}`,
                    }}>
                      {s.verdictLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* 부하율 바차트 */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#424242' }}>
            운전조건별 부하율 (Load Ratio)
          </div>
          <BarChart scenarios={report.scenarios} />
        </div>

        {/* 핵심 포인트 */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <KeyPoint icon="⚠️" title="최대 부하율"
            body={`${report.maxLoadFactor.toFixed(1)}% (${report.scenarios.find(s => s.key === report.bindingScenario)?.label})`} />
          <KeyPoint icon="🚨" title="Load Shedding"
            body={report.risks.some(r => r.title.includes('Shedding') || r.title.includes('N-1'))
              ? '계획 수립 필요'
              : '현 설계 적정'} />
          <KeyPoint icon="⚡" title="Motor Starting"
            body={report.risks.some(r => r.title.includes('모터'))
              ? '검토 필요 (기동영향)'
              : '영향 미미'} />
        </div>
      </Page>

      {/* Page 2 — 운전조건별 상세 분석 */}
      <Page pageNum={2} section="상세 분석">
        <Header report={report} compact />
        <h2 style={h2}>2. 운전조건별 상세 분석</h2>
        <div style={{ fontSize: 12, color: '#757575', marginBottom: 16 }}>
          운전 모드별 요구전력, 주요 부하, 운영상 해석
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
          {report.scenarios.map(s => <ScenarioCard key={s.key} scenario={s} unitKw={report.genSelKw} />)}
        </div>

        <div style={{
          marginTop: 20, padding: '12px 16px',
          background: '#FAFAFA', border: '1px solid #E0E0E0', borderRadius: 6,
          fontSize: 11.5, color: '#555', lineHeight: 1.7,
        }}>
          <b>평가 기준:</b> 부하율 ≥ 90% 위험, 85~90% 주의, 70~85% 관리 필요, 45~70% 안정적, 25~45% 경부하.<br/>
          <b>요구전력 산정</b>: <code style={{ background:'#fff', padding:'1px 4px', border:'1px solid #ddd', borderRadius:3 }}>Σ (부하 kW × 수요율 / 효율)</code> —
          각 부하의 수요율은 부하 입력 탭에서 사용자가 직접 지정한 값(항해/출입항/하역/정박)을 그대로 사용.
          출입항·정박 수요율 미입력 시에는 해당 모드를 0으로 계산하며, 상단 카드의 <b>사용자 입력 수요율 %</b>로 입력 완성도를 확인 가능.<br/>
          <b>발전기 대수</b>: 부하율 ≤ 85% 를 만족하는 최소 대수로 자동 선정 (범위: 1 ~ {report.genCount}대)
        </div>
      </Page>

      {/* Page 3a — IACS ELA 분석 (continuous + intermittent / Diversity) */}
      <Page pageNum={3} section="ELA 분석">
        <Header report={report} compact />
        <h2 style={h2}>3. Electric Load Balance (ELA) · IACS 방식</h2>
        <div style={{ fontSize: 12, color: '#757575', marginBottom: 16 }}>
          사용자 입력 발전기 운전 대수 · Diversity Factor 기준 · 요구전력 = 연속부하 + 간헐부하 ÷ DF
        </div>

        <table style={tbl}>
          <thead>
            <tr style={{ background: '#1B5E20' }}>
              <th style={{ ...th, textAlign: 'left' }}>운전 조건</th>
              <th style={th}>연속부하 (kW)</th>
              <th style={th}>간헐부하 (kW)</th>
              <th style={th}>DF</th>
              <th style={th}>요구전력 (kW)</th>
              <th style={th}>발전기 운전</th>
              <th style={th}>가용전력 (kW)</th>
              <th style={th}>부하율</th>
              <th style={th}>판단</th>
            </tr>
          </thead>
          <tbody>
            {ela.modes.map(m => {
              const c = m.judgment
              return (
                <tr key={m.mode} style={{ borderBottom: '1px solid #E0E0E0' }}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {m.icon} {m.label}
                    <div style={{ fontSize: 10, color: '#757575', fontWeight: 400 }}>{m.labelEn}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{m.continuousKw.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{m.intermittentKw.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace' }}>{m.diversityFactor.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace', fontWeight: 800 }}>{m.requiredKw.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace' }}>{m.genUnitKw.toFixed(0)} kW × {m.runningGenCount}대</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{m.availableKw.toFixed(0)}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: c.color, fontSize: 14 }}>{m.loadRatioPct.toFixed(2)}%</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 11,
                      fontSize: 11, fontWeight: 700,
                      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                    }}>{c.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ELA 모드별 요약 카드 */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {ela.modes.map(m => <ElaModeCard key={m.mode} m={m} />)}
        </div>

        <div style={{
          marginTop: 18, padding: '12px 16px',
          background: '#F1F8E9', border: '1px solid #AED581', borderRadius: 6,
          fontSize: 11.5, color: '#33691E', lineHeight: 1.75,
        }}>
          <b>ELA 계산식 (IACS/KR 표준):</b><br/>
          · 연속부하 = Σ(부하 kW × 수량 × 수요율) [loadKind=continuous]<br/>
          · 간헐부하 = Σ(부하 kW × 수량 × 수요율) [loadKind=intermittent]<br/>
          · <b>요구전력 = 연속부하 + 간헐부하 ÷ Diversity Factor</b> (DF 기본 1.8, 운전조건별 조정 가능)<br/>
          · 부하율 = 요구전력 ÷ (발전기 1대 kW × 운전 대수) × 100<br/>
          · 발전기 운전 대수는 사용자가 운전조건별로 지정 (계통 설정 탭의 ELA 카드 참고)
        </div>
      </Page>

      {/* Page 3b — N-1 검토 */}
      <Page pageNum={4} section="N-1 검토">
        <Header report={report} compact />
        <h2 style={h2}>4. N-1 검토 (발전기 1대 탈락 시 잔여 용량)</h2>
        <div style={{ fontSize: 12, color: '#757575', marginBottom: 16 }}>
          병렬 운전 중 발전기 1대 탈락 시 나머지 발전기가 부하를 감당 가능한지 검토. 1대 운전 시는 대상 아님.
        </div>

        <table style={tbl}>
          <thead>
            <tr style={{ background: '#6A1B9A' }}>
              <th style={{ ...th, textAlign: 'left' }}>운전 조건</th>
              <th style={th}>정상 운전 대수</th>
              <th style={th}>1대 탈락 후 용량</th>
              <th style={th}>필요 전력</th>
              <th style={th}>부족분</th>
              <th style={th}>N-1 부하율</th>
              <th style={th}>판정</th>
            </tr>
          </thead>
          <tbody>
            {nMinusOne.map(n => {
              const pass = n.verdict === 'pass'
              const na = !n.applicable
              const color = na ? '#9E9E9E' : pass ? '#2E7D32' : '#C62828'
              const bg = na ? '#F5F5F5' : pass ? '#E8F5E9' : '#FFEBEE'
              return (
                <tr key={n.mode} style={{ borderBottom: '1px solid #E0E0E0' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{n.label}</td>
                  <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace' }}>{n.runCount}대</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{n.remainingKw.toFixed(0)} kW</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{n.requiredKw.toFixed(2)} kW</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace', color: n.deficitKw > 0 ? '#C62828' : '#424242', fontWeight: n.deficitKw > 0 ? 800 : 400 }}>
                    {na ? '—' : n.deficitKw > 0 ? `+${n.deficitKw.toFixed(2)}` : '0.00'}
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 800 }}>
                    {na ? '—' : `${n.loadRatioPct.toFixed(1)}%`}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 11, fontSize: 11, fontWeight: 700, background: bg, color }}>
                      {na ? '대상 아님' : pass ? '만족' : '부족'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nMinusOne.filter(n => n.applicable).map(n => (
            <div key={n.mode} style={{
              padding: '10px 14px',
              background: n.verdict === 'pass' ? '#E8F5E9' : '#FFEBEE',
              border: `1px solid ${n.verdict === 'pass' ? '#81C784' : '#EF5350'}`,
              borderLeft: `5px solid ${n.verdict === 'pass' ? '#2E7D32' : '#C62828'}`,
              borderRadius: 6, fontSize: 12, color: '#212121', lineHeight: 1.6,
            }}>
              {n.message}
            </div>
          ))}
        </div>
      </Page>

      {/* Page 3c — Load Shedding */}
      <Page pageNum={5} section="Load Shedding">
        <Header report={report} compact />
        <h2 style={h2}>5. Load Shedding 계획</h2>
        <div style={{ fontSize: 12, color: '#757575', marginBottom: 16 }}>
          N-1 부족분 발생 시 우선순위(priority)가 낮은 <b>차단 가능(isSheddable)</b> 부하부터 자동 선정. 각 부하의 차단 가능 여부와 우선순위는 부하 입력 탭에서 지정.
        </div>

        {shedding.filter(s => s.deficitKw > 0).length === 0 ? (
          <div style={{ padding: 24, background: '#E8F5E9', border: '1px solid #81C784', borderRadius: 6, color: '#2E7D32', fontWeight: 700, textAlign: 'center' }}>
            ✅ 모든 운전조건에서 N-1 부족분이 없습니다. Load Shedding 계획 불필요.
          </div>
        ) : shedding.filter(s => s.deficitKw > 0).map(s => <ShedBlock key={s.mode} plan={s} />)}
      </Page>

      {/* Page 3d — Motor Starting */}
      <Page pageNum={6} section="Motor Starting">
        <Header report={report} compact />
        <h2 style={h2}>6. Motor Starting 검토 (전압강하 리스크)</h2>
        <div style={{ fontSize: 12, color: '#757575', marginBottom: 16 }}>
          대형 모터(≥50kW 또는 기동배수 &gt;2) 기동 시 발전기 전압강하/주파수 변동 위험 평가. 기준: 정상 항해 운전 대수 기준 가용 kVA.
        </div>

        {motorStarting.length === 0 ? (
          <div style={{ padding: 24, background: '#E8F5E9', border: '1px solid #81C784', borderRadius: 6, color: '#2E7D32', fontWeight: 700, textAlign: 'center' }}>
            ✅ 50kW 이상 직입 기동 대상 모터가 없습니다.
          </div>
        ) : (
          <>
            <table style={tbl}>
              <thead>
                <tr style={{ background: '#E65100' }}>
                  <th style={{ ...th, textAlign: 'left' }}>장비명</th>
                  <th style={th}>정격 kW</th>
                  <th style={th}>기동방식</th>
                  <th style={th}>기동 배수</th>
                  <th style={th}>기동 kVA</th>
                  <th style={th}>가용 kVA</th>
                  <th style={th}>Starting Ratio</th>
                  <th style={th}>판정</th>
                </tr>
              </thead>
              <tbody>
                {motorStarting.map(m => {
                  const col = MOTOR_COLOR[m.verdict]
                  return (
                    <tr key={m.circuitNo || m.name} style={{ borderBottom: '1px solid #E0E0E0' }}>
                      <td style={{ ...td, fontWeight: 700 }}>
                        {m.circuitNo && <span style={{ color: '#757575', fontSize: 10, marginRight: 4 }}>{m.circuitNo}</span>}
                        {m.name}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{m.kw.toFixed(1)}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{m.startType}</td>
                      <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace' }}>×{m.startingMultiplier.toFixed(1)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{m.startingKva.toFixed(1)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{m.availableKvaSea.toFixed(0)}</td>
                      <td style={{ ...td, textAlign: 'center', fontFamily: 'Consolas, monospace', fontWeight: 800, color: col.color }}>{m.startingRatioPct.toFixed(1)}%</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 11, fontSize: 11, fontWeight: 700, background: col.bg, color: col.color }}>{m.verdictLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {motorStarting.filter(m => m.verdict === 'danger' || m.verdict === 'warning').map(m => {
                const col = MOTOR_COLOR[m.verdict]
                return (
                  <div key={m.circuitNo || m.name} style={{
                    padding: '8px 12px', background: col.bg, border: `1px solid ${col.border}`,
                    borderLeft: `5px solid ${col.color}`, borderRadius: 6,
                    fontSize: 11.5, color: '#212121', lineHeight: 1.55,
                  }}>
                    {m.message}
                  </div>
                )
              })}
            </div>

            <div style={{
              marginTop: 18, padding: '12px 16px',
              background: '#FAFAFA', border: '1px solid #E0E0E0', borderRadius: 6,
              fontSize: 11, color: '#555', lineHeight: 1.7,
            }}>
              <b>계산식:</b> 기동 kVA ≈ (정격 kW ÷ (PF × η)) × 기동배수 · Starting Ratio = 기동 kVA ÷ 가용 kVA × 100<br/>
              <b>기준:</b> 0~20% 안정 · 20~35% 주의 · 35~50% 경고 · 50% 이상 위험 · 기본 배수(DOL 6 / Y-D 2.5 / SSR 3 / VFD 1.5)
            </div>
          </>
        )}
      </Page>

      {/* Page 3 — 운영 리스크 및 개선 권고사항 */}
      <Page pageNum={7} section="리스크 및 권고">
        <Header report={report} compact />
        <h2 style={h2}>3. 운영 리스크 및 개선 권고사항</h2>
        <div style={{ fontSize: 12, color: '#757575', marginBottom: 16 }}>
          실제 운전 시 예상 리스크와 권고 조치 · 모든 분석은 사용자 입력값 + 표준 전기 공학 공식 기반
        </div>

        <div style={{
          background: '#ECEFF1', border: '1px solid #B0BEC5', borderRadius: 6,
          padding: '12px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#263238', marginBottom: 6 }}>
            📐 분석 방법론 (Methodology)
          </div>
          <div style={{ fontSize: 10.5, color: '#37474F', lineHeight: 1.7, fontFamily: 'Consolas, monospace' }}>
            <div>· <b>요구전력 산정</b>: {report.methodology.formula}</div>
            <div>· <b>발전기 선정</b>: {report.methodology.genSelectionRule}</div>
            <div>· <b>평가 기준</b>: {report.methodology.verdictThresholds}</div>
            <div>· <b>입력 데이터</b>: 사용자 등록 부하 {report.totalLoadsInput}개 · 발전기 {report.genSelKw}kW × {report.genCount}대 · PF {(report.genSelKw/(report.genSelKva||1)).toFixed(2)}</div>
            <div>· <b>휴리스틱 없음</b>: 부하별 수요율은 전부 사용자 직접 입력값만 사용</div>
          </div>
        </div>

        <h3 style={h3}>주요 운영 리스크</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {report.risks.length === 0 && (
            <div style={{ padding: 24, background: '#E8F5E9', border: '1px solid #81C784', borderRadius: 6, color: '#2E7D32', fontWeight: 700, textAlign: 'center' }}>
              ✅ 주요 운영 리스크가 감지되지 않았습니다.
            </div>
          )}
          {report.risks.map(r => <RiskCard key={r.id} risk={r} />)}
        </div>

        <h3 style={h3}>개선 권고사항</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
          {report.recommendations.map(c => <RecCard key={c.id} rec={c} />)}
        </div>

        <h3 style={h3}>최종 종합 의견</h3>
        <div style={{
          background: report.overallVerdict.tone === 'safe' ? '#E8F5E9' : report.overallVerdict.tone === 'caution' ? '#FFF3E0' : '#FFEBEE',
          border: '1px solid ' + (report.overallVerdict.tone === 'safe' ? '#81C784' : report.overallVerdict.tone === 'caution' ? '#FFB74D' : '#EF5350'),
          borderRadius: 6, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
            {report.overallVerdict.title}
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: '#424242', margin: 0 }}>
            <b>Electric Load Balance</b>는 설계상 운항 가능한 상태이나,
            {report.risks.length > 0 ? ` 총 ${report.risks.length}개의 운영 리스크가 확인되었습니다.` : ' 주요 리스크는 식별되지 않았습니다.'}
            {' '}최대 부하율은 <b style={{color:'#C62828'}}>{report.maxLoadFactor.toFixed(1)}%</b>
            ({report.scenarios.find(s => s.key === report.bindingScenario)?.label})이며,
            {' '}이 구간에서 대형 부하 기동과 N-1 조건에 대한 대응이 필요합니다.
            {' '}상기 권고사항을 반영하여 <b>Load Shedding 계획 수립</b>,
            {' '}<b>Motor Starting Study</b>,
            {' '}<b>운영 매뉴얼 보완</b>을 진행하시기 바랍니다.
          </p>
        </div>

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: '#999' }}>
          본 보고서는 현 설계 데이터 기반 자동 분석 결과이며, 실제 운항 환경에서의 검증이 별도 수행되어야 합니다.<br/>
          생성일시: {report.generatedAt} | 선급: {report.classCode}
        </div>
      </Page>

      {/* 인쇄 CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body { background: white !important; }
          .report-toolbar { display: none !important; }
          .report-page {
            box-shadow: none !important;
            margin: 0 auto !important;
            page-break-after: always;
          }
          .report-page:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  )
}

/* ── 페이지 래퍼 ────────────────── */
function Page({ children, pageNum, section }: { children: React.ReactNode; pageNum: number; section: string }) {
  return (
    <div className="report-page" style={{
      maxWidth: 920, margin: '0 auto 16px', background: '#FFF',
      padding: '32px 40px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      borderRadius: 6, position: 'relative', minHeight: 1100,
    }}>
      {children}
      <div style={{
        position: 'absolute', bottom: 16, left: 40, right: 40,
        borderTop: '1px solid #E0E0E0', paddingTop: 8,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: '#9E9E9E',
      }}>
        <span>Electric Load Balance Report</span>
        <span>Page {pageNum} · {section}</span>
      </div>
    </div>
  )
}

/* ── 상단 헤더 (배 + 발전기 정보) ────────────────── */
function Header({ report, compact }: { report: LoadBalanceReport; compact?: boolean }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
      color: '#FFF', borderRadius: 8, padding: compact ? '14px 20px' : '20px 24px',
      marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20,
    }}>
      <div style={{ fontSize: compact ? 28 : 36 }}>🚢</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: compact ? 11 : 12, opacity: 0.85, letterSpacing: 2, fontWeight: 600 }}>
          {report.classCode}급 {report.vesselType} · Electric Load Balance
        </div>
        <div style={{ fontSize: compact ? 16 : 20, fontWeight: 800, marginTop: 2 }}>
          {report.vesselName}
          {report.hullNo && <span style={{ fontSize: compact ? 12 : 14, opacity: 0.8, marginLeft: 10 }}>Hull {report.hullNo}</span>}
          {report.projectNo && <span style={{ fontSize: compact ? 12 : 14, opacity: 0.8, marginLeft: 8 }}>· {report.projectNo}</span>}
        </div>
        {!compact && (
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
            운영성 검토 보고서 (항해/출입항/하역/정박/비상 모드 분석)
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right', fontSize: compact ? 11 : 12 }}>
        <div>⚙️ 주발전기 <b>{report.genSelKva}kVA × PF {(report.genSelKw/report.genSelKva||0.8).toFixed(2)} = {report.genSelKw}kW × {report.genCount}대</b></div>
        {report.egSelKva > 0 && <div>🚨 비상발전기 <b>{report.egSelKva}kVA = {report.egSelKw}kW</b></div>}
      </div>
    </div>
  )
}

/* ── 시나리오 카드 (Page 2) ────────────────── */
function ScenarioCard({ scenario: s, unitKw }: { scenario: ScenarioResult; unitKw: number }) {
  const sc = SCENARIO_COLORS[s.key]
  const vc = VERDICT_COLORS[s.verdict]
  return (
    <div style={{
      border: `2px solid ${sc.main}`, borderRadius: 8,
      background: '#FFF', overflow: 'hidden',
    }}>
      <div style={{ background: sc.main, color: '#FFF', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{s.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{s.label}</span>
        <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 'auto' }}>{s.description}</span>
      </div>
      <div style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
        <DonutChart pct={s.loadFactorPct} color={sc.main} size={130} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <KV label="요구 전력" value={`${s.requiredKw.toFixed(2)} kW`} />
          <KV label="요구 kVA" value={`${s.requiredKva.toFixed(2)} kVA`} />
          <KV label="발전기 운전" value={`${unitKw} kW × ${s.genRunCount}대 = ${s.genCapacityKw} kW`} />
          <KV label="운전 부하수" value={`${s.runningLoads} / ${s.totalLoads} 개`} />
          <div style={{
            marginTop: 6, padding: '5px 10px', borderRadius: 4,
            fontSize: 11, fontWeight: 700, display: 'inline-block',
            background: vc.bg, color: vc.fg, border: `1px solid ${vc.border}`,
          }}>
            평가: {s.verdictLabel}
          </div>
        </div>
      </div>
      {s.topLoads.length > 0 && (
        <div style={{ borderTop: `1px solid ${sc.light}`, padding: '10px 14px', background: '#FAFAFA' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#666', marginBottom: 6 }}>
            주요 부하 (상위 5) — 수요율 × kW 기준
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {s.topLoads.map(l => (
              <div key={l.circuitNo} style={{ display: 'flex', gap: 6, fontSize: 10.5, color: '#424242' }}>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <b style={{ color: sc.dark }}>{l.circuitNo}</b> {l.name}
                </span>
                <span style={{ fontFamily: 'Consolas, monospace', fontSize: 9.5, color: '#999', minWidth: 52, textAlign: 'right' }}>
                  {l.kw.toFixed(1)}kW × {l.df.toFixed(2)}
                </span>
                <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: sc.main, minWidth: 60, textAlign: 'right' }}>
                  = {l.demandKw.toFixed(1)} kW
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #E0E0E0', fontSize: 9.5, color: '#757575' }}>
            사용자 입력 수요율: <b style={{ color: s.userInputCoveragePct >= 100 ? '#2E7D32' : s.userInputCoveragePct >= 50 ? '#F57C00' : '#C62828' }}>
              {s.userInputCoveragePct.toFixed(1)}%
            </b>
            {s.userInputCoveragePct < 100 && ' (미입력분은 0으로 계산)'}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 리스크 카드 ────────────────── */
function RiskCard({ risk }: { risk: RiskItem }) {
  const col = SEVERITY_COLORS[risk.severity]
  return (
    <div style={{
      border: '1px solid #E0E0E0', borderLeft: `5px solid ${col.fg}`,
      borderRadius: 6, padding: '12px 16px', background: '#FFF',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: col.fg,
        color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, flexShrink: 0,
      }}>{risk.id}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#212121' }}>{risk.title}</div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
            background: col.bg, color: col.fg,
          }}>{risk.severityLabel}</span>
        </div>
        <div style={{ fontSize: 11.5, color: '#555', lineHeight: 1.6, marginBottom: 5 }}>
          {risk.description}
        </div>
        <div style={{ fontSize: 10.5, color: '#C62828', lineHeight: 1.5, marginBottom: 6 }}>
          <b>영향:</b> {risk.impact}
        </div>
        {risk.evidence && risk.evidence.length > 0 && (
          <div style={{
            fontSize: 10, color: '#37474F', lineHeight: 1.55,
            background: '#F5F7FA', padding: '6px 10px', borderRadius: 4,
            fontFamily: 'Consolas, monospace',
          }}>
            <div style={{ fontWeight: 700, color: '#455A64', marginBottom: 2, fontFamily: 'inherit' }}>📐 계산 근거</div>
            {risk.evidence.map((e, i) => <div key={i}>· {e}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 권고 카드 ────────────────── */
function RecCard({ rec }: { rec: RecommendationItem }) {
  return (
    <div style={{
      border: '1px solid #81C784', background: '#F1F8E9', borderRadius: 6,
      padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: 22 }}>{rec.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1B5E20', marginBottom: 3 }}>
          {rec.id}. {rec.title}
        </div>
        <div style={{ fontSize: 11, color: '#424242', lineHeight: 1.6, marginBottom: 6 }}>
          {rec.description}
        </div>
        {rec.rationale && (
          <div style={{ fontSize: 10, color: '#2E7D32', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px dashed #A5D6A7', paddingTop: 5 }}>
            <b>근거:</b> {rec.rationale}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── ELA 모드 카드 ────────────────── */
function ElaModeCard({ m }: { m: ElaModeResult }) {
  const c = m.judgment
  return (
    <div style={{
      border: `2px solid ${c.color}`, borderRadius: 8,
      background: '#FFF', overflow: 'hidden',
    }}>
      <div style={{ background: c.color, color: '#FFF', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{m.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{m.label}</span>
        <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 'auto' }}>{m.labelEn}</span>
      </div>
      <div style={{ padding: 12 }}>
        <KV label="요구전력"   value={`${m.requiredKw.toFixed(2)} kW`} />
        <KV label="가용전력"   value={`${m.genUnitKw.toFixed(0)} kW × ${m.runningGenCount}대 = ${m.availableKw.toFixed(0)} kW`} />
        <KV label="부하율"     value={`${m.loadRatioPct.toFixed(2)}%`} />
        <KV label="연속부하"   value={`${m.continuousKw.toFixed(2)} kW`} />
        <KV label="간헐부하"   value={`${m.intermittentKw.toFixed(2)} kW`} />
        <KV label="Diversity"  value={`${m.diversityFactor.toFixed(2)}`} />
        <div style={{
          marginTop: 8, padding: '6px 10px', borderRadius: 4,
          fontSize: 11, fontWeight: 700, display: 'inline-block',
          background: c.bg, color: c.color, border: `1px solid ${c.border}`,
        }}>
          {c.label} — {c.message}
        </div>
      </div>
    </div>
  )
}

/* ── Load Shedding 블록 ────────────────── */
function ShedBlock({ plan }: { plan: LoadSheddingPlan }) {
  return (
    <div style={{
      marginBottom: 16, border: '1px solid #9C27B0', borderRadius: 8, overflow: 'hidden', background: '#FFF',
    }}>
      <div style={{ background: '#6A1B9A', color: '#FFF', padding: '10px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>
          {plan.label} — 부족 <span style={{ color: '#FFECB3' }}>{plan.deficitKw.toFixed(2)} kW</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>{plan.message}</div>
      </div>
      {plan.shedItems.length === 0 ? (
        <div style={{ padding: 16, background: '#FFEBEE', color: '#C62828', fontSize: 12, fontWeight: 700 }}>
          ⚠ 차단 가능(isSheddable) 지정된 부하가 없습니다. 부하 입력 탭에서 차단 대상 부하를 지정하세요.
        </div>
      ) : (
        <table style={tbl}>
          <thead>
            <tr style={{ background: '#F3E5F5' }}>
              <th style={{ ...th, color: '#6A1B9A', textAlign: 'left' }}>우선순위</th>
              <th style={{ ...th, color: '#6A1B9A', textAlign: 'left' }}>장비명</th>
              <th style={{ ...th, color: '#6A1B9A' }}>분류</th>
              <th style={{ ...th, color: '#6A1B9A' }}>차단 kW</th>
              <th style={{ ...th, color: '#6A1B9A' }}>누적 kW</th>
              <th style={{ ...th, color: '#6A1B9A' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {plan.shedItems.map((it, i) => {
              const isTarget = it.cumulativeKw >= plan.deficitKw && (i === 0 || plan.shedItems[i-1].cumulativeKw < plan.deficitKw)
              return (
                <tr key={i} style={{ borderBottom: '1px solid #E0E0E0', background: isTarget ? '#F3E5F5' : '#FFF' }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: '#6A1B9A' }}>{it.priority}</td>
                  <td style={{ ...td, textAlign: 'left' }}>
                    <span style={{ color: '#9E9E9E', fontSize: 10, marginRight: 6 }}>{it.circuitNo}</span>{it.name}
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 10, fontWeight: 700, color: it.essentialType === 'essential' ? '#C62828' : it.essentialType === 'important' ? '#1565C0' : '#757575' }}>
                    {it.essentialType === 'essential' ? 'Essential' : it.essentialType === 'important' ? 'Important' : 'Non-Ess'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace' }}>{it.shedKw.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Consolas, monospace', fontWeight: isTarget ? 800 : 400 }}>{it.cumulativeKw.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {isTarget ? (
                      <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700, background:'#E8F5E9', color:'#2E7D32' }}>해소</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {plan.conflicts.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#FFF3E0', borderTop: '1px solid #FFB74D' }}>
          {plan.conflicts.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: '#E65100', lineHeight: 1.5 }}>{c}</div>
          ))}
        </div>
      )}
    </div>
  )
}

const MOTOR_COLOR: Record<MotorStartingItem['verdict'], { color: string; bg: string; border: string }> = {
  safe:    { color: '#2E7D32', bg: '#E8F5E9', border: '#81C784' },
  caution: { color: '#F9A825', bg: '#FFFDE7', border: '#FFD54F' },
  warning: { color: '#EF6C00', bg: '#FFF3E0', border: '#FFB74D' },
  danger:  { color: '#C62828', bg: '#FFEBEE', border: '#EF5350' },
}

/* ── 소소 컴포넌트 ────────────────── */
function KeyPoint({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ border: '1px solid #BDBDBD', borderRadius: 6, padding: '10px 14px', background: '#FAFAFA' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#616161', marginBottom: 4 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#212121' }}>{body}</div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', fontSize: 11.5, marginBottom: 3 }}>
      <span style={{ color: '#757575', minWidth: 90 }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#212121', fontFamily: 'Consolas, monospace' }}>{value}</span>
    </div>
  )
}

/* ── 스타일 ────────────────── */
const h2: React.CSSProperties = {
  fontSize: 18, fontWeight: 800, color: '#1565C0',
  borderBottom: '3px solid #1565C0', paddingBottom: 6, marginBottom: 12,
}
const h3: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: '#263238',
  borderLeft: '4px solid #263238', paddingLeft: 10, marginBottom: 12,
}
const tbl: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
}
const th: React.CSSProperties = {
  color: '#FFF', padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 11,
}
const td: React.CSSProperties = {
  padding: '10px 12px',
}
