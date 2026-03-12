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

// GET - 사용자 검색 (공유용)
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ success: false, error: '검색어가 필요합니다.' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, username, display_name FROM users
       WHERE username ILIKE '%' || $1 || '%' AND id != $2
       LIMIT 10`,
      [q.trim(), userId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Users Search GET] Error:', error);
    return NextResponse.json({ success: false, error: '사용자 검색 실패' }, { status: 500 });
  }
}
