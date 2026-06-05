import React from 'react';

export const GettingStartedSection: React.FC = () => {
  const steps = [
    {
      number: 1,
      title: "Download and Extract",
      description: "Download the template bundle and extract all files to your local machine."
    },
    {
      number: 2,
      title: "Choose Your Template",
      description: "Browse the template gallery and select the template that best fits your campaign needs."
    },
    {
      number: 3,
      title: "Customize Content",
      description: "Edit text, images, and colors to match your brand guidelines."
    },
    {
      number: 4,
      title: "Upload to ESP",
      description: "Copy the HTML code and paste it into your email service provider."
    }
  ];

  return (
    <section id="getting-started" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Getting Started</h2>
      
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Quick Setup</h3>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="flex items-start gap-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {step.number}
              </div>
              <div>
                <h4 className="font-semibold">{step.title}</h4>
                <p className="text-gray-600 text-sm mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tip</h4>
        <p className="text-blue-800 text-sm">
          Always test your templates in multiple email clients before sending to your audience. 
          Use tools like Litmus or Email on Acid for comprehensive testing.
        </p>
      </div>
    </section>
  );
};
