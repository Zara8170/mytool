import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/settings"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const needsAuth = PROTECTED_PATHS.some((p) => path.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("mytool_token")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
