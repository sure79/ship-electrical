/**
 * 선박 전기 계산 엔진 (클라이언트 사이드 실행)
 * IEC 61363-1 (단락전류), IEC 60092-352 (전압강하/케이블)
 */
import type {
  Load,
  Generator,
  OperatingCondition,
  LoadBalanceRow,
  LoadBalanceSummary,
  ShortCircuitResult,
  VoltageDropResult,
  Warning,
} from "@/types";
import { CABLE_DATA } from "@/data/cables";

// ================================================================
// Load Balance 계산
// ================================================================
export function calculateLoadBalance(
  loads: Load[],
  generators: Generator[],
  conditions: OperatingCondition[],
  activeGeneratorsByCondition: Record<string, string[]>
): { rows: LoadBalanceRow[]; summaries: LoadBalanceSummary[]; warnings: Warning[] } {
  const rows: LoadBalanceRow[] = loads.map((load) => {
    const values = {} as Record<OperatingCondition, number>;
    for (const cond of conditions) {
      values[cond] = load.activeConditions.includes(cond)
        ? Math.round(load.ratedPowerKW * load.loadFactor * 10) / 10
        : 0;
    }
    return {
      loadId: load.id,
      loadName: load.name,
      busId: load.busId,
      ratedKW: load.ratedPowerKW,
      values,
    };
  });

  const summaries: LoadBalanceSummary[] = conditions.map((cond) => {
    const totalLoadKW =
      Math.round(rows.reduce((sum, r) => sum + r.values[cond], 0) * 10) / 10;
    const activeGenIds = activeGeneratorsByCondition[cond] ?? [];
    const activeGens = generators.filter((g) => activeGenIds.includes(g.id));
    const totalGenKW = activeGens.reduce((sum, g) => sum + g.ratedPowerKW, 0);
    const loadPercentage =
      totalGenKW > 0
        ? Math.round((totalLoadKW / totalGenKW) * 1000) / 10
        : 0;
    const marginKW = Math.round((totalGenKW - totalLoadKW) * 10) / 10;

    return {
      condition: cond,
      totalLoadKW,
      totalGenKW,
      loadPercentage,
      marginKW,
      isAcceptable: loadPercentage <= 90,
      isWarning: loadPercentage > 80 && loadPercentage <= 90,
      isCritical: loadPercentage > 90,
    };
  });

  // 경고 생성
  const warnings: Warning[] = [];

  // 대형 모터 DOL 기동 경고
  const largeDOLMotors = loads.filter(
    (l) =>
      l.startMethod === "DOL" &&
      l.ratedPowerKW >= 50 &&
      (l.type === "motor" || l.type === "pump")
  );
  for (const motor of largeDOLMotors) {
    warnings.push({
      id: `dol-${motor.id}`,
      type: "warning",
      message: `${motor.name} (${motor.ratedPowerKW}kW) 직입기동(DOL) 시 기동전류 약 ${Math.round(motor.ratedPowerKW * motor.startCurrentMultiplier)}kW 상당`,
      detail: "전압강하 및 발전기 과부하 가능성을 전압강하 계산에서 확인하세요.",
    });
  }

  // 부하율 경고
  for (const s of summaries) {
    if (s.isCritical) {
      warnings.push({
        id: `overload-${s.condition}`,
        type: "error",
        message: `${s.condition === "sea_going" ? "항해" : s.condition === "maneuvering" ? "입출항" : s.condition === "port_loading" ? "정박(하역)" : s.condition === "port_idle" ? "정박(무하역)" : "비상"} 조건 부하율 ${s.loadPercentage}% — 발전기 용량 초과`,
        detail: `현재 발전용량: ${s.totalGenKW}kW, 필요: ${Math.round(s.totalLoadKW / 0.9)}kW 이상`,
      });
    }
  }

  return { rows, summaries, warnings };
}

