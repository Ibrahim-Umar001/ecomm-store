import { randomUUID } from "node:crypto";
import type { AddressInfo, Server } from "node:net";
import bcrypt from "bcryptjs";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "file:./dev.db";
process.env.JWT_SECRET = "test-only-jwt-secret-with-more-than-32-characters";

const adminEmail = "api-tests@goodthings.local";
const adminPassword = "TestOnlyAdminPassword2026!";
const testRunId = randomUUID();
const baseOrder = {
  phone: "+1-202-555-0182",
  fullName: "Test Shopper",
  addressLine1: "12 Garden Street",
  addressLine2: "",
  city: "Portland",
  region: "Oregon",
  postalCode: "97201",
  country: "United States",
  paymentMethod: "cod",
};

let server: Server;
let baseUrl = "";
let cookie = "";
let prisma: typeof import("../src/server/db.js").prisma;
let app: typeof import("../src/server/app.js").app;
let testStartedAt = new Date();
const stockBeforeTests = new Map<string, number>();

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function findVariant(slug = "glass-bottle") {
  const variant = await prisma.productVariant.findFirst({
    where: { product: { slug }, name: "Standard" },
  });
  if (!variant) throw new Error(`Seeded variant for ${slug} is missing.`);
  return variant;
}

async function setStock(variantId: string, stock: number) {
  if (!stockBeforeTests.has(variantId)) {
    const current = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    stockBeforeTests.set(variantId, current.stock);
  }
  await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
}

function testEmail(prefix: string) {
  return `${prefix}-${testRunId}-${randomUUID()}@example.test`;
}

async function placeCodOrder(variantId: string, quantity = 1, email = testEmail("buyer")) {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify({
      ...baseOrder,
      email,
      paymentMethod: "cod",
      items: [{ variantId, quantity }],
    }),
  });
}

