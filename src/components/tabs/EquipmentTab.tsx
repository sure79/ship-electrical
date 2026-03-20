"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Zap, Package, ChevronDown, ChevronRight, Info } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import type { Generator, Load, LoadType, StartMethod, BusId, OperatingCondition, VoltageLevel } from "@/types";
import { LOAD_TYPE_LABELS, LOAD_TYPE_DEFAULTS, CONDITION_LABELS } from "@/types";
import { PRESETS, VESSEL_PRESETS } from "@/data/presets";

// ================================================================
// 발전기 폼 모달
// ================================================================
function GeneratorModal({
  initial,
  onSave,
  onClose,
  voltage,
}: {
  initial?: Generator;
  onSave: (g: Omit<Generator, "id">) => void;
  onClose: () => void;
  voltage: number;
}) {
  const [form, setForm] = useState<Omit<Generator, "id">>({
    name: initial?.name ?? "",
    type: initial?.type ?? "main",
    ratedPowerKW: initial?.ratedPowerKW ?? 500,
    ratedVoltage: initial?.ratedVoltage ?? (voltage as VoltageLevel),
    powerFactor: initial?.powerFactor ?? 0.8,
    subtransientReactance: initial?.subtransientReactance ?? 0.15,
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card p-6 w-[480px]">
        <h3 className="text-base font-semibold text-slate-200 mb-4">
          {initial ? "발전기 편집" : "발전기 추가"}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">명칭 *</label>
              <input className="input-field w-full" placeholder="No.1 D/G" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">유형</label>
              <select className="input-field w-full" value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "main" | "emergency" })}>
                <option value="main">주발전기</option>
                <option value="emergency">비상발전기 (E/G)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">정격 출력 (kW) *</label>
              <input className="input-field w-full" type="number" placeholder="500"
                value={form.ratedPowerKW}
                onChange={(e) => setForm({ ...form, ratedPowerKW: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">정격 전압 (V)</label>
              <select className="input-field w-full" value={form.ratedVoltage}
                onChange={(e) => setForm({ ...form, ratedVoltage: parseInt(e.target.value) as VoltageLevel })}>
                {[220, 380, 440, 450, 480, 690, 6600].map((v) => (
                  <option key={v} value={v}>{v}V</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">역률 (PF)</label>
              <input className="input-field w-full" type="number" step="0.01" min="0.7" max="1"
                value={form.powerFactor}
                onChange={(e) => setForm({ ...form, powerFactor: parseFloat(e.target.value) || 0.8 })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                차과도 리액턴스 X&apos;d (pu)
                <span className="text-slate-500 ml-1 text-xs">(단락전류 계산용)</span>
              </label>
              <input className="input-field w-full" type="number" step="0.01" min="0.05" max="0.5"
                value={form.subtransientReactance}
                onChange={(e) => setForm({ ...form, subtransientReactance: parseFloat(e.target.value) || 0.15 })} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            💡 정격전류 자동계산: {form.ratedPowerKW
              ? Math.round((form.ratedPowerKW * 1000) / (Math.sqrt(3) * form.ratedVoltage * form.powerFactor))
              : "—"} A
          </p>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={() => { if (form.name) { onSave(form); onClose(); } }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// 부하 폼 모달
// ================================================================
const ALL_CONDITIONS: OperatingCondition[] = [
  "sea_going", "maneuvering", "port_loading", "port_idle", "emergency"
];

function LoadModal({
  initial,
  onSave,
  onClose,
  activeConditions: projectConditions,
}: {
  initial?: Load;
  onSave: (l: Omit<Load, "id">) => void;
  onClose: () => void;
  activeConditions: OperatingCondition[];
}) {
  const defaults = LOAD_TYPE_DEFAULTS["motor"];
  const [form, setForm] = useState<Omit<Load, "id">>({
    name: initial?.name ?? "",
    type: initial?.type ?? "motor",
    ratedPowerKW: initial?.ratedPowerKW ?? 0,
    powerFactor: initial?.powerFactor ?? defaults.pf,
    efficiency: initial?.efficiency ?? defaults.efficiency,
    busId: initial?.busId ?? "port",
    startMethod: initial?.startMethod ?? defaults.start,
    startCurrentMultiplier: initial?.startCurrentMultiplier ?? defaults.startMult,
    loadFactor: initial?.loadFactor ?? 0.8,
    activeConditions: initial?.activeConditions ?? [],
    isEmergency: initial?.isEmergency ?? false,
    isEssential: initial?.isEssential ?? false,
    cableLength: initial?.cableLength ?? 0,
    cableSize: initial?.cableSize,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  function onTypeChange(type: LoadType) {
    const d = LOAD_TYPE_DEFAULTS[type];
    setForm((f) => ({
      ...f,
      type,
      powerFactor: d.pf,
      efficiency: d.efficiency,
      startMethod: d.start,
      startCurrentMultiplier: d.startMult,
      busId: type === "lighting" || type === "navigation" || type === "communication" ? "port" : f.busId,
    }));
  }

  function toggleCondition(cond: OperatingCondition) {
    setForm((f) => ({
      ...f,
      activeConditions: f.activeConditions.includes(cond)
        ? f.activeConditions.filter((c) => c !== cond)
        : [...f.activeConditions, cond],
    }));
  }

  const isMotor = ["motor", "pump", "compressor", "fan"].includes(form.type);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-4">
      <div className="card p-6 w-[560px] my-auto">
        <h3 className="text-base font-semibold text-slate-200 mb-4">
          {initial ? "부하 편집" : "부하 추가"}
        </h3>
        <div className="space-y-3">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">장비명 *</label>
              <input className="input-field w-full" placeholder="Bow Thruster" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">장비 유형</label>
              <select className="input-field w-full" value={form.type}
                onChange={(e) => onTypeChange(e.target.value as LoadType)}>
                {Object.entries(LOAD_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">정격용량 (kW) *</label>
              <input className="input-field w-full" type="number" placeholder="200"
                value={form.ratedPowerKW || ""}
                onChange={(e) => setForm({ ...form, ratedPowerKW: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">연결 모선 *</label>
              <select className="input-field w-full" value={form.busId}
                onChange={(e) => setForm({ ...form, busId: e.target.value as BusId })}>
                <option value="port">Port (좌현)</option>
                <option value="stbd">Stbd (우현)</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">부하율</label>
              <div className="flex items-center gap-1">
                <input className="input-field w-full" type="number" step="0.1" min="0" max="1"
                  value={form.loadFactor}
                  onChange={(e) => setForm({ ...form, loadFactor: parseFloat(e.target.value) || 0.8 })} />
                <span className="text-xs text-slate-400">×</span>
              </div>
            </div>
          </div>

          {/* 운항조건별 사용 여부 */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">운항조건별 사용 여부</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CONDITIONS.filter(c => projectConditions.includes(c) || true).map((cond) => (
                <label key={cond}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer text-sm border transition-colors ${
                    form.activeConditions.includes(cond)
                      ? "bg-sky-900/30 border-sky-600 text-sky-300"
                      : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <input type="checkbox" className="hidden"
                    checked={form.activeConditions.includes(cond)}
                    onChange={() => toggleCondition(cond)} />
                  {CONDITION_LABELS[cond]}
                </label>
              ))}
            </div>
          </div>

          {/* SOLAS 비상부하 */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-orange-500"
                checked={form.isEmergency}
                onChange={(e) => setForm({ ...form, isEmergency: e.target.checked,
                  busId: e.target.checked ? "emergency" : form.busId,
                  activeConditions: e.target.checked
                    ? [...new Set([...form.activeConditions, "emergency" as OperatingCondition])]
                    : form.activeConditions
                })} />
              <span className="text-sm text-orange-400">SOLAS 비상부하</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-sky-500"
                checked={form.isEssential}
                onChange={(e) => setForm({ ...form, isEssential: e.target.checked })} />
              <span className="text-sm text-sky-400">필수부하</span>
            </label>
          </div>

          {/* 상세 설정 (접이식) */}
          <div>
            <button
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              상세 설정 (역률, 기동방식, 케이블)
            </button>
            {showAdvanced && (
              <div className="mt-2 pt-3 border-t border-slate-700/50 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">역률 (PF)</label>
                    <input className="input-field w-full" type="number" step="0.01" min="0.5" max="1"
                      value={form.powerFactor}
                      onChange={(e) => setForm({ ...form, powerFactor: parseFloat(e.target.value) || 0.85 })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">효율 (η)</label>
                    <input className="input-field w-full" type="number" step="0.01" min="0.5" max="1"
                      value={form.efficiency}
                      onChange={(e) => setForm({ ...form, efficiency: parseFloat(e.target.value) || 0.9 })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">케이블 길이 (m)</label>
                    <input className="input-field w-full" type="number" placeholder="50"
                      value={form.cableLength || ""}
                      onChange={(e) => setForm({ ...form, cableLength: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                {isMotor && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">기동방식</label>
                      <select className="input-field w-full" value={form.startMethod}
                        onChange={(e) => {
                          const m = e.target.value as StartMethod;
                          const mult = m === "DOL" ? 6 : m === "Y-Delta" ? 3 : m === "SoftStarter" ? 3.5 : 1.5;
                          setForm({ ...form, startMethod: m, startCurrentMultiplier: mult });
                        }}>
                        <option value="DOL">DOL (직입기동)</option>
                        <option value="Y-Delta">Y-Δ (스타-델타)</option>
                        <option value="SoftStarter">Soft Starter</option>
                        <option value="VFD">VFD (인버터)</option>
                        <option value="None">없음</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">기동전류 배수</label>
                      <input className="input-field w-full" type="number" step="0.5" min="1"
                        value={form.startCurrentMultiplier}
                        onChange={(e) => setForm({ ...form, startCurrentMultiplier: parseFloat(e.target.value) || 6 })} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary"
            onClick={() => { if (form.name && form.ratedPowerKW > 0) { onSave(form); onClose(); } }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// 프리셋 모달
// ================================================================
function PresetModal({ onClose, onAdd, activeConditions }: {
  onClose: () => void;
  onAdd: (loads: Omit<Load, "id">[]) => void;
  activeConditions: OperatingCondition[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openCategory, setOpenCategory] = useState<string | null>("기관실 보조기계");

  function toggle(category: string, name: string) {
    const key = `${category}::${name}`;
    setSelected((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleAdd() {
    const loads: Omit<Load, "id">[] = [];
    for (const key of selected) {
      const [category, name] = key.split("::");
      const preset = PRESETS[category]?.find((p) => p.name === name);
      if (!preset) continue;
      loads.push({
        name: preset.name,
        type: preset.type,
        ratedPowerKW: preset.kw,
        powerFactor: preset.pf,
        efficiency: preset.efficiency,
        busId: preset.defaultBus ?? "port",
        startMethod: preset.start,
        startCurrentMultiplier: preset.startMult,
        loadFactor: preset.loadFactor,
        activeConditions: preset.isEmergency
          ? ["emergency"]
          : activeConditions.filter((c) => c !== "emergency"),
        isEmergency: !!preset.isEmergency,
        isEssential: false,
        cableLength: 30,
      });
    }
    onAdd(loads);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card p-5 w-[600px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-200">프리셋에서 장비 추가</h3>
          <span className="text-xs text-slate-400">{selected.size}개 선택</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.entries(PRESETS).map(([category, items]) => (
            <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 text-sm font-medium text-slate-300 hover:bg-slate-800"
                onClick={() => setOpenCategory(openCategory === category ? null : category)}
              >
                <span>{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{items.length}개</span>
                  {openCategory === category ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>
              {openCategory === category && (
                <div className="divide-y divide-slate-700/30">
                  {items.map((item) => {
                    const key = `${category}::${item.name}`;
                    return (
                      <label key={item.name}
                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                          selected.has(key) ? "bg-sky-900/20" : "hover:bg-slate-800/30"
                        }`}>
                        <input type="checkbox" className="w-4 h-4 accent-sky-500 shrink-0"
                          checked={selected.has(key)}
                          onChange={() => toggle(category, item.name)} />
                        <span className="flex-1 text-sm text-slate-300">{item.name}</span>
                        <span className="text-xs font-mono text-sky-400">{item.kw} kW</span>
                        <span className="text-xs text-slate-500 w-16">{item.start}</span>
                        {item.isEmergency && (
                          <span className="text-xs text-orange-400">SOLAS</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-700/50">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleAdd} disabled={selected.size === 0}>
            {selected.size}개 추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// 메인 탭 컴포넌트
// ================================================================
export default function EquipmentTab() {
  const {
    project,
    addGenerator, updateGenerator, removeGenerator,
    addLoad, updateLoad, removeLoad,
    updateSettings, updateProjectName,
  } = useProjectStore();

  const [genModal, setGenModal] = useState<{ open: boolean; editing?: Generator }>({ open: false });
  const [loadModal, setLoadModal] = useState<{ open: boolean; editing?: Load }>({ open: false });
  const [presetModal, setPresetModal] = useState(false);

  const mainGens = project.generators.filter((g) => g.type === "main");
  const emergGens = project.generators.filter((g) => g.type === "emergency");
  const totalMainKW = mainGens.reduce((s, g) => s + g.ratedPowerKW, 0);
  const totalEmergKW = emergGens.reduce((s, g) => s + g.ratedPowerKW, 0);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* ── 프로젝트 설정 ── */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">프로젝트 설정</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">프로젝트명</label>
            <input className="input-field w-full" value={project.name}
              onChange={(e) => updateProjectName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">선박명</label>
            <input className="input-field w-full" placeholder="H-1041"
              value={project.settings.vesselName}
              onChange={(e) => updateSettings({ vesselName: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">선종</label>
            <select className="input-field w-full" value={project.settings.vesselType}
              onChange={(e) => updateSettings({ vesselType: e.target.value })}>
              {VESSEL_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">시스템 전압</label>
            <select className="input-field w-full" value={project.settings.voltage}
              onChange={(e) => updateSettings({ voltage: parseInt(e.target.value) as typeof project.settings.voltage })}>
              {[220, 380, 440, 450, 480, 690].map((v) => (
                <option key={v} value={v}>{v}V</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">주파수</label>
            <select className="input-field w-full" value={project.settings.frequency}
              onChange={(e) => updateSettings({ frequency: parseInt(e.target.value) as 50 | 60 })}>
              <option value={60}>60 Hz</option>
              <option value={50}>50 Hz</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">선급</label>
            <select className="input-field w-full" value={project.settings.classRule}
              onChange={(e) => updateSettings({ classRule: e.target.value as typeof project.settings.classRule })}>
              {["KR", "ABS", "DNV", "LR", "BV", "NK"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── 발전기 ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">발전기</h2>
          </div>
          <button className="btn-primary flex items-center gap-1.5 text-xs"
            onClick={() => setGenModal({ open: true })}>
            <Plus size={13} /> 발전기 추가
          </button>
        </div>

        {project.generators.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            발전기를 추가해주세요
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left">명칭</th>
                <th className="text-left">유형</th>
                <th className="text-right">용량 (kW)</th>
                <th className="text-right">전압 (V)</th>
                <th className="text-right">역률</th>
                <th className="text-right">X&apos;d (pu)</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {project.generators.map((gen) => (
                <tr key={gen.id}>
                  <td className="font-medium">{gen.name}</td>
                  <td>
                    <span className={gen.type === "emergency" ? "text-orange-400" : "text-sky-400"}>
                      {gen.type === "emergency" ? "비상" : "주"}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sky-300">{gen.ratedPowerKW.toLocaleString()}</td>
                  <td className="text-right font-mono">{gen.ratedVoltage}</td>
                  <td className="text-right font-mono">{gen.powerFactor}</td>
                  <td className="text-right font-mono">{gen.subtransientReactance}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-icon" onClick={() => setGenModal({ open: true, editing: gen })}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn-icon text-red-400 hover:text-red-300"
                        onClick={() => removeGenerator(gen.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {project.generators.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/30 flex gap-4 text-xs text-slate-400">
            <span>주발전기 합계: <span className="text-sky-400 font-mono">{totalMainKW.toLocaleString()} kW</span></span>
            {totalEmergKW > 0 && (
              <span>비상발전기: <span className="text-orange-400 font-mono">{totalEmergKW.toLocaleString()} kW</span></span>
            )}
          </div>
        )}
      </div>

      {/* ── 부하 목록 ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">부하 목록</h2>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1.5 text-xs"
              onClick={() => setPresetModal(true)}>
              <Package size={13} /> 프리셋에서 추가
            </button>
            <button className="btn-primary flex items-center gap-1.5 text-xs"
              onClick={() => setLoadModal({ open: true })}>
              <Plus size={13} /> 직접 추가
            </button>
          </div>
        </div>

        {project.loads.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">부하를 추가해주세요</p>
            <p className="text-xs mt-1 text-slate-600">
              &apos;프리셋에서 추가&apos;로 자주 사용하는 선박 장비를 빠르게 등록하세요
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left">#</th>
                  <th className="text-left">장비명</th>
                  <th className="text-right">용량 (kW)</th>
                  <th className="text-left">모선</th>
                  <th className="text-left">유형</th>
                  <th className="text-left">기동</th>
                  <th className="text-left">사용 조건</th>
                  <th className="text-center">SOLAS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {project.loads.map((load, i) => (
                  <tr key={load.id}>
                    <td className="text-slate-500">{i + 1}</td>
                    <td className="font-medium">{load.name}</td>
                    <td className="text-right font-mono text-sky-300">{load.ratedPowerKW}</td>
                    <td>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        load.busId === "emergency"
                          ? "bg-orange-900/30 text-orange-400"
                          : "bg-sky-900/30 text-sky-400"
                      }`}>
                        {load.busId === "port" ? "Port" : load.busId === "stbd" ? "Stbd" : "E"}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">{LOAD_TYPE_LABELS[load.type]}</td>
                    <td className="text-slate-400 text-xs">{load.startMethod}</td>
                    <td>
                      <div className="flex flex-wrap gap-0.5">
                        {load.activeConditions.map((c) => (
                          <span key={c} className="text-xs px-1 py-0.5 bg-slate-800 text-slate-400 rounded">
                            {CONDITION_LABELS[c]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center">
                      {load.isEmergency && <span className="text-orange-400">⚡</span>}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-icon" onClick={() => setLoadModal({ open: true, editing: load })}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn-icon text-red-400 hover:text-red-300"
                          onClick={() => removeLoad(load.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {project.loads.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/30 flex gap-4 text-xs text-slate-400">
            <span>총 <span className="text-slate-200">{project.loads.length}</span>개 장비</span>
            <span>
              정격용량 합계:{" "}
              <span className="text-sky-400 font-mono">
                {project.loads.reduce((s, l) => s + l.ratedPowerKW, 0).toLocaleString()} kW
              </span>
            </span>
            <span>
              비상부하:{" "}
              <span className="text-orange-400">{project.loads.filter((l) => l.isEmergency).length}개</span>
            </span>
          </div>
        )}
      </div>

      {/* ── 도움말 ── */}
      <div className="card p-4 bg-slate-900/50">
        <div className="flex gap-2">
          <Info size={14} className="text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-1">
            <p><span className="text-slate-300">부하율(LF)</span>: 운전 중 실제 소비 / 정격 용량. 예: 200kW 모터가 160kW 운전 → 0.8</p>
            <p><span className="text-slate-300">운항조건</span>: 체크된 조건에서만 해당 장비가 전력을 소비합니다</p>
            <p><span className="text-slate-300">SOLAS 비상부하</span>: 비상발전기(E/G)에서 전원 공급되는 필수 부하</p>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {genModal.open && (
        <GeneratorModal
          initial={genModal.editing}
          voltage={project.settings.voltage}
          onSave={(g) => genModal.editing ? updateGenerator(genModal.editing.id, g) : addGenerator(g)}
          onClose={() => setGenModal({ open: false })}
        />
      )}
      {loadModal.open && (
        <LoadModal
          initial={loadModal.editing}
          activeConditions={project.conditions}
          onSave={(l) => loadModal.editing ? updateLoad(loadModal.editing.id, l) : addLoad(l)}
          onClose={() => setLoadModal({ open: false })}
        />
      )}
      {presetModal && (
        <PresetModal
          activeConditions={project.conditions}
          onClose={() => setPresetModal(false)}
          onAdd={(loads) => loads.forEach(addLoad)}
        />
      )}
    </div>
  );
}
