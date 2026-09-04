import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("session_token");
  const { pathname } = request.nextUrl;

  // Jika mencoba akses /dashboard atau /import-data tapi belum login, lempar ke /login
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/import-data")) && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Jika sudah login tapi malah mau buka halaman /login, lempar balik ke /dashboard
  if (pathname === "/login" && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Tentukan halaman mana saja yang dipantau oleh middleware ini
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/import-data"],
};