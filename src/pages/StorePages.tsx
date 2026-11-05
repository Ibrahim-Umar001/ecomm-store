import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { apiRequest, formatPrice } from "../api/client";
import ProductCard from "../components/ProductCard";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { useStore } from "../store/useStore";
import type { Product } from "../types";

export interface StoreOutlet {
  activeCategory: string;
  searchTerm: string;
  setActiveCategory: (category: string) => void;
}

interface ProductListResponse {
  products: Product[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

function useServerProducts(
  query: URLSearchParams,
): { result: ProductListResponse | null; error: string; loading: boolean } {
  const [response, setResponse] = useState<{
    query: string;
    result: ProductListResponse | null;
    error: string;
  } | null>(null);
  const queryString = query.toString();

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ProductListResponse>(`/products?${queryString}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setResponse({ query: queryString, result, error: "" });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setResponse({
          query: queryString,
          result: null,
          error: cause instanceof Error ? cause.message : "The catalogue could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [queryString]);

  const isCurrentQuery = response?.query === queryString;
  return {
    result: isCurrentQuery ? response.result : null,
    error: isCurrentQuery ? response.error : "",
    loading: !isCurrentQuery,
  };
}

export function StorefrontPage() {
  const { activeCategory, searchTerm, setActiveCategory } =
    useOutletContext<StoreOutlet>();
  const [sortOrder, setSortOrder] = useState("featured");
  const [pageState, setPageState] = useState({ scope: "", page: 1 });
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    "Home",
    "Tech",
    "Lifestyle",
    "Accessories",
  ]);
  const [categoryError, setCategoryError] = useState("");
  const scopeKey = [activeCategory, searchTerm, sortOrder, minimumPrice, maximumPrice].join("|");
  const page = pageState.scope === scopeKey ? pageState.page : 1;
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "8",
      sort: sortOrder,
    });
    if (activeCategory !== "Everything") params.set("category", activeCategory);
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (minimumPrice) params.set("minPrice", minimumPrice);
    if (maximumPrice) params.set("maxPrice", maximumPrice);
    return params;
  }, [activeCategory, searchTerm, sortOrder, page, minimumPrice, maximumPrice]);
  const { result, error, loading } = useServerProducts(query);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<string[]>("/categories", { signal: controller.signal })
      .then((result) => {
        setAvailableCategories(result);
        setCategoryError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setCategoryError(cause instanceof Error ? cause.message : "Product categories could not be loaded.");
      });
    return () => controller.abort();
  }, []);
  usePageMetadata(
    "goodthings — Thoughtful everyday goods",
    "Thoughtful objects for slow mornings, good company, and all the in-between.",
  );

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow"><span /> LITTLE THINGS, BIG FEELING</p>
          <h1>A little more<br />everyday <em>joy.</em></h1>
          <p className="hero-copy">
            Thoughtful objects for slow mornings, good company, and all the in-between.
          </p>
          <button
            className="button button-dark"
            type="button"
            onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}
          >
            Find your good thing <span aria-hidden="true">→</span>
          </button>
          <div className="hero-note">
            <span className="hero-note-mark">✳</span>
            <span>Made for real life.<br /><strong>And all its little moments.</strong></span>
          </div>
        </div>
        <div className="hero-art" role="img" aria-label="Sunlit living space with thoughtful home details">
          <div className="hero-sticker">GOOD<br />THINGS<br /><span>LIVE HERE</span></div>
          <div className="hero-caption">Slow down. Look around. Feel good.</div>
        </div>
      </section>

      <section className="shop-section" id="shop">
        <div className="shop-topline">
          <p className="eyebrow">A FEW OF OUR FAVORITES</p>
          <span>Thoughtful by nature, lovely by design.</span>
        </div>
        <div className="shop-heading-row">
          <div>
            <h2>Good things, <em>for you.</em></h2>
            <p className="shop-description">The little upgrades that make a day feel like yours.</p>
          </div>
          <label className="sort-control">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>

        <div className="catalog-controls">
          <div className="filter-row" aria-label="Filter products by category">
            {["Everything", ...new Set(availableCategories)].map((category) => (
              <button
                key={category}
                className={`filter-chip${activeCategory === category ? " selected" : ""}`}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
              >
                {category === "Everything" ? "All good things" : category}
              </button>
            ))}
            <span className="product-count">{result?.pagination.total ?? "—"} little finds</span>
          </div>
          <div className="price-filters">
            <label>
              <span>From $</span>
              <input
                aria-label="Minimum price"
                type="number"
                min="0"
                value={minimumPrice}
                onChange={(event) => setMinimumPrice(event.target.value)}
              />
            </label>
            <label>
              <span>To $</span>
              <input
                aria-label="Maximum price"
                type="number"
                min="0"
                value={maximumPrice}
                onChange={(event) => setMaximumPrice(event.target.value)}
              />
            </label>
          </div>
        </div>

        {(error || categoryError) && <p className="form-error" role="alert">{error || categoryError}</p>}
        {loading && <p className="catalog-loading" role="status">Finding the good things…</p>}
        {!loading && result?.products.length ? (
          <div className="product-grid">
            {result.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : !loading && !error ? (
          <div className="no-results">
            <span aria-hidden="true">✳</span>
            <h3>Nothing just yet.</h3>
            <p>Try a different search or explore all the good things.</p>
            <button
              className="button button-dark"
              type="button"
              onClick={() => {
                setActiveCategory("Everything");
                setMinimumPrice("");
                setMaximumPrice("");
              }}
            >
              Show me everything
            </button>
          </div>
        ) : null}
        {result && result.pagination.pageCount > 1 && (
          <nav className="pagination" aria-label="Product pages">
            <button
              type="button"
              className="button button-light"
              disabled={page <= 1}
              onClick={() => setPageState({ scope: scopeKey, page: page - 1 })}
            >
              ← Previous
            </button>
            <span>Page {page} of {result.pagination.pageCount}</span>
            <button
              type="button"
              className="button button-light"
              disabled={page >= result.pagination.pageCount}
              onClick={() => setPageState({ scope: scopeKey, page: page + 1 })}
            >
              Next →
            </button>
          </nav>
        )}
      </section>
      <section className="promise-strip" aria-label="Our promise">
        <div><span>✳</span><p><strong>Good by design</strong><br />Thoughtful, not throwaway.</p></div>
        <div><span>♡</span><p><strong>Made for real life</strong><br />Useful things, beautifully done.</p></div>
        <div><span>↗</span><p><strong>A little goes a long way</strong><br />Free shipping over $75.</p></div>
      </section>
    </>
  );
}

export function ProductPage() {
  const { slug = "" } = useParams();
  const { addToCart } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Product>(`/products/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setProduct(result);
        setSelectedVariantId("");
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "This product could not be loaded.");
      });
    return () => controller.abort();
  }, [slug]);

  usePageMetadata(
    product ? `${product.name} — goodthings` : "Product — goodthings",
    product?.description ?? "Explore a thoughtful everyday find from goodthings.",
  );

  const selectedVariant = product?.variants.find((variant) => variant.id === selectedVariantId);
  const sizePattern = /^(XS|S|M|L|XL|XXL)(\/(XS|S|M|L|XL|XXL))*$/;
  const hasSizeVariants = product?.variants.some((variant) => sizePattern.test(variant.name)) ?? false;
  const noAvailableVariants = product ? !product.variants.some((variant) => variant.inStock) : false;
  const structuredData = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: [product.image],
        sku: selectedVariant?.sku,
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          price: selectedVariant?.price,
          availability: selectedVariant?.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        },
      }
    : null;

  if (error) return <section className="page-shell"><p className="form-error" role="alert">{error}</p><Link to="/">Back to the shop</Link></section>;
  if (!product) return <section className="page-shell"><p role="status">Finding your good thing…</p></section>;

  return (
    <section className="product-page page-shell">
      {structuredData && (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      )}
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Shop</Link><span aria-hidden="true">/</span><span>{product.category}</span>
      </nav>
      <div className="product-page-layout">
        <div className="product-page-image"><img src={product.image} alt={product.imageAlt} /></div>
        <div className="product-page-info">
          <p className="eyebrow">{product.category.toUpperCase()}</p>
          <h1>{product.name}</h1>
          <p className="product-page-price">{formatPrice(selectedVariant?.price ?? product.price)}</p>
          <p className="product-page-description">{product.description}</p>
          <label className="field-label" htmlFor="variant">
            {hasSizeVariants ? "Choose a size" : "Choose an option"}
          </label>
          <select
            id="variant"
            className="form-control"
            value={selectedVariantId}
            onChange={(event) => {
              setSelectedVariantId(event.target.value);
              setQuantity(1);
            }}
          >
            <option value="" disabled>Select {hasSizeVariants ? "a size" : "an option"}</option>
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={!variant.inStock}>
                {variant.name} · {formatPrice(variant.price)}{variant.inStock ? ` · ${variant.stock} available` : " · Sold out"}
              </option>
            ))}
          </select>
          {selectedVariant && (
            <p className={`stock-status${selectedVariant.stock <= 3 ? " low-stock" : ""}${selectedVariant.stock === 0 ? " out-of-stock" : ""}`}>
              {selectedVariant.stock === 0
                ? "NOT IN STOCK"
                : selectedVariant.stock <= 3
                  ? `Low stock — only ${selectedVariant.stock} left`
                  : `In stock — ${selectedVariant.stock} available`}
            </p>
          )}
          {!selectedVariant && noAvailableVariants && (
            <p className="stock-status out-of-stock">NOT IN STOCK</p>
          )}
          <p className="inventory-demo-note">
            Demo inventory — sample quantities; confirm actual stock in Store admin before taking live orders.
          </p>
          <label className="field-label" htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            className="form-control quantity-input"
            type="number"
            min="1"
            max={Math.min(20, selectedVariant?.stock ?? 1)}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(20, selectedVariant?.stock || 1, Number(event.target.value))))}
          />
          <button
            className="button button-dark add-product-button"
            type="button"
            disabled={!selectedVariant?.inStock || isAdding}
            onClick={() => {
              if (!selectedVariant) return;
              setIsAdding(true);
              void addToCart(product, selectedVariant, quantity)
                .finally(() => setIsAdding(false));
            }}
          >
            {isAdding
              ? "Checking stock…"
              : selectedVariant
                ? selectedVariant.inStock ? "Add to bag" : "NOT IN STOCK"
                : noAvailableVariants
                  ? "NOT IN STOCK"
                  : `Choose ${hasSizeVariants ? "a size" : "an option"}`}
            <span>{formatPrice((selectedVariant?.price ?? product.price) * quantity)}</span>
          </button>
          <p className="shipping-note">Thoughtfully packed. Free delivery on orders over $75.</p>
        </div>
      </div>
    </section>
  );
}

