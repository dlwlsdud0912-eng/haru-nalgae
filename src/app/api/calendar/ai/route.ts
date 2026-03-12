import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent } from '@google/genai';
import { ensureDb } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';

const CALENDAR_AI_PROMPT = `당신은 'AI 캘린더 도우미'입니다. 사용자의 자연어 요청을 분석하여 캘린더 이벤트를 관리합니다.

오늘 날짜: {현재 KST 날짜}

## 응답 형식 (반드시 JSON만 출력, 마크다운 코드블록 금지)
{
  "action": "create" | "update" | "delete" | "query" | "error",
  "message": "사용자에게 보여줄 메시지",
  "events": [...],
  "eventIds": [...]
}

## 이벤트 필드
- title: 일정 제목
- eventDate: YYYY-MM-DD
- eventTime: HH:MM (24시간) 또는 null
- eventType: 카테고리명 (업무, 개인, 가족, 약속, 기념일, 기타)
- memo: 메모 (선택)

## 날짜 파싱
- "내일" → 오늘+1일
- "모레" → 오늘+2일
- "글피" → 오늘+3일
- "어제" → 오늘-1일
- "다음주 월요일" → 다음 주 월요일
- "이번 금요일" → 이번 주 금요일
- "3월 15일" → 현재 연도 기준
- 연도가 없으면 현재 연도 사용

## 시간 파싱
- "3시" → 15:00 (오후 기본)
- "오전 9시" → 09:00
- "오후 2시 30분" → 14:30
- "2시반" → 14:30
- 시간 미언급 → eventTime은 null
- 시간은 반드시 HH:MM (24시간 형식)

## 카테고리 자동 감지
- 회의, 미팅, 업무 관련 → 업무
- 가족, 부모, 자녀 관련 → 가족
- 약속, 만남 관련 → 약속
- 생일, 기념일 관련 → 기념일
- 기타 → 기타

## 검색/조회
- 일정 검색 시 events 배열에서 title, eventType으로 부분 문자열 매칭
- 결과를 message에 정리하여 반환

## 의도 판별
### create (추가): "추가", "등록", "넣어", "잡아", "만들어" 등 추가 키워드가 반드시 있어야 함
### update (수정): "바꿔", "변경", "수정", "옮겨", "이동" 키워드 필요
### delete (삭제): "삭제", "지워", "취소", "없애", "제거", "보류", "안하기로", "못하게", "빠졌어", "빼줘" 등
### query (조회): "언제", "몇시", "뭐있어", "알려줘", "보여줘" 등. 기본값.

## 출력 형식

### create
{"action":"create","message":"일정을 추가했습니다.","events":[{"title":"제목","eventDate":"YYYY-MM-DD","eventTime":"HH:MM 또는 null","eventType":"카테고리","memo":"메모 또는 null"}]}

### update
{"action":"update","message":"일정을 수정했습니다.","events":[{"id":"기존이벤트id","title":"제목","eventDate":"YYYY-MM-DD","eventTime":"HH:MM 또는 null","eventType":"카테고리"}]}

### delete
{"action":"delete","message":"일정을 삭제했습니다.","eventIds":["삭제할이벤트id"]}

### query
{"action":"query","message":"자연스러운 한국어 답변"}

### error
{"action":"error","message":"에러 메시지"}

## 규칙
- amount 필드는 사용하지 않음 (null)
- customerName 필드는 사용하지 않음
- 항상 한국어로 응답
- 모호한 요청은 확인 질문 (query 액션)
- title에 시간/날짜를 포함하지 않음 (eventTime/eventDate 필드로 분리)
- title 끝에 "일정"이 붙어있으면 제거
- update 시 변경하지 않는 필드도 기존 값을 그대로 포함`;

// ── Helper: JWT에서 userId 추출 ──
async function getUserId(request: NextRequest): Promise<string | null> {
  const jwtToken = request.cookies.get('haru-token')?.value;
  if (!jwtToken) return null;
  const payload = await verifyJwt(jwtToken);
  return payload?.userId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { message, folderId, events } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'message가 필요합니다.' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 한국 시간(KST = UTC+9) 기준 오늘 날짜 계산
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const todayStr = kstDate.toISOString().split('T')[0];
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][kstDate.getUTCDay()];

    let userMessage = `오늘 날짜: ${todayStr} (${dayOfWeek}요일)\n\n`;

    // 기존 이벤트 정보 추가
    const limitedEvents = events || [];
    if (limitedEvents.length > 0) {
      // 이벤트 통계
      const typeCount: Record<string, number> = {};
      for (const evt of limitedEvents) {
        const t = evt.event_type || evt.eventType || '기타';
        typeCount[t] = (typeCount[t] || 0) + 1;
      }
      const eventStatsLines = Object.entries(typeCount).map(([k, v]) => `${k}: ${v}건`).join(', ') || '없음';
      userMessage += `이벤트 유형별 건수: ${eventStatsLines}\n\n`;

      userMessage += `기존 일정 목록:\n`;
      for (const evt of limitedEvents) {
        userMessage += `- id: ${evt.id}, 날짜: ${evt.event_date || evt.eventDate}${evt.event_time || evt.eventTime ? ' ' + (evt.event_time || evt.eventTime) : ''}, 제목: ${evt.title}, 타입: ${evt.event_type || evt.eventType}${evt.memo ? ', 메모: ' + evt.memo : ''}\n`;
      }
      userMessage += `\n`;
    }

    if (folderId) {
      userMessage += `현재 폴더 ID: ${folderId}\n\n`;
    }

    userMessage += `사용자 요청: ${message}`;

    // 시스템 프롬프트의 날짜 치환
    const systemPrompt = CALENDAR_AI_PROMPT.replace('{현재 KST 날짜}', `${todayStr} (${dayOfWeek}요일)`);

    let result;
    try {
      result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: createUserContent([userMessage]),
        config: {
          systemInstruction: systemPrompt,
          temperature: 0,
          maxOutputTokens: 2048,
        },
      });
    } catch (modelError) {
      // 폴백: gemini-2.0-flash 실패 시 재시도
      console.error('[Calendar AI] Primary model failed, trying fallback:', modelError);
      result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: createUserContent([userMessage]),
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });
    }

    const rawText = result.text;
    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'AI 응답이 비어있습니다.' },
        { status: 422 }
      );
    }

    // JSON 파싱 (견고한 추출)
    let parsed;
    try {
      const cleaned = rawText.trim();

      // 1차: 그대로 파싱 시도
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // 2차: 마크다운 코드블록에서 추출
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          try {
            parsed = JSON.parse(codeBlockMatch[1].trim());
          } catch { /* 3차로 진행 */ }
        }

        // 3차: JSON 객체 패턴 추출
        if (!parsed) {
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }
      }

      if (!parsed) throw new Error('No valid JSON found');
    } catch {
      console.error('[Calendar AI] JSON 파싱 실패:', rawText);
      return NextResponse.json(
        { success: false, error: '응답을 파싱하지 못했습니다. 다시 시도해주세요.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error('[Calendar AI] Error:', error);
    const msg = error instanceof Error ? error.message : 'AI 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
