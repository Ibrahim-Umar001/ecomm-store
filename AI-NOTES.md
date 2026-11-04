# AI Development Notes

## Tools used

- GitHub Copilot (AI coding assistant in VS Code)
- Workspace file and code editing tools
- npm for dependency installation and scripts
- Vite development server and integrated browser for smoke testing

## Most useful prompts and directions

1. “Start this React project, organize it according to industry standard
   practices, and use Vite.”
2. “Use the attached PDF as the full brief, including admin, backend, orders,
   stock, and test payments.”
3. “Inspect the existing repository and preserve unrelated files and changes.”
4. “Keep all payment processing test-mode only and calculate prices and totals
   on the server.”
5. “Validate the production build, lint, and core storefront/admin workflows
   before considering the task complete.”

## Mistakes caught and corrections

1. **Initially treated the task as a storefront-only Vite scaffold.** The
   supplied PDF also requires server-side orders, inventory, Stripe test
   payments, tracking, and an admin. I checked the brief and confirmed scope
   before proceeding with the full implementation.
2. **The first TypeScript build could not resolve the CSS side-effect import.**
   I added Vite's client type reference in `src/vite-env.d.ts`, then reran the
   production build successfully.
3. **The first browser cart assertion used a product heading that appears both
   in the catalogue and cart drawer.** The interaction itself worked; I scoped
   the assertion to the cart dialog and verified quantity changes and totals.
4. **An API test guessed the wrong slug for the seeded water bottle.** I checked
   the seeded rows and corrected the fixture to use the actual `glass-bottle`
   slug; the product detail test then passed.
5. **The dev server's child processes remained alive after stopping its shell.**
   Their Prisma engine file lock prevented client generation. I inspected the
   exact workspace Node commands, stopped only those specific processes, and
   reran generation/build successfully.
