/**
 * Product Service
 * Handles fetching products from the backend API
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  download_file?: string;
  subscription_tier?: string | null;
  pro_subscription_months?: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

/**
 * Fetch all active products from the backend
 */
export async function getActiveProducts(): Promise<Product[]> {
  try {
    const url = `${API_BASE_URL}/api/products?active_only=true`;
    console.log('🔍 Fetching products from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      console.error('❌ Failed to fetch products:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: url
      });
      
      // Provide more specific error messages
      if (response.status === 500) {
        throw new Error('Backend server error. Check backend logs - likely a database connection issue.');
      } else if (response.status === 404) {
        throw new Error('Products endpoint not found. Check if backend is running correctly.');
      }
      
      throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
    }
    
    const products: Product[] = await response.json();
    console.log('✅ Products fetched:', products.length, 'products');
    console.log('📦 Products data:', products);
    
    // Filter for active products (double-check, though backend should already filter)
    const activeProducts = products.filter(p => p.active !== false);
    console.log('✅ Active products:', activeProducts.length);
    
    return activeProducts;
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    console.error('API Base URL:', API_BASE_URL);
    return [];
  }
}

/**
 * Fetch all products (including inactive) from the backend
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Fetch a single product by ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency;
  return `${symbol}${price.toFixed(2)}`;
}

