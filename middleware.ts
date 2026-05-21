import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding"]);
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:6050"];

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeadersForOrigin(origin: string | null) {
  if (!origin || !getAllowedOrigins().includes(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, svix-id, svix-timestamp, svix-signature",
    "Vary": "Origin",
  };
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    try {
      // auth.protect() now returns 401 for unauthenticated server actions.
      // If the call throws due to unauthenticated access, redirect to sign-in.
      await auth.protect();
    } catch (err: any) {
      // Conservative detection: check common status fields or message.
      const status = err?.status || err?.statusCode || err?.code;
      const message = err?.message || '';
      if (status === 401 || /401/.test(String(message))) {
        // Redirect the user to the sign-in page. Use request.url to preserve origin.
        const signInUrl = new URL('/sign-in', request.url);
        return NextResponse.redirect(signInUrl);
      }
      // Re-throw unexpected errors so they surface normally.
      throw err;
    }
  }
  
  // Handle CORS preflight requests only for explicitly allowed origins.
  if (request.method === "OPTIONS") {
    const headers = corsHeadersForOrigin(request.headers.get("origin"));
    if (!headers) {
      return new NextResponse(null, { status: 403 });
    }

    return new NextResponse(null, {
      status: 204,
      headers,
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
