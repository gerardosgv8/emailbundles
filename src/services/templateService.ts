import masterTemplate from '../assets/dynamicEmailTemplates/master_template.json';
import ecomCheckoutEmail from '../assets/dynamicEmailTemplates/ecom_checkout_email.json';
import ecomOrderConfirmation from '../assets/dynamicEmailTemplates/ecom_order_confirmation.json';
import ecomNewProducts from '../assets/dynamicEmailTemplates/ecom_new_products.json';
import ecomPromotional1 from '../assets/dynamicEmailTemplates/ecom_promotional_1.json';
import ecomBackInStock from '../assets/dynamicEmailTemplates/ecom_back_in_stock.json';
import ecomProductRecommendationsHorizontal from '../assets/dynamicEmailTemplates/ecom_product_recommendations_horizontal.json';
import freeflowWelcome from '../assets/dynamicEmailTemplates/freeflow_welcome.json';
import freeflowProductLaunch from '../assets/dynamicEmailTemplates/freeflow_product_launch.json';
import freeflowNewsletter from '../assets/dynamicEmailTemplates/freeflow_newsletter.json';
import freeflowEventInvite from '../assets/dynamicEmailTemplates/freeflow_event_invite.json';
import freeflowFeatureAnnounce from '../assets/dynamicEmailTemplates/freeflow_feature_announce.json';
import freeflowThankYou from '../assets/dynamicEmailTemplates/freeflow_thank_you.json';
import freeflowSurvey from '../assets/dynamicEmailTemplates/freeflow_survey.json';
import freeflowImagePowered from '../assets/dynamicEmailTemplates/freeflow_image_powered.json';
import { resolveEmailTemplatePreviewUrl } from '../utils/emailTemplatePreviewImages';

export interface TemplateMeta {
  templateId: string;
  templateName: string;
  category: string;
  version: string;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  /** Embedded in generated HTML: adaptive = light + dark CSS; light-only = light rules only (no dark-mode blocks). */
  themeCssMode?: 'adaptive' | 'light-only';
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'link' | 'button' | 'spacer' | 'divider' | 'section';
  selector: string;
  label: string;
  defaultValue: string;
  value: string;
  visible: boolean;
  properties?: {
    url?: string;
    href?: string; // For images: the parent <a> tag href
    // Footer social icons / link-icon placeholders
    iconSrc?: string; // Preferred (image URL to render)
    imageSrc?: string; // Legacy alias (same meaning as iconSrc)
    alt?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    textColor?: string;
    /** Set by Email Builder when user explicitly picks a font color; preserves that color in dark + light preview. */
    userSetTextColor?: boolean;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string;
    padding?: string;
    paddingTop?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    paddingRight?: string;
    // Additional layout/text styles used by the builder
    lineHeight?: string;
    margin?: string;
    marginTop?: string;
    marginRight?: string;
    marginBottom?: string;
    marginLeft?: string;
    borderRadius?: string;
    borderColor?: string;
    borderWidth?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify' | string;
  };
  validation?: {
    required?: boolean;
    maxLength?: number;
    allowedTypes?: string[];
  };
}

export interface TemplateSection {
  id: string;
  name: string;
  visible: boolean;
  elements: string[];
  backgroundColor?: string;
}

export interface DynamicTemplate {
  meta: TemplateMeta;
  html: string;
  elements: TemplateElement[];
  sections?: TemplateSection[];
}

export interface TemplateListItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  /** Card thumbnail in Email Builder template picker (EmailDemoImages; SVG preferred over PNG). */
  previewThumbUrl?: string;
}

class TemplateService {
  private templates: Map<string, DynamicTemplate> = new Map();
  /** IDs of built-in templates only (from static imports). User-created/saved templates must not appear in the email builder template list. */
  private builtInTemplateIds: Set<string> = new Set();

  private loadPromise: Promise<void> | null = null;

