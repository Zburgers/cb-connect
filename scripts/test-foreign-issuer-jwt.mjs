import { generateKeyPairSync, randomUUID, sign, verify } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const deploymentUrl = process.env.NEXT_PUBLIC_TEST_CONVEX_URL;
if (deploymentUrl !== "https://hallowed-hummingbird-284.convex.cloud") {
  throw new Error("Foreign issuer check is restricted to the approved test Convex deployment");
}

const base64url = (value) => Buffer.from(value).toString("base64url");
const encode = (value) => base64url(JSON.stringify(value));
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const now = Math.floor(Date.now() / 1000);
const signingInput = `${encode({ alg: "RS256", typ: "JWT", kid: "ephemeral-gate5-check" })}.${encode({
  iss: "https://gate5-foreign-issuer.invalid",
  sub: `synthetic-${randomUUID()}`,
  aud: "convex",
  iat: now,
  nbf: now - 2,
  exp: now + 180,
})}`;
const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
if (!verify("RSA-SHA256", Buffer.from(signingInput), publicKey, signature)) {
  throw new Error("Ephemeral JWT signature self-check failed");
}

const client = new ConvexHttpClient(deploymentUrl);
client.setAuth(`${signingInput}.${base64url(signature)}`);
try {
  await client.query(makeFunctionReference("queries/capabilities:getCapabilities"), {});
  throw new Error("Protected query accepted an unconfigured synthetic issuer");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/NoAuthProvider|Authentication required|Unauthenticated/i.test(message)) throw error;
  console.log("PASS: approved test deployment rejected the locally signature-verified synthetic foreign issuer");
}
