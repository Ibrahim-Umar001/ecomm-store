import type { ProductFilter } from "../data/products";

interface StoreHeaderProps {
  cartCount: number;
  activeCategory: ProductFilter;
  onCategoryChange: (category: ProductFilter) => void;
  onCartOpen: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const navigation: ProductFilter[] = [
  "Everything",
  "Home",
  "Tech",
  "Lifestyle",
  "Accessories",
];

export default function StoreHeader({
  cartCount,
  activeCategory,
  onCategoryChange,
  onCartOpen,
  searchTerm,
  onSearchChange,
}: StoreHeaderProps) {
  return (
    <>
      <div className="announcement">
        A little something for you: free shipping on orders over $75
        <span aria-hidden="true"> ✳</span>
      </div>
      <header className="site-header">
        <div className="header-main">
          <a className="brand" href="#" aria-label="goodthings home">
            goodthings<span>.</span>
          </a>
          <label className="search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              placeholder="Find your good thing"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search products"
            />
            <span className="search-shortcut">⌘ K</span>
          </label>
          <div className="header-actions">
            <button className="account-link" type="button" aria-label="Your account">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c.5-3.5 3.2-5.5 7-5.5s6.5 2 7 5.5" />
              </svg>
              <span>Account</span>
            </button>
            <button
              className="cart-button"
              type="button"
              onClick={onCartOpen}
              aria-label={`Open bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8h14l1 12H4L5 8Z" />
                <path d="M9 9V6a3 3 0 0 1 6 0v3" />
              </svg>
              <span>Bag</span>
              <span className="cart-count" aria-live="polite">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
        <nav className="category-nav" aria-label="Shop categories">
          {navigation.map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? "nav-link active" : "nav-link"}
              onClick={() => onCategoryChange(category)}
              aria-current={activeCategory === category ? "page" : undefined}
            >
              {category === "Everything" ? "Shop all" : category}
            </button>
          ))}
          <span className="nav-note">Good things, made to last.</span>
        </nav>
      </header>
    </>
  );
}
