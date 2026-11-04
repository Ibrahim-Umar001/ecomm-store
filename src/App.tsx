import { useState } from "react";
import {
  BrowserRouter,
  Link,
  useLocation,
  useNavigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import CartDrawer from "./components/CartDrawer";
import StoreHeader from "./components/StoreHeader";
import AdminPage from "./pages/AdminPage";
import {
  CheckoutPage,
  OrderConfirmationPage,
  ProductPage,
  StorefrontPage,
  TrackingPage,
  type StoreOutlet,
} from "./pages/StorePages";
import { StoreProvider } from "./store/StoreContext";
import { useStore } from "./store/useStore";

function StoreLayout() {
  const [activeCategory, setActiveCategory] = useState("Everything");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const outletContext: StoreOutlet = {
    activeCategory,
    searchTerm,
    setActiveCategory,
  };

  return (
    <>
      <StoreHeader
        cartCount={store.cartCount}
        activeCategory={activeCategory}
        onCategoryChange={(category) => {
          setActiveCategory(category);
          if (location.pathname !== "/") navigate("/");
        }}
        onCartOpen={() => setIsCartOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term);
          if (term && location.pathname !== "/") navigate("/");
        }}
      />
      <main>
        <Outlet context={outletContext} />
      </main>
      <footer className="site-footer">
        <Link className="brand" to="/">goodthings<span>.</span></Link>
        <p>Make room for the things that make you feel good.</p>
        <div className="footer-links">
          <Link to="/track">Track an order</Link>
          <Link to="/admin">Store admin</Link>
        </div>
        <span>© 2026 goodthings studio</span>
      </footer>
      <p className="sr-only" aria-live="polite">{store.announcement}</p>
      {isCartOpen && (
        <CartDrawer
          items={store.cartItems}
          quote={store.quote}
          quoteError={store.quoteError}
          onClose={() => setIsCartOpen(false)}
          onChangeQuantity={store.changeQuantity}
        />
      )}
    </>
  );
}

function StoreApplication() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<StorefrontPage />} />
            <Route path="products/:slug" element={<ProductPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="order-confirmation" element={<OrderConfirmationPage />} />
            <Route path="track" element={<TrackingPage />} />
          </Route>
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<main className="page-shell"><h1>That page wandered off.</h1><Link to="/">Back to good things</Link></main>} />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}

export default function App() {
  return <StoreApplication />;
}
