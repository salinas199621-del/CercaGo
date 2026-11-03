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
  stock_quantity?: number;
}
export interface Store {
  id: string;
  category_id?: string | null;
  name: string;
  address: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  category_name?: string;
  distance_km?: number | null;
  rating?: string | number;
  delivery_fee?: string | number;
  free_delivery?: boolean;
  has_own_delivery?: boolean;
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
  driver_id?: string | null;
  total: string | number;
  exchange_rate?: string | number | null;
  has_own_delivery?: boolean;
  has_review?: boolean;
  subtotal?: string | number;
  delivery_fee?: string | number;
  payment_bank?: string | null;
  payment_document?: string | null;
  payment_phone?: string | null;
  items?: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice?: string | number;
    lineTotal?: string | number;
  }>;
}
export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: Role;
  message: string;
  attachment_url?: string | null;
  payment_reference?: string | null;
  created_at: string;
}
export interface Address {
  id: string;
  label: string;
  address_line: string;
  latitude?: number | null;
  longitude?: number | null;
  instructions?: string | null;
  is_default?: boolean;
}
