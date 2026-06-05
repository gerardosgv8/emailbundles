import React from 'react';

export const ESPIntegrationSection: React.FC = () => {
  const espGuides = [
    {
      name: "Salesforce Marketing Cloud",
      steps: [
        "Log into Salesforce Marketing Cloud",
        "Navigate to Email Studio → Content Builder",
        "Click \"Create\" → \"Email\"",
        "Choose \"Code View\"",
        "Paste your template HTML",
        "Save and test"
      ],
      tips: [
        "Use AMPScript for dynamic content",
        "Test in Content Builder preview",
        "Upload images to Content Builder",
        "Use Journey Builder for automation"
      ],
      details: "Enterprise-grade email platform with advanced automation and personalization features."
    },
    {
      name: "Klaviyo",
      steps: [
        "Log into Klaviyo",
        "Go to Templates → Create Template",
        "Choose \"Code Your Own\"",
        "Paste your template HTML",
        "Upload images to Klaviyo",
        "Update image URLs",
        "Save and preview"
      ],
      tips: [
        "Use Klaviyo's personalization tags",
        "Test with sample data",
        "Use Klaviyo's image optimization",
        "Set up A/B testing"
      ],
      details: "E-commerce focused platform with powerful segmentation and automation."
    },
    {
      name: "Mailchimp",
      steps: [
        "Log into Mailchimp",
        "Go to Templates → Create Template",
        "Choose \"Code Your Own\"",
        "Paste your template HTML",
        "Upload images to Mailchimp",
        "Update image URLs",
        "Save and test"
      ],
      tips: [
        "Use Mailchimp merge tags",
        "Test with different audiences",
        "Use Mailchimp's responsive tools",
        "Set up automation workflows"
      ],
      details: "User-friendly platform perfect for small to medium-sized businesses."
    },
    {
      name: "HubSpot",
      steps: [
        "Log into HubSpot",
        "Navigate to Marketing → Email → Templates",
        "Click \"Create Template\" → \"Drag & Drop with Code\"",
        "Switch to \"Code Editor\" tab",
        "Paste your template HTML",
        "Save and use in campaigns"
      ],
      tips: [
        "Use HubSpot personalization syntax",
        "Test with contact records",
        "Upload images to File Manager",
        "Connect to workflows for automation"
      ],
      details: "All-in-one CRM and marketing platform with integrated email tools."
    },
    {
      name: "ConvertKit",
      steps: [
        "Log into ConvertKit",
        "Go to Broadcasts → Templates",
        "Click \"Create Template\"",
        "Click \"HTML\" button in editor",
        "Paste your template HTML",
        "Save and preview"
      ],
      tips: [
        "Use ConvertKit merge tags",
        "Test with subscriber data",
        "Host images externally (no image uploads)",
        "Set up sequences for automation"
      ],
      details: "Creator-friendly platform with powerful automation and tagging."
    },
    {
      name: "SendGrid",
      steps: [
        "Log into SendGrid",
        "Go to Email API → Dynamic Templates",
        "Click \"Create New Template\"",
        "Paste your template HTML",
        "Upload images via File Library",
        "Update image URLs",
        "Save and activate"
      ],
      tips: [
        "Use Handlebars for personalization",
        "Test with sample data",
        "Optimize for SendGrid's rendering",
        "Monitor deliverability metrics"
      ],
      details: "Developer-friendly transactional and marketing email platform."
    }
  ];

  return (
    <section id="esp-integration" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">How to Input Email Templates into ESPs</h2>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>💡 Quick Overview:</strong> Every email service provider (ESP) has its own interface, but the process is similar: find the HTML/Code editor, paste your template, upload images, and test.
        </p>
      </div>

      <div className="space-y-6 mb-6">
        {espGuides.map((esp, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">{esp.name}</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Template #{(index + 1)}</span>
            </div>
            <p className="text-sm text-gray-600 mb-4 italic">{esp.details}</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-green-600 text-lg">→</span>
                  Step-by-Step Import
                </h4>
                <ol className="space-y-2 text-sm text-gray-600">
                  {esp.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                        {stepIndex + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-purple-600 text-lg">💡</span>
                  Pro Tips
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  {esp.tips.map((tip, tipIndex) => (
                    <li key={tipIndex} className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* General Instructions */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">General Template Import Instructions</h3>
        
        <div className="grid md:grid-cols-3 gap-6 mb-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold mb-2 text-blue-700">1. Prepare Your Template</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Open template HTML file</li>
              <li>• Select all code (Ctrl/Cmd + A)</li>
              <li>• Copy to clipboard</li>
              <li>• Keep image URLs ready</li>
            </ul>
          </div>
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold mb-2 text-green-700">2. Navigate to Code Editor</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Find Templates/Email section</li>
              <li>• Click "Create Template"</li>
              <li>• Select "Code" or "HTML" option</li>
              <li>• Open code editor</li>
            </ul>
          </div>
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold mb-2 text-purple-700">3. Paste & Configure</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Paste template HTML</li>
              <li>• Upload images to ESP</li>
              <li>• Update image URLs</li>
              <li>• Test & preview</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Management */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Managing Images in Templates</h3>
        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <h4 className="font-semibold mb-2">Two Options for Images:</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded p-3 border border-green-200">
              <h5 className="font-semibold text-green-700 mb-1">✓ Option 1: Upload to ESP</h5>
              <p className="text-xs text-gray-600 mb-2">Recommended for production</p>
              <ol className="text-xs text-gray-600 space-y-1">
                <li>1. Upload images to ESP's file manager</li>
                <li>2. Copy image URLs provided by ESP</li>
                <li>3. Replace all image URLs in template</li>
              </ol>
            </div>
            <div className="bg-white rounded p-3 border border-orange-200">
              <h5 className="font-semibold text-orange-700 mb-1">⚠ Option 2: External Hosting</h5>
              <p className="text-xs text-gray-600 mb-2">Use if ESP has no file manager</p>
              <ol className="text-xs text-gray-600 space-y-1">
                <li>1. Host images on your server/CDN</li>
                <li>2. Use absolute URLs in template</li>
                <li>3. Ensure URLs are HTTPS</li>
              </ol>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3">
          <p className="text-xs text-yellow-800">
            <strong>⚠️ Important:</strong> Update ALL image URLs in your template! Placeholder images like <code className="bg-yellow-200 px-1 rounded">via.placeholder.com</code> must be replaced with your actual images.
          </p>
        </div>
      </div>

      {/* Testing Checklist */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Pre-Send Testing Checklist</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Visual Checks</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>All images display correctly</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Colors match your brand</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Text is readable and formatted</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Buttons are clickable</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Links work correctly</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Technical Checks</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Personalization tags work</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Mobile responsive on small screens</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Tested in multiple email clients</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Unsubscribe link present</span>
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>Sender name and email correct</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
