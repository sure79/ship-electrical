# 선박 전장 시스템 다이어그램(SLD) 리디자인 사양서

> **목적**: 현재 `lib/sld-generator.ts` 가 뽑아내는 draw.io XML을 실무 전기도면 품질(IEC 60617 · KR 선급 기준) 수준으로 재설계한다. 이 문서를 Codex에 그대로 넘기면 단계별로 구현할 수 있도록 구성했다.
>
> **대상 브랜치**: `master` (GitHub `sure79/ship-electrical`)
> **배포**: Railway — `electric-diagram` 서비스
> **프레임워크**: Next.js 14 App Router · TypeScript · Turso(libSQL)

---

## 1. 문제 정의 — 왜 바꾸는가

현재 생성되는 SLD는 draw.io XML 기반이지만, 실제 전기 엔지니어가 보는 "단선결선도" 품질에는 미치지 못한다.

| 항목 | 현재 | 개선 목표 |
|------|------|-----------|
| 심볼 | 사각형·타원 위주. ACB/MCCB가 단순 사각형 | IEC 60617 / ANSI Y32.2 표준 전기 심볼 |
| 버스바 | 단순 채색 직사각형 | 실제 버스바 표기 + 세그먼트 · 타이(Bus-Tie) 브레이커 표현 |
| 라인 | 직선만. 교차 시 점프(jump) 없음 | 수직/수평 라우팅 + 교차점 점프(bridge) |
| 보호협조 | 계산값만 텍스트로 표시 | 정격/설정/차단용량 + 심볼 주변 표준 주석 블록 |
| 출력 | `.drawio` 파일만 | SVG(웹뷰) + PDF + PNG + draw.io XML(편집용) |
| 표제란 | 우측 상단 범례 박스 | KR 선급 표준 도면 틀(Title Block) — 선박명/Hull/Rev/Scale/Sheet/승인란 |
| 편집 | draw.io 에서만 편집 가능 | 웹 상에서 드래그·정렬, 심볼 추가/삭제, Zoom/Pan |

---

## 2. 최종 산출 이미지(목표 품질)

아래 요소가 한 장의 도면에 깔끔하게 배치되어야 한다.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Ship Name]    SINGLE LINE DIAGRAM — MAIN ELECTRICAL SYSTEM          SHT  1/n│
│  Hull: H-1041   Project: GNTP-2     Class: KR     Rev: 01    Scale: NTS     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   (G) DG1     (G) DG2     (G) DG3           [SHORE]        (G) EG            │
│    │          │            │                  │              │                │
│   [ACB1]    [ACB2]       [ACB3]             [MCCB]         [ACB-E]            │
│    │          │            │                  │              │                │
│  ══╪══════════╪════════════╪═══════ MSB BUS ═══════════════╪══ EMG BUS ══     │
│    │          │            │        440V 60Hz 3PH          │                  │
│   [MCCB]   [MCCB]        [MCCB]                          [MCCB]                │
│    │          │            │                                │                  │
│   [VFD]    [ISO-TR]     [PANEL-L]                        [EDB-LIGHT]          │
│    │          │            │                                │                  │
│   (M)       [CHOKE]       ├── LIGHTS ···                   ├── NAV LIGHTS     │
│ PROP-S     [AC/DC]        ├── SOCKETS ···                   ├── GA ALARM      │
│              │                                              └── FIRE PUMP     │
│           ══╪══ DC BUS 750VDC ════════════                                    │
│             │              │          │                                       │
│          [DC/DC]        [VFD2]      [BCU]                                     │
│             │              │          │                                       │
│         →24V(BCD)         (M)     [ESS BATT]                                  │
│                         PROP-P     200kWh                                     │
│                                                                              │
│                                                                              │
│                                                     ┌────────────────────┐   │
│                                                     │ TITLE BLOCK         │   │
│                                                     │ Drawn:   CHK:  APPR:│   │
│                                                     │ Date: 2026-04-22    │   │
│                                                     │ Doc No: ELE-SLD-001 │   │
│                                                     └────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 기술 스택 — 권장안

기존 draw.io XML 경로를 **유지하면서**, 메인 렌더러를 **SVG**로 교체한다.

