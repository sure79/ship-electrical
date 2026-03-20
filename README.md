# ⚡ Ship Electrical Design Helper

선박 전기 기본설계 웹 앱 — Load Balance, 단선결선도, 케이블 사이징, 선급 제출 체크리스트

## 빠른 시작

### 1. 패키지 설치

```bash
cd electric2
npm install
```

### 2. 환경변수 설정

```bash
cp .env.local.example .env.local
# .env.local 파일을 열고 Turso DB 정보 입력
```

Turso DB 만들기:
```bash
# Turso CLI 설치 (Windows: winget 또는 scoop)
winget install turso

# 로그인 & DB 생성
turso auth signup
turso db create ship-electrical
turso db show ship-electrical        # URL 복사
turso db tokens create ship-electrical  # 토큰 복사
```

### 3. DB 초기화

```bash
npm run db:push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## Turso 없이 로컬 테스트

`.env.local`에 DB 정보가 없어도 앱은 실행됩니다.
다만 프로젝트 저장/불러오기(클라우드)가 안 됩니다.
JSON 내보내기/가져오기로 로컬 파일 저장은 가능합니다.

---

## Vercel 배포

```bash
npx vercel

# Vercel 대시보드 → Settings → Environment Variables:
# TURSO_DATABASE_URL = libsql://...
# TURSO_AUTH_TOKEN = eyJ...
```

---

## 기능

| 탭 | 기능 |
|---|---|
| 장비 입력 | 발전기/부하 CRUD, 프리셋 추가, 운항조건 설정 |
| 전력 계산 | Load Balance 테이블, 부하율 차트, 경고 메시지 |
| 결선도 | 인터랙티브 SVG 단선결선도, SVG/draw.io 내보내기 |
| 선급 제출 | KR/ABS/DNV 체크리스트, SOLAS 비상부하 체크, 단락전류/전압강하 간이 계산 |

## 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **상태관리**: Zustand (3초 디바운스 자동저장)
- **차트**: Recharts
- **DB**: Turso (edge SQLite) + Drizzle ORM
- **배포**: Vercel
- **계산**: 클라이언트 TypeScript (IEC 61363, IEC 60092)
