import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { getActiveProducts, formatPrice, Product } from '../../services/productService';

export const CheckoutSection: React.FC = () => {
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

  const primaryProduct = products[0];
  const productPrice = primaryProduct ? formatPrice(primaryProduct.price, primaryProduct.currency) : '$79';
  const registerUrl = '/register';

  return (
    <section id="checkout" className="max-w-4xl mx-auto px-6 py-12">
      <div className="bg-white p-8 rounded-lg shadow-sm">
        <h3 className="text-xl font-semibold">Create your account</h3>
        <p className="text-sm text-gray-600 mt-2">No payment required • Lifetime Pro features</p>

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form className="mt-6 grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Full name" 
                className="border rounded-md px-3 py-2" 
              />
              <input 
                type="email" 
                placeholder="Email" 
                className="border rounded-md px-3 py-2" 
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Payment</label>
              <div className="mt-2 border rounded-md px-3 py-2 text-sm text-gray-500">
                Payment is disabled in this version. Registration grants Pro automatically.
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input id="agree" type="checkbox" className="h-4 w-4" />
              <label htmlFor="agree" className="text-sm text-gray-700">
                I agree to the <a href="#" className="text-primary">terms</a> and{' '}
                <a href="#" className="text-primary">privacy policy</a>.
              </label>
            </div>

            <Link to={registerUrl} className="btn-cta btn-lg group text-center">
              Register
            </Link>
          </form>
        )}
      </div>
    </section>
  );
};
