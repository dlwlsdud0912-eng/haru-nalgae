import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';

// ── Helper: JWT에서 userId 추출 ──
async function getUserId(request: NextRequest): Promise<string | null> {
  const jwtToken = request.cookies.get('haru-token')?.value;
  if (!jwtToken) return null;
  const payload = await verifyJwt(jwtToken);
  return payload?.userId ?? null;
}

// ── Helper: URL에서 folderId 추출 ──
function getFolderIdFromUrl(request: NextRequest): string | null {
  // /api/folders/[id]/members 형식에서 [id] 추출
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // parts: ['', 'api', 'folders', '{id}', 'members']
  const foldersIdx = parts.indexOf('folders');
  if (foldersIdx !== -1 && foldersIdx + 1 < parts.length) {
    return parts[foldersIdx + 1];
  }
  return null;
}

// ── Helper: 폴더 owner 확인 ──
async function isFolderOwner(folderId: string, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2`,
    [folderId, userId]
  );
  return result.rows.length > 0;
}

// GET - 멤버 목록
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const folderId = getFolderIdFromUrl(request);
    if (!folderId) {
      return NextResponse.json({ success: false, error: '폴더 ID가 필요합니다.' }, { status: 400 });
    }

    // 폴더 접근 권한 확인 (owner 또는 member)
    const accessCheck = await query(
      `SELECT 1 FROM folders WHERE id = $1 AND owner_id = $2
       UNION ALL
       SELECT 1 FROM folder_members WHERE folder_id = $1 AND user_id = $2`,
      [folderId, userId]
    );
    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const result = await query(
      `SELECT fm.folder_id, fm.user_id, fm.role, fm.created_at, u.username, u.display_name
       FROM folder_members fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.folder_id = $1
       ORDER BY fm.created_at ASC`,
      [folderId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Folder Members GET] Error:', error);
    return NextResponse.json({ success: false, error: '멤버 조회 실패' }, { status: 500 });
  }
}

// POST - 멤버 추가 (owner만)
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const folderId = getFolderIdFromUrl(request);
    if (!folderId) {
      return NextResponse.json({ success: false, error: '폴더 ID가 필요합니다.' }, { status: 400 });
    }

    // owner 확인
    if (!(await isFolderOwner(folderId, userId))) {
      return NextResponse.json({ success: false, error: '멤버 추가 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { username, role } = body;

    if (!username) {
      return NextResponse.json({ success: false, error: 'username이 필요합니다.' }, { status: 400 });
    }

    // username으로 사용자 검색
    const userResult = await query(
      `SELECT id, username, display_name FROM users WHERE username = $1`,
      [username]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const targetUserId = userResult.rows[0].id;

    // 이미 멤버인지 확인
    const memberCheck = await query(
      `SELECT 1 FROM folder_members WHERE folder_id = $1 AND user_id = $2`,
      [folderId, targetUserId]
    );
    if (memberCheck.rows.length > 0) {
      return NextResponse.json({ success: false, error: '이미 멤버입니다.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const memberRole = role || 'viewer';

    await query(
      `INSERT INTO folder_members (folder_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4)`,
      [folderId, targetUserId, memberRole, now]
    );

    return NextResponse.json({
      success: true,
      data: {
        folder_id: folderId,
        user_id: targetUserId,
        username: userResult.rows[0].username,
        display_name: userResult.rows[0].display_name,
        role: memberRole,
        created_at: now,
      },
    });
  } catch (error) {
    console.error('[Folder Members POST] Error:', error);
    return NextResponse.json({ success: false, error: '멤버 추가 실패' }, { status: 500 });
  }
}

// DELETE - 멤버 제거 (owner만, 자기 자신 제거 불가)
export async function DELETE(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const folderId = getFolderIdFromUrl(request);
    if (!folderId) {
      return NextResponse.json({ success: false, error: '폴더 ID가 필요합니다.' }, { status: 400 });
    }

    // owner 확인
    if (!(await isFolderOwner(folderId, userId))) {
      return NextResponse.json({ success: false, error: '멤버 제거 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId: targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'userId가 필요합니다.' }, { status: 400 });
    }

    // owner 자신 제거 방지
    if (targetUserId === userId) {
      return NextResponse.json({ success: false, error: '폴더 소유자는 제거할 수 없습니다.' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM folder_members WHERE folder_id = $1 AND user_id = $2`,
      [folderId, targetUserId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Folder Members DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '멤버 제거 실패' }, { status: 500 });
  }
}
