import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  pro_subscription_months?: number | null;
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('product');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    agreeToTerms: false,
    subscribeToNewsletter: true
  });
  const [emailError, setEmailError] = useState<string>('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailValid, setEmailValid] = useState(true);

  useEffect(() => {
    if (productId) {
      fetchProduct(productId);
    } else {
      // Fetch first active product if no ID specified
      fetchFirstProduct();
    }
  }, [productId]);

  const fetchProduct = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setFetching(false);
    }
  };

  const fetchFirstProduct = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/products?active_only=true');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setProduct(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setFetching(false);
    }
  };

  // Debounce timer for email validation
  const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkEmailExists = async (email: string) => {
    // Clear previous timeout
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current);
    }

    // Reset error state
    setEmailError('');
    setEmailValid(true);

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return; // Don't check invalid emails
    }

    // Debounce the API call
    emailCheckTimeoutRef.current = setTimeout(async () => {
      setIsCheckingEmail(true);
      try {
        const response = await fetch(`http://localhost:3002/api/auth/check-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        
        if (data.exists) {
          setEmailError(data.message || 'This email is already registered');
          setEmailValid(false);
        } else {
          setEmailError('');
          setEmailValid(true);
        }
      } catch (error) {
        console.error('Error checking email:', error);
        // Don't block form submission if check fails
        setEmailError('');
        setEmailValid(true);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500); // 500ms debounce
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));

    // Check email if email field changed
    if (name === 'email') {
      checkEmailExists(value);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final email validation before submission
    if (!emailValid || emailError) {
      alert('Please use a different email address. This email is already registered.');
      return;
    }

    setLoading(true);

    try {
      // Create checkout session
      const response = await fetch('http://localhost:3001/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerEmail: formData.email,
          customerName: `${formData.firstName} ${formData.lastName}`,
          firstName: formData.firstName,
          lastName: formData.lastName,
          productId: product?.id,
          proSubscriptionMonths: product?.pro_subscription_months ?? undefined,
        }),
      });

      const { url } = await response.json();

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('There was an error processing your request. Please try again.');
      setLoading(false);
    }
  };


  return (
    <div className="antialiased text-gray-800 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold">ET</div>
            <span className="font-semibold">EmailTemplateBundle</span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center text-sm">
            <Link to="/" className="hover:text-primary">Home</Link>
            <Link to="/docs" className="hover:text-primary">Docs</Link>
            <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-600">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 font-medium">Checkout</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Purchase</h1>
          <p className="text-gray-600">{fetching ? 'Loading...' : product ? `Get instant access to ${product.name}` : 'Loading product details...'}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Personal Information</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                        emailError 
                          ? 'border-red-300 focus:ring-red-500' 
                          : emailValid && formData.email
                          ? 'border-green-300 focus:ring-green-500'
                          : 'border-gray-300 focus:ring-primary'
                      }`}
                      placeholder="your.email@example.com"
                    />
                    {isCheckingEmail && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    {!isCheckingEmail && emailValid && formData.email && !emailError && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {emailError && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800 flex items-start gap-2">
                        <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{emailError}</span>
                      </p>
                      <p className="text-xs text-red-600 mt-2 ml-7">
                        If this is your email, please <Link to="/login" className="underline font-semibold">log in</Link> instead.
                      </p>
                    </div>
                  )}
                  {!emailError && emailValid && formData.email && !isCheckingEmail && (
                    <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Email is available
                    </p>
                  )}
                </div>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    🔒 Your payment will be securely processed by Stripe. You'll be redirected to Stripe Checkout to complete your purchase.
                  </p>
                </div>
              </div>

              {/* Terms and Newsletter */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="agreeToTerms"
                      name="agreeToTerms"
                      required
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="agreeToTerms" className="text-sm text-gray-700">
                      I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and{' '}
                      <a href="#" className="text-primary hover:underline">Privacy Policy</a> *
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="subscribeToNewsletter"
                      name="subscribeToNewsletter"
                      checked={formData.subscribeToNewsletter}
                      onChange={handleInputChange}
                      className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="subscribeToNewsletter" className="text-sm text-gray-700">
                      Subscribe to our newsletter for updates and new templates
                    </label>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <button
                  type="submit"
                  disabled={loading || !formData.agreeToTerms || !formData.firstName || !formData.lastName || !formData.email || !emailValid || !!emailError || isCheckingEmail}
                  className="w-full bg-blue-500 text-white py-3 px-6 rounded-md font-semibold text-lg hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : isCheckingEmail ? 'Checking email...' : 'Continue to Checkout'}
                </button>
                <p className="text-sm text-gray-500 mt-3 text-center">
                  Secure payment processing
                </p>
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-semibold mb-6">Order Summary</h2>
              
              {fetching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : product ? (
                <>
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-600">Lifetime access</p>
                      </div>
                      <span className="font-semibold">{product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Subtotal</span>
                        <span>{product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Tax</span>
                        <span>$0.00</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Processing Fee</span>
                        <span>$0.00</span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between font-semibold text-lg">
                          <span>Total</span>
                          <span>{product.currency === 'USD' ? '$' : product.currency} {product.price.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No product found
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">✅ What's Included</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• 19 production-ready templates</li>
                    <li>• Complete documentation</li>
                    <li>• Email support</li>
                    <li>• Lifetime updates</li>
                    <li>• Commercial license</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">🔒 Secure Payment</h4>
                  <p className="text-sm text-blue-800">
                    Your payment information is encrypted and secure. We use industry-standard SSL encryption.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-6">
          <div>
            <h5 className="font-semibold">EmailTemplateBundle</h5>
            <p className="text-sm text-gray-600 mt-2">
              Production-ready HTML email templates for small eCommerce teams.
            </p>
          </div>
          <div>
            <h6 className="font-semibold">Support</h6>
            <ul className="mt-2 text-sm text-gray-600 space-y-2">
              <li><a href="mailto:support@emailtemplatebundle.com">Email Support</a></li>
              <li><Link to="/docs">Documentation</Link></li>
              <li><a href="#">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h6 className="font-semibold">Legal</h6>
            <ul className="mt-2 text-sm text-gray-600 space-y-2">
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Use</a></li>
              <li><a href="#">Refund Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="max-w-6xl mx-auto px-6 py-4 text-sm text-gray-500">
            © {new Date().getFullYear()} EmailTemplateBundle — All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
