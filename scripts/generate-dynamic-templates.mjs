import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template configurations
const templateConfigs = {
  'ecom_bundle': {
    '01_checkout_email': {
      templateId: 'ecom_checkout_email',
      templateName: 'Checkout Abandonment Email',
      description: 'Transactional email to recover abandoned checkout sessions',
    },
    '02_order_confirmation': {
      templateId: 'ecom_order_confirmation',
      templateName: 'Order Confirmation Email',
      description: 'Confirmation email sent after successful order placement',
    },
    '04_loyalty_email': {
      templateId: 'ecom_loyalty',
      templateName: 'Loyalty Program Email',
      description: 'Engage customers with loyalty program updates and rewards',
    },
    '05_new_products_email': {
      templateId: 'ecom_new_products',
      templateName: 'New Products Launch',
      description: 'Announce new product arrivals',
    },
    '09_promotional_email_1': {
      templateId: 'ecom_promotional_1',
      templateName: 'Promotional Campaign',
      description: 'General promotional email for sales and offers',
    },
    '11_back_in_stock_email': {
      templateId: 'ecom_back_in_stock',
      templateName: 'Back in Stock Notification',
      description: 'Notify customers when previously out-of-stock items return',
    },
  },
  'free_flow': {
    '01_welcome_onboarding': {
      templateId: 'freeflow_welcome',
      templateName: 'Welcome & Onboarding',
      description: 'Welcome new users to your platform or service',
    },
    '02_product_launch': {
      templateId: 'freeflow_product_launch',
      templateName: 'Product Launch',
      description: 'Announce a new product or feature launch',
    },
    '03_newsletter_editorial': {
      templateId: 'freeflow_newsletter',
      templateName: 'Newsletter Editorial',
      description: 'Regular newsletter with editorial content',
    },
    '05_event_invitation': {
      templateId: 'freeflow_event_invite',
      templateName: 'Event Invitation',
      description: 'Invite users to events, webinars, or special occasions',
    },
    '07_feature_announcement': {
      templateId: 'freeflow_feature_announce',
      templateName: 'Feature Announcement',
      description: 'Announce new features or updates',
    },
    '08_holiday_greeting': {
      templateId: 'freeflow_holiday',
      templateName: 'Holiday Greeting',
      description: 'Send holiday wishes and greetings',
    },
    '10_thank_you': {
      templateId: 'freeflow_thank_you',
      templateName: 'Thank You Email',
      description: 'Express gratitude to customers',
    },
    '11_survey_feedback': {
      templateId: 'freeflow_survey',
      templateName: 'Survey & Feedback',
      description: 'Request customer feedback and surveys',
    },
    '12_partnership_announcement': {
      templateId: 'freeflow_partnership',
      templateName: 'Partnership Announcement',
      description: 'Announce partnerships or collaborations',
    },
  },
};

