import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, query } from '@/lib/db';
import { signJwt, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const body = await request.json();
    const { username, password, displayName } = body as {
      username?: string;
      password?: string;
      displayName?: string;
    };

    // 유효성 검사
    if (!username || !password || !displayName) {
      return NextResponse.json(
        { success: false, error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // username: 2-20자, 영문/한글/숫자/_/-
    const usernameRegex = /^[a-zA-Z0-9가-힣_-]{2,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { success: false, error: '아이디는 2~20자의 영문, 한글, 숫자, _, -만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // password: 최소 4자
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 최소 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 중복 체크
    const existing = await query('SELECT username FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 아이디입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해싱 & 유저 생성
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await query(
      'INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, passwordHash, displayName, now]
    );

    // 기본 카테고리 6개 생성
    const defaultCategories = [
      { name: '업무', colorBg: '#dbeafe', colorText: '#1e3a8a', keywords: '업무,회의,미팅', sortOrder: 0 },
      { name: '개인', colorBg: '#dcfce7', colorText: '#14532d', keywords: '개인', sortOrder: 1 },
      { name: '가족', colorBg: '#fce7f3', colorText: '#831843', keywords: '가족,부모,자녀', sortOrder: 2 },
      { name: '약속', colorBg: '#f3e8ff', colorText: '#581c87', keywords: '약속,만남', sortOrder: 3 },
      { name: '기념일', colorBg: '#fef3c7', colorText: '#78350f', keywords: '기념일,생일,결혼', sortOrder: 4 },
      { name: '기타', colorBg: '#f3f4f6', colorText: '#374151', keywords: '', sortOrder: 5 },
    ];

    for (const cat of defaultCategories) {
      await query(
        'INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, keywords, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [crypto.randomUUID(), userId, cat.name, cat.colorBg, cat.colorText, cat.sortOrder, cat.keywords, now]
      );
    }

    // JWT 발급 & 쿠키 설정
    const token = await signJwt({ userId, username, displayName });

    const response = NextResponse.json({
      success: true,
      data: { id: userId, username, displayName },
    });

    response.cookies.set('haru-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
