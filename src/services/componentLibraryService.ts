export interface ComponentElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'link' | 'button' | 'spacer' | 'divider' | 'section';
  selector: string;
  label: string;
  defaultValue: string;
  value: string;
  visible: boolean;
  properties?: Record<string, any>;
}

export interface ComponentData {
  id: string;
  name: string;
  html: string;
  elements: ComponentElement[];
  status: 'draft' | 'live';
  category?: string;
  preview?: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

class ComponentLibraryService {
  private storageKey = 'componentLibrary';

  private initialized = false;

  constructor() {
    // Initialize components asynchronously
    this.initializeDefaultComponents();
  }

  /**
   * Initialize default components from template_design_system.html
   */
  private async initializeDefaultComponents(): Promise<void> {
    if (this.initialized) return;
    
    // Check if library was manually cleared - don't auto-initialize in that case
    if (localStorage.getItem('componentLibraryCleared') === 'true') {
      console.log('📦 Component library was manually cleared. Skipping auto-initialization.');
      this.initialized = true;
      return;
    }
    
    try {
      const existing = this.getAllComponents();
      
      // Import and initialize design system components
      const { initializeDesignSystemComponents } = await import('../utils/parseDesignSystemComponents');
      const designSystemComponents = await initializeDesignSystemComponents();
      
      // Add components that don't already exist
      let addedCount = 0;
      designSystemComponents.forEach(component => {
        const exists = existing.some(c => c.id === component.id);
        if (!exists) {
          existing.push(component);
          addedCount++;
        }
      });
      
      // Categorize existing components that don't have categories
      let categorizedCount = 0;
      const getCategory = (name: string): string => {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('header') || nameLower.includes('navigation')) return 'navigation';
        if (nameLower.includes('footer')) return 'footer';
        if (nameLower.includes('cta') || nameLower.includes('button') || nameLower.includes('call')) return 'cta';
        if (nameLower.includes('product') || nameLower.includes('order') || nameLower.includes('checkout') || nameLower.includes('cart')) return 'ecommerce';
        if (nameLower.includes('hero') || nameLower.includes('feature') || nameLower.includes('notification') || nameLower.includes('bullet') || nameLower.includes('icon') || nameLower.includes('metric')) return 'content';
        return 'layout';
      };
      
      existing.forEach(component => {
        if (!component.category) {
          component.category = getCategory(component.name);
          categorizedCount++;
        }
      });
      
      if (addedCount > 0 || categorizedCount > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(existing));
        if (addedCount > 0) {
          console.log(`✅ Initialized ${addedCount} components from template_design_system.html`);
        }
        if (categorizedCount > 0) {
          console.log(`✅ Categorized ${categorizedCount} existing components`);
        }
      }
      
