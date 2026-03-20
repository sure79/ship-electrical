"use client";

import { useState } from "react";
import { X, Zap, Calculator, GitBranch, CheckSquare, ArrowRight, Lightbulb, AlertCircle } from "lucide-react";

const STEPS = [
  {
    tab: "1. 장비 입력",
    icon: <Zap size={18} className="text-sky-400" />,
    color: "border-sky-600/50 bg-sky-900/10",
    heading: "배에 들어가는 전기 장비를 등록합니다",
    steps: [
      "상단 [프로젝트 설정]에서 선박명, 시스템 전압(보통 450V), 선급을 먼저 설정하세요",
      "[발전기 추가]로 주발전기(D/G)와 비상발전기(E/G)를 등록합니다 — 아직 용량을 모르면 임시값으로 입력해도 됩니다",
      "[프리셋에서 추가]로 자주 쓰는 선박 장비(Bow Thruster, 펌프, 팬 등)를 체크 한 번에 추가할 수 있습니다",
      "각 부하마다 [운항조건별 사용 여부]를 체크해주세요 — 항해 중에 켜지는 장비, 정박 중에만 쓰는 장비가 다릅니다",
      "SOLAS 비상부하(비상조명, 소화펌프 등)는 [SOLAS 비상부하] 체크를 켜세요",
    ],
    tips: [
      "발전기 용량을 모를 때는 일단 부하만 입력 → [전력 계산] 탭의 '발전기 용량 추천'을 사용하세요",
      "케이블 길이를 입력하면 나중에 전압강하/케이블 사이즈를 자동으로 계산해줍니다",
    ],
  },
  {
    tab: "2. 전력 계산",
    icon: <Calculator size={18} className="text-green-400" />,
    color: "border-green-600/50 bg-green-900/10",
    heading: "운항 상황마다 발전기가 충분한지 확인합니다",
    steps: [
      "각 운항조건(항해/입출항/정박/비상)에서 가동할 발전기를 체크합니다",
      "예: 항해 중 → G1+G2 가동 / 정박 중 → G1만 가동 / 비상 → E/G만 가동",
      "부하율이 자동으로 계산됩니다 — 80% 이하면 녹색(OK), 80~90% 주황(주의), 90% 초과 빨강(위험)",
      "부하율이 90%를 넘으면 발전기 용량을 늘리거나 대수를 추가해야 합니다",
      "화면 하단 [발전기 용량 추천] 버튼으로 적정 발전기 용량을 자동 계산할 수 있습니다",
    ],
    tips: [
      "선급 기준: 부하율 80% 이하 권장, 90% 이하가 합격 기준입니다",
      "Bow Thruster처럼 대형 모터는 기동 시 순간전류가 6~8배 — 전압강하 탭에서 확인하세요",
      "'항해' 조건이 가장 부하가 크면 안 됩니다 — 보통 입출항 조건이 최대입니다",
    ],
  },
  {
    tab: "3. 결선도",
    icon: <GitBranch size={18} className="text-purple-400" />,
    color: "border-purple-600/50 bg-purple-900/10",
    heading: "단선결선도(SLD)를 자동으로 그려줍니다",
    steps: [
      "장비 입력 탭 데이터로 결선도가 자동 생성됩니다 — 별도 작업 불필요",
      "Bus-Tie [투입/개방] 토글로 모선 연결 상태를 바꿀 수 있습니다",
      "마우스 휠로 줌 인/아웃, 빈 공간 드래그로 팬이 가능합니다",
      "[SVG 다운로드]로 선급 제출용 도면 파일을 받을 수 있습니다",
      "[draw.io 내보내기]로 .drawio 파일을 받아 draw.io 앱에서 편집할 수 있습니다",
    ],
    tips: [
      "Port 모선 = 좌현, Stbd 모선 = 우현입니다",
      "draw.io는 무료 소프트웨어 — https://www.drawio.com/ 에서 다운로드",
      "SVG를 PowerPoint나 Word에 삽입하면 고화질 벡터 도면으로 사용 가능합니다",
    ],
  },
  {
    tab: "4. 선급 제출",
    icon: <CheckSquare size={18} className="text-amber-400" />,
    color: "border-amber-600/50 bg-amber-900/10",
    heading: "선급 제출에 필요한 서류 목록을 확인합니다",
    steps: [
      "현재 프로젝트 선급(KR/ABS/DNV)에 맞는 제출 서류 목록이 표시됩니다",
      "데이터가 입력된 항목은 자동으로 ✅ 표시됩니다",
      "[단락전류 계산] 버튼으로 각 모선의 단락전류를 계산할 수 있습니다 (차단기 용량 검토용)",
      "[전압강하 계산] 버튼으로 케이블 자동 사이즈 선정 결과를 볼 수 있습니다",
      "SOLAS 비상부하 체크리스트에서 누락된 비상부하를 확인하세요",
    ],
    tips: [
      "이 앱의 단락전류/전압강하 계산은 간이 계산입니다 — 선급 정식 제출 시 ETAP 등과 교차 검증 권장",
      "KR 제출 시 전력균형표는 KR 양식에 맞춰 CSV를 수정해서 제출하세요",
    ],
  },
];

