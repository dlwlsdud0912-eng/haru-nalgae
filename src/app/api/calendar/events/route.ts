import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { verifyJwt } from '@/lib/auth';

// ── Helper: JWT에서 userId 추출 ──
async function getUserId(request: NextRequest): Promise<string | null> {
  const jwtToken = request.cookies.get('haru-token')?.value;
  if (!jwtToken) return null;
  const payload = await verifyJwt(jwtToken);
  return payload?.userId ?? null;
}

// GET - 이벤트 목록 조회
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let result;

    if (folderId) {
      // 특정 폴더 이벤트 조회 (소유권 체크)
      const folderCheck = await query(
        `SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2
         UNION ALL
         SELECT 1 FROM folder_members WHERE folder_id = $1 AND user_id = $2`,
        [folderId, userId]
      );
      if (folderCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
      }

      if (year && month) {
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = `${year}-${month.padStart(2, '0')}-31`;
        result = await query(
          `SELECT * FROM calendar_events
           WHERE folder_id = $1 AND event_date >= $2 AND event_date <= $3 AND deleted_at IS NULL
           ORDER BY event_date ASC, event_time ASC NULLS LAST, created_at ASC`,
          [folderId, startDate, endDate]
        );
      } else {
        result = await query(
          `SELECT * FROM calendar_events
           WHERE folder_id = $1 AND deleted_at IS NULL
           ORDER BY event_date ASC, event_time ASC NULLS LAST, created_at ASC`,
          [folderId]
        );
      }
    } else {
      // 전체 이벤트 조회: 자기 이벤트 + 공유 폴더 이벤트
      if (year && month) {
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = `${year}-${month.padStart(2, '0')}-31`;
        result = await query(
          `SELECT * FROM calendar_events
           WHERE (user_id = $1 OR folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = $1))
             AND event_date >= $2 AND event_date <= $3 AND deleted_at IS NULL
           ORDER BY event_date ASC, event_time ASC NULLS LAST, created_at ASC`,
          [userId, startDate, endDate]
        );
      } else {
        result = await query(
          `SELECT * FROM calendar_events
           WHERE (user_id = $1 OR folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = $1))
             AND deleted_at IS NULL
           ORDER BY event_date ASC, event_time ASC NULLS LAST, created_at ASC`,
          [userId]
        );
      }
    }

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Calendar Events GET] Error:', error);
    return NextResponse.json({ success: false, error: '일정 조회 실패' }, { status: 500 });
  }
}

// POST - 이벤트 생성
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { folderId, title, eventDate, eventType, eventTime, memo } = body;

    if (!title || !eventDate) {
      return NextResponse.json({ success: false, error: 'title, eventDate가 필요합니다.' }, { status: 400 });
    }

    // folderId가 있으면 소유권/멤버 체크
    if (folderId) {
      const folderCheck = await query(
        `SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2
         UNION ALL
         SELECT 1 FROM folder_members WHERE folder_id = $1 AND user_id = $2 AND role IN ('editor', 'owner')`,
        [folderId, userId]
      );
      if (folderCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO calendar_events (id, user_id, folder_id, title, event_date, event_time, event_type, memo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, userId, folderId || null, title, eventDate, eventTime || null, eventType || '기타', memo || null, now, now]
    );

    return NextResponse.json({
      success: true,
      data: { id, user_id: userId, folder_id: folderId || null, title, event_date: eventDate, event_time: eventTime || null, event_type: eventType || '기타', memo, created_at: now, updated_at: now },
    });
  } catch (error) {
    console.error('[Calendar Events POST] Error:', error);
    return NextResponse.json({ success: false, error: '일정 생성 실패' }, { status: 500 });
  }
}

// PUT - 이벤트 수정
export async function PUT(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
    }

    // 이벤트 소유권 확인
    const eventCheck = await query(
      `SELECT user_id, folder_id FROM calendar_events WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (eventCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '이벤트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const eventRow = eventCheck.rows[0];
    // 본인 이벤트이거나, 공유 폴더의 editor/owner인 경우 허용
    if (eventRow.user_id !== userId) {
      if (eventRow.folder_id) {
        const memberCheck = await query(
          `SELECT 1 FROM folder_members WHERE folder_id = $1 AND user_id = $2 AND role IN ('editor', 'owner')`,
          [eventRow.folder_id, userId]
        );
        if (memberCheck.rows.length === 0) {
          return NextResponse.json({ success: false, error: '수정 권한이 없습니다.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: '수정 권한이 없습니다.' }, { status: 403 });
      }
    }

    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(updates.title); }
    if (updates.eventDate !== undefined) { fields.push(`event_date = $${paramIndex++}`); values.push(updates.eventDate); }
    if (updates.eventType !== undefined) { fields.push(`event_type = $${paramIndex++}`); values.push(updates.eventType); }
    if (updates.memo !== undefined) { fields.push(`memo = $${paramIndex++}`); values.push(updates.memo); }
    if (updates.eventTime !== undefined) { fields.push(`event_time = $${paramIndex++}`); values.push(updates.eventTime); }
    if (updates.completed !== undefined) { fields.push(`completed = $${paramIndex++}`); values.push(updates.completed); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목이 없습니다.' }, { status: 400 });
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    await query(
      `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Events PUT] Error:', error);
    return NextResponse.json({ success: false, error: '일정 수정 실패' }, { status: 500 });
  }
}

// DELETE - 이벤트 삭제 (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
    }

    // 이벤트 소유권 확인
    const eventCheck = await query(
      `SELECT user_id, folder_id FROM calendar_events WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (eventCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '이벤트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const eventRow = eventCheck.rows[0];
    if (eventRow.user_id !== userId) {
      if (eventRow.folder_id) {
        const memberCheck = await query(
          `SELECT 1 FROM folder_members WHERE folder_id = $1 AND user_id = $2 AND role IN ('editor', 'owner')`,
          [eventRow.folder_id, userId]
        );
        if (memberCheck.rows.length === 0) {
          return NextResponse.json({ success: false, error: '삭제 권한이 없습니다.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: '삭제 권한이 없습니다.' }, { status: 403 });
      }
    }

    await query(
      'UPDATE calendar_events SET deleted_at = $1 WHERE id = $2',
      [new Date().toISOString(), id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Events DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '일정 삭제 실패' }, { status: 500 });
  }
}
