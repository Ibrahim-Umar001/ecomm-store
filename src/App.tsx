import { useMemo, useState } from "react";
import CartDrawer from "./components/CartDrawer";
import ProductCard from "./components/ProductCard";
import StoreHeader from "./components/StoreHeader";
import { categories, products, type ProductFilter } from "./data/products";
import type { CartItem, Product } from "./types";

type SortOrder = "featured" | "price-low" | "price-high";

export default function App() {
  const [activeCategory, setActiveCategory] = useState<ProductFilter>("Everything");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("featured");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const visibleProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory =
        activeCategory === "Everything" || product.category === activeCategory;
      const matchesSearch =
        !query ||
        `${product.name} ${product.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });

    if (sortOrder === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sortOrder === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [activeCategory, searchTerm, sortOrder]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    setCartItems((currentItems) => {
      const existing = currentItems.find((item) => item.product.id === product.id);
      if (existing) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...currentItems, { product, quantity: 1 }];
    });
    setAnnouncement(`${product.name} added to your bag.`);
    window.setTimeout(() => setAnnouncement(""), 3000);
  }

  function changeQuantity(productId: string, change: number) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  return (
    <>
      <StoreHeader
        cartCount={cartCount}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onCartOpen={() => setIsCartOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      <main>
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
              onClick={() => {
                setActiveCategory("Everything");
                document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
              }}
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
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>

          <div className="filter-row" aria-label="Filter products by category">
            {categories.map((category) => (
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
            <span className="product-count">{visibleProducts.length} little finds</span>
          </div>

          {visibleProducts.length > 0 ? (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} />
              ))}
            </div>
          ) : (
            <div className="no-results">
              <span aria-hidden="true">✳</span>
              <h3>Nothing just yet.</h3>
              <p>Try a different search or explore all the good things.</p>
              <button
                className="button button-dark"
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setActiveCategory("Everything");
                }}
              >
                Show me everything
              </button>
            </div>
          )}
        </section>
        <section className="promise-strip" aria-label="Our promise">
          <div><span>✳</span><p><strong>Good by design</strong><br />Thoughtful, not throwaway.</p></div>
          <div><span>♡</span><p><strong>Made for real life</strong><br />Useful things, beautifully done.</p></div>
          <div><span>↗</span><p><strong>A little goes a long way</strong><br />Free shipping over $75.</p></div>
        </section>
      </main>
      <footer className="site-footer">
        <a className="brand" href="#" aria-label="goodthings home">goodthings<span>.</span></a>
        <p>Make room for the things that make you feel good.</p>
        <span>© 2026 goodthings studio</span>
      </footer>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {isCartOpen && (
        <CartDrawer
          items={cartItems}
          onClose={() => setIsCartOpen(false)}
          onChangeQuantity={changeQuantity}
        />
      )}
    </>
  );
}
