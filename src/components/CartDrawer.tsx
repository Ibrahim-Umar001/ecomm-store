import type { CartItem } from "../types";

interface CartDrawerProps {
  items: CartItem[];
  onClose: () => void;
  onChangeQuantity: (productId: string, change: number) => void;
}

export default function CartDrawer({
  items,
  onClose,
  onChangeQuantity,
}: CartDrawerProps) {
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

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
            <p className="shipping-note">
              {subtotal >= 75
                ? "You’ve unlocked free shipping. Nice."
                : `You’re $${(75 - subtotal).toFixed(2)} away from free shipping.`}
            </p>
            <ul className="cart-items">
              {items.map(({ product, quantity }) => (
                <li className="cart-item" key={product.id}>
                  <img src={product.image} alt={product.imageAlt} />
                  <div className="cart-item-info">
                    <p className="product-category">{product.category}</p>
                    <h3>{product.name}</h3>
                    <div className="quantity-control" aria-label={`Quantity: ${quantity}`}>
                      <button
                        type="button"
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => onChangeQuantity(product.id, -1)}
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${product.name}`}
                        onClick={() => onChangeQuantity(product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="cart-item-price">${(product.price * quantity).toFixed(2)}</p>
                </li>
              ))}
            </ul>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
              <p>Shipping and taxes calculated at checkout.</p>
              <button className="button button-dark checkout-button" type="button">
                Continue to checkout <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
