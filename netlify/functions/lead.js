/**
 * Netlify Function: lead (Phase 1 stub - no Airtable yet)
 *
 * POST JSON:
 * { name, email, segment?, revenue_range?, marketing_consent }
 *
 * Responses:
 * - 200: { ok: true }
 * - 400: { ok: false, fieldErrors: {...}, message: "..." }
 */

const emailLooksValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const allowedRevenueRanges = new Set(["< 1.500", "1.500 - 5.000", "5.000 +"]);

export async function handler(event) {
  // DEV-only: force server error for UX testing (not shown in UI)
  if (event.headers?.["x-force-error"] === "1") {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, message: "Internal server error (forced)" }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, message: "Method not allowed" }),
    };
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        fieldErrors: {},
        message: "Invalid JSON payload",
      }),
    };
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const marketingConsent = payload.marketing_consent === true;
  const revenueRange =
    typeof payload.revenue_range === "string" ? payload.revenue_range.trim() : "";

  const fieldErrors = {};
  if (!name) fieldErrors.name = "Bitte gib deinen Namen an.";
  if (!email || !emailLooksValid(email)) fieldErrors.email = "Bitte gib eine gültige Email an.";
  if (!marketingConsent)
    fieldErrors.marketing_consent = "Bitte bestätige dein Einverständnis.";
  if (revenueRange && !allowedRevenueRanges.has(revenueRange)) {
    fieldErrors.revenue_range = "Bitte wähle eine gültige Option.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        fieldErrors,
        message: "Bitte überprüfe deine Eingaben.",
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
}

