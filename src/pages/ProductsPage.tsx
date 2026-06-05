import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getActiveProducts, formatPrice, Product } from '../services/productService';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const STRIPE_NODE_URL = import.meta.env.VITE_STRIPE_NODE_URL || 'http://localhost:3001';

async function checkBackendHealth(): Promise<{
  connected: boolean;
  productsCount: number;
  error?: string;
}> {
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
    if (!healthResponse.ok) {
      return {
        connected: false,
        productsCount: 0,
        error: `Health check failed: ${healthResponse.status} ${healthResponse.statusText}`,
      };
    }

    const productsResponse = await fetch(`${API_BASE_URL}/api/products?active_only=true`);
    if (!productsResponse.ok) {
      return {
        connected: false,
        productsCount: 0,
        error: `Products endpoint failed: ${productsResponse.status} ${productsResponse.statusText}`,
      };
    }

    const products = await productsResponse.json();
    return {
      connected: true,
      productsCount: Array.isArray(products) ? products.length : 0,
    };
  } catch (error: unknown) {
    return {
      connected: false,
      productsCount: 0,
      error: error instanceof Error ? error.message : 'Failed to connect to backend',
    };
  }
}

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      console.log('🔄 ProductsPage: Fetching products...');
      
      // Test backend connection first
      const connectionTest = await checkBackendHealth();
      console.log('🔍 Backend connection test:', connectionTest);
      
      if (!connectionTest.connected) {
        setConnectionError(connectionTest.error || 'Failed to connect to backend');
        console.error('❌ Backend connection failed:', connectionTest.error);
        setLoading(false);
        return;
      }

      if (connectionTest.productsCount === 0) {
        console.warn('⚠️ Backend connected but no products found in database');
        setConnectionError('No products found in database. Please add products in the admin panel.');
      }

      const activeProducts = await getActiveProducts();
      console.log('🔄 ProductsPage: Received products:', activeProducts);
      setProducts(activeProducts);
    } catch (error) {
      console.error('❌ ProductsPage: Error fetching products:', error);
      setConnectionError('Failed to fetch products. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const startStripeCheckout = async (product: Product) => {
    setCheckoutLoadingId(product.id);
    try {
      const body: Record<string, unknown> = {
        productId: product.id,
        cancelUrl: '/products',
        proSubscriptionMonths: product.pro_subscription_months ?? undefined,
      };
      const email = user?.email?.trim();
      if (email) {
        body.customerEmail = email;
        body.customerName = user?.username || email.split('@')[0];
      }

      const response = await fetch(`${STRIPE_NODE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || 'Could not start checkout');
      }
      const url = (data as { url?: string }).url;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e) {
      console.error('Checkout error:', e);
      alert(e instanceof Error ? e.message : 'Could not start checkout. Is the Stripe server running on port 3001?');
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold">ET</div>
            <span className="font-semibold">EmailTemplateBundle</span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center text-sm">
            <Link to="/" className="hover:text-primary">Home</Link>
            <Link to="/products" className="hover:text-primary font-semibold">Products</Link>
            <Link to="/docs" className="hover:text-primary">Docs</Link>
            <Link to="/register" className="btn btn-sm">Register</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Products</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the perfect solution for your business needs
          </p>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{product.name}</h3>
                  <p className="text-gray-600 mb-6 min-h-[60px]">{product.description}</p>
                  
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatPrice(product.price, product.currency)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => startStripeCheckout(product)}
                    disabled={checkoutLoadingId !== null}
                    className="block w-full text-center bg-blue-500 text-white py-3 px-4 rounded-md font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {checkoutLoadingId === product.id ? 'Redirecting…' : 'Checkout with Stripe'}
                  </button>
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Instant Download</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Lifetime Access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Free Updates</span>
                    </li>
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">No Products Available</h3>
            {connectionError ? (
              <div className="mt-4">
                <p className="text-red-600 mb-2">{connectionError}</p>
                <p className="text-sm text-gray-600">
                  Make sure:
                  <br />• Backend server is running on port 3002
                  <br />• Products are added in the admin panel
                  <br />• Database connection is configured
                </p>
              </div>
            ) : (
              <p className="text-gray-600">Check back soon for new products!</p>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-20">
        <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
          <div>
            <h5 className="font-semibold mb-4">EmailTemplateBundle</h5>
            <p className="text-sm text-gray-600">
              Production-ready HTML email templates for small eCommerce teams.
            </p>
          </div>
          <div>
            <h5 className="font-semibold mb-4">Quick Links</h5>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-600 hover:text-primary">Home</Link></li>
              <li><Link to="/products" className="text-gray-600 hover:text-primary">Products</Link></li>
              <li><Link to="/docs" className="text-gray-600 hover:text-primary">Documentation</Link></li>
              <li><Link to="/register" className="text-gray-600 hover:text-primary">Register</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold mb-4">Support</h5>
            <p className="text-sm text-gray-600">
              Need help? Check out our documentation or contact support.
            </p>
          </div>
        </div>
        <div className="border-t mt-8">
          <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} EmailTemplateBundle. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

