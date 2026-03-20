"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { Download, RefreshCw, AlertTriangle, CheckCircle, XCircle, Info, Zap, X } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { CONDITION_LABELS } from "@/types";
import type { OperatingCondition } from "@/types";

const ALL_CONDITIONS: OperatingCondition[] = [
  "sea_going", "maneuvering", "port_loading", "port_idle", "emergency",
];

function StatusIcon({ pct }: { pct: number }) {
  if (pct > 90) return <XCircle size={14} className="text-red-400" />;
  if (pct > 80) return <AlertTriangle size={14} className="text-amber-400" />;
  return <CheckCircle size={14} className="text-green-400" />;
}

function pctBadge(pct: number) {
  if (pct > 90) return "badge-error";
  if (pct > 80) return "badge-warning";
  return "badge-ok";
}

export default function LoadBalanceTab() {
  const {
    project,
    loadBalanceRows,
    loadBalanceSummaries,
    warnings,
    runCalculations,
    toggleCondition,
    setActiveGenerators,
  } = useProjectStore();

  const [showDetailMode, setShowDetailMode] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);

  const conditions = project.conditions;

  // ── 발전기 용량 추천 계산 ──────────────────────────────────────
  const recommend = (() => {
    if (project.loads.length === 0) return null;
    // 조건별 총 부하 (부하율 × 정격)
    const condLoads = conditions.map((cond) => {
      const total = project.loads.reduce(
        (sum, l) =>
          sum + (l.activeConditions.includes(cond) ? l.ratedPowerKW * l.loadFactor : 0),
        0
      );
      return { cond, total: Math.round(total) };
    });
    // 비상 조건 제외한 최대 부하
    const maxMainLoad = Math.max(
      ...condLoads.filter((c) => c.cond !== "emergency").map((c) => c.total),
      0
    );
    const emergLoad = condLoads.find((c) => c.cond === "emergency")?.total ?? 0;
    // 선급 기준 80% 부하율 기준으로 역산
    const requiredMainKW = Math.ceil(maxMainLoad / 0.8);
    const requiredEmergKW = Math.ceil(emergLoad / 0.8);
    // 발전기 대수별 추천 용량
    const options = [
      { count: 1, unitKW: Math.ceil(requiredMainKW / 100) * 100 },
      { count: 2, unitKW: Math.ceil(requiredMainKW / 2 / 100) * 100 },
      { count: 3, unitKW: Math.ceil(requiredMainKW / 3 / 100) * 100 },
    ];
    const maxCond = condLoads.filter((c) => c.cond !== "emergency").sort((a, b) => b.total - a.total)[0];
    return { condLoads, maxMainLoad, emergLoad, requiredMainKW, requiredEmergKW, options, maxCond };
  })();

  // 조건별 가동 발전기 토글
  function toggleGenForCondition(cond: string, genId: string) {
    const current = project.activeGeneratorsByCondition[cond] ?? [];
    const next = current.includes(genId)
      ? current.filter((id) => id !== genId)
      : [...current, genId];
    setActiveGenerators(cond, next);
  }

  // CSV 내보내기
  function exportCSV() {
    const headers = ["장비명", "정격(kW)", ...conditions.map((c) => CONDITION_LABELS[c])];
    const rows = loadBalanceRows.map((r) => [
      r.loadName,
      r.ratedKW,
      ...conditions.map((c) => r.values[c] ?? 0),
    ]);
    const summaryRow = [
      "합계(kW)",
      "",
      ...loadBalanceSummaries.map((s) => s.totalLoadKW),
    ];
    const genRow = [
      "발전용량(kW)",
      "",
      ...loadBalanceSummaries.map((s) => s.totalGenKW),
    ];
    const pctRow = [
      "부하율(%)",
      "",
      ...loadBalanceSummaries.map((s) => s.loadPercentage.toFixed(1) + "%"),
    ];
    const csv = [headers, ...rows, [], summaryRow, genRow, pctRow]
      .map((r) => r.join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_load_balance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = loadBalanceSummaries.map((s) => ({
    name: CONDITION_LABELS[s.condition],
    load: Math.round(s.totalLoadKW),
    gen: s.totalGenKW,
    pct: s.loadPercentage,
  }));

  if (project.generators.length === 0 && project.loads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <RefreshCw size={40} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-300 font-medium mb-2">아직 장비가 없습니다</p>
          <p className="text-sm text-slate-500 mb-4">
            먼저 <span className="text-sky-400">[1. 장비 입력]</span> 탭에서 부하(장비)를 등록하세요.<br />
            발전기는 나중에 추가해도 됩니다 — 부하만 넣으면 이 탭에서 필요 발전기 용량을 자동으로 추천해줍니다.
          </p>
          <div className="text-xs text-slate-600 bg-slate-800/50 rounded-lg p-3 text-left space-y-1.5">
            <p className="text-slate-400 font-medium mb-2">📋 추천 순서</p>
            <p>1. [장비 입력] → 부하 목록 등록 (프리셋 활용)</p>
            <p>2. [전력 계산] → 발전기 용량 추천 확인</p>
            <p>3. [장비 입력] → 발전기 추가 (추천값 참고)</p>
            <p>4. [전력 계산] → 부하율 최종 확인</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* ── 운항조건 + 발전기 설정 ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            운항조건 및 가동 발전기 설정
          </h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 accent-sky-500"
                checked={showDetailMode}
                onChange={(e) => setShowDetailMode(e.target.checked)} />
              상세모드 (부하율 직접입력)
            </label>
            <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={runCalculations}>
              <RefreshCw size={12} /> 재계산
            </button>
          </div>
        </div>

        {/* 운항조건 토글 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {ALL_CONDITIONS.map((cond) => (
            <label key={cond}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer text-sm border transition-colors ${
                conditions.includes(cond)
                  ? "bg-sky-900/30 border-sky-600 text-sky-300"
                  : "bg-slate-800 border-slate-600 text-slate-500"
              }`}
            >
              <input type="checkbox" className="hidden"
                checked={conditions.includes(cond)}
                onChange={() => toggleCondition(cond)} />
              {CONDITION_LABELS[cond]}
            </label>
          ))}
        </div>

        {/* 조건별 가동 발전기 */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${conditions.length}, 1fr)` }}>
          {conditions.map((cond) => {
            const activeIds = project.activeGeneratorsByCondition[cond] ?? [];
            return (
              <div key={cond} className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-300 mb-2">{CONDITION_LABELS[cond]}</p>
                <div className="space-y-1">
                  {project.generators.map((gen) => (
                    <label key={gen.id}
                      className="flex items-center gap-1.5 cursor-pointer group">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-sky-500"
                        checked={activeIds.includes(gen.id)}
                        onChange={() => toggleGenForCondition(cond, gen.id)} />
                      <span className={`text-xs ${gen.type === "emergency" ? "text-orange-300" : "text-slate-300"}`}>
                        {gen.name}
                      </span>
                      <span className="text-xs text-slate-500">{gen.ratedPowerKW}kW</span>
                    </label>
                  ))}
                  {project.generators.length === 0 && (
                    <p className="text-xs text-slate-600">발전기 없음</p>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/30 text-xs text-slate-400">
                  합계:{" "}
                  <span className="text-sky-400 font-mono">
                    {project.generators
                      .filter((g) => activeIds.includes(g.id))
                      .reduce((s, g) => s + g.ratedPowerKW, 0)
                      .toLocaleString()}
                  </span>{" "}
                  kW
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Load Balance 테이블 ── */}
      {loadBalanceRows.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Load Balance 테이블
            </h2>
            <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={exportCSV}>
              <Download size={12} /> CSV 내보내기
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left sticky left-0 bg-slate-900 z-10">장비명</th>
                  <th className="text-right">정격(kW)</th>
                  {conditions.map((c) => (
                    <th key={c} className="text-right">{CONDITION_LABELS[c]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {loadBalanceRows.map((row) => (
                  <tr key={row.loadId}>
                    <td className="sticky left-0 bg-slate-900 z-10 font-medium">{row.loadName}</td>
                    <td className="text-right font-mono text-slate-400">{row.ratedKW}</td>
                    {conditions.map((c) => (
                      <td key={c} className="text-right font-mono">
                        {row.values[c] > 0 ? (
                          <span className="text-sky-300">{row.values[c]}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-600">
                {/* 합계 */}
                <tr className="bg-slate-800/50">
                  <td className="sticky left-0 bg-slate-800 z-10 font-semibold text-slate-200">합계 (kW)</td>
                  <td></td>
                  {loadBalanceSummaries.map((s) => (
                    <td key={s.condition} className="text-right font-mono font-semibold text-sky-300">
                      {s.totalLoadKW}
                    </td>
                  ))}
                </tr>
                {/* 발전용량 */}
                <tr className="bg-slate-800/30">
                  <td className="sticky left-0 bg-slate-800/30 z-10 text-slate-400 text-xs">발전용량 (kW)</td>
                  <td></td>
                  {loadBalanceSummaries.map((s) => (
                    <td key={s.condition} className="text-right font-mono text-slate-400 text-xs">
                      {s.totalGenKW.toLocaleString()}
                    </td>
                  ))}
                </tr>
                {/* 부하율 */}
                <tr className="bg-slate-800/50">
                  <td className="sticky left-0 bg-slate-800 z-10 font-semibold text-slate-200">부하율 (%)</td>
                  <td></td>
                  {loadBalanceSummaries.map((s) => (
                    <td key={s.condition} className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <StatusIcon pct={s.loadPercentage} />
                        <span className={`font-mono font-semibold ${
                          s.isCritical ? "text-red-400" : s.isWarning ? "text-amber-400" : "text-green-400"
                        }`}>
                          {s.loadPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
                {/* 여유 */}
                <tr className="bg-slate-800/20">
                  <td className="sticky left-0 bg-slate-800/20 z-10 text-slate-400 text-xs">여유 (kW)</td>
                  <td></td>
                  {loadBalanceSummaries.map((s) => (
                    <td key={s.condition} className="text-right font-mono text-slate-400 text-xs">
                      {s.marginKW > 0 ? `+${s.marginKW}` : s.marginKW}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── 부하율 차트 ── */}
      {chartData.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            운항조건별 부하율
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 60, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                  tick={{ fill: "#78909c", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#e0e0e0", fontSize: 12 }} width={80} />
                <Tooltip
                  contentStyle={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: "6px" }}
                  formatter={(val: number, name: string) => [`${val.toFixed(1)}%`, "부하율"]}
                  cursor={{ fill: "rgba(79, 195, 247, 0.05)" }}
                />
                <ReferenceLine x={80} stroke="#ffd54f" strokeDasharray="4 4" label={{ value: "80%", fill: "#ffd54f", fontSize: 10 }} />
                <ReferenceLine x={90} stroke="#f44336" strokeDasharray="4 4" label={{ value: "90%", fill: "#f44336", fontSize: 10 }} />
                <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.pct > 90 ? "#f44336" : entry.pct > 80 ? "#ffd54f" : "#4caf50"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-500 rounded-sm inline-block" /> 정상 (&lt;80%)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-amber-400 rounded-sm inline-block" /> 주의 (80~90%)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500 rounded-sm inline-block" /> 위험 (&gt;90%)</span>
          </div>
        </div>
      )}

      {/* ── 요약 카드 ── */}
      {loadBalanceSummaries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loadBalanceSummaries.map((s) => (
            <div key={s.condition} className={`card p-3 border ${
              s.isCritical ? "border-red-800/50" : s.isWarning ? "border-amber-800/50" : "border-green-800/30"
            }`}>
              <p className="text-xs text-slate-400 mb-1">{CONDITION_LABELS[s.condition]}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-mono font-bold ${
                  s.isCritical ? "text-red-400" : s.isWarning ? "text-amber-400" : "text-green-400"
                }`}>
                  {s.loadPercentage.toFixed(0)}%
                </span>
                <span className={`text-xs ${pctBadge(s.loadPercentage)}`}>
                  {s.isCritical ? "위험" : s.isWarning ? "주의" : "OK"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {s.totalLoadKW}kW / {s.totalGenKW}kW
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── 경고 메시지 ── */}
      {warnings.length > 0 && (
        <div className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">주의사항</h2>
          {warnings.map((w) => (
            <div key={w.id}
              className={`flex gap-3 p-3 rounded-lg text-sm ${
                w.type === "error"
                  ? "bg-red-900/20 border border-red-800/40"
                  : w.type === "warning"
                  ? "bg-amber-900/20 border border-amber-800/40"
                  : "bg-sky-900/20 border border-sky-800/40"
              }`}>
              <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${
                w.type === "error" ? "text-red-400" : w.type === "warning" ? "text-amber-400" : "text-sky-400"
              }`} />
              <div>
                <p className={w.type === "error" ? "text-red-300" : w.type === "warning" ? "text-amber-300" : "text-sky-300"}>
                  {w.message}
                </p>
                {w.detail && <p className="text-slate-400 text-xs mt-0.5">{w.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 발전기 용량 추천 버튼 ── */}
      {recommend && (
        <div>
          <button
            className="w-full flex items-center justify-between p-4 card hover:border-sky-600/50 transition-colors"
            onClick={() => setShowRecommend(true)}
          >
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-sky-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-slate-200">발전기 용량 자동 추천</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  입력된 부하 기준으로 적정 발전기 용량과 대수를 계산합니다
                </p>
              </div>
            </div>
            <span className="badge-info">계산하기 →</span>
          </button>
        </div>
      )}

      {/* 도움말 */}
      <div className="card p-4 bg-slate-900/50">
        <div className="flex gap-2">
          <Info size={14} className="text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-1">
            <p>각 조건에서 가동되는 발전기를 위에서 체크하세요. 미선택 시 해당 조건의 발전용량은 0입니다.</p>
            <p>선급 기준: 부하율 <span className="text-amber-400">80%</span> 이하 권장, <span className="text-red-400">90%</span> 이하 합격</p>
            <p>DOL 기동 시 순간 전류 = 정격전류 × 6~8배 — 대형 모터는 전압강하 탭에서 반드시 확인</p>
          </div>
        </div>
      </div>

      {/* ── 발전기 추천 모달 ── */}
      {showRecommend && recommend && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-sky-400" />
                <h3 className="text-base font-semibold text-slate-200">발전기 용량 추천</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowRecommend(false)}><X size={16} /></button>
            </div>

            {/* 조건별 부하 요약 */}
            <div className="mb-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">운항조건별 총 부하</p>
              <div className="space-y-2">
                {recommend.condLoads.map(({ cond, total }) => (
                  <div key={cond} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-20">{CONDITION_LABELS[cond]}</span>
                    <div className="flex-1 bg-slate-700/50 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cond === "emergency" ? "bg-orange-500/60" : "bg-sky-500/60"
                        }`}
                        style={{ width: `${recommend.maxMainLoad > 0 ? Math.min((total / recommend.maxMainLoad) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-sky-300 w-16 text-right">{total} kW</span>
                    {recommend.maxCond?.cond === cond && (
                      <span className="badge-warning text-xs">최대</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 주발전기 추천 */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                주발전기 추천 (목표 부하율 80%)
              </p>
              <p className="text-xs text-slate-500 mb-3">
                최대 부하 <span className="text-sky-400 font-mono">{recommend.maxMainLoad} kW</span>를
                80%로 운전하려면 총 <span className="text-sky-400 font-mono">{recommend.requiredMainKW} kW</span> 이상 필요합니다
              </p>
              <div className="grid grid-cols-3 gap-3">
                {recommend.options.map((opt) => (
                  <div key={opt.count}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center hover:border-sky-600/50 transition-colors cursor-default">
                    <p className="text-xs text-slate-400 mb-1">{opt.count}대 구성</p>
                    <p className="text-xl font-bold font-mono text-sky-300">{opt.unitKW}</p>
                    <p className="text-xs text-slate-400">kW × {opt.count}</p>
                    <p className="text-xs text-sky-400 mt-1">= {opt.unitKW * opt.count} kW</p>
                    <p className="text-xs text-slate-500 mt-1">
                      부하율 ~{Math.round((recommend.maxMainLoad / (opt.unitKW * opt.count)) * 100)}%
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                💡 일반 상선: 2~3대 구성 권장. 단일 발전기 최대 부하는 전체의 50% 이하 권장
              </p>
            </div>

            {/* 비상발전기 추천 */}
            {recommend.emergLoad > 0 && (
              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                  비상발전기 (E/G) 추천
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  SOLAS 비상부하 합계:{" "}
                  <span className="text-orange-400 font-mono">{recommend.emergLoad} kW</span>
                  → 최소{" "}
                  <span className="text-orange-400 font-mono">{recommend.requiredEmergKW} kW</span> 이상
                </p>
                <div className="flex items-center gap-3 bg-orange-900/10 border border-orange-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-mono font-bold text-orange-300">{recommend.requiredEmergKW} kW</p>
                    <p className="text-xs text-slate-400">비상발전기 최소 용량</p>
                  </div>
                  <div className="text-xs text-slate-400 ml-4">
                    <p>비상부하 {recommend.emergLoad} kW ÷ 0.8 = {recommend.requiredEmergKW} kW</p>
                    <p className="text-slate-500 mt-0.5">SOLAS 규정: 비상부하 + 10% 이상 여유</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 bg-sky-900/10 border border-sky-800/30 rounded-lg text-xs text-slate-400">
              <p>이 값은 <strong className="text-slate-300">부하율 80% 기준</strong> 추천이며, 실제 설계 시 기동전류, 전압강하, 여유율 등을 추가로 검토해야 합니다.</p>
              <p className="mt-1">장비 입력 탭에서 추천 용량으로 발전기를 추가한 뒤 이 탭의 부하율을 확인하세요.</p>
            </div>

            <div className="flex justify-end mt-4">
              <button className="btn-secondary" onClick={() => setShowRecommend(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
