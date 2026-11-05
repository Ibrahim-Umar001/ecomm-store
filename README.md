# goodthings

A mobile-first React storefront and Node API built with Vite, TypeScript,
Express, Prisma/SQLite, and Stripe Checkout in test mode.

## Requirements

- Node.js 22.12 or newer
- npm
- Stripe test account and Stripe CLI only if you want to test online card checkout

## Local setup

```powershell
npm install
Copy-Item .env.example .env
```

The default `DATABASE_URL="file:./dev.db"` stores the SQLite database at
`prisma/dev.db`. Keep `.env` private and untracked. Set a unique `JWT_SECRET`
(at least 32 characters) to enable customer and admin sign-in. To seed an admin
account, also set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters).
The seed hashes the admin password; it is never stored in the database as plain
text. Without admin credentials, the seed creates catalog products only.

Generate the Prisma client, safely apply the existing migrations, and seed
missing sample products:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

Start Vite and the API together:

```powershell
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
Customer registration and sign-in are at `/account`; the admin login is at
`/admin`. The API listens on port 4000 and Vite proxies `/api` and `/uploads`.

The seed creates 43 sample products with stock tracked per variant, including
color-and-size combinations for sample apparel and footwear. Seeded inventory is **demo data**,
not actual warehouse stock; confirm and update every quantity in Store admin
before accepting live orders. Re-running the seed adds missing demo products
but does not overwrite existing product or inventory records. Product imagery
uses remote Unsplash URLs; uploaded admin images are saved under the ignored
local `uploads/` directory.

## Test-mode card checkout

Card numbers are entered only on Stripe-hosted Checkout; the app never accepts
or stores card numbers. To enable online checkout:

1. Use a Stripe **test** secret key (`sk_test_...`) for `STRIPE_SECRET_KEY`.
   Production/live (`sk_live_...`) keys are rejected by the API.
2. Set `STRIPE_WEBHOOK_SECRET` from a local Stripe CLI listener:

   ```powershell
   stripe listen --forward-to localhost:4000/api/webhooks/stripe
   ```

3. Use a Stripe test card such as `4242 4242 4242 4242`, any future expiry, and
   any three-digit CVC. This is a simulated payment only.

Cash on delivery is available without Stripe configuration. Delivery costs $8
below $75 and is free at or above $75. The server recomputes item prices,
availability, and totals from the database for every quote and order.

## Useful commands

```powershell
npm run dev          # Vite + Express with watch mode
npm run build        # Prisma client, TypeScript checks, and Vite production build
npm run lint         # ESLint
npm test             # Vitest
npm run db:migrate   # Create/apply local SQLite migrations
npm run db:seed      # Seed products and the configured admin
npm start            # Run the compiled API
```

## Main routes

- `/` — searchable, filterable, sortable, paginated catalogue
- `/products/:slug` — product information and stock-aware variants
- `/checkout` — guest address form, cash on delivery, or Stripe test checkout
- `/order-confirmation` — order details and server-confirmed payment status
- `/track` — order lookup by order number and checkout email or phone
- `/account` — customer registration and sign-in
- `/admin` — authenticated product, inventory, order, and sales management

## Data and safety notes

- Prices are stored as integer cents and calculated on the server.
- Inventory is conditionally decremented inside the order transaction. Pending
  Stripe orders reserve stock for up to 30 minutes; failed, expired, or cancelled
  checkout releases it. Stripe webhook signatures are verified and event IDs
  are processed idempotently.
- Admin credentials are bcrypt-hashed. Admin sessions use an HTTP-only,
  SameSite=strict cookie and rate-limited login.
- Image uploads are limited to JPEG, PNG, WebP, or AVIF and 5 MB.
- Paid orders cannot be cancelled from admin until a Stripe refund has been
  handled. No card data is persisted.
- SQLite and local uploads are intended for development. Use a persistent
  production database and durable object storage before deployment.

## Manual verification checklist

Automated coverage already exercised during implementation:

1. API health and safe Stripe-disabled response — passed.
2. 40-product catalogue, size-specific variants, search, category, price filter,
   sorting, and pagination — passed.
3. Database-priced cart quotes, delivery totals, and insufficient-stock
   availability checks — passed.
4. Cash-on-delivery stock reduction and sold-out rejection without an order —
   passed.
5. Two simultaneous buyers competing for the final item — one succeeds; stock
   never goes negative — passed.
6. Order tracking accepts matching contact details and hides mismatched orders —
   passed.
7. Admin login/authentication, product/variant create and edit, order update, and
   COD cancellation stock restoration — passed.
8. A Stripe order is not accepted while test credentials are absent — passed.

The Vitest API suite reports **16/16 passing**. Browser smoke testing verified
that a size must be selected before adding, low stock is displayed, cart
quantity cannot exceed the selected size's stock, and removing an item updates
the bag without a page refresh. Stripe success/failure webhook flows still
require the store owner's Stripe test keys and webhook listener and have not
been run here.

Run these checks against the local app before presenting or deploying it:

1. Catalogue shows 40 seeded products.
2. Search returns matching products and displays an empty state for no matches.
3. Category and min/max price filters narrow the catalogue.
4. Sorting by price and moving between pages work.
5. Product pages require an explicit size/option selection, display its
   remaining demo stock, and disable sold-out options.
6. Adding, removing, and changing cart quantities updates the bag.
7. Cart contents survive a browser refresh and prices are re-quoted by the API.
8. A valid cash-on-delivery checkout creates an order and reduces stock.
9. A checkout with insufficient stock is rejected without creating an order.
10. Order tracking accepts the matching checkout email or phone and rejects
    unrelated contact details.
11. Admin login can add/edit a product and change an order's status.
12. Stripe test success, cancellation, webhook idempotency, and expiry restore
    payment/stock state as expected.

Document actual results for each case before sharing a demo. Stripe scenarios
require test-mode credentials and a locally running webhook listener.
