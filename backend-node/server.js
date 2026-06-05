/**
 * Backend API Server for Stripe Payments and User Registration
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const fetch = globalThis.fetch;

const app = express();
app.use(cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:3002';

async function saveTransactionToDatabase(session, productName = null) {
  try {
    const transactionData = {
      payment_id: session.payment_intent || session.id,
      session_id: session.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email || 'unknown',
      name: session.customer_details?.name || session.metadata?.customerName || 'N/A',
      amount: session.amount_total / 100,
      status: session.payment_status,
      product: productName || session.metadata?.productName || 'The Ecommerce Mail Kit'
    };

    const response = await fetch(`${FASTAPI_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionData)
    });

    if (!response.ok) {
      console.error('Failed to save transaction:', response.status);
    }
  } catch (error) {
    console.error('Error saving transaction:', error.message);
  }
}

async function getProductNameFromSession(session) {
  try {
    if (session.metadata && session.metadata.productName) {
      return session.metadata.productName.trim();
    }

    if (session.line_items && session.line_items.data && session.line_items.data.length > 0) {
      const lineItem = session.line_items.data[0];
      if (lineItem.price && lineItem.price.product) {
        if (typeof lineItem.price.product === 'object' && lineItem.price.product.name) {
          return lineItem.price.product.name.trim();
        }
      }
    }

    try {
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items.data.price.product']
      });

      if (expandedSession.line_items && expandedSession.line_items.data && expandedSession.line_items.data.length > 0) {
        const lineItem = expandedSession.line_items.data[0];
        if (lineItem.price && lineItem.price.product) {
          if (typeof lineItem.price.product === 'object' && lineItem.price.product.name) {
            return lineItem.price.product.name.trim();
          }
        }
      }
    } catch (expandError) {
      console.warn('Could not expand session line items:', expandError.message);
    }

    if (session.metadata && session.metadata.productId) {
      try {
        const productResponse = await fetch(`${FASTAPI_URL}/api/products/${session.metadata.productId}`);
        if (productResponse.ok) {
          const productData = await productResponse.json();
          return productData.name.trim();
        }
      } catch (error) {
        console.error('Error fetching product for session:', error.message);
      }
    }

    return null;
  } catch (error) {
    console.error('Error resolving product name:', error.message);
    return null;
  }
}

function getTierFromProductName(productName) {
  if (!productName) return null;

  const productNameLower = productName.trim().toLowerCase();

  if (productNameLower.includes('email builder')) {
    return 'standard';
  }
  if (productNameLower.includes('pro membership')) {
    return 'pro';
  }
  if (productNameLower.includes('pro') && !productNameLower.includes('email builder')) {
    return 'pro';
  }

  return null;
}

function shouldRegisterUser(productName) {
  if (!productName) return false;

  const productNameLower = productName.trim().toLowerCase();

  return productNameLower.includes('email builder') ||
    productNameLower.includes('pro membership') ||
    (productNameLower.includes('pro') && !productNameLower.includes('template'));
}

const VALID_PRO_MONTHS = [1, 3, 6, 12];

async function resolveProSubscriptionMonths(session, productId, tier, productName, productDataCached) {
  if (tier !== 'pro') return null;
  const raw = session.metadata?.pro_subscription_months;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const n = parseInt(String(raw), 10);
    if (VALID_PRO_MONTHS.includes(n)) return n;
  }
  if (productDataCached && productDataCached.pro_subscription_months != null) {
    const n = Number(productDataCached.pro_subscription_months);
    if (VALID_PRO_MONTHS.includes(n)) return n;
  }
  if (productId && !productDataCached) {
    try {
      const productResponse = await fetch(`${FASTAPI_URL}/api/products/${productId}`);
      if (productResponse.ok) {
        const p = await productResponse.json();
        const n = Number(p.pro_subscription_months);
        if (VALID_PRO_MONTHS.includes(n)) return n;
      }
    } catch (e) {
      console.warn('Could not fetch product subscription months:', e.message);
    }
  }
  if (productName) {
    const m = productName.match(/(\d+)\s*months?/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (VALID_PRO_MONTHS.includes(n)) return n;
    }
  }
  return 12;
}

async function registerUserFromStripe(session, productName, productId = null) {
  try {
    let tier = null;
    let productDataCache = null;

    if (productId) {
      try {
        const productResponse = await fetch(`${FASTAPI_URL}/api/products/${productId}`);
        if (productResponse.ok) {
          const productData = await productResponse.json();
          productDataCache = productData;
          tier = productData.subscription_tier;

          if (!tier) {
            return null;
          }
        }
      } catch (error) {
        console.error('Error fetching product for registration:', error.message);
      }
    }

    if (!tier) {
      if (!shouldRegisterUser(productName)) {
        return null;
      }

      tier = getTierFromProductName(productName);
      if (!tier) {
        console.error('Registration failed: could not determine tier for product');
        return null;
      }
    }

    if (tier && typeof tier === 'string') {
      tier = tier.trim().toLowerCase();
      if (tier === 'starter') tier = 'standard';
    }

    let customerName = session.customer_details?.name || session.metadata?.customerName || 'Customer';
    let firstName = session.metadata?.firstName || null;
    let lastName = session.metadata?.lastName || null;

    if (firstName && lastName) {
      customerName = `${firstName} ${lastName}`;
    } else if (customerName && customerName.includes(' ')) {
      const nameParts = customerName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }
    }

    const pro_subscription_months = await resolveProSubscriptionMonths(
      session,
      productId,
      tier,
      productName,
      productDataCache
    );

    const userData = {
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
      name: customerName,
      first_name: firstName || null,
      last_name: lastName || null,
      tier: tier,
      payment_id: session.payment_intent || session.id,
      session_id: session.id,
      product_name: productName,
      pro_subscription_months: tier === 'pro' ? pro_subscription_months : null,
    };

    if (!userData.email || !userData.email.trim()) {
      console.error('Registration skipped: customer email missing from session');
      return null;
    }

    try {
      const response = await fetch(`${FASTAPI_URL}/api/auth/register-from-stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        return await response.json();
      }

      console.error('Registration endpoint failed:', response.status);
      return null;
    } catch (error) {
      console.error('Registration request failed:', error.message);
      return null;
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    return null;
  }
}

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.post('/api/verify-customer', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        authorized: false,
        error: 'Email is required'
      });
    }

    res.json({
      authorized: false,
      error: 'Please use the login endpoint to verify your account'
    });
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).json({
      authorized: false,
      error: 'An error occurred while verifying your email'
    });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { customerEmail, customerName, firstName, lastName, productId, proSubscriptionMonths, cancelUrl } = req.body;

    let productData = null;
    if (productId) {
      try {
        const productResponse = await fetch(`${FASTAPI_URL}/api/products/${productId}`);
        if (productResponse.ok) {
          productData = await productResponse.json();
        }
      } catch (error) {
        console.error('Error fetching product for checkout:', error.message);
      }
    }

    const productName = productData?.name?.trim() || 'The Ecommerce Mail Kit';
    const productDescription = productData?.description || 'Production-ready HTML email templates for small eCommerce teams';
    const currency = productData?.currency?.toLowerCase() || 'usd';
    const unitAmount = productData ? Math.round(productData.price * 100) : 7900;

    let metaProMonths = '';
    const reqMonths = proSubscriptionMonths != null ? Number(proSubscriptionMonths) : NaN;
    if (VALID_PRO_MONTHS.includes(reqMonths)) {
      metaProMonths = String(reqMonths);
    } else if (productData?.pro_subscription_months != null &&
      VALID_PRO_MONTHS.includes(Number(productData.pro_subscription_months))) {
      metaProMonths = String(Number(productData.pro_subscription_months));
    }

    const cancelPath = cancelUrl && String(cancelUrl).startsWith('/') ? String(cancelUrl) : '/checkout';
    const cancelJoin = cancelPath.includes('?') ? '&' : '?';
    const cancelFullUrl = `${req.headers.origin}${cancelPath}${cancelJoin}canceled=true`;

    const trimmedEmail = customerEmail && String(customerEmail).trim();

    const sessionPayload = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelFullUrl,
      metadata: {
        customerName: customerName || '',
        firstName: firstName || '',
        lastName: lastName || '',
        productId: productId || '',
        productName: productName,
        email: trimmedEmail || '',
        ...(metaProMonths ? { pro_subscription_months: metaProMonths } : {}),
      },
    };
    if (trimmedEmail) {
      sessionPayload.customer_email = trimmedEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(String(session_id), {
      expand: ['line_items.data.price.product']
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed'
      });
    }

    let productName = session.metadata?.productName || 'The Ecommerce Mail Kit';
    if (productName === 'The Ecommerce Mail Kit' && session.line_items && session.line_items.data && session.line_items.data.length > 0) {
      const lineItem = session.line_items.data[0];
      if (lineItem.price && lineItem.price.product) {
        if (typeof lineItem.price.product === 'object' && lineItem.price.product.name) {
          productName = lineItem.price.product.name;
        }
      }
    }

    res.json({
      success: true,
      customer: {
        email: session.customer_details?.email,
        name: session.customer_details?.name || session.metadata?.customerName || 'N/A',
        amount: session.amount_total / 100,
        paymentId: session.payment_intent || session.id,
        orderId: session.id,
        date: new Date(session.created * 1000).toISOString(),
        paymentStatus: session.payment_status,
        product: productName
      },
      session: {
        metadata: session.metadata,
        customer_details: session.customer_details,
        payment_intent: session.payment_intent,
        id: session.id
      }
    });
  } catch (error) {
    console.error('Session verification error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session'
    });
  }
});

app.post('/api/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Webhook secret not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const productName = await getProductNameFromSession(session);

    if (!productName) {
      console.error('Webhook: product name not found for completed checkout');
    } else {
      const productId = session.metadata?.productId || null;
      await registerUserFromStripe(session, productName, productId);
    }

    await saveTransactionToDatabase(session, productName);
  }

  res.json({ received: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;
