import { COOKIE_NAME, createAccessToken, passcodeMatches } from "../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!process.env.SESSION_SECRET) {
    console.error("Access gate is unavailable: SESSION_SECRET is not configured.");
    return res.status(500).json({ error: "The board cannot be opened just now. Please try again later." });
  }
  if (!passcodeMatches(req.body?.passcode)) {
    return res.status(401).json({ error: "That passcode did not open the board. Please try again." });
  }
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${createAccessToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`);
  return res.status(200).json({ ok: true });
}
