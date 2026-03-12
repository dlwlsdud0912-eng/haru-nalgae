import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, query } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const token = request.cookies.get('haru-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: '인증이 만료되었습니다.' },
        { status: 401 }
      );
    }

    const result = await query(
      'SELECT id, username, display_name FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = result.rows[0] as {
      id: string;
      username: string;
      display_name: string;
    };

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
