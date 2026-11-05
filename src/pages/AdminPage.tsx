import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest, ApiError, formatPrice } from "../api/client";
import { usePageMetadata } from "../hooks/usePageMetadata";

interface AdminVariant {
  id?: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  image: string;
  imageAlt: string;
  badge: string | null;
  active: boolean;
  variants: AdminVariant[];
}

interface DashboardData {
  productCount: number;
  orderCount: number;
  sales: number;
  topProducts: { name: string; quantity: number }[];
  recentOrders: {
    orderNumber: string;
    fullName: string;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }[];
}

interface AdminOrder {
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  items: { productName: string; variantName: string; quantity: number }[];
}

const emptyDraft: Omit<AdminProduct, "id"> = {
  slug: "",
  name: "",
  description: "",
  category: "Home",
  image: "",
  imageAlt: "",
  badge: null,
  active: true,
  variants: [{ sku: "", name: "Standard", priceCents: 0, stock: 0 }],
};

function ProductEditor({
  product,
  onCancel,
  onSaved,
}: {
  product: AdminProduct | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Omit<AdminProduct, "id">>(
    product ? {
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      image: product.image,
      imageAlt: product.imageAlt,
      badge: product.badge,
      active: product.active,
      variants: product.variants.map((variant) => ({ ...variant })),
    } : structuredClone(emptyDraft),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateVariant(index: number, patch: Partial<AdminVariant>) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }));
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("image", file);
    setError("");
    try {
      const result = await apiRequest<{ url: string }>("/admin/upload", {
        method: "POST",
        body,
      });
      setDraft((current) => ({ ...current, image: result.url }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest<AdminProduct>(
        product ? `/admin/products/${product.id}` : "/admin/products",
        {
          method: product ? "PUT" : "POST",
          body: JSON.stringify({
            ...draft,
            variants: draft.variants.map((variant) => ({
              ...variant,
              priceCents: Math.round(Number(variant.priceCents)),
              stock: Math.round(Number(variant.stock)),
            })),
          }),
        },
      );
      onSaved(product ? "Product updated." : "Product added.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The product could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-editor" onSubmit={save}>
      <div className="admin-section-heading">
        <h2>{product ? "Edit product" : "Add a product"}</h2>
        <button className="button button-light" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <div className="address-grid">
        <div><label className="field-label" htmlFor="admin-name">Name</label><input id="admin-name" className="form-control" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={140} /></div>
        <div><label className="field-label" htmlFor="admin-slug">URL slug</label><input id="admin-slug" className="form-control" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} required /></div>
        <div><label className="field-label" htmlFor="admin-category">Category</label><input id="admin-category" className="form-control" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required maxLength={80} /></div>
        <div><label className="field-label" htmlFor="admin-badge">Badge (optional)</label><input id="admin-badge" className="form-control" value={draft.badge ?? ""} onChange={(event) => setDraft({ ...draft, badge: event.target.value || null })} maxLength={40} /></div>
      </div>
      <label className="field-label" htmlFor="admin-description">Description</label>
      <textarea id="admin-description" className="form-control admin-textarea" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} required minLength={10} maxLength={5000} />
      <label className="field-label" htmlFor="admin-image">Image URL</label>
      <input id="admin-image" className="form-control" value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} required maxLength={1000} />
      <label className="field-label" htmlFor="admin-image-upload">Or upload an image (JPEG, PNG, WebP or AVIF, up to 5 MB)</label>
      <input id="admin-image-upload" className="form-control file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage(event)} />
      <label className="field-label" htmlFor="admin-image-alt">Accessible image description</label>
      <input id="admin-image-alt" className="form-control" value={draft.imageAlt} onChange={(event) => setDraft({ ...draft, imageAlt: event.target.value })} required minLength={5} maxLength={240} />
      <div className="admin-variants">
        <div className="admin-section-heading"><h3>Variants and stock</h3><button className="button button-light" type="button" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, { sku: "", name: "", priceCents: 0, stock: 0 }] }))}>Add variant +</button></div>
        {draft.variants.map((variant, index) => (
          <div className="admin-variant-row" key={variant.id ?? index}>
            <label><span>Option</span><input className="form-control" value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} required maxLength={80} /></label>
            <label><span>SKU</span><input className="form-control" value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} required maxLength={80} /></label>
            <label><span>Price ($)</span><input className="form-control" type="number" min="0.01" step="0.01" value={(variant.priceCents / 100).toFixed(2)} onChange={(event) => updateVariant(index, { priceCents: Math.round(Number(event.target.value) * 100) })} required /></label>
            <label><span>Stock</span><input className="form-control" type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) })} required /></label>
            <button type="button" className="remove-variant" disabled={draft.variants.length <= 1} aria-label={`Remove ${variant.name || "variant"}`} onClick={() => setDraft((current) => ({ ...current, variants: current.variants.filter((_, variantIndex) => variantIndex !== index) }))}>×</button>
          </div>
        ))}
      </div>
      <label className="admin-active-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Visible in the storefront</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Saving…" : "Save product"} <span aria-hidden="true">→</span></button>
    </form>
  );
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "orders">("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  usePageMetadata("Store admin — goodthings", "Sign in to manage goodthings products, inventory, and orders.");

  useEffect(() => {
    void apiRequest<{ email: string }>("/admin/me")
      .then((user) => {
        setAdminEmail(user.email);
        setIsAuthenticated(true);
      })
      .catch((cause: unknown) => {
        setIsAuthenticated(false);
        if (cause instanceof ApiError && cause.status === 401) return;
        setError(cause instanceof Error ? cause.message : "The admin service could not be reached.");
      })
      .finally(() => setIsChecking(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    void Promise.all([
      apiRequest<DashboardData>("/admin/dashboard", { signal: controller.signal }),
      apiRequest<AdminProduct[]>("/admin/products", { signal: controller.signal }),
      apiRequest<{ orders: AdminOrder[] }>("/admin/orders", { signal: controller.signal }),
    ])
      .then(([dashboardData, productData, orderData]) => {
        setDashboard(dashboardData);
        setProducts(productData);
        setOrders(orderData.orders);
        setError("");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof Error && "status" in cause && cause.status === 401) {
          setIsAuthenticated(false);
          setError("Your admin session expired. Please sign in again.");
          return;
        }
        setError(cause instanceof Error ? cause.message : "The admin dashboard could not be loaded.");
      });
    return () => controller.abort();
  }, [isAuthenticated, refreshKey]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoggingIn(true);
    try {
      const result = await apiRequest<{ email: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAdminEmail(result.email);
      setIsAuthenticated(true);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await apiRequest<void>("/admin/logout", { method: "POST" });
      setIsAuthenticated(false);
      setDashboard(null);
      setProducts([]);
      setOrders([]);
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function changeOrderStatus(orderNumber: string, status: string) {
    setError("");
    try {
      await apiRequest(`/admin/orders/${encodeURIComponent(orderNumber)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage(`Order ${orderNumber} updated.`);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The order status could not be updated.");
    }
  }

  if (isChecking) return <main className="admin-page"><p role="status">Checking your admin session…</p></main>;
  if (!isAuthenticated) {
    return (
      <main className="admin-page">
        <section className="admin-login">
          <p className="eyebrow">GOODTHINGS OWNER AREA</p>
          <h1>Welcome back.</h1>
          <p>Sign in to manage your products and orders.</p>
          <form onSubmit={login}>
            <label className="field-label" htmlFor="admin-email">Email</label>
            <input id="admin-email" className="form-control" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label className="field-label" htmlFor="admin-password">Password</label>
            <input id="admin-password" className="form-control" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-dark" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in…" : "Sign in"} <span aria-hidden="true">→</span>
            </button>
          </form>
          <Link to="/">Back to storefront</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">GOODTHINGS OWNER AREA</p><h1>Your store, at a glance.</h1><p>Signed in as {adminEmail}</p></div>
        <button className="button button-light" type="button" disabled={isLoggingOut} onClick={() => void logout()}>
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </button>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="shipping-note" role="status">{message}</p>}
      <nav className="admin-tabs" aria-label="Admin sections">
        {(["overview", "products", "orders"] as const).map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? "admin-tab active" : "admin-tab"} onClick={() => { setActiveTab(tab); setShowEditor(false); }}>
            {tab[0].toUpperCase()}{tab.slice(1)}
          </button>
        ))}
      </nav>
      {activeTab === "overview" && dashboard && (
        <section className="admin-overview">
          <div className="admin-stats">
            <article><span>Active products</span><strong>{dashboard.productCount}</strong></article>
            <article><span>All orders</span><strong>{dashboard.orderCount}</strong></article>
            <article><span>Paid sales</span><strong>{formatPrice(dashboard.sales)}</strong></article>
          </div>
          <div className="admin-overview-grid">
            <section className="admin-panel"><h2>Top products</h2>{dashboard.topProducts.length ? <ol>{dashboard.topProducts.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.quantity} sold</strong></li>)}</ol> : <p>Paid sales will appear here.</p>}</section>
            <section className="admin-panel"><h2>Recent orders</h2>{dashboard.recentOrders.map((order) => <div className="admin-recent-order" key={order.orderNumber}><span>{order.orderNumber}<small>{order.fullName}</small></span><strong>{formatPrice(order.total)}</strong></div>)}</section>
          </div>
        </section>
      )}
      {activeTab === "products" && (
        <section className="admin-panel admin-list">
          {!showEditor ? (
            <>
              <div className="admin-section-heading"><h2>Products ({products.length})</h2><button className="button button-dark" type="button" onClick={() => { setEditingProduct(null); setShowEditor(true); }}>Add a product <span aria-hidden="true">+</span></button></div>
              <div className="admin-product-list">
                {products.map((product) => (
                  <article className="admin-product-row" key={product.id}>
                    <img src={product.image} alt="" />
                    <div><h3>{product.name}</h3><p>{product.category} · {product.variants.length} variant(s) · {product.variants.reduce((sum, variant) => sum + variant.stock, 0)} in stock</p></div>
                    <span className={product.active ? "status-pill status-active" : "status-pill"}>{product.active ? "Live" : "Hidden"}</span>
                    <button className="button button-light" type="button" onClick={() => { setEditingProduct(product); setShowEditor(true); }}>Edit</button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <ProductEditor
              product={editingProduct}
              onCancel={() => setShowEditor(false)}
              onSaved={(savedMessage) => {
                setShowEditor(false);
                setMessage(savedMessage);
                setRefreshKey((key) => key + 1);
              }}
            />
          )}
        </section>
      )}
      {activeTab === "orders" && (
        <section className="admin-panel admin-list">
          <h2>Orders ({orders.length})</h2>
          <div className="admin-order-list">
            {orders.map((order) => (
              <article className="admin-order-row" key={order.orderNumber}>
                <div className="admin-order-summary"><strong>{order.orderNumber}</strong><span>{order.fullName} · {order.email} · {order.phone}</span><span>{formatPrice(order.total)} · {order.paymentMethod} · {order.paymentStatus}</span><small>{order.items.map((item) => `${item.productName} (${item.variantName}) × ${item.quantity}`).join(" · ")}</small></div>
                <label className="status-control"><span>Order status</span><select value={order.status} disabled={order.status === "cancelled" || order.status === "delivered" || (order.paymentMethod === "stripe" && order.paymentStatus !== "paid")} onChange={(event) => void changeOrderStatus(order.orderNumber, event.target.value)}><option value="pending">Awaiting test payment</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label>
              </article>
            ))}
            {!orders.length && <p>No orders yet.</p>}
          </div>
        </section>
      )}
    </main>
  );
}
