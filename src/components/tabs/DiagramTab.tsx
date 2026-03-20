"use client";

import { useState, useRef, useCallback } from "react";
import { Download, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { generateDrawioXML } from "@/lib/calculations";
import type { Generator, Load } from "@/types";

// ================================================================
// 심볼 컴포넌트들 (IEC 60617 기반, SVG)
// ================================================================

function GeneratorSymbol({
  x, y, label, kw, type,
}: { x: number; y: number; label: string; kw: number; type: "main" | "emergency" }) {
  const color = type === "emergency" ? "#ff6b35" : "#4fc3f7";
  return (
    <g>
      <circle cx={x} cy={y} r={22} fill="#0d1f35" stroke={color} strokeWidth={2} />
      <text x={x} y={y - 3} textAnchor="middle" fill={color} fontSize={13} fontWeight="bold">G</text>
      <text x={x} y={y + 11} textAnchor="middle" fill={color} fontSize={10}>~</text>
      <text x={x} y={y + 36} textAnchor="middle" fill="#e0e0e0" fontSize={9}>{label}</text>
      <text x={x} y={y + 47} textAnchor="middle" fill={color} fontSize={9} fontFamily="monospace">{kw}kW</text>
    </g>
  );
}

function LoadSymbol({
  x, y, label, kw, ltype,
}: { x: number; y: number; label: string; kw: number; ltype: string }) {
  const color =
    ltype === "transformer" ? "#ffb74d" :
    ltype === "heater" ? "#a5d6a7" :
    ltype === "lighting" || ltype === "navigation" || ltype === "communication" ? "#e0e0e0" :
    "#ce93d8";
  const isMotor = ["motor", "pump", "compressor", "fan"].includes(ltype);
  const symbol = isMotor ? "M" : ltype === "transformer" ? "T" : "~";

  return (
    <g>
      <circle cx={x} cy={y} r={16} fill="#0a1628" stroke={color} strokeWidth={1.5} />
      <text x={x} y={y + 5} textAnchor="middle" fill={color} fontSize={11} fontWeight="bold">{symbol}</text>
      <text x={x} y={y + 30} textAnchor="middle" fill="#e0e0e0" fontSize={8}
        style={{ maxWidth: "80px" }}>{label.length > 12 ? label.slice(0, 11) + "…" : label}</text>
      <text x={x} y={y + 40} textAnchor="middle" fill={color} fontSize={8} fontFamily="monospace">{kw}kW</text>
    </g>
  );
}

function BreakerSymbol({ x, y }: { x: number; y: number }) {
  return (
    <rect x={x - 6} y={y - 6} width={12} height={12} fill="#0d1f35" stroke="#4caf50" strokeWidth={1.5} rx={1} />
  );
}

function BusTieSymbol({ x, y, closed }: { x: number; y: number; closed: boolean }) {
  const color = closed ? "#ffd54f" : "#546e7a";
  return (
    <g>
      <rect x={x - 10} y={y - 10} width={20} height={20} fill="#0d1f35" stroke={color} strokeWidth={1.5} rx={2} />
      <text x={x} y={y + 4} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">BT</text>
    </g>
  );
}

// ================================================================
// 다이어그램 레이아웃 계산
// ================================================================
interface DiagramLayout {
  generators: Array<Generator & { x: number; y: number }>;
  portBus: { x1: number; y: number; x2: number; label: string };
  stbdBus: { x1: number; y: number; x2: number; label: string };
  emergBus: { x1: number; y: number; x2: number; label: string };
  busTie: { x: number; y: number };
  loads: Array<Load & { x: number; y: number }>;
  width: number;
  height: number;
}

function computeLayout(
  generators: Generator[],
  loads: Load[],
  showEmerg: boolean
): DiagramLayout {
  const GEN_Y = 70;
  const BUS_Y = 170;
  const LOAD_Y = 310;
  const GEN_SPACING = 130;
  const LOAD_SPACING = 95;

  const mainGens = generators.filter((g) => g.type === "main");
  const emergGens = generators.filter((g) => g.type === "emergency");
  const portLoads = loads.filter((l) => l.busId === "port");
  const stbdLoads = loads.filter((l) => l.busId === "stbd");
  const emergLoads = loads.filter((l) => l.busId === "emergency");

  const portWidth = Math.max(250, Math.max(Math.ceil(mainGens.length / 2), portLoads.length) * LOAD_SPACING + 40);
  const stbdWidth = Math.max(200, Math.max(Math.ceil(mainGens.length / 2), stbdLoads.length) * LOAD_SPACING + 40);
  const emergWidth = Math.max(200, emergLoads.length * 90 + 40);

  const portBusX1 = 40;
  const portBusX2 = portBusX1 + portWidth;
  const stbdBusX1 = portBusX2 + 80;
  const stbdBusX2 = stbdBusX1 + stbdWidth;
  const emergBusX1 = stbdBusX2 + 60;
  const emergBusX2 = emergBusX1 + emergWidth;

  // 발전기 배치 (Port / Stbd 양쪽)
  const placedGens: Array<Generator & { x: number; y: number }> = mainGens.map((g, i) => ({
    ...g,
    x: i % 2 === 0
      ? portBusX1 + 50 + Math.floor(i / 2) * GEN_SPACING
      : stbdBusX1 + 50 + Math.floor(i / 2) * GEN_SPACING,
    y: GEN_Y,
  }));
  emergGens.forEach((g, i) => {
    placedGens.push({ ...g, x: emergBusX1 + 50 + i * 110, y: GEN_Y });
  });

  // 부하 배치
  const placedLoads: Array<Load & { x: number; y: number }> = [];
  portLoads.forEach((l, i) => {
    placedLoads.push({ ...l, x: portBusX1 + 30 + i * LOAD_SPACING, y: LOAD_Y });
  });
  stbdLoads.forEach((l, i) => {
    placedLoads.push({ ...l, x: stbdBusX1 + 20 + i * LOAD_SPACING, y: LOAD_Y });
  });
  if (showEmerg) {
    emergLoads.forEach((l, i) => {
      placedLoads.push({ ...l, x: emergBusX1 + 20 + i * 90, y: LOAD_Y });
    });
  }

  const totalWidth = (showEmerg ? emergBusX2 : stbdBusX2) + 60;

  return {
    generators: placedGens,
    portBus: { x1: portBusX1, y: BUS_Y, x2: portBusX2, label: `MSB (Port)  ${portWidth > 0 ? "" : ""}` },
    stbdBus: { x1: stbdBusX1, y: BUS_Y, x2: stbdBusX2, label: "MSB (Stbd)" },
    emergBus: { x1: emergBusX1, y: BUS_Y, x2: emergBusX2, label: "Emergency SWB" },
    busTie: { x: (portBusX2 + stbdBusX1) / 2, y: BUS_Y },
    loads: placedLoads,
    width: totalWidth,
    height: 400,
  };
}

// ================================================================
// 메인 다이어그램 컴포넌트
// ================================================================
export default function DiagramTab() {
  const { project } = useProjectStore();
  const [busTieClosed, setBusTieClosed] = useState(true);
  const [showEmerg, setShowEmerg] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const { generators, loads, settings } = project;
  const layout = computeLayout(generators, loads, showEmerg);

  // 줌
  const zoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.3));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // 팬 (드래그)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === "svg") {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  // SVG 다운로드
  function downloadSVG() {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_SLD.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // draw.io 내보내기
  function downloadDrawio() {
    const xml = generateDrawioXML(generators, loads, settings.voltage);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_SLD.drawio`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (generators.length === 0 && loads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <p className="text-sm">장비 입력 탭에서 발전기와 부하를 추가하면 단선결선도가 자동으로 그려집니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 도구바 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1f35] border-b border-slate-700/50 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <button className="btn-icon" onClick={zoomIn} title="확대"><ZoomIn size={15} /></button>
          <span className="text-xs text-slate-400 font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button className="btn-icon" onClick={zoomOut} title="축소"><ZoomOut size={15} /></button>
          <button className="btn-icon" onClick={resetView} title="초기화"><RotateCcw size={15} /></button>
        </div>

        <div className="w-px h-5 bg-slate-700" />

        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
          <input type="checkbox" className="w-3.5 h-3.5 accent-amber-400"
            checked={busTieClosed} onChange={(e) => setBusTieClosed(e.target.checked)} />
          Bus-Tie {busTieClosed ? "투입" : "개방"}
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
          <input type="checkbox" className="w-3.5 h-3.5 accent-orange-500"
            checked={showEmerg} onChange={(e) => setShowEmerg(e.target.checked)} />
          비상 계통
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
          <input type="checkbox" className="w-3.5 h-3.5 accent-sky-500"
            checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          라벨 표시
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={downloadSVG}>
            <Download size={12} /> SVG
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={downloadDrawio}>
            <Download size={12} /> draw.io
          </button>
        </div>
      </div>

      {/* SVG 다이어그램 */}
      <div className="flex-1 overflow-hidden bg-[#0a1628] relative"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        style={{ cursor: isPanning.current ? "grabbing" : "grab" }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ background: "#0a1628" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform={`translate(${pan.x + 20}, ${pan.y + 20}) scale(${zoom})`}>
            {/* ── 발전기 → 모선 연결선 ── */}
            {layout.generators.map((gen) => {
              const busY = layout.portBus.y;
              return (
                <line key={`vline-${gen.id}`}
                  x1={gen.x} y1={gen.y + 22}
                  x2={gen.x} y2={busY}
                  stroke={gen.type === "emergency" ? "#ff6b35" : "#4fc3f7"}
                  strokeWidth={1.5}
                />
              );
            })}

            {/* ── 발전기 차단기 ── */}
            {layout.generators.map((gen) => (
              <BreakerSymbol key={`cb-${gen.id}`} x={gen.x} y={(gen.y + 22 + layout.portBus.y) / 2} />
            ))}

            {/* ── Port 모선 ── */}
            <line
              x1={layout.portBus.x1} y1={layout.portBus.y}
              x2={layout.portBus.x2} y2={layout.portBus.y}
              stroke="#4fc3f7" strokeWidth={4}
            />
            {showLabels && (
              <text x={layout.portBus.x1} y={layout.portBus.y - 8}
                fill="#4fc3f7" fontSize={11} fontWeight="bold">
                MSB (Port) — {settings.voltage}V
              </text>
            )}

            {/* ── Bus-Tie ── */}
            {project.generators.filter((g) => g.type === "main").length > 0 && (
              <>
                <line
                  x1={layout.portBus.x2} y1={layout.portBus.y}
                  x2={layout.busTie.x - 10} y2={layout.busTie.y}
                  stroke={busTieClosed ? "#ffd54f" : "#546e7a"}
                  strokeWidth={busTieClosed ? 2 : 1}
                  strokeDasharray={busTieClosed ? undefined : "6 4"}
                />
                <BusTieSymbol x={layout.busTie.x} y={layout.busTie.y} closed={busTieClosed} />
                <line
                  x1={layout.busTie.x + 10} y1={layout.busTie.y}
                  x2={layout.stbdBus.x1} y2={layout.stbdBus.y}
                  stroke={busTieClosed ? "#ffd54f" : "#546e7a"}
                  strokeWidth={busTieClosed ? 2 : 1}
                  strokeDasharray={busTieClosed ? undefined : "6 4"}
                />

                {/* ── Stbd 모선 ── */}
                <line
                  x1={layout.stbdBus.x1} y1={layout.stbdBus.y}
                  x2={layout.stbdBus.x2} y2={layout.stbdBus.y}
                  stroke="#4fc3f7" strokeWidth={4}
                />
                {showLabels && (
                  <text x={layout.stbdBus.x1} y={layout.stbdBus.y - 8}
                    fill="#4fc3f7" fontSize={11} fontWeight="bold">
                    MSB (Stbd)
                  </text>
                )}
              </>
            )}

            {/* ── 비상 모선 ── */}
            {showEmerg && (
              <>
                <line
                  x1={layout.emergBus.x1} y1={layout.emergBus.y}
                  x2={layout.emergBus.x2} y2={layout.emergBus.y}
                  stroke="#ff6b35" strokeWidth={4}
                />
                {showLabels && (
                  <text x={layout.emergBus.x1} y={layout.emergBus.y - 8}
                    fill="#ff6b35" fontSize={11} fontWeight="bold">
                    Emergency SWB
                  </text>
                )}
              </>
            )}

            {/* ── 모선 → 부하 연결선 + 차단기 ── */}
            {layout.loads.map((load) => {
              const busY =
                load.busId === "emergency"
                  ? layout.emergBus.y
                  : load.busId === "stbd"
                  ? layout.stbdBus.y
                  : layout.portBus.y;
              const color = load.isEmergency ? "#ff6b35" : "#4fc3f7";
              const midY = (busY + load.y - 16) / 2;
              return (
                <g key={`load-conn-${load.id}`}>
                  <line x1={load.x} y1={busY} x2={load.x} y2={midY - 8}
                    stroke={color} strokeWidth={1} />
                  <BreakerSymbol x={load.x} y={midY} />
                  <line x1={load.x} y1={midY + 8} x2={load.x} y2={load.y - 16}
                    stroke={color} strokeWidth={1} strokeDasharray="4 3" />
                </g>
              );
            })}

            {/* ── 발전기 심볼 ── */}
            {layout.generators.map((gen) => (
              <GeneratorSymbol key={gen.id}
                x={gen.x} y={gen.y}
                label={gen.name} kw={gen.ratedPowerKW} type={gen.type}
              />
            ))}

            {/* ── 부하 심볼 ── */}
            {layout.loads.map((load) => (
              <LoadSymbol key={load.id}
                x={load.x} y={load.y}
                label={load.name} kw={load.ratedPowerKW} ltype={load.type}
              />
            ))}
          </g>
        </svg>

        {/* 범례 */}
        <div className="absolute bottom-3 left-3 bg-[#0d1f35]/90 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 space-y-1.5">
          <p className="text-slate-300 font-medium text-xs mb-2">범례</p>
          <div className="flex items-center gap-2"><span className="inline-block w-5 h-0.5 bg-sky-400" /> 주 계통 (Port/Stbd)</div>
          <div className="flex items-center gap-2"><span className="inline-block w-5 h-0.5 bg-orange-400" /> 비상 계통</div>
          <div className="flex items-center gap-2">
            <svg width={20} height={14}><circle cx={7} cy={7} r={5} fill="none" stroke="#4fc3f7" strokeWidth={1.5} /><text x={7} y={11} textAnchor="middle" fill="#4fc3f7" fontSize={7}>G</text></svg>
            발전기
          </div>
          <div className="flex items-center gap-2">
            <svg width={20} height={14}><circle cx={7} cy={7} r={5} fill="none" stroke="#ce93d8" strokeWidth={1.5} /><text x={7} y={11} textAnchor="middle" fill="#ce93d8" fontSize={7}>M</text></svg>
            모터/펌프
          </div>
          <div className="flex items-center gap-2">
            <svg width={20} height={14}><rect x={1} y={1} width={12} height={12} fill="none" stroke="#4caf50" strokeWidth={1.5} /></svg>
            차단기 (CB)
          </div>
          <div className="flex items-center gap-2">
            <svg width={20} height={14}><rect x={1} y={1} width={12} height={12} fill="none" stroke="#ffd54f" strokeWidth={1.5} /><text x={7} y={11} textAnchor="middle" fill="#ffd54f" fontSize={5}>BT</text></svg>
            Bus-Tie
          </div>
        </div>

        {/* 통계 */}
        <div className="absolute top-3 right-3 bg-[#0d1f35]/90 border border-slate-700/50 rounded-lg p-3 text-xs">
          <p className="text-slate-300 font-medium mb-1.5">계통 요약</p>
          <p className="text-slate-400">발전기: <span className="text-sky-400">{generators.length}대</span></p>
          <p className="text-slate-400">부하: <span className="text-sky-400">{loads.length}개</span></p>
          <p className="text-slate-400">
            총발전: <span className="text-sky-400 font-mono">
              {generators.filter(g => g.type === "main").reduce((s, g) => s + g.ratedPowerKW, 0).toLocaleString()}kW
            </span>
          </p>
          <p className="text-slate-400">
            총부하: <span className="text-sky-400 font-mono">
              {loads.reduce((s, l) => s + l.ratedPowerKW, 0).toLocaleString()}kW
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
