import { sheetsRequest } from "../../lib/google";
import { hasValidAccess } from "../../lib/auth";

const MAX_LENGTH = 5000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!hasValidAccess(req)) {
    return res.status(401).json({ error: "Please open the board before adding a note." });
  }
  if (req.body?.website) return res.status(200).json({ ok: true });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "Add a note before sending." });
  if (text.length > MAX_LENGTH) return res.status(400).json({ error: "Please keep the note under 5,000 characters." });

  try {
    await sheetsRequest(`/values/${encodeURIComponent("Inbox!A:E")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: { values: [[new Date().toISOString(), text, "status-board", "unprocessed", ""]] } });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Inbox append failed", error instanceof Error ? error.message : error);
    return res.status(503).json({ error: "The note could not be saved just now. Nothing was changed; please try again shortly." });
  }
}
