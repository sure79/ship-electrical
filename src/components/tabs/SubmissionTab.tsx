"use client";

import { useState } from "react";
import { CheckCircle, Circle, ArrowRight, AlertTriangle, Download, X, ChevronDown, ChevronRight } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { SOLAS_CHECKLIST } from "@/data/presets";
import type { ShortCircuitResult, VoltageDropResult } from "@/types";

// 선급별 제출 서류
const CLASS_DOCUMENTS: Record<string, { id: string; name: string; required: boolean; available: boolean; phase: string }[]> = {
  KR: [
    { id: "KR-E01", name: "전력균형표 (Load Balance Table)",           required: true,  available: true,  phase: "기본설계" },
    { id: "KR-E02", name: "단선결선도 (Single Line Diagram)",          required: true,  available: true,  phase: "기본설계" },
    { id: "KR-E03", name: "단락전류 계산서 (Short Circuit Calculation)", required: true,  available: true,  phase: "기본설계" },
    { id: "KR-E04", name: "전압강하 계산서 (Voltage Drop Calculation)", required: true,  available: true,  phase: "기본설계" },
    { id: "KR-E05", name: "보호장치 협조 (Protection Coordination)",   required: true,  available: false, phase: "기본설계" },
    { id: "KR-E06", name: "비상전원 계통도 (Emergency Power SLD)",     required: true,  available: true,  phase: "기본설계" },
    { id: "KR-E07", name: "주요 전기기기 사양서",                       required: true,  available: false, phase: "기본설계" },
    { id: "KR-E08", name: "접지 계통도 (Earthing Diagram)",           required: true,  available: false, phase: "기본설계" },
    { id: "KR-E09", name: "케이블 리스트 (Cable Schedule)",           required: true,  available: true,  phase: "상세설계" },
    { id: "KR-E10", name: "화재탐지 계통도 (Fire Detection SLD)",     required: true,  available: false, phase: "기본설계" },
    { id: "KR-E11", name: "조명 계산서 (Lighting Calculation)",       required: true,  available: false, phase: "상세설계" },
    { id: "KR-E12", name: "절연저항 시험 계획 (Insulation Test Plan)", required: false, available: false, phase: "상세설계" },
  ],
  ABS: [
    { id: "ABS-E01", name: "Electrical Load Analysis",                  required: true,  available: true,  phase: "Basic" },
    { id: "ABS-E02", name: "Main Single Line Diagram",                  required: true,  available: true,  phase: "Basic" },
    { id: "ABS-E03", name: "Short Circuit Study",                       required: true,  available: true,  phase: "Basic" },
    { id: "ABS-E04", name: "Voltage Drop Study",                        required: true,  available: true,  phase: "Basic" },
    { id: "ABS-E05", name: "Protective Device Coordination Study",      required: true,  available: false, phase: "Basic" },
    { id: "ABS-E06", name: "Emergency Generator Load Analysis",         required: true,  available: true,  phase: "Basic" },
    { id: "ABS-E07", name: "Battery Calculation",                       required: true,  available: false, phase: "Basic" },
    { id: "ABS-E08", name: "Cable Schedule",                            required: true,  available: true,  phase: "Detail" },
    { id: "ABS-E09", name: "Equipment List with Ratings",               required: true,  available: true,  phase: "Basic" },
  ],
  DNV: [
    { id: "DNV-E01", name: "Power Balance (DNVGL-RU-SHIP Pt.4 Ch.8)",  required: true,  available: true,  phase: "Basic" },
    { id: "DNV-E02", name: "Main Single Line Diagram",                  required: true,  available: true,  phase: "Basic" },
    { id: "DNV-E03", name: "Short Circuit Calculation (IEC 61363)",     required: true,  available: true,  phase: "Basic" },
    { id: "DNV-E04", name: "Selectivity Study",                         required: true,  available: false, phase: "Basic" },
    { id: "DNV-E05", name: "Starting Analysis for Large Motors",        required: true,  available: true,  phase: "Basic" },
    { id: "DNV-E06", name: "Emergency Source of Power",                 required: true,  available: true,  phase: "Basic" },
    { id: "DNV-E07", name: "Cable Sizing Calculation",                  required: true,  available: true,  phase: "Detail" },
  ],
};

