export const categories = [
  "Everything",
  "Home",
  "Tech",
  "Lifestyle",
  "Accessories",
] as const;

export type ProductFilter = (typeof categories)[number] | string;