interface OrderReceipt {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  subtotal: number;
  delivery: number;
  total: number;
  items: { productName: string; variantName: string; quantity: number; unitPrice: number }[];
}

function OrderResult({ orderNumber, contact, sessionId, clearCartOnPaid = false }: {
  orderNumber: string;
  contact: string;
  sessionId?: string;
  clearCartOnPaid?: boolean;
}) {
  const { clearCart } = useStore();
  const [order, setOrder] = useState<OrderReceipt | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!orderNumber || (!contact && !sessionId)) return;
    const query = new URLSearchParams();
    if (contact) query.set("contact", contact);
    if (sessionId) query.set("sessionId", sessionId);
    const controller = new AbortController();
    let timer: number | undefined;
    let attempts = 0;
    const loadOrder = () => {
      void apiRequest<OrderReceipt>(
        `/orders/${encodeURIComponent(orderNumber)}?${query}`,
        { signal: controller.signal },
      )
        .then((result) => {
          setOrder(result);
          setError("");
          if (clearCartOnPaid && result.paymentStatus === "paid") clearCart();
          if (
            sessionId &&
            result.paymentStatus === "pending" &&
            attempts < 10
          ) {
            attempts += 1;
            timer = window.setTimeout(loadOrder, 2000);
          }
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : "Order details could not be loaded.");
        });
    };
    loadOrder();
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [orderNumber, contact, sessionId, clearCartOnPaid, clearCart]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!order) return <p role="status">Loading your order…</p>;

  const progressStages = [
    { status: "pending", label: "Order placed" },
    { status: "processing", label: "Processing" },
    { status: "shipped", label: "Shipped" },
    { status: "delivered", label: "Delivered" },
  ];
  const currentStage = progressStages.findIndex((stage) => stage.status === order.status);

  return (
    <div className="order-result">
      <p className="eyebrow">ORDER {order.orderNumber}</p>
      <h2>{order.paymentStatus === "paid" ? "Payment received. Thank you." : "Your order is in good hands."}</h2>
      <p>Status: <strong>{order.status}</strong> · Payment: <strong>{order.paymentStatus}</strong></p>
      {currentStage >= 0 ? (
        <section className="order-progress" aria-label="Delivery progress">
          <p className="eyebrow">DELIVERY PROGRESS</p>
          <ol>
            {progressStages.map((stage, index) => (
              <li
                key={stage.status}
                className={index < currentStage ? "complete" : index === currentStage ? "current" : ""}
                aria-current={index === currentStage ? "step" : undefined}
              >
                <span aria-hidden="true">{index < currentStage ? "✓" : index + 1}</span>
                {stage.label}
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="order-cancelled" role="status">
          This order has been cancelled. No further delivery updates are expected.
        </p>
      )}
      <ul className="receipt-items">
        {order.items.map((item, index) => (
          <li key={`${item.productName}-${index}`}>
            <span>{item.productName} · {item.variantName} × {item.quantity}</span>
            <strong>{formatPrice(item.unitPrice * item.quantity)}</strong>
          </li>
        ))}
      </ul>
      <div className="receipt-total">
        <span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong>
        <span>Delivery</span><strong>{order.delivery ? formatPrice(order.delivery) : "Free"}</strong>
        <span>Total</span><strong>{formatPrice(order.total)}</strong>
      </div>
      <Link
        className="button button-dark"
        to={`/track?order=${encodeURIComponent(order.orderNumber)}${contact ? `&contact=${encodeURIComponent(contact)}` : ""}`}
      >
        Track your order <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function OrderConfirmationPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get("order") ?? "";
  const contact = params.get("contact") ?? "";
  const sessionId = params.get("session_id") ?? "";
  usePageMetadata("Order confirmation — goodthings", "Your goodthings order details.");
  return (
    <section className="page-shell order-page">
      <p className="eyebrow">THANK YOU FOR SHOPPING SMALL</p>
      <OrderResult
        orderNumber={orderNumber}
        contact={contact}
        sessionId={sessionId || undefined}
        clearCartOnPaid
      />
      {!contact && !sessionId && <p className="form-error">Order confirmation details are missing. Use order tracking to look it up.</p>}
    </section>
  );
}

export function TrackingPage() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") ?? "");
  const [contact, setContact] = useState(params.get("contact") ?? "");
  const [lookup, setLookup] = useState<{ orderNumber: string; contact: string } | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  usePageMetadata("Track an order — goodthings", "Look up a goodthings order using its order number and checkout contact.");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderNumber.trim() || !contact.trim()) {
      setValidationMessage("Enter both your order number and the email or phone used at checkout.");
      return;
    }
    setValidationMessage("");
    setLookup({ orderNumber: orderNumber.trim(), contact: contact.trim() });
  }

  return (
    <section className="page-shell order-page">
      <p className="eyebrow">YOUR ORDER, AT A GLANCE</p>
      <h1>Track a good thing.</h1>
      <form className="tracking-form" onSubmit={submit}>
        <label className="field-label" htmlFor="tracking-order">Order number</label>
        <input id="tracking-order" className="form-control" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required />
        <label className="field-label" htmlFor="tracking-contact">Checkout email or phone</label>
        <input id="tracking-contact" className="form-control" value={contact} onChange={(event) => setContact(event.target.value)} autoComplete="off" required />
        {validationMessage && <p className="form-error" role="alert">{validationMessage}</p>}
        <button className="button button-dark" type="submit">Find my order <span aria-hidden="true">→</span></button>
      </form>
      {lookup && <OrderResult orderNumber={lookup.orderNumber} contact={lookup.contact} />}
    </section>
  );
}

