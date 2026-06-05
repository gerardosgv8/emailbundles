import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { getActiveProducts, formatPrice, Product } from '../../services/productService';

export const HeroSection: React.FC = () => {
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
  const productName = primaryProduct?.name || '19/20 HTML Email Template Bundle';
  const productPrice = primaryProduct ? formatPrice(primaryProduct.price, primaryProduct.currency) : '$79';
  const registerUrl = '/register';

  return (
    <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
          Beautiful, Outlook-proof email templates for eCommerce marketers.
        </h1>
        <p className="mt-6 text-gray-600 text-lg">
          Launch high-performing campaigns in minutes — no designer required. The{' '}
          <span className="font-semibold">{productName}</span>{' '}
          gives small businesses enterprise-level design, ready to plug into your ESP (Salesforce, Klaviyo, Mailchimp, and more).
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link to={registerUrl} className="btn-cta btn-lg group">
            Get the Bundle — {productPrice}
          </Link>
          <a href="#templates" className="btn-outline btn-lg group">
            See all templates
          </a>
        </div>

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600">
          <li>✅ Outlook-optimized</li>
          <li>✅ ESP-ready (Salesforce, Klaviyo)</li>
          <li>✅ 19 production-grade templates</li>
        </ul>

        <div className="mt-8 flex items-center gap-4">
          <img src="https://via.placeholder.com/64" alt="user" className="rounded-full" />
          <div>
            <p className="text-sm text-gray-700">
              "These templates made our small brand's campaigns look like Nike's."
            </p>
            <p className="text-xs text-gray-500 mt-1">— Daniela, Growth Manager</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-4 overflow-hidden">
          <img
            src="/Email_showcase1.svg"
            alt="Email template showcase"
            className="w-full h-auto rounded-md"
          />
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h4 className="font-semibold">Why it works</h4>
          <p className="mt-2 text-sm text-gray-600">
            Optimized HTML, bulletproof Outlook buttons, and modular sections let you assemble campaigns fast and keep brand consistency across sends.
          </p>
        </div>
      </div>
    </section>
  );
};