// Generic element extraction based on patterns
function extractElements(htmlContent, config) {
  const elements = [];
  const elementPositions = new Map(); // Map element ID to its position in HTML
  
  // Extract images - match src, alt, and optional width/height attributes
  const imgPattern = /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi;
  let imgMatch;
  let imgCount = 0;
  while ((imgMatch = imgPattern.exec(htmlContent)) !== null) {
    imgCount++;
    const fullTag = imgMatch[0];
    const src = imgMatch[1];
    const alt = imgMatch[2];
    
    // Extract width and height attributes separately (they may be in any order)
    const widthMatch = fullTag.match(/width="?(\d+)"?/i);
    const heightMatch = fullTag.match(/height="?(\d+)"?/i);
    
    const elementId = `img_${imgCount}`;
    const element = {
      id: elementId,
      type: 'image',
      selector: `img[alt="${alt}"]`,
      label: `Image: ${alt}`,
      defaultValue: src,
      value: src,
      visible: true,
      properties: {
        url: src,
        alt: alt || 'Image',
        width: widthMatch ? parseInt(widthMatch[1]) : undefined,
        height: heightMatch ? parseInt(heightMatch[1]) : undefined,
      },
      validation: {
        required: false,
        allowedTypes: ['url'],
      },
    };
    elements.push(element);
    elementPositions.set(elementId, imgMatch.index);
  }

  // Extract headings
  const h1Pattern = /<h1[^>]*>([^<]+)<\/h1>/gi;
  let h1Count = 0;
  let h1Match;
  while ((h1Match = h1Pattern.exec(htmlContent)) !== null) {
    h1Count++;
    const text = h1Match[1].trim();
    const elementId = `heading_main_${h1Count}`;
    const element = {
      id: elementId,
      type: 'heading',
      selector: 'h1',
      label: `Main Heading ${h1Count > 1 ? h1Count : ''}`,
      defaultValue: text,
      value: text,
      visible: true,
      properties: {
        fontSize: '32px',
        textColor: '#1e293b',
      },
      validation: {
        required: true,
        maxLength: 100,
      },
    };
    elements.push(element);
    elementPositions.set(elementId, h1Match.index);
  }

  const h2Pattern = /<h2[^>]*>([^<]+)<\/h2>/gi;
  let h2Count = 0;
  let h2Match;
  while ((h2Match = h2Pattern.exec(htmlContent)) !== null) {
    h2Count++;
    const text = h2Match[1].trim();
    const elementId = `heading_section_${h2Count}`;
    const element = {
      id: elementId,
      type: 'heading',
      selector: 'h2',
      label: `Section Heading ${h2Count > 1 ? h2Count : ''}`,
      defaultValue: text,
      value: text,
      visible: true,
      properties: {
        fontSize: '24px',
        textColor: '#1f2937',
      },
      validation: {
        required: false,
        maxLength: 100,
      },
    };
    elements.push(element);
    elementPositions.set(elementId, h2Match.index);
  }

  const h3Pattern = /<h3[^>]*>([^<]+)<\/h3>/gi;
  let h3Count = 0;
  let h3Match;
  while ((h3Match = h3Pattern.exec(htmlContent)) !== null) {
    h3Count++;
    const text = h3Match[1].trim();
    const elementId = `heading_sub_${h3Count}`;
    const element = {
      id: elementId,
      type: 'heading',
      selector: 'h3',
      label: `Sub Heading ${h3Count > 1 ? h3Count : ''}`,
      defaultValue: text,
      value: text,
      visible: true,
      properties: {
        fontSize: '18px',
        textColor: '#1f2937',
      },
      validation: {
        required: false,
        maxLength: 100,
      },
    };
    elements.push(element);
    elementPositions.set(elementId, h3Match.index);
  }

  // Extract buttons
  const buttonPattern = /<a[^>]*style="[^"]*background-color:\s*#([^;"]+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let buttonCount = 0;
  let buttonMatch;
  while ((buttonMatch = buttonPattern.exec(htmlContent)) !== null) {
    buttonCount++;
    const [, bgColor, text] = buttonMatch;
    const elementId = `button_${buttonCount}`;
    const element = {
      id: elementId,
      type: 'button',
      selector: `a:contains('${text.substring(0, 20)}')`,
      label: `Button: ${text}`,
      defaultValue: text,
      value: text,
      visible: true,
      properties: {
        url: '#',
        backgroundColor: `#${bgColor}`,
        textColor: '#ffffff',
        fontSize: '16px',
        fontWeight: '600',
      },
      validation: {
        required: false,
      },
    };
    elements.push(element);
    elementPositions.set(elementId, buttonMatch.index);
  }

  // Extract regular links (non-button links)
  const allLinksPattern = /<a[^>]*>([^<]+)<\/a>/gi;
  let linkCount = 0;
  let allLinks = [];
  let tempMatch;
  while ((tempMatch = allLinksPattern.exec(htmlContent)) !== null) {
    allLinks.push({ html: tempMatch[0], index: tempMatch.index });
  }
  
  // Process unique links that aren't buttons
  const processedLinks = new Set();
  allLinks.forEach(({ html: linkHtml, index }) => {
    if (!linkHtml.includes('background-color:') && !processedLinks.has(linkHtml)) {
      processedLinks.add(linkHtml);
      const hrefMatch = linkHtml.match(/href="([^"]+)"/);
      const textMatch = linkHtml.match(/>([^<]+)</);
      if (hrefMatch && textMatch) {
        linkCount++;
        const elementId = `link_${linkCount}`;
        const element = {
          id: elementId,
          type: 'link',
          selector: `a:contains('${textMatch[1].substring(0, 20)}')`,
          label: `Link: ${textMatch[1]}`,
          defaultValue: textMatch[1],
          value: textMatch[1],
          visible: true,
          properties: {
            url: hrefMatch[1],
          },
          validation: {
            required: false,
          },
        };
        elements.push(element);
        elementPositions.set(elementId, index);
      }
    }
  });

  return { elements, elementPositions };
}

