export type Role = "admin" | "store" | "driver" | "customer";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Product {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  price: string | number;
  in_stock: boolean;
}
export interface Store {
  id: string;
  category_id?: string | null;
  name: string;
  address: string;
  category_name?: string;
  distance_km?: number | null;
  rating?: string | number;
  delivery_fee?: string | number;
  estimated_delivery_minutes?: number;
  image_url?: string | null;
  created_at?: string;
}
export interface Category { id: string; name: string; icon_url?: string | null }
export interface Order {
  id: string;
  store_id: string;
  store_name?: string;
  store_address?: string;
  store_latitude?: number | null;
  store_longitude?: number | null;
  status: string;
  delivery_address: string;
  delivery_id?: string;
  total: string | number;
  items?: Array<{ id: string; productName: string; quantity: number }>;
}
