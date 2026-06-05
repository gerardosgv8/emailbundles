import { templateService, DynamicTemplate, TemplateSection, TemplateElement } from '../services/templateService';

export interface SectionComponent {
  id: string;
  name: string;
  html: string;
  elements: TemplateElement[];
  category: string;
  sourceTemplate: string;
}

/**
 * Extract HTML for a specific section from template HTML
 * Uses comment markers (<!-- Component start X --> / <!-- Component end X -->) if available,
 * otherwise falls back to element-based extraction
 */
function extractSectionHtml(templateHtml: string, section: TemplateSection, allElements: TemplateElement[]): string {
  if (!templateHtml || !section.elements || section.elements.length === 0) {
    return '';
  }

  try {
    // First, try to extract using comment markers (most reliable)
    const sectionNameForComment = section.name.replace(/\s+/g, ' ');
    
    // Try multiple variations of comment markers (case-insensitive matching)
    const markerVariations = [
      { start: `<!-- Component start ${sectionNameForComment} -->`, end: `<!-- Component end ${sectionNameForComment} -->` },
      { start: `<!-- Component Start ${sectionNameForComment} -->`, end: `<!-- Component End ${sectionNameForComment} -->` },
      { start: `<!-- Component START ${sectionNameForComment} -->`, end: `<!-- Component END ${sectionNameForComment} -->` },
      { start: `<!-- Component start ${section.id} -->`, end: `<!-- Component end ${section.id} -->` },
      { start: `<!-- Component Start ${section.id} -->`, end: `<!-- Component End ${section.id} -->` },
    ];
    
    for (const markers of markerVariations) {
      const startIndex = templateHtml.indexOf(markers.start);
      const endIndex = templateHtml.indexOf(markers.end);
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Extract HTML between markers
        const startPos = startIndex + markers.start.length;
        const endPos = endIndex;
        let extractedHtml = templateHtml.substring(startPos, endPos).trim();
        
        // Clean up: remove any leading/trailing whitespace and ensure we have valid HTML
        extractedHtml = extractedHtml.replace(/^\s+|\s+$/g, '');
        
        // CRITICAL: Validate that we didn't accidentally include other components
        // Check if extracted HTML contains other component start/end markers
        const otherStartMarkers = extractedHtml.match(/<!--\s*Component\s+(?:start|Start|START)\s+[^-]+-->/g);
        const otherEndMarkers = extractedHtml.match(/<!--\s*Component\s+(?:end|End|END)\s+[^-]+-->/g);
        
        if (otherStartMarkers && otherStartMarkers.length > 0) {
          console.warn(`⚠ Extracted HTML for "${section.name}" contains ${otherStartMarkers.length} other component start marker(s). Trimming to first boundary.`);
          // Find the position of the first other component marker
          const firstOtherMarker = extractedHtml.search(/<!--\s*Component\s+(?:start|Start|START)\s+/);
          if (firstOtherMarker > 0) {
            extractedHtml = extractedHtml.substring(0, firstOtherMarker).trim();
            console.log(`✓ Trimmed extracted HTML to exclude other components (now ${extractedHtml.length} chars)`);
          }
        }
        
        // Also check for end markers that don't match our section
        if (otherEndMarkers && otherEndMarkers.length > 0) {
          // If we have end markers, we might have included content after our end marker
          // This shouldn't happen, but let's be safe
          console.warn(`⚠ Extracted HTML for "${section.name}" contains ${otherEndMarkers.length} other component end marker(s).`);
        }
        
        if (extractedHtml) {
          console.log(`✓ Extracted section "${section.name}" using comment markers (${extractedHtml.length} chars)`);
          return extractedHtml;
        }
      }
    }

    // Fallback: Element-based extraction (find elements and their containers)
    console.log(`⚠ No comment markers found for "${section.name}", using element-based extraction`);
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateHtml, 'text/html');
    
    // Find all elements that belong to this section
    const sectionNodes: Element[] = [];
    
    section.elements.forEach(elementId => {
      // Convert element ID to data-element format (e.g., "header_title" -> "header-title")
      const dataElementValue = elementId.replace(/_/g, '-');
      
      // Try to find by data-element attribute
      const nodes = Array.from(doc.querySelectorAll(`[data-element="${dataElementValue}"]`));
      if (nodes.length > 0) {
        sectionNodes.push(...nodes);
      } else {
        // Fallback: find element by matching it in the elements array
        const element = allElements.find(el => el.id === elementId);
        if (element && element.selector) {
          try {
            const found = Array.from(doc.querySelectorAll(element.selector));
            sectionNodes.push(...found);
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
    });

    if (sectionNodes.length === 0) {
      console.warn(`No nodes found for section ${section.name} (${section.id})`);
      return '';
    }

    // Find the common parent container (prefer <tr> for email structure)
    // IMPORTANT: Only find the immediate parent <tr> that contains ALL section elements
    // This prevents grabbing too much HTML
    let commonParent: Element | null = null;
    
    if (sectionNodes.length === 1) {
      // Single node - get its parent <tr> or container
      let node = sectionNodes[0];
      while (node && node.tagName !== 'TR' && node.tagName !== 'TBODY' && node.tagName !== 'TABLE' && node.tagName !== 'HTML') {
        const parent = node.parentElement;
        if (!parent || parent.tagName === 'HTML' || parent.tagName === 'BODY') break;
        node = parent;
      }
      commonParent = node && node.tagName === 'TR' ? node : sectionNodes[0].closest('tr');
    } else {
      // Multiple nodes - find the closest <tr> that contains ALL nodes
      // Start from the first node and walk up to find a <tr> that contains all
      let candidate: Element | null = sectionNodes[0];
      while (candidate) {
        if (candidate.tagName === 'TR') {
          // Check if this <tr> contains all section nodes
          if (sectionNodes.every(node => candidate!.contains(node) || candidate === node)) {
            commonParent = candidate;
            break;
          }
        }
        if (candidate.tagName === 'TBODY' || candidate.tagName === 'TABLE' || candidate.tagName === 'HTML' || candidate.tagName === 'BODY') {
          break;
        }
        candidate = candidate.parentElement;
      }
      
      // If we didn't find a <tr>, find the common ancestor but limit depth
      if (!commonParent) {
        const paths: Element[][] = [];
        sectionNodes.forEach(node => {
          const path: Element[] = [];
          let current: Element | null = node;
          let depth = 0;
          while (current && depth < 10) { // Limit depth to prevent going too far up
            path.unshift(current);
            current = current.parentElement as Element | null;
            depth++;
          }
          paths.push(path);
        });

        // Find common ancestor, but prefer <tr> elements
        if (paths.length > 0) {
          const firstPath = paths[0];
          for (let i = 0; i < firstPath.length; i++) {
            const candidate = firstPath[i];
            if (paths.every(path => path.includes(candidate))) {
              // Prefer <tr> elements
              if (candidate.tagName === 'TR') {
                commonParent = candidate;
                break;
              } else if (!commonParent) {
                commonParent = candidate;
              }
            }
          }
        }
      }
    }

    if (!commonParent) {
      console.warn(`Could not find container for section ${section.name}`);
      return '';
    }

    // Only return the immediate <tr> if we found one, don't go further up
    if (commonParent.tagName === 'TR') {
      return commonParent.outerHTML;
    }

    // If not a <tr>, try to find the closest <tr> parent
    const trParent = commonParent.closest('tr');
    if (trParent) {
      return trParent.outerHTML;
    }

    // Last resort: return the common parent's HTML, but limit it
    return commonParent.innerHTML;
  } catch (error) {
    console.error(`Error extracting HTML for section ${section.name}:`, error);
    return '';
  }
}

/**
 * Extract all sections from a template as components
 */
export async function extractSectionsFromTemplate(templateId: string): Promise<SectionComponent[]> {
  try {
    const template = await templateService.getTemplate(templateId);
    if (!template || !template.sections || template.sections.length === 0) {
      console.log(`Template ${templateId} has no sections`);
      return [];
    }

    const sectionComponents: SectionComponent[] = [];

    for (const section of template.sections) {
      if (!section.visible) continue;

      // Extract HTML for this section
      const sectionHtml = extractSectionHtml(template.html, section, template.elements);

      if (!sectionHtml || sectionHtml.trim() === '') {
        console.warn(`Section ${section.name} (${section.id}) has no HTML`);
        continue;
      }

      // Get elements that belong to this section
      const sectionElements = template.elements.filter(el => 
        section.elements.includes(el.id)
      );

      sectionComponents.push({
        id: `section_${templateId}_${section.id}`,
        name: section.name,
        html: sectionHtml,
        elements: sectionElements,
        category: template.meta.category || 'template',
        sourceTemplate: template.meta.templateName || templateId,
      });
    }

    console.log(`Extracted ${sectionComponents.length} sections from template ${templateId}`);
    return sectionComponents;
  } catch (error) {
    console.error(`Error extracting sections from template ${templateId}:`, error);
    return [];
  }
}

/**
 * Extract sections from all available templates
 */
export async function extractAllTemplateSections(): Promise<SectionComponent[]> {
  try {
    const templateList = await templateService.getTemplateList();
    const allSections: SectionComponent[] = [];

    for (const template of templateList) {
      const sections = await extractSectionsFromTemplate(template.id);
      allSections.push(...sections);
    }

    console.log(`Extracted ${allSections.length} total sections from ${templateList.length} templates`);
    return allSections;
  } catch (error) {
    console.error('Error extracting all template sections:', error);
    return [];
  }
}

