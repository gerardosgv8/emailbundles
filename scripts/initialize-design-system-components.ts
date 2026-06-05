// TypeScript script to initialize components from template_design_system.html
// This will be used by componentLibraryService to auto-initialize components

import { ComponentData, ComponentElement } from '../src/services/componentLibraryService';

function parseComponentFromHtml(html: string, componentName: string): ComponentData | null {
  // Extract HTML between comment markers
  const startMarker = `<!-- Component start ${componentName} -->`;
  const endMarker = `<!-- Component end ${componentName} -->`;
  
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    return null;
  }
  
  const componentHtml = html.substring(startIndex + startMarker.length, endIndex).trim();
  const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');
  
  // Extract elements with data-element attributes
  const elements: ComponentElement[] = [];
  const seenElements = new Set<string>();
  
  const elementRegex = /data-element=["']([^"']+)["']/gi;
  let match;
  
  while ((match = elementRegex.exec(componentHtml)) !== null) {
    const dataElement = match[1];
    if (seenElements.has(dataElement)) continue;
    seenElements.add(dataElement);
    
    // Find the element tag
    const beforeMatch = componentHtml.substring(0, match.index);
    const tagMatch = beforeMatch.match(/<(\w+)[^>]*$/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : 'div';
    
    // Determine element type
    let elementType: ComponentElement['type'] = 'text';
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      elementType = 'heading';
    } else if (tagName === 'img') {
      elementType = 'image';
    } else if (tagName === 'a') {
      elementType = 'link';
    } else if (tagName === 'table' || (tagName === 'div' && componentHtml.includes('background-color'))) {
      elementType = 'section';
    }
    
    // Create element ID and selector
    const elementId = `${componentPrefix}_${dataElement.replace(/-/g, '_')}`;
    const prefixedDataElement = `${componentPrefix}-${dataElement}`;
    
    // Get default value
    let defaultValue = '';
    if (elementType === 'image') {
      const srcMatch = componentHtml.substring(match.index).match(/src=["']([^"']+)["']/);
      defaultValue = srcMatch ? srcMatch[1] : '';
    } else {
      // Try to extract text content
      const elementStart = componentHtml.indexOf(match[0]);
      const elementEnd = componentHtml.indexOf('>', elementStart);
      if (elementEnd > 0) {
        const contentStart = elementEnd + 1;
        const closingTag = `</${tagName}>`;
        const contentEnd = componentHtml.indexOf(closingTag, contentStart);
        if (contentEnd > contentStart) {
          defaultValue = componentHtml.substring(contentStart, contentEnd).trim().replace(/\s+/g, ' ').substring(0, 200);
        }
      }
    }
    
    elements.push({
      id: elementId,
      type: elementType,
      selector: `${tagName}[data-element="${prefixedDataElement}"]`,
      label: dataElement.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      defaultValue,
      value: defaultValue,
      visible: true,
      properties: elementType === 'image' ? {
        url: defaultValue
      } : undefined
    });
  }
  
  // Update HTML to use prefixed data-element attributes
  let processedHtml = componentHtml;
  processedHtml = processedHtml.replace(/data-element=["']([^"']+)["']/g, (match, dataElement) => {
    const prefixed = `${componentPrefix}-${dataElement}`;
    return `data-element="${prefixed}"`;
  });
  
  // Wrap in comment markers
  processedHtml = `${startMarker}\n${processedHtml}\n${endMarker}`;
  
  return {
    id: componentPrefix,
    name: componentName,
    html: processedHtml,
    elements,
    status: 'live',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function initializeDesignSystemComponents(html: string): ComponentData[] {
  const components: ComponentData[] = [];
  
  // List of component names to extract
  const componentNames = [
    'Header',
    'Order Details',
    'Dual CTA',
    'Single Product',
    'Products Grid',
    'Hero Block',
    'Hero Component',
    'Bulletpoints',
    'Notification Block',
    'Icons List',
    'Feature Overview',
    'Metrics Block'
  ];
  
  componentNames.forEach(name => {
    const component = parseComponentFromHtml(html, name);
    if (component) {
      components.push(component);
    }
  });
  
  return components;
}

