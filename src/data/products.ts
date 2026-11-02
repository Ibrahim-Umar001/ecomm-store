import type { Product } from "../types";

export const products: Product[] = [
  {
    id: "ceramic-vase",
    name: "Sunday ceramic vase",
    category: "Home",
    price: 42,
    image:
      "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Sculptural ceramic vase on a neutral shelf",
    badge: "Bestseller",
    rating: 4.9,
    reviewCount: 128,
    color: "#e8e4da",
  },
  {
    id: "studio-headphones",
    name: "Studio wireless headphones",
    category: "Tech",
    price: 129,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Over-ear headphones on a warm orange background",
    badge: "Just in",
    rating: 4.8,
    reviewCount: 86,
    color: "#ede7df",
  },
  {
    id: "weekend-tote",
    name: "The everyday canvas tote",
    category: "Accessories",
    price: 36,
    image:
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Minimal everyday tote bag",
    rating: 4.7,
    reviewCount: 64,
    color: "#e6e5dc",
  },
  {
    id: "linen-throw",
    name: "Soft-knit lounge throw",
    category: "Lifestyle",
    price: 78,
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Soft neutral throw in a sunlit living room",
    badge: "Fan favorite",
    rating: 5,
    reviewCount: 203,
    color: "#e9e2d9",
  },
  {
    id: "table-lamp",
    name: "Little light table lamp",
    category: "Home",
    price: 64,
    image:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Modern table lamp glowing in a cozy room",
    rating: 4.8,
    reviewCount: 92,
    color: "#e4e6df",
  },
  {
    id: "glass-bottle",
    name: "Daily water bottle",
    category: "Lifestyle",
    price: 28,
    image:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Reusable water bottle",
    rating: 4.6,
    reviewCount: 47,
    color: "#e2e8e5",
  },
  {
    id: "analog-camera",
    name: "Little moments film camera",
    category: "Tech",
    price: 89,
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Compact camera ready for a weekend away",
    rating: 4.9,
    reviewCount: 111,
    color: "#e8e4dc",
  },
  {
    id: "weekender",
    name: "Somewhere weekend bag",
    category: "Accessories",
    price: 112,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Roomy travel bag with simple styling",
    badge: "Limited",
    rating: 4.8,
    reviewCount: 73,
    color: "#e7e3de",
  },
];

export const categories = [
  "Everything",
  "Home",
  "Tech",
  "Lifestyle",
  "Accessories",
] as const;

export type ProductFilter = (typeof categories)[number];
