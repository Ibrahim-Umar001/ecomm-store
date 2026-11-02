import type { Product } from "../types";

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <article className="product-card">
      <div className="product-image-wrap" style={{ backgroundColor: product.color }}>
        <img className="product-image" src={product.image} alt={product.imageAlt} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button
          className="quick-add"
          type="button"
          onClick={() => onAdd(product)}
          aria-label={`Add ${product.name} to bag`}
        >
          <span aria-hidden="true">+</span>
          <span>Add to bag</span>
        </button>
      </div>
      <div className="product-details">
        <div>
          <p className="product-category">{product.category}</p>
          <h3>{product.name}</h3>
          <p className="product-rating">
            <span aria-hidden="true">★</span> {product.rating.toFixed(1)}
            <span className="review-count">({product.reviewCount})</span>
          </p>
        </div>
        <p className="product-price">${product.price.toFixed(2)}</p>
      </div>
    </article>
  );
}
