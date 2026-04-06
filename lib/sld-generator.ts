import type { Project, Bus, CalcResult } from './types'

function xv(s:unknown):string {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'&#xa;')
}
let _id=9
function nid(){return String(++_id)}

const S={
  acbus:'rounded=0;whiteSpace=wrap;html=1;fillColor=#0050ef;strokeColor=#0050ef;fontColor=#FFFFFF;fontSize=12;fontStyle=1;align=left;spacingLeft=10;verticalAlign=middle;',
  dcbus:'rounded=0;whiteSpace=wrap;html=1;fillColor=#FF0000;strokeColor=#FF0000;fontColor=#FFFFFF;fontSize=12;fontStyle=1;align=left;spacingLeft=10;verticalAlign=middle;',
  emgbus:'rounded=0;whiteSpace=wrap;html=1;fillColor=#FF8C00;strokeColor=#e65100;fontColor=#FFFFFF;fontSize=11;fontStyle=1;align=left;spacingLeft=8;',
  dg:'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;fontSize=22;fontStyle=1;',
  eg:'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=2;fontSize=20;fontStyle=1;',
  m: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=2;fontSize=16;fontStyle=1;',
  acb:'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#333333;strokeWidth=3;fontSize=8;fontStyle=1;',
  mccb:'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#333333;strokeWidth=2;fontSize=7;',
  fuse:'rounded=0;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#FF0000;strokeWidth=1;fontSize=7;',
  shore:'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=10;fontStyle=1;',
  tr:'shape=mxgraph.electrical.transformers.transformer;fillColor=none;strokeColor=#333333;strokeWidth=2;fontSize=7;',
  acdc:'shape=trapezoid;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;fontSize=8;fontStyle=1;',
  dcac:'shape=trapezoid;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=2;fontSize=8;fontStyle=1;',
  dcdc:'shape=trapezoid;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;fontSize=8;fontStyle=1;',
  ess: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;fontSize=8;fontStyle=1;',
  ems: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=8;',
  panel:'rounded=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontSize=8;fontStyle=1;',
  panelEmg:'rounded=0;whiteSpace=wrap;html=1;fillColor=#fff3e0;strokeColor=#e65100;fontSize=8;fontStyle=1;',
  txt:'text;html=1;strokeColor=none;fillColor=none;align=center;fontSize=8;whiteSpace=wrap;',
  chk:'rounded=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#777;fontSize=7;',
  acw:'strokeColor=#0050ef;strokeWidth=2;endArrow=none;',
  dcw:'strokeColor=#FF0000;strokeWidth=2;endArrow=none;',
  emw:'strokeColor=#FF8C00;strokeWidth=1;dashed=1;endArrow=none;',
}

