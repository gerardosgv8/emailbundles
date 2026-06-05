import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const DownloadPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsChecking(true);

    try {
      // Check if email exists in Airtable
      const response = await fetch('http://localhost:3001/api/verify-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.authorized) {
        setIsAuthorized(true);
        // Download will be triggered automatically or via button
      } else {
        setError('Email not found. Please contact support if you believe this is an error.');
      }
    } catch (err) {
      setError('An error occurred while verifying your email. Please try again.');
      console.error('Verification error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownload = () => {
    // Trigger download of the zip file
    const link = document.createElement('a');
    link.href = '../theb/Archive.zip';
    link.download = 'EmailTemplateBundle.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Granted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your purchase. Click below to download your Email Template Bundle.
          </p>
          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-semibold text-lg hover:bg-blue-700 transition-colors duration-200 mb-4"
          >
            Download Bundle
          </button>
          <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Download Your Product</h1>
          <p className="text-gray-600">Enter your email to verify your purchase</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={email}
              onChange={handleEmailChange}
              placeholder="your.email@example.com"
              className="w-full border border-gray-300 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isChecking}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isChecking || !email}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-semibold text-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Verifying...' : 'Verify and Download'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Need help? <Link to="/" className="text-blue-600 hover:underline">Contact Support</Link></p>
        </div>
      </div>
    </div>
  );
};

