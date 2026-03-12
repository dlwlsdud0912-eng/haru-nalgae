import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_SECRET_KEY || 'haru-nalgae-default-secret';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/api/auth/login',
  '/api/auth/signup',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일, _next, favicon 등 무시
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 공개 경로는 인증 불필요
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    // /api/auth/* 전체 허용
    if (pathname.startsWith('/api/auth/')) return NextResponse.next();
    // 페이지는 그대로 통과
    if (!pathname.startsWith('/api/')) return NextResponse.next();
  }

  // JWT 토큰 확인
  const token = request.cookies.get('haru-token')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/app/:path*', '/settings/:path*', '/api/:path*'],
};
