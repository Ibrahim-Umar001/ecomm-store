import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { AdminRequest } from "./types.js";

const cookieName = "goodthings_admin";

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.toLowerCase().includes("replace-with")) {
    throw new Error("JWT_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

export function issueAdminCookie(adminId: string, response: Response): void {
  const token = jwt.sign({ sub: adminId }, jwtSecret(), { expiresIn: "8h" });
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function clearAdminCookie(response: Response): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
  });
}

export function requireAdmin(
  request: AdminRequest,
  response: Response,
  next: NextFunction,
): void {
  const token = request.cookies?.[cookieName];
  if (typeof token !== "string") {
    response.status(401).json({ error: "Admin login required." });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      response.status(401).json({ error: "Admin session is invalid." });
      return;
    }
    request.adminId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ error: "Admin session has expired. Please sign in again." });
      return;
    }
    next(error);
  }
}

export function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
