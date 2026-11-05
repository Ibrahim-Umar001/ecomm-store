import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const catalog = [
  ["ceramic-vase", "Sunday ceramic vase", "Hand-finished stoneware for fresh flowers and quiet corners.", "Home", "1578500494198-246f612d3b3d", "Sculptural ceramic vase on a neutral shelf", 4200, 25, "Bestseller"],
  ["studio-headphones", "Studio wireless headphones", "Comfortable over-ear sound for wherever your day takes you.", "Tech", "1505740420928-5e560c06d30e", "Over-ear headphones on a warm orange background", 12900, 18, "Just in"],
  ["weekend-tote", "The everyday canvas tote", "A roomy, sturdy cotton canvas carryall for your everyday.", "Accessories", "1590874103328-eac38a683ce7", "Minimal everyday tote bag", 3600, 40, null],
  ["linen-throw", "Soft-knit lounge throw", "A soft, breathable throw woven for slow Sunday afternoons.", "Lifestyle", "1600210492486-724fe5c67fb0", "Soft neutral throw in a sunlit living room", 7800, 16, "Fan favorite"],
  ["table-lamp", "Little light table lamp", "Warm, diffused light in a timeless, compact silhouette.", "Home", "1507473885765-e6ed057f782c", "Modern table lamp glowing in a cozy room", 6400, 22, null],
  ["glass-bottle", "Daily water bottle", "A reliable, reusable bottle for your desk, bag, and beyond.", "Lifestyle", "1602143407151-7111542de6e8", "Reusable water bottle", 2800, 55, null],
  ["analog-camera", "Little moments film camera", "A simple point-and-shoot camera for the moments worth keeping.", "Tech", "1516035069371-29a1b244cc32", "Compact camera ready for a weekend away", 8900, 14, null],
  ["weekender", "Somewhere weekend bag", "A thoughtfully-sized weekender for spontaneous little getaways.", "Accessories", "1553062407-98eeb64c6a62", "Roomy travel bag with simple styling", 11200, 11, "Limited"],
  ["pour-over-set", "Slow morning pour-over set", "A small-batch ceramic dripper for a gentler morning ritual.", "Home", "1495474472287-4d71bcdd2085", "Freshly poured coffee in a ceramic cup", 4800, 20, null],
  ["desk-organizer", "Clear day desk tray", "Keep little essentials in their place and your mind a little clearer.", "Home", "1497366754035-f200968a6e72", "Organized, sunlit writing desk", 3200, 34, null],
  ["wireless-speaker", "Pocket-sized wireless speaker", "Bring your favorite soundtrack along, indoors or out.", "Tech", "1608043152269-423dbba4e7e1", "Compact portable speaker", 5900, 24, "Bestseller"],
  ["phone-stand", "The easy-angle phone stand", "An adjustable stand that keeps hands free and screens just right.", "Tech", "1523206489230-c012c64b2b48", "Phone on a minimal stand", 1900, 60, null],
  ["leather-cardholder", "Everyday leather cardholder", "A slim, responsibly sourced leather wallet for the essentials.", "Accessories", "1627123424574-724758594e93", "Minimal leather cardholder", 3400, 28, null],
  ["cotton-cap", "Out-the-door cotton cap", "An easy-fitting cotton cap for sunny walks and off-duty days.", "Accessories", "1588850561407-ed78c282e89b", "Classic cotton baseball cap", 2600, 32, null],
  ["tea-cup", "Little pause tea cup", "A generous handmade cup for taking the long way around a tea break.", "Home", "1514228742587-6b1558fcca3d", "Handmade ceramic tea cup", 2400, 44, null],
  ["candle-set", "Golden hour candle set", "Two clean-burning candles with soft, comforting botanical notes.", "Lifestyle", "1603006905003-be475563bc59", "A glowing candle on a warm surface", 3900, 26, "Gift ready"],
  ["pillow-cover", "Sunday linen cushion cover", "Washed linen in an easy-going neutral, made to soften your sofa.", "Lifestyle", "1584100936595-c0654b55a2e2", "Textured neutral linen cushion", 4400, 19, null],
  ["sling-bag", "Out-and-about sling bag", "A hands-free everyday bag with room for the things you really use.", "Accessories", "1548036328-c9fa89d128fa", "Everyday shoulder bag", 5200, 17, null],
  ["earbuds-case", "Sound day earbud case", "A protective, pocket-friendly case for your favorite wireless earbuds.", "Tech", "1606220945770-b5b6c2c55bf1", "Compact wireless earbuds", 2200, 42, null],
  ["wooden-tray", "Gather round serving tray", "A solid wood tray made for shared snacks and slow conversations.", "Home", "1530018607912-eff2daa1bac4", "Wooden serving tray with snacks", 5600, 13, null],
  ["knit-socks", "Everyday cloud-knit socks", "Soft, breathable everyday socks that feel like a small kindness.", "Lifestyle", "1586350977771-b3b0abd50c82", "Comfortable neutral knit socks", 1600, 70, null],
  ["travel-pouch", "The little things travel pouch", "Keep chargers and small essentials together on every trip.", "Accessories", "1553062407-98eeb64c6a62", "Travel pouch packed for a trip", 2900, 36, null],
  ["reading-light", "One more page clip light", "A warm, gentle reading light for late chapters and early mornings.", "Tech", "1507842217343-583bb7270b66", "Cozy reading nook with books", 3100, 21, null],
  ["plant-pot", "Grow at your own pace planter", "A simple glazed planter with a saucer for your favorite small green.", "Home", "1485955900006-10f4d324d411", "Small green plant in a ceramic planter", 2700, 30, null],
  ["hand-thrown-pasta-bowl", "Hand-thrown pasta bowl", "A softly curved stoneware bowl for weeknight pasta and shared salads.", "Home", "1578749556568-bc2c40e68b61", "Hand-thrown ceramic bowl on a table", 3800, 18, null],
  ["cotton-table-runner", "Washed cotton table runner", "An easy, textured layer that makes everyday dinners feel considered.", "Home", "1600210492486-724fe5c67fb0", "Neutral table linen in a warm dining room", 4600, 14, null],
  ["paperback-bookends", "Quiet corner bookends", "A pair of sculptural bookends for the stories you keep close.", "Home", "1512820790803-83ca734da794", "A tidy stack of books on a shelf", 4200, 12, null],
  ["woven-storage-basket", "Woven everyday basket", "A sturdy catch-all for blankets, books, or the little things in between.", "Home", "1595428774223-ef52624120d2", "Woven storage basket beside a chair", 5800, 15, null],
  ["arched-wall-mirror", "The little arched mirror", "A simple, light-catching mirror for a hallway, bedroom, or favorite nook.", "Home", "1618221195710-dd6b41faaea6", "Minimal arched mirror in a calm interior", 9800, 8, "Just in"],
  ["slow-evening-incense", "Slow evening incense holder", "A small ceramic holder for a few quieter minutes at the end of the day.", "Lifestyle", "1603006905003-be475563bc59", "A calm candlelit evening scene", 2500, 24, null],
  ["mechanical-keyboard", "Soft-touch wireless keyboard", "A compact, comfortable keyboard made for long notes and focused days.", "Tech", "1587829741301-dc798b83add3", "Compact keyboard on a desk", 8900, 10, null],
  ["everyday-usb-hub", "Everyday USB-C hub", "Keep your desk connected with a tidy hub for the devices you use most.", "Tech", "1625842268584-8f3296236761", "USB-C hub and accessories on a desk", 4900, 16, null],
  ["studio-desk-mat", "A calmer desk mat", "A soft, durable surface that brings a little order to your workspace.", "Tech", "1524758631624-e2822e304c36", "Organized home office with a clean desk", 5200, 13, null],
  ["cushioned-laptop-sleeve", "Cushioned laptop sleeve", "A lightly padded sleeve to carry your laptop from desk to destination.", "Accessories", "1523275335684-37898b6baf30", "Minimal everyday carry accessories", 4400, 19, null],
  ["unhurried-yoga-mat", "The unhurried yoga mat", "A supportive, grippy mat for stretching, stillness, and starting again.", "Lifestyle", "1544367567-0f2fcb009e0b", "Yoga practice in a bright, quiet room", 7200, 11, null],
  ["cotton-weekend-robe", "Cotton weekend robe", "A relaxed, absorbent robe for the slowest part of your morning routine.", "Lifestyle", "1600369671236-e74521d4b6ad", "Soft cotton robe in a light-filled bathroom", 9400, 15, null],
  ["soft-sleep-eye-mask", "Soft sleep eye mask", "A gentle, lightweight eye mask for naps, travel, and earlier nights.", "Lifestyle", "1515886657613-9f3515b0c78f", "Soft sleep accessories in a neutral palette", 2200, 28, null],
  ["rib-knit-house-slippers", "Rib-knit house slippers", "Warm, cushioned slippers for the first coffee and the last page.", "Lifestyle", "1542291026-7eec264c27ff", "Comfortable knit slippers on a neutral floor", 3600, 20, null],
  ["cotton-everyday-tee", "Cotton everyday tee", "A soft, breathable staple with an easy fit for all-day comfort.", "Lifestyle", "1521572163474-6864f9cf17ab", "Folded cotton t-shirt in a neutral tone", 3400, 32, null],
  ["pocket-size-umbrella", "Pocket-size day umbrella", "A compact, sturdy umbrella for the little surprises in the forecast.", "Accessories", "1534274988757-a28bf1a57c17", "Compact umbrella ready for a rainy day", 3900, 17, null],
  ["everyday-ribbed-tee", "Everyday ribbed cotton tee", "A soft ribbed cotton tee in considered colors, made for easy everyday layering.", "Lifestyle", "1521572163474-6864f9cf17ab", "Ribbed cotton t-shirt in a warm neutral color", 3200, 0, "New"],
  ["weekend-fleece-crew", "Weekend fleece crewneck", "A relaxed brushed-fleece layer for cool mornings, long walks, and slow weekends.", "Lifestyle", "1556821840-3a63f95609a7", "Cozy fleece crewneck sweatshirt", 6400, 0, "Just in"],
  ["everyday-canvas-sneaker", "Everyday canvas sneaker", "A lightweight canvas sneaker with a cushioned sole for all the places your day takes you.", "Accessories", "1525966222134-fcfa99b8ae77", "Low-top canvas sneakers in a classic silhouette", 7200, 0, "Just in"],
];