describe("e-commerce API", () => {
  beforeAll(async () => {
    testStartedAt = new Date();
    ({ app } = await import("../src/server/app.js"));
    ({ prisma } = await import("../src/server/db.js"));
    const listener = app.listen(0);
    server = listener;
    await new Promise<void>((resolve) => listener.once("listening", resolve));
    const address = listener.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: { passwordHash: await bcrypt.hash(adminPassword, 4) },
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 4),
      },
    });
    const login = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    expect(login.status).toBe(200);
    cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).toContain("goodthings_admin=");
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: {
        email: { contains: `-${testRunId}-` },
        createdAt: { gte: testStartedAt },
      },
    });
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } });
    for (const [variantId, stock] of stockBeforeTests) {
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await prisma.$disconnect();
  });

  it("reports API health and does not enable unconfigured Stripe payments", async () => {
    const response = await request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", payments: "not-configured" });
  });

  it("seeds at least 40 browsable products with variants", async () => {
    const response = await request("/products?page=1&pageSize=8");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.pagination.total).toBeGreaterThanOrEqual(40);
    expect(body.products).toHaveLength(8);
    expect(body.products[0].variants.length).toBeGreaterThan(0);
  });

  it("returns independently stocked sizes for size-specific products", async () => {
    const response = await request("/products/cotton-everyday-tee");
    const product = await response.json();
    expect(response.status).toBe(200);
    expect(product.variants.map((variant: { name: string }) => variant.name)).toEqual([
      "L", "M", "S", "XL", "XS", "XXL",
    ]);
    expect(product.variants.every((variant: { stock: number }) => variant.stock >= 0)).toBe(true);
  });

  it("filters products by search and category", async () => {
    const search = await request("/products?search=water");
    const searchBody = await search.json();
    expect(searchBody.products.some((product: { name: string }) =>
      product.name.toLowerCase().includes("water"),
    )).toBe(true);

    const category = await request("/products?category=Tech");
    const categoryBody = await category.json();
    expect(categoryBody.products.every((product: { category: string }) =>
      product.category === "Tech",
    )).toBe(true);
  });

  it("filters, sorts, and paginates by server-calculated variant prices", async () => {
    const response = await request("/products?sort=price-low&page=1&pageSize=3&minPrice=10&maxPrice=30");
    const body = await response.json();
    const prices = body.products.map((product: { price: number }) => product.price);
    expect(response.status).toBe(200);
    expect(body.pagination.pageSize).toBe(3);
    expect(prices.every((price: number) => price >= 10 && price <= 30)).toBe(true);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
  });

  it("returns product descriptions and variant-specific availability", async () => {
    const response = await request("/products/glass-bottle");
    const product = await response.json();
    expect(response.status).toBe(200);
    expect(product.description.length).toBeGreaterThan(10);
    expect(product.variants.some((variant: { sku: string; inStock: boolean }) =>
      variant.sku.endsWith("-standard") && variant.inStock,
    )).toBe(true);
  });

  it("quotes cart prices and delivery from database values", async () => {
    const variant = await findVariant();
    const response = await request("/cart/quote", {
      method: "POST",
      body: JSON.stringify({ items: [{ variantId: variant.id, quantity: 1 }] }),
    });
    const quote = await response.json();
    expect(response.status).toBe(200);
    expect(quote.subtotal).toBe(variant.priceCents / 100);
    expect(quote.delivery).toBe(8);
    expect(quote.total).toBe(quote.subtotal + quote.delivery);
    expect(quote.inStock).toBe(true);
  });

  it("marks quantities above current variant stock unavailable in the cart quote", async () => {
    const variant = await findVariant();
    await setStock(variant.id, 2);
    const response = await request("/cart/quote", {
      method: "POST",
      body: JSON.stringify({ items: [{ variantId: variant.id, quantity: 3 }] }),
    });
    const quote = await response.json();
    expect(response.status).toBe(200);
    expect(quote.inStock).toBe(false);
    expect(quote.items[0]).toMatchObject({ stock: 2, available: false, quantity: 3 });
  });

  it("creates a cash-on-delivery order and conditionally reduces stock", async () => {
    const variant = await findVariant();
    await setStock(variant.id, 5);
    const response = await placeCodOrder(variant.id, 2);
    const body = await response.json();
    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(response.status).toBe(201);
    expect(body.paymentStatus).toBe("unpaid");
    expect(body.total).toBe(variant.priceCents / 100 * 2 + 8);
    expect(updatedVariant.stock).toBe(3);
  });

  it("rejects checkout for sold-out stock without creating an order", async () => {
    const variant = await findVariant();
    await setStock(variant.id, 0);
    const before = await prisma.order.count();
    const response = await placeCodOrder(variant.id);
    const after = await prisma.order.count();
    expect(response.status).toBe(400);
    expect(after).toBe(before);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(0);
  });

  it("does not oversell when two guests order the final item concurrently", async () => {
    const variant = await findVariant();
    await setStock(variant.id, 1);
    const responses = await Promise.all([
      placeCodOrder(variant.id),
      placeCodOrder(variant.id),
    ]);
    const successes = responses.filter((response) => response.status === 201);
    const stock = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(successes).toHaveLength(1);
    expect(responses.filter((response) => response.status === 400)).toHaveLength(1);
    expect(stock.stock).toBe(0);
  });

  it("allows order lookup with matching checkout email and hides mismatched contact details", async () => {
    const variant = await findVariant();
    await setStock(variant.id, 4);
    const email = testEmail("tracking");
    const createdResponse = await placeCodOrder(variant.id, 1, email);
    const created = await createdResponse.json();
    const matching = await request(`/orders/${created.orderNumber}?contact=${encodeURIComponent(email)}`);
    const mismatched = await request(`/orders/${created.orderNumber}?contact=someone-else-${testRunId}@example.test`);
    expect(matching.status).toBe(200);
    expect(mismatched.status).toBe(404);
  });

  it("requires admin login and rejects incorrect credentials", async () => {
    const badLogin = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email: adminEmail, password: "wrong-password" }),
    });
    const dashboard = await request("/admin/dashboard");
    expect(badLogin.status).toBe(401);
    expect(dashboard.status).toBe(401);
  });

  it("lets a signed-in admin update an order and restore cancelled COD stock", async () => {
    const variant = await findVariant();
    await setStock(variant.id, 5);
    const createdResponse = await placeCodOrder(variant.id, 1);
    const created = await createdResponse.json();
    const cancelled = await request(`/admin/orders/${created.orderNumber}/status`, {
      method: "PATCH",
      headers: { cookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const restoredVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json()).status).toBe("cancelled");
    expect(restoredVariant.stock).toBe(5);
  });

  it("lets an authenticated admin create and edit products and variants", async () => {
    const slug = `api-test-${randomUUID()}`;
    const productInput = {
      slug,
      name: "API test sample",
      description: "A test product to verify secure admin catalogue editing.",
      category: "Testing",
      image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85",
      imageAlt: "A small test product on a table",
      badge: null,
      active: true,
      variants: [{ sku: `${slug}-sample`, name: "Standard", priceCents: 3200, stock: 7 }],
    };
    const createResponse = await request("/admin/products", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify(productInput),
    });
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(created.variants[0].stock).toBe(7);

    const updateResponse = await request(`/admin/products/${created.id}`, {
      method: "PUT",
      headers: { cookie },
      body: JSON.stringify({
        ...productInput,
        name: "API test sample updated",
        variants: [{ ...productInput.variants[0], id: created.variants[0].id, stock: 5 }],
      }),
    });
    const updated = await updateResponse.json();
    expect(updateResponse.status).toBe(200);
    expect(updated.name).toBe("API test sample updated");
    expect(updated.variants[0].stock).toBe(5);
    await prisma.product.delete({ where: { id: created.id } });
  });

  it("keeps Stripe checkout unavailable until a test-mode key is configured", async () => {
    const variant = await findVariant();
    const response = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        ...baseOrder,
        email: testEmail("stripe"),
        paymentMethod: "stripe",
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    expect(response.status).toBe(503);
    expect(await prisma.order.count({ where: { paymentMethod: "stripe" } })).toBe(0);
  });
});
