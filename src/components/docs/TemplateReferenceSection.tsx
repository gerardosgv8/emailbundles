import React from 'react';

export const TemplateReferenceSection: React.FC = () => {
  const templates = [
    {
      name: "Welcome Series",
      description: "Perfect for onboarding new subscribers",
      features: [
        "Hero section with welcome message",
        "Feature highlights",
        "Call-to-action buttons",
        "Social media links"
      ]
    },
    {
      name: "Product Launch",
      description: "Announce new products or features",
      features: [
        "Product showcase",
        "Feature grid",
        "Pricing information",
        "Pre-order buttons"
      ]
    },
    {
      name: "Abandoned Cart",
      description: "Recover lost sales",
      features: [
        "Cart reminder",
        "Product images",
        "Discount offers",
        "Urgency messaging"
      ]
    },
    {
      name: "Order Confirmation",
      description: "Confirm customer purchases",
      features: [
        "Order details",
        "Shipping information",
        "Tracking links",
        "Cross-sell products"
      ]
    },
    {
      name: "Sale Promotion",
      description: "Drive sales with special offers",
      features: [
        "Discount banners",
        "Product highlights",
        "Countdown timers",
        "Limited-time offers"
      ]
    },
    {
      name: "Newsletter",
      description: "Regular content updates",
      features: [
        "Article previews",
        "Image galleries",
        "Social media integration",
        "Newsletter archive"
      ]
    }
  ];

  return (
    <section id="templates" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Template Reference</h2>
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Available Templates</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, index) => (
            <div key={index} className="border rounded-lg p-4">
              <h4 className="font-semibold mb-2">{template.name}</h4>
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              <ul className="text-xs text-gray-500 space-y-1">
                {template.features.map((feature, featureIndex) => (
                  <li key={featureIndex}>• {feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