// ── 단락전류 모달 ──────────────────────────────────────────────
function ShortCircuitModal({ results, onClose }: { results: ShortCircuitResult[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card p-6 w-[600px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-200">단락전류 계산 결과 (간이)</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <table className="w-full data-table text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left">모선</th>
              <th className="text-right">대칭(kA rms)</th>
              <th className="text-right">첨두(kA peak)</th>
              <th className="text-right">필요 CB (kA)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {results.map((r) => (
              <tr key={r.busId}>
                <td>{r.busName}</td>
                <td className="text-right font-mono text-sky-300">{r.symmetricalKA}</td>
                <td className="text-right font-mono text-sky-300">{r.peakKA}</td>
                <td className="text-right font-mono text-amber-300">{r.requiredBreakingKA}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 p-3 bg-sky-900/20 border border-sky-800/40 rounded-lg text-xs text-sky-300">
          <p>💡 이 계산은 IEC 61363-1 기반 <strong>간이 계산</strong>입니다.</p>
          <p className="mt-1 text-slate-400">
            선급 정식 제출 시 ETAP, DigSILENT 등 정밀 소프트웨어 결과와 교차 검증을 권장합니다.<br />
            X/R비 가정: κ = 1.8 (선박 계통 일반값), 모터 기여: DOL 모터만 포함
          </p>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" onClick={() => {
            // CSV 다운로드
            const csv = ["모선,대칭(kA rms),첨두(kA peak),필요CB(kA)",
              ...results.map(r => `${r.busName},${r.symmetricalKA},${r.peakKA},${r.requiredBreakingKA}`)
            ].join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "short_circuit_calc.csv";
            a.click();
          }}>
            <Download size={13} className="inline mr-1" />CSV 저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 전압강하 모달 ──────────────────────────────────────────────
function VoltageDropModal({ results, onClose }: { results: VoltageDropResult[]; onClose: () => void }) {
  const { project } = useProjectStore();
  const maxRunning = project.settings.classRule === "DNV" ? 5 : 6;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card p-6 w-[760px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-200">전압강하 계산 결과 (간이) + 케이블 자동선정</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full data-table text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left">부하명</th>
                <th className="text-right">전류(A)</th>
                <th className="text-left">추천 케이블</th>
                <th className="text-right">정상VD(%)</th>
                <th className="text-right">기동VD(%)</th>
                <th className="text-center">판정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {results.map((r) => (
                <tr key={r.loadId}>
                  <td className="font-medium">{r.loadName}</td>
                  <td className="text-right font-mono">{r.ratedCurrentA}</td>
                  <td className="font-mono text-xs text-sky-300">{r.cableType}</td>
                  <td className={`text-right font-mono ${r.runningDropPercent > maxRunning ? "text-red-400" : "text-green-400"}`}>
                    {r.runningDropPercent}%
                  </td>
                  <td className={`text-right font-mono ${r.startingDropPercent > 15 ? "text-red-400" : "text-green-400"}`}>
                    {r.startingDropPercent > 0 ? `${r.startingDropPercent}%` : "—"}
                  </td>
                  <td className="text-center">
                    {r.isAcceptable ? (
                      <span className="badge-ok">OK</span>
                    ) : (
                      <span className="badge-error">초과</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-3 bg-sky-900/20 border border-sky-800/40 rounded-lg text-xs text-sky-300">
          <p>허용기준: 정상운전 {maxRunning}% ({project.settings.classRule}), 기동 15%</p>
          <p className="text-slate-400 mt-1">케이블 길이가 0인 장비는 계산 제외됩니다. 장비 편집에서 길이를 입력하세요.</p>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" onClick={() => {
            const csv = ["부하명,전류(A),추천케이블,정상VD(%),기동VD(%),판정",
              ...results.map(r => `${r.loadName},${r.ratedCurrentA},${r.cableType},${r.runningDropPercent}%,${r.startingDropPercent || "—"},${r.isAcceptable ? "OK" : "초과"}`)
            ].join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "voltage_drop_calc.csv";
            a.click();
          }}>
            <Download size={13} className="inline mr-1" />CSV 저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// 메인 탭 컴포넌트
// ================================================================
export default function SubmissionTab() {
  const { project, shortCircuitResults, voltageDropResults, loadBalanceSummaries, runCalculations } = useProjectStore();
  const [showSCModal, setShowSCModal] = useState(false);
  const [showVDModal, setShowVDModal] = useState(false);
  const [openSection, setOpenSection] = useState(true);

  const classRule = project.settings.classRule;
  const docs = CLASS_DOCUMENTS[classRule] ?? CLASS_DOCUMENTS.KR;
  const hasLoadBalance = project.loads.length > 0 && loadBalanceSummaries.length > 0;
  const hasSLD = project.generators.length > 0 || project.loads.length > 0;
  const hasSC = shortCircuitResults.length > 0;
  const hasVD = voltageDropResults.length > 0;
  const emergLoads = project.loads.filter((l) => l.isEmergency);

  // 문서별 완료 여부 판단
  function isDocReady(id: string): boolean {
    if (id.includes("E01") || id.toLowerCase().includes("load")) return hasLoadBalance;
    if (id.includes("E02") || id.toLowerCase().includes("single line") || id.toLowerCase().includes("sld")) return hasSLD;
    if (id.includes("E03") || id.toLowerCase().includes("short circuit")) return hasSC;
    if (id.includes("E04") || id.toLowerCase().includes("voltage drop") || id.toLowerCase().includes("cable siz")) return hasVD;
    if (id.includes("E06") || id.toLowerCase().includes("emergency")) return emergLoads.length > 0;
    if (id.includes("E08") || id.toLowerCase().includes("cable schedule")) return hasVD;
    if (id.includes("E09") || id.toLowerCase().includes("equipment list")) return project.loads.length > 0;
    if (id.toLowerCase().includes("starting analysis") || id.toLowerCase().includes("large motor")) return hasVD;
    return false;
  }

  const readyCount = docs.filter((d) => d.required && isDocReady(d.id)).length;
  const requiredCount = docs.filter((d) => d.required).length;
  const progressPct = requiredCount > 0 ? Math.round((readyCount / requiredCount) * 100) : 0;

  // SOLAS 체크
  function isSolasItem(keyword: string): boolean {
    return project.loads.some(
      (l) =>
        l.isEmergency &&
        l.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  const solasOk = SOLAS_CHECKLIST.filter((s) => isSolasItem(s.keyword)).length;
  const solasTotal = SOLAS_CHECKLIST.length;

  // 장비 목록 CSV
  function downloadEquipmentCSV() {
    const csv = [
      "번호,장비명,용량(kW),역률,모선,기동방식,비상부하",
      ...project.loads.map((l, i) =>
        `${i + 1},${l.name},${l.ratedPowerKW},${l.powerFactor},${l.busId},${l.startMethod},${l.isEmergency ? "Y" : "N"}`
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name}_equipment_list.csv`;
    a.click();
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* ── 선급 선택 + 진행률 ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            선급 제출 서류 체크리스트
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            현재 선급:
            <span className="text-sky-400 font-semibold">{classRule}</span>
          </div>
        </div>

        {/* 진행률 */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400">기본설계 서류 준비율</span>
            <span className={`font-semibold ${progressPct === 100 ? "text-green-400" : progressPct > 60 ? "text-amber-400" : "text-slate-300"}`}>
              {readyCount} / {requiredCount} ({progressPct}%)
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${progressPct === 100 ? "bg-green-500" : progressPct > 60 ? "bg-amber-400" : "bg-sky-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 서류 목록 */}
        <div className="space-y-1.5">
          {docs.map((doc) => {
            const ready = isDocReady(doc.id);
            return (
              <div key={doc.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  ready
                    ? "border-green-800/30 bg-green-900/10"
                    : "border-slate-700/40 bg-slate-800/30"
                }`}>
                {ready ? (
                  <CheckCircle size={15} className="text-green-400 shrink-0" />
                ) : (
                  <Circle size={15} className="text-slate-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${ready ? "text-slate-200" : "text-slate-400"}`}>
                    {doc.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.required ? (
                      <span className="text-xs text-slate-500">필수</span>
                    ) : (
                      <span className="text-xs text-slate-600">선택</span>
                    )}
                    <span className="text-xs text-slate-600">{doc.phase}</span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="shrink-0">
                  {ready && doc.available ? (
                    <div className="flex gap-1">
                      {(doc.id.includes("E01") || doc.id.toLowerCase().includes("load")) && (
                        <button className="badge-ok text-xs cursor-pointer" onClick={() => {}}>
                          <Download size={10} /> CSV
                        </button>
                      )}
                      {(doc.id.includes("E02") || doc.id.toLowerCase().includes("single line")) && (
                        <button className="badge-ok text-xs cursor-pointer" onClick={() => {}}>
                          <Download size={10} /> SVG
                        </button>
                      )}
                      {(doc.id.includes("E03") || doc.id.toLowerCase().includes("short circuit")) && (
                        <button className="badge-info text-xs cursor-pointer" onClick={() => { runCalculations(); setShowSCModal(true); }}>
                          보기
                        </button>
                      )}
                      {(doc.id.includes("E04") || doc.id.toLowerCase().includes("voltage drop") || doc.id.toLowerCase().includes("cable")) && (
                        <button className="badge-info text-xs cursor-pointer" onClick={() => { runCalculations(); setShowVDModal(true); }}>
                          보기
                        </button>
                      )}
                      {(doc.id.includes("E09") || doc.id.toLowerCase().includes("equipment")) && (
                        <button className="badge-ok text-xs cursor-pointer" onClick={downloadEquipmentCSV}>
                          <Download size={10} /> CSV
                        </button>
                      )}
                    </div>
                  ) : !ready ? (
                    <span className="text-xs text-slate-600">
                      {doc.available ? "데이터 입력 필요" : "추후 지원 예정"}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SOLAS 비상부하 체크 ── */}
      <div className="card p-4">
        <button
          className="w-full flex items-center justify-between mb-3"
          onClick={() => setOpenSection((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              SOLAS 비상부하 체크리스트
            </h2>
            <span className={`badge-${solasOk === solasTotal ? "ok" : solasOk > solasTotal * 0.7 ? "warning" : "error"}`}>
              {solasOk}/{solasTotal}
            </span>
          </div>
          {openSection ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </button>

        {openSection && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {SOLAS_CHECKLIST.map((item) => {
                const found = isSolasItem(item.keyword);
                return (
                  <div key={item.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                      found ? "border-green-800/30 bg-green-900/10" : "border-slate-700/30"
                    }`}>
                    {found ? (
                      <CheckCircle size={13} className="text-green-400 shrink-0" />
                    ) : (
                      <Circle size={13} className="text-slate-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs ${found ? "text-slate-200" : "text-slate-500"}`}>
                        {item.name}
                      </span>
                      <p className="text-xs text-slate-600">{item.regulation}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 미등록 비상부하 경고 */}
            {solasOk < solasTotal && (
              <div className="mt-3 p-3 bg-amber-900/20 border border-amber-800/40 rounded-lg text-xs">
                <div className="flex gap-2">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-amber-300">
                    <p className="font-medium">미등록 SOLAS 비상부하: {solasTotal - solasOk}개</p>
                    <p className="text-amber-400/70 mt-0.5">
                      &apos;장비 입력&apos; 탭에서 &apos;SOLAS 비상부하&apos;를 체크하여 비상부하를 등록하세요.
                    </p>
                    <p className="mt-1">
                      미등록:{" "}
                      {SOLAS_CHECKLIST.filter((s) => !isSolasItem(s.keyword))
                        .map((s) => s.name)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {emergLoads.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/30">
                <p className="text-xs text-slate-400 mb-2">
                  등록된 비상부하 합계:{" "}
                  <span className="text-orange-400 font-mono">
                    {emergLoads.reduce((s, l) => s + l.ratedPowerKW, 0)} kW
                  </span>
                  {project.generators.filter((g) => g.type === "emergency").length > 0 && (
                    <span>
                      {" / 비상발전기 "}
                      <span className="text-orange-400 font-mono">
                        {project.generators.filter((g) => g.type === "emergency")
                          .reduce((s, g) => s + g.ratedPowerKW, 0)} kW
                      </span>
                    </span>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 빠른 계산 모달 ── */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">빠른 계산</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-sky-600/50 transition-colors"
            onClick={() => { runCalculations(); setShowSCModal(true); }}
          >
            <div className="text-left">
              <p className="text-sm font-medium text-slate-200">단락전류 계산</p>
              <p className="text-xs text-slate-400 mt-1">각 모선의 단락전류 계산 (IEC 61363 간략화)</p>
            </div>
            <ArrowRight size={16} className="text-sky-400" />
          </button>
          <button
            className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-sky-600/50 transition-colors"
            onClick={() => { runCalculations(); setShowVDModal(true); }}
          >
            <div className="text-left">
              <p className="text-sm font-medium text-slate-200">전압강하 + 케이블 선정</p>
              <p className="text-xs text-slate-400 mt-1">케이블 자동 사이징 (IEC 60092 간략화)</p>
            </div>
            <ArrowRight size={16} className="text-sky-400" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          💡 이 계산들은 간이 계산입니다. 선급 정식 제출 시 ETAP 등 정밀 소프트웨어와 교차 검증하세요.
        </p>
      </div>

      {/* 모달 */}
      {showSCModal && (
        <ShortCircuitModal
          results={shortCircuitResults}
          onClose={() => setShowSCModal(false)}
        />
      )}
      {showVDModal && (
        <VoltageDropModal
          results={voltageDropResults}
          onClose={() => setShowVDModal(false)}
        />
      )}
    </div>
  );
}
