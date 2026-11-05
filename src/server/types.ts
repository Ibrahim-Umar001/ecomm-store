import type { Request } from "express";

export interface AdminRequest extends Request {
  adminId?: string;
}

export interface CustomerRequest extends Request {
  customerId?: string;
}

export interface CheckoutItemInput {
  variantId: string;
  quantity: number;
}
