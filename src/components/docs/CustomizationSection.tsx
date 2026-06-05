import React from 'react';

export const CustomizationSection: React.FC = () => {
  return (
    <section id="customization" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Customization Guide</h2>
      
      <div className="space-y-6">
        {/* Colors */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Changing Colors</h3>
          <p className="text-gray-600 mb-4">
            Color values are defined inline in the <code className="bg-gray-200 px-1 rounded">style</code> attribute. All templates use hex color codes for maximum compatibility.
          </p>
          
          <div className="bg-gray-50 rounded-md p-4 mb-4">
            <pre className="text-sm text-gray-700 overflow-x-auto">
              <code>{`<!-- Button Background Color -->
<td style="background-color: #2563eb;">
  <!-- Primary blue - Change #2563eb to your brand color -->
</td>

<!-- Text Color -->
<p style="color: #1e293b;">
  <!-- Dark gray text - Change #1e293b to your text color -->
</p>

<!-- Background Color -->
<table style="background-color: #f8fafc;">
  <!-- Light gray background - Change #f8fafc to your background -->
</table>`}</code>
            </pre>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-4">
            <div>
              <h4 className="font-semibold mb-3">Where to Find Colors</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• <code className="bg-gray-200 px-1 rounded">background-color:</code> - Backgrounds, buttons, sections</li>
                <li>• <code className="bg-gray-200 px-1 rounded">color:</code> - Text colors</li>
                <li>• <code className="bg-gray-200 px-1 rounded">border-color:</code> - Border colors</li>
                <li>• Look for <code className="bg-gray-200 px-1 rounded">#</code> followed by 6 characters</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Common Colors in Templates</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Primary: <span className="inline-block w-4 h-4 rounded bg-blue-600 mr-1"></span> <code className="bg-gray-200 px-1 rounded">#2563eb</code> (buttons, CTAs)</li>
                <li>• Dark text: <span className="inline-block w-4 h-4 rounded bg-gray-900 mr-1"></span> <code className="bg-gray-200 px-1 rounded">#1e293b</code> (headings)</li>
                <li>• Light text: <span className="inline-block w-4 h-4 rounded bg-gray-500 mr-1"></span> <code className="bg-gray-200 px-1 rounded">#64748b</code> (body)</li>
                <li>• Background: <span className="inline-block w-4 h-4 rounded bg-gray-100 mr-1"></span> <code className="bg-gray-200 px-1 rounded">#f8fafc</code> (page bg)</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>💡 Quick Tip:</strong> Use <a href="https://htmlcolorcodes.com/" target="_blank" rel="noopener noreferrer" className="underline">HTML Color Codes</a> to find hex values. Click "Search" to convert from color name to hex.
            </p>
          </div>
        </div>

        {/* Fonts */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Font Customization</h3>
          <p className="text-gray-600 mb-4">
            Fonts are defined inline in the <code className="bg-gray-200 px-1 rounded">style</code> attribute. Always include fallback fonts for maximum compatibility.
          </p>
          
          <div className="bg-gray-50 rounded-md p-4 mb-4">
            <pre className="text-sm text-gray-700 overflow-x-auto">
              <code>{`<!-- Main Font Family - Defined in <body> tag -->
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif;">

<!-- Title Font -->
<h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
           font-size: 32px; 
           font-weight: 700;">
  Welcome aboard!
</h1>

<!-- Body Text Font -->
<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          font-size: 16px; 
          font-weight: 400;">
  Hi there! We're excited...
</p>`}</code>
            </pre>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-4">
            <div>
              <h4 className="font-semibold mb-3">Recommended System Fonts</h4>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <p className="text-xs font-semibold text-blue-900 mb-2">✅ BEST (Default)</p>
                <code className="text-xs">font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif;</code>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Arial, Helvetica, sans-serif</li>
                <li>• Georgia, "Times New Roman", serif</li>
                <li>• Verdana, Geneva, sans-serif</li>
                <li>• "Trebuchet MS", sans-serif</li>
                <li>• "Courier New", Courier, monospace</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Font Size Guidelines</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>Hero titles:</strong> 28-36px</li>
                <li>• <strong>Section headers:</strong> 20-24px</li>
                <li>• <strong>Body text:</strong> 14-16px</li>
                <li>• <strong>Small text:</strong> 12-14px</li>
                <li>• <strong>Buttons:</strong> 14-18px</li>
              </ul>
              <h4 className="font-semibold mb-2 mt-4">Font Weight</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 400 = Regular</li>
                <li>• 600 = Semibold</li>
                <li>• 700 = Bold</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Important:</strong> Always include at least 2-3 fallback fonts in your font-family stack. Email clients have limited font support compared to web browsers.
            </p>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-4">Image Management</h3>
          <p className="text-gray-600 mb-4">
            Replace placeholder images with your own content and ensure proper optimization.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Image Requirements</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Format: JPG, PNG, or GIF</li>
                <li>• Max width: 600px for email width</li>
                <li>• File size: Under 1MB per image</li>
                <li>• Alt text: Always include descriptive alt text</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Hosting Options</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Your website CDN</li>
                <li>• Cloud storage (AWS S3, etc.)</li>
                <li>• Email service provider</li>
                <li>• Image hosting services</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
