import type { Request } from "express";

export interface AdminRequest extends Request {
  adminId?: string;
}

export interface CheckoutItemInput {
  variantId: string;
  quantity: number;
}
