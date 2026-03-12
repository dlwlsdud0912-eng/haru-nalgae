import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, query } from '@/lib/db';
import { signJwt, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const body = await request.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 유저 조회
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const user = result.rows[0] as {
      id: string;
      username: string;
      password_hash: string;
      display_name: string;
    };

    // 비밀번호 확인
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // JWT 발급 & 쿠키 설정
    const token = await signJwt({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });

    response.cookies.set('haru-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
