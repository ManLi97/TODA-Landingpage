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
const allowedSegments = new Set(["", "Solo Artist", "Studio"]);
const allowedRevenueRanges = new Set(["", "< 1500", "1500 - 5000", "5000 +"]);

const normalizeRevenueRange = (value) => {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";

  // Accept legacy frontend formatting (dots as thousands separators)
  const directMap = new Map([
    ["< 1.500", "< 1500"],
    ["1.500 - 5.000", "1500 - 5000"],
    ["5.000 +", "5000 +"],
    ["< 1500", "< 1500"],
    ["1500 - 5000", "1500 - 5000"],
    ["5000 +", "5000 +"],
  ]);
  const mapped = directMap.get(v);
  if (mapped) return mapped;

  // Best-effort normalization: remove dots and normalize separators/spaces
  const noDots = v.replace(/\./g, "");
  return noDots
    .replace(/^<\s*/, "< ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s*\+\s*$/, " +")
    .trim();
};

const escapeAirtableFormulaString = (value) =>
  String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event) {
  // DEV-only: force server error for UX testing (not shown in UI)
  if (event.headers?.["x-force-error"] === "1") {
    return json(500, { ok: false, message: "Internal error" });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Method not allowed" });
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { ok: false, fieldErrors: {}, message: "Invalid JSON payload" });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const emailRaw = typeof payload.email === "string" ? payload.email.trim() : "";
  const email = emailRaw.toLowerCase();
  const marketingConsent = payload.marketing_consent === true;
  const segment = typeof payload.segment === "string" ? payload.segment.trim() : "";
  const revenueRange = normalizeRevenueRange(payload.revenue_range);

  const fieldErrors = {};
  if (!name) fieldErrors.name = "Bitte gib deinen Namen an.";
  if (!email || !emailLooksValid(email)) fieldErrors.email = "Bitte gib eine gültige Email an.";
  if (!marketingConsent)
    fieldErrors.marketing_consent = "Bitte bestätige dein Einverständnis.";
  if (!allowedSegments.has(segment)) {
    fieldErrors.segment = "Bitte wähle eine gültige Option.";
  }
  if (!allowedRevenueRanges.has(revenueRange)) {
    fieldErrors.revenue_range = "Bitte wähle eine gültige Option.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json(400, { ok: false, fieldErrors, message: "Bitte überprüfe deine Eingaben." });
  }

  const baseEnv = process.env.AIRTABLE_BASE_ID || "";
  const tableEnv = process.env.AIRTABLE_TABLE_NAME || "";
  const token = process.env.AIRTABLE_TOKEN || "";

  let baseId = baseEnv;
  let tableIdOrName = tableEnv;

  // Allow a combined env var like "appXXXX/tblYYYY" (common when copying IDs)
  if (baseEnv.includes("/")) {
    const [b, t] = baseEnv.split("/");
    baseId = b || baseId;
    if (!tableIdOrName) tableIdOrName = t || tableIdOrName;
  }

  if (!baseId || !tableIdOrName || !token) {
    console.error("Missing Airtable env vars", {
      hasToken: !!token,
      hasBaseId: !!baseId,
      hasTable: !!tableIdOrName,
    });
    return json(500, { ok: false, message: "Internal error" });
  }

  const baseUrl = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(
    tableIdOrName
  )}`;

  const consentTimestamp = new Date().toISOString(); // UTC
  const fields = {
    email,
    name,
    segment: segment || "",
    revenue_range: revenueRange || "",
    marketing_consent: true,
    consent_timestamp: consentTimestamp,
  };

  try {
    // Upsert by email
    const formula = `{email} = '${escapeAirtableFormulaString(email)}'`;
    const queryUrl = `${baseUrl}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=2`;

    const queryRes = await fetch(queryUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const queryJson = await queryRes.json().catch(() => null);
    if (!queryRes.ok) {
      console.error("Airtable query failed", {
        status: queryRes.status,
        message: queryJson?.error?.message || queryJson?.message,
      });
      return json(500, { ok: false, message: "Internal error" });
    }

    const records = Array.isArray(queryJson?.records) ? queryJson.records : [];
    if (records.length > 1) {
      console.warn("Multiple Airtable matches for email; updating first", { email });
    }

    if (records.length > 0 && records[0]?.id) {
      const recordId = records[0].id;
      const updateRes = await fetch(`${baseUrl}/${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ fields }),
      });

      const updateJson = await updateRes.json().catch(() => null);
      if (!updateRes.ok) {
        console.error("Airtable update failed", {
          status: updateRes.status,
          message: updateJson?.error?.message || updateJson?.message,
        });
        return json(500, { ok: false, message: "Internal error" });
      }
    } else {
      const createRes = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }] }),
      });

      const createJson = await createRes.json().catch(() => null);
      if (!createRes.ok) {
        console.error("Airtable create failed", {
          status: createRes.status,
          message: createJson?.error?.message || createJson?.message,
        });
        return json(500, { ok: false, message: "Internal error" });
      }
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("Unexpected lead function error", err);
    return json(500, { ok: false, message: "Internal error" });
  }
}