export function generateSLD(p:Project, r:CalcResult, buses:Bus[], dt:string):string {
  _id=9
  const els:string[]=[]
  const ACY=440, DCY=750
  const columnPitch = 126
  const branchTextWidth = 108
  const panelTopGap = 18
  const branchBottomGap = 28
  const branchCardBaseHeight = 112
  const estimateTextHeight = (text:string) => {
    const lines = text.split('\n').length
    return Math.max(42, 16 + lines * 10)
  }
  const formatLoadLabel = (ld:CalcResult['loads'][number]) => {
    const shortName = ld.name.length > 18 ? `${ld.name.slice(0, 17)}…` : ld.name
    return `${ld.circuitNo || ''}\n${shortName}\n${ld.toTag || ld.fromBus}\n${ld.kw}kW`
  }
  const getRowsPerColumn = (count:number) => {
    if (count >= 10) return 3
    if (count >= 5) return 4
    return Math.max(1, count)
  }

  const V=(val:string,st:string,x:number,y:number,w:number,h:number)=>
    els.push(`    <mxCell id="${nid()}" value="${xv(val)}" style="${st}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`)
  const W=(val:string,st:string,x1:number,y1:number,x2:number,y2:number)=>
    els.push(`    <mxCell id="${nid()}" value="${xv(val)}" style="${st}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry></mxCell>`)

  const dgUnits = p.hasDg ? Math.max(1, p.dgCount || 1) : 0
  const busMap = new Map(buses.map(bus => [bus.tag, bus]))
  const childMap = new Map<string, string[]>()
  for (const bus of buses) {
    const parentTag = bus.parentTag || ''
    if (!parentTag) continue
    const list = childMap.get(parentTag) || []
    list.push(bus.tag)
    childMap.set(parentTag, list)
  }
  const loadsBySource = new Map<string, typeof r.loads>()
  for (const load of r.loads) {
    const source = load.fromBus || 'MSB'
    const group = loadsBySource.get(source) || []
    group.push(load)
    loadsBySource.set(source, group)
  }

  const orderedBusTags: string[] = []
  const visitBus = (tag: string) => {
    if (orderedBusTags.includes(tag)) return
    orderedBusTags.push(tag)
    const children = (childMap.get(tag) || [])
      .map(childTag => busMap.get(childTag))
      .filter((bus): bus is Bus => Boolean(bus))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    children.forEach(child => visitBus(child.tag))
  }
  if (busMap.has('MSB')) visitBus('MSB')
  buses
    .filter(bus => bus.tag !== 'MSB' && !bus.parentTag)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach(bus => visitBus(bus.tag))

  const orderedSourceTags = [
    ...Array.from(new Set([
      ...orderedBusTags.filter(tag => tag !== 'MSB' ? (busMap.get(tag)?.type !== 'DC-BUS' && loadsBySource.has(tag)) : loadsBySource.has(tag)),
      ...Array.from(loadsBySource.keys()).filter(tag => !busMap.has(tag)),
    ])),
  ]

  const sourceGap = 36
  const sourceLayouts = orderedSourceTags.map(tag => {
    const sourceLoads = loadsBySource.get(tag) || []
    const rowsPerColumn = getRowsPerColumn(sourceLoads.length)
    const columns = Math.max(1, Math.ceil(sourceLoads.length / rowsPerColumn))
    const panelHeight = (busMap.get(tag)?.parentTag ? 54 : 42)
    const rowHeights = Array.from({ length: Math.min(rowsPerColumn, Math.max(sourceLoads.length, 1)) }, (_, row) => {
      const rowLoads = sourceLoads.filter((_, index) => index % rowsPerColumn === row)
      const tallestLabel = rowLoads.reduce((max, load) => {
        const labelHeight = estimateTextHeight(formatLoadLabel(load))
        return Math.max(max, labelHeight)
      }, 42)
      return branchCardBaseHeight + tallestLabel + branchBottomGap
    })
    const rowYs:number[] = []
    let nextY = 0
    rowHeights.forEach(height => {
      rowYs.push(nextY)
      nextY += height
    })
    return {
      tag,
      bus: busMap.get(tag),
      loads: sourceLoads,
      columns,
      rowsPerColumn,
      panelHeight,
      rowHeights,
      rowYs,
      width: Math.max(156, 34 + columns * columnPitch),
      height: Math.max(0, nextY),
    }
  })

  const sourceAreaWidth =
    sourceLayouts.reduce((sum, layout) => sum + layout.width, 0) +
    Math.max(0, sourceLayouts.length - 1) * sourceGap
  const topRightX = (p.hasEg && r.egSelKva > 0) ? 2150 : 1850
  const PW = Math.max(2200, 120 + sourceAreaWidth + 120, topRightX + 240)
  const AC_BUS_W = PW - 100

  const sourceBaseY = ACY + 76
  const loadBaseY = sourceBaseY + 92
  const maxLoadDepth = sourceLayouts.reduce((max, layout) => Math.max(max, layout.height), 0)
  const PH = Math.max(1700, loadBaseY + maxLoadDepth + 220)

  // 타이틀
  V(`${p.vesselName} ${p.hullNo} (${p.projectNo})  전력 계통도 (SLD)\n작성: ${dt} | 선급: ${p.classCode} | KR / IEC 60617 | Rev.01`,
    'text;html=1;strokeColor=none;fillColor=none;align=center;fontSize=15;fontStyle=1;',420,14,1100,42)

  // AC BUS
  V(`AC BUS BAR   ${p.acVoltage}V  3PH  ${p.frequency}Hz`,S.acbus,50,ACY,AC_BUS_W,22)

  // DG(들)
  for(let i=0;i<dgUnits;i++){
    const DX=150+i*195
    V('G',S.dg,DX,75,100,100)
    V(`DG${p.dgCount>1?i+1:''}\n${r.selKw}kW  AC${p.acVoltage}V\n${p.frequency}Hz  3PH  PF${p.dgPf}`,S.txt,DX-20,178,140,38)
    V(`ACB${i+1}\n${r.genAcbA*2}/${Math.round(r.genAcbA*1.05/5)*5}A`,S.acb,DX+30,300,40,28)
    W('',S.acw,DX+50,175,DX+50,300)
    W('',S.acw,DX+50,328,DX+50,ACY)
    V('(A~)(V~)(F~)(kW~)',S.txt+'align=left;',DX-50,304,68,14)
  }

  // Shore Power
  if(p.hasShore){
    const SPX=150+dgUnits*195
    V(`SHORE POWER\nAC${p.acVoltage}V  3PH`,S.shore,SPX,84,140,48)
    V('MCCB2\n400/250A',S.mccb,SPX+51,192,38,24)
    V('MCCB3\n250/250A',S.mccb,SPX+51,274,38,24)
    W('',S.acw,SPX+70,132,SPX+70,192)
    W('',S.acw,SPX+70,216,SPX+70,274)
    W('',S.acw,SPX+70,298,SPX+70,ACY)
    W('INTERLOCK',S.emw+'fontSize=7;fontColor=#FF8C00;',
      150+Math.max(dgUnits-1,0)*195+80,314,SPX+51,204)
  }

  // DC 추진 체인
  if(p.hasDc){
    const ITX=Math.max(840, 200 + dgUnits * 195 + (p.hasShore ? 210 : 0))
    W('',S.acw,ITX,ACY,ITX,ACY+22)
    V(`MCCB\n400/${Math.round(p.isoKva*1000/(Math.sqrt(3)*p.acVoltage)*1.25/5)*5}A`,S.mccb,ITX-20,ACY+22,38,24)
    W('',S.acw,ITX,ACY+46,ITX,ACY+60)
    V(`ISO-TR\n${p.isoKva}KVA 3PH ${p.frequency}Hz\n${p.acVoltage}V/${p.acVoltage===220?440:p.acVoltage}V`,S.tr,ITX-38,ACY+60,76,82)
    W('',S.acw,ITX,ACY+142,ITX,ACY+158)
    V('CHOKE\n(LC Filter)',S.chk,ITX-32,ACY+158,64,28)
    W('',S.acw,ITX,ACY+186,ITX,ACY+202)
    V(`AC/DC CONV.\n${Math.ceil((r.propKwIn||200)/50)*50}kW`,S.acdc,ITX-55,ACY+202,110,60)
    W('',S.dcw,ITX,ACY+262,ITX,DCY)

    // DC BUS
    V(`DC BUS   ${p.dcVoltage}VDC`,S.dcbus,600,DCY,1380,18)

    // DC/DC
    const DDX=630
    W('',S.dcw,DDX+8,DCY,DDX+8,DCY+18)
    V('FZ 150A',S.fuse,DDX-5,DCY+18,38,14)
    W('',S.dcw,DDX+8,DCY+32,DDX+8,DCY+38)
    V('DC/DC CONV.',S.dcdc,DDX-12,DCY+38,90,55)
    W('',S.dcw,DDX+8,DCY+93,DDX+8,DCY+103)
    V('DC FILTER',S.chk,DDX-10,DCY+103,80,22)
    V('→ 24VDC (BCD/EMS)',S.txt+'align=left;',DDX+42,DCY+108,105,22)

    // VFD + 모터
    const POS=['S','P','C','D']
    for(let i=0;i<p.motorCount;i++){
      const VX=855+i*235
      const fuseA=Math.round(p.motorKw*1000/(Math.sqrt(3)*(p.acVoltage===220?440:p.acVoltage))*1.5/50)*50
      W('',S.dcw,VX+35,DCY,VX+35,DCY+18)
      V(`FZ ${fuseA}A`,S.fuse,VX+16,DCY+18,38,14)
      W('',S.dcw,VX+35,DCY+32,VX+35,DCY+38)
      V(`DC/AC\nVFD#${i+1}`,S.dcac,VX,DCY+38,90,55)
      W('',S.acw+'strokeColor=#9673a6;',VX+45,DCY+93,VX+45,DCY+150)
      V('M',S.m,VX+10,DCY+150,70,70)
      V(`추진모터 ${p.motorKw}kW(${POS[i]})\n${p.acVoltage===220?440:p.acVoltage}V 3PH`,S.txt,VX-18,DCY+226,116,30)
    }

    // ESS
    if(p.hasEss){
      const EX=1350+Math.max(0,p.motorCount-2)*235
      W('',S.dcw,EX+45,DCY,EX+45,DCY+18)
      V('FZ 250A',S.fuse,EX+26,DCY+18,38,14)
      W('',S.dcw,EX+45,DCY+32,EX+45,DCY+38)
      V(`ESS\n${Math.ceil(r.essTotalKwh||10)}kWh\nBCU(BMS)`,S.ess,EX,DCY+38,115,80)
      V('EMS\n(Energy Mgmt.)',S.ems,EX+128,DCY+38,95,50)
    }
  }

  // 비상발전기
  if(p.hasEg && r.egSelKva>0){
    const EGX=1870
    V('EG',S.eg,EGX,80,85,85)
    V(`E/G ${r.egSelKva}kVA\n${r.egSelKw}kW`,S.txt,EGX-12,170,108,28)
    V(`ACB-E\n${Math.round(r.egSelKw*1000/(Math.sqrt(3)*p.acVoltage*0.8)/50)*50}A`,S.acb,EGX+22,300,42,28)
    W('',S.acw+'strokeColor=#b85450;',EGX+43,165,EGX+43,300)
    W('',S.acw+'strokeColor=#b85450;',EGX+43,328,EGX+43,ACY)
    V('EMERGENCY BUS  24VDC / BLACKOUT CIRCUIT',S.emgbus,1500,ACY+55,600,18)
  }

  // AC 부하 / 패널 / 등록된 버스 구조 반영
  let currentX = 70
  for (const layout of sourceLayouts) {
    const { tag, bus, loads, columns, width, rowsPerColumn, panelHeight, rowYs } = layout
    const panelX = currentX
    const panelCenter = panelX + width / 2
    const isEmergencySource = bus?.type === 'EMERGENCY' || tag === 'ESB'
    const panelStyle = isEmergencySource ? S.panelEmg : S.panel
    const wireStyle = isEmergencySource ? S.acw + 'strokeColor=#b85450;' : S.acw
    const panelLabel =
      tag === 'MSB'
        ? 'MSB\nMain Switchboard'
        : bus
          ? `${bus.tag}\n${bus.name}${bus.parentTag ? `\n< ${bus.parentTag}` : ''}`
          : `${tag}\nCustom Source`

    const sourceFeedY = isEmergencySource && p.hasEg && r.egSelKva > 0 ? ACY + 73 : ACY
    const panelBottomY = sourceBaseY + panelHeight
    const trunkY = panelBottomY + panelTopGap
    const columnGroupWidth = Math.max(44, (columns - 1) * columnPitch + 44)
    const columnStartX = panelX + (width - columnGroupWidth) / 2
    const columnCenters = Array.from({ length: columns }, (_, index) => columnStartX + 22 + index * columnPitch)

    W('', wireStyle, panelCenter, sourceFeedY, panelCenter, sourceBaseY)
    V(panelLabel, panelStyle, panelX, sourceBaseY, width, panelHeight)
    W('', wireStyle, panelCenter, panelBottomY, panelCenter, trunkY)
    if (columnCenters.length > 1) {
      W('', wireStyle, columnCenters[0], trunkY, columnCenters[columnCenters.length - 1], trunkY)
    }

    loads.forEach((ld, index) => {
      const col = Math.floor(index / rowsPerColumn)
      const row = index % rowsPerColumn
      const centerX = columnCenters[col] || panelCenter
      const LX = centerX - 22
      const LY = loadBaseY + rowYs[row]
      const mc = ld.isEmergency ? S.mccb.replace('#333333','#b85450') : S.mccb
      const ms = ld.isEmergency ? S.m.replace('#666666','#b85450') : S.m
      const label = formatLoadLabel(ld)
      const labelHeight = estimateTextHeight(label)
      W('', wireStyle, centerX, trunkY, centerX, LY)
      V(`MCCB\n${ld.mccbFrame}/${ld.mccbSet}A\n${ld.cableCode}`, mc, LX, LY, 44, 30)
      W('', wireStyle, centerX, LY + 30, centerX, LY + 46)
      V('M', ms, LX - 6, LY + 46, 56, 56)
      W('', wireStyle, centerX, LY + 102, centerX, LY + 108)
      V(
        label,
        S.txt,
        centerX - branchTextWidth / 2,
        LY + 106,
        branchTextWidth,
        labelHeight
      )
    })

    currentX += width + sourceGap
  }

  // 범례
  const LX=Math.max(1720, PW - 420)
  const LY=Math.max(p.hasDc ? DCY + 50 : ACY + 240, loadBaseY + maxLoadDepth + 56)
  V('범례 (LEGEND)','text;html=1;strokeColor=#ccc;fillColor=#f8f8f8;align=center;fontStyle=1;fontSize=10;',LX,LY,200,22)
  const legs=[
    ['─── AC 전원 ('+p.acVoltage+'V 3PH)','#0050ef'],
    ['─── DC 전원 ('+p.dcVoltage+'VDC)','#FF0000'],
    ['─ ─ 인터록 (INTERLOCK)','#FF8C00'],
    ['⊙G  디젤 발전기','#d6b656'],['⊙M  유도전동기','#666666'],
    ['▱   전력변환장치(VFD)','#9673a6'],['⊙EG 비상발전기','#b85450'],
  ]
  legs.forEach((lg,i)=>{
    V(lg[0],`text;html=1;strokeColor=none;fillColor=none;align=left;fontSize=8;fontColor=${lg[1]};`,LX+5,LY+22+i*16,196,14)
  })
  V(`Hull: ${p.hullNo}  |  ${p.projectNo}  |  ${p.classCode}  |  ${dt}`,
    'text;html=1;strokeColor=#aaa;fillColor=#f5f5f5;align=center;fontSize=8;',LX,LY+148,260,18)

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${PW}" pageHeight="${PH}" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
${els.join('\n')}
  </root>
</mxGraphModel>`
}
