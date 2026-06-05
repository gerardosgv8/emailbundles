/**
 * Manual Dynamic Template Generator
 * Creates dynamic templates based on predefined rules and patterns
 */

export const templateConversions = {
  // Ecommerce Bundle Templates
  'ecom_bundle': {
    '01_checkout_email': {
      templateId: 'ecom_checkout_email',
      templateName: 'Checkout Abandonment Email',
      category: 'ecom',
      description: 'Transactional email to recover abandoned checkout sessions',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img[alt="Shopping Cart"]', label: 'Logo Image' },
        { id: 'main_heading', type: 'heading', selector: 'h1', label: 'Main Heading' },
        { id: 'subtitle', type: 'text', selector: 'p:contains("Secure payment")', label: 'Subtitle' },
        { id: 'section_heading', type: 'heading', selector: 'h2', label: 'Section Heading' },
        { id: 'product_1_image', type: 'image', selector: 'img[alt="Wireless Headphones"]', label: 'Product 1 Image' },
        { id: 'product_1_title', type: 'heading', selector: 'h3:contains("Premium")', label: 'Product 1 Title' },
        { id: 'product_1_price', type: 'text', selector: 'p:contains("$199")', label: 'Product 1 Price' },
        { id: 'product_2_image', type: 'image', selector: 'img[alt="Smart Watch"]', label: 'Product 2 Image' },
        { id: 'product_2_title', type: 'heading', selector: 'h3:contains("Smart")', label: 'Product 2 Title' },
        { id: 'product_2_price', type: 'text', selector: 'p:contains("$299")', label: 'Product 2 Price' },
        { id: 'cta_heading', type: 'heading', selector: 'h3:contains("Ready")', label: 'CTA Heading' },
        { id: 'cta_text', type: 'text', selector: 'p:contains("Complete your secure")', label: 'CTA Description' },
        { id: 'checkout_button', type: 'button', selector: 'a:contains("Complete Checkout")', label: 'Checkout Button' },
        { id: 'footer_heading', type: 'heading', selector: 'h3:contains("Shopping Cart")', label: 'Footer Heading' },
        { id: 'footer_text', type: 'text', selector: 'p:contains("Secure checkout")', label: 'Footer Text' },
        { id: 'help_center_link', type: 'link', selector: 'a:contains("Help Center")', label: 'Help Center Link' },
        { id: 'contact_support_link', type: 'link', selector: 'a:contains("Contact Support")', label: 'Contact Support Link' },
        { id: 'unsubscribe_link', type: 'link', selector: 'a:contains("Unsubscribe")', label: 'Unsubscribe Link' },
      ],
      sections: ['header', 'cart_summary', 'cta_section', 'footer'],
    },
    '02_order_confirmation': {
      templateId: 'ecom_order_confirmation',
      templateName: 'Order Confirmation Email',
      category: 'ecom',
      description: 'Confirmation email sent after successful order placement',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img[alt*="Store"]', label: 'Logo Image' },
        { id: 'main_heading', type: 'heading', selector: 'h1', label: 'Main Heading' },
        { id: 'order_number', type: 'text', selector: 'text*="Order #"', label: 'Order Number' },
        { id: 'thank_you_message', type: 'text', selector: 'p:contains("Thank you")', label: 'Thank You Message' },
        { id: 'delivery_info', type: 'text', selector: 'p*="delivery"', label: 'Delivery Information' },
        { id: 'cta_button', type: 'button', selector: 'a.button', label: 'Track Order Button' },
        { id: 'footer_text', type: 'text', selector: 'footer p', label: 'Footer Text' },
      ],
      sections: ['header', 'order_header', 'order_product', 'order_summary', 'delivery_info', 'footer'],
    },
    '05_new_products_email': {
      templateId: 'ecom_new_products',
      templateName: 'Product Recommendations (Single Product, 4 Product Grid)',
      category: 'ecom',
      description: 'Announce new product arrivals',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'main_heading', type: 'heading', selector: 'h1', label: 'Main Heading' },
        { id: 'intro_text', type: 'text', selector: 'p.intro', label: 'Introduction Text' },
        { id: 'product_grid_1', type: 'image', selector: 'img.product-1', label: 'Product 1 Image' },
        { id: 'product_grid_2', type: 'image', selector: 'img.product-2', label: 'Product 2 Image' },
        { id: 'shop_button', type: 'button', selector: 'a.shop', label: 'Shop New Products Button' },
      ],
      sections: ['header', 'intro', 'products_grid', 'footer'],
    },
    '09_promotional_email_1': {
      templateId: 'ecom_promotional_1',
      templateName: 'Promotional Campaign',
      category: 'ecom',
      description: 'General promotional email for sales and offers',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'hero_image', type: 'image', selector: 'img.hero', label: 'Hero Image' },
        { id: 'sale_heading', type: 'heading', selector: 'h1', label: 'Sale Heading' },
        { id: 'promo_text', type: 'text', selector: 'p.promo', label: 'Promotional Text' },
        { id: 'discount_code', type: 'text', selector: 'span.code', label: 'Discount Code' },
        { id: 'shop_button', type: 'button', selector: 'a.shop-now', label: 'Shop Now Button' },
      ],
      sections: ['header', 'hero', 'promo_details', 'footer'],
    },
    '11_back_in_stock_email': {
      templateId: 'ecom_back_in_stock',
      templateName: 'Back in Stock Notification',
      category: 'ecom',
      description: 'Notify customers when previously out-of-stock items return',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'main_heading', type: 'heading', selector: 'h1', label: 'Main Heading' },
        { id: 'product_image', type: 'image', selector: 'img.product', label: 'Product Image' },
        { id: 'product_title', type: 'heading', selector: 'h2', label: 'Product Title' },
        { id: 'availability_text', type: 'text', selector: 'p.stock', label: 'Availability Message' },
        { id: 'buy_now_button', type: 'button', selector: 'a.buy', label: 'Buy Now Button' },
      ],
      sections: ['header', 'product_notification', 'footer'],
    },
  },
  // Free Flow Templates
  'free_flow': {
    '01_welcome_onboarding': {
      templateId: 'freeflow_welcome',
      templateName: 'Welcome & Onboarding',
      category: 'free_flow',
      description: 'Welcome new users to your platform or service',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'welcome_heading', type: 'heading', selector: 'h1', label: 'Welcome Heading' },
        { id: 'intro_text', type: 'text', selector: 'p.intro', label: 'Introduction Text' },
        { id: 'feature_1', type: 'text', selector: 'li.feature-1', label: 'Feature 1' },
        { id: 'feature_2', type: 'text', selector: 'li.feature-2', label: 'Feature 2' },
        { id: 'get_started_button', type: 'button', selector: 'a.start', label: 'Get Started Button' },
      ],
      sections: ['header', 'welcome_section', 'features', 'footer'],
    },
    '02_product_launch': {
      templateId: 'freeflow_product_launch',
      templateName: 'Product Launch',
      category: 'free_flow',
      description: 'Announce a new product or feature launch',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'launch_heading', type: 'heading', selector: 'h1', label: 'Launch Heading' },
        { id: 'hero_image', type: 'image', selector: 'img.hero', label: 'Hero Image' },
        { id: 'launch_date', type: 'text', selector: 'p.date', label: 'Launch Date' },
        { id: 'description_text', type: 'text', selector: 'p.desc', label: 'Product Description' },
        { id: 'learn_more_button', type: 'button', selector: 'a.learn', label: 'Learn More Button' },
      ],
      sections: ['header', 'hero', 'launch_info', 'footer'],
    },
    '03_newsletter_editorial': {
      templateId: 'freeflow_newsletter',
      templateName: 'Newsletter Editorial',
      category: 'free_flow',
      description: 'Regular newsletter with editorial content',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'newsletter_heading', type: 'heading', selector: 'h1', label: 'Newsletter Title' },
        { id: 'date_text', type: 'text', selector: 'p.date', label: 'Newsletter Date' },
        { id: 'article_1_heading', type: 'heading', selector: 'h2.article-1', label: 'Article 1 Heading' },
        { id: 'article_1_text', type: 'text', selector: 'p.article-1', label: 'Article 1 Text' },
        { id: 'read_more_button', type: 'button', selector: 'a.read', label: 'Read More Button' },
      ],
      sections: ['header', 'newsletter_title', 'articles', 'footer'],
    },
    '05_event_invitation': {
      templateId: 'freeflow_event_invite',
      templateName: 'Event Invitation',
      category: 'free_flow',
      description: 'Invite users to events, webinars, or special occasions',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'event_heading', type: 'heading', selector: 'h1', label: 'Event Title' },
        { id: 'event_image', type: 'image', selector: 'img.event', label: 'Event Image' },
        { id: 'event_date', type: 'text', selector: 'p.date', label: 'Event Date' },
        { id: 'event_location', type: 'text', selector: 'p.location', label: 'Event Location' },
        { id: 'rsvp_button', type: 'button', selector: 'a.rsvp', label: 'RSVP Button' },
      ],
      sections: ['header', 'event_info', 'details', 'footer'],
    },
    '07_feature_announcement': {
      templateId: 'freeflow_feature_announce',
      templateName: 'Feature Announcement',
      category: 'free_flow',
      description: 'Announce new features or updates',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'feature_heading', type: 'heading', selector: 'h1', label: 'Feature Title' },
        { id: 'feature_image', type: 'image', selector: 'img.feature', label: 'Feature Image' },
        { id: 'benefit_1', type: 'text', selector: 'li.benefit-1', label: 'Benefit 1' },
        { id: 'benefit_2', type: 'text', selector: 'li.benefit-2', label: 'Benefit 2' },
        { id: 'try_it_button', type: 'button', selector: 'a.try', label: 'Try It Now Button' },
      ],
      sections: ['header', 'feature_info', 'benefits', 'footer'],
    },
    '10_thank_you': {
      templateId: 'freeflow_thank_you',
      templateName: 'Thank You Email',
      category: 'free_flow',
      description: 'Express gratitude to customers',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'thank_you_heading', type: 'heading', selector: 'h1', label: 'Thank You Heading' },
        { id: 'appreciation_text', type: 'text', selector: 'p.appreciate', label: 'Appreciation Message' },
        { id: 'next_steps', type: 'text', selector: 'p.next', label: 'Next Steps' },
        { id: 'contact_button', type: 'button', selector: 'a.contact', label: 'Contact Us Button' },
      ],
      sections: ['header', 'thanks_section', 'next_steps', 'footer'],
    },
    '11_survey_feedback': {
      templateId: 'freeflow_survey',
      templateName: 'Survey & Feedback',
      category: 'free_flow',
      description: 'Request customer feedback and surveys',
      elements: [
        { id: 'logo_img', type: 'image', selector: 'img', label: 'Logo Image' },
        { id: 'survey_heading', type: 'heading', selector: 'h1', label: 'Survey Heading' },
        { id: 'intro_text', type: 'text', selector: 'p.intro', label: 'Introduction Text' },
        { id: 'duration_text', type: 'text', selector: 'p.duration', label: 'Duration Info' },
        { id: 'take_survey_button', type: 'button', selector: 'a.survey', label: 'Take Survey Button' },
      ],
      sections: ['header', 'survey_info', 'footer'],
    },
  },
};

