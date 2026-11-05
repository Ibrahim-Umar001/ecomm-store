import { z } from "zod";

export const checkoutSchema = z.object({
  email: z.email().max(254),
  phone: z.string().trim().min(7).max(30),
  fullName: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(3).max(180),
  addressLine2: z.string().trim().max(180).optional().default(""),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(80),
  paymentMethod: z.enum(["cod", "stripe"]),
  items: z.array(
    z.object({
      variantId: z.cuid(),
      quantity: z.number().int().min(1).max(20),
    }),
  ).min(1).max(30),
});

export const productSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(80),
  image: z.string().trim().min(1).max(1000),
  imageAlt: z.string().trim().min(5).max(240),
  badge: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().optional().default(true),
  variants: z.array(z.object({
    id: z.cuid().optional(),
    sku: z.string().trim().min(2).max(80),
    name: z.string().trim().min(1).max(80),
    color: z.string().trim().min(1).max(40).nullable().optional(),
    size: z.string().trim().min(1).max(40).nullable().optional(),
    priceCents: z.number().int().min(1).max(10_000_000),
    stock: z.number().int().min(0).max(1_000_000),
  })).min(1).max(40),
});

export const orderStatusSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
});

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })));
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(public readonly issues: { field: string; message: string }[]) {
    super("Request validation failed.");
    this.name = "ValidationError";
  }
}