const FAQ = [
  {
    q: "발전기 용량을 아직 모르는데 어떻게 하나요?",
    a: "먼저 장비 입력에서 부하만 다 넣으세요. 그 다음 [전력 계산] 탭의 '발전기 용량 추천' 기능을 쓰면 필요한 발전기 용량과 대수를 자동으로 알려줍니다.",
  },
  {
    q: "부하율이 무엇인가요?",
    a: "장비가 정격 출력의 몇 %로 실제 운전하는지를 나타냅니다. 200kW 모터가 160kW로 운전하면 부하율 = 0.8(80%)입니다. 발전기 부하율은 총 소비전력 ÷ 발전기 총 용량 × 100입니다.",
  },
  {
    q: "운항조건별 사용 여부를 어떻게 입력하나요?",
    a: "부하 추가/편집 창에서 '운항조건별 사용 여부' 항목을 체크합니다. 예: Bow Thruster는 입출항에만 체크, 조명 변압기는 모든 조건에 체크합니다.",
  },
  {
    q: "Bus-Tie가 무엇인가요?",
    a: "주배전반(MSB)을 Port와 Stbd 두 구역으로 나눌 때 둘을 연결하는 스위치입니다. 투입 상태에서는 두 구역이 연결되어 어느 발전기든 전체에 전원을 공급합니다. 개방하면 각 구역이 독립 운전됩니다.",
  },
  {
    q: "DOL 기동이 문제가 되는 경우는?",
    a: "200kW 이상 대형 모터를 DOL(직입)로 기동하면 순간 전류가 정격의 6~8배 흐릅니다. 이때 전압이 순간 강하해서 다른 장비가 꺼질 수 있습니다. Y-Δ 또는 Soft Starter로 기동방식을 바꾸면 기동전류를 1/3로 줄일 수 있습니다.",
  },
  {
    q: "프로젝트를 저장하려면?",
    a: "Turso DB 설정 없이도 우측 상단 [JSON 저장]으로 파일로 저장할 수 있습니다. Turso DB를 설정하면 자동저장(3초 디바운스)이 됩니다.",
  },
];

export default function HelpGuide({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<"workflow" | "faq">("workflow");

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-400" />
            <h2 className="text-base font-semibold text-slate-200">사용 가이드</h2>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-slate-700/50">
          <button
            className={`px-5 py-2.5 text-sm border-b-2 transition-colors ${
              activeSection === "workflow"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setActiveSection("workflow")}
          >
            워크플로우
          </button>
          <button
            className={`px-5 py-2.5 text-sm border-b-2 transition-colors ${
              activeSection === "faq"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setActiveSection("faq")}
          >
            자주 묻는 질문
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeSection === "workflow" ? (
            <div className="space-y-4">
              {/* 전체 흐름 요약 */}
              <div className="flex items-center gap-2 flex-wrap mb-5">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                      {s.icon}
                      {s.tab}
                    </div>
                    {i < STEPS.length - 1 && (
                      <ArrowRight size={14} className="text-slate-600" />
                    )}
                  </div>
                ))}
              </div>

              {/* 각 탭 설명 */}
              {STEPS.map((step, i) => (
                <div key={i} className={`border rounded-lg p-4 ${step.color}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {step.icon}
                    <h3 className="text-sm font-semibold text-slate-200">{step.tab}</h3>
                    <span className="text-xs text-slate-400">— {step.heading}</span>
                  </div>
                  <ol className="space-y-1.5 mb-3">
                    {step.steps.map((s, j) => (
                      <li key={j} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-slate-500 shrink-0 font-mono">{j + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  {step.tips.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-1">
                      {step.tips.map((tip, j) => (
                        <p key={j} className="flex gap-1.5 text-xs text-amber-400/80">
                          <span className="shrink-0">💡</span>
                          <span>{tip}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 주의사항 */}
              <div className="border border-red-800/30 bg-red-900/10 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={15} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-red-300">선박 전기설계 주요 주의사항</h3>
                </div>
                {[
                  "선박은 IT 접지(비접지) 시스템이 기본 — 지락고장 시 즉시 차단 안 됨. 절연감시장치(IMD) 필수",
                  "Bus-Tie 투입 조건에서 단락전류가 가장 크고, 개방 조건에서 전압강하가 가장 큼 — 두 조건 모두 검토",
                  "비상발전기 용량 = SOLAS 비상부하 합계 / 0.8 이상이어야 함",
                  "대형 모터(DOL, 50kW↑) 기동 시 전압강하 15% 초과 여부를 반드시 확인",
                ].map((note, i) => (
                  <p key={i} className="text-xs text-slate-400 flex gap-1.5">
                    <span className="text-red-400 shrink-0">⚠</span>
                    {note}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div key={i} className="border border-slate-700/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-sky-300 mb-2">Q. {item.q}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">A. {item.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
