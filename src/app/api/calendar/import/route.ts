import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { verifyJwt } from '@/lib/auth';

// ── ICS 파싱 유틸리티 ──

interface ParsedEvent {
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string | null; // HH:MM or null
  memo: string | null;
}

/**
 * ICS line folding 해제: RFC 5545에 따라 CRLF + 공백/탭은 이전 줄의 연속이다.
 */
function unfoldLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfolded = normalized.replace(/\n[ \t]/g, '');
  return unfolded.split('\n');
}

/**
 * ICS escaped 문자 디코딩
 */
function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .replace(/\\;/g, ';');
}

/**
 * DTSTART 파싱: 다양한 형식 지원
 */
function parseDtStart(line: string): { date: string; time: string | null } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const propPart = line.substring(0, colonIdx).toUpperCase();
  const valuePart = line.substring(colonIdx + 1).trim();

  if (!valuePart) return null;

  // VALUE=DATE 형식 (날짜만)
  if (propPart.includes('VALUE=DATE')) {
    const m = valuePart.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
    return null;
  }

  // TZID가 있는 경우
  const tzidMatch = propPart.match(/TZID=([^;:]+)/i);

  // 날짜+시간 형식
  const dtMatch = valuePart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dtMatch) {
    const [, y, mo, d, h, mi, , utcFlag] = dtMatch;
    const dateStr = `${y}-${mo}-${d}`;

    if (utcFlag) {
      // UTC -> KST (+9시간)
      const utcDate = new Date(Date.UTC(
        parseInt(y), parseInt(mo) - 1, parseInt(d),
        parseInt(h), parseInt(mi), 0
      ));
      utcDate.setUTCHours(utcDate.getUTCHours() + 9);
      const kstDate = `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
      const kstTime = `${String(utcDate.getUTCHours()).padStart(2, '0')}:${String(utcDate.getUTCMinutes()).padStart(2, '0')}`;
      return { date: kstDate, time: kstTime };
    }

    // TZID 또는 로컬 시간 -> KST로 간주
    if (tzidMatch) {
      return { date: dateStr, time: `${h}:${mi}` };
    }

    return { date: dateStr, time: `${h}:${mi}` };
  }

  // 날짜만 (20240315)
  const dateOnly = valuePart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: null };
  }

  return null;
}

/**
 * .ics 텍스트에서 VEVENT를 파싱하여 이벤트 목록을 반환한다.
 */
function parseIcs(icsText: string): ParsedEvent[] {
  const lines = unfoldLines(icsText);
  const events: ParsedEvent[] = [];

  let inEvent = false;
  let summary = '';
  let dtstart: { date: string; time: string | null } | null = null;
  let description = '';
  let location = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      dtstart = null;
      description = '';
      location = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && summary && dtstart) {
        let memo: string | null = null;
        const parts: string[] = [];
        if (description) parts.push(unescapeIcs(description));
        if (location) parts.push(`장소: ${unescapeIcs(location)}`);
        if (parts.length > 0) memo = parts.join('\n');

        events.push({
          title: unescapeIcs(summary),
          eventDate: dtstart.date,
          eventTime: dtstart.time,
          memo,
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const upperLine = trimmed.toUpperCase();

    if (upperLine.startsWith('SUMMARY')) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) summary = trimmed.substring(idx + 1).trim();
    } else if (upperLine.startsWith('DTSTART')) {
      dtstart = parseDtStart(trimmed);
    } else if (upperLine.startsWith('DESCRIPTION')) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) description = trimmed.substring(idx + 1).trim();
    } else if (upperLine.startsWith('LOCATION')) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) location = trimmed.substring(idx + 1).trim();
    }
  }

  return events;
}

// ── Helper: JWT에서 userId 추출 ──
async function getUserId(request: NextRequest): Promise<string | null> {
  const jwtToken = request.cookies.get('haru-token')?.value;
  if (!jwtToken) return null;
  const payload = await verifyJwt(jwtToken);
  return payload?.userId ?? null;
}

// ── POST - .ics 파일 가져오기 ──
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { icsText, folderId } = body;

    if (!icsText || typeof icsText !== 'string') {
      return NextResponse.json({ success: false, error: '.ics 파일 내용이 필요합니다.' }, { status: 400 });
    }

    // folderId가 있으면 권한 확인 (단순화된 버전)
    if (folderId) {
      const folderCheck = await query(
        `SELECT 1 FROM folders WHERE id = $1 AND (
          owner_id = $2 OR id IN (SELECT folder_id FROM folder_members WHERE user_id = $2)
        )`,
        [folderId, userId]
      );
      if (folderCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
      }
    }

    // .ics 파싱
    const parsedEvents = parseIcs(icsText);

    if (parsedEvents.length === 0) {
      return NextResponse.json({ success: false, error: '가져올 수 있는 일정이 없습니다. .ics 파일 형식을 확인하세요.' }, { status: 400 });
    }

    // 기존 이벤트 조회 (중복 체크용) - 같은 사용자의 같은 날짜+같은 제목
    const existingResult = await query(
      `SELECT event_date, title FROM calendar_events WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const existingSet = new Set(
      existingResult.rows.map((r: { event_date: string; title: string }) => `${r.event_date}||${r.title}`)
    );

    // 배치 ID 생성: ics_YYYYMMDD_HHMMSS
    const batchDate = new Date();
    const batchId = `ics_${batchDate.getFullYear()}${String(batchDate.getMonth() + 1).padStart(2, '0')}${String(batchDate.getDate()).padStart(2, '0')}_${String(batchDate.getHours()).padStart(2, '0')}${String(batchDate.getMinutes()).padStart(2, '0')}${String(batchDate.getSeconds()).padStart(2, '0')}`;

    // 일정 삽입 (중복 스킵)
    let imported = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const evt of parsedEvents) {
      const key = `${evt.eventDate}||${evt.title}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      const id = uuidv4();
      await query(
        `INSERT INTO calendar_events (id, user_id, folder_id, title, event_date, event_time, event_type, memo, import_source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, userId, folderId || null, evt.title, evt.eventDate, evt.eventTime, '기타', evt.memo, batchId, now, now]
      );

      existingSet.add(key);
      imported++;
    }

    return NextResponse.json({
      success: true,
      data: {
        total: parsedEvents.length,
        imported,
        skipped,
        batchId,
      },
    });
  } catch (error) {
    console.error('[Calendar Import POST] Error:', error);
    return NextResponse.json({ success: false, error: '일정 가져오기 실패' }, { status: 500 });
  }
}

// ── DELETE - ICS 가져오기 취소 (되돌리기) ──
export async function DELETE(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    let result;
    if (batchId) {
      // 특정 배치의 ICS 가져오기 일정만 삭제
      result = await query(
        `DELETE FROM calendar_events WHERE import_source = $1 AND user_id = $2`,
        [batchId, userId]
      );
    } else {
      // 전체 ICS 가져오기 일정 삭제
      result = await query(
        `DELETE FROM calendar_events WHERE import_source LIKE 'ics_%' AND user_id = $1`,
        [userId]
      );
    }

    return NextResponse.json({
      success: true,
      data: { deleted: result.rowCount || 0 },
    });
  } catch (error) {
    console.error('[Calendar Import DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '가져오기 취소 실패' }, { status: 500 });
  }
}
