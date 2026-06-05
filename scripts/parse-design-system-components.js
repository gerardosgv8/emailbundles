// Script to parse template_design_system.html and extract all components
// This will create components from the design system file

const fs = require('fs');
const path = require('path');

const designSystemPath = path.join(__dirname, '..', 'template_design_system.html');

function parseComponents(html) {
  const components = [];
  
  // Regex to match component blocks
  const componentRegex = /<!--\s*Component\s+start\s+([^>]+)\s*-->([\s\S]*?)<!--\s*Component\s+end\s+([^>]+)\s*-->/gi;
  
  let match;
  while ((match = componentRegex.exec(html)) !== null) {
    const componentName = match[1].trim();
    const componentHtml = match[2].trim();
    const endName = match[3].trim();
    
    // Skip if start and end names don't match (safety check)
    if (componentName.toLowerCase() !== endName.toLowerCase()) {
      console.warn(`⚠️ Component name mismatch: "${componentName}" vs "${endName}"`);
      continue;
    }
    
    // Extract elements with data-element attributes
    const elements = [];
    const elementRegex = /data-element=["']([^"']+)["']/gi;
    const seenElements = new Set();
    
    let elementMatch;
    while ((elementMatch = elementRegex.exec(componentHtml)) !== null) {
      const dataElement = elementMatch[1];
      if (!seenElements.has(dataElement)) {
        seenElements.add(dataElement);
        
        // Find the element tag
        const elementTagMatch = componentHtml.substring(0, elementMatch.index).match(/<(\w+)[^>]*data-element=["'][^"']+["']/);
        const tagName = elementTagMatch ? elementTagMatch[1].toLowerCase() : 'div';
        
        // Determine element type
        let elementType = 'text';
        if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
          elementType = 'heading';
        } else if (tagName === 'img') {
          elementType = 'image';
        } else if (tagName === 'a') {
          elementType = 'link';
        } else if (tagName === 'table' || (tagName === 'div' && componentHtml.includes('background-color'))) {
          elementType = 'section';
        }
        
        // Create component prefix from component name
        const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');
        const elementId = `${componentPrefix}_${dataElement.replace(/-/g, '_')}`;
        const prefixedDataElement = `${componentPrefix}-${dataElement}`;
        
        // Get default value
        let defaultValue = '';
        const elementStart = componentHtml.indexOf(elementMatch[0]);
        const elementEnd = componentHtml.indexOf('>', elementStart);
        const elementContent = componentHtml.substring(elementEnd + 1);
        const closingTag = `</${tagName}>`;
        const contentEnd = elementContent.indexOf(closingTag);
        
        if (elementType === 'image') {
          const srcMatch = componentHtml.substring(elementStart).match(/src=["']([^"']+)["']/);
          defaultValue = srcMatch ? srcMatch[1] : '';
        } else if (contentEnd > 0) {
          defaultValue = elementContent.substring(0, contentEnd).trim().replace(/\s+/g, ' ');
        }
        
        elements.push({
          id: elementId,
          type: elementType,
          selector: `${tagName}[data-element="${prefixedDataElement}"]`,
          label: dataElement.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          defaultValue: defaultValue.substring(0, 200), // Limit length
          value: defaultValue.substring(0, 200),
          visible: true,
          properties: elementType === 'image' ? {
            url: defaultValue
          } : undefined
        });
      }
    }
    
    // Create component prefix
    const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');
    
    // Update HTML to use prefixed data-element attributes
    let processedHtml = componentHtml;
    const dataElementRegex = /data-element=["']([^"']+)["']/g;
    processedHtml = processedHtml.replace(dataElementRegex, (match, dataElement) => {
      const prefixed = `${componentPrefix}-${dataElement}`;
      return `data-element="${prefixed}"`;
    });
    
    // Wrap in comment markers
    processedHtml = `<!-- Component start ${componentName} -->\n${processedHtml}\n<!-- Component end ${componentName} -->`;
    
    components.push({
      id: componentPrefix,
      name: componentName,
      html: processedHtml,
      elements: elements,
      status: 'live',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return components;
}

// Read and parse the file
try {
  const html = fs.readFileSync(designSystemPath, 'utf8');
  const components = parseComponents(html);
  
  console.log(`✅ Parsed ${components.length} components from template_design_system.html:`);
  components.forEach(comp => {
    console.log(`  - ${comp.name} (${comp.elements.length} elements)`);
  });
  
  // Export for use in componentLibraryService
  module.exports = components;
  
} catch (error) {
  console.error('❌ Error parsing design system:', error);
  module.exports = [];
}

