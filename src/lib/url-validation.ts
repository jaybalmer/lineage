/**
 * SSRF protection — block requests to private/reserved IP ranges.
 * Returns { valid: true } for safe URLs, { valid: false, error } for blocked ones.
 */
export function validateFetchUrl(url: string): { valid: true } | { valid: false; error: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, error: "Invalid URL" }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http and https URLs are allowed" }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost and loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  ) {
    return { valid: false, error: "URL resolves to a private address" }
  }

  // Block link-local (169.254.x.x, fe80::/10)
  if (hostname.startsWith("169.254.") || hostname.startsWith("fe80")) {
    return { valid: false, error: "URL resolves to a private address" }
  }

  // Block private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
  const privateIPv4 = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/
  if (privateIPv4.test(hostname)) {
    return { valid: false, error: "URL resolves to a private address" }
  }

  // Block internal metadata endpoints
  if (hostname === "metadata.google.internal" || hostname === "169.254.169.254") {
    return { valid: false, error: "URL resolves to a private address" }
  }

  return { valid: true }
}