// Function to generate dynamic template config
export function generateDynamicTemplateConfig(category, templateName, htmlContent) {
  const config = templateConversions[category]?.[templateName];
  if (!config) {
    throw new Error(`No configuration found for ${category}/${templateName}`);
  }

  // This would be expanded to actually extract values from HTML
  // For now, we return the configuration structure
  const elements = config.elements.map((el, idx) => ({
    ...el,
    defaultValue: extractDefaultValue(el, htmlContent),
    value: extractDefaultValue(el, htmlContent),
    visible: true,
    properties: el.properties || {},
  }));

  return {
    meta: {
      templateId: config.templateId,
      templateName: config.templateName,
      category: config.category,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: config.description,
    },
    html: htmlContent,
    elements,
    sections: config.sections.map((sectionId, idx) => ({
      id: sectionId,
      name: sectionId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      visible: true,
      elements: elements.slice(idx * 3, (idx + 1) * 3).map(e => e.id),
    })),
  };
}

function extractDefaultValue(element, htmlContent) {
  // Placeholder extraction - would use actual HTML parsing
  if (element.type === 'image') {
    return 'https://via.placeholder.com/300x200';
  }
  if (element.type === 'heading') {
    return `${element.label.replace('Heading: ', '')}`;
  }
  if (element.type === 'text') {
    return 'Default text content';
  }
  if (element.type === 'button') {
    return element.label.replace('Button: ', '');
  }
  return '';
}

