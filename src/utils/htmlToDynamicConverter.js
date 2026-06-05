/**
 * HTML to Dynamic Template Converter
 * Converts static HTML email templates to dynamic JSON format
 */

export function convertHtmlToDynamic(htmlContent, templateMeta = {}) {
  try {
    // Parse HTML string (basic DOM parsing)
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const elements = [];
    const sections = [];
    let elementCounter = 0;

    // Helper to create element ID
    const createElementId = (type, counter) => `${type}_${counter}`;

    // Extract all editable elements
    extractEditableElements(doc.body, elements, elementCounter);

    // Group into sections (simplified approach)
    const sectionMap = groupIntoSections(elements, doc.body);

    // Create sections array
    Object.entries(sectionMap).forEach(([sectionName, sectionElements]) => {
      sections.push({
        id: sectionName.toLowerCase().replace(/\s+/g, '_'),
        name: sectionName,
        visible: true,
        elements: sectionElements.map(el => el.id),
      });
    });

    // Ensure meta information
    const meta = {
      templateId: templateMeta.templateId || `template_${Date.now()}`,
      templateName: templateMeta.templateName || 'Untitled Template',
      category: templateMeta.category || 'general',
      version: templateMeta.version || '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: templateMeta.description || '',
    };

    return {
      meta,
      html: htmlContent,
      elements,
      sections,
    };
  } catch (error) {
    console.error('Error converting HTML to dynamic template:', error);
    throw error;
  }
}

function extractEditableElements(root, elements, counter) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    const tagName = node.tagName.toLowerCase();
    
    // Extract based on tag type
    if (tagName === 'img') {
      counter++;
      elements.push(createImageElement(node, counter));
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      counter++;
      elements.push(createHeadingElement(node, tagName, counter));
    } else if (tagName === 'a') {
      counter++;
      const text = node.textContent.trim();
      // Check if it's a button
      if (hasButtonStyles(node)) {
        elements.push(createButtonElement(node, counter));
      } else {
        elements.push(createLinkElement(node, counter));
      }
    } else if (tagName === 'p' && !node.querySelector('img') && !node.querySelector('a')) {
      // Only plain text paragraphs
      const text = node.textContent.trim();
      if (text.length > 0 && text.length < 200) {
        counter++;
        elements.push(createTextElement(node, counter));
      }
    }
  }
}

function createImageElement(node, counter) {
  const alt = node.getAttribute('alt') || 'Image';
  const src = node.getAttribute('src') || '';
  const width = node.getAttribute('width') || 'auto';
  const height = node.getAttribute('height') || 'auto';

  return {
    id: `img_${counter}`,
    type: 'image',
    selector: `img[alt="${alt}"]`,
    label: `Image: ${alt}`,
    defaultValue: src,
    value: src,
    visible: true,
    properties: {
      url: src,
      alt: alt,
      width: parseInt(width) || undefined,
      height: parseInt(height) || undefined,
    },
    validation: {
      required: false,
      allowedTypes: ['url'],
    },
  };
}

function createHeadingElement(node, tagName, counter) {
  const text = node.textContent.trim();
  const styles = node.getAttribute('style') || '';
  const color = extractColorFromStyle(styles);

  return {
    id: `heading_${counter}`,
    type: 'heading',
    selector: tagName,
    label: `Heading: ${text.substring(0, 30)}`,
    defaultValue: text,
    value: text,
    visible: true,
    properties: {
      fontSize: extractFontSizeFromStyle(styles) || `${tagName === 'h1' ? '32' : tagName === 'h2' ? '24' : '18'}px`,
      textColor: color || '#1e293b',
      fontFamily: extractFontFamilyFromStyle(styles),
    },
    validation: {
      required: true,
      maxLength: 200,
    },
  };
}

function createLinkElement(node, counter) {
  const text = node.textContent.trim();
  const href = node.getAttribute('href') || '#';

  return {
    id: `link_${counter}`,
    type: 'link',
    selector: `a:contains('${text.substring(0, 20)}')`,
    label: `Link: ${text}`,
    defaultValue: text,
    value: text,
    visible: true,
    properties: {
      url: href,
    },
    validation: {
      required: false,
    },
  };
}

function createButtonElement(node, counter) {
  const text = node.textContent.trim();
  const href = node.getAttribute('href') || '#';
  const styles = node.getAttribute('style') || '';
  const bgColor = extractBackgroundColorFromStyle(styles);
  const textColor = extractColorFromStyle(styles);

  return {
    id: `button_${counter}`,
    type: 'button',
    selector: `a:contains('${text}')`,
    label: `Button: ${text}`,
    defaultValue: text,
    value: text,
    visible: true,
    properties: {
      url: href,
      backgroundColor: bgColor || '#2563eb',
      textColor: textColor || '#ffffff',
      fontSize: extractFontSizeFromStyle(styles) || '16px',
      fontWeight: extractFontWeightFromStyle(styles) || '600',
    },
    validation: {
      required: false,
    },
  };
}

function createTextElement(node, counter) {
  const text = node.textContent.trim();
  const styles = node.getAttribute('style') || '';

  return {
    id: `text_${counter}`,
    type: 'text',
    selector: `p:contains('${text.substring(0, 20)}')`,
    label: `Text: ${text.substring(0, 40)}`,
    defaultValue: text,
    value: text,
    visible: true,
    properties: {
      fontSize: extractFontSizeFromStyle(styles) || '16px',
      textColor: extractColorFromStyle(styles) || '#64748b',
      fontFamily: extractFontFamilyFromStyle(styles),
    },
    validation: {
      required: false,
      maxLength: 500,
    },
  };
}

// Helper functions for style parsing
function extractColorFromStyle(style) {
  const match = style.match(/color:\s*([^;]+)/);
  return match ? match[1].trim() : null;
}

function extractBackgroundColorFromStyle(style) {
  const match = style.match(/background-color:\s*([^;]+)/);
  return match ? match[1].trim() : null;
}

function extractFontSizeFromStyle(style) {
  const match = style.match(/font-size:\s*([^;]+)/);
  return match ? match[1].trim() : null;
}

function extractFontFamilyFromStyle(style) {
  const match = style.match(/font-family:\s*([^;]+)/);
  return match ? match[1].trim() : null;
}

function extractFontWeightFromStyle(style) {
  const match = style.match(/font-weight:\s*([^;]+)/);
  return match ? match[1].trim() : null;
}

function hasButtonStyles(node) {
  const style = node.getAttribute('style') || '';
  return style.includes('background-color') || 
         style.includes('padding') || 
         node.classList.contains('btn');
}

// Group elements into logical sections
function groupIntoSections(elements, body) {
  const sections = {
    'Header': [],
    'Content': [],
    'Footer': [],
  };

  // Simple heuristic: distribute based on position
  elements.forEach((el, index) => {
    if (index < Math.floor(elements.length * 0.2)) {
      sections['Header'].push(el);
    } else if (index < Math.floor(elements.length * 0.8)) {
      sections['Content'].push(el);
    } else {
      sections['Footer'].push(el);
    }
  });

  // Filter out empty sections
  Object.keys(sections).forEach(key => {
    if (sections[key].length === 0) {
      delete sections[key];
    }
  });

  return sections;
}