export function CheckoutPage() {
  const { cartItems, quote, quoteError, clearCart } = useStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "stripe">("cod");
  const cancelled = new URLSearchParams(useLocation().search).get("cancelled");
  usePageMetadata("Guest checkout — goodthings", "Securely place your goodthings order.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const addressLine2 = String(form.get("addressLine2") ?? "");
    try {
      const result = await apiRequest<{
        orderNumber: string;
        checkoutUrl?: string | null;
        total: number;
      }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          phone: form.get("phone"),
          fullName: form.get("fullName"),
          addressLine1: form.get("addressLine1"),
          addressLine2,
          city: form.get("city"),
          region: form.get("region"),
          postalCode: form.get("postalCode"),
          country: form.get("country"),
          paymentMethod,
          items: cartItems.map(({ variantId, quantity }) => ({ variantId, quantity })),
        }),
      });
      if (paymentMethod === "stripe") {
        if (!result.checkoutUrl) throw new Error("Secure test checkout did not return a payment link.");
        window.location.assign(result.checkoutUrl);
        return;
      }
      clearCart();
      navigate(`/order-confirmation?order=${encodeURIComponent(result.orderNumber)}&contact=${encodeURIComponent(String(form.get("email")))}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your order could not be placed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <section className="page-shell order-page">
        <h1>Your bag is taking a breather.</h1>
        <p>Add something lovely before checking out.</p>
        <Link className="button button-dark" to="/">Back to the shop</Link>
      </section>
    );
  }

  return (
    <section className="page-shell checkout-page">
      <div className="checkout-form-column">
        <p className="eyebrow">A FEW DETAILS AND YOU’RE SET</p>
        <h1>Guest checkout</h1>
        {cancelled && (
          <p className="shipping-note" role="status">
            Payment was cancelled. Your order is still unpaid; you can safely try again.
          </p>
        )}
        <form className="checkout-form" onSubmit={submit}>
          <div className="form-section">
            <h2>Contact</h2>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" name="email" className="form-control" type="email" autoComplete="email" required maxLength={254} />
            <label className="field-label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" className="form-control" type="tel" autoComplete="tel" required minLength={7} maxLength={30} />
          </div>
          <div className="form-section">
            <h2>Delivery address</h2>
            <label className="field-label" htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" className="form-control" autoComplete="name" required maxLength={120} />
            <label className="field-label" htmlFor="addressLine1">Address</label>
            <input id="addressLine1" name="addressLine1" className="form-control" autoComplete="address-line1" required maxLength={180} />
            <label className="field-label" htmlFor="addressLine2">Apartment, suite, etc. (optional)</label>
            <input id="addressLine2" name="addressLine2" className="form-control" autoComplete="address-line2" maxLength={180} />
            <div className="address-grid">
              <div><label className="field-label" htmlFor="city">City</label><input id="city" name="city" className="form-control" autoComplete="address-level2" required maxLength={100} /></div>
              <div><label className="field-label" htmlFor="region">State / region</label><input id="region" name="region" className="form-control" autoComplete="address-level1" required maxLength={100} /></div>
              <div><label className="field-label" htmlFor="postalCode">Postal code</label><input id="postalCode" name="postalCode" className="form-control" autoComplete="postal-code" required maxLength={20} /></div>
              <div><label className="field-label" htmlFor="country">Country</label><input id="country" name="country" className="form-control" autoComplete="country-name" required maxLength={80} /></div>
            </div>
          </div>
          <fieldset className="payment-options">
            <legend>Payment method</legend>
            <label>
              <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
              <span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span>
            </label>
            <label>
              <input type="radio" name="payment" value="stripe" checked={paymentMethod === "stripe"} onChange={() => setPaymentMethod("stripe")} />
              <span><strong>Test card payment</strong><small>Stripe-hosted test checkout. No real charge.</small></span>
            </label>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark checkout-submit" type="submit" disabled={isSubmitting || !quote?.inStock || Boolean(quoteError)}>
            {isSubmitting ? "Placing your order…" : paymentMethod === "stripe" ? "Continue to secure test checkout" : "Place cash-on-delivery order"}
            <span aria-hidden="true">→</span>
          </button>
          {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
        </form>
      </div>
      <aside className="checkout-summary">
        <h2>Your bag</h2>
        {quote?.items.map((item) => (
          <div className="checkout-item" key={item.variantId}>
            <img src={item.productImage} alt="" />
            <div><strong>{item.productName}</strong><span>{item.variantName} × {item.quantity}</span></div>
            <strong>{formatPrice(item.price * item.quantity)}</strong>
          </div>
        ))}
        {!quote && <p>{quoteError || "Checking current prices…"}</p>}
        {quote && (
          <div className="receipt-total">
            <span>Subtotal</span><strong>{formatPrice(quote.subtotal)}</strong>
            <span>Delivery</span><strong>{quote.delivery ? formatPrice(quote.delivery) : "Free"}</strong>
            <span>Total</span><strong>{formatPrice(quote.total)}</strong>
          </div>
        )}
        <p className="checkout-safe">Prices and stock are confirmed by the store before your order is placed.</p>
      </aside>
    </section>
  );
}
