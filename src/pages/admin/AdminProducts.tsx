import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, DollarSign, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SuccessModal } from '../../components/common/SuccessModal';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stripe_price_id?: string;
  download_file?: string;
  subscription_tier?: string | null;  // 'standard', 'pro', or null (downloadable)
  pro_subscription_months?: number | null;
  active: boolean;
}

export const AdminProducts: React.FC = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    download_file: '',
    subscription_tier: '' as string | null,  // 'standard', 'pro', or '' (null for downloadable)
    pro_subscription_months: '' as string,
    active: true
  });
  const [modalState, setModalState] = useState({ isOpen: false, type: 'success' as const, message: '', title: '' });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchAvailableFiles();
  }, []);

  const fetchAvailableFiles = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/files');
      if (response.ok) {
        const data = await response.json();
        setAvailableFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'subscription_tier') {
      setFormData((prev) => {
        const next = {
          ...prev,
          subscription_tier: value as string | null,
        };
        if (value === 'pro') {
          next.pro_subscription_months = prev.pro_subscription_months || '12';
        } else {
          next.pro_subscription_months = '';
        }
        return next;
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.subscription_tier === 'pro') {
      const m = parseInt(formData.pro_subscription_months, 10);
      if (![1, 3, 6, 12].includes(m)) {
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'Pro products require a subscription length: choose 1, 3, 6, or 12 months.',
          title: 'Missing Pro term',
        });
        return;
      }
    }
    setLoading(true);

    try {
      if (editingProduct) {
        // Update existing product
        console.log('🔄 Updating product:', editingProduct.id);
        console.log('📦 Request body:', {
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          currency: formData.currency,
          download_file: formData.download_file || null,
          subscription_tier: formData.subscription_tier || null,
          pro_subscription_months:
            formData.subscription_tier === 'pro'
              ? parseInt(formData.pro_subscription_months || '12', 10)
              : null,
          active: formData.active
        });
        
        const response = await fetch(`http://localhost:3002/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            price: parseFloat(formData.price),
            currency: formData.currency,
            download_file: formData.download_file || null,
            subscription_tier: formData.subscription_tier || null,
            pro_subscription_months:
              formData.subscription_tier === 'pro'
                ? parseInt(formData.pro_subscription_months || '12', 10)
                : null,
            active: formData.active
          })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);

        if (response.ok) {
          await fetchProducts();
          setShowModal(false);
          setEditingProduct(null);
          setFormData({ name: '', description: '', price: '', currency: 'USD', download_file: '', subscription_tier: '', pro_subscription_months: '', active: true });
          setModalState({
            isOpen: true,
            type: 'success',
            message: `Product "${formData.name}" updated successfully!`,
            title: 'Product Updated',
          });
        } else {
          const errorText = await response.text();
          console.error('❌ Update failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Failed to update product: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } else {
        // Create new product
        console.log('🔄 Creating new product');
        console.log('📦 Request body:', {
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          currency: formData.currency,
          download_file: formData.download_file || null,
          subscription_tier: formData.subscription_tier || null,
          pro_subscription_months:
            formData.subscription_tier === 'pro'
              ? parseInt(formData.pro_subscription_months || '12', 10)
              : null,
          active: formData.active
        });
        
        const response = await fetch('http://localhost:3002/api/products', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            price: parseFloat(formData.price),
            currency: formData.currency,
            download_file: formData.download_file || null,
            subscription_tier: formData.subscription_tier || null,
            pro_subscription_months:
              formData.subscription_tier === 'pro'
                ? parseInt(formData.pro_subscription_months || '12', 10)
                : null,
            active: formData.active
          })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);

        if (response.ok) {
          await fetchProducts();
          setShowModal(false);
          setFormData({ name: '', description: '', price: '', currency: 'USD', download_file: '', subscription_tier: '', pro_subscription_months: '', active: true });
          setModalState({
            isOpen: true,
            type: 'success',
            message: `Product "${formData.name}" created successfully!`,
            title: 'Product Created',
          });
        } else {
          const errorText = await response.text();
          console.error('❌ Create failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Failed to create product: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }
    } catch (error) {
      console.error('❌ Error saving product:', error);
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network error - check if backend server is running on port 3002');
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'Failed to connect to server. Please ensure the backend server is running on port 3002.',
          title: 'Connection Error',
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setModalState({
          isOpen: true,
          type: 'error',
          message: `Failed to save product: ${errorMessage}`,
          title: 'Error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      currency: product.currency,
      download_file: product.download_file || '',
      subscription_tier: product.subscription_tier || '',
      pro_subscription_months:
        product.pro_subscription_months != null
          ? String(product.pro_subscription_months)
          : product.subscription_tier === 'pro'
            ? '12'
            : '',
      active: product.active
    });
    setShowModal(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3002/api/products/${product.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchProducts();
        setModalState({
          isOpen: true,
          type: 'success',
          message: `Product "${product.name}" deleted successfully!`,
          title: 'Product Deleted',
        });
      } else {
        throw new Error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setModalState({
        isOpen: true,
        type: 'error',
        message: 'Failed to delete product',
        title: 'Error',
      });
    }
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', description: '', price: '', currency: 'USD', download_file: '', subscription_tier: '', pro_subscription_months: '', active: true });
    setShowModal(true);
  };

  const syncFromStripe = async () => {
    setSyncing(true);
    try {
      const response = await fetch('http://localhost:3002/api/products/sync-from-stripe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const syncedProducts = await response.json();
        await fetchProducts();
        setModalState({
          isOpen: true,
          type: 'success',
          message: `Successfully synced ${syncedProducts.length} product(s) from Stripe!`,
          title: 'Sync Complete',
        });
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to sync products from Stripe');
      }
    } catch (error: any) {
      console.error('Error syncing from Stripe:', error);
      setModalState({
        isOpen: true,
        type: 'error',
        message: error.message || 'Failed to sync products from Stripe. Please check your Stripe configuration.',
        title: 'Sync Error',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
          <p className="text-gray-600 mt-1">Manage your Stripe products and prices</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncFromStripe}
            disabled={syncing}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Stripe'}
          </button>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
        </div>
      </div>

      {/* Products List */}
      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                  {product.active && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                      Active
                    </span>
                  )}
                  {!product.active && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span className="text-xl font-bold text-gray-900">
                      {product.currency} {product.price.toFixed(2)}
                    </span>
                  </div>
                </div>
                {product.subscription_tier && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Tier: {product.subscription_tier === 'standard' ? 'Standard' : 'Pro'}
                    </span>
                    {product.subscription_tier === 'pro' && product.pro_subscription_months ? (
                      <span className="text-xs text-gray-600">
                        {product.pro_subscription_months} month prepaid
                      </span>
                    ) : null}
                  </div>
                )}
                {!product.subscription_tier && (
                  <div className="mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Downloadable (No Registration)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleEdit(product)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(product)}
                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-md hover:bg-red-100 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>

            {(product.stripe_price_id || product.download_file) && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                {product.stripe_price_id && (
                  <p className="text-xs text-gray-500">
                    Stripe Price ID: <span className="font-mono">{product.stripe_price_id}</span>
                  </p>
                )}
                {product.download_file && (
                  <p className="text-xs text-gray-500">
                    Download File: <span className="font-semibold text-blue-600">{product.download_file}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!fetching && products.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center">
          <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
          <p className="text-gray-600 mb-6">Create your first product to start selling</p>
          <button
            onClick={openNewModal}
            className="inline-flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-md hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000000] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto z-[1000001] relative">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Create New Product'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 19/20 HTML Email Template Bundle"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your product"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    Price *
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="79.00"
                  />
                </div>

                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                    Currency *
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    required
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="download_file" className="block text-sm font-medium text-gray-700 mb-2">
                  Download File (Optional)
                </label>
                <select
                  id="download_file"
                  name="download_file"
                  value={formData.download_file}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No file</option>
                  {availableFiles.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Select file from _img folder to send to customers</p>
              </div>

              <div>
                <label htmlFor="subscription_tier" className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  id="subscription_tier"
                  name="subscription_tier"
                  value={formData.subscription_tier || ''}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None - Downloadable Product (No User Registration)</option>
                  <option value="standard">Standard Tier - Register users as Standard</option>
                  <option value="pro">Pro Tier - Register users as Pro</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select the user tier that will be granted when customers purchase this product. 
                  Leave as "None" for downloadable products that don't require user accounts.
                </p>
              </div>

              <div
                className={`transition-all duration-300 ease-out ${
                  formData.subscription_tier === 'pro'
                    ? 'max-h-56 opacity-100 mt-1 mb-1'
                    : 'max-h-0 opacity-0 overflow-hidden m-0 pointer-events-none'
                }`}
                aria-hidden={formData.subscription_tier !== 'pro'}
              >
                <div className="rounded-lg border-2 border-blue-300 bg-gradient-to-b from-blue-50 to-white p-4 shadow-md space-y-2 ring-1 ring-blue-100">
                  <p className="text-sm font-medium text-blue-900">Pro subscription length</p>
                  <p className="text-xs text-blue-800/90">
                    Stored in <span className="font-mono">products.pro_subscription_months</span>. New Pro accounts get{' '}
                    <span className="font-semibold">subscription_expiration_date = created_at + this many calendar months</span>{' '}
                    at signup. Renewals still stack from their current expiry.
                  </p>
                  <label htmlFor="pro_subscription_months" className="block text-sm font-medium text-gray-800">
                    Prepaid term (required)
                  </label>
                  <select
                    id="pro_subscription_months"
                    name="pro_subscription_months"
                    required={formData.subscription_tier === 'pro'}
                    value={formData.pro_subscription_months || '12'}
                    onChange={handleInputChange}
                    className="w-full border border-blue-200 rounded-md px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="text-sm text-gray-700">
                  Product is active (visible in checkout)
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ℹ️ This will create a product and price in Stripe when saved. The Stripe Price ID will be automatically stored.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      <SuccessModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        type={modalState.type}
        message={modalState.message}
        title={modalState.title}
      />
    </div>
  );
};

