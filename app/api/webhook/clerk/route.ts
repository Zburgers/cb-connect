export async function POST(req: Request) {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    console.error("Missing NEXT_PUBLIC_CONVEX_SITE_URL");
    return new Response("Server configuration error", { status: 500 });
  }

  const body = await req.text();
  const forwardedHeaders = new Headers();
  for (const name of [
    "content-type",
    "svix-id",
    "svix-timestamp",
    "svix-signature",
  ]) {
    const value = req.headers.get(name);
    if (value) forwardedHeaders.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(new URL("/webhooks/clerk", convexSiteUrl), {
      method: "POST",
      headers: forwardedHeaders,
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error("Convex webhook relay failed:", err);
    return new Response("Webhook delivery failed", { status: 502 });
  }

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  return new Response(await response.text(), {
    status: response.status,
    headers: responseHeaders,
  });
}
