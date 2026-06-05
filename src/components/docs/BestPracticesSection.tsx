import React from 'react';

export const BestPracticesSection: React.FC = () => {
  const designGuidelines = [
    "Keep email width under 600px for optimal display",
    "Use high contrast colors for better readability",
    "Include alt text for all images",
    "Use web-safe fonts or web fonts with fallbacks",
    "Maintain consistent branding across all emails"
  ];

  const technicalGuidelines = [
    "Use inline CSS for maximum compatibility",
    "Test across multiple email clients",
    "Optimize images for web (compress file sizes)",
    "Use semantic HTML structure",
    "Include unsubscribe links and sender information"
  ];

  return (
    <section id="best-practices" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Best Practices</h2>
      
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Design Guidelines</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            {designGuidelines.map((guideline, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>{guideline}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Technical Guidelines</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            {technicalGuidelines.map((guideline, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>{guideline}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* MSO Conditional Rules */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">MSO Conditional Rules (Microsoft Outlook)</h3>
        <p className="text-gray-600 mb-4">
          MSO (Microsoft Office) conditional comments allow you to apply specific code only to Outlook email clients. This is <strong>essential</strong> for fixing rendering issues in Outlook.
        </p>

        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-sm text-red-800">
            <strong>⚠️ Critical:</strong> Outlook uses Word as its rendering engine, not a web browser. This means many CSS properties don't work. MSO rules fix these rendering issues.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-4">
          <div>
            <h4 className="font-semibold mb-3">Common MSO Rules</h4>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-md p-3">
                <pre className="text-xs text-gray-700 overflow-x-auto">
                  <code>{`<!-- Conditional: Outlook only -->
<!--[if mso]>
  <!-- This code only runs in Outlook -->
  <table>...</table>
<![endif]-->

<!-- Conditional: NOT Outlook -->
<!--[if !mso]>
  <!-- This code runs everywhere EXCEPT Outlook -->
  <div>...</div>
<!--<![endif]-->`}</code>
                </pre>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3">What MSO Fixes</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Border-radius (rounded corners)</li>
              <li>• CSS backgrounds</li>
              <li>• Padding/margin issues</li>
              <li>• Flexbox/grid layouts</li>
              <li>• Modern CSS properties</li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <h4 className="font-semibold mb-2">Real Example: Button with Rounded Corners</h4>
          <p className="text-sm text-blue-800 mb-3">
            Outlook doesn't support <code className="bg-blue-200 px-1 rounded">border-radius</code>, so we need VML (Vector Markup Language) for Outlook and regular CSS for other clients.
          </p>
          <div className="bg-gray-50 rounded-md p-3">
            <pre className="text-xs text-gray-700 overflow-x-auto">
              <code>{`<!-- Outlook version (VML) -->
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" 
             style="height:54px;width:200px;" 
             arcsize="15%" 
             fillcolor="#2563eb">
  <center style="color:#ffffff;font-size:16px;">
    Get Started Now
  </center>
</v:roundrect>
<![endif]-->

<!-- Everywhere else (Regular CSS) -->
<!--[if !mso]>
<table>
  <tr>
    <td style="background-color: #2563eb; border-radius: 8px;">
      <a href="#">Get Started Now</a>
    </td>
  </tr>
</table>
<!--<![endif]-->`}</code>
            </pre>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-green-700">✓ Outlook Gets</h4>
            <p className="text-xs text-gray-600">VML roundrect with same colors and text</p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-blue-700">✓ Others Get</h4>
            <p className="text-xs text-gray-600">Beautiful CSS with border-radius</p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-purple-700">✓ Result</h4>
            <p className="text-xs text-gray-600">Perfect button in all email clients!</p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold mb-3">Why MSO Rules Are Important</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span><strong>Outlook has 20%+ market share</strong> - You can't ignore it!</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span><strong>Prevents broken layouts</strong> - Buttons, spacing, and backgrounds</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span><strong>Professional appearance</strong> - Consistent experience for all users</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span><strong>Better deliverability</strong> - Well-rendered emails reduce spam flags</span>
            </li>
          </ul>
        </div>

        <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Important:</strong> Never remove MSO conditional comments from templates! They're already included and tested. Removing them will break Outlook rendering.
          </p>
        </div>
      </div>

      {/* Other Compatibility Issues */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Other Critical Compatibility Issues</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-red-600">Gmail</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Strips &lt;style&gt; tags</li>
              <li>• Inline CSS required</li>
              <li>• No support for media queries in &lt;style&gt;</li>
              <li>• Limited background image support</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-red-600">Apple Mail</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Best HTML/CSS support</li>
              <li>• Supports modern CSS</li>
              <li>• Good fallback for testing</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-red-600">Mobile Clients</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Use max-width on images</li>
              <li>• Test on iOS & Android</li>
              <li>• Minimum 14px font size</li>
              <li>• Touch-friendly buttons (44px+)</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
