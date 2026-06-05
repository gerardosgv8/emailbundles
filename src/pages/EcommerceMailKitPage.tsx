import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stripe_price_id?: string;
  active: boolean;
}

export const EcommerceMailKitPage: React.FC = () => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/products?active_only=true');
      if (response.ok) {
        const data = await response.json();
        // Find product or use first one
        const kitProduct = data.find((p: Product) => 
          p.name.toLowerCase().includes('ecommerce mail kit')
        ) || data[0];
        setProduct(kitProduct);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
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
            <Link to="/products" className="hover:text-primary">Products</Link>
            <Link to="/docs" className="hover:text-primary">Docs</Link>
            <Link to="/register" className="btn btn-sm">Register</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center">
              <h1 className="text-5xl font-bold mb-6">The Ecommerce Mail Kit</h1>
              <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
                Professional email templates designed specifically for e-commerce businesses. 
                Increase engagement, drive sales, and build lasting customer relationships.
              </p>
              {product && (
                <div className="flex items-center justify-center gap-4 mb-8">
                  <span className="text-4xl font-extrabold">
                    {product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}
                  </span>
                  <span className="text-blue-200">One-time payment</span>
                </div>
              )}
              <Link
                to="/register"
                className="inline-block bg-white text-blue-700 font-bold py-4 px-8 rounded-lg text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl"
              >
                Register and Get Started →
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need</h2>
              <p className="text-gray-600 text-lg">Complete email marketing solution for your e-commerce store</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gray-50 rounded-lg p-8">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📧</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Transaction Emails</h3>
                <p className="text-gray-600">
                  Order confirmations, shipping updates, delivery notifications, and more.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🎨</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Promotional Campaigns</h3>
                <p className="text-gray-600">
                  Beautiful templates for sales, newsletters, product launches, and special offers.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🔧</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Easy Customization</h3>
                <p className="text-gray-600">
                  Fully responsive designs that work on any device. Easy to customize to match your brand.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Ready to Use</h3>
                <p className="text-gray-600">
                  No coding required. Copy, paste, and send. Works with any email service provider.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Proven Templates</h3>
                <p className="text-gray-600">
                  Tested with real customers. Industry best practices built into every template.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📚</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Full Documentation</h3>
                <p className="text-gray-600">
                  Step-by-step guides, examples, and tips to help you succeed with email marketing.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing CTA */}
        <section className="py-20 bg-gray-100">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-gray-600 mb-8">
              Join thousands of e-commerce businesses using professional email templates
            </p>
            
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            ) : product ? (
              <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h3>
                <p className="text-gray-600 mb-6">{product.description}</p>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <span className="text-5xl font-extrabold text-blue-600">
                    {product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}
                  </span>
                  <span className="text-gray-500">one-time</span>
                </div>
                <Link
                  to="/register"
                  className="block w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors mb-4"
                >
                  Create Account
                </Link>
                <p className="text-sm text-gray-500">Instant download • Lifetime access • Free updates</p>
              </div>
            ) : null}

            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <span className="text-green-500">✓</span>
                <span>30-day money-back guarantee</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Lifetime updates included</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Commercial license</span>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Trusted by E-commerce Businesses</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {'★'.repeat(5)}
                  </div>
                </div>
                <p className="text-gray-700 mb-4">
                  "These templates saved us hours of design time. Professional, clean, and they actually convert!"
                </p>
                <p className="text-sm font-semibold text-gray-900">Sarah Chen, Store Owner</p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {'★'.repeat(5)}
                  </div>
                </div>
                <p className="text-gray-700 mb-4">
                  "The transaction emails are perfect. Our customers love the clarity and professional look."
                </p>
                <p className="text-sm font-semibold text-gray-900">Michael Rodriguez, Marketing Director</p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {'★'.repeat(5)}
                  </div>
                </div>
                <p className="text-gray-700 mb-4">
                  "Best investment for our email marketing. ROI was immediate with better open rates."
                </p>
                <p className="text-sm font-semibold text-gray-900">Emily Johnson, E-commerce Manager</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center text-blue-600 font-bold">ET</div>
                <span className="font-semibold">EmailTemplateBundle</span>
              </div>
              <p className="text-gray-400 text-sm">
                Professional email templates for e-commerce businesses.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/products" className="hover:text-white">All Products</Link></li>
                <li><Link to="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link to="/register" className="hover:text-white">Register</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Resources</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/docs" className="hover:text-white">Getting Started</Link></li>
                <li><a href="#" className="hover:text-white">Best Practices</a></li>
                <li><a href="#" className="hover:text-white">Examples</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="mailto:support@emailtemplatebundle.com" className="hover:text-white">Email Support</a></li>
                <li><Link to="/docs" className="hover:text-white">Documentation</Link></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} EmailTemplateBundle. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

