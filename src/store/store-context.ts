import { createContext } from "react";
import type { CartItem, CartQuote, Product, ProductVariant } from "../types";

export interface StoreContextValue {
  cartItems: CartItem[];
  cartCount: number;
  quote: CartQuote | null;
  quoteError: string;
  announcement: string;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => Promise<void>;
  changeQuantity: (variantId: string, change: number) => void;
  clearCart: () => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);
