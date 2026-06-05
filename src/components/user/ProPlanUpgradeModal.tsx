import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getActiveProducts, formatPrice, type Product } from '../../services/productService';

export type ProPlanUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called with selected Pro product id */
  onContinue: (productId: string) => void;
  submitting: boolean;
  submitError: string | null;
};

function proProductsFromCatalog(products: Product[]): Product[] {
  return products
    .filter((p) => (p.subscription_tier || '').toLowerCase() === 'pro' && p.active !== false)
    .sort((a, b) => {
      const ma = a.pro_subscription_months ?? 999;
      const mb = b.pro_subscription_months ?? 999;
      if (ma !== mb) return ma - mb;
      return a.name.localeCompare(b.name);
    });
}

export const ProPlanUpgradeModal: React.FC<ProPlanUpgradeModalProps> = ({
  open,
  onClose,
  onContinue,
  submitting,
  submitError,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const proPlans = useMemo(() => proProductsFromCatalog(catalog), [catalog]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadError(null);
    setLoading(true);
    setSelectedId(null);

    getActiveProducts()
      .then((list) => {
        if (cancelled) return;
        setCatalog(list);
        const pro = proProductsFromCatalog(list);
        if (pro.length === 1) setSelectedId(pro[0].id);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load plans. Try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const displayError = loadError || submitError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-transparent dark:border-gray-800 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choose your Pro plan</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pick the product that matches how long you want Pro access. Pricing is the upgrade amount vs Standard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-600 border-t-transparent" />
            </div>
          )}

          {!loading && proPlans.length === 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-6">
              No Pro plans are available yet. Ask an admin to add active Pro products under{' '}
              <span className="font-mono text-xs">/gestion/products</span>.
            </p>
          )}

          {!loading &&
            proPlans.map((plan) => {
              const selected = selectedId === plan.id;
              const term =
                plan.pro_subscription_months != null
                  ? `${plan.pro_subscription_months} month${plan.pro_subscription_months === 1 ? '' : 's'}`
                  : 'Pro access';
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedId(plan.id)}
                  disabled={submitting}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-all disabled:opacity-60 ${
                    selected
                      ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600 dark:bg-purple-950/40 dark:ring-purple-500'
                      : 'border-gray-200 hover:border-gray-300 bg-white dark:border-gray-700 dark:hover:border-gray-600 dark:bg-gray-950/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</p>
                      {plan.description ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{plan.description}</p>
                      ) : null}
                      <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mt-2">{term}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatPrice(plan.price, plan.currency || 'USD')}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>

        {displayError && (
          <div className="px-5 pb-2">
            <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-lg px-3 py-2 whitespace-pre-line">
              {displayError}
            </p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !selectedId || loading || proPlans.length === 0}
            onClick={() => selectedId && onContinue(selectedId)}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Redirecting…' : 'Continue to checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};
