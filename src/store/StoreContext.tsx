import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "../api/client";
import { StoreContext } from "./store-context";
import type { CartItem, CartQuote, Product, ProductVariant } from "../types";
const storageKey = "goodthings-cart-v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Saved cart is not a list.");
    return parsed.filter(
      (item): item is CartItem =>
        item !== null &&
        typeof item === "object" &&
        "variantId" in item &&
        typeof item.variantId === "string" &&
        "quantity" in item &&
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 20 &&
        "product" in item,
    );
  } catch (error) {
    console.warn("Saved cart could not be restored; starting with an empty cart.", error);
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(readCart);
  const cartItemsRef = useRef(cartItems);
  const pendingAddsRef = useRef(new Set<string>());
  const [quoteState, setQuoteState] = useState<{
    cartKey: string;
    quote: CartQuote | null;
    error: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const cartKey = JSON.stringify(
    cartItems.map(({ variantId, quantity }) => ({ variantId, quantity })),
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cartItems));
    } catch (error) {
      console.error("The cart could not be saved to this browser.", error);
    }
  }, [cartItems]);

  useEffect(() => {
    if (cartItems.length === 0) return;

    const controller = new AbortController();
    void apiRequest<CartQuote>("/cart/quote", {
      method: "POST",
      body: JSON.stringify({
        items: cartItems.map(({ variantId, quantity }) => ({ variantId, quantity })),
      }),
      signal: controller.signal,
    })
      .then((result) => {
        setQuoteState({ cartKey, quote: result, error: "" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuoteState({
          cartKey,
          quote: null,
          error: error instanceof Error
            ? error.message
            : "The cart total could not be checked.",
        });
      });

    return () => controller.abort();
  }, [cartItems, cartKey]);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(""), 3000);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const quote = cartItems.length && quoteState?.cartKey === cartKey
    ? quoteState.quote
    : null;
  const quoteError = cartItems.length && quoteState?.cartKey === cartKey
    ? quoteState.error
    : "";

  const addToCart = useCallback(async (product: Product, variant: ProductVariant, quantity = 1) => {
    const currentItems = cartItemsRef.current;
    const currentItem = currentItems.find((item) => item.variantId === variant.id);
    const requestedQuantity = (currentItem?.quantity ?? 0) + quantity;
    if (pendingAddsRef.current.has(variant.id)) return;
    if (!variant.inStock || quantity < 1 || requestedQuantity > variant.stock || requestedQuantity > 20) {
      setAnnouncement(variant.stock === 0
        ? `${product.name} (${variant.name}) is not in stock.`
        : `Only ${variant.stock} ${variant.name} item(s) are available.`);
      return;
    }
    pendingAddsRef.current.add(variant.id);
    try {
      const availability = await apiRequest<CartQuote>("/cart/quote", {
        method: "POST",
        body: JSON.stringify({ items: [{ variantId: variant.id, quantity: requestedQuantity }] }),
      });
      const checkedVariant = availability.items.find((item) => item.variantId === variant.id);
      if (!checkedVariant?.available) {
        setAnnouncement(checkedVariant?.stock === 0
          ? `${product.name} (${variant.name}) is not in stock.`
          : `Only ${checkedVariant?.stock ?? 0} ${variant.name} item(s) are available.`);
        return;
      }

      const latestItems = cartItemsRef.current;
      const latestItem = latestItems.find((item) => item.variantId === variant.id);
      const latestQuantity = (latestItem?.quantity ?? 0) + quantity;
      if (latestQuantity > checkedVariant.stock || latestQuantity > 20) {
        setAnnouncement(`Only ${checkedVariant.stock} ${variant.name} item(s) are available.`);
        return;
      }
      const nextItems = latestItem
        ? latestItems.map((item) =>
            item.variantId === variant.id
              ? { ...item, quantity: latestQuantity, product }
              : item,
          )
        : [...latestItems, { variantId: variant.id, product, quantity }];
      cartItemsRef.current = nextItems;
      setCartItems(nextItems);
      setAnnouncement(`${product.name} added to your bag.`);
    } catch (error) {
      setAnnouncement(error instanceof Error
        ? error.message
        : "Product availability could not be checked.");
    } finally {
      pendingAddsRef.current.delete(variant.id);
    }
  }, []);

  const changeQuantity = useCallback((variantId: string, change: number) => {
    const currentItems = cartItemsRef.current;
    const currentItem = currentItems.find((item) => item.variantId === variantId);
    if (!currentItem) return;
    const quotedStock = quoteState?.cartKey === cartKey
      ? quoteState.quote?.items.find((item) => item.variantId === variantId)?.stock
      : undefined;
    const variantStock = currentItem.product.variants.find((variant) => variant.id === variantId)?.stock;
    const availableStock = quotedStock ?? variantStock ?? 0;
    if (change > 0 && currentItem.quantity + change > Math.min(20, availableStock)) {
      setAnnouncement(`Only ${availableStock} ${currentItem.product.name} item(s) are available.`);
      return;
    }
    const nextItems = currentItems
      .map((item) =>
        item.variantId === variantId
          ? { ...item, quantity: Math.min(20, item.quantity + change) }
          : item,
      )
      .filter((item) => item.quantity > 0);
    cartItemsRef.current = nextItems;
    setCartItems(nextItems);
  }, [cartKey, quoteState]);

  const clearCart = useCallback(() => {
    cartItemsRef.current = [];
    setCartItems([]);
  }, []);
  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      quote,
      quoteError,
      announcement,
      addToCart,
      changeQuantity,
      clearCart,
    }),
    [cartItems, cartCount, quote, quoteError, announcement, addToCart, changeQuantity, clearCart],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