const sizedOptions: Record<string, { name: string; stock: number }[]> = {
  "cotton-weekend-robe": [
    { name: "XS/S", stock: 3 },
    { name: "M/L", stock: 8 },
    { name: "XL/XXL", stock: 4 },
  ],
  "rib-knit-house-slippers": [
    { name: "S/M", stock: 7 },
    { name: "L/XL", stock: 9 },
    { name: "XXL", stock: 4 },
  ],
  "cotton-everyday-tee": [
    { name: "XS", stock: 4 },
    { name: "S", stock: 6 },
    { name: "M", stock: 8 },
    { name: "L", stock: 7 },
    { name: "XL", stock: 5 },
    { name: "XXL", stock: 2 },
  ],
};

const colorSizeOptions: Record<string, { color: string; size: string; stock: number }[]> = {
  "everyday-ribbed-tee": [
    { color: "Oat", size: "S", stock: 7 },
    { color: "Oat", size: "M", stock: 9 },
    { color: "Oat", size: "L", stock: 6 },
    { color: "Oat", size: "XL", stock: 4 },
    { color: "Sage", size: "S", stock: 5 },
    { color: "Sage", size: "M", stock: 8 },
    { color: "Sage", size: "L", stock: 6 },
    { color: "Sage", size: "XL", stock: 3 },
    { color: "Terracotta", size: "S", stock: 4 },
    { color: "Terracotta", size: "M", stock: 7 },
    { color: "Terracotta", size: "L", stock: 5 },
    { color: "Terracotta", size: "XL", stock: 2 },
  ],
  "weekend-fleece-crew": [
    { color: "Heather Oat", size: "S", stock: 4 },
    { color: "Heather Oat", size: "M", stock: 7 },
    { color: "Heather Oat", size: "L", stock: 6 },
    { color: "Heather Oat", size: "XL", stock: 3 },
    { color: "Forest", size: "S", stock: 3 },
    { color: "Forest", size: "M", stock: 6 },
    { color: "Forest", size: "L", stock: 5 },
    { color: "Forest", size: "XL", stock: 2 },
    { color: "Ink", size: "S", stock: 5 },
    { color: "Ink", size: "M", stock: 8 },
    { color: "Ink", size: "L", stock: 4 },
    { color: "Ink", size: "XL", stock: 2 },
  ],
  "everyday-canvas-sneaker": [
    { color: "Canvas", size: "7", stock: 4 },
    { color: "Canvas", size: "8", stock: 6 },
    { color: "Canvas", size: "9", stock: 8 },
    { color: "Canvas", size: "10", stock: 6 },
    { color: "Canvas", size: "11", stock: 3 },
    { color: "Olive", size: "7", stock: 3 },
    { color: "Olive", size: "8", stock: 5 },
    { color: "Olive", size: "9", stock: 7 },
    { color: "Olive", size: "10", stock: 5 },
    { color: "Olive", size: "11", stock: 2 },
    { color: "Black", size: "7", stock: 5 },
    { color: "Black", size: "8", stock: 7 },
    { color: "Black", size: "9", stock: 8 },
    { color: "Black", size: "10", stock: 5 },
    { color: "Black", size: "11", stock: 3 },
  ],
};

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (Boolean(email) !== Boolean(password)) {
    throw new Error("Set both ADMIN_EMAIL and ADMIN_PASSWORD to seed the admin account.");
  }
  if (password && password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  }

  for (const [slug, name, description, category, photoId, imageAlt, priceCents, stock, badge] of catalog) {
    const productSlug = String(slug);
    await prisma.product.upsert({
      where: { slug: productSlug },
      update: {},
      create: {
        slug: productSlug,
        name: String(name),
        description: String(description),
        category: String(category),
        image: `https://images.unsplash.com/photo-${String(photoId)}?auto=format&fit=crop&w=900&q=80`,
        imageAlt: String(imageAlt),
        badge: typeof badge === "string" ? badge : undefined,
        variants: {
          create: colorSizeOptions[productSlug]
            ? colorSizeOptions[productSlug].map((option) => ({
                sku: `${productSlug}-${option.color.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${option.size.toLowerCase()}`,
                name: `${option.color} / ${option.size}`,
                color: option.color,
                size: option.size,
                priceCents: Number(priceCents),
                stock: option.stock,
              }))
            : sizedOptions[productSlug]
            ? sizedOptions[productSlug].map((option) => ({
                sku: `${productSlug}-${option.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                name: option.name,
                priceCents: Number(priceCents),
                stock: option.stock,
              }))
            : [
                { sku: `${productSlug}-standard`, name: "Standard", priceCents: Number(priceCents), stock: Number(stock) },
                { sku: `${productSlug}-gift`, name: "Gift-ready", priceCents: Number(priceCents) + 500, stock: Math.max(0, Math.floor(Number(stock) / 2)) },
              ],
        },
      },
    });
  }

  if (email && password) {
    await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash: await bcrypt.hash(password, 12) },
      create: { email, passwordHash: await bcrypt.hash(password, 12) },
    });
  } else {
    console.info("ADMIN_EMAIL and ADMIN_PASSWORD are not set; catalog seeded without creating an admin account.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
