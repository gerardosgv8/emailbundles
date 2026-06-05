import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesDir = path.join(__dirname, '../src/assets/dynamicEmailTemplates');

// Get all JSON template files except schema.json
const templateFiles = fs.readdirSync(templatesDir)
  .filter(file => file.endsWith('.json') && file !== 'schema.json')
  .map(file => path.join(templatesDir, file));

let totalUpdated = 0;

templateFiles.forEach(templateFile => {
  try {
    const content = fs.readFileSync(templateFile, 'utf8');
    const template = JSON.parse(content);
    
    let updated = false;
    
    // Find and update footer_social_twitter element
    if (template.elements && Array.isArray(template.elements)) {
      template.elements.forEach(element => {
        if (element.id === 'footer_social_twitter') {
          if (element.value === 'Twitter') {
            element.value = 'X';
            updated = true;
          }
          if (element.defaultValue === 'Twitter') {
            element.defaultValue = 'X';
            updated = true;
          }
        }
      });
    }
    
    if (updated) {
      fs.writeFileSync(templateFile, JSON.stringify(template, null, 2) + '\n', 'utf8');
      totalUpdated++;
      console.log(`✓ Updated: ${path.basename(templateFile)}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${path.basename(templateFile)}:`, error.message);
  }
});

console.log(`\n✅ Updated ${totalUpdated} template file(s)`);