// ================================================================
// 단락전류 계산 (IEC 61363-1 간략화)
// ================================================================
export function calculateShortCircuit(
  generators: Generator[],
  loads: Load[],
  voltage: number
): ShortCircuitResult[] {
  const buses = [
    { id: "port" as const, name: "MSB (Port)" },
    { id: "stbd" as const, name: "MSB (Stbd)" },
    { id: "emergency" as const, name: "Emergency SWB" },
  ];

  return buses.map((bus) => {
    // 이 모선에 연결된 발전기
    const busGens = generators.filter((g) => {
      if (bus.id === "emergency") return g.type === "emergency";
      return g.type === "main";
    });

    // 발전기 기여 단락전류
    let genContributionA = 0;
    for (const gen of busGens) {
      const ratedCurrentA =
        (gen.ratedPowerKW * 1000) / (Math.sqrt(3) * voltage * gen.powerFactor);
      const scCurrentA = ratedCurrentA / gen.subtransientReactance;
      genContributionA += scCurrentA;
    }

    // 모터 기여 단락전류 (DOL 모터만)
    const busLoads = loads.filter(
      (l) =>
        l.busId === bus.id &&
        l.startMethod === "DOL" &&
        (l.type === "motor" || l.type === "pump" || l.type === "fan" || l.type === "compressor")
    );
    let motorContributionA = 0;
    for (const load of busLoads) {
      const ratedCurrentA =
        (load.ratedPowerKW * 1000) /
        (Math.sqrt(3) * voltage * load.powerFactor * load.efficiency);
      motorContributionA += ratedCurrentA * load.startCurrentMultiplier;
    }

    const totalSymmetrical = (genContributionA + motorContributionA) / 1000; // kA
    const kappa = 1.8; // 선박 계통 일반값
    const peakKA = totalSymmetrical * kappa * Math.sqrt(2);

    return {
      busId: bus.id,
      busName: bus.name,
      symmetricalKA: Math.round(totalSymmetrical * 100) / 100,
      peakKA: Math.round(peakKA * 100) / 100,
      requiredBreakingKA: Math.ceil(totalSymmetrical * 1.1),
    };
  });
}

// ================================================================
// 전압강하 계산 (IEC 60092-352 간략화)
// ================================================================
export function calculateVoltageDropForLoad(
  load: Load,
  voltage: number,
  maxRunningDropPercent = 6,
  maxStartDropPercent = 15
): VoltageDropResult {
  const ratedCurrentA =
    (load.ratedPowerKW * 1000) /
    (Math.sqrt(3) * voltage * load.powerFactor * load.efficiency);

  // 최적 케이블 사이즈 선정
  let recommended = CABLE_DATA[CABLE_DATA.length - 1];
  for (const cable of CABLE_DATA) {
    // 1) 허용전류 확인 (45°C 기준)
    if (cable.current45 < ratedCurrentA) continue;

    // 2) 전압강하 확인
    // ΔV = √3 × I × L × (R·cosφ + X·sinφ) / 1000
    const sinPhi = Math.sqrt(1 - load.powerFactor ** 2);
    const dropV =
      (Math.sqrt(3) *
        ratedCurrentA *
        (load.cableLength / 1000) *
        (cable.resistance * load.powerFactor + cable.reactance * sinPhi));
    const dropPercent = (dropV / voltage) * 100;

    if (dropPercent <= maxRunningDropPercent) {
      recommended = cable;
      break;
    }
  }

  // 최종 전압강하 계산
  const sinPhi = Math.sqrt(1 - load.powerFactor ** 2);
  const runningDropV =
    Math.sqrt(3) *
    ratedCurrentA *
    (load.cableLength / 1000) *
    (recommended.resistance * load.powerFactor + recommended.reactance * sinPhi);
  const runningDropPercent = (runningDropV / voltage) * 100;

  // 기동 시 전압강하
  const startPF =
    load.startMethod === "DOL"
      ? 0.3
      : load.startMethod === "Y-Delta"
      ? 0.4
      : load.startMethod === "SoftStarter"
      ? 0.5
      : 0.9; // VFD
  const startSinPhi = Math.sqrt(1 - startPF ** 2);
  const startCurrentA = ratedCurrentA * load.startCurrentMultiplier;
  const startingDropV =
    Math.sqrt(3) *
    startCurrentA *
    (load.cableLength / 1000) *
    (recommended.resistance * startPF + recommended.reactance * startSinPhi);
  const startingDropPercent = (startingDropV / voltage) * 100;

  return {
    loadId: load.id,
    loadName: load.name,
    ratedCurrentA: Math.round(ratedCurrentA * 10) / 10,
    recommendedSizeMm2: recommended.size,
    cableType: `3C × ${recommended.size} mm² TPYC`,
    runningDropPercent: Math.round(runningDropPercent * 10) / 10,
    startingDropPercent: Math.round(startingDropPercent * 10) / 10,
    isAcceptable:
      runningDropPercent <= maxRunningDropPercent &&
      (load.startMethod === "None" || startingDropPercent <= maxStartDropPercent),
  };
}

