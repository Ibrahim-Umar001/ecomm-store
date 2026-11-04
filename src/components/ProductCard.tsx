import type { Product } from "../types";
import { Link } from "react-router-dom";
import { formatPrice } from "../api/client";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const totalStock = product.variants.reduce((total, variant) => total + variant.stock, 0);

  return (
    <article className="product-card">
      <div className="product-card-media">
        <Link className="product-image-link" to={`/products/${product.slug}`}>
          <div className="product-image-wrap">
            <img className="product-image" src={product.image} alt={product.imageAlt} loading="lazy" />
            {product.badge && <span className="product-badge">{product.badge}</span>}
          </div>
        </Link>
        {totalStock > 0 ? (
          <Link
            className="quick-add"
            to={`/products/${product.slug}`}
            aria-label={`Choose a size or option for ${product.name}`}
          >
            <span aria-hidden="true">↗</span>
            <span>Choose size / option</span>
          </Link>
        ) : (
          <span className="product-sold-out">NOT IN STOCK</span>
        )}
      </div>
      <div className="product-details">
        <div>
          <p className="product-category">{product.category}</p>
          <h3><Link to={`/products/${product.slug}`}>{product.name}</Link></h3>
          <p className="product-variant-count">
            Demo stock: {totalStock > 0
              ? totalStock <= 3 ? `Low stock — ${totalStock} left` : `${totalStock} available`
              : "NOT IN STOCK"}
          </p>
        </div>
        <p className="product-price">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