| 레이어 | 선택 | 이유 |
|--------|------|------|
| 다이어그램 모델 | 순수 TypeScript 객체 (`lib/sld/model.ts`) | 렌더러 중립 |
| 자동 레이아웃 | [ELK.js](https://github.com/kieler/elkjs) (`elk.bundled.js`) | 계층형 레이아웃 표준. 전기 SLD의 `layered` 알고리즘과 잘 맞음 |
| 심볼 라이브러리 | 자체 SVG (IEC 60617 기반, `lib/sld/symbols/*.svg`) | 라이선스 자유, 정확한 스케일 제어 |
| 렌더러 (웹) | React + `<svg>` (클라이언트 컴포넌트) | Zoom/Pan은 `svg-pan-zoom` 또는 자체 구현 |
| 내보내기 | SVG (원본) → PNG(canvg) → PDF(pdf-lib) | 서버·클라이언트 모두 동작 |
| 호환 | draw.io XML 내보내기 유지 | 기존 워크플로우 보전 |

**선택 이유**: 기존 draw.io 의존성을 버리면 부두 인쇄/도면 서류화·PDF 납품에 유리. 동시에 `.drawio` 내보내기는 남겨서 엔지니어가 손 편집할 여지 확보.

---

## 4. 아키텍처 — 파일 구조 제안

```
lib/
  sld/
    model.ts          ← 다이어그램 중간표현 (IR)
    builder.ts        ← CalcResult + Project + buses → IR 변환
    layout.ts         ← ELK 호출, 좌표 계산
    symbols/
      index.ts        ← 심볼 레지스트리 (id → SvgSymbolDef)
      generator.svg   ← (G) 발전기
      motor.svg       ← (M) 전동기
      acb.svg         ← ACB 심볼 (IEC 60617 반자동)
      mccb.svg        ← MCCB 심볼
      fuse.svg        ← 퓨즈
      transformer.svg ← 변압기 (이중 원)
      converter-acdc.svg / converter-dcac.svg / converter-dcdc.svg
      battery.svg     ← ESS/배터리
      shore.svg       ← 육전 연결점
      bus-ac.svg / bus-dc.svg / bus-emg.svg
    renderers/
      svg.ts          ← IR → SVG 문자열
      drawio.ts       ← IR → draw.io XML (기존 호환)
      png.ts          ← SVG → PNG (canvg)
      pdf.ts          ← SVG → PDF (pdf-lib, A3 가로 기본)
    titleBlock.ts     ← KR 선급 표준 표제란 생성
    routing.ts        ← 배선 라우팅 (manhattan + jump marks)

app/
  projects/[id]/
    sld/
      page.tsx        ← 전용 SLD 뷰어·편집기 페이지 (신설)
      viewer.tsx      ← <SldViewer/> 클라이언트 컴포넌트 (Zoom/Pan/Export)
  api/
    sld/[projectId]/
      route.ts        ← GET: SVG | POST: 재생성 | ?format=pdf|png|drawio

docs/
  SLD_SPEC.md         ← 이 문서
  SLD_SYMBOLS.md      ← 심볼 인벤토리 (어떤 심볼이 어떤 IEC 60617 번호인지)
```

---

## 5. 데이터 계약 — 입력은 그대로

`lib/types.ts` 의 기존 타입을 그대로 쓴다. 빌더가 흡수한다.

**입력**:
- `Project` — 전원 구성 플래그, 전압, 대수 등
- `CalcResult` — 계산 결과 (`loads`, `busSummaries`, `modes`, `selKva` 등)
- `Bus[]` — 사용자 등록 버스 계층 (MSB → MDP → EDB 등)
- `dt: string` — 작성일

**중간표현 (IR) 요약**:

```ts
// lib/sld/model.ts
export type NodeKind =
  | 'generator' | 'emergency-generator' | 'shore' | 'fuel-cell' | 'pv'
  | 'ac-bus' | 'dc-bus' | 'emergency-bus' | 'panel'
  | 'acb' | 'mccb' | 'fuse'
  | 'transformer' | 'converter' | 'choke' | 'filter'
  | 'motor' | 'battery' | 'ems'
  | 'load'  // 일반 부하 상자
  | 'title-block' | 'legend'

export interface SldNode {
  id: string
  kind: NodeKind
  label: string
  subLabel?: string           // 정격, 용량 등
  rating?: { kva?: number; kw?: number; voltage?: number; current?: number }
  meta?: Record<string, string | number>   // 도면에 표기할 부가정보
  symbolId: string            // 심볼 레지스트리 키
}

export interface SldEdge {
  id: string
  from: string                // NodeId
  to: string
  kind: 'ac' | 'dc' | 'emg' | 'interlock' | 'signal'
  label?: string              // 예: "INTERLOCK", 케이블 코드 등
}

export interface SldDiagram {
  meta: {
    vesselName: string; hullNo: string; projectNo: string
    classCode: string; revision: string; date: string
    sheet: { index: number; total: number }
    scale: string             // 'NTS' 기본
    paper: 'A3' | 'A2' | 'A1' // 기본 A3 가로
  }
  nodes: SldNode[]
  edges: SldEdge[]
  groups?: { id: string; label: string; memberIds: string[] }[]  // MSB/EMG 영역 등
}
```

---

## 6. 단계별 작업 — Codex가 순서대로 진행

### Phase 0 — 스캐폴드
1. `lib/sld/` 폴더 생성, `model.ts`에 위 타입 정의
2. `docs/SLD_SPEC.md`(이 문서) · `docs/SLD_SYMBOLS.md`(빈 스켈레톤) 추가
3. `package.json` 의존성 추가: `elkjs`, `pdf-lib`, `canvg`
4. 기존 `sld-generator.ts` 는 **건드리지 말 것** — 당분간 동시 운영

### Phase 1 — 심볼 세트 (IEC 60617)

IEC 60617-2 ~ 60617-13 의 주요 심볼을 자체 SVG로 제작. 각 심볼은 **24×24 viewBox** 기준, 커넥션 포트는 상/하/좌/우 정중앙에 고정.

구현 순서:
- [ ] (G) 발전기 — 원 안에 "G"
- [ ] (M) 전동기 — 원 안에 "M"
- [ ] ACB — 상자 안에 사각형 + 차단 표시
- [ ] MCCB — 상자 안에 기울어진 선분
- [ ] 퓨즈 — 세로 긴 직사각형
- [ ] 변압기 — 이중 원 (2권선)
- [ ] AC/DC · DC/AC · DC/DC 컨버터 — 사다리꼴 + "~/=" 표기
- [ ] 배터리(ESS) — 짧은 선·긴 선 교차
- [ ] 버스바 — 두꺼운 선분 (AC: 파랑 `#0050ef`, DC: 빨강 `#FF0000`, EMG: 주황 `#FF8C00`)
- [ ] 육전 연결점 — 화살표 + "SHORE"
- [ ] 인터록 — 점선 + 마름모

**참조**: 각 심볼은 `docs/SLD_SYMBOLS.md` 에 IEC 60617 도큐멘트 번호와 함께 표로 기록한다.

### Phase 2 — Builder: 계산결과 → IR
- [ ] `builder.ts` 작성. `generateSldDiagram(project, calc, buses, dt): SldDiagram`
- [ ] 기존 `sld-generator.ts` 의 구조(DG → ACB → AC BUS → MCCB → 부하)를 IR로 재구성
- [ ] `Bus[]` 계층을 `groups` 로 번역 (MSB 영역 / EMG 영역 / DC 영역)

### Phase 3 — Layout (ELK)
- [ ] `layout.ts` 에서 `elkjs`의 `layered` 알고리즘으로 좌표 확정
- [ ] 방향: **상→하** (top→bottom) — 전원이 위, 부하가 아래
- [ ] 각 노드에 포트(port) 정의하여 배선이 엉키지 않도록 제약
- [ ] 그룹(MSB/EMG) 은 `parent` 계층으로 분리
- [ ] 도면 가장자리 여백 40mm (실측 기준) + Title Block 공간 확보

### Phase 4 — SVG 렌더러
- [ ] `renderers/svg.ts` — IR + 레이아웃 결과 → SVG 문자열
- [ ] 에지 라우팅: `manhattan` (수직/수평만). ELK가 제공하는 경로 포인트 그대로 사용
- [ ] **교차점 점프(bridge)**: 동일 좌표를 공유하되 소속이 다른 두 라인은 작은 반원(jump) 처리
- [ ] 색상/두께: AC=2px 파랑, DC=2px 빨강, EMG=1.5px 대시 주황, Signal=1px 회색
- [ ] 주석 텍스트(정격, 설정A, 케이블)는 심볼 오른쪽 정렬

### Phase 5 — Title Block (표제란)
- [ ] KR 선급 표준 표제란 레이아웃 — 우측 하단 220×140mm 박스
- [ ] 칸: Drawn / Checked / Approved / Date / Doc No / Rev / Scale / Sheet
- [ ] 회사 로고 자리 (추후 업로드용 placeholder)

### Phase 6 — 뷰어 페이지
- [ ] `app/projects/[id]/sld/page.tsx` — 서버 컴포넌트. 계산 결과 로드
- [ ] `viewer.tsx` — 클라이언트. Zoom(휠)/Pan(드래그)/도면 Fit 버튼
- [ ] 기존 `app/projects/[id]/page.tsx` 의 **⑤ SLD** 탭에서 링크 또는 iframe 로 임베드
- [ ] 내보내기 버튼: SVG · PNG · PDF · .drawio

### Phase 7 — API & 내보내기
- [ ] `app/api/sld/[projectId]/route.ts`
  - `GET ?format=svg` (기본) · `png` · `pdf` · `drawio`
  - 캐시: Turso `sld_renders` 테이블 (projectId, format, content, renderedAt) — 계산 결과 변경 감지 후 무효화
- [ ] PDF: A3 가로(420×297mm), 여백 15mm, 단위 mm 정확히 유지

### Phase 8 — 레거시 제거 (선택)
- [ ] 새 경로가 검수 통과되면 `lib/sld-generator.ts` 를 `lib/sld/renderers/drawio.ts` 로 이관 후 삭제
- [ ] README 배포 섹션의 "draw.io" 문구를 "SVG/PDF/drawio" 로 갱신

---

## 7. 준수해야 할 표준

| 문서 | 적용 범위 |
|------|-----------|
| **IEC 60617** (전기 심볼) | 모든 심볼 모양·정렬. 특히 60617-7(스위치기어), 60617-13(반도체/변환장치) |
| **IEC 60092-101, -201, -202** | 선박용 전기설비 — 회로 구성, 색상 |
| **KR 선급 규칙 Pt.4 제1편** | 도면 구성, 표제란, 비상전원 분리 표기 |
| **SOLAS II-1/42 ~ 44** | 비상전원 회로 표기 (자동기동 45초 주석) |
| **ISO 7010** (참고) | 안전 심볼 — 필요 시 화재/폭발 위험 구역 표기 |

심볼 정합성은 `docs/SLD_SYMBOLS.md` 에 **IEC 60617 문서 번호 ↔ 구현 파일명** 을 반드시 매핑해 기록한다.

---

## 8. 수용 기준 (Acceptance Criteria)

### 시각
- [ ] 동일 프로젝트 데이터로 기존 출력 vs 신규 출력을 비교했을 때 엔지니어 눈으로 "제대로 된 도면"으로 보일 것
- [ ] 심볼이 IEC 60617 원형과 육안으로 일치
- [ ] 배선이 교차할 때 점프 마크(반원) 표시됨
- [ ] 텍스트 겹침 0 (ELK 레이아웃으로 자동 방지)

### 기능
- [ ] 발전기 1~3대 / 비상발전기 유/무 / ESS 유/무 / DC 추진 유/무 / 육전 유/무 조합 모두에서 레이아웃 붕괴 없이 렌더링
- [ ] 사용자 등록 버스(Custom Bus) 계층이 도면에 반영됨 (MSB→EDB→MDP 등 트리)
- [ ] PDF 내보내기 시 A3 1장에 맞게 자동 스케일
- [ ] SVG 파일을 draw.io 로 import 해도 그려짐

### 성능
- [ ] 부하 100개 기준 렌더링 2초 이내 (서버)
- [ ] 뷰어 페이지 초기 로드 1.5초 이내

### 테스트
- [ ] `lib/sld/__tests__/builder.test.ts` — 최소 3개 시나리오 (DG only / DG+EG+ESS / DC propulsion)
- [ ] 스냅샷 테스트: 동일 입력이면 동일 SVG

---

## 9. 당장 안 할 것 (Out of Scope)

- 3D / BIM 연동
- 심볼 편집기 (사용자가 새 심볼을 그리는 UI)
- 다중 시트 자동 분할 (Sheet 2/2 로직) — Phase 6까지 1시트 고정, 이후 별도 설계
- 실시간 협업 편집
- 한글 폰트 임베딩 문제 (SVG 생성은 영문 기본, 한글은 system font fallback)

---

## 10. 작업 체크리스트 — Codex 용 요약

```
[x] Phase 0 스캐폴드                   → lib/sld/ 폴더, model.ts 생성 완료
[x] Phase 1 IEC 60617 심볼 세트 (12종) → lib/sld/symbols.tsx 완료 (G/M/ACB/MCCB/Fuse/TR/Converter/Battery/Shore/BusBar/Panel/EMS)
[x] Phase 2 Builder (계산결과 → IR)    → SldSvg.tsx 내부에 통합 (수동 레이아웃)
[~] Phase 3 ELK 레이아웃               → 현재 수동 열 기반 레이아웃. ELK.js는 추후 개선
[x] Phase 4 SVG 렌더러 + 라우팅        → lib/sld/SldSvg.tsx (manhattan 와이어)
[x] Phase 5 Title Block                → lib/sld/titleBlock.tsx (KR 스타일)
[x] Phase 6 뷰어 페이지 + Zoom/Pan     → app/projects/[id]/sld/ (Fit/줌/팬)
[~] Phase 7 내보내기                   → SVG·PNG·PDF(print) 구현. drawio는 레거시 유지
[ ] Phase 8 레거시 경로 제거           → 검수 후 진행
```

각 Phase 종료 시 **별도 커밋** 하고, Railway 자동 배포로 실제 도면을 눈으로 확인하며 진행한다.

---

## 12. 구현 세부 — 현재 상태 (2026-04-22)

### 추가된 파일
- [lib/sld/model.ts](../lib/sld/model.ts) — IR 타입 정의
- [lib/sld/symbols.tsx](../lib/sld/symbols.tsx) — React SVG 심볼 (IEC 60617 기반)
- [lib/sld/titleBlock.tsx](../lib/sld/titleBlock.tsx) — 표제란
- [lib/sld/SldSvg.tsx](../lib/sld/SldSvg.tsx) — 메인 렌더러 (Project+CalcResult+Bus[] → SVG)
- [app/projects/[id]/sld/page.tsx](../app/projects/[id]/sld/page.tsx) — 서버 컴포넌트
- [app/projects/[id]/sld/SldViewer.tsx](../app/projects/[id]/sld/SldViewer.tsx) — 클라이언트 뷰어 (Zoom/Pan/Export)

### 접속 경로
- **`/projects/{id}/sld`** — 전용 다이어그램 뷰어
- 기존 ⑤ SLD 탭의 최상단 카드 버튼에서 진입

### 남은 개선 과제 (다음 라운드)
- ELK.js 자동 레이아웃 도입 — 현재는 컬럼 수동 배치이므로 부하 100개 이상 시 수동 튜닝 필요
- 와이어 교차점 점프(bridge) 마크 — 현재는 직선 교차만 허용
- PDF 고품질 내보내기 (현재는 브라우저 `window.print()`) — `pdf-lib` 도입 검토
- 편집 모드 (SVG 위에서 심볼 드래그/정렬 후 레이아웃 저장)

---

## 11. 참고자료

- IEC 60617 Database: https://std.iec.ch/iec60617
- ELK Layered Layout: https://www.eclipse.org/elk/reference/algorithms/layered.html
- draw.io shape reference: https://www.drawio.com/doc/faq/shape-style-reference
- KR 선급 규칙 Pt.4 제1편 (전기설비): https://www.krs.co.kr
- 현재 구현: [`lib/sld-generator.ts`](../lib/sld-generator.ts)
- 타입 정의: [`lib/types.ts`](../lib/types.ts)
- 대시보드/탭 구조: [`app/projects/[id]/page.tsx`](../app/projects/[id]/page.tsx)
