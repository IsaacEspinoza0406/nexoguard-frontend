import { NextRequest, NextResponse } from 'next/server';
import { contentSecurityPolicy } from './lib/content-security-policy';

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64');
  const policy = contentSecurityPolicy(nonce, process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
