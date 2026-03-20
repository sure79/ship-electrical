"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, Download, Save, FolderOpen, Plus, ChevronDown, Upload, HelpCircle } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import HelpGuide from "@/components/common/HelpGuide";
import EquipmentTab from "@/components/tabs/EquipmentTab";
import LoadBalanceTab from "@/components/tabs/LoadBalanceTab";
import DiagramTab from "@/components/tabs/DiagramTab";
import SubmissionTab from "@/components/tabs/SubmissionTab";
import { CONDITION_LABELS } from "@/types";

const TABS = [
  { id: "equipment", label: "1. 장비 입력" },
  { id: "load-balance", label: "2. 전력 계산" },
  { id: "diagram", label: "3. 결선도" },
  { id: "submission", label: "4. 선급 제출" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("equipment");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    project,
    projectList,
    saveStatus,
    lastSavedAt,
    loadBalanceSummaries,
    loadProjectList,
    createProject,
    saveProject,
    deleteProject,
    loadProject,
    updateProjectName,
    importProject,
    exportProjectJSON,
    runCalculations,
  } = useProjectStore();

  useEffect(() => {
    loadProjectList();
    runCalculations();
    // URL에 ?id= 가 있으면 해당 프로젝트 불러오기
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) loadProject(id);
  }, []);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 최대 부하율 (상태바 표시용)
  const maxLoad = loadBalanceSummaries.reduce(
    (max, s) => Math.max(max, s.loadPercentage),
    0
  );
  const maxLoadCond = loadBalanceSummaries.find(
    (s) => s.loadPercentage === maxLoad
  );
  const totalGenKW = project.generators
    .filter((g) => g.type === "main")
    .reduce((sum, g) => sum + g.ratedPowerKW, 0);

  function handleNewProject() {
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim());
    setNewProjectName("");
    setShowNewProjectDialog(false);
    setShowProjectMenu(false);
    window.history.pushState({}, "", "/");
  }

  function handleExportJSON() {
    const json = exportProjectJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.meds.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importProject(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleSelectProject(id: string) {
    loadProject(id);
    setShowProjectMenu(false);
    window.history.pushState({}, "", `?id=${id}`);
  }

  const saveStatusLabel =
    saveStatus === "saving"
      ? "저장 중..."
      : saveStatus === "saved"
      ? `저장됨 ${lastSavedAt}`
      : saveStatus === "error"
      ? "저장 실패"
      : "";

  const saveStatusColor =
    saveStatus === "saving"
      ? "text-sky-400"
      : saveStatus === "saved"
      ? "text-green-400"
      : saveStatus === "error"
      ? "text-red-400"
      : "text-slate-500";

  return (
    <div className="flex flex-col h-screen bg-[#0a1628] overflow-hidden">
      {/* ── 헤더 ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0d1f35] border-b border-slate-700/50 shrink-0">
        {/* 로고 + 프로젝트 선택 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-lg">
            <Zap size={20} />
            <span className="hidden sm:block">Ship Electrical</span>
          </div>

          {/* 프로젝트 드롭다운 */}
          <div className="relative" ref={menuRef}>
            <button
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-md text-sm text-slate-200 hover:border-sky-500 transition-colors"
              onClick={() => setShowProjectMenu((v) => !v)}
            >
              <FolderOpen size={14} className="text-slate-400" />
              <span className="max-w-48 truncate">{project.name}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {showProjectMenu && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sky-400 hover:bg-slate-800 rounded-md transition-colors"
                    onClick={() => {
                      setShowNewProjectDialog(true);
                      setShowProjectMenu(false);
                    }}
                  >
                    <Plus size={14} />
                    새 프로젝트
                  </button>
                </div>
                {projectList.length > 0 && (
                  <>
                    <div className="border-t border-slate-700 my-1" />
                    <div className="p-2 max-h-64 overflow-y-auto">
                      <p className="text-xs text-slate-500 px-2 mb-1 uppercase tracking-wider">저장된 프로젝트</p>
                      {projectList.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between group"
                        >
                          <button
                            className="flex-1 text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition-colors truncate"
                            onClick={() => handleSelectProject(p.id)}
                          >
                            {p.name}
                          </button>
                          <button
                            className="hidden group-hover:block p-1 text-red-400 hover:text-red-300 text-xs mr-1"
                            onClick={() => {
                              if (confirm(`"${p.name}" 프로젝트를 삭제하시겠습니까?`)) {
                                deleteProject(p.id);
                              }
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 저장 상태 */}
          <span className={`text-xs ${saveStatusColor} hidden md:block`}>
            {saveStatusLabel}
          </span>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-2">
          <button className="btn-icon" onClick={() => setShowHelp(true)} title="사용 가이드">
            <HelpCircle size={16} />
          </button>
          <button className="btn-icon" onClick={saveProject} title="저장">
            <Save size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          <button
            className="btn-icon"
            onClick={() => fileInputRef.current?.click()}
            title="JSON 가져오기"
          >
            <Upload size={16} />
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={handleExportJSON}>
            <Download size={13} />
            JSON 저장
          </button>
        </div>
      </header>

      {/* ── 탭 바 ── */}
      <div className="flex border-b border-slate-700/50 bg-[#0d1f35] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "equipment" && <EquipmentTab />}
        {activeTab === "load-balance" && <LoadBalanceTab />}
        {activeTab === "diagram" && <DiagramTab />}
        {activeTab === "submission" && <SubmissionTab />}
      </main>

      {/* ── 하단 상태바 ── */}
      <footer className="flex items-center gap-4 px-4 py-1.5 bg-[#0d1f35] border-t border-slate-700/50 text-xs text-slate-400 shrink-0 font-mono">
        <span>
          {project.settings.voltage}V
        </span>
        <span className="text-slate-600">|</span>
        <span>
          {project.settings.phase}Ph
        </span>
        <span className="text-slate-600">|</span>
        <span>
          {project.settings.frequency}Hz
        </span>
        <span className="text-slate-600">|</span>
        <span>
          Gen{" "}
          <span className="text-sky-400">
            {totalGenKW.toLocaleString()}
          </span>{" "}
          kW
        </span>
        {maxLoad > 0 && (
          <>
            <span className="text-slate-600">|</span>
            <span>
              최대부하율{" "}
              <span
                className={
                  maxLoad > 90
                    ? "text-red-400"
                    : maxLoad > 80
                    ? "text-amber-400"
                    : "text-green-400"
                }
              >
                {maxLoad.toFixed(1)}%
              </span>
              {maxLoadCond && (
                <span className="text-slate-500">
                  {" "}({CONDITION_LABELS[maxLoadCond.condition]})
                </span>
              )}
            </span>
          </>
        )}
        <span className="text-slate-600">|</span>
        <span>
          {project.settings.classRule}
        </span>
        {project.settings.vesselName && (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 truncate max-w-40">
              {project.settings.vesselName}
            </span>
          </>
        )}
      </footer>

      {/* ── 도움말 ── */}
      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}

      {/* ── 새 프로젝트 다이얼로그 ── */}
      {showNewProjectDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card p-6 w-96">
            <h3 className="text-base font-semibold text-slate-200 mb-4">새 프로젝트</h3>
            <input
              className="input-field w-full mb-4"
              placeholder="프로젝트명 (예: 청항선 전력계통)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewProject()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowNewProjectDialog(false);
                  setNewProjectName("");
                }}
              >
                취소
              </button>
              <button className="btn-primary" onClick={handleNewProject}>
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
