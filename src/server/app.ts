import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import Stripe from "stripe";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  clearAdminCookie,
  clearCustomerCookie,
  hasConfiguredJwtSecret,
  issueAdminCookie,
  issueCustomerCookie,
  requireAdmin,
  requireCustomer,
} from "./auth.js";
import { prisma } from "./db.js";
import {
  checkoutSchema,
  orderStatusSchema,
  parseBody,
  productSchema,
  ValidationError,
} from "./validation.js";
import type { AdminRequest, CustomerRequest } from "./types.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const webUrl = process.env.WEB_URL ?? "http://localhost:5173";
const stripeSecret = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeSecret.startsWith("sk_test_")
  ? new Stripe(stripeSecret)
  : null;
const uploadDirectory = path.resolve(
  process.env.UPLOADS_DIRECTORY ?? path.join(process.cwd(), "uploads"),
);
const deliveryFeeCents = 800;
const freeDeliveryThresholdCents = 7500;

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(cookieParser());
app.use("/uploads", express.static(uploadDirectory, { maxAge: "1d" }));

function orderNumber(): string {
  return `GT-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function centsToPrice(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function publicProduct(product: {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  image: string;
  imageAlt: string;
  badge: string | null;
  variants: {
    id: string;
    sku: string;
    name: string;
    color: string | null;
    size: string | null;
    priceCents: number;
    stock: number;
  }[];
}) {
  const sortedVariants = [...product.variants].sort((a, b) => {
    if (a.name === "Standard") return b.name === "Standard" ? 0 : -1;
    if (b.name === "Standard") return 1;
    return a.name.localeCompare(b.name);
  });
  return {
    ...product,
    variants: sortedVariants.map((variant) => ({
      ...variant,
      price: centsToPrice(variant.priceCents),
      inStock: variant.stock > 0,
    })),
    price: sortedVariants.length
      ? centsToPrice(Math.min(...sortedVariants.map((variant) => variant.priceCents)))
      : 0,
    inStock: sortedVariants.some((variant) => variant.stock > 0),
  };
}

async function releaseOrderStock(
  transaction: Prisma.TransactionClient,
  orderId: string,
  nextStatus: string,
  paymentStatus: string,
): Promise<void> {
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "pending") return;

  for (const item of order.items) {
    await transaction.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { increment: item.quantity } },
    });
  }
  await transaction.order.update({
    where: { id: orderId },
    data: { status: nextStatus, paymentStatus, expiresAt: null },
  });
}

async function expirePendingOrders(): Promise<void> {
  const expired = await prisma.order.findMany({
    where: {
      status: "pending",
      paymentMethod: "stripe",
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
    take: 100,
  });
  for (const order of expired) {
    await prisma.$transaction((transaction) =>
      releaseOrderStock(transaction, order.id, "cancelled", "expired"),
    );
  }
}

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (request, response, next) => {
    const signature = request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret || typeof signature !== "string") {
      response.status(503).json({ error: "Stripe test webhook is not configured." });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.body, signature, webhookSecret);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? `Invalid webhook signature: ${error.message}` : "Invalid webhook signature.",
      });
      return;
    }

    try {
      await prisma.$transaction(async (transaction) => {
        const alreadyProcessed = await transaction.paymentEvent.findUnique({
          where: { stripeEventId: event.id },
        });
        if (alreadyProcessed) return;

        const session = event.type.startsWith("checkout.session.")
          ? (event.data.object as Stripe.Checkout.Session)
          : null;
        const orderId = session?.client_reference_id;

        if (orderId && event.type === "checkout.session.completed" && session?.payment_status === "paid") {
          await transaction.order.updateMany({
            where: { id: orderId, status: "pending", paymentMethod: "stripe" },
            data: { status: "processing", paymentStatus: "paid", expiresAt: null },
          });
        } else if (
          orderId &&
          (event.type === "checkout.session.expired" ||
            event.type === "checkout.session.async_payment_failed")
        ) {
          await releaseOrderStock(
            transaction,
            orderId,
            "cancelled",
            event.type === "checkout.session.expired" ? "expired" : "failed",
          );
        }

        await transaction.paymentEvent.create({
          data: { stripeEventId: event.id, eventType: event.type },
        });
      });
      response.json({ received: true });
    } catch (error) {
      next(error);
    }
  },
);

app.use(express.json({ limit: "100kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
});

app.post("/api/customer/register", loginLimiter, async (request, response, next) => {
  try {
    if (!hasConfiguredJwtSecret()) {
      response.status(503).json({ error: "Customer accounts are unavailable until JWT_SECRET is configured." });
      return;
    }
    const input = z.object({
      name: z.string().trim().min(2).max(120),
      email: z.email().max(254),
      password: z.string().min(8).max(72),
    }).parse(request.body);
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      response.status(409).json({ error: "An account with this email already exists. Sign in instead." });
      return;
    }

    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
      select: { id: true, name: true, email: true },
    });
    issueCustomerCookie(customer.id, response);
    response.status(201).json({
      customer: { name: customer.name, email: customer.email },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customer/login", loginLimiter, async (request, response, next) => {
  try {
    if (!hasConfiguredJwtSecret()) {
      response.status(503).json({ error: "Customer accounts are unavailable until JWT_SECRET is configured." });
      return;
    }
    const input = z.object({
      email: z.email().max(254),
      password: z.string().min(1).max(72),
    }).parse(request.body);
    const customer = await prisma.customer.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!customer || !(await bcrypt.compare(input.password, customer.passwordHash))) {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    issueCustomerCookie(customer.id, response);
    response.json({ customer: { name: customer.name, email: customer.email } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/customer/me", requireCustomer, async (request: CustomerRequest, response, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: request.customerId },
      select: { name: true, email: true },
    });
    if (!customer) {
      clearCustomerCookie(response);
      response.status(401).json({ error: "Customer account no longer exists." });
      return;
    }
    response.json({ customer });
  } catch (error) {
    next(error);
  }
});

app.post("/api/customer/logout", (_request, response) => {
  clearCustomerCookie(response);
  response.status(204).end();
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", payments: stripe ? "test-mode" : "not-configured" });
});

app.get("/api/categories", async (_request, response, next) => {
  try {
    const categories = await prisma.product.findMany({
      where: { active: true },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    response.json(categories.map((entry) => entry.category));
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (request, response, next) => {
  try {
    const query = z.object({
      search: z.string().max(120).optional().default(""),
      category: z.string().max(80).optional(),
      sort: z.enum(["featured", "price-low", "price-high"]).optional().default("featured"),
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(24).optional().default(8),
      minPrice: z.coerce.number().min(0).optional(),
      maxPrice: z.coerce.number().min(0).optional(),
    }).parse(request.query);
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      response.status(400).json({ error: "Minimum price cannot exceed maximum price." });
      return;
    }
    const where = {
      active: true,
      ...(query.category && query.category !== "Everything"
        ? { category: query.category }
        : {}),
      ...(query.search
        ? { OR: [
            { name: { contains: query.search } },
            { description: { contains: query.search } },
            { category: { contains: query.search } },
          ] }
        : {}),
    };
    const rows = await prisma.product.findMany({
      where,
      include: { variants: { orderBy: { name: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    let result = rows
      .map(publicProduct)
      .filter((product) =>
        (query.minPrice === undefined || product.price >= query.minPrice) &&
        (query.maxPrice === undefined || product.price <= query.maxPrice),
      );
    if (query.sort === "price-low") result = result.sort((a, b) => a.price - b.price);
    if (query.sort === "price-high") result = result.sort((a, b) => b.price - a.price);
    const total = result.length;
    result = result.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    response.json({
      products: result,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:slug", async (request, response, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { slug: request.params.slug, active: true },
      include: { variants: { orderBy: { name: "asc" } } },
    });
    if (!product) {
      response.status(404).json({ error: "That product could not be found." });
      return;
    }
    response.json(publicProduct(product));
  } catch (error) {
    next(error);
  }
});

app.post("/api/cart/quote", async (request, response, next) => {
  try {
    const input = z.object({
      items: z.array(z.object({
        variantId: z.cuid(),
        quantity: z.number().int().min(1).max(20),
      })).min(1).max(30),
    }).parse(request.body);
    const quantityByVariant = new Map<string, number>();
    for (const item of input.items) {
      quantityByVariant.set(
        item.variantId,
        (quantityByVariant.get(item.variantId) ?? 0) + item.quantity,
      );
    }
    const items = [...quantityByVariant].map(([variantId, quantity]) => ({ variantId, quantity }));
    if (items.some((item) => item.quantity > 20)) {
      response.status(400).json({ error: "A maximum of 20 of each variant can be ordered." });
      return;
    }
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: items.map((item) => item.variantId) }, product: { active: true } },
      include: { product: true },
    });
    if (variants.length !== items.length) {
      response.status(400).json({ error: "One or more selected variants are unavailable." });
      return;
    }
    const quotedItems = items.map((item) => {
      const variant = variants.find((entry) => entry.id === item.variantId);
      if (!variant) throw new Error("Selected product variant could not be loaded.");
      return {
        variantId: variant.id,
        productId: variant.productId,
        productSlug: variant.product.slug,
        productName: variant.product.name,
        productImage: variant.product.image,
        variantName: variant.name,
        sku: variant.sku,
        price: centsToPrice(variant.priceCents),
        quantity: item.quantity,
        stock: variant.stock,
        available: variant.stock >= item.quantity,
      };
    });
    const subtotalCents = variants.reduce((sum, variant) => {
      const item = items.find((entry) => entry.variantId === variant.id);
      return sum + variant.priceCents * (item?.quantity ?? 0);
    }, 0);
    const deliveryCents = subtotalCents >= freeDeliveryThresholdCents ? 0 : deliveryFeeCents;
    response.json({
      items: quotedItems,
      subtotal: centsToPrice(subtotalCents),
      delivery: centsToPrice(deliveryCents),
      total: centsToPrice(subtotalCents + deliveryCents),
      inStock: quotedItems.every((item) => item.available),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (request, response, next) => {
  try {
    const input = parseBody(checkoutSchema, request.body);
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    }
    const items = [...quantities].map(([variantId, quantity]) => ({ variantId, quantity }));
    if (items.some((item) => item.quantity > 20)) {
      response.status(400).json({ error: "A maximum of 20 of each variant can be ordered." });
      return;
    }
    if (input.paymentMethod === "stripe" && !stripe) {
      response.status(503).json({
        error: "Stripe test checkout is not configured. Set a test-mode STRIPE_SECRET_KEY.",
      });
      return;
    }

    await expirePendingOrders();
    const created = await prisma.$transaction(async (transaction) => {
      const variants = await transaction.productVariant.findMany({
        where: { id: { in: items.map((item) => item.variantId) }, product: { active: true } },
        include: { product: true },
      });
      if (variants.length !== items.length) {
        throw new ValidationError([{ field: "items", message: "One or more selected variants are unavailable." }]);
      }

      const pricedItems = items.map((item) => {
        const variant = variants.find((entry) => entry.id === item.variantId);
        if (!variant) throw new Error("Selected product variant could not be loaded.");
        return { ...item, variant, lineTotalCents: variant.priceCents * item.quantity };
      });
      const subtotalCents = pricedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
      const deliveryCents = subtotalCents >= freeDeliveryThresholdCents ? 0 : deliveryFeeCents;
      const now = new Date();
      const order = await transaction.order.create({
        data: {
          orderNumber: orderNumber(),
          email: input.email.toLowerCase(),
          phone: input.phone,
          fullName: input.fullName,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || null,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          country: input.country,
          subtotalCents,
          deliveryCents,
          totalCents: subtotalCents + deliveryCents,
          status: input.paymentMethod === "cod" ? "processing" : "pending",
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === "cod" ? "unpaid" : "pending",
          expiresAt: input.paymentMethod === "stripe" ? new Date(now.getTime() + 30 * 60 * 1000) : null,
          items: {
            create: pricedItems.map((item) => ({
              variantId: item.variant.id,
              productName: item.variant.product.name,
              variantName: item.variant.name,
              sku: item.variant.sku,
              unitPriceCents: item.variant.priceCents,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of pricedItems) {
        const reservation = await transaction.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (reservation.count !== 1) {
          throw new ValidationError([{
            field: "items",
            message: `${item.variant.product.name} (${item.variant.name}) has insufficient stock.`,
          }]);
        }
      }
      return order;
    });

    if (input.paymentMethod === "cod") {
      response.status(201).json({
        orderNumber: created.orderNumber,
        status: created.status,
        paymentStatus: created.paymentStatus,
        subtotal: centsToPrice(created.subtotalCents),
        delivery: centsToPrice(created.deliveryCents),
        total: centsToPrice(created.totalCents),
      });
      return;
    }

    try {
      const session = await stripe!.checkout.sessions.create({
        mode: "payment",
        client_reference_id: created.id,
        customer_email: input.email,
        success_url: `${webUrl}/order-confirmation?order=${encodeURIComponent(created.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${webUrl}/checkout?cancelled=1&order=${encodeURIComponent(created.orderNumber)}`,
        expires_at: Math.floor((Date.now() + 30 * 60 * 1000) / 1000),
        line_items: [
          ...created.items.map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: "usd",
              unit_amount: item.unitPriceCents,
              product_data: { name: `${item.productName} — ${item.variantName}` },
            },
          })),
          ...(created.deliveryCents > 0
            ? [{
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: created.deliveryCents,
                  product_data: { name: "Delivery" },
                },
              }]
            : []),
        ],
        metadata: { orderNumber: created.orderNumber },
      });
      await prisma.order.update({
        where: { id: created.id },
        data: { stripeCheckoutSessionId: session.id },
      });
      response.status(201).json({
        orderNumber: created.orderNumber,
        checkoutUrl: session.url,
        total: centsToPrice(created.totalCents),
      });
    } catch (error) {
      await prisma.$transaction((transaction) =>
        releaseOrderStock(transaction, created.id, "cancelled", "failed"),
      );
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:orderNumber", async (request, response, next) => {
  try {
    const query = z.object({
      contact: z.string().trim().min(7).max(254).optional(),
      sessionId: z.string().optional(),
    }).parse(request.query);
    if (!query.contact && !query.sessionId) {
      response.status(400).json({ error: "Provide the checkout email/phone or the Stripe session." });
      return;
    }
    const order = await prisma.order.findUnique({
      where: { orderNumber: request.params.orderNumber },
      include: { items: true },
    });
    if (!order) {
      response.status(404).json({ error: "We couldn't find an order with those details." });
      return;
    }
    const contactMatches =
      query.contact?.toLowerCase() === order.email.toLowerCase() ||
      Boolean(query.contact && query.contact.replace(/\D/g, "") === order.phone.replace(/\D/g, ""));
    let sessionMatches = false;
    if (query.sessionId && order.stripeCheckoutSessionId && stripe) {
      const session = await stripe.checkout.sessions.retrieve(query.sessionId);
      sessionMatches =
        session.id === order.stripeCheckoutSessionId &&
        session.client_reference_id === order.id;
    }
    if (!contactMatches && !sessionMatches) {
      response.status(404).json({ error: "We couldn't find an order with those details." });
      return;
    }
    response.json({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      subtotal: centsToPrice(order.subtotalCents),
      delivery: centsToPrice(order.deliveryCents),
      total: centsToPrice(order.totalCents),
      items: order.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: centsToPrice(item.unitPriceCents),
      })),
    });
  } catch (error) {
    next(error);
  }
});

const admin = express.Router();
admin.post("/login", loginLimiter, async (request, response, next) => {
  try {
    const input = z.object({
      email: z.email().max(254),
      password: z.string().min(1).max(200),
    }).parse(request.body);
    const user = await prisma.adminUser.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be set to at least 32 characters.");
    }
    issueAdminCookie(user.id, response);
    response.json({ email: user.email });
  } catch (error) {
    next(error);
  }
});

admin.post("/logout", (_request, response) => {
  clearAdminCookie(response);
  response.status(204).end();
});

admin.get("/me", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: request.adminId },
      select: { email: true },
    });
    if (!user) {
      clearAdminCookie(response);
      response.status(401).json({ error: "Admin account no longer exists." });
      return;
    }
    response.json(user);
  } catch (error) {
    next(error);
  }
});

admin.get("/dashboard", requireAdmin, async (_request, response, next) => {
  try {
    await expirePendingOrders();
    const [products, orders, paidSales, topProducts, recentOrders] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { paymentStatus: "paid" },
        _sum: { totalCents: true },
      }),
      prisma.orderItem.groupBy({
        by: ["productName"],
        where: { order: { paymentStatus: "paid" } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          orderNumber: true,
          fullName: true,
          totalCents: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
    ]);
    response.json({
      productCount: products,
      orderCount: orders,
      sales: centsToPrice(paidSales._sum.totalCents ?? 0),
      topProducts: topProducts.map((item) => ({
        name: item.productName,
        quantity: item._sum.quantity ?? 0,
      })),
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: centsToPrice(order.totalCents),
      })),
    });
  } catch (error) {
    next(error);
  }
});

admin.get("/products", requireAdmin, async (_request, response, next) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: { orderBy: { name: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    response.json(products);
  } catch (error) {
    next(error);
  }
});

admin.post("/products", requireAdmin, async (request, response, next) => {
  try {
    const input = parseBody(productSchema, request.body);
    const product = await prisma.product.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        category: input.category,
        image: input.image,
        imageAlt: input.imageAlt,
        badge: input.badge ?? null,
        active: input.active,
        variants: { create: input.variants.map(({ sku, name, color, size, priceCents, stock }) => ({
          sku,
          name,
          color: color ?? null,
          size: size ?? null,
          priceCents,
          stock,
        })) },
      },
      include: { variants: true },
    });
    response.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

admin.put("/products/:id", requireAdmin, async (request, response, next) => {
  try {
    const productId = request.params.id;
    if (typeof productId !== "string") {
      response.status(400).json({ error: "Product ID is invalid." });
      return;
    }
    const input = parseBody(productSchema, request.body);
    const updated = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.update({
        where: { id: productId },
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          category: input.category,
          image: input.image,
          imageAlt: input.imageAlt,
          badge: input.badge ?? null,
          active: input.active,
        },
      });
      const incomingIds = input.variants.flatMap((variant) => variant.id ? [variant.id] : []);
      const omittedVariants = await transaction.productVariant.findMany({
        where: { productId: product.id, ...(incomingIds.length ? { id: { notIn: incomingIds } } : {}) },
        include: { _count: { select: { orderItems: true } } },
      });
      if (omittedVariants.some((variant) => variant._count.orderItems > 0)) {
        throw new ValidationError([{
          field: "variants",
          message: "A variant referenced by an order cannot be deleted.",
        }]);
      }
      await transaction.productVariant.deleteMany({
        where: { productId: product.id, ...(incomingIds.length ? { id: { notIn: incomingIds } } : {}) },
      });
      for (const variant of input.variants) {
        if (variant.id) {
          await transaction.productVariant.update({
            where: { id: variant.id, productId: product.id },
            data: {
              sku: variant.sku,
              name: variant.name,
              color: variant.color ?? null,
              size: variant.size ?? null,
              priceCents: variant.priceCents,
              stock: variant.stock,
            },
          });
        } else {
          await transaction.productVariant.create({
            data: {
              productId: product.id,
              sku: variant.sku,
              name: variant.name,
              color: variant.color ?? null,
              size: variant.size ?? null,
              priceCents: variant.priceCents,
              stock: variant.stock,
            },
          });
        }
      }
      return transaction.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { variants: true },
      });
    });
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      void mkdir(uploadDirectory, { recursive: true })
        .then(() => callback(null, uploadDirectory))
        .catch((error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error)), uploadDirectory),
        );
    },
    filename: (_request, file, callback) => {
      const extensions: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/avif": ".avif",
      };
      callback(null, `${randomUUID()}${extensions[file.mimetype] ?? ""}`);
    },
  }),
  fileFilter: (_request, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

admin.post("/upload", requireAdmin, upload.single("image"), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "Choose a JPEG, PNG, WebP, or AVIF image under 5 MB." });
    return;
  }
  response.status(201).json({ url: `/uploads/${request.file.filename}` });
});

admin.get("/orders", requireAdmin, async (request, response, next) => {
  try {
    await expirePendingOrders();
    const page = z.coerce.number().int().min(1).default(1).parse(request.query.page);
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 20,
        take: 20,
      }),
      prisma.order.count(),
    ]);
    response.json({
      orders: orders.map((order) => ({
        ...order,
        subtotal: centsToPrice(order.subtotalCents),
        delivery: centsToPrice(order.deliveryCents),
        total: centsToPrice(order.totalCents),
      })),
      page,
      pageCount: Math.ceil(total / 20),
    });
  } catch (error) {
    next(error);
  }
});

admin.patch("/orders/:orderNumber/status", requireAdmin, async (request, response, next) => {
  try {
    const number = request.params.orderNumber;
    if (typeof number !== "string") {
      response.status(400).json({ error: "Order number is invalid." });
      return;
    }
    const input = parseBody(orderStatusSchema, request.body);
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.order.findUnique({
        where: { orderNumber: number },
        include: { items: true },
      });
      if (!existing) throw new ValidationError([{ field: "orderNumber", message: "Order not found." }]);
      if (existing.status === "cancelled") {
        throw new ValidationError([{ field: "status", message: "A cancelled order cannot be changed." }]);
      }
      if (existing.paymentMethod === "stripe" && existing.paymentStatus !== "paid") {
        throw new ValidationError([{
          field: "status",
          message: "Unpaid Stripe orders are managed by verified payment events and expire automatically.",
        }]);
      }
      const allowedTransitions: Record<string, string[]> = {
        processing: ["shipped", "delivered", "cancelled"],
        shipped: ["delivered", "cancelled"],
        delivered: [],
      };
      if (!allowedTransitions[existing.status]?.includes(input.status)) {
        throw new ValidationError([{
          field: "status",
          message: `Order status cannot move from ${existing.status} to ${input.status}.`,
        }]);
      }
      if (input.status === "cancelled") {
        if (existing.paymentStatus === "paid") {
          throw new ValidationError([{
            field: "status",
            message: "Paid orders need to be refunded in Stripe before they can be cancelled.",
          }]);
        }
        if (existing.paymentMethod === "cod" && existing.status !== "cancelled") {
          for (const item of existing.items) {
            await transaction.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }
      return transaction.order.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          ...(input.status === "delivered" && existing.paymentMethod === "cod"
            ? { paymentStatus: "paid" }
            : {}),
          ...(input.status === "cancelled" ? { paymentStatus: "cancelled" } : {}),
        },
      });
    });
    response.json({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/admin", admin);

app.use("/api", (request, response) => {
  response.status(404).json({ error: `No API route for ${request.method} ${request.path}.` });
});
app.use(express.static(path.resolve(process.cwd(), "dist"), { index: false }));
app.use((request, response, next) => {
  if (request.method === "GET" && !request.path.startsWith("/api/")) {
    response.sendFile(path.resolve(process.cwd(), "dist", "index.html"), (error) => {
      if (error) next(error);
    });
    return;
  }
  response.status(404).json({ error: `No route for ${request.method} ${request.path}.` });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  void next;
  if (error instanceof ValidationError) {
    response.status(400).json({ error: error.message, issues: error.issues });
    return;
  }
  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: "Request validation failed.",
      issues: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Images must be smaller than 5 MB."
        : "The image upload could not be processed.",
    });
    return;
  }
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    response.status(409).json({ error: "That product slug, SKU, or email is already in use." });
    return;
  }
  if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
    response.status(404).json({ error: "The requested product or order could not be found." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "The server could not complete the request." });
};

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, () => {
    console.log(`E-commerce API listening on http://localhost:${port}`);
  });
  const expirationSweep = setInterval(() => {
    void expirePendingOrders().catch((error: unknown) => console.error("Could not expire pending orders:", error));
  }, 60_000);
  expirationSweep.unref();
  server.on("close", () => clearInterval(expirationSweep));
}

export { app };
