import React from 'react';
import { Mail } from 'lucide-react';

export const UserEmailBuilder: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Mail className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Email Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create and design your email campaigns</p>
        </div>
      </div>

      {/* Empty State Placeholder */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12">
        <div className="text-center">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Email Builder Coming Soon
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            This is where you'll be able to design and create beautiful email campaigns 
            using our drag-and-drop builder.
          </p>
        </div>
      </div>
    </div>
  );
};

