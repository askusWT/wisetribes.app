import crypto from "crypto";

const encode = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

export function getCredentials() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required");
  return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

export async function getAccessToken(scope = "https://www.googleapis.com/auth/spreadsheets") {
  const credentials = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: credentials.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }) });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
  return (await response.json()).access_token;
}

export async function sheetsRequest(path, { method = "GET", body, scope } = {}) {
  const token = await getAccessToken(scope);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Google Sheets request failed (${response.status}): ${await response.text()}`);
  return response.json();
}
