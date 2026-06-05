#!/usr/bin/env node

/**
 * Script to sync component HTML and data-element attributes from email builder templates
 * to template_design_system.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read email builder template
const emailTemplatePath = path.join(__dirname, '../src/assets/dynamicEmailTemplates/ecom_checkout_email.json');
const emailTemplate = JSON.parse(fs.readFileSync(emailTemplatePath, 'utf8'));

// Read template_design_system.html
const designSystemPath = path.join(__dirname, '../template_design_system.html');
let designSystem = fs.readFileSync(designSystemPath, 'utf8');

// Extract component from email template HTML
function extractComponent(html, componentName) {
  const startMarker = `<!-- Component start ${componentName} -->`;
  const endMarker = `<!-- Component end ${componentName} -->`;
  
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    return null;
  }
  
  // Return the full component including markers
  return html.substring(startIndex, endIndex + endMarker.length);
}

// Replace component in design system
function replaceComponent(designSystem, componentName, newComponentHtml) {
  // Try different case variations
  const variations = [
    `<!-- Component start ${componentName} -->`,
    `<!-- Component Start ${componentName} -->`,
    `<!-- Component START ${componentName} -->`,
  ];
  
  for (const startMarker of variations) {
    const endMarker = startMarker.replace('start', 'end').replace('Start', 'End').replace('START', 'END');
    const startIndex = designSystem.indexOf(startMarker);
    const endIndex = designSystem.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
      const before = designSystem.substring(0, startIndex);
      const after = designSystem.substring(endIndex + endMarker.length);
      return before + newComponentHtml + after;
    }
  }
  
  return designSystem;
}

console.log('🔄 Syncing components from email builder templates to template_design_system.html...\n');

const componentsToSync = [
  { emailName: 'Header', designSystemName: 'Header' },
  { emailName: 'Checkout CTA', designSystemName: 'Dual CTA' },
  // Note: Cart Summary doesn't exist in design system, might be "Order Details"
  // Footer doesn't exist in design system
];

let updated = false;

componentsToSync.forEach(({ emailName, designSystemName }) => {
  console.log(`\n📦 Syncing: ${emailName} → ${designSystemName}`);
  
  const emailComponent = extractComponent(emailTemplate.html, emailName);
  
  if (!emailComponent) {
    console.log(`   ⚠️  Component "${emailName}" not found in email template`);
    return;
  }
  
  // Check if component exists in design system
  const designSystemComponent = extractComponent(designSystem, designSystemName);
  
  if (!designSystemComponent) {
    console.log(`   ⚠️  Component "${designSystemName}" not found in design system`);
    return;
  }
  
  // Replace the component
  const newDesignSystem = replaceComponent(designSystem, designSystemName, emailComponent);
  
  if (newDesignSystem !== designSystem) {
    designSystem = newDesignSystem;
    updated = true;
    console.log(`   ✅ Updated ${designSystemName} to match ${emailName}`);
  } else {
    console.log(`   ℹ️  ${designSystemName} already matches ${emailName}`);
  }
});

if (updated) {
  // Backup original
  const backupPath = designSystemPath + '.backup';
  fs.writeFileSync(backupPath, fs.readFileSync(designSystemPath));
  console.log(`\n💾 Backup created: ${backupPath}`);
  
  // Write updated design system
  fs.writeFileSync(designSystemPath, designSystem);
  console.log(`✅ Updated template_design_system.html`);
} else {
  console.log(`\n✅ No updates needed`);
}

console.log('\n📝 Note: This script syncs Header and Checkout CTA components.');
console.log('   For Cart Summary and Footer, you may need to add them manually.');

