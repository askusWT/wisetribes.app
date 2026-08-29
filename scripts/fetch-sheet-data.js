const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const schema = require("./sheet-schema");

const output = path.join(process.cwd(), "generated", "board-data.json");
const splitList = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
const bool = value => /^(true|yes|1|done)$/i.test(String(value || ""));
const records = values => {
  const [headers = [], ...rows] = values || [];
  return rows.filter(row => row.some(cell => String(cell).trim())).map(row =>
    Object.fromEntries(headers.map((header, index) => [String(header).trim(), row[index] ?? ""]))
  );
};

function transform(tabs) {
  const meta = Object.fromEntries(records(tabs.Meta).map(row => [row.key, row.value]));
  const cp = records(tabs.CurrentPriority)[0] || {};
  return {
    meta: {
      title: meta.title || "Household relocation",
      subtitle: meta.subtitle || "",
      targetDate: meta.target_date || "",
      updated: meta.last_updated || "",
      note: meta.note || ""
    },
    ladder: records(tabs.Ladder).map(row => ({ ...row, order: Number(row.order) || 0 })).sort((a, b) => a.order - b.order),
    currentPriority: { headline: cp.headline || "", rationale: cp.rationale || "", subtasks: splitList(cp.subtasks), deferred: splitList(cp.explicitly_deferred_items) },
    urgent: records(tabs.Urgent),
    backlog: records(tabs.Backlog).filter(row => row.status === "open"),
    workstreams: records(tabs.Workstreams).map(row => ({ ...row, done: bool(row.done), sort_order: Number(row.sort_order) || 0 })).sort((a, b) => a.sort_order - b.sort_order),
    decisions: records(tabs.Decisions),
    costs: records(tabs.Costs),
    log: records(tabs.Log).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
  };
}

async function main() {
  const missingGoogleCredentials = !process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const mayUseSampleData = process.env.ALLOW_SAMPLE_DATA === "true" || process.env.VERCEL_ENV === "preview";

  if (missingGoogleCredentials && mayUseSampleData) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), "data", "sample.json"), output);
    console.warn(
      process.env.VERCEL_ENV === "preview" && process.env.ALLOW_SAMPLE_DATA !== "true"
        ? "Built this Vercel preview with sample data because Google Sheets credentials are unavailable."
        : "Built with sample data because ALLOW_SAMPLE_DATA=true."
    );
    return;
  }
  if (missingGoogleCredentials) {
    throw new Error("GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON are required (or set ALLOW_SAMPLE_DATA=true for local development only).");
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000); const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${enc({alg:"RS256",typ:"JWT"})}.${enc({iss:credentials.client_email,scope:"https://www.googleapis.com/auth/spreadsheets.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})}`;
  const assertion = `${unsigned}.${crypto.sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url")}`;
  const authResponse = await fetch("https://oauth2.googleapis.com/token", {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  if (!authResponse.ok) throw new Error(`Google authentication failed (${authResponse.status})`); const token = (await authResponse.json()).access_token;
  const names = Object.keys(schema).filter(name => name !== "Inbox");
  const query = names.map(name => `ranges=${encodeURIComponent(`${name}!A:Z`)}`).join("&");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values:batchGet?${query}`, {headers:{Authorization:`Bearer ${token}`}});
  if (!response.ok) throw new Error(`Google Sheets read failed (${response.status})`); const payload = await response.json();
  const tabs = Object.fromEntries(names.map((name, index) => [name, payload.valueRanges?.[index]?.values || []]));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(transform(tabs), null, 2)}\n`);
  console.log(`Generated board data from ${names.length} sheet tabs.`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
