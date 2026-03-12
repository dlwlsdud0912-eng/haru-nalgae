import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// 기본 카테고리 시드 데이터
const DEFAULT_CATEGORIES = [
  { name: '업무', colorBg: '#dbeafe', colorText: '#1e3a8a', sortOrder: 0, keywords: '업무,회의,미팅' },
  { name: '개인', colorBg: '#dcfce7', colorText: '#14532d', sortOrder: 1, keywords: '개인' },
  { name: '가족', colorBg: '#fce7f3', colorText: '#831843', sortOrder: 2, keywords: '가족,부모,자녀' },
  { name: '약속', colorBg: '#f3e8ff', colorText: '#581c87', sortOrder: 3, keywords: '약속,만남' },
  { name: '기념일', colorBg: '#fef3c7', colorText: '#78350f', sortOrder: 4, keywords: '기념일,생일,결혼' },
  { name: '기타', colorBg: '#f3f4f6', colorText: '#374151', sortOrder: 5, keywords: '' },
];

// ── Helper: JWT에서 userId 추출 ──
async function getUserId(request: NextRequest): Promise<string | null> {
  const jwtToken = request.cookies.get('haru-token')?.value;
  if (!jwtToken) return null;
  const payload = await verifyJwt(jwtToken);
  return payload?.userId ?? null;
}

// GET - 사용자의 카테고리 목록 조회 (없으면 기본 카테고리 자동 생성)
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 카테고리 조회
    let result = await query(
      `SELECT * FROM event_categories WHERE user_id = $1 ORDER BY sort_order, created_at`,
      [userId]
    );

    // 카테고리가 없으면 기본 카테고리 시드
    if (result.rows.length === 0) {
      const now = new Date().toISOString();
      for (const cat of DEFAULT_CATEGORIES) {
        const id = uuidv4();
        await query(
          `INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, keywords, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, userId, cat.name, cat.colorBg, cat.colorText, cat.sortOrder, cat.keywords, now]
        );
      }

      // 생성 후 다시 조회
      result = await query(
        `SELECT * FROM event_categories WHERE user_id = $1 ORDER BY sort_order, created_at`,
        [userId]
      );
    }

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Calendar Categories GET] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 조회 실패' }, { status: 500 });
  }
}

// POST - 새 카테고리 추가
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, colorBg, colorText, keywords } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: '카테고리 이름이 필요합니다.' }, { status: 400 });
    }

    // 현재 max sort_order 조회
    const maxResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM event_categories WHERE user_id = $1`,
      [userId]
    );
    const nextOrder = (maxResult.rows[0]?.max_order ?? -1) + 1;

    const id = uuidv4();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, keywords, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, userId, name, colorBg || '#f3f4f6', colorText || '#374151', nextOrder, keywords || '', now]
    );

    return NextResponse.json({
      success: true,
      data: {
        id,
        user_id: userId,
        name,
        color_bg: colorBg || '#f3f4f6',
        color_text: colorText || '#374151',
        sort_order: nextOrder,
        keywords: keywords || '',
        created_at: now,
      },
    });
  } catch (error) {
    console.error('[Calendar Categories POST] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 추가 실패' }, { status: 500 });
  }
}

// PUT - 카테고리 수정
export async function PUT(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, colorBg, colorText, sortOrder, keywords } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '카테고리 id가 필요합니다.' }, { status: 400 });
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (colorBg !== undefined) { fields.push(`color_bg = $${paramIndex++}`); values.push(colorBg); }
    if (colorText !== undefined) { fields.push(`color_text = $${paramIndex++}`); values.push(colorText); }
    if (sortOrder !== undefined) { fields.push(`sort_order = $${paramIndex++}`); values.push(sortOrder); }
    if (keywords !== undefined) { fields.push(`keywords = $${paramIndex++}`); values.push(keywords); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목이 없습니다.' }, { status: 400 });
    }

    values.push(id, userId);

    const result = await query(
      `UPDATE event_categories SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Categories PUT] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 수정 실패' }, { status: 500 });
  }
}

// DELETE - 카테고리 삭제 (해당 카테고리를 사용 중인 이벤트는 '기타'로 변경)
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
      return NextResponse.json({ success: false, error: '카테고리 id가 필요합니다.' }, { status: 400 });
    }

    // 삭제 대상 카테고리의 이름 조회
    const catResult = await query(
      `SELECT name FROM event_categories WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (catResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const categoryName = catResult.rows[0].name;

    // 해당 카테고리를 사용 중인 이벤트의 event_type을 '기타'로 변경
    await query(
      `UPDATE calendar_events SET event_type = '기타' WHERE event_type = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [categoryName, userId]
    );

    // 카테고리 삭제
    await query(
      `DELETE FROM event_categories WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Categories DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 삭제 실패' }, { status: 500 });
  }
}
