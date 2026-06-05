import { ComponentData, ComponentElement } from '../services/componentLibraryService';

/**
 * Parse a component from HTML string
 */
function parseComponentFromHtml(html: string, componentName: string): ComponentData | null {
  // Extract HTML between comment markers
  const startMarker = `<!-- Component start ${componentName} -->`;
  const endMarker = `<!-- Component end ${componentName} -->`;
  
  // Also handle variations like "Component Start" (capital S) and "Component Start/End"
  const startMarkerAlt = `<!-- Component Start ${componentName} -->`;
  const endMarkerAlt = `<!-- Component End ${componentName} -->`;
  
  let startIndex = html.indexOf(startMarker);
  let endIndex = html.indexOf(endMarker);
  let startMarkerLength = startMarker.length;
  
  if (startIndex === -1 || endIndex === -1) {
    startIndex = html.indexOf(startMarkerAlt);
    endIndex = html.indexOf(endMarkerAlt);
    startMarkerLength = startMarkerAlt.length;
  }
  
  if (startIndex === -1 || endIndex === -1) {
    return null;
  }
  
  const componentHtml = html.substring(startIndex + startMarkerLength, endIndex).trim();
  const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');
  
  // Use DOMParser to properly parse and modify HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${componentHtml}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return null;
  
  // Add data-element attributes to key elements that don't have them
  // Include tr and td elements to preserve attributes like data-element and contenteditable on table rows and cells
  const allElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, img, a, p, table, div, tr, td');
  let elementCounter = 0;
  
  allElements.forEach((el) => {
    // Preserve existing data-element and contenteditable attributes on tr and td elements
    // This is important for components like Text Block where the hide parameter is at the tr level
    // and for elements like order-details-total-wrapper where we need to preserve styles
    if ((el.tagName.toLowerCase() === 'tr' || el.tagName.toLowerCase() === 'td') && el.hasAttribute('data-element')) {
      // Keep the tr/td element's attributes as-is (including contenteditable="false" and style attributes)
      return;
    }
    
    if (!el.hasAttribute('data-element')) {
      const tagName = el.tagName.toLowerCase();
      let dataElementName = '';
      
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const text = el.textContent?.trim().substring(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'heading';
        dataElementName = `heading-${text}`;
      } else if (tagName === 'img') {
        const alt = el.getAttribute('alt')?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'image';
        dataElementName = `image-${alt}`;
      } else if (tagName === 'a') {
        const text = el.textContent?.trim().substring(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'link';
        const style = el.getAttribute('style') || '';
        const isButton = style.includes('background-color') || style.includes('padding:');
        dataElementName = isButton ? `button-${text}` : `link-${text}`;
      } else if (tagName === 'p') {
        const text = el.textContent?.trim();
        if (text && text.length > 10) {
          const textSlug = text.substring(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-');
          dataElementName = `text-${textSlug}`;
        }
      } else if (tagName === 'table' || (tagName === 'div' && (el.getAttribute('style')?.includes('background-color') || el.getAttribute('style')?.includes('padding')))) {
        dataElementName = `section-${elementCounter}`;
        elementCounter++;
      }
      
      if (dataElementName) {
        el.setAttribute('data-element', `${componentPrefix}-${dataElementName}`);
      }
    } else {
      // Preserve existing data-element attributes exactly as they are
      // Don't add component prefix - email builder templates use exact data-element values
      // This ensures components match email builder template structure
      const existingDataElement = el.getAttribute('data-element');
      // Keep the data-element as-is to match email builder templates
    }
  });
  
  // Extract elements with data-element attributes
  const elements: ComponentElement[] = [];
  const seenElements = new Set<string>();
  
  const elementsWithDataAttr = container.querySelectorAll('[data-element]');
  
  elementsWithDataAttr.forEach((el) => {
    const dataElement = el.getAttribute('data-element');
    if (!dataElement || seenElements.has(dataElement)) return;
    seenElements.add(dataElement);
    
    const tagName = el.tagName.toLowerCase();
    
    // Skip tr elements that are containers for visibility control (like Text Block)
    // These have contenteditable="false" and are controlled at the section level
    if (tagName === 'tr' && el.getAttribute('contenteditable') === 'false') {
      // Don't add as an editable element - it's just a container for visibility control
      return;
    }
    
    // Determine element type
    let elementType: ComponentElement['type'] = 'text';
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      elementType = 'heading';
    } else if (tagName === 'img') {
      elementType = 'image';
    } else if (tagName === 'a') {
      const style = el.getAttribute('style') || '';
      const isButton = style.includes('background-color') || style.includes('padding:');
      elementType = isButton ? 'button' : 'link';
    } else if (tagName === 'table' || (tagName === 'div' && (el.getAttribute('style')?.includes('background-color') || el.getAttribute('style')?.includes('padding')))) {
      elementType = 'section';
    }
    
    // Create element ID and label
    // Handle both hyphen and underscore variations in component prefix
    // e.g., "text-block-title" with prefix "text_block" should become "text_block_title"
    const prefixWithHyphen = componentPrefix.replace(/_/g, '-');
    const prefixWithUnderscore = componentPrefix;
    
    // Helper function to remove component prefix from data-element
    const removePrefix = (dataElement: string): string => {
      if (dataElement.startsWith(prefixWithHyphen + '-')) {
        return dataElement.substring((prefixWithHyphen + '-').length);
      } else if (dataElement.startsWith(prefixWithUnderscore + '-')) {
        return dataElement.substring((prefixWithUnderscore + '-').length);
      }
      return dataElement;
    };
    
    // Create element ID
    let elementDataElement = removePrefix(dataElement);
    const elementId = `${componentPrefix}_${elementDataElement.replace(/-/g, '_')}`;
    
    // Generate label
    let labelDataElement = removePrefix(dataElement);
    const label = labelDataElement.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Get default value
    let defaultValue = '';
    if (elementType === 'image') {
      defaultValue = el.getAttribute('src') || '';
    } else {
      defaultValue = el.textContent?.trim().substring(0, 200) || '';
    }
    
    // Extract properties
    const properties: Record<string, any> = {};
    if (elementType === 'image') {
      const src = el.getAttribute('src');
      const alt = el.getAttribute('alt');
      if (src) properties.url = src;
      if (alt) properties.alt = alt;
    } else if (elementType === 'link' || elementType === 'button') {
      const href = el.getAttribute('href');
      if (href) properties.url = href;
    }
    
    elements.push({
      id: elementId,
      type: elementType,
      selector: `${tagName}[data-element="${dataElement}"]`,
      label: label,
      defaultValue: defaultValue,
      value: defaultValue,
      visible: true,
      properties: Object.keys(properties).length > 0 ? properties : undefined
    });
  });
  
  // Get processed HTML
  const processedHtml = container.innerHTML;
  
  // Wrap in comment markers
  const finalHtml = `${startMarker}\n${processedHtml}\n${endMarker}`;
  
  // Determine category based on component name
  const getCategory = (name: string): string => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('header') || nameLower.includes('navigation')) return 'navigation';
    if (nameLower.includes('footer')) return 'footer';
    if (nameLower.includes('cta') || nameLower.includes('button') || nameLower.includes('call')) return 'cta';
    if (nameLower.includes('product') || nameLower.includes('order') || nameLower.includes('checkout') || nameLower.includes('cart')) return 'ecommerce';
    if (nameLower.includes('hero') || nameLower.includes('feature') || nameLower.includes('notification') || nameLower.includes('bullet') || nameLower.includes('icon') || nameLower.includes('metric')) return 'content';
    return 'layout';
  };

  // Map component name to image filename
  const getComponentImage = (name: string): { preview?: string; thumbnail?: string } => {
    const imageMap: Record<string, string> = {
      'Header': 'header.png',
      'Order Details': 'order_details.png',
      'Dual CTA': 'dual_cta.png',
      'Dual Cta': 'dual_cta.png',
      'Single Product': 'single_product.png',
      'Products Grid': 'products_grid.png',
      'Product Recommendations': 'product_recommendations.png',
      'Hero Block': 'hero_block.png',
      'Hero Component': 'hero.png',
      'Hero': 'hero.png',
      'Bulletpoints': 'text_block__.png', // Using text_block__ as placeholder
      'Notification Block': 'notification_block.png',
      'Icons List': 'icons_list.png',
      'Metrics Block': 'metrics_block.png',
      'Text Block': 'text_block__.png',
      'Footer': 'footer.png',
      'Cta Section': 'cta_section.png',
      'CTA Section': 'cta_section.png'
    };

    const imageName = imageMap[name];
    if (imageName) {
      return {
        preview: `/component_images/${imageName}`,
        thumbnail: `/component_images/${imageName}` // Same for now, can be optimized later
      };
    }

    return {};
  };

  // Format component name: capitalize first letter of each word, replace underscores with spaces
  const formatComponentName = (name: string): string => {
    return name
      .replace(/_/g, ' ') // Replace underscores with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formattedName = formatComponentName(componentName);
  const images = getComponentImage(formattedName);

  return {
    id: componentPrefix,
    name: formattedName,
    html: finalHtml,
    elements: elements,
    status: 'live',
    category: getCategory(formattedName),
    preview: images.preview,
    thumbnail: images.thumbnail,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Initialize all components from template_design_system.html
 */
export async function initializeDesignSystemComponents(): Promise<ComponentData[]> {
  try {
    // Fetch the design system HTML file
    const response = await fetch('/template_design_system.html');
    if (!response.ok) {
      console.warn('⚠️ Could not load template_design_system.html');
      return [];
    }
    
    const html = await response.text();
    const components: ComponentData[] = [];
    
    // List of component names to extract (based on the file structure)
    // Order determines display order in the catalogue
    const componentNames = [
      'Header',
      'Footer',
      'Hero Block',
      'Hero Component',
      'Text Block',
      'Notification Block',
      'Single Product',
      'Products Grid',
      'Order Details',
      'Icons List',
      'Metrics Block',
      'Dual CTA',
      'Bulletpoints'
    ];
    
    componentNames.forEach(name => {
      const component = parseComponentFromHtml(html, name);
      if (component) {
        components.push(component);
      } else {
        // Only warn if the component is expected to exist in the design system
        // Some components may not exist in all templates, which is fine
        console.debug(`⚠️ Could not parse component: ${name} (this is normal if the component doesn't exist in template_design_system.html)`);
      }
    });
    
    console.log(`✅ Parsed ${components.length} components from template_design_system.html`);
    return components;
  } catch (error) {
    // Don't log as error - component initialization failures shouldn't block the app
    console.warn('⚠️ Could not initialize some design system components (this is non-critical):', error);
    return [];
  }
}

