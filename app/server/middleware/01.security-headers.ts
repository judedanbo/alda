/**
 * Global security response headers.
 *
 * Filename-prefixed `01.` so it runs immediately after `00.security.ts`
 * (the IP-scoped enforcement layer) and before `auth.ts`. Setting headers
 * here means they end up on every response — successes, 4xx, 5xx — because
 * Nitro keeps headers set in middleware when a handler later throws.
 *
 * Notes:
 *
 * - **HSTS** is production-only. Sending it over plaintext HTTP (the dev
 *   default) would poison browsers that later see the same host on HTTPS:
 *   they'd refuse to downgrade for a year. Production must serve over TLS.
 *
 * - **Content-Security-Policy** is shipped in *report-only* mode. The app
 *   relies on inline scripts in two places — the FOUC-prevention block in
 *   `app.vue` and Nuxt's SSR hydration payload — and inline styles in
 *   several. A future change adding nonces to those inline scripts can
 *   tighten the policy and flip the header to `Content-Security-Policy`
 *   (enforce). Until then, report-only surfaces violations without
 *   breaking the UI. Flip with `SECURITY_CSP_ENFORCE=true`.
 *
 * - The middleware never overwrites a header a handler set itself.
 */

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Inline scripts: Nuxt SSR hydration payload (__NUXT__ / __NUXT_DATA__)
  // and the a11y FOUC-prevention block in app.vue. Both run before Vue
  // hydration. Switch to nonces (and drop 'unsafe-inline') when ready.
  "script-src 'self' 'unsafe-inline'",
  // Vue scoped styles and Tailwind v4 emit inline <style> in SSR / dev.
  "style-src 'self' 'unsafe-inline'",
  // MinIO endpoints — dev is http://localhost:9000, prod typically HTTPS.
  // Tightening to the configured MinIO host is a future improvement.
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
].join(", ");

function setIfAbsent(event: Parameters<typeof setResponseHeader>[0], name: string, value: string): void {
  if (!getResponseHeader(event, name)) {
    setResponseHeader(event, name, value);
  }
}

export default defineEventHandler((event) => {
  // Modern browsers honor CSP frame-ancestors over X-Frame-Options, but the
  // legacy header still helps older WebViews and some embedded clients.
  setIfAbsent(event, "X-Frame-Options", "DENY");
  setIfAbsent(event, "X-Content-Type-Options", "nosniff");
  setIfAbsent(event, "Referrer-Policy", "strict-origin-when-cross-origin");
  setIfAbsent(event, "Permissions-Policy", PERMISSIONS_POLICY);
  setIfAbsent(event, "Cross-Origin-Opener-Policy", "same-origin");
  setIfAbsent(event, "X-DNS-Prefetch-Control", "off");

  if (process.env.NODE_ENV === "production") {
    setIfAbsent(event, "Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const enforceCsp = process.env.SECURITY_CSP_ENFORCE === "true";
  const cspHeader = enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
  setIfAbsent(event, cspHeader, CSP_DIRECTIVES);
});
