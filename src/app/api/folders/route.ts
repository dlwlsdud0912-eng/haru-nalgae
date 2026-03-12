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

// GET - 사용자의 폴더 목록
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 내 폴더
    const myFoldersResult = await query(
      `SELECT * FROM folders WHERE owner_id = $1 ORDER BY created_at ASC`,
      [userId]
    );

    // 공유받은 폴더
    const sharedFoldersResult = await query(
      `SELECT f.*, fm.role FROM folders f
       JOIN folder_members fm ON f.id = fm.folder_id
       WHERE fm.user_id = $1 AND f.owner_id != $1
       ORDER BY f.created_at ASC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      data: {
        myFolders: myFoldersResult.rows,
        sharedFolders: sharedFoldersResult.rows,
      },
    });
  } catch (error) {
    console.error('[Folders GET] Error:', error);
    return NextResponse.json({ success: false, error: '폴더 조회 실패' }, { status: 500 });
  }
}

// POST - 폴더 생성
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, icon } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: '폴더 이름이 필요합니다.' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // 폴더 생성
    await query(
      `INSERT INTO folders (id, name, color, icon, owner_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, color || '#6EE7B7', icon || null, userId, now]
    );

    // owner를 folder_members에 추가
    await query(
      `INSERT INTO folder_members (folder_id, user_id, role, created_at)
       VALUES ($1, $2, 'owner', $3)`,
      [id, userId, now]
    );

    return NextResponse.json({
      success: true,
      data: {
        id,
        name,
        color: color || '#6EE7B7',
        icon: icon || null,
        owner_id: userId,
        created_at: now,
      },
    });
  } catch (error) {
    console.error('[Folders POST] Error:', error);
    return NextResponse.json({ success: false, error: '폴더 생성 실패' }, { status: 500 });
  }
}

// PUT - 폴더 수정 (owner만)
export async function PUT(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, color, icon } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '폴더 id가 필요합니다.' }, { status: 400 });
    }

    // owner 확인
    const folderCheck = await query(
      `SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2`,
      [id, userId]
    );
    if (folderCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '수정 권한이 없습니다.' }, { status: 403 });
    }

    const fields: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(color); }
    if (icon !== undefined) { fields.push(`icon = $${paramIndex++}`); values.push(icon); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목이 없습니다.' }, { status: 400 });
    }

    values.push(id);

    await query(
      `UPDATE folders SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Folders PUT] Error:', error);
    return NextResponse.json({ success: false, error: '폴더 수정 실패' }, { status: 500 });
  }
}

// DELETE - 폴더 삭제 (owner만)
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
      return NextResponse.json({ success: false, error: '폴더 id가 필요합니다.' }, { status: 400 });
    }

    // owner 확인
    const folderCheck = await query(
      `SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2`,
      [id, userId]
    );
    if (folderCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    // cascade: 이벤트의 folder_id를 null로 변경
    await query(
      `UPDATE calendar_events SET folder_id = NULL WHERE folder_id = $1`,
      [id]
    );

    // cascade: folder_members 삭제
    await query(
      `DELETE FROM folder_members WHERE folder_id = $1`,
      [id]
    );

    // 폴더 삭제
    await query(
      `DELETE FROM folders WHERE id = $1 AND owner_id = $2`,
      [id, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Folders DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '폴더 삭제 실패' }, { status: 500 });
  }
}
