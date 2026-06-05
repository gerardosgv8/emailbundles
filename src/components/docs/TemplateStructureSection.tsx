import React from 'react';

export const TemplateStructureSection: React.FC = () => {
  return (
    <section id="template-structure" className="mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Template Structure & Navigation</h2>
      
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">HTML Structure</h3>
        <p className="text-gray-600 mb-4">
          All templates follow a consistent structure optimized for email clients:
        </p>
        
        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <pre className="text-sm text-gray-700">
            <code>{`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Email Title</title>
</head>
<body>
  <table role="presentation" width="100%">
    <tr>
      <td align="center">
        <!-- Main Container -->
      </td>
    </tr>
  </table>
</body>
</html>`}</code>
          </pre>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Key Components</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Table-based layout for maximum compatibility</li>
              <li>• Inline CSS for consistent rendering</li>
              <li>• VML buttons for Outlook support</li>
              <li>• Responsive design with media queries</li>
              <li>• Alt text for all images</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">File Organization</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <code className="bg-gray-200 px-1 rounded">template-name.html</code> - Main template file</li>
              <li>• <code className="bg-gray-200 px-1 rounded">images/</code> - Template images</li>
              <li>• <code className="bg-gray-200 px-1 rounded">css/</code> - Additional stylesheets</li>
              <li>• <code className="bg-gray-200 px-1 rounded">docs/</code> - Documentation files</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Component Navigation Guide */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Navigating Email Templates</h3>
        <p className="text-gray-600 mb-4">
          Every template is structured using HTML comments to mark different sections. Look for these comments to quickly find what you need to edit:
        </p>
        
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <p className="text-sm text-blue-800 mb-2"><strong>💡 Tip:</strong> Open your template in a code editor and search for <code className="bg-blue-200 px-1 rounded">{'<!--'}</code> to jump between sections</p>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-green-600">✓</span> Section Markers
            </h4>
            <div className="bg-gray-50 rounded-md p-3 mb-3">
              <pre className="text-xs text-gray-700">{`<!-- Header -->
<!-- Hero Image -->
<!-- Main Content -->
<!-- CTA Button -->
<!-- Footer -->`}</pre>
            </div>
            <p className="text-sm text-gray-600">Each section is clearly marked with HTML comments to help you quickly navigate</p>
          </div>

          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-green-600">✓</span> Finding Content Areas
            </h4>
            <p className="text-sm text-gray-600 mb-2">To update email content, look for text within <code className="bg-gray-200 px-1 rounded">&lt;td&gt;</code> or <code className="bg-gray-200 px-1 rounded">&lt;p&gt;</code> tags:</p>
            <div className="bg-gray-50 rounded-md p-3">
              <pre className="text-xs text-gray-700">{`<td>
  <h1 style="...">Welcome aboard!</h1>
  <!-- ^ Change this text -->
</td>

<td>
  <p style="...">We're thrilled to have you...</p>
  <!-- ^ Change this text -->
</td>`}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Component in Table Structure Example */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Understanding Table-Based Layout</h3>
        <p className="text-gray-600 mb-4">
          Email templates use HTML tables instead of CSS grid or flexbox for maximum email client compatibility. Here's how a typical component is structured:
        </p>
        
        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <pre className="text-xs text-gray-700 overflow-x-auto">
            <code>{`<!-- Main Container -->
<table border="0" cellpadding="0" cellspacing="0" width="600" style="...">
  
  <!-- Header Section -->
  <tr>
    <td align="center" style="padding: 40px 30px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <h1 style="...">Welcome aboard!</h1>
          </td>
        </tr>
        <tr>
          <td align="center">
            <p style="...">We're thrilled to have you join</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  
  <!-- Main Content Section -->
  <tr>
    <td style="padding: 40px 30px;">
      <h2 style="...">Let's get you started</h2>
      <p style="...">Hi there! We're excited...</p>
    </td>
  </tr>
  
</table>`}</code>
          </pre>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div>
            <h4 className="font-semibold mb-3 text-green-700">Table Structure</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Outer table = main container (600px wide)</li>
              <li>• Each <code className="bg-gray-200 px-1 rounded">&lt;tr&gt;</code> = horizontal row</li>
              <li>• Each <code className="bg-gray-200 px-1 rounded">&lt;td&gt;</code> = cell/column</li>
              <li>• Nested tables = complex layouts</li>
              <li>• <code className="bg-gray-200 px-1 rounded">role="presentation"</code> = accessibility</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-blue-700">Editing Content</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Find the HTML comment marking the section</li>
              <li>• Locate the <code className="bg-gray-200 px-1 rounded">&lt;h1&gt;</code>, <code className="bg-gray-200 px-1 rounded">&lt;p&gt;</code>, or <code className="bg-gray-200 px-1 rounded">&lt;a&gt;</code> tag</li>
              <li>• Change only the text content inside</li>
              <li>• Keep the <code className="bg-gray-200 px-1 rounded">style</code> attributes intact</li>
              <li>• Test your changes</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Important:</strong> Never delete table tags (<code className="bg-yellow-200 px-1 rounded">&lt;table&gt;</code>, <code className="bg-yellow-200 px-1 rounded">&lt;tr&gt;</code>, <code className="bg-yellow-200 px-1 rounded">&lt;td&gt;</code>) or their attributes. These are essential for proper email rendering across all clients.
          </p>
        </div>
      </div>

      {/* Example Component Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Real Example: Header Component</h3>
        <p className="text-gray-600 mb-4">
          Let's break down a complete component from <code className="bg-gray-200 px-1 rounded">exampleTemplate.html</code>:
        </p>
        
        <div className="bg-gray-50 rounded-md p-4">
          <pre className="text-xs text-gray-700 overflow-x-auto">
            <code>{`<!-- Header -->
<tr>
  <td align="center" style="padding: 40px 30px 20px 30px;">
    <!-- ^ Container spacing -->
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <!-- ^ Nested table for layout -->
      
      <!-- Logo Row -->
      <tr>
        <td align="center">
          <img src="https://via.placeholder.com/150x50" 
               alt="Your Brand" 
               width="150" height="50"
               style="display: block; width: 150px; margin: 0 auto 20px;" />
          <!-- ^ Update src, alt, dimensions, and spacing -->
        </td>
      </tr>
      
      <!-- Title Row -->
      <tr>
        <td align="center">
          <h1 style="margin: 0 0 10px 0; color: #1e293b; font-size: 32px;">
            Welcome aboard!
            <!-- ^ CHANGE THIS TEXT -->
          </h1>
        </td>
      </tr>
      
      <!-- Subtitle Row -->
      <tr>
        <td align="center">
          <p style="margin: 0; color: #64748b; font-size: 18px;">
            We're thrilled to have you join our community
            <!-- ^ CHANGE THIS TEXT -->
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>`}</code>
          </pre>
        </div>

        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-semibold mb-2 text-blue-900">Edit Text</h4>
            <p className="text-xs text-blue-800">Change "Welcome aboard!" and subtitle text</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <h4 className="font-semibold mb-2 text-green-900">Edit Colors</h4>
            <p className="text-xs text-green-800">Modify color values like #1e293b</p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <h4 className="font-semibold mb-2 text-purple-900">Edit Images</h4>
            <p className="text-xs text-purple-800">Update src, width, height, alt</p>
          </div>
        </div>
      </div>
    </section>
  );
};