  constructor() {
    // Load templates immediately
    this.loadPromise = this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    // Only load once
    if (this.templates.size > 0) {
      return;
    }

    try {
      // Import all templates using static imports
      const templateImports = [
        { id: 'master_template', data: masterTemplate },
        { id: 'ecom_checkout_email', data: ecomCheckoutEmail },
        { id: 'ecom_order_confirmation', data: ecomOrderConfirmation },
        { id: 'ecom_new_products', data: ecomNewProducts },
        { id: 'ecom_promotional_1', data: ecomPromotional1 },
        { id: 'ecom_back_in_stock', data: ecomBackInStock },
        { id: 'ecom_product_recommendations_horizontal', data: ecomProductRecommendationsHorizontal },
        { id: 'freeflow_welcome', data: freeflowWelcome },
        { id: 'freeflow_product_launch', data: freeflowProductLaunch },
        { id: 'freeflow_newsletter', data: freeflowNewsletter },
        { id: 'freeflow_event_invite', data: freeflowEventInvite },
        { id: 'freeflow_feature_announce', data: freeflowFeatureAnnounce },
        { id: 'freeflow_thank_you', data: freeflowThankYou },
        { id: 'freeflow_survey', data: freeflowSurvey },
        { id: 'freeflow_image_powered', data: freeflowImagePowered },
      ];

      // Load HTML for templates from file if not in JSON
      const loadTemplateHtml = async (templateId: string) => {
        try {
          const response = await fetch(`/${templateId}.html`);
          if (response.ok) {
            return await response.text();
          }
        } catch {
          /* optional HTML file */
        }
        return null;
      };

      for (const { id, data } of templateImports) {
        if (!data) {
          continue;
        }
        if (!data.meta || !data.meta.templateId) {
          continue;
        }
        
        // Load HTML from file if html field is missing, empty, or contains only minimal structure
        const hasMinimalHtml = data.html && (
          data.html.trim() === '' || 
          data.html.trim() === '<html><body></body></html>' ||
          data.html.trim() === '<html><head></head><body></body></html>' ||
          data.html.length < 100 // Very short HTML likely means it's not the full template
        );
        
        if (!data.html || hasMinimalHtml) {
          const html = await loadTemplateHtml(id);
          if (html && html.trim().length > 100) {
            data.html = html;
          } else {
            if (html) {
              /* HTML file too short; keep existing */
            } else {
              /* No separate HTML file; keep existing */
            }
            // Keep the existing html or set empty string as fallback
            if (!data.html) {
              data.html = '';
            }
          }
        }
        
        const normalized: DynamicTemplate = {
          ...(data as DynamicTemplate),
          meta: {
            ...(data as DynamicTemplate).meta,
            themeCssMode: (data as DynamicTemplate).meta.themeCssMode ?? 'adaptive',
          },
        };
        this.templates.set(id, normalized);
        this.builtInTemplateIds.add(id);
      }

      if (this.templates.size === 0) {
        console.error('No templates were loaded. Check template imports.');
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      throw error;
    }
  }

  /**
   * Get list of all available templates
   */
  async getTemplateList(): Promise<TemplateListItem[]> {
    try {
      await this.loadPromise;
      // Only include built-in templates. User-created/saved templates are cached in this.templates
      // when loaded via getTemplate() but must only appear in the Template Library, not here.
      const list = Array.from(this.templates.values())
        .filter(template => template.meta && this.builtInTemplateIds.has(template.meta.templateId))
        .map(template => {
          if (!template.meta) return null;
          return {
            id: template.meta.templateId,
            name: template.meta.templateName,
            category: template.meta.category,
            description: template.meta.description,
            previewThumbUrl: resolveEmailTemplatePreviewUrl(
              template.meta.templateId,
              template.meta.templateName
            ),
          };
        })
        .filter((item): item is TemplateListItem => item !== null);

      return list;
    } catch (error) {
      console.error('Error in getTemplateList:', error);
      return [];
    }
  }

  /**
   * Parse style string into object
   */
  private parseStyleString(styleString: string): Record<string, string> {
    if (!styleString) return {};
    return styleString
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, declaration) => {
        const [property, ...valueParts] = declaration.split(':');
        if (!property || !valueParts.length) return acc;
        const key = property.trim().toLowerCase();
        const value = valueParts.join(':').trim();
        acc[key] = value;
        return acc;
      }, {});
  }

  /**
   * Extract elements from HTML (similar to component builder)
   */
  private extractElementsFromHtml(html: string): TemplateElement[] {
    if (!html) return [];
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const elements: TemplateElement[] = [];
      const seenDataElements = new Set<string>();

      // Find all elements with data-element attributes
      const elementsWithDataAttr = Array.from(doc.querySelectorAll('[data-element]'));

      elementsWithDataAttr.forEach((node) => {
        const dataElement = node.getAttribute('data-element');
        if (!dataElement || seenDataElements.has(dataElement)) return;
        seenDataElements.add(dataElement);

        // Determine element type
        let elementType: TemplateElement['type'] = 'text';
        const tagName = node.tagName.toLowerCase();
        
        if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
          elementType = 'heading';
        } else if (tagName === 'img') {
          elementType = 'image';
        } else if (tagName === 'a') {
          const hasButtonStyle = node.getAttribute('style')?.includes('background-color') || 
                                node.getAttribute('style')?.includes('padding');
          if (hasButtonStyle || (node.textContent?.trim() || '').length < 50) {
            elementType = 'button';
          } else {
            elementType = 'link';
          }
        } else if (tagName === 'td') {
          const innerA = node.querySelector('a');
          const tdStyle = node.getAttribute('style') || '';
          const aStyle = innerA?.getAttribute('style') || '';
          const de = (dataElement || '').toLowerCase();
          const looksLikeCta =
            Boolean(innerA) &&
            (de.includes('cta') ||
              de.includes('button') ||
              tdStyle.includes('background-color') ||
              aStyle.includes('background-color') ||
              (aStyle.includes('padding') && aStyle.length > 0));
          if (looksLikeCta) {
            elementType = 'button';
          }
        } else if (tagName === 'table' || tagName === 'div') {
          const hasBackground = node.getAttribute('style')?.includes('background-color');
          if (hasBackground) {
            elementType = 'section';
          }
        }

        // Get default value
        let defaultValue = '';
        if (elementType === 'image') {
          defaultValue = node.getAttribute('src') || node.getAttribute('data-src') || '';
        } else if (elementType === 'button' && tagName === 'td') {
          const innerA = node.querySelector('a');
          defaultValue = innerA?.textContent?.trim() || node.textContent?.trim() || '';
        } else if (elementType === 'link' || elementType === 'button') {
          defaultValue = node.textContent?.trim() || '';
        } else {
          defaultValue = node.textContent?.trim() || '';
        }

        // Extract properties
        const properties: Record<string, any> = {};
        
        // Extract element-specific properties
        if (elementType === 'image') {
          const alt = node.getAttribute('alt') || '';
          properties.alt = alt;
          // Note: image src is stored in defaultValue/value, not in properties.url
        } else if (elementType === 'link' || elementType === 'button') {
          const href =
            tagName === 'td'
              ? (node.querySelector('a') as HTMLAnchorElement | null)?.getAttribute('href') || '#'
              : node.getAttribute('href') || '#';
          properties.url = href;
        }

        const applyParsedStyles = (styles: Record<string, string>, target: Record<string, any>) => {
          if (styles['font-size']) target.fontSize = styles['font-size'];
          if (styles['font-family']) target.fontFamily = styles['font-family'];
          if (styles['font-weight']) target.fontWeight = styles['font-weight'];
          if (styles['color'] && target.textColor === undefined) target.textColor = styles['color'];
          if (styles['background-color'] && target.backgroundColor === undefined) {
            target.backgroundColor = styles['background-color'];
          }
          if (styles['border-color'] && target.borderColor === undefined) {
            target.borderColor = styles['border-color'];
          }
          if (styles['padding'] && target.padding === undefined) target.padding = styles['padding'];
          if (styles['padding-top'] && target.paddingTop === undefined) {
            target.paddingTop = styles['padding-top'];
          }
          if (styles['padding-right'] && target.paddingRight === undefined) {
            target.paddingRight = styles['padding-right'];
          }
          if (styles['padding-bottom'] && target.paddingBottom === undefined) {
            target.paddingBottom = styles['padding-bottom'];
          }
          if (styles['padding-left'] && target.paddingLeft === undefined) {
            target.paddingLeft = styles['padding-left'];
          }
          if (styles['border-radius'] && target.borderRadius === undefined) {
            target.borderRadius = styles['border-radius'];
          }
          if (styles['border-width'] && target.borderWidth === undefined) {
            target.borderWidth = styles['border-width'];
          }
          if (styles['text-align'] && target.textAlign === undefined) {
            target.textAlign = styles['text-align'];
          }
        };

        // Extract style properties from inline styles
        const styleAttr = node.getAttribute('style');
        if (styleAttr) {
          const styles = this.parseStyleString(styleAttr);
          
          applyParsedStyles(styles, properties);
        }

        if (tagName === 'td' && elementType === 'button') {
          const innerA = node.querySelector('a');
          const innerStyle = innerA?.getAttribute('style');
          if (innerStyle) {
            const aStyles = this.parseStyleString(innerStyle);
            applyParsedStyles(aStyles, properties);
            // Inner <a> usually carries the pill fill + label color; let it win over any td text color.
            if (aStyles['color']) properties.textColor = aStyles['color'];
            if (aStyles['background-color']) properties.backgroundColor = aStyles['background-color'];
          }
        }

        // Create selector
        const selector = `${tagName}[data-element="${dataElement}"]`;

        // Create element ID from data-element
        const elementId = dataElement.replace(/-/g, '_');

        elements.push({
          id: elementId,
          type: elementType,
          selector,
          label: dataElement.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          defaultValue,
          value: defaultValue,
          visible: true,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        });
      });

      return elements;
    } catch (error) {
      console.error('Error extracting elements:', error);
      return [];
    }
  }

  /**
   * Convert saved template from TemplateComposer to DynamicTemplate format
   */
  private async convertSavedTemplateToDynamic(savedTemplate: any): Promise<DynamicTemplate | null> {
    try {
      // Helper to strip comment markers from component HTML
      const cleanComponentHtml = (html: string): string => {
        return html
          .replace(/<!--\s*Component\s+(?:start|Start|end|End)\s+[^>]+-->/gi, '')
          .trim();
      };

      // Load component definitions first to inject data-element attributes
      const { componentLibraryService } = await import('./componentLibraryService');
      const componentMap = new Map<string, any>();
      
      // Also try to load from template sections if component library doesn't have it
      // This is important for components from Template Composer which come from Master Template
      let templateSectionsMap = new Map<string, any>();
      try {
        const { extractSectionsFromTemplate } = await import('../utils/extractTemplateSections');
        const masterTemplateSections = await extractSectionsFromTemplate('master_template');
        masterTemplateSections.forEach(section => {
          templateSectionsMap.set(section.id, section);
          // Also add to componentMap if not already there (for name lookup)
          if (!componentMap.has(section.id)) {
            componentMap.set(section.id, {
              id: section.id,
              name: section.name,
              html: section.html,
              elements: section.elements,
              category: section.category,
              status: 'live' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });
      } catch {
        /* master template sections optional for naming */
      }
      
      // Load component definitions for all components in the template
      savedTemplate.components.forEach((comp: any) => {
        if (comp.componentId) {
          let component = null;
          
          // Try to get from component library first
          try {
            component = componentLibraryService.getComponentById(comp.componentId);
            if (component) {
              componentMap.set(comp.componentId, component);
              return; // Found in library, skip to next
            }
          } catch (err) {
            // Component not found in library, try template sections
          }
          
          // Try to get from template sections (for components extracted from Master Template)
          if (!component) {
            component = templateSectionsMap.get(comp.componentId);
            if (component) {
              // Convert SectionComponent to ComponentData format
              componentMap.set(comp.componentId, {
                id: component.id,
                name: component.name,
                html: component.html,
                elements: component.elements,
                category: component.category,
                status: 'live' as const,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
          
        }
      });

      // Inject data-element attributes into component HTML based on component definitions
      const injectDataElements = (componentHtml: string, componentId: string): string => {
        const component = componentMap.get(componentId);
        if (!component || !component.elements || component.elements.length === 0) {
          return componentHtml; // No elements to inject, return as-is
        }

        try {
          const parser = new DOMParser();
          // Wrap in a container to preserve structure
          const wrappedHtml = `<div>${componentHtml}</div>`;
          const doc = parser.parseFromString(wrappedHtml, 'text/html');
          const container = doc.querySelector('div');
          if (!container) return componentHtml;
          
          let modified = false;

          // For each element definition, find the matching node and add data-element attribute
          component.elements.forEach((elementDef: any) => {
            if (!elementDef.selector) return;

            // Extract data-element value from selector if present
            const dataElementMatch = elementDef.selector.match(/data-element=["']([^"']+)["']/);
            if (!dataElementMatch) {
              // If selector doesn't have data-element, create one from element ID
              const elementId = elementDef.id || '';
              const dataElementValue = elementId.replace(/_/g, '-');
              
              // Try to find element by tag type and content
              const tagMatch = elementDef.selector.match(/^([a-z]+)/);
              if (tagMatch) {
                const tagName = tagMatch[1];
                const allNodes = Array.from(container.querySelectorAll(tagName));
                
                // Try to match by default value, value, or label
                const searchText = elementDef.defaultValue || elementDef.value || elementDef.label || '';
                const matchingNode = allNodes.find((node: Element) => {
                  if (node.hasAttribute('data-element')) return false; // Skip if already has it
                  
                  if (elementDef.type === 'image') {
                    const src = node.getAttribute('src') || '';
                    const alt = node.getAttribute('alt') || '';
                    return src === searchText || alt === searchText;
                  }
                  
                  const textContent = node.textContent?.trim() || '';
                  return textContent === searchText || 
                         (searchText && textContent.includes(searchText));
                });

                if (matchingNode) {
                  matchingNode.setAttribute('data-element', dataElementValue);
                  modified = true;
                }
              }
              return;
            }

            const dataElementValue = dataElementMatch[1];

            // Try to find the element using the selector (without data-element part)
            try {
              // First try the full selector
              let nodes = Array.from(container.querySelectorAll(elementDef.selector));
              
              if (nodes.length === 0) {
                // Try selector without data-element requirement
                const selectorWithoutDataElement = elementDef.selector
                  .replace(/\[data-element=["'][^"']+["']\]/g, '')
                  .trim();
                if (selectorWithoutDataElement) {
                  nodes = Array.from(container.querySelectorAll(selectorWithoutDataElement));
                }
              }

              if (nodes.length === 0) {
                // Fallback: find by tag type and content
                const tagMatch = elementDef.selector.match(/^([a-z]+)/);
                if (tagMatch) {
                  const tagName = tagMatch[1];
                  const allNodes = Array.from(container.querySelectorAll(tagName));
                  
                  const searchText = elementDef.defaultValue || elementDef.value || '';
                  const matchingNode = allNodes.find((node: Element) => {
                    if (node.hasAttribute('data-element')) return false;
                    
                    if (elementDef.type === 'image') {
                      const src = node.getAttribute('src') || '';
                      return src === searchText;
                    }
                    
                    const textContent = node.textContent?.trim() || '';
                    return textContent === searchText || 
                           (searchText && textContent.includes(searchText));
                  });

                  if (matchingNode) {
                    matchingNode.setAttribute('data-element', dataElementValue);
                    modified = true;
                  }
                }
              } else {
                // Found nodes, add data-element if missing
                nodes.forEach((node: Element) => {
                  if (!node.hasAttribute('data-element')) {
                    node.setAttribute('data-element', dataElementValue);
                    modified = true;
                  }
                });
              }
            } catch {
              // Selector might be invalid, try fallback approach
            }
          });

          if (modified) {
            return container.innerHTML;
          }
        } catch {
          /* injection best-effort */
        }

        return componentHtml;
      };

      // Combine all component HTMLs in order, cleaning comment markers and injecting data-elements
      const componentsHtml = savedTemplate.components
        .sort((a: any, b: any) => a.order - b.order)
        .map((c: any) => {
          let html = cleanComponentHtml(c.html);
          // Inject data-element attributes if component definition exists
          if (c.componentId) {
            html = injectDataElements(html, c.componentId);
          }
          return html;
        })
        .join('\n');

      // Wrap in email structure
      const fullHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>${savedTemplate.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0; width: 100%; background-color: #ffffff;" role="presentation">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);" role="presentation">
          ${componentsHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // Extract elements from the combined HTML (use fullHtml for better element detection)
      let elements = this.extractElementsFromHtml(fullHtml);

      // Enhance elements with properties from component definitions if available
      // This ensures component properties set in Component Builder are preserved
      // (componentMap is already loaded above)
      try {

        // Merge component element properties into extracted elements
        elements = elements.map(element => {
          // Try to find matching component element by data-element attribute
          const dataElementMatch = element.selector.match(/data-element=["']([^"']+)["']/);
          if (dataElementMatch) {
            const dataElementValue = dataElementMatch[1];
            
            // Search through all components for matching element
            for (const component of componentMap.values()) {
              if (!component.elements) continue;
              
              const componentElement = component.elements.find((el: any) => {
                // Check if element selector matches
                const elDataElementMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
                if (elDataElementMatch) {
                  return elDataElementMatch[1] === dataElementValue;
                }
                return false;
              });

              if (componentElement && componentElement.properties) {
                // Saved/extracted element properties win; component fills defaults for new keys (e.g. textAlign).
                return {
                  ...element,
                  properties: {
                    ...componentElement.properties,
                    ...element.properties
                  }
                };
              }
            }
          }
          return element;
        });
      } catch {
        // If component library is not available, just use extracted elements
      }


      // Create sections from components for grouping elements
      // First, create a map of data-element values to element IDs for quick lookup
      const dataElementToElementId = new Map<string, string>();
      elements.forEach(element => {
        const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
        if (dataElementMatch) {
          const dataElementValue = dataElementMatch[1];
          dataElementToElementId.set(dataElementValue, element.id);
        }
        // Also try matching by element ID converted to data-element format
        const elementIdAsDataElement = element.id.replace(/_/g, '-');
        if (!dataElementToElementId.has(elementIdAsDataElement)) {
          dataElementToElementId.set(elementIdAsDataElement, element.id);
        }
      });

      const sections: TemplateSection[] = savedTemplate.components
        .sort((a: any, b: any) => a.order - b.order)
        .map((component: any, index: number) => {
          // Get component definition to get its name and elements
          let componentDef = componentMap.get(component.componentId);
          let componentName = componentDef?.name;
          
          // If not found in componentMap, try template sections map (should already be loaded)
          if (!componentName) {
            const templateSection = templateSectionsMap.get(component.componentId);
            if (templateSection) {
              componentName = templateSection.name;
              // Add to componentMap for element matching
              if (!componentDef) {
                componentDef = {
                  id: templateSection.id,
                  name: templateSection.name,
                  html: templateSection.html,
                  elements: templateSection.elements,
                };
                componentMap.set(component.componentId, componentDef);
              }
            }
          }

          // Final fallback
          if (!componentName) {
            componentName = `Component ${index + 1}`;
          }

          // Get element IDs that belong to this component
          const componentElementIds: string[] = [];
          if (componentDef?.elements) {
            // Map component elements to extracted elements by data-element attribute
            componentDef.elements.forEach((compEl: any) => {
              // Try multiple matching strategies
              let matchedElementId: string | undefined;
              
              // Strategy 1: Match by data-element attribute in selector
              const dataElementMatch = compEl.selector?.match(/data-element=["']([^"']+)["']/);
              if (dataElementMatch) {
                const dataElementValue = dataElementMatch[1];
                matchedElementId = dataElementToElementId.get(dataElementValue);
              }
              
              // Strategy 2: Match by element ID (component element ID should match extracted element ID)
              if (!matchedElementId) {
                matchedElementId = dataElementToElementId.get(compEl.id.replace(/_/g, '-'));
              }
              
              // Strategy 3: Direct ID match
              if (!matchedElementId) {
                const directMatch = elements.find(el => el.id === compEl.id);
                if (directMatch) {
                  matchedElementId = directMatch.id;
                }
              }
              
              // Strategy 4: Match by label (fallback)
              if (!matchedElementId && compEl.label) {
                const labelMatch = elements.find(el => 
                  el.label === compEl.label || 
                  el.label?.toLowerCase() === compEl.label?.toLowerCase()
                );
                if (labelMatch) {
                  matchedElementId = labelMatch.id;
                }
              }
              
              if (matchedElementId && !componentElementIds.includes(matchedElementId)) {
                componentElementIds.push(matchedElementId);
              }
            });
          }
          
          // If no elements matched from component definition, try to find elements in the component HTML
          if (componentElementIds.length === 0) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(component.html, 'text/html');
              const dataElementsInHtml = Array.from(doc.querySelectorAll('[data-element]'));
              
              dataElementsInHtml.forEach(node => {
                const dataElementValue = node.getAttribute('data-element');
                if (dataElementValue) {
                  const matchedId = dataElementToElementId.get(dataElementValue);
                  if (matchedId && !componentElementIds.includes(matchedId)) {
                    componentElementIds.push(matchedId);
                  }
                }
              });
            } catch {
              /* parse best-effort */
            }
          }
          
          return {
            id: `section_${component.id}`,
            name: componentName,
            visible: true,
            elements: componentElementIds
          };
        })
        .filter((section: TemplateSection) => section.elements.length > 0); // Only include sections with elements

      const dynamicTemplate: DynamicTemplate = {
        meta: {
          templateId: savedTemplate.id,
          templateName: savedTemplate.name,
          category: 'saved',
          version: '1.0.0',
          createdAt: savedTemplate.createdAt,
          updatedAt: savedTemplate.updatedAt,
          description: `Saved template: ${savedTemplate.name}`
        },
        html: fullHtml,
        elements: elements,
        sections: sections
      };

      return dynamicTemplate;
    } catch (error) {
      console.error('Error converting saved template:', error);
      return null;
    }
  }

  /**
   * Get template by ID (checks both regular templates and saved templates)
   * @param templateId - The template ID
   * @param userId - Optional user ID for user-specific saved templates
   */
  async getTemplate(templateId: string, userId?: number | string | null): Promise<DynamicTemplate | null> {
    await this.loadPromise;
    
    // First, check if it's a regular template (from static imports)
    const regularTemplate = this.templates.get(templateId);
    if (regularTemplate) {
      return regularTemplate;
    }
    
    // If not found in regular templates, try to load it as a saved template
    // Saved templates can have any ID format:
    // 1. "template_" prefix (fallback ID format)
    // 2. "saved_" prefix (legacy format)
    // 3. UUID format (from crypto.randomUUID())
    // 4. Any other ID that's not in regular templates
    // We check saved templates for ANY template ID that's not in regular templates
    try {
      let savedTemplate: any = null;
      
      // Try Supabase first if user ID is provided
      if (userId) {
        try {
          const { getTemplateByIdSupabase } = await import('./savedTemplatesSupabase');
          savedTemplate = await getTemplateByIdSupabase(templateId, userId);
        } catch {
          /* fallback to localStorage below */
        }
      }
      
      // Fallback to localStorage if Supabase didn't work or no user ID
      if (!savedTemplate) {
        const { getSavedTemplates } = await import('../utils/savedTemplatesStorage');
        const savedTemplates = getSavedTemplates(userId);
        savedTemplate = savedTemplates.find((t: any) => t.id === templateId);
      }
      
      if (savedTemplate) {
        const converted = await this.convertSavedTemplateToDynamic(savedTemplate);
        if (converted) {
          // Cache it in the templates map for this session
          this.templates.set(templateId, converted);
          return converted;
        } else {
          console.error('Failed to convert saved template to dynamic format:', templateId);
        }
      }
    } catch (error) {
      console.error('Error loading saved template:', error);
      console.error('   Template ID:', templateId);
      console.error('   User ID:', userId);
    }
    
    // Return null if not found anywhere
    return null;
  }

  /**
   * Get HTML template content by file path
   */
  async loadHtmlTemplate(relativePath: string): Promise<string> {
    try {
      // Import the HTML file as text
      const response = await fetch(relativePath);
      if (!response.ok) {
        throw new Error(`Failed to load HTML template: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error loading HTML template:', error);
      throw error;
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique user session ID
   */
  generateUserSessionId(userId: string | number): string {
    return `${userId}_${Date.now()}`;
  }

  /**
   * Get template path for builder
   */
  getTemplatePath(templateId: string, sessionId: string): string {
    return `builder/${templateId}/${sessionId}`;
  }

  /**
   * Parse template path to extract IDs
   */
  parseTemplatePath(path: string): { templateId: string; sessionId: string } | null {
    const match = path.match(/builder\/(.+)\/(.+)/);
    if (match) {
      return {
        templateId: match[1],
        sessionId: match[2],
      };
    }
    return null;
  }
}

export const templateService = new TemplateService();
export default templateService;
