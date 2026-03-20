"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Project,
  Generator,
  Load,
  ProjectSettings,
  OperatingCondition,
  LoadBalanceRow,
  LoadBalanceSummary,
  ShortCircuitResult,
  VoltageDropResult,
  Warning,
} from "@/types";

// ================================================================
// 기본값
// ================================================================
const DEFAULT_SETTINGS: ProjectSettings = {
  vesselName: "",
  vesselType: "general_cargo",
  voltage: 450,
  frequency: 60,
  phase: 3,
  classRule: "KR",
};

const DEFAULT_CONDITIONS: OperatingCondition[] = [
  "sea_going",
  "maneuvering",
  "port_idle",
  "emergency",
];

function makeNewProject(name = "새 프로젝트"): Project {
  return {
    id: nanoid(),
    name,
    settings: { ...DEFAULT_SETTINGS },
    generators: [],
    loads: [],
    activeGeneratorsByCondition: {},
    conditions: [...DEFAULT_CONDITIONS],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ================================================================
// Store 타입
// ================================================================
interface ProjectStore {
  // 현재 프로젝트
  project: Project;
  projectList: { id: string; name: string; updatedAt: string }[];
  isSaving: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string | null;

  // 계산 결과 (계산 시 업데이트)
  loadBalanceRows: LoadBalanceRow[];
  loadBalanceSummaries: LoadBalanceSummary[];
  shortCircuitResults: ShortCircuitResult[];
  voltageDropResults: VoltageDropResult[];
  warnings: Warning[];

  // 프로젝트 관리
  loadProjectList: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createProject: (name: string) => void;
  saveProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  importProject: (json: string) => void;
  exportProjectJSON: () => string;

  // 프로젝트 수정
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  updateProjectName: (name: string) => void;

  // 발전기 CRUD
  addGenerator: (gen: Omit<Generator, "id">) => void;
  updateGenerator: (id: string, updates: Partial<Generator>) => void;
  removeGenerator: (id: string) => void;

  // 부하 CRUD
  addLoad: (load: Omit<Load, "id">) => void;
  updateLoad: (id: string, updates: Partial<Load>) => void;
  removeLoad: (id: string) => void;

  // 운항조건 관리
  toggleCondition: (cond: OperatingCondition) => void;
  setActiveGenerators: (cond: string, genIds: string[]) => void;

  // 계산 실행
  runCalculations: () => void;
}

// ================================================================
// Zustand Store
// ================================================================
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: makeNewProject(),
  projectList: [],
  isSaving: false,
  saveStatus: "idle",
  lastSavedAt: null,

  loadBalanceRows: [],
  loadBalanceSummaries: [],
  shortCircuitResults: [],
  voltageDropResults: [],
  warnings: [],

  // ── 프로젝트 관리 ──────────────────────────────────────────────
  loadProjectList: async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const list = await res.json();
      set({ projectList: list });
    } catch {
      // DB 미설정 상태에서는 무시
    }
  },

  loadProject: async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const project: Project = JSON.parse(data.data);
      set({ project });
      get().runCalculations();
    } catch {
      console.error("프로젝트 불러오기 실패");
    }
  },

  createProject: (name: string) => {
    const project = makeNewProject(name);
    set({ project, loadBalanceRows: [], loadBalanceSummaries: [], warnings: [] });
  },

  saveProject: async () => {
    const { project } = get();
    set({ isSaving: true, saveStatus: "saving" });
    try {
      const updated = { ...project, updatedAt: new Date().toISOString() };
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: project.name, data: JSON.stringify(updated) }),
      });
      if (res.status === 404) {
        // 최초 저장
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: project.id, name: project.name, data: JSON.stringify(updated) }),
        });
      }
      set({ project: updated, saveStatus: "saved", lastSavedAt: new Date().toLocaleTimeString("ko-KR") });
    } catch {
      set({ saveStatus: "error" });
    } finally {
      set({ isSaving: false });
    }
  },

  deleteProject: async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      await get().loadProjectList();
    } catch {
      console.error("삭제 실패");
    }
  },

  importProject: (json: string) => {
    try {
      const project: Project = JSON.parse(json);
      set({ project });
      get().runCalculations();
    } catch {
      alert("올바른 프로젝트 파일이 아닙니다.");
    }
  },

  exportProjectJSON: () => {
    return JSON.stringify(get().project, null, 2);
  },

  // ── 프로젝트 수정 ──────────────────────────────────────────────
  updateSettings: (settings) => {
    set((s) => ({
      project: {
        ...s.project,
        settings: { ...s.project.settings, ...settings },
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  updateProjectName: (name) => {
    set((s) => ({ project: { ...s.project, name } }));
    scheduleAutosave(get);
  },

  // ── 발전기 CRUD ────────────────────────────────────────────────
  addGenerator: (gen) => {
    const newGen = { ...gen, id: nanoid() };
    set((s) => ({
      project: {
        ...s.project,
        generators: [...s.project.generators, newGen],
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  updateGenerator: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        generators: s.project.generators.map((g) =>
          g.id === id ? { ...g, ...updates } : g
        ),
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  removeGenerator: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        generators: s.project.generators.filter((g) => g.id !== id),
        activeGeneratorsByCondition: Object.fromEntries(
          Object.entries(s.project.activeGeneratorsByCondition).map(([k, v]) => [
            k,
            (v as string[]).filter((gId) => gId !== id),
          ])
        ),
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  // ── 부하 CRUD ──────────────────────────────────────────────────
  addLoad: (load) => {
    const newLoad = { ...load, id: nanoid() };
    set((s) => ({
      project: {
        ...s.project,
        loads: [...s.project.loads, newLoad],
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  updateLoad: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        loads: s.project.loads.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        ),
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  removeLoad: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        loads: s.project.loads.filter((l) => l.id !== id),
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  // ── 운항조건 관리 ──────────────────────────────────────────────
  toggleCondition: (cond) => {
    set((s) => {
      const has = s.project.conditions.includes(cond);
      return {
        project: {
          ...s.project,
          conditions: has
            ? s.project.conditions.filter((c) => c !== cond)
            : [...s.project.conditions, cond],
        },
      };
    });
    get().runCalculations();
  },

  setActiveGenerators: (cond, genIds) => {
    set((s) => ({
      project: {
        ...s.project,
        activeGeneratorsByCondition: {
          ...s.project.activeGeneratorsByCondition,
          [cond]: genIds,
        },
      },
    }));
    scheduleAutosave(get);
    get().runCalculations();
  },

  // ── 계산 실행 ──────────────────────────────────────────────────
  runCalculations: () => {
    const { project } = get();
    if (project.generators.length === 0 && project.loads.length === 0) return;

    // 동적 임포트 방지 (서버사이드 렌더링 문제)
    import("@/lib/calculations").then(({ calculateLoadBalance, calculateShortCircuit, calculateVoltageDrop }) => {
      const { rows, summaries, warnings } = calculateLoadBalance(
        project.loads,
        project.generators,
        project.conditions,
        project.activeGeneratorsByCondition
      );

      const scResults = calculateShortCircuit(
        project.generators,
        project.loads,
        project.settings.voltage
      );

      const vdResults = calculateVoltageDrop(
        project.loads,
        project.settings.voltage,
        project.settings.classRule
      );

      set({
        loadBalanceRows: rows,
        loadBalanceSummaries: summaries,
        shortCircuitResults: scResults,
        voltageDropResults: vdResults,
        warnings,
      });
    });
  },
}));

// 3초 디바운스 자동저장
function scheduleAutosave(get: () => ProjectStore) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    get().saveProject();
  }, 3000);
}
