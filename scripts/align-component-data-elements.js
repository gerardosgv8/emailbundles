#!/usr/bin/env node

/**
 * Script to align data-element attributes and HTML structure between
 * email builder templates and template_design_system.html components
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read email builder template
const emailTemplatePath = path.join(__dirname, '../src/assets/dynamicEmailTemplates/ecom_checkout_email.json');
const emailTemplate = JSON.parse(fs.readFileSync(emailTemplatePath, 'utf8'));

// Extract component sections from email template HTML
function extractComponentFromEmailTemplate(html, componentName) {
  const startMarker = `<!-- Component start ${componentName} -->`;
  const endMarker = `<!-- Component end ${componentName} -->`;
  
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    return null;
  }
  
  return html.substring(startIndex + startMarker.length, endIndex).trim();
}

// Get elements for a component
function getElementsForComponent(elements, componentName) {
  // Map component names to element prefixes
  const componentElementMap = {
    'Header': ['img_1', 'heading_main_1'],
    'Cart Summary': ['heading_section_1', 'heading_product_1_name', 'text_product_1_details', 'text_product_1_price', 'text_subtotal_amount', 'text_shipping_amount', 'text_tax_amount', 'text_total_amount'],
    'Checkout CTA': ['heading_checkout_cta', 'text_checkout_subheading', 'button_1'],
    'Footer': ['footer_company_name', 'footer_address', 'footer_tagline', 'footer_social_facebook', 'footer_social_twitter', 'footer_social_instagram', 'footer_social_linkedin', 'footer_link_privacy', 'footer_link_terms', 'footer_link_help', 'footer_link_unsubscribe', 'footer_contact', 'footer_copyright']
  };
  
  const elementIds = componentElementMap[componentName] || [];
  return elements.filter(el => elementIds.includes(el.id));
}

// Extract data-element attributes from HTML
function extractDataElements(html) {
  const dataElements = new Map();
  const regex = /data-element=["']([^"']+)["']/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const dataElement = match[1];
    const context = html.substring(Math.max(0, match.index - 50), Math.min(html.length, match.index + 100));
    dataElements.set(dataElement, context);
  }
  
  return dataElements;
}

// Main execution
console.log('🔍 Analyzing email builder template components...\n');

const components = ['Header', 'Cart Summary', 'Checkout CTA', 'Footer'];

components.forEach(componentName => {
  console.log(`\n📦 Component: ${componentName}`);
  const componentHtml = extractComponentFromEmailTemplate(emailTemplate.html, componentName);
  
  if (!componentHtml) {
    console.log(`   ⚠️  Not found in email template`);
    return;
  }
  
  const dataElements = extractDataElements(componentHtml);
  const elements = getElementsForComponent(emailTemplate.elements, componentName);
  
  console.log(`   ✅ Found in email template`);
  console.log(`   📋 Data-element attributes:`);
  dataElements.forEach((context, dataElement) => {
    console.log(`      - ${dataElement}`);
  });
  
  console.log(`   📝 Element definitions:`);
  elements.forEach(el => {
    if (el.selector && el.selector.includes('data-element')) {
      const match = el.selector.match(/data-element=["']([^"']+)["']/);
      if (match) {
        console.log(`      - ${el.id}: ${match[1]} (${el.type})`);
      }
    }
  });
});

console.log('\n✅ Analysis complete!');
console.log('\n📝 Next steps:');
console.log('   1. Update template_design_system.html components to match these data-element attributes');
console.log('   2. Ensure HTML structure matches exactly');
console.log('   3. Update component extraction logic to preserve attributes');

