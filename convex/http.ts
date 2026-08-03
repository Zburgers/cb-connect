import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  verifyClerkWebhookPayload,
  type SvixHeaders,
} from "./_helpers/clerkWebhook";

const http = httpRouter();

http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Missing CLERK_WEBHOOK_SECRET");
      return new Response("Server configuration error", { status: 500 });
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const rawBody = await request.text();
    let event: ReturnType<typeof verifyClerkWebhookPayload>;
    try {
      event = verifyClerkWebhookPayload(rawBody, secret, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      } satisfies SvixHeaders);
    } catch (error) {
      console.error("Webhook verification failed:", error);
      return new Response("Invalid signature", { status: 400 });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } = event.data;
      const email = email_addresses?.[0]?.email_address ?? "";
      const name = [first_name, last_name].filter(Boolean).join(" ") || "User";

      await ctx.runMutation(internal.mutations.users.syncUser, {
        clerkId: id,
        email,
        name,
        imageUrl: image_url ?? undefined,
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
