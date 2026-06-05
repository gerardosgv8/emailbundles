import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Eye, EyeOff, Code, Loader2, CheckCircle, AlertCircle, FileText, Type, Image as ImageIcon, MousePointerClick, Link as LinkIcon, Layout, FolderOpen, X, TestTube, Zap } from 'lucide-react';
import { componentLibraryService, ComponentElement, ComponentData } from '../../services/componentLibraryService';
import { FontSelector } from '../../components/builder/FontSelector';

// Helper function to convert URL slug back to component name (find by matching slug)
const slugToComponentName = (slug: string, components: ComponentData[]): string | null => {
  const component = components.find(c => {
    const componentSlug = c.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return componentSlug === slug;
  });
  return component ? component.name : null;
};

export const AdminComponentBuilder: React.FC = () => {
  const { componentName: urlComponentName } = useParams<{ componentName?: string }>();
  const navigate = useNavigate();
  const [componentName, setComponentName] = useState('');
  const [componentCategory, setComponentCategory] = useState('layout');
  const [htmlInput, setHtmlInput] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [elements, setElements] = useState<ComponentElement[]>([]);
  const [status, setStatus] = useState<'draft' | 'live'>('draft');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedComponents, setSavedComponents] = useState<ComponentData[]>([]);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<ComponentElement | null>(null);
  const [testElements, setTestElements] = useState<ComponentElement[]>([]);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const domParserRef = useRef<DOMParser | null>(null);

  const categories = [
    { value: 'layout', label: 'Layout' },
    { value: 'content', label: 'Content' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'cta', label: 'Call-to-Action' },
    { value: 'navigation', label: 'Navigation' },
    { value: 'social', label: 'Social' },
    { value: 'footer', label: 'Footer' },
    { value: 'other', label: 'Other' }
  ];

  if (typeof window !== 'undefined' && !domParserRef.current) {
    domParserRef.current = new DOMParser();
  }

  // Load component for editing
  const loadComponent = useCallback((component: ComponentData) => {
    setComponentName(component.name);
    setComponentCategory(component.category || 'layout');
    setHtmlInput(component.html);
    setElements(component.elements);
    setTestElements(component.elements.map(el => ({ ...el })));
    setStatus(component.status);
    setEditingComponentId(component.id);
    setSelectedElement(null);
    setShowLibrary(false);
    setNameError(null);
    // Preview will be updated by the useEffect that watches htmlInput and componentName
  }, []);

  // Load saved components
  useEffect(() => {
    const components = componentLibraryService.getAllComponents();
    setSavedComponents(components);
    
    // If URL has component name, load that component
    if (urlComponentName) {
      const foundName = slugToComponentName(urlComponentName, components);
      if (foundName) {
        const component = components.find(c => c.name === foundName);
        if (component) {
          loadComponent(component);
        }
      }
    }
  }, [urlComponentName, loadComponent]);

  // Clear form
  const clearForm = useCallback(() => {
    setComponentName('');
    setComponentCategory('layout');
    setHtmlInput('');
    setPreviewHtml('');
    setElements([]);
    setStatus('draft');
    setEditingComponentId(null);
    setSaveMessage(null);
    setNameError(null);
    navigate('/gestion/component-builder');
  }, [navigate]);

  // Helper function to get element path for uniqueness
  const getElementPath = useCallback((element: Element): string => {
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== current.ownerDocument?.body) {
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current);
        path.unshift(`${current.tagName.toLowerCase()}:${index}`);
      }
      current = parent;
    }
    
    return path.join(' > ');
  }, []);

  // Extract elements from HTML
  const extractElementsFromHtml = useCallback((html: string, componentPrefix: string): ComponentElement[] => {
    if (!html || !componentPrefix) return [];

    const parser = domParserRef.current;
    if (!parser) return [];

    try {
      const doc = parser.parseFromString(html, 'text/html');
      const extractedElements: ComponentElement[] = [];
      const seenDataElements = new Set<string>();

      // Find ALL elements with data-element attributes (including nested ones)
      // Use querySelectorAll to get all matches, not just the first
      const elementsWithDataAttr = Array.from(doc.querySelectorAll('[data-element]'));
      
      console.log(`Found ${elementsWithDataAttr.length} elements with data-element attributes`);

      // Process ALL elements - don't skip any
      // Track by data-element value to avoid true duplicates (same element processed twice)
      elementsWithDataAttr.forEach((node, index) => {
        const dataElement = node.getAttribute('data-element');
        if (!dataElement) return;
        
        // Only skip if we've already processed an element with this exact data-element value
        // This allows multiple elements with different data-element values, even if similar
        // But prevents the same element from being processed multiple times
        if (seenDataElements.has(dataElement)) {
          console.log(`Skipping duplicate data-element: ${dataElement}`);
          return;
        }
        seenDataElements.add(dataElement);

        // Determine element type
        let elementType: ComponentElement['type'] = 'text';
        const tagName = node.tagName.toLowerCase();
        
        if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
          elementType = 'heading';
        } else if (tagName === 'img') {
          elementType = 'image';
        } else if (tagName === 'a') {
          // Check if it's a button-like link
          const href = node.getAttribute('href');
          const text = node.textContent?.trim() || '';
          const hasButtonStyle = node.getAttribute('style')?.includes('background-color') || 
                                node.getAttribute('style')?.includes('padding');
          if (hasButtonStyle || text.length < 50) {
            elementType = 'button';
          } else {
            elementType = 'link';
          }
        } else if (tagName === 'table' || tagName === 'div') {
          // Check if it's a section wrapper
          const hasBackground = node.getAttribute('style')?.includes('background-color');
          if (hasBackground) {
            elementType = 'section';
          }
        }

        // Create prefixed ID
        const prefixedId = `${componentPrefix}_${dataElement.replace(/-/g, '_')}`;
        
        // Get default value
        let defaultValue = '';
        if (elementType === 'image') {
          defaultValue = node.getAttribute('src') || node.getAttribute('data-src') || '';
        } else if (elementType === 'link' || elementType === 'button') {
          defaultValue = node.textContent?.trim() || '';
        } else {
          defaultValue = node.textContent?.trim() || '';
        }

        // Extract properties
        const properties: Record<string, any> = {};
        
        // Extract element-specific properties
        if (elementType === 'image') {
          const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
          const alt = node.getAttribute('alt') || '';
          properties.url = src;
          properties.alt = alt;
        } else if (elementType === 'link' || elementType === 'button') {
          const href = node.getAttribute('href') || '#';
          properties.url = href;
        }

        // Extract style properties from inline styles for ALL element types
        const styleAttr = node.getAttribute('style');
        if (styleAttr) {
          const styles = styleAttr
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .reduce<Record<string, string>>((acc, declaration) => {
              const [property, ...valueParts] = declaration.split(':');
              if (property && valueParts.length) {
                acc[property.trim().toLowerCase()] = valueParts.join(':').trim();
              }
              return acc;
            }, {});

          // Extract font properties
          if (styles['font-size']) {
            properties.fontSize = styles['font-size'];
          }
          if (styles['font-family']) {
            properties.fontFamily = styles['font-family'];
          }
          if (styles['font-weight']) {
            properties.fontWeight = styles['font-weight'];
          }

          // Extract color properties
          if (styles['color']) {
            properties.textColor = styles['color'];
          }
          if (styles['background-color']) {
            properties.backgroundColor = styles['background-color'];
          }
          if (styles['border-color']) {
            properties.borderColor = styles['border-color'];
          }

          // Extract padding properties
          if (styles['padding']) {
            properties.padding = styles['padding'];
          }
          if (styles['padding-top']) {
            properties.paddingTop = styles['padding-top'];
          }
          if (styles['padding-right']) {
            properties.paddingRight = styles['padding-right'];
          }
          if (styles['padding-bottom']) {
            properties.paddingBottom = styles['padding-bottom'];
          }
          if (styles['padding-left']) {
            properties.paddingLeft = styles['padding-left'];
          }

          // Extract border properties
          if (styles['border-radius']) {
            properties.borderRadius = styles['border-radius'];
          }
          if (styles['border-width']) {
            properties.borderWidth = styles['border-width'];
          }
        }

        // Create selector with prefixed data-element
        const prefixedDataElement = `${componentPrefix}-${dataElement}`;
        const selector = `${tagName}[data-element="${prefixedDataElement}"]`;

        const element = {
          id: prefixedId,
          type: elementType,
          selector,
          label: dataElement.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          defaultValue,
          value: defaultValue,
          visible: true,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        };
        
        extractedElements.push(element);
        console.log(`Extracted element: ${element.label} (${elementType}) - ${dataElement}`);
      });
      
      console.log(`Total elements extracted: ${extractedElements.length}`);

      // Sort elements by their position in the DOM (depth-first traversal)
      // This ensures parent elements come before children
      extractedElements.sort((a, b) => {
        // Try to find the elements in the DOM to compare their positions
        try {
          const aMatch = doc.querySelector(a.selector);
          const bMatch = doc.querySelector(b.selector);
          if (aMatch && bMatch) {
            const position = aMatch.compareDocumentPosition(bMatch);
            if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
              return -1;
            } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
              return 1;
            }
          }
        } catch (e) {
          // If comparison fails, keep original order
        }
        return 0;
      });

      return extractedElements;
    } catch (error) {
      console.error('Error extracting elements:', error);
      return [];
    }
  }, [getElementPath]);

  // Update preview in real-time (fast, just wraps HTML)
  const updatePreview = useCallback(() => {
    if (!htmlInput) {
      setPreviewHtml('');
      return;
    }

    try {
      // Wrap in email structure for preview (same as TemplateComposer)
      const wrappedHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>Component Preview</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f8fafc;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0; width: 100%; background-color: #f8fafc;" role="presentation">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);" role="presentation">
          ${htmlInput}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      setPreviewHtml(wrappedHtml);
    } catch (error) {
      // Silently fail for preview - just show empty if HTML is invalid
      setPreviewHtml('');
    }
  }, [htmlInput]);

  // Process HTML and extract elements (slower, debounced)
  const processHtml = useCallback(() => {
    if (!htmlInput || !componentName) {
      setElements([]);
      return;
    }

    setIsProcessing(true);
    
    try {
      const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');
      const componentDisplayName = componentName.split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      // Extract elements
      const extractedElements = extractElementsFromHtml(htmlInput, componentPrefix);
      
      // Add section wrapper element if not already present
      const hasWrapper = extractedElements.some(el => el.type === 'section' && el.id.includes('wrapper'));
      if (!hasWrapper) {
        // Try to find the outermost table or div
        const parser = domParserRef.current;
        if (parser) {
          const doc = parser.parseFromString(htmlInput, 'text/html');
          const body = doc.body;
          const firstChild = body.firstElementChild;
          
          if (firstChild) {
            const tagName = firstChild.tagName.toLowerCase();
            if (tagName === 'table' || tagName === 'div') {
              // Create wrapper element
              const wrapperId = `${componentPrefix}_wrapper`;
              const wrapperDataElement = `${componentPrefix}-wrapper`;
              const wrapperSelector = `${tagName}[data-element="${wrapperDataElement}"]`;
              
              extractedElements.unshift({
                id: wrapperId,
                type: 'section',
                selector: wrapperSelector,
                label: `${componentDisplayName} Wrapper`,
                defaultValue: '',
                value: '',
                visible: true,
                properties: {},
              });
            }
          }
        }
      }
      
      setElements(extractedElements);
      // Also update test elements (copy for testing)
      setTestElements(extractedElements.map(el => ({ ...el })));
    } catch (error) {
      console.error('Error processing HTML:', error);
      setSaveMessage({ type: 'error', text: 'Error processing HTML. Please check your HTML syntax.' });
    } finally {
      setIsProcessing(false);
    }
  }, [htmlInput, componentName, extractElementsFromHtml]);

  // Apply test element changes to preview HTML
  const applyTestChangesToHtml = useCallback((html: string, testElements: ComponentElement[]): string => {
    if (!html || testElements.length === 0) return html;

    try {
      const parser = domParserRef.current;
      if (!parser) return html;

      const doc = parser.parseFromString(html, 'text/html');
      
      testElements.forEach(element => {
        try {
          const nodes = Array.from(doc.querySelectorAll(element.selector));
          
          nodes.forEach(node => {
            const htmlNode = node as HTMLElement;
            
            // Handle visibility
            if (!element.visible) {
              htmlNode.style.display = 'none';
            } else {
              htmlNode.style.display = '';
            }

            // Update content for text/heading elements
            if (element.type === 'text' || element.type === 'heading') {
              htmlNode.textContent = element.value || element.defaultValue;
            }

            // Update button/link text
            if ((element.type === 'button' || element.type === 'link') && element.value) {
              htmlNode.textContent = element.value;
            }

            // Update image src
            if (element.type === 'image' && element.properties?.url) {
              (htmlNode as HTMLImageElement).src = element.properties.url;
            }

            // Apply styles from properties
            if (element.properties) {
              // Font properties
              if (element.properties.fontSize) {
                htmlNode.style.fontSize = element.properties.fontSize;
              }
              if (element.properties.fontFamily) {
                htmlNode.style.fontFamily = element.properties.fontFamily;
              }
              if (element.properties.fontWeight) {
                htmlNode.style.fontWeight = element.properties.fontWeight;
              }

              // Color properties
              if (element.properties.textColor) {
                htmlNode.style.color = element.properties.textColor;
              }
              if (element.properties.backgroundColor) {
                htmlNode.style.backgroundColor = element.properties.backgroundColor;
              }
              if (element.properties.borderColor) {
                htmlNode.style.borderColor = element.properties.borderColor;
              }

              // Border properties
              if (element.properties.borderRadius) {
                htmlNode.style.borderRadius = element.properties.borderRadius;
              }
              if (element.properties.borderWidth) {
                htmlNode.style.borderWidth = element.properties.borderWidth;
                // If border width is set, ensure border style is set
                if (!htmlNode.style.borderStyle) {
                  htmlNode.style.borderStyle = 'solid';
                }
              }

              // Padding properties
              if (element.properties.padding) {
                htmlNode.style.padding = element.properties.padding;
              } else {
                // Individual padding values
                if (element.properties.paddingTop) {
                  htmlNode.style.paddingTop = element.properties.paddingTop;
                }
                if (element.properties.paddingRight) {
                  htmlNode.style.paddingRight = element.properties.paddingRight;
                }
                if (element.properties.paddingBottom) {
                  htmlNode.style.paddingBottom = element.properties.paddingBottom;
                }
                if (element.properties.paddingLeft) {
                  htmlNode.style.paddingLeft = element.properties.paddingLeft;
                }
              }

              // For inline elements with padding, set display to inline-block
              if ((element.type === 'text' || element.type === 'link') && 
                  (element.properties.padding || element.properties.paddingTop || 
                   element.properties.paddingRight || element.properties.paddingBottom || 
                   element.properties.paddingLeft)) {
                htmlNode.style.display = 'inline-block';
              }
            }
          });
        } catch (err) {
          console.warn(`Could not apply changes to element ${element.id}:`, err);
        }
      });

      return doc.body.innerHTML;
    } catch (error) {
      console.error('Error applying test changes:', error);
      return html;
    }
  }, []);

  // Update preview with test changes
  const updatePreviewWithTests = useCallback(() => {
    if (!htmlInput) {
      setPreviewHtml('');
      return;
    }

    try {
      let processedHtml = htmlInput;
      
      // Apply test element changes if we have test elements
      if (testElements.length > 0) {
        processedHtml = applyTestChangesToHtml(htmlInput, testElements);
      }

      // Wrap in email structure for preview
      const wrappedHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>Component Preview</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f8fafc;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0; width: 100%; background-color: #f8fafc;" role="presentation">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);" role="presentation">
          ${processedHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      setPreviewHtml(wrappedHtml);
    } catch (error) {
      setPreviewHtml('');
    }
  }, [htmlInput, testElements, applyTestChangesToHtml]);

  // Real-time preview update (immediate)
  useEffect(() => {
    updatePreviewWithTests();
  }, [htmlInput, testElements, updatePreviewWithTests]);

  // Auto-process elements when HTML or component name changes (debounced)
  useEffect(() => {
    if (htmlInput && componentName) {
      const timeoutId = setTimeout(() => {
        processHtml();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [htmlInput, componentName, processHtml]);

  // Validate component name uniqueness
  const validateComponentName = useCallback((name: string, excludeId?: string | null): string | null => {
    if (!name || name.trim().length === 0) {
      return 'Component name is required';
    }
    
    const trimmedName = name.trim();
    const isUnique = componentLibraryService.isComponentNameUnique(trimmedName, excludeId || undefined);
    
    if (!isUnique) {
      return `A component with the name "${trimmedName}" already exists. Please choose a unique name.`;
    }
    
    return null;
  }, []);

  // Validate name on change
  useEffect(() => {
    if (componentName && componentName.trim().length > 0) {
      const error = validateComponentName(componentName, editingComponentId);
      setNameError(error);
    } else {
      setNameError(null);
    }
  }, [componentName, editingComponentId, validateComponentName]);

  // Save component
  const handleSave = useCallback(async () => {
    if (!componentName || !htmlInput || elements.length === 0) {
      setSaveMessage({ type: 'error', text: 'Please provide component name, HTML, and ensure elements are extracted.' });
      return;
    }

    // Validate name uniqueness
    const nameValidationError = validateComponentName(componentName, editingComponentId);
    if (nameValidationError) {
      setNameError(nameValidationError);
      setSaveMessage({ type: 'error', text: nameValidationError });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    setNameError(null);

    try {
      const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');
      
      // Process HTML with prefixed attributes and comment markers
      const componentDisplayName = componentName.split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      let processedHtml = htmlInput;
      const parser = domParserRef.current;
      if (parser) {
        const doc = parser.parseFromString(htmlInput, 'text/html');
        const allElements = Array.from(doc.querySelectorAll('[data-element]'));
        allElements.forEach(node => {
          const dataElement = node.getAttribute('data-element');
          if (dataElement && !dataElement.startsWith(componentPrefix)) {
            const prefixedDataElement = `${componentPrefix}-${dataElement}`;
            node.setAttribute('data-element', prefixedDataElement);
          }
        });

        // Add wrapper data-element if needed
        const body = doc.body;
        const firstChild = body.firstElementChild;
        if (firstChild && !firstChild.hasAttribute('data-element')) {
          const wrapperDataElement = `${componentPrefix}-wrapper`;
          firstChild.setAttribute('data-element', wrapperDataElement);
        }

        // Wrap in comment markers if not already present
        let bodyHtml = doc.body.innerHTML;
        if (!bodyHtml.includes(`<!-- Component start ${componentDisplayName} -->`)) {
          bodyHtml = `<!-- Component start ${componentDisplayName} -->\n${bodyHtml}\n<!-- Component end ${componentDisplayName} -->`;
        }

        processedHtml = bodyHtml;
      }

      // Merge test element properties back into elements if they exist
      // This ensures any property changes made in the Component Tester are saved
      const elementsWithProperties = elements.map(element => {
        const testElement = testElements.find(te => te.id === element.id);
        if (testElement && testElement.properties) {
          return {
            ...element,
            properties: {
              ...element.properties,
              ...testElement.properties
            }
          };
        }
        return element;
      });

      const componentData: ComponentData = {
        id: componentPrefix,
        name: componentName,
        html: processedHtml,
        elements: elementsWithProperties,
        status,
        category: componentCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save using component library service
      componentLibraryService.saveComponent(componentData);

      setSaveMessage({ type: 'success', text: `Component "${componentName}" saved as ${status}!` });
      
      // Refresh component list
      const components = componentLibraryService.getAllComponents();
      setSavedComponents(components);
      
      // Update URL with new component name slug
      const componentSlug = componentName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      navigate(`/gestion/component-builder/${componentSlug}`, { replace: true });
      
      // Clear form if status is live and not editing
      if (status === 'live' && !editingComponentId) {
        setTimeout(() => {
          clearForm();
        }, 2000);
      } else if (status === 'live' && editingComponentId) {
        setEditingComponentId(null);
      }
    } catch (error) {
      console.error('Error saving component:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save component. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [componentName, htmlInput, elements, status, editingComponentId, validateComponentName, navigate, testElements]);

  // Apply properties to HTML and save component
  const handleApplyProperties = useCallback(async () => {
    if (!componentName || !htmlInput || testElements.length === 0) {
      setSaveMessage({ type: 'error', text: 'Please ensure you have HTML and elements to apply properties to.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const parser = domParserRef.current;
      if (!parser) {
        setSaveMessage({ type: 'error', text: 'Could not parse HTML.' });
        setIsSaving(false);
        return;
      }

      const componentPrefix = componentName.toLowerCase().replace(/\s+/g, '_');

      // Start with the current HTML
      const doc = parser.parseFromString(htmlInput, 'text/html');
      
      // Apply all test element properties as inline styles
      testElements.forEach(element => {
        try {
          // Try multiple selector strategies to find the element
          let nodes: Element[] = [];
          
          // Strategy 1: Use the selector as-is
          try {
            nodes = Array.from(doc.querySelectorAll(element.selector));
          } catch (e) {
            // Selector might be invalid, try next strategy
          }
          
          // Strategy 2: Extract data-element from selector and search directly
          if (nodes.length === 0) {
            const dataElementMatch = element.selector.match(/data-element=["']([^"']+)["']/);
            if (dataElementMatch) {
              const dataElementValue = dataElementMatch[1];
              // Try exact match first
              nodes = Array.from(doc.querySelectorAll(`[data-element="${dataElementValue}"]`));
              
              // If not found, try without prefix (extract the part after the prefix)
              if (nodes.length === 0) {
                const prefixMatch = dataElementValue.match(/^[^-]+-(.+)$/);
                if (prefixMatch) {
                  const withoutPrefix = prefixMatch[1];
                  nodes = Array.from(doc.querySelectorAll(`[data-element="${withoutPrefix}"]`));
                }
              }
              
              // If still not found, try partial match (contains)
              if (nodes.length === 0) {
                const parts = dataElementValue.split('-');
                if (parts.length > 1) {
                  // Try with the last part (the actual element name)
                  const elementName = parts[parts.length - 1];
                  nodes = Array.from(doc.querySelectorAll(`[data-element*="${elementName}"]`));
                }
              }
            }
          }
          
          // Strategy 3: Try matching by element ID (convert ID back to data-element format)
          if (nodes.length === 0) {
            // Element ID format: componentPrefix_elementName
            // Convert to data-element format: componentPrefix-elementName
            const elementIdParts = element.id.split('_');
            if (elementIdParts.length > 1) {
              const elementName = elementIdParts.slice(1).join('_');
              const possibleDataElement = `${componentPrefix}-${elementName.replace(/_/g, '-')}`;
              nodes = Array.from(doc.querySelectorAll(`[data-element="${possibleDataElement}"]`));
              
              // Also try without prefix
              if (nodes.length === 0) {
                nodes = Array.from(doc.querySelectorAll(`[data-element="${elementName.replace(/_/g, '-')}"]`));
              }
            }
          }
          
          if (nodes.length === 0) {
            console.warn(`Could not find element with selector: ${element.selector}`);
            return;
          }
          
          nodes.forEach(node => {
            const htmlNode = node as HTMLElement;
            
            // Get existing style attribute or create new one
            const existingStyle = htmlNode.getAttribute('style') || '';
            const styles = existingStyle
              .split(';')
              .map(s => s.trim())
              .filter(Boolean)
              .reduce<Record<string, string>>((acc, declaration) => {
                const [property, ...valueParts] = declaration.split(':');
                if (property && valueParts.length) {
                  acc[property.trim().toLowerCase()] = valueParts.join(':').trim();
                }
                return acc;
              }, {});

            // Apply properties as inline styles
            if (element.properties) {
              // Font properties
              if (element.properties.fontSize) {
                styles['font-size'] = element.properties.fontSize;
              }
              if (element.properties.fontFamily) {
                styles['font-family'] = element.properties.fontFamily;
              }
              if (element.properties.fontWeight) {
                styles['font-weight'] = element.properties.fontWeight;
              }

              // Color properties
              if (element.properties.textColor) {
                styles['color'] = element.properties.textColor;
              }
              if (element.properties.backgroundColor) {
                styles['background-color'] = element.properties.backgroundColor;
              }
              if (element.properties.borderColor) {
                styles['border-color'] = element.properties.borderColor;
              }

              // Border properties
              if (element.properties.borderRadius) {
                styles['border-radius'] = element.properties.borderRadius;
              }
              if (element.properties.borderWidth) {
                styles['border-width'] = element.properties.borderWidth;
                if (!styles['border-style']) {
                  styles['border-style'] = 'solid';
                }
              }

              // Padding properties
              if (element.properties.padding) {
                styles['padding'] = element.properties.padding;
              } else {
                if (element.properties.paddingTop) {
                  styles['padding-top'] = element.properties.paddingTop;
                }
                if (element.properties.paddingRight) {
                  styles['padding-right'] = element.properties.paddingRight;
                }
                if (element.properties.paddingBottom) {
                  styles['padding-bottom'] = element.properties.paddingBottom;
                }
                if (element.properties.paddingLeft) {
                  styles['padding-left'] = element.properties.paddingLeft;
                }
              }

              // For inline elements with padding, set display to inline-block
              if ((element.type === 'text' || element.type === 'link') && 
                  (styles['padding'] || styles['padding-top'] || styles['padding-right'] || 
                   styles['padding-bottom'] || styles['padding-left'])) {
                styles['display'] = 'inline-block';
              }
            }

            // Update content if needed
            if (element.type === 'text' || element.type === 'heading') {
              htmlNode.textContent = element.value || element.defaultValue;
            }
            if ((element.type === 'button' || element.type === 'link') && element.value) {
              htmlNode.textContent = element.value;
            }
            if (element.type === 'image' && element.properties?.url) {
              (htmlNode as HTMLImageElement).src = element.properties.url;
            }

            // Convert styles object back to string
            const styleString = Object.entries(styles)
              .map(([key, value]) => `${key}: ${value}`)
              .join('; ');
            
            htmlNode.setAttribute('style', styleString);
          });
        } catch (err) {
          console.warn(`Could not apply properties to element ${element.id}:`, err);
        }
      });

      // Get the updated HTML
      const updatedHtml = doc.body.innerHTML;

      // Update the HTML input
      setHtmlInput(updatedHtml);

      // Process the HTML to update elements
      const extractedElements = extractElementsFromHtml(updatedHtml, componentPrefix);
      setElements(extractedElements);
      setTestElements(extractedElements.map(el => ({ ...el })));

      // Save the component with updated HTML
      const componentDisplayName = componentName.split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      // Process HTML with prefixed attributes and comment markers
      let processedHtml = updatedHtml;
      const allElements = Array.from(doc.querySelectorAll('[data-element]'));
      allElements.forEach(node => {
        const dataElement = node.getAttribute('data-element');
        if (dataElement && !dataElement.startsWith(componentPrefix)) {
          const prefixedDataElement = `${componentPrefix}-${dataElement}`;
          node.setAttribute('data-element', prefixedDataElement);
        }
      });

      // Add wrapper data-element if needed
      const body = doc.body;
      const firstChild = body.firstElementChild;
      if (firstChild && !firstChild.hasAttribute('data-element')) {
        const wrapperDataElement = `${componentPrefix}-wrapper`;
        firstChild.setAttribute('data-element', wrapperDataElement);
      }

      // Wrap in comment markers if not already present
      let bodyHtml = doc.body.innerHTML;
      if (!bodyHtml.includes(`<!-- Component start ${componentDisplayName} -->`)) {
        bodyHtml = `<!-- Component start ${componentDisplayName} -->\n${bodyHtml}\n<!-- Component end ${componentDisplayName} -->`;
      }

      processedHtml = bodyHtml;

      // Merge test element properties back into elements
      const elementsWithProperties = extractedElements.map(element => {
        const testElement = testElements.find(te => te.id === element.id);
        if (testElement && testElement.properties) {
          return {
            ...element,
            properties: {
              ...element.properties,
              ...testElement.properties
            }
          };
        }
        return element;
      });

      const componentData: ComponentData = {
        id: componentPrefix,
        name: componentName,
        html: processedHtml,
        elements: elementsWithProperties,
        status,
        category: componentCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save using component library service
      componentLibraryService.saveComponent(componentData);

      setSaveMessage({ type: 'success', text: `Properties applied and component "${componentName}" saved!` });
      
      // Refresh component list
      const components = componentLibraryService.getAllComponents();
      setSavedComponents(components);
      
      // Update URL with new component name slug
      const componentSlug = componentName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      navigate(`/gestion/component-builder/${componentSlug}`, { replace: true });
      
      // Reload the component to show updated HTML
      const savedComponent = componentLibraryService.getComponentById(componentPrefix);
      if (savedComponent) {
        loadComponent(savedComponent);
      }

    } catch (error) {
      console.error('Error applying properties:', error);
      setSaveMessage({ type: 'error', text: 'Failed to apply properties. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [componentName, htmlInput, testElements, componentCategory, status, extractElementsFromHtml, navigate, loadComponent]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Component Builder</h1>
          <p className="text-gray-600 mt-1">Create reusable email components from HTML</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FolderOpen className="w-5 h-5" />
            {showLibrary ? 'Hide' : 'Show'} Library ({savedComponents.length})
          </button>
          {editingComponentId && (
            <button
              onClick={clearForm}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
              New Component
            </button>
          )}
        </div>
      </div>

      {/* Component Library */}
      {showLibrary && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Component Library</h2>
          {savedComponents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No components saved yet. Create your first component!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedComponents.map((component) => (
                <div
                  key={component.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    editingComponentId === component.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => loadComponent(component)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{component.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      component.status === 'live'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {component.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {component.elements.length} element{component.elements.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated: {new Date(component.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          saveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{saveMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Input */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Component Details</h2>
            
            {/* Component Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Component Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="e.g., notification_block"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  nameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              {nameError ? (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {nameError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  This will be used as the prefix for all element IDs (e.g., notification_block_title)
                </p>
              )}
            </div>

            {/* Component Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={componentCategory}
                onChange={(e) => setComponentCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Categorize your component for easier organization
              </p>
            </div>

            {/* Status Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('draft')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    status === 'draft'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('live')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    status === 'live'
                      ? 'bg-green-100 text-green-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Live
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Draft: Save for editing later. Live: Make available in template builder.
              </p>
            </div>

            {/* HTML Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  HTML Block <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>
              <textarea
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder="Paste your HTML here. Elements with data-element attributes will be automatically extracted..."
                className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {elements.length} element{elements.length !== 1 ? 's' : ''} extracted
                {isProcessing && <span className="ml-2 text-blue-600">Processing...</span>}
              </p>
            </div>

            {/* Apply Properties Button */}
            {testElements.length > 0 && (
              <button
                onClick={handleApplyProperties}
                disabled={!componentName || !htmlInput || testElements.length === 0 || isSaving}
                className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                title="Apply all element properties as inline styles to the HTML and save"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Apply Properties to HTML
                  </>
                )}
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!componentName || !htmlInput || elements.length === 0 || isSaving}
              className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {status === 'live' ? 'Save & Publish' : 'Save as Draft'}
                </>
              )}
            </button>
          </div>

          {/* Extracted Elements */}
          {elements.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Extracted Elements</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {elements.map((element, index) => (
                  <div key={element.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {element.type === 'heading' && <FileText className="w-4 h-4 text-blue-600" />}
                      {element.type === 'text' && <Type className="w-4 h-4 text-gray-600" />}
                      {element.type === 'image' && <ImageIcon className="w-4 h-4 text-green-600" />}
                      {element.type === 'button' && <MousePointerClick className="w-4 h-4 text-purple-600" />}
                      {element.type === 'link' && <LinkIcon className="w-4 h-4 text-orange-600" />}
                      {element.type === 'section' && <Layout className="w-4 h-4 text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{element.label}</p>
                      <p className="text-xs text-gray-500 truncate">ID: {element.id}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                        {element.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Middle Panel - Preview */}
        {showPreview && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
              <Code className="w-5 h-5 text-gray-400" />
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {previewHtml ? (
                <iframe
                  ref={previewIframeRef}
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ 
                    minHeight: '400px',
                    width: '100%',
                    display: 'block',
                    border: 'none',
                    background: '#f8fafc'
                  }}
                  title="Component Preview"
                  scrolling="no"
                  onLoad={(e) => {
                    // Auto-resize iframe to content height
                    const iframe = e.currentTarget;
                    try {
                      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                      if (iframeDoc) {
                        const height = Math.max(
                          iframeDoc.body.scrollHeight,
                          iframeDoc.body.offsetHeight,
                          iframeDoc.documentElement.clientHeight,
                          iframeDoc.documentElement.scrollHeight,
                          iframeDoc.documentElement.offsetHeight
                        );
                        iframe.style.height = `${Math.max(height, 400)}px`;
                      }
                    } catch (err) {
                      // Cross-origin or other error, use default height
                      console.warn('Could not auto-resize iframe:', err);
                      iframe.style.height = '600px';
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-[600px] text-gray-400">
                  <div className="text-center">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Enter HTML to see preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Panel - Component Tester */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TestTube className="w-5 h-5 text-blue-600" />
              Component Tester
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4">
            {testElements.length === 0 ? (
              <div className="text-center py-8">
                <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">
                  {isProcessing ? 'Processing elements...' : 'No elements found'}
                </p>
                <p className="text-xs text-gray-500">
                  {isProcessing 
                    ? 'Please wait while elements are extracted from your HTML'
                    : 'Add elements with data-element attributes to your HTML to test them'}
                </p>
              </div>
            ) : selectedElement ? (
              <ElementTester
                element={selectedElement}
                testElements={testElements}
                onUpdate={(elementId, updates) => {
                  setTestElements(prev => prev.map(el => 
                    el.id === elementId ? { ...el, ...updates } : el
                  ));
                  // Update selected element
                  const updated = testElements.find(el => el.id === elementId);
                  if (updated) {
                    setSelectedElement({ ...updated, ...updates });
                  }
                }}
                onClose={() => setSelectedElement(null)}
              />
            ) : (
              <ElementList 
                testElements={testElements}
                selectedElementId={null}
                onSelectElement={setSelectedElement}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Element List Component
interface ElementListProps {
  testElements: ComponentElement[];
  selectedElementId: string | null;
  onSelectElement: (element: ComponentElement) => void;
}

const ElementList: React.FC<ElementListProps> = ({ testElements, selectedElementId, onSelectElement }) => {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 mb-3">Select an element to test:</p>
      {testElements.map((element: ComponentElement) => {
        const isSelected = selectedElementId === element.id;
        return (
          <button
            key={element.id}
            type="button"
            onClick={() => onSelectElement(element)}
            className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {element.type === 'heading' && <FileText className="w-4 h-4 text-blue-600" />}
              {element.type === 'text' && <Type className="w-4 h-4 text-gray-600" />}
              {element.type === 'image' && <ImageIcon className="w-4 h-4 text-green-600" />}
              {element.type === 'button' && <MousePointerClick className="w-4 h-4 text-purple-600" />}
              {element.type === 'link' && <LinkIcon className="w-4 h-4 text-orange-600" />}
              {element.type === 'section' && <Layout className="w-4 h-4 text-red-600" />}
              <span className="text-sm font-medium text-gray-900">{element.label}</span>
              {!element.visible && (
                <span className="ml-auto px-2 py-0.5 text-[10px] bg-gray-200 text-gray-600 rounded">
                  Hidden
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{element.id}</p>
          </button>
        );
      })}
    </div>
  );
};

// Component Tester Element Editor
interface ElementTesterProps {
  element: ComponentElement;
  testElements: ComponentElement[];
  onUpdate: (elementId: string, updates: Partial<ComponentElement>) => void;
  onClose: () => void;
}

// Helper function to parse numeric value from string
const parseNumericValue = (value: string | undefined, defaultValue: number = 0): number => {
  if (!value) return defaultValue;
  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : defaultValue;
};

// Helper function to convert hex to rgb for color input compatibility
const hexToRgb = (hex: string | undefined): string => {
  if (!hex) return '#000000';
  if (hex.startsWith('#')) return hex;
  if (hex.includes('rgb')) return hex;
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (match) {
    return `#${match[1]}${match[2]}${match[3]}`;
  }
  return '#000000';
};

// Slider component with better styling
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, unit = 'px', onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const percentage = ((localValue - min) / (max - min)) * 100;
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setLocalValue(newValue);
    onChange(newValue);
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm text-gray-600 font-mono">{localValue}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={localValue}
        onChange={handleChange}
        className="w-full"
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
        }}
      />
    </div>
  );
};

// Color picker component
interface ColorPickerProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  const colorValue = hexToRgb(value || '#000000');
  const displayValue = value || '';
  
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
          style={{ padding: '2px', backgroundColor: colorValue }}
        />
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>
    </div>
  );
};

const ElementTester: React.FC<ElementTesterProps> = ({ element, onUpdate, onClose }) => {
  const [localValue, setLocalValue] = useState(element.value || element.defaultValue);
  const [fontSize, setFontSize] = useState(parseNumericValue(element.properties?.fontSize, 16));
  const [borderRadius, setBorderRadius] = useState(parseNumericValue(element.properties?.borderRadius, 0));
  const [borderWidth, setBorderWidth] = useState(parseNumericValue(element.properties?.borderWidth, 0));
  const [padding, setPadding] = useState({
    top: parseNumericValue(element.properties?.paddingTop, 0),
    right: parseNumericValue(element.properties?.paddingRight, 0),
    bottom: parseNumericValue(element.properties?.paddingBottom, 0),
    left: parseNumericValue(element.properties?.paddingLeft, 0),
  });

  useEffect(() => {
    setLocalValue(element.value || element.defaultValue);
    setFontSize(parseNumericValue(element.properties?.fontSize, 16));
    setBorderRadius(parseNumericValue(element.properties?.borderRadius, 0));
    setBorderWidth(parseNumericValue(element.properties?.borderWidth, 0));
    setPadding({
      top: parseNumericValue(element.properties?.paddingTop, 0),
      right: parseNumericValue(element.properties?.paddingRight, 0),
      bottom: parseNumericValue(element.properties?.paddingBottom, 0),
      left: parseNumericValue(element.properties?.paddingLeft, 0),
    });
  }, [element.id, element.value, element.properties]);

  const handleValueChange = (value: string) => {
    setLocalValue(value);
    onUpdate(element.id, { value });
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    onUpdate(element.id, {
      properties: { ...element.properties, fontSize: `${value}px` }
    });
  };

  const handlePaddingChange = (side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
    const newPadding = { ...padding, [side]: value };
    setPadding(newPadding);
    onUpdate(element.id, {
      properties: {
        ...element.properties,
        [`padding${side.charAt(0).toUpperCase() + side.slice(1)}`]: `${value}px`
      }
    });
  };

  const handleColorChange = (property: 'textColor' | 'backgroundColor' | 'borderColor', value: string) => {
    onUpdate(element.id, {
      properties: { ...element.properties, [property]: value }
    });
  };

  const handleFontFamilyChange = (value: string) => {
    onUpdate(element.id, {
      properties: { ...element.properties, fontFamily: value }
    });
  };

  const handleBorderRadiusChange = (value: number) => {
    setBorderRadius(value);
    onUpdate(element.id, {
      properties: { ...element.properties, borderRadius: `${value}px` }
    });
  };

  const handleBorderWidthChange = (value: number) => {
    setBorderWidth(value);
    onUpdate(element.id, {
      properties: { ...element.properties, borderWidth: `${value}px` }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div>
          <h3 className="font-semibold text-gray-900">{element.label}</h3>
          <p className="text-xs text-gray-500">{element.type}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Visibility Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
        <label className="text-sm font-medium text-gray-700">Visibility</label>
        <button
          type="button"
          onClick={() => onUpdate(element.id, { visible: !element.visible })}
          className={`p-2 rounded-md transition-colors ${
            element.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {element.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Content Editor */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
          {element.type === 'heading' ? (
            <textarea
              value={localValue}
              onChange={(e) => handleValueChange(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              type="text"
              value={localValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      )}

      {/* Font Family */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link') && (
        <FontSelector
          value={element.properties?.fontFamily}
          onChange={handleFontFamilyChange}
          label="Font Family"
        />
      )}

      {/* Font Size */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link') && (
        <Slider
          label="Font Size"
          value={fontSize}
          min={10}
          max={72}
          onChange={handleFontSizeChange}
        />
      )}

      {/* Border Radius */}
      {(element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.borderRadius) && (
        <Slider
          label="Border Radius"
          value={borderRadius}
          min={0}
          max={50}
          onChange={handleBorderRadiusChange}
        />
      )}

      {/* Border Width */}
      {(element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.borderWidth || element.properties?.borderColor) && (
        <Slider
          label="Border Width"
          value={borderWidth}
          min={0}
          max={20}
          onChange={handleBorderWidthChange}
        />
      )}

      {/* Padding */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.padding || element.properties?.paddingTop || element.properties?.paddingBottom || element.properties?.paddingLeft || element.properties?.paddingRight) && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Padding</label>
          <div className="space-y-3 pl-2 border-l-2 border-gray-200">
            <Slider
              label="Padding Top"
              value={padding.top}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('top', value)}
            />
            <Slider
              label="Padding Right"
              value={padding.right}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('right', value)}
            />
            <Slider
              label="Padding Bottom"
              value={padding.bottom}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('bottom', value)}
            />
            <Slider
              label="Padding Left"
              value={padding.left}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('left', value)}
            />
          </div>
        </div>
      )}

      {/* Color Pickers */}
      <div className="space-y-4">
        {/* Text Color */}
        {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.properties?.textColor) && (
          <ColorPicker
            label="Text Color"
            value={element.properties?.textColor}
            onChange={(value) => handleColorChange('textColor', value)}
          />
        )}

        {/* Background Color */}
        {(element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.backgroundColor) && (
          <ColorPicker
            label="Background Color"
            value={element.properties?.backgroundColor}
            onChange={(value) => handleColorChange('backgroundColor', value)}
          />
        )}

        {/* Border Color */}
        {(element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.borderColor || element.properties?.borderWidth) && (
          <ColorPicker
            label="Border Color"
            value={element.properties?.borderColor}
            onChange={(value) => handleColorChange('borderColor', value)}
          />
        )}
      </div>
    </div>
  );
};

