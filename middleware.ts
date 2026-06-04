import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod'
  );

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/manager/dashboard')) {
    const token = request.cookies.get('manager_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/manager', request.url));
    }

    try {
      await jwtVerify(token, getSecret());
    } catch {
      const response = NextResponse.redirect(new URL('/manager', request.url));
      response.cookies.delete('manager_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/manager/dashboard/:path*'],
};