      this.initialized = true;
    } catch (error) {
      // Don't log as error - component initialization failures shouldn't block the app
      console.warn('⚠️ Could not initialize some default components (this is non-critical):', error);
      // Fallback: ensure at least Header component exists
      this.initializeFallbackHeader();
      this.initialized = true;
    }
  }

  /**
   * Fallback: Initialize Header component if design system parsing fails
   */
  private initializeFallbackHeader(): void {
    try {
      const existing = this.getAllComponents();
      const hasHeader = existing.some(c => c.id === 'header');
      
      if (!hasHeader) {
        const headerComponent: ComponentData = {
          id: 'header',
          name: 'Header',
          html: `<!-- Component start Header -->
<tr>
  <td align="center" style="padding: 30px 20px; background-color: #ffffff; border-radius: 12px 12px 0 0;">
    <!--[if mso | IE]><br /><![endif]-->
    <img data-element="header-logo" src="https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING" alt="Company Logo" width="180" height="60" style="display: block; width: 180px; height: 60px; margin: 0 auto 20px; border: 0;" />
    <!--[if mso | IE]><br /><![endif]-->
    <h1 data-element="header-title" style="margin: 0 0 10px 0; color: #1e293b; font-size: 28px; font-weight: 700; line-height: 34px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Complete Your Checkout</h1>
    <p data-element="header-subhead" style="margin: 0; color: #64748b; font-size: 16px; line-height: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Secure payment • Fast checkout • SSL protected</p>
  </td>
</tr>
<!-- Component end Header -->`,
          elements: [
            {
              id: 'header_logo',
              type: 'image',
              selector: 'img[data-element="header-logo"]',
              label: 'Header Logo',
              defaultValue: 'https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING',
              value: 'https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING',
              visible: true,
              properties: {
                url: 'https://via.placeholder.com/180x60/1e40af/ffffff?text=SHOPPING',
                alt: 'Company Logo',
                width: 180,
                height: 60
              }
            },
            {
              id: 'header_title',
              type: 'heading',
              selector: 'h1[data-element="header-title"]',
              label: 'Header Title',
              defaultValue: 'Complete Your Checkout',
              value: 'Complete Your Checkout',
              visible: true,
              properties: {
                paddingBottom: 0
              }
            },
            {
              id: 'header_subhead',
              type: 'text',
              selector: 'p[data-element="header-subhead"]',
              label: 'Header Subhead',
              defaultValue: 'Secure payment • Fast checkout • SSL protected',
              value: 'Secure payment • Fast checkout • SSL protected',
              visible: true,
              properties: {
                paddingTop: 0
              }
            }
          ],
          status: 'live',
          category: 'navigation',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        existing.push(headerComponent);
        localStorage.setItem(this.storageKey, JSON.stringify(existing));
        console.log('✅ Fallback Header component initialized');
      }
    } catch (error) {
      console.error('Error initializing fallback header:', error);
    }
  }

  /**
   * Get all components
   */
  getAllComponents(): ComponentData[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading components:', error);
      return [];
    }
  }

  /**
   * Get only live components
   */
  getLiveComponents(): ComponentData[] {
    return this.getAllComponents().filter(component => component.status === 'live');
  }

  /**
   * Get component by ID
   */
  getComponentById(id: string): ComponentData | null {
    const components = this.getAllComponents();
    return components.find(c => c.id === id) || null;
  }

  /**
   * Get component by name
   */
  getComponentByName(name: string): ComponentData | null {
    const components = this.getAllComponents();
    return components.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Check if component name is unique
   */
  isComponentNameUnique(name: string, excludeId?: string): boolean {
    const components = this.getAllComponents();
    const trimmedName = name.trim();
    const existingComponent = components.find(c => 
      c.name.toLowerCase() === trimmedName.toLowerCase() && 
      (excludeId ? c.id !== excludeId : true)
    );
    return !existingComponent;
  }

  /**
   * Save component
   */
  saveComponent(component: ComponentData): void {
    try {
      const components = this.getAllComponents();
      const existingIndex = components.findIndex(c => c.id === component.id);
      
      if (existingIndex >= 0) {
        // Update existing
        components[existingIndex] = {
          ...component,
          createdAt: components[existingIndex].createdAt, // Preserve original creation date
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Add new
        components.push({
          ...component,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(components));
    } catch (error) {
      console.error('Error saving component:', error);
      throw error;
    }
  }

  /**
   * Delete component
   */
  deleteComponent(id: string): void {
    try {
      const components = this.getAllComponents();
      const filtered = components.filter(c => c.id !== id);
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting component:', error);
      throw error;
    }
  }

  /**
   * Update component status
   */
  updateComponentStatus(id: string, status: 'draft' | 'live'): void {
    try {
      const components = this.getAllComponents();
      const component = components.find(c => c.id === id);
      if (component) {
        component.status = status;
        component.updatedAt = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(components));
      }
    } catch (error) {
      console.error('Error updating component status:', error);
      throw error;
    }
  }

  /**
   * Export component as JSON
   */
  exportComponent(id: string): string | null {
    const component = this.getComponentById(id);
    return component ? JSON.stringify(component, null, 2) : null;
  }

  /**
   * Extract components from a template
   * Converts template sections and their elements into reusable components
   */
  extractComponentsFromTemplate(template: any, templateName: string): ComponentData[] {
    const extractedComponents: ComponentData[] = [];
    
    if (!template) {
      console.warn('Template is null or undefined');
      return extractedComponents;
    }
    
    if (!template.sections || template.sections.length === 0) {
      console.warn('Template missing sections:', template.meta?.templateName || templateName);
      return extractedComponents;
    }
    
    if (!template.html) {
      console.warn('Template missing HTML:', template.meta?.templateName || templateName);
      return extractedComponents;
    }

    console.log(`Extracting components from template: ${template.meta?.templateName || templateName}`);
    console.log(`Template has ${template.sections.length} sections`);

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(template.html, 'text/html');
      
      template.sections.forEach((section: any, index: number) => {
        console.log(`Processing section ${index + 1}: ${section.name}`);
        try {
          // Find section HTML by looking for component markers
          const sectionName = section.name;
          const startMarker = `<!-- Component start ${sectionName} -->`;
          const endMarker = `<!-- Component end ${sectionName} -->`;
          
          const htmlContent = template.html;
          const startIndex = htmlContent.indexOf(startMarker);
          const endIndex = htmlContent.indexOf(endMarker);
          
          console.log(`Section "${sectionName}": startIndex=${startIndex}, endIndex=${endIndex}`);
          
          if (startIndex === -1 || endIndex === -1) {
            console.warn(`Could not find section markers for: ${sectionName}`);
            console.warn(`Looking for: "${startMarker}" and "${endMarker}"`);
            // Try to find any component markers in the HTML
            const allMarkers = htmlContent.match(/<!-- Component (start|end) [^>]+ -->/g);
            if (allMarkers) {
              console.log('Found component markers in HTML:', allMarkers.slice(0, 5));
            }
            return;
          }
          
          // Extract section HTML
          let sectionHtml = htmlContent.substring(
            startIndex + startMarker.length,
            endIndex
          ).trim();
          
          if (!sectionHtml) {
            console.warn(`Section ${sectionName} has no HTML content`);
            return;
          }
          
          // Update data-element attributes in the HTML to use component prefix
          const componentPrefix = sectionName.toLowerCase().replace(/\s+/g, '_');
          const sectionDoc = parser.parseFromString(sectionHtml, 'text/html');
          const allDataElements = Array.from(sectionDoc.querySelectorAll('[data-element]'));
          
          allDataElements.forEach((node) => {
            const currentDataElement = node.getAttribute('data-element');
            if (currentDataElement) {
              // Extract base name (last part after dash)
              const baseName = currentDataElement.includes('-') 
                ? currentDataElement.split('-').slice(-1)[0]
                : currentDataElement;
              // Set new data-element with component prefix
              const newDataElement = `${componentPrefix}-${baseName}`;
              node.setAttribute('data-element', newDataElement);
            }
          });
          
          // Get updated HTML
          sectionHtml = sectionDoc.body.innerHTML;
          
          // Wrap in comment markers for component identification
          const componentDisplayName = sectionName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          sectionHtml = `<!-- Component start ${componentDisplayName} -->\n${sectionHtml}\n<!-- Component end ${componentDisplayName} -->`;
          
          // Get elements for this section
          const sectionElements = template.elements.filter((el: any) => 
            section.elements && section.elements.includes(el.id)
          );
          
          // Track used element IDs within this component to ensure uniqueness
          const usedElementIds = new Set<string>();
          
          // Convert template elements to component elements
          const componentElements: ComponentElement[] = sectionElements.map((templateEl: any, elIndex: number) => {
            // Update selector to use component prefix
            let selector = templateEl.selector;
            if (selector) {
              // Try to extract data-element from selector
              const dataElementMatch = selector.match(/data-element=["']([^"']+)["']/);
              if (dataElementMatch) {
                const dataElementValue = dataElementMatch[1];
                // Create new data-element with component prefix
                // If data-element already has a prefix, keep just the base name
                const baseDataElement = dataElementValue.includes('-') 
                  ? dataElementValue.split('-').slice(-1)[0] // Get last part after last dash
                  : dataElementValue;
                const newDataElement = `${componentPrefix}-${baseDataElement}`;
                selector = selector.replace(
                  /data-element=["'][^"']+["']/,
                  `data-element="${newDataElement}"`
                );
              } else {
                // If no data-element in selector, try to add one based on element ID
                const elementBaseName = templateEl.id.split('_').slice(-1)[0];
                const newDataElement = `${componentPrefix}-${elementBaseName}`;
                // Try to add data-element to selector if it's a simple tag selector
                if (selector.match(/^[a-z]+(\[|$)/)) {
                  selector = `${selector}[data-element="${newDataElement}"]`;
                }
              }
            }
            
            // Create component element ID with component prefix
            // Ensure uniqueness by checking if ID already exists
            let elementBaseId = templateEl.id.includes('_') 
              ? templateEl.id.split('_').slice(-1)[0] 
              : templateEl.id;
            
            let componentElementId = `${componentPrefix}_${elementBaseId}`;
            
            // If ID already used, append index to make it unique
            if (usedElementIds.has(componentElementId)) {
              componentElementId = `${componentPrefix}_${elementBaseId}_${elIndex}`;
            }
            
            // If still not unique, keep incrementing
            let counter = 0;
            while (usedElementIds.has(componentElementId)) {
              counter++;
              componentElementId = `${componentPrefix}_${elementBaseId}_${counter}`;
            }
            
            usedElementIds.add(componentElementId);
            
            return {
              id: componentElementId,
              type: templateEl.type,
              selector: selector || templateEl.selector,
              label: templateEl.label,
              defaultValue: templateEl.defaultValue || '',
              value: templateEl.value || templateEl.defaultValue || '',
              visible: templateEl.visible !== false,
              properties: templateEl.properties ? { ...templateEl.properties } : undefined,
            };
          });
          
          // Create component name from section name
          const componentName = sectionName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          const componentId = componentName.toLowerCase().replace(/\s+/g, '_');
          
          // Determine category based on section name
          const getCategory = (name: string): string => {
            const nameLower = name.toLowerCase();
            if (nameLower.includes('header') || nameLower.includes('navigation')) return 'navigation';
            if (nameLower.includes('footer')) return 'footer';
            if (nameLower.includes('cta') || nameLower.includes('button') || nameLower.includes('call')) return 'cta';
            if (nameLower.includes('product') || nameLower.includes('order') || nameLower.includes('checkout') || nameLower.includes('cart')) return 'ecommerce';
            if (nameLower.includes('hero') || nameLower.includes('feature') || nameLower.includes('notification') || nameLower.includes('bullet') || nameLower.includes('icon') || nameLower.includes('metric')) return 'content';
            return 'layout';
          };
          
          const component: ComponentData = {
            id: componentId,
            name: componentName,
            html: sectionHtml,
            elements: componentElements,
            status: 'live',
            category: getCategory(componentName),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          extractedComponents.push(component);
        } catch (error) {
          console.error(`Error extracting component from section ${section.name}:`, error);
        }
      });
      
      return extractedComponents;
    } catch (error) {
      console.error('Error extracting components from template:', error);
      return extractedComponents;
    }
  }

  /**
   * Import component from JSON
   */
  importComponent(jsonString: string): void {
    try {
      const component: ComponentData = JSON.parse(jsonString);
      this.saveComponent(component);
    } catch (error) {
      console.error('Error importing component:', error);
      throw error;
    }
  }
}

export const componentLibraryService = new ComponentLibraryService();
export default componentLibraryService;

