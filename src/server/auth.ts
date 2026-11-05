import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { AdminRequest, CustomerRequest } from "./types.js";

const cookieName = "goodthings_admin";
const customerCookieName = "goodthings_customer";

export function hasConfiguredJwtSecret(): boolean {
  const secret = process.env.JWT_SECRET;
  return Boolean(secret && secret.length >= 32 && !secret.toLowerCase().includes("replace-with"));
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!hasConfiguredJwtSecret() || !secret) {
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

export function issueCustomerCookie(customerId: string, response: Response): void {
  const token = jwt.sign(
    { sub: customerId, type: "customer" },
    jwtSecret(),
    { expiresIn: "30d" },
  );
  response.cookie(customerCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/customer",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearCustomerCookie(response: Response): void {
  response.clearCookie(customerCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/customer",
  });
}

export function requireCustomer(
  request: CustomerRequest,
  response: Response,
  next: NextFunction,
): void {
  const token = request.cookies?.[customerCookieName];
  if (typeof token !== "string") {
    response.status(401).json({ error: "Customer sign-in required." });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      payload.type !== "customer"
    ) {
      response.status(401).json({ error: "Customer session is invalid." });
      return;
    }
    request.customerId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ error: "Customer session has expired. Please sign in again." });
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