// Generate sections based on Component start/end markers
function generateSections(htmlContent, { elements, elementPositions }) {
  const sections = [];
  
  // Parse Component start/end markers (e.g., <!-- Component start Header -->)
  const componentStartPattern = /<!--\s*Component\s+start\s+([^-]+?)\s*-->/gi;
  const componentEndPattern = /<!--\s*Component\s+end\s+([^-]+?)\s*-->/gi;
  
  let startMatch;
  const componentRanges = [];
  
  while ((startMatch = componentStartPattern.exec(htmlContent)) !== null) {
    const componentName = startMatch[1].trim();
    const startPos = startMatch.index;
    
    // Find the corresponding Component end marker
    const endPattern = new RegExp(`<!--\\s*Component\\s+end\\s+${componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-->`, 'gi');
    endPattern.lastIndex = startPos; // Start searching from the start position
    const endMatch = endPattern.exec(htmlContent);
    
    if (endMatch) {
      componentRanges.push({
        name: componentName,
        start: startPos,
        end: endMatch.index + endMatch[0].length,
      });
    }
  }
  
  // Group elements by which component they fall into based on position
  componentRanges.forEach((component, idx) => {
    const nextComponent = componentRanges[idx + 1];
    const componentEnd = nextComponent ? nextComponent.start : htmlContent.length;
    
    // Find elements that fall within this component block
    const elementsInComponent = [];
    for (const [elementId, position] of elementPositions) {
      if (position >= component.start && position < componentEnd) {
        elementsInComponent.push(elementId);
      }
    }
    
    if (elementsInComponent.length > 0) {
      // Create a unique section ID from the name
      const sectionId = component.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      sections.push({
        id: sectionId,
        name: component.name,
        visible: true,
        elements: elementsInComponent,
      });
    }
  });
  
  // Fallback if no sections were created from comments
  if (sections.length === 0) {
    // Use old heuristic approach as fallback
    const headerSize = Math.floor(elements.length * 0.2);
    const footerSize = Math.floor(elements.length * 0.2);
    
    if (headerSize > 0) {
      sections.push({
        id: 'header',
        name: 'Header',
        visible: true,
        elements: elements.slice(0, headerSize).map(e => e.id),
      });
    }

    if (elements.length - headerSize - footerSize > 0) {
      sections.push({
        id: 'content',
        name: 'Content',
        visible: true,
        elements: elements.slice(headerSize, -footerSize || undefined).map(e => e.id),
      });
    }

    if (footerSize > 0) {
      sections.push({
        id: 'footer',
        name: 'Footer',
        visible: true,
        elements: elements.slice(-footerSize).map(e => e.id),
      });
    }
  }
  
  // Create a catch-all section for any unmapped elements
  const allMappedIds = new Set(sections.flatMap(s => s.elements));
  const unmappedElements = elements
    .map(e => e.id)
    .filter(id => !allMappedIds.has(id));
  
  if (unmappedElements.length > 0) {
    sections.push({
      id: 'other',
      name: 'Other',
      visible: true,
      elements: unmappedElements,
    });
  }
  
  return sections;
}

// Process templates
async function processTemplates() {
  const srcDir = path.join(__dirname, '../src');
  const templatesDir = path.join(srcDir, 'assets/emailTemplateshtml');
  const outputDir = path.join(srcDir, 'assets/dynamicEmailTemplates');

  console.log('🚀 Starting dynamic template generation...\n');

  for (const [category, templates] of Object.entries(templateConfigs)) {
    console.log(`📁 Processing category: ${category}`);
    
    for (const [filename, config] of Object.entries(templates)) {
      try {
        const htmlPath = path.join(templatesDir, category, `${filename}.html`);
        const outputPath = path.join(outputDir, `${config.templateId}.json`);

        if (!fs.existsSync(htmlPath)) {
          console.log(`  ⚠️  Skipping ${filename} - HTML file not found`);
          continue;
        }

        // Read HTML file
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        // Extract elements
        const { elements, elementPositions } = extractElements(htmlContent, config);

        // Generate sections
        const sections = generateSections(htmlContent, { elements, elementPositions });

        // Create dynamic template
        const dynamicTemplate = {
          meta: {
            templateId: config.templateId,
            templateName: config.templateName,
            category: category,
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            description: config.description,
          },
          html: htmlContent,
          elements,
          sections,
        };

        // Write JSON file
        fs.writeFileSync(outputPath, JSON.stringify(dynamicTemplate, null, 2), 'utf-8');
        console.log(`  ✅ Generated ${config.templateId}.json (${elements.length} elements)`);

      } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error.message);
      }
    }
  }

  console.log('\n✅ Template generation complete!');
}

// Run the script
processTemplates().catch(console.error);

