import React from 'react';

export const SupportSection: React.FC = () => {
  return (
    <section id="support" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Support</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Getting Help</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Documentation</h4>
              <p className="text-sm text-gray-600">
                This documentation covers the most common questions and issues. Start here for quick answers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Email Support</h4>
              <p className="text-sm text-gray-600">
                For technical issues or customization help, contact us at{' '}
                <a href="mailto:support@emailtemplatebundle.com" className="text-primary hover:underline">
                  support@emailtemplatebundle.com
                </a>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Response Time</h4>
              <p className="text-sm text-gray-600">
                We typically respond to support requests within 24-48 hours during business days.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Resources</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Updates</h4>
              <p className="text-sm text-gray-600">
                Template updates and improvements are included with your purchase. Check back regularly for new features.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Community</h4>
              <p className="text-sm text-gray-600">
                Join our community forum to share tips, ask questions, and connect with other users.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Tutorials</h4>
              <p className="text-sm text-gray-600">
                Video tutorials and step-by-step guides are available in our knowledge base.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