export function calculateVoltageDrop(
  loads: Load[],
  voltage: number,
  classRule: string
): VoltageDropResult[] {
  const maxRunning = classRule === "DNV" ? 5 : 6;
  const maxStarting = 15;
  // 케이블 길이가 0이면 계산 제외
  return loads
    .filter((l) => l.cableLength > 0 && l.ratedPowerKW > 0)
    .map((l) => calculateVoltageDropForLoad(l, voltage, maxRunning, maxStarting));
}

// ================================================================
// draw.io XML 생성 (브라우저에서 직접 생성)
// ================================================================
export function generateDrawioXML(
  generators: Generator[],
  loads: Load[],
  voltage: number
): string {
  const cells: string[] = [];
  let idNum = 2;
  const newId = () => `c${idNum++}`;

  const mainGens = generators.filter((g) => g.type === "main");
  const emergGens = generators.filter((g) => g.type === "emergency");
  const portLoads = loads.filter((l) => l.busId === "port");
  const stbdLoads = loads.filter((l) => l.busId === "stbd");
  const emergLoads = loads.filter((l) => l.busId === "emergency");

  const genSpacing = 130;
  const loadSpacing = 100;
  const portBusWidth = Math.max(300, Math.max(mainGens.length, portLoads.length) * genSpacing);
  const stbdBusX = portBusWidth + 120;
  const stbdBusWidth = Math.max(300, stbdLoads.length * loadSpacing + 100);
  const emergBusX = stbdBusX + stbdBusWidth + 80;

  // 발전기 (main)
  mainGens.forEach((gen, i) => {
    const x = 80 + i * genSpacing;
    const id = newId();
    cells.push(
      `<mxCell id="${id}" value="${gen.name}&#10;${gen.ratedPowerKW}kW / ${voltage}V" style="ellipse;whiteSpace=wrap;fillColor=#0d1f35;strokeColor=#4fc3f7;fontColor=#4fc3f7;fontSize=10;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="40" width="80" height="60" as="geometry"/></mxCell>`
    );
    cells.push(
      `<mxCell id="${newId()}" style="strokeColor=#4fc3f7;strokeWidth=2;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x + 40}" y="100" as="sourcePoint"/><mxPoint x="${x + 40}" y="160" as="targetPoint"/></mxGeometry></mxCell>`
    );
  });

  // MSB Port 모선
  cells.push(
    `<mxCell id="${newId()}" value="MSB (Port)  ${voltage}V" style="text;strokeColor=#4fc3f7;fillColor=#0a1628;fontColor=#4fc3f7;strokeWidth=4;fontStyle=1;fontSize=12;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="60" y="160" width="${portBusWidth}" height="20" as="geometry"/></mxCell>`
  );

  // Port 부하
  portLoads.forEach((load, i) => {
    const x = 70 + i * loadSpacing;
    const color = load.isEmergency ? "#ff6b35" : load.type === "transformer" ? "#ffb74d" : "#ce93d8";
    cells.push(
      `<mxCell id="${newId()}" value="${load.name}&#10;${load.ratedPowerKW}kW" style="ellipse;whiteSpace=wrap;fillColor=#0a1628;strokeColor=${color};fontColor=${color};fontSize=9;" vertex="1" parent="1"><mxGeometry x="${x}" y="260" width="80" height="50" as="geometry"/></mxCell>`
    );
    cells.push(
      `<mxCell id="${newId()}" style="strokeColor=${color};" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x + 40}" y="180" as="sourcePoint"/><mxPoint x="${x + 40}" y="260" as="targetPoint"/></mxGeometry></mxCell>`
    );
  });

  // MSB Stbd 모선
  cells.push(
    `<mxCell id="${newId()}" value="MSB (Stbd)  ${voltage}V" style="text;strokeColor=#4fc3f7;fillColor=#0a1628;fontColor=#4fc3f7;strokeWidth=4;fontStyle=1;fontSize=12;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${stbdBusX}" y="160" width="${stbdBusWidth}" height="20" as="geometry"/></mxCell>`
  );

  // Bus-Tie
  cells.push(
    `<mxCell id="${newId()}" value="BT" style="shape=rectangle;fillColor=#1a1628;strokeColor=#ffd54f;fontColor=#ffd54f;fontSize=10;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${portBusWidth + 75}" y="155" width="30" height="30" as="geometry"/></mxCell>`
  );
  cells.push(
    `<mxCell id="${newId()}" style="strokeColor=#ffd54f;strokeWidth=2;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${portBusWidth + 60}" y="170" as="sourcePoint"/><mxPoint x="${portBusWidth + 75}" y="170" as="targetPoint"/></mxGeometry></mxCell>`
  );
  cells.push(
    `<mxCell id="${newId()}" style="strokeColor=#ffd54f;strokeWidth=2;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${portBusWidth + 105}" y="170" as="sourcePoint"/><mxPoint x="${stbdBusX}" y="170" as="targetPoint"/></mxGeometry></mxCell>`
  );

  // Stbd 부하
  stbdLoads.forEach((load, i) => {
    const x = stbdBusX + 10 + i * loadSpacing;
    const color = load.type === "transformer" ? "#ffb74d" : "#ce93d8";
    cells.push(
      `<mxCell id="${newId()}" value="${load.name}&#10;${load.ratedPowerKW}kW" style="ellipse;whiteSpace=wrap;fillColor=#0a1628;strokeColor=${color};fontColor=${color};fontSize=9;" vertex="1" parent="1"><mxGeometry x="${x}" y="260" width="80" height="50" as="geometry"/></mxCell>`
    );
    cells.push(
      `<mxCell id="${newId()}" style="strokeColor=${color};" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x + 40}" y="180" as="sourcePoint"/><mxPoint x="${x + 40}" y="260" as="targetPoint"/></mxGeometry></mxCell>`
    );
  });

  // Emergency Bus
  emergGens.forEach((gen, i) => {
    const x = emergBusX + i * 110;
    const id = newId();
    cells.push(
      `<mxCell id="${id}" value="${gen.name}&#10;${gen.ratedPowerKW}kW" style="ellipse;whiteSpace=wrap;fillColor=#1a0800;strokeColor=#ff6b35;fontColor=#ff6b35;fontSize=10;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="40" width="90" height="60" as="geometry"/></mxCell>`
    );
    cells.push(
      `<mxCell id="${newId()}" style="strokeColor=#ff6b35;strokeWidth=2;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x + 45}" y="100" as="sourcePoint"/><mxPoint x="${x + 45}" y="160" as="targetPoint"/></mxGeometry></mxCell>`
    );
  });

  const emergBusWidth = Math.max(200, emergLoads.length * 100 + 60);
  cells.push(
    `<mxCell id="${newId()}" value="Emergency SWB  ${voltage}V" style="text;strokeColor=#ff6b35;fillColor=#0a1628;fontColor=#ff6b35;strokeWidth=4;fontStyle=1;fontSize=12;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${emergBusX}" y="160" width="${emergBusWidth}" height="20" as="geometry"/></mxCell>`
  );

  emergLoads.forEach((load, i) => {
    const x = emergBusX + 10 + i * 100;
    cells.push(
      `<mxCell id="${newId()}" value="${load.name}&#10;${load.ratedPowerKW}kW" style="ellipse;whiteSpace=wrap;fillColor=#0a1628;strokeColor=#ff6b35;fontColor=#ff6b35;fontSize=9;" vertex="1" parent="1"><mxGeometry x="${x}" y="260" width="80" height="50" as="geometry"/></mxCell>`
    );
    cells.push(
      `<mxCell id="${newId()}" style="strokeColor=#ff6b35;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x + 40}" y="180" as="sourcePoint"/><mxPoint x="${x + 40}" y="260" as="targetPoint"/></mxGeometry></mxCell>`
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="sld-diagram" name="Single Line Diagram">
    <mxGraphModel dx="1422" dy="762" grid="0" guides="1" tooltips="1" connect="1" arrows="0" fold="1" page="0" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}
