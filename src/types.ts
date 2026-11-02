export type Category = "Home" | "Tech" | "Lifestyle" | "Accessories";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  image: string;
  imageAlt: string;
  badge?: string;
  rating: number;
  reviewCount: number;
  color: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
