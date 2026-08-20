import crypto from "crypto";

export const COOKIE_NAME = "move_board_access";

function signature(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to sign access tokens");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createAccessToken() {
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const value = String(expires);
  return `${value}.${signature(value)}`;
}

export function hasValidAccess(req) {
  if (!process.env.SESSION_SECRET) return false;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return false;
  const [expires, supplied] = token.split(".");
  const expected = signature(expires || "");
  if (!expected || !supplied || supplied.length !== expected.length) return false;
  const validSignature = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  return validSignature && Number(expires) > Date.now();
}

export function passcodeMatches(value) {
  const expected = process.env.BOARD_PASSCODE;
  if (!expected || typeof value !== "string") return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
