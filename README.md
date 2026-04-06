# 선박 전장기본설계 자동화 v2.0

부하 입력 → 발전기/비상발전기/ESS 자동 산정 → draw.io SLD 자동 생성

**Tech**: Next.js 14 · TypeScript · Turso DB · Vercel
**기준**: KR 선급 / IEC 60092 / IEC 60617 / SOLAS

---

## 로컬 실행

```bash
cd c:/claude_project/ship-design
npm install
npm run dev
# → http://localhost:3000
```

로컬에서는 `file:./local.db` (SQLite) 자동 사용. Turso 설정 불필요.

---

## Turso DB 설정

```bash
# Turso CLI 설치
npm install -g @turso/cli
turso auth login

# DB 생성
turso db create ship-design

# 접속 URL + 토큰 확인
turso db show ship-design
turso db tokens create ship-design
```

`.env.local` 파일 생성:
```
TURSO_DATABASE_URL=libsql://ship-design-<user>.turso.io
TURSO_AUTH_TOKEN=<token>
```

---

## Vercel 배포

```bash
npm install -g vercel
vercel

# 환경변수 설정
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN

# 재배포
vercel --prod
```

---

## 기능

| 기능 | 설명 |
|------|------|
| 프로젝트 관리 | 선박별 프로젝트 생성/삭제/목록 |
| 계통 설정 | AC/DC 전압, 발전기 수, ESS/EG/추진 옵션 |
| 버스 등록 | MSB, MDP, EDB 등 From-To 회로용 |
| 부하 입력 | 인라인 편집 + 자동저장 (Turso DB) |
| 자동 계산 | kVA 환산 → 발전기/EG/ESS 용량 (KR 기준) |
| MCCB/케이블 | 자동 선정 (IEC 60092 + KR 허용전류표) |
| SLD 생성 | draw.io XML 자동생성 → .drawio 파일 저장 |
| 경고 | 부하율/케이블여유율/MCCB 검토 자동 표시 |

---

## 파일 구조

```
app/
  page.tsx                    ← 대시보드 (프로젝트 목록)
  projects/[id]/page.tsx      ← 4탭 프로젝트 편집기
  api/
    projects/route.ts         ← GET/POST 프로젝트 목록
    projects/[id]/route.ts    ← GET/PUT/DELETE 단일 프로젝트
    buses/[projectId]/route.ts
    buses/[projectId]/[busId]/route.ts
    loads/[projectId]/route.ts
    loads/[projectId]/[loadId]/route.ts
    calculate/[projectId]/route.ts ← 계산 실행 + SLD 생성
lib/
  db.ts             ← Turso/libSQL 클라이언트 + 테이블 초기화
  types.ts          ← TypeScript 인터페이스
  calculations.ts   ← KR 선급 계산 엔진
  sld-generator.ts  ← draw.io XML 생성기
```
