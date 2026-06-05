import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export const ConfirmationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [registrationStatus, setRegistrationStatus] = useState<'pending' | 'registering' | 'success' | 'skipped' | 'error'>('pending');
  const [registrationMessage, setRegistrationMessage] = useState<string>('');

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    // Verify session and get customer data
    const verifySession = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/verify-session?session_id=${sessionId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setCustomerData(data.customer);
          
          // Save transaction to FastAPI database
          try {
            await fetch('http://localhost:3002/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                payment_id: data.customer.paymentId || sessionId,
                session_id: sessionId,
                email: data.customer.email,
                name: data.customer.name,
                amount: data.customer.amount,
                status: data.customer.paymentStatus || 'paid',
                product: data.customer.product
              })
            });
          } catch (err) {
            console.log('Note: Could not save to FastAPI (might not be critical)');
          }
          
          // Register user in Supabase (if product requires registration)
          // This happens automatically when confirmation page loads
          registerUserFromSession(data.customer, data.session, sessionId);
        } else {
          setError(data.error || 'Failed to verify your purchase');
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError('An error occurred while verifying your purchase');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [sessionId]);

  // Register user from session data
  const registerUserFromSession = async (customer: any, session: any, sessionId: string) => {
    try {
      setRegistrationStatus('registering');
      setRegistrationMessage('Setting up your account...');
      
      console.log('🔄 Registering user from confirmation page...');
      console.log('   Customer:', customer);
      console.log('   Session metadata:', session?.metadata);
      
      // Extract product info from session metadata
      const productName = customer.product || session?.metadata?.productName || 'Email Builder';
      const productId = session?.metadata?.productId || null;
      const firstName = session?.metadata?.firstName || null;
      const lastName = session?.metadata?.lastName || null;
      
      // Call registration endpoint
      const registrationResponse = await fetch('http://localhost:3002/api/auth/register-from-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customer.email,
          name: customer.name,
          first_name: firstName,
          last_name: lastName,
          payment_id: customer.paymentId || sessionId,
          session_id: sessionId,
          product_name: productName,
          product_id: productId,
          pro_subscription_months: session?.metadata?.pro_subscription_months
            ? parseInt(String(session.metadata.pro_subscription_months), 10)
            : undefined,
        })
      });
      
      const responseData = await registrationResponse.json();
      
      if (registrationResponse.ok) {
        setRegistrationStatus('success');
        const username = responseData.username || customer.email.split('@')[0];
        const password = customer.paymentId || sessionId;
        setRegistrationMessage(`Your account has been created!`);
        console.log('✅ User registered:', responseData);
      } else {
        // Check if user already exists (idempotent)
        if (responseData.detail && (responseData.detail.includes('already exists') || responseData.detail.includes('already registered'))) {
          setRegistrationStatus('success');
          setRegistrationMessage('Your account is already set up!');
        } else if (responseData.detail && responseData.detail.includes('downloadable')) {
          setRegistrationStatus('skipped');
          setRegistrationMessage('This product does not require account registration.');
        } else {
          throw new Error(responseData.detail || 'Registration failed');
        }
      }
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      setRegistrationStatus('error');
      setRegistrationMessage(error.message || 'Could not create account. Please contact support.');
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '../theb/Archive.zip';
    link.download = 'EmailTemplateBundle.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Verifying your purchase...</h2>
          <p className="text-gray-600 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block bg-primary text-white py-3 px-6 rounded-md font-semibold text-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold">ET</div>
            <span className="font-semibold">EmailTemplateBundle</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Success Confirmation */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-8 py-12 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-green-50 text-lg">Thank you for your purchase</p>
          </div>

          {/* Content Section */}
          <div className="px-8 py-8">
            {/* Order Details */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
              <div className="space-y-3">
                {customerData?.product && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product</span>
                    <span className="font-semibold text-gray-900">{customerData.product}</span>
                  </div>
                )}
                {customerData?.amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount Paid</span>
                    <span className="font-semibold text-gray-900">${customerData.amount.toFixed(2)}</span>
                  </div>
                )}
                {customerData?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name</span>
                    <span className="font-semibold text-gray-900">{customerData.name}</span>
                  </div>
                )}
                {customerData?.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email</span>
                    <span className="font-semibold text-gray-900">{customerData.email}</span>
                  </div>
                )}
                {customerData?.date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date</span>
                    <span className="font-semibold text-gray-900">{new Date(customerData.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                )}
                {customerData?.paymentId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID</span>
                    <span className="font-mono text-sm text-gray-600">{customerData.paymentId.substring(0, 20)}...</span>
                  </div>
                )}
              </div>
            </div>

            {/* What's Next */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🎉 What's Next?</h3>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Download your email template bundle below</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Check your email for the download link (if enabled)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Visit our documentation for setup instructions</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Contact support if you need any assistance</span>
                </li>
              </ul>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full bg-primary text-white py-4 px-6 rounded-md font-semibold text-lg hover:bg-blue-700 transition-colors duration-200 mb-4 shadow-md"
            >
              ⬇️ Download Your Bundle Now
            </button>

            {/* Additional Actions */}
            <div className="grid md:grid-cols-2 gap-4">
              <Link
                to="/docs"
                className="block text-center bg-gray-100 text-gray-900 py-3 px-6 rounded-md font-semibold hover:bg-gray-200 transition-colors duration-200"
              >
                📚 View Documentation
              </Link>
              <Link
                to="/"
                className="block text-center bg-gray-100 text-gray-900 py-3 px-6 rounded-md font-semibold hover:bg-gray-200 transition-colors duration-200"
              >
                🏠 Return to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
          <p className="text-gray-600 mb-4">
            Our support team is here to assist you with any questions about your purchase.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:support@emailtemplatebundle.com"
              className="inline-block bg-primary text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 transition-colors duration-200"
            >
              📧 Email Support
            </a>
            <Link
              to="/docs"
              className="inline-block border-2 border-primary text-primary py-3 px-6 rounded-md font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
            >
              📖 Documentation
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} EmailTemplateBundle — All rights reserved.
        </div>
      </footer>
    </div>
  );
};

