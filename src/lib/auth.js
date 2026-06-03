import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function cookieOptions() {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  const opts = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE === "none" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/",
  };
  // domain vazio ou de outro site quebra Set-Cookie ("option domain is invalid")
  if (domain) opts.domain = domain;
  return opts;
}

export function setAuthCookie(res, token) {
  res.cookie("token", token, cookieOptions());
}
export function clearAuthCookie(res) {
  res.clearCookie("token", cookieOptions());
}
