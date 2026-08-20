const crypto = require("crypto");
const schema = require("./sheet-schema");

async function token(credentials) {
  const now = Math.floor(Date.now()/1000), enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${enc({alg:"RS256",typ:"JWT"})}.${enc({iss:credentials.client_email,scope:"https://www.googleapis.com/auth/spreadsheets",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})}`;
  const assertion = `${unsigned}.${crypto.sign("RSA-SHA256",Buffer.from(unsigned),credentials.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  if(!response.ok) throw new Error(`Google authentication failed (${response.status})`); return (await response.json()).access_token;
}
async function request(accessToken,path,method="GET",body) {
  const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`,{method,headers:{Authorization:`Bearer ${accessToken}`,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  if(!response.ok) throw new Error(`Sheets request failed (${response.status}): ${await response.text()}`); return response.json();
}
async function main() {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error("Set GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON first.");
  if (process.env.CONFIRM_SHEET_SETUP !== "yes") throw new Error("This command adds missing tabs and replaces their first row. Review docs/SHEET_SCHEMA.md, then set CONFIRM_SHEET_SETUP=yes.");
  const accessToken=await token(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON));
  const info=await request(accessToken,"?fields=sheets.properties"); const existing=new Set(info.sheets.map(sheet=>sheet.properties.title));
  const missing=Object.keys(schema).filter(title=>!existing.has(title));
  if(missing.length) await request(accessToken,":batchUpdate","POST",{requests:missing.map(title=>({addSheet:{properties:{title,frozenRowCount:1}}}))});
  await request(accessToken,"/values:batchUpdate","POST",{valueInputOption:"RAW",data:Object.entries(schema).map(([title,headers])=>({range:`${title}!A1:${String.fromCharCode(64+headers.length)}1`,values:[headers]}))});
  console.log(`Prepared ${Object.keys(schema).length} tabs (${missing.length} created). Existing data rows were retained.`);
}
main().catch(error=>{console.error(error.message);process.exit(1)});
