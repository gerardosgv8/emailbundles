import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { getActiveProducts, formatPrice, Product } from '../../services/productService';

export const PricingSection: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const activeProducts = await getActiveProducts();
      setProducts(activeProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get the first product (or default if none)
  const primaryProduct = products[0] || null;

  return (
    <section id="pricing" className="bg-white border-t py-12">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h3 className="text-2xl font-semibold">Pricing</h3>
        <p className="text-gray-600 mt-2">One-time payment — lifetime access. Free updates and documentation included.</p>

        {loading ? (
          <div className="mt-8 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="mt-8 space-y-6">
            {products.map((product) => (
              <div key={product.id} className="bg-gray-50 rounded-lg p-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-left">
                    <h4 className="text-xl font-semibold">{product.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{product.description || 'All templates + documentation + support'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold">{formatPrice(product.price, product.currency)}</div>
                    <div className="text-sm text-gray-500">one-time</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link 
                    to="/register" 
                    className="btn-cta btn-lg group"
                  >
                    Create Account
                  </Link>
                  <Link to="/docs" className="btn-outline btn-lg group">
                    View docs
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 bg-gray-50 rounded-lg p-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-left">
                <h4 className="text-xl font-semibold">19/20 HTML Email Template Bundle</h4>
                <p className="text-sm text-gray-600 mt-1">All templates + documentation + support</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold">$79</div>
                <div className="text-sm text-gray-500">one-time</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register" className="btn-cta btn-lg group">
                Create Account
              </Link>
              <Link to="/docs" className="btn-outline btn-lg group">
                View docs
              </Link>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-600">
          7-day money-back guarantee • Licensed for one brand or project
        </div>
      </div>
    </section>
  );
};
