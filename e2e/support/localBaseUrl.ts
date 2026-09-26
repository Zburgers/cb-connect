const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function resolveLocalBaseUrl(value?: string): string {
  const candidate = value?.trim() || "http://localhost:3000";
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Authenticated browser tests require a local HTTP origin");
  }

  if (
    url.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    !url.port ||
    Number(url.port) === 0 ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Authenticated browser tests require a local HTTP origin");
  }

  return url.origin;
}
