import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesDir = path.join(__dirname, '../src/assets/dynamicEmailTemplates');
const defaultLogoUrl = 'https://www.fmt.se/wp-content/uploads/2023/02/logo-placeholder-image.png';

// Get all JSON template files except schema.json
const templateFiles = fs.readdirSync(templatesDir)
  .filter(file => file.endsWith('.json') && file !== 'schema.json')
  .map(file => path.join(templatesDir, file));

let updatedCount = 0;
let totalLogos = 0;

console.log('🔄 Setting default logo URL for all templates...\n');

templateFiles.forEach(templateFile => {
  try {
    const content = fs.readFileSync(templateFile, 'utf8');
    const template = JSON.parse(content);
    let templateUpdated = false;
    let logosInTemplate = 0;
    
    if (!template.elements || !Array.isArray(template.elements)) {
      return;
    }
    
    template.elements.forEach(element => {
      if (element.type !== 'image') return;
      
      // Check if this is a logo
      const label = (element.label || '').toLowerCase();
      const altText = ((element.properties?.alt || '') + '').toLowerCase();
      const isLogo = 
        element.id === 'img_1' || 
        element.id === 'img_logo' || 
        element.id === 'logo' ||
        label.includes('logo') || 
        label.includes('brand') || 
        altText.includes('logo') || 
        altText.includes('brand');
      
      if (isLogo) {
        logosInTemplate++;
        totalLogos++;
        
        // Update defaultValue to the default logo URL
        if (element.defaultValue !== defaultLogoUrl) {
          element.defaultValue = defaultLogoUrl;
          templateUpdated = true;
        }
        
        // Also update value to match the default logo URL
        if (element.value !== defaultLogoUrl) {
          element.value = defaultLogoUrl;
          templateUpdated = true;
        }
      }
    });
    
    if (templateUpdated) {
      fs.writeFileSync(templateFile, JSON.stringify(template, null, 2) + '\n', 'utf8');
      updatedCount++;
      console.log(`✅ ${path.basename(templateFile)}: Updated ${logosInTemplate} logo(s)`);
    } else if (logosInTemplate > 0) {
      console.log(`✓  ${path.basename(templateFile)}: ${logosInTemplate} logo(s) already using default`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${path.basename(templateFile)}:`, error.message);
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Total templates processed: ${templateFiles.length}`);
console.log(`   Templates updated: ${updatedCount}`);
console.log(`   Total logos found: ${totalLogos}`);
console.log(`\n✅ Default logo URL set to: ${defaultLogoUrl}`);

