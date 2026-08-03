import type { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";

export interface SvixHeaders {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
}

export function verifyClerkWebhookPayload(
  rawBody: string,
  secret: string,
  headers: SvixHeaders
): WebhookEvent {
  const webhook = new Webhook(secret);
  return webhook.verify(rawBody, headers) as WebhookEvent;
}
