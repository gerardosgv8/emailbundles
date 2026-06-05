import React from 'react';

export const TroubleshootingSection: React.FC = () => {
  const issues = [
    {
      type: "red",
      title: "Images Not Displaying",
      description: "Images appear as broken or missing in email clients.",
      solutions: [
        "Ensure image URLs are absolute (include http:// or https://)",
        "Upload images to a reliable hosting service",
        "Check that image files are publicly accessible",
        "Verify image file formats are supported (JPG, PNG, GIF)"
      ]
    },
    {
      type: "yellow",
      title: "Outlook Rendering Issues",
      description: "Templates look different or broken in Outlook.",
      solutions: [
        "Use VML buttons for call-to-action buttons",
        "Avoid CSS properties not supported by Outlook",
        "Use table-based layouts instead of divs",
        "Test in Outlook's web client and desktop app"
      ]
    },
    {
      type: "blue",
      title: "Mobile Responsiveness",
      description: "Templates don't display properly on mobile devices.",
      solutions: [
        "Ensure viewport meta tag is included",
        "Use media queries for responsive design",
        "Test on actual mobile devices",
        "Use mobile-friendly font sizes (14px+)"
      ]
    },
    {
      type: "green",
      title: "Spam Filter Issues",
      description: "Emails are being marked as spam or not delivered.",
      solutions: [
        "Avoid excessive use of promotional words",
        "Maintain good text-to-image ratio",
        "Use proper authentication (SPF, DKIM, DMARC)",
        "Test with spam checking tools"
      ]
    }
  ];

  const testingTools = [
    {
      category: "Email Testing Services",
      tools: [
        { name: "Litmus", url: "https://litmus.com", description: "Comprehensive email testing" },
        { name: "Email on Acid", url: "https://www.emailonacid.com", description: "Cross-client testing" },
        { name: "PutsMail", url: "https://putsmail.com", description: "Free email testing" },
        { name: "Mailtrap", url: "https://mailtrap.io", description: "Email testing sandbox" }
      ]
    },
    {
      category: "Validation Tools",
      tools: [
        { name: "W3C Validator", url: "https://validator.w3.org", description: "HTML validation" },
        { name: "Mail Tester", url: "https://www.mail-tester.com", description: "Spam score testing" },
        { name: "Send Forensics", url: "https://www.sendforensics.com", description: "Deliverability testing" },
        { name: "Mail Genius", url: "https://www.mailgenius.com", description: "Email optimization" }
      ]
    }
  ];

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'red': return 'border-red-500';
      case 'yellow': return 'border-yellow-500';
      case 'blue': return 'border-blue-500';
      case 'green': return 'border-green-500';
      default: return 'border-gray-500';
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case 'red': return 'text-red-700';
      case 'yellow': return 'text-yellow-700';
      case 'blue': return 'text-blue-700';
      case 'green': return 'text-green-700';
      default: return 'text-gray-700';
    }
  };

  return (
    <section id="troubleshooting" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Troubleshooting</h2>
      
      <div className="space-y-6">
        {/* Common Issues */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Common Issues & Solutions</h3>
          
          <div className="space-y-6">
            {issues.map((issue, index) => (
              <div key={index} className={`border-l-4 ${getBorderColor(issue.type)} pl-4`}>
                <h4 className={`font-semibold ${getTextColor(issue.type)}`}>{issue.title}</h4>
                <p className="text-gray-600 text-sm mt-1">{issue.description}</p>
                <div className="mt-2">
                  <h5 className="font-semibold text-sm">Solutions:</h5>
                  <ul className="text-sm text-gray-600 mt-1 space-y-1">
                    {issue.solutions.map((solution, solutionIndex) => (
                      <li key={solutionIndex}>• {solution}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testing Tools */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Testing Tools</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {testingTools.map((category, index) => (
              <div key={index}>
                <h4 className="font-semibold mb-3">{category.category}</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  {category.tools.map((tool, toolIndex) => (
                    <li key={toolIndex}>
                      • <a href={tool.url} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{tool.name}</a> - {tool.description}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
