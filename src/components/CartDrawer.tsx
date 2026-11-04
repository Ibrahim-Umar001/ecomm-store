import type { CartItem } from "../types";
import type { CartQuote } from "../types";
import { formatPrice } from "../api/client";
import { useNavigate } from "react-router-dom";

interface CartDrawerProps {
  items: CartItem[];
  quote: CartQuote | null;
  quoteError: string;
  onClose: () => void;
  onChangeQuantity: (productId: string, change: number) => void;
}

export default function CartDrawer({
  items,
  quote,
  quoteError,
  onClose,
  onChangeQuantity,
}: CartDrawerProps) {
  const navigate = useNavigate();
  const canCheckout = Boolean(quote?.inStock);

  return (
    <div className="cart-layer">
      <button
        className="cart-backdrop"
        type="button"
        aria-label="Close shopping bag"
        onClick={onClose}
      />
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-heading">
          <div>
            <p className="eyebrow">YOUR GOOD THINGS</p>
            <h2 id="cart-title">Your bag <span>({items.reduce((sum, item) => sum + item.quantity, 0)})</span></h2>
          </div>
          <button className="close-button" type="button" aria-label="Close bag" onClick={onClose}>
            ×
          </button>
        </div>
        {items.length === 0 ? (
          <div className="empty-cart">
            <span aria-hidden="true">✳</span>
            <h3>It’s a little empty in here.</h3>
            <p>Find something that makes your everyday a bit brighter.</p>
            <button className="button button-dark" type="button" onClick={onClose}>
              Keep exploring
            </button>
          </div>
        ) : (
          <>
            {quote ? (
              <p className="shipping-note">
                {quote.delivery === 0
                  ? "You’ve unlocked free shipping. Nice."
                  : `You’re ${formatPrice(75 - quote.subtotal)} away from free shipping.`}
              </p>
            ) : (
              <p className={quoteError ? "form-error" : "shipping-note"}>
                {quoteError || "Checking current prices and availability…"}
              </p>
            )}
            <ul className="cart-items">
              {items.map(({ product, variantId, quantity }) => {
                const quotedItem = quote?.items.find((item) => item.variantId === variantId);
                const productVariant = product.variants.find((variant) => variant.id === variantId);
                const availableStock = quotedItem?.stock ?? productVariant?.stock ?? 0;
                return (
                <li className="cart-item" key={variantId}>
                  <img src={quotedItem?.productImage ?? product.image} alt={product.imageAlt} />
                  <div className="cart-item-info">
                    <p className="product-category">{product.category}</p>
                    <h3>{product.name}</h3>
                    <p className="cart-variant-name">{quotedItem?.variantName ?? "Selected option"}</p>
                    {quotedItem && !quotedItem.available && (
                      <p className="form-error">Only {quotedItem.stock} in stock.</p>
                    )}
                    <div className="quantity-control" aria-label={`Quantity: ${quantity}`}>
                      <button
                        type="button"
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => onChangeQuantity(variantId, -1)}
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${product.name}`}
                        disabled={quantity >= Math.min(20, availableStock)}
                        onClick={() => onChangeQuantity(variantId, 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="cart-remove"
                      type="button"
                      onClick={() => onChangeQuantity(variantId, -quantity)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="cart-item-price">
                    {quotedItem ? formatPrice(quotedItem.price * quantity) : "—"}
                  </p>
                </li>
                );
              })}
            </ul>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{quote ? formatPrice(quote.subtotal) : "—"}</strong></div>
              <div><span>Delivery</span><strong>{quote ? (quote.delivery ? formatPrice(quote.delivery) : "Free") : "—"}</strong></div>
              <div><span>Total</span><strong>{quote ? formatPrice(quote.total) : "—"}</strong></div>
              <p>Final totals are confirmed securely at checkout.</p>
              <button
                className="button button-dark checkout-button"
                type="button"
                disabled={!canCheckout}
                onClick={() => {
                  onClose();
                  navigate("/checkout");
                }}
              >
                Continue to checkout <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
