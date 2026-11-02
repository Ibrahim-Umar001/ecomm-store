# E-commerce Store Implementation Plan

## Goal

Deliver the attached seven-day e-commerce task as a Vite + React + TypeScript
storefront backed by a Node/Express API, Prisma with SQLite for local development,
and Stripe Checkout restricted to test mode. Never accept or persist card numbers;
all prices and totals are authoritative on the server.

## Pages and user journeys

- **Storefront/catalogue:** browse at least 20 seeded products; search, category
  and price filters, sorting, pagination, product detail, and size/colour variants.
- **Cart:** persist selected variants and quantities across refreshes; display
  server-calculated subtotal, delivery, and total.
- **Checkout:** guest contact and shipping address form; cash on delivery or
  Stripe test checkout; handle cancelled/failed payment without marking an order
  paid.
- **Confirmation and tracking:** show an order number after placement; track an
  order using its order number and the email address or phone number used at
  checkout.
- **Admin:** authenticated dashboard for product/variant/image management,
  inventory, order status updates, sales totals, and top products.

## Data model

- `AdminUser`: email and password hash.
- `Product`: slug, name, description, category, image URL, active state.
- `ProductVariant`: product, SKU, size/colour label, price in integer cents, and
  on-hand stock.
- `Order`: unique order number, guest contact/address, delivery and total in
  integer cents, order/payment status, and optional Stripe Checkout Session ID.
- `OrderItem`: immutable product/variant name, SKU, unit price, and quantity
  snapshots.
- `PaymentEvent`: unique Stripe event ID for webhook idempotency.

## Implementation steps

1. Establish this plan and record AI/tool usage and mistakes in `AI-NOTES.md`.
2. Add the Express API, Prisma schema/seed, input validation, admin auth, safe
   inventory updates, checkout/payment webhook handling, and order tracking.
3. Connect the React catalogue, product variants, persistent cart, guest checkout,
   confirmation, and tracking to the API.
4. Add the admin login and management dashboard, including image upload.
5. Run builds, lint, automated checks, and browser smoke tests; document setup,
   environment variables, test cases, and any external configuration still needed.

## Safety and correctness constraints

- Stripe secret keys must be test keys (`sk_test_`) and stay in environment
  variables. Card data is entered only on Stripe-hosted checkout.
- Compute product prices, delivery, and totals from database records on the
  server; ignore client-supplied prices.
- Reserve stock with conditional, transactional updates so concurrent checkouts
  cannot oversell. Restore reservations on failed/expired payment.
- Verify Stripe webhook signatures and process events idempotently.
- Hash admin passwords; use an HTTP-only session cookie and rate-limit login.
- Validate all request bodies and restrict uploaded image size/type.

## Completion checklist

- [ ] 20+ products and variant-aware browsing work on mobile.
- [ ] Cart persists and displays accurate server-calculated totals.
- [ ] COD orders are saved; Stripe test payments can be completed/cancelled.
- [ ] Failed payment is never marked paid; stock cannot be oversold.
- [ ] Confirmation/tracking and admin product/order/sales workflows work.
- [ ] Build, lint, tests, and at least 10 documented checks pass.
- [ ] README setup, `.env.example`, and AI usage notes are complete.
