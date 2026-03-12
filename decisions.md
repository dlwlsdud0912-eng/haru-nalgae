# 하루날개 (HaruNalgae) - AI 캘린더 프로젝트 결정 기록

## 프로젝트 개요
- **이름**: 하루날개
- **설명**: 일반인용 AI 캘린더 독립 웹앱
- **기술 스택**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Neon PostgreSQL
- **AI**: Gemini (날개의답변)
- **디자인**: 민트(#34D399) + 크림(#FFFDF7), 동화 톤앤매너
- **원본**: 중개날개 V2 캘린더 기능 기반
- **V2 Repo**: https://github.com/dlwlsdud0912-eng/nepcon-v2

---

### [2026-03-12 00:00] 프로젝트 시작 - 하루날개
- **유형**: 목표설정
- **내용**: 기존 중개날개(V2)의 캘린더+AI 기능을 일반인용 독립 웹앱으로 분리 제작
- **근거**: 부동산 CRM에 종속된 캘린더를 일반 사용자도 쓸 수 있도록 독립 서비스화

### [2026-03-12 00:01] 기술 결정 - 디자인 시스템
- **유형**: 기술결정
- **내용**: 민트+크림 컬러 팔레트, Pretendard Variable 폰트, 동화같은 톤앤매너
- **근거**: 사용자 선택. 부드럽고 친근한 느낌의 개인 캘린더 서비스에 적합

### [2026-03-12 00:02] 기술 결정 - 폴더 구조
- **유형**: 기술결정
- **내용**: 개인 캘린더 기반 + 폴더별 공유 기능 (username 기반 초대, owner/editor/viewer 역할)
- **근거**: V2의 team/personal 분리 대신 심플한 폴더 공유 방식 채택

### [2026-03-12 00:03] 기술 결정 - 캘린더 재사용
- **유형**: 기술결정
- **내용**: V2 CalendarModal.tsx를 CalendarView.tsx로 복사 후 최소 수정 (모달→풀페이지, spaceTypes→folderId, customer 제거)
- **근거**: 2500줄+ 검증된 캘린더 코드를 최대한 재사용하여 안정성 확보

### [2026-03-12 00:04] 기술 결정 - 보안
- **유형**: 기술결정
- **내용**: V2와 동일 수준 보안 적용 (JWT httpOnly, bcrypt, parameterized SQL, X-Frame-Options, nosniff, CSP)
- **근거**: Enterprise B+ 등급 보안을 그대로 유지

### [2026-03-12 00:05] 기술 결정 - AI/이벤트 무제한
- **유형**: 기술결정
- **내용**: AI 사용, 캘린더 검색, 이벤트 생성 모두 무제한 (rate limit 없음)
- **근거**: 사용자 요청 - 수익화 모델 나중에 결정이므로 일단 제한 없이

### [2026-03-12 00:06] 태스크완료 - Phase 1 프로젝트 스캐폴딩
- **유형**: 태스크완료
- **내용**: Next.js 프로젝트 생성, 디자인 시스템 (globals.css), 기반 파일 (db.ts, auth.ts, types, middleware)
- **근거**: 모든 후속 태스크의 기반

### [2026-03-12 00:07] 태스크완료 - Phase 2 인증 시스템
- **유형**: 태스크완료
- **내용**: Auth API (signup/login/logout/me), 로그인/회원가입 페이지, middleware JWT 가드
- **근거**: 캘린더 접근을 위한 인증 기반

### [2026-03-12 00:08] 진행중 - Phase 3~7 병렬 개발
- **유형**: 태스크완료
- **내용**: CalendarView 컴포넌트, API 라우트들, UI 페이지들을 4개 팀원이 병렬로 개발 중
- **근거**: 최대 속도로 개발하기 위해 독립적인 태스크를 병렬 처리

### 기본 카테고리 (V2 부동산용 → 일반용 변경)
| V2 (부동산) | 하루날개 (일반) |
|-------------|----------------|
| 계약 | 업무 |
| 중도금 | 개인 |
| 잔금 | 가족 |
| 안내 | 약속 |
| 상담 | 기념일 |
| 일상 | 기타 |

### DB 스키마
- users (id, username, password_hash, display_name, created_at)
- folders (id, name, color, icon, owner_id, created_at)
- folder_members (folder_id, user_id, role, created_at)
- calendar_events (id, user_id, folder_id, title, event_date, event_time, event_type, memo, completed, import_source, created_at, updated_at, deleted_at)
- event_categories (id, user_id, name, color_bg, color_text, sort_order, keywords, created_at)
