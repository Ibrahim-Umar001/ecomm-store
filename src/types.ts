export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  price: number;
  stock: number;
  inStock: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  image: string;
  imageAlt: string;
  badge?: string | null;
  price: number;
  inStock: boolean;
  variants: ProductVariant[];
}

export interface CartItem {
  variantId: string;
  product: Product;
  quantity: number;
}

export interface CartQuoteItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
  stock: number;
  available: boolean;
}

export interface CartQuote {
  items: CartQuoteItem[];
  subtotal: number;
  delivery: number;
  total: number;
  inStock: boolean;
}
