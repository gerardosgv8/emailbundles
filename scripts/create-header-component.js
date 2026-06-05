// Script to create Header component from master template
// This will be run once to initialize the Header component

const headerComponent = {
  id: 'header',
  name: 'Header',
  html: `<!-- Component start Header -->
<tr>
  <td align="center" style="padding: 30px 20px; background-color: #ffffff; border-radius: 12px 12px 0 0;">
    <!--[if mso | IE]><br /><![endif]-->
    <img data-element="header-logo" src="https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING" alt="Company Logo" width="180" height="60" style="display: block; width: 180px; height: 60px; margin: 0 auto 20px; border: 0;" />
    <!--[if mso | IE]><br /><![endif]-->
    <h1 data-element="header-title" style="margin: 0 0 10px 0; color: #1e293b; font-size: 28px; font-weight: 700; line-height: 34px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Complete Your Checkout</h1>
    <p data-element="header-subhead" style="margin: 0; color: #64748b; font-size: 16px; line-height: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Secure payment • Fast checkout • SSL protected</p>
  </td>
</tr>
<!-- Component end Header -->`,
  elements: [
    {
      id: 'header_logo',
      type: 'image',
      selector: 'img[data-element="header-logo"]',
      label: 'Header Logo',
      defaultValue: 'https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING',
      value: 'https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING',
      visible: true,
      properties: {
        url: 'https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING',
        alt: 'Company Logo',
        width: 180,
        height: 60
      }
    },
    {
      id: 'header_title',
      type: 'heading',
      selector: 'h1[data-element="header-title"]',
      label: 'Header Title',
      defaultValue: 'Complete Your Checkout',
      value: 'Complete Your Checkout',
      visible: true,
      properties: {
        paddingBottom: 0
      }
    },
    {
      id: 'header_subhead',
      type: 'text',
      selector: 'p[data-element="header-subhead"]',
      label: 'Header Subhead',
      defaultValue: 'Secure payment • Fast checkout • SSL protected',
      value: 'Secure payment • Fast checkout • SSL protected',
      visible: true,
      properties: {
        paddingTop: 0
      }
    }
  ],
  status: 'live',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Save to localStorage (for browser environment)
if (typeof window !== 'undefined') {
  const savedComponents = JSON.parse(localStorage.getItem('componentLibrary') || '[]');
  const existingIndex = savedComponents.findIndex(c => c.id === 'header');
  
  if (existingIndex >= 0) {
    savedComponents[existingIndex] = { ...headerComponent, createdAt: savedComponents[existingIndex].createdAt };
  } else {
    savedComponents.push(headerComponent);
  }
  
  localStorage.setItem('componentLibrary', JSON.stringify(savedComponents));
  console.log('✅ Header component created/updated in component library');
}

module.exports = headerComponent;

