import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesDir = path.join(__dirname, '../src/assets/dynamicEmailTemplates');

// Get all JSON template files
const templateFiles = fs.readdirSync(templatesDir)
  .filter(file => file.endsWith('.json') && file !== 'schema.json')
  .map(file => path.join(templatesDir, file));

console.log(`Found ${templateFiles.length} template files to clean\n`);

let totalUpdated = 0;
let totalRemoved = 0;

templateFiles.forEach(templateFile => {
  try {
    const template = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
    const templateName = path.basename(templateFile);
    let updated = false;
    let removed = 0;

    // Update image elements in the template
    if (template.elements && Array.isArray(template.elements)) {
      template.elements.forEach(element => {
        if (element.type === 'image' && element.properties) {
          // Remove empty href property
          if (element.properties.href === '' || element.properties.href === null || element.properties.href === undefined) {
            delete element.properties.href;
            updated = true;
            removed++;
            totalRemoved++;
          }
        }
      });
    }

    if (updated) {
      // Write updated template back to file
      fs.writeFileSync(templateFile, JSON.stringify(template, null, 2) + '\n', 'utf8');
      totalUpdated++;
      console.log(`✓ ${templateName}: Removed empty href from ${removed} image(s)`);
    } else {
      console.log(`  ${templateName}: No empty href properties found`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${path.basename(templateFile)}:`, error.message);
  }
});

console.log(`\n=== Cleanup Complete ===`);
console.log(`Templates updated: ${totalUpdated}/${templateFiles.length}`);
console.log(`Total empty href properties removed: ${totalRemoved}`);

