import React, { useEffect, useRef, memo } from 'react';
import type { DynamicTemplate, TemplateElement } from '../../services/templateService';

interface InteractiveEmailPreviewProps {
  template: DynamicTemplate;
  previewHtml: string;
  selectedElement: TemplateElement | null;
  onSelectElement: (element: TemplateElement) => void;
  onCommitValue: (elementId: string, value: string) => void;
  isPreviewMode?: boolean;
  refreshTrigger?: number;
  // Used by the in-app Light/Dark preview toggle (not email-client based).
  previewTheme?: 'auto' | 'light' | 'dark';
}

const EDITABLE_TYPES: TemplateElement['type'][] = ['text', 'heading', 'link', 'button'];

/** Used when repositioning block / inline-block CTAs (text-align on the anchor does not move the box). */
function parseMarginTopFromInlineStyle(styleStr: string): string {
  if (!styleStr) return '0';
  const rules = styleStr.split(';').map((s) => s.trim()).filter(Boolean);
  for (const rule of rules) {
    const idx = rule.indexOf(':');
    if (idx === -1) continue;
    const prop = rule.slice(0, idx).trim().toLowerCase();
    const val = rule
      .slice(idx + 1)
      .trim()
      .replace(/\s*!important\s*$/i, '');
    if (prop === 'margin-top') return val || '0';
  }
  for (const rule of rules) {
    const idx = rule.indexOf(':');
    if (idx === -1) continue;
    const prop = rule.slice(0, idx).trim().toLowerCase();
    if (prop !== 'margin') continue;
    const val = rule
      .slice(idx + 1)
      .trim()
      .replace(/\s*!important\s*$/i, '');
    const parts = val.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    if (parts.length >= 2) return parts[0];
  }
  return '0';
}

function isCtaBoxElement(element: TemplateElement, props: Record<string, unknown>): boolean {
  if (element.type === 'button') return true;
  const hasButtonVisualProps =
    Boolean(props.backgroundColor || props.borderColor || props.borderWidth) ||
    Boolean(
      (props.padding &&
        parseFloat(String(props.padding).replace(/px|em|rem|%/g, '').split(/\s+/)[0]) > 0) ||
      (props.paddingTop && parseFloat(String(props.paddingTop).replace(/px|em|rem|%/g, '')) > 0) ||
      (props.paddingBottom && parseFloat(String(props.paddingBottom).replace(/px|em|rem|%/g, '')) > 0) ||
      (props.paddingLeft && parseFloat(String(props.paddingLeft).replace(/px|em|rem|%/g, '')) > 0) ||
      (props.paddingRight && parseFloat(String(props.paddingRight).replace(/px|em|rem|%/g, '')) > 0)
    );
  const isFooterLink = Boolean(
    element.id?.toLowerCase().includes('footer_link') ||
      element.id?.toLowerCase().includes('footer-link') ||
      (element.id?.toLowerCase().includes('footer') && element.type === 'link')
  );
  return element.type === 'link' && hasButtonVisualProps && !isFooterLink;
}

/**
 * Apply textAlign from the current template so the live canvas matches exported HTML.
 * Runs after each preview injection so alignment stays correct even when memo/debounced
 * previewHtml briefly lags behind `template.elements`.
 */
function applyLiveTextAlignFromElement(container: HTMLElement, element: TemplateElement): void {
  if (!element?.properties?.textAlign || element.visible === false) {
    return;
  }
  const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
  if (!dataElementMatch) return;

  const dataElementValue = dataElementMatch[1];
  let nodes: HTMLElement[] = [];
  try {
    nodes = Array.from(
      container.querySelectorAll(element.selector || `[data-element="${dataElementValue}"]`)
    ) as HTMLElement[];
  } catch {
    nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
  }

  const props = element.properties || {};
  const align = String(props.textAlign);
  const ctaBox = isCtaBoxElement(element, props as Record<string, unknown>);

  nodes.forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (ctaBox && tag === 'td') {
      node.style.setProperty('text-align', align, 'important');
    } else if (ctaBox && tag === 'a') {
      const marginTop = parseMarginTopFromInlineStyle(node.getAttribute('style') || '');
      node.style.setProperty('display', 'block', 'important');
      node.style.setProperty('width', 'fit-content', 'important');
      node.style.setProperty('max-width', '100%', 'important');
      node.style.setProperty('text-align', 'center', 'important');
      if (align === 'left') {
        node.style.setProperty('margin', `${marginTop} auto 0 0`, 'important');
      } else if (align === 'right') {
        node.style.setProperty('margin', `${marginTop} 0 0 auto`, 'important');
      } else {
        node.style.setProperty('margin', `${marginTop} auto 0 auto`, 'important');
      }
    } else {
      node.style.setProperty('text-align', align, 'important');
    }
  });
}

const InteractiveEmailPreview: React.FC<InteractiveEmailPreviewProps> = memo(({
  template,
  previewHtml,
  selectedElement,
  onSelectElement,
  onCommitValue,
  isPreviewMode = false,
  refreshTrigger = 0,
  previewTheme = 'auto',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parserRef = useRef<DOMParser | null>(null);

  if (!parserRef.current) {
    parserRef.current = new DOMParser();
  }

  // Keep the theme attribute in sync so CSS overrides can react instantly
  // without regenerating the preview HTML.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!previewTheme || previewTheme === 'auto') {
      container.removeAttribute('data-preview-theme');
    } else {
      container.setAttribute('data-preview-theme', previewTheme);
    }
  }, [previewTheme]);

  /**
   * Helper to find matching nodes for a template element within a document.
   */
  const findNodesForElement = (doc: Document, element: TemplateElement): Element[] => {
    const selector = element.selector;
    if (!selector) {
      return [];
    }

    const nodes: Element[] = [];

    const tryQuerySelector = () => {
      try {
        const found = Array.from(doc.querySelectorAll(selector));
        if (found.length) {
          nodes.push(...found);
        }
      } catch {
        // Ignore invalid selector errors (e.g., pseudo :contains)
      }
    };

    const tryContainsSelector = () => {
      const containsMatch = selector.match(/^(.*):contains\(['"](.+)['"]\)$/i);
      if (!containsMatch) {
        return;
      }

      const baseSelector = containsMatch[1] || '*';
      const textContent = containsMatch[2].trim();
      let candidates: Element[] = [];

      try {
        candidates = Array.from(doc.querySelectorAll(baseSelector));
      } catch {
        candidates = Array.from(doc.querySelectorAll('*'));
      }

      candidates.forEach(candidate => {
        if (candidate.textContent && candidate.textContent.trim().includes(textContent)) {
          nodes.push(candidate);
        }
      });
    };

    const tryDefaultValueSearch = () => {
      const searchValue = (element.value || element.defaultValue || '').trim();
      if (!searchValue) {
        return;
      }
      const allNodes = Array.from(doc.querySelectorAll('*'));
      allNodes.forEach(node => {
        const text = node.textContent?.trim();
        if (text === searchValue) {
          nodes.push(node);
        }
      });
    };

    const tryImageFallback = () => {
      if (element.type !== 'image') {
        return;
      }
      const url = element.properties?.url || element.value || element.defaultValue;
      const alt = element.properties?.alt;
      const allImages = Array.from(doc.querySelectorAll('img'));
      allImages.forEach(img => {
        if (url && img.getAttribute('src') === url) {
          nodes.push(img);
        } else if (alt && img.getAttribute('alt') === alt) {
          nodes.push(img);
        }
      });
    };

    const tryDataElementFallback = () => {
      // Try to extract data-element value from selector and find directly
      const dataElementMatch = selector.match(/data-element=["']([^"']+)["']/);
      if (dataElementMatch) {
        const dataElementValue = dataElementMatch[1];
        // Try exact match first
        let found = Array.from(doc.querySelectorAll(`[data-element="${dataElementValue}"]`));
        
        // If not found, try case-insensitive search
        if (found.length === 0) {
          const allElements = Array.from(doc.querySelectorAll('*'));
          found = allElements.filter(el => {
            const attrValue = el.getAttribute('data-element');
            return attrValue && attrValue.toLowerCase() === dataElementValue.toLowerCase();
          });
        }
        
        if (found.length) {
          nodes.push(...found);
        }
      }
    };

    // For price elements, prioritize data-element search
    const isPriceElement = element.id?.includes('price') || element.label?.toLowerCase().includes('price');
    
    if (isPriceElement) {
      // Try data-element fallback first for price elements
      tryDataElementFallback();
      if (!nodes.length) {
    tryQuerySelector();
      }
    } else {
    tryQuerySelector();
    }
    
    if (!nodes.length) {
      tryContainsSelector();
    }
    if (!nodes.length && !isPriceElement) {
      tryDataElementFallback();
    }
    if (!nodes.length) {
      tryImageFallback();
    }
    if (!nodes.length) {
      tryDefaultValueSearch();
    }

    return nodes;
  };

  /**
   * Enhance the preview HTML by tagging editable regions so we can attach interactions.
   */
  useEffect(() => {
    
    const container = containerRef.current;
    if (!container || !previewHtml || !template || !template.elements || !Array.isArray(template.elements)) {
      return;
    }

    const parser = parserRef.current!;
    
    // Clean conditional comments - remove the comment markers but keep the content
    // Outlook conditional comments: <!--[if !mso]> -->content<!--<![endif]-->
    // We want to keep the content but remove the comment markers for better parsing
    let cleanedHtml = previewHtml
      // Replace ©YYYY placeholder with current year in footer copyright
      .replace(/©YYYY/g, '©' + new Date().getFullYear())
      // Remove opening conditional comment markers (keep content)
      .replace(/<!--\[if\s+!mso\]>\s*-->/gi, '')
      // Remove closing conditional comment markers
      .replace(/<!--<!\[endif\]-->/gi, '')
      // Remove entire MSO-only blocks (content we don't want)
      .replace(/<!--\[if\s+mso\]>[\s\S]*?<!\[endif\]-->/gi, '');
    
    const doc = parser.parseFromString(cleanedHtml, 'text/html');

    // Desktop preview renders only `doc.body.innerHTML`, so styles in `doc.head` wouldn't apply.
    // We only extract the toggle-specific CSS (scoped via `data-preview-theme`) and inject it into the
    // canvas, avoiding the full prefers-color-scheme @media blocks.
    const TOGGLE_STYLE_MARKER = 'In-app preview toggle overrides';
    const toggleStyleText = Array.from(doc.head?.querySelectorAll('style') ?? [])
      .map((s) => s.textContent || '')
      .filter((t) => t.includes(TOGGLE_STYLE_MARKER))
      .map((t) => t.slice(t.indexOf(TOGGLE_STYLE_MARKER)))
      .join('\n');
    
    // Debug: Check if price elements exist in parsed DOM
    const priceSpans = Array.from(doc.querySelectorAll('span[data-element*="price"]'));
    
    // First pass: Tag all elements with data-element-id in the parsed doc
    // We do this BEFORE setting innerHTML so we can preserve the attributes
    const assignedNodes = new WeakSet<Element>();
    const elementAttributeMap = new Map<string, { elementId: string; elementType: string }>();

    template.elements.forEach(element => {
      if (!element || !element.id) {
        return; // Skip invalid elements
      }
      const targets = findNodesForElement(doc, element);
      
      // Debug logging for price elements
      const isPriceElement = (element.id && element.id.includes('price')) || (element.label && element.label.toLowerCase().includes('price'));
      if (isPriceElement) {
        if (targets.length === 0) {
                    // Try one more time with a direct data-element search
          const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
          if (dataElementMatch) {
            const dataElementValue = dataElementMatch[1];
            const directSearch = Array.from(doc.querySelectorAll(`[data-element="${dataElementValue}"]`));
            if (directSearch.length > 0) {
                            targets.push(...directSearch);
            }
          }
        } else {
                  }
      }
      
      targets.forEach(node => {
        if (assignedNodes.has(node)) {
          return;
        }
        assignedNodes.add(node);

        // Store the mapping so we can apply it after innerHTML is set
        const dataElementAttr = node.getAttribute('data-element');
        if (dataElementAttr) {
          elementAttributeMap.set(dataElementAttr, {
            elementId: element.id,
            elementType: element.type
          });
        }

        // Set attributes in the doc (these will be preserved in innerHTML)
        node.setAttribute('data-element-id', element.id);
        node.setAttribute('data-element-type', element.type);

        if (!isPreviewMode && EDITABLE_TYPES.includes(element.type)) {
          node.setAttribute('contenteditable', 'true');
          node.setAttribute('spellcheck', 'false');
        }
      });
    });

    // Apply body-level styling to container so email styles remain consistent
    const bodyStyle = doc.body.getAttribute('style');
    if (bodyStyle) {
      container.setAttribute('style', bodyStyle);
        } else {
      container.removeAttribute('style');
    }

    container.innerHTML = doc.body.innerHTML;

    // CRITICAL: Now that innerHTML is set, we work with the ACTUAL DOM nodes in the container
    
    if (toggleStyleText) {
      // Remove previously injected toggle styles to prevent duplicates on refresh.
      container.querySelectorAll('style[data-preview-theme-toggle="true"]').forEach((el) => el.remove());

      const styleEl = container.ownerDocument.createElement('style');
      styleEl.setAttribute('data-preview-theme-toggle', 'true');
      styleEl.textContent = toggleStyleText;
      container.appendChild(styleEl);
    }
    
    // Apply width: 100% to order-details-total-wrapper element immediately after HTML is set
    const orderDetailsWrapper = container.querySelector('[data-element="order-details-total-wrapper"]') as HTMLElement;
    if (orderDetailsWrapper) {
      const currentStyle = orderDetailsWrapper.getAttribute('style') || '';
      if (!currentStyle.includes('width: 100%') && !currentStyle.includes('width:100%')) {
        const separator = currentStyle.trim() && !currentStyle.trim().endsWith(';') ? '; ' : ' ';
        orderDetailsWrapper.setAttribute('style', currentStyle + separator + 'width: 100%');
      }
    }
    
    // Apply visibility styles based on element.visible property
    // This ensures that hidden elements are actually hidden in the preview
    if (!template.elements || !Array.isArray(template.elements)) {
      return;
    }
    
    template.elements.forEach(element => {
      if (!element || !element.id) {
        return; // Skip invalid elements
      }
      const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
      if (dataElementMatch) {
        const dataElementValue = dataElementMatch[1];
        const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
        
        // DEBUG: Log if element is not found (especially for price elements)
        if (nodes.length === 0 && element.id && (element.id.includes('price') || element.id.includes('mso'))) {
                  }
        
        nodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          
          // Check if this is a price element
          const isPriceElement = 
            (element.id && element.id.includes('price')) || 
            (element.id && element.id.includes('subtotal')) || 
            (element.id && element.id.includes('shipping')) || 
            (element.id && element.id.includes('tax')) || 
            (element.id && element.id.includes('total')) ||
            (element.label && element.label.toLowerCase().includes('price')) ||
            (element.label && element.label.toLowerCase().includes('subtotal')) ||
            (element.label && element.label.toLowerCase().includes('shipping')) ||
            (element.label && element.label.toLowerCase().includes('tax')) ||
            (element.label && element.label.toLowerCase().includes('total'));
          
          if (element.visible === false) {
            // Hide the element
            node.style.setProperty('display', 'none', 'important');
            
            // Special handling for footer links: hide adjacent separator cells by ID
            if (element.id && (element.id.includes('footer_link_unsubscribe') || element.id.includes('footer-link-unsubscribe'))) {
              const separator = container.querySelector('#link_4_separator') as HTMLElement | null;
              if (separator) {
                separator.style.setProperty('display', 'none', 'important');
              }
            } else if (element.id && (element.id.includes('footer_link_help') || element.id.includes('footer-link-help'))) {
              const separator = container.querySelector('#link_3_separator') as HTMLElement | null;
              if (separator) {
                separator.style.setProperty('display', 'none', 'important');
              }
            } else if (element.id && (element.id.includes('footer_link_terms') || element.id.includes('footer-link-terms'))) {
              const separator = container.querySelector('#link_2_separator') as HTMLElement | null;
              if (separator) {
                separator.style.setProperty('display', 'none', 'important');
              }
            }
            
            // Special handling for Products Grid prices: also hide the parent table
            if (isPriceElement && element.id && (element.id.includes('products_grid') || element.id.includes('product_grid'))) {
              const parentTable = node.closest('table');
              if (parentTable && parentTable instanceof HTMLElement) {
                const containsPriceSpan = parentTable.querySelector('span[data-element*="price"]');
                if (containsPriceSpan === node) {
                  parentTable.style.setProperty('display', 'none', 'important');
                }
              }
              
              // Also hide the corresponding MSO version
              const msoDataElement = dataElementValue.endsWith('-mso') 
                ? dataElementValue.replace(/-mso$/, '')
                : dataElementValue + '-mso';
              const msoElement = container.querySelector(`span[data-element="${msoDataElement}"]`) as HTMLElement | null;
              if (msoElement) {
                msoElement.style.setProperty('display', 'none', 'important');
                const msoParentTable = msoElement.closest('table');
                if (msoParentTable && msoParentTable instanceof HTMLElement) {
                  msoParentTable.style.setProperty('display', 'none', 'important');
                }
              }
            }
            
            // Special handling for Single Product MSO prices
            // If this is a Single Product MSO price element, also hide/show the corresponding non-MSO version
            if (isPriceElement && element.id && element.id.includes('single_product') && dataElementValue.includes('-mso-')) {
              // This is an MSO version (e.g., single-product-regular-price-mso-1)
              // Find the corresponding non-MSO version (e.g., single-product-regular-price)
              const nonMsoDataElement = dataElementValue.replace(/-mso-\d+$/, '').replace(/-mso$/, '');
              const nonMsoElement = container.querySelector(`span[data-element="${nonMsoDataElement}"]`) as HTMLElement | null;
              if (nonMsoElement) {
                nonMsoElement.style.setProperty('display', 'none', 'important');
                const nonMsoParentTable = nonMsoElement.closest('table');
                if (nonMsoParentTable && nonMsoParentTable instanceof HTMLElement) {
                  nonMsoParentTable.style.setProperty('display', 'none', 'important');
                }
              }
            } else if (isPriceElement && element.id && element.id.includes('single_product') && !dataElementValue.includes('-mso-')) {
              // This is a non-MSO Single Product price (e.g., single-product-regular-price)
              // Find the corresponding MSO version (e.g., single-product-regular-price-mso-1)
              const msoDataElement = dataElementValue + '-mso-1';
              const msoElement = container.querySelector(`span[data-element="${msoDataElement}"]`) as HTMLElement | null;
              if (msoElement) {
                msoElement.style.setProperty('display', 'none', 'important');
                const msoParentTable = msoElement.closest('table');
                if (msoParentTable && msoParentTable instanceof HTMLElement) {
                  msoParentTable.style.setProperty('display', 'none', 'important');
                }
              }
            }
          } else {
            // Show the element
            node.style.removeProperty('display');
            
            // Special handling for footer links: show adjacent separator cells by ID
            if (element.id && (element.id.includes('footer_link_unsubscribe') || element.id.includes('footer-link-unsubscribe'))) {
              const separator = container.querySelector('#link_4_separator') as HTMLElement | null;
              if (separator) {
                separator.style.removeProperty('display');
              }
            } else if (element.id && (element.id.includes('footer_link_help') || element.id.includes('footer-link-help'))) {
              const separator = container.querySelector('#link_3_separator') as HTMLElement | null;
              if (separator) {
                separator.style.removeProperty('display');
              }
            } else if (element.id && (element.id.includes('footer_link_terms') || element.id.includes('footer-link-terms'))) {
              const separator = container.querySelector('#link_2_separator') as HTMLElement | null;
              if (separator) {
                separator.style.removeProperty('display');
              }
            }
            
            // Special handling for Products Grid prices: also show the parent table
            if (isPriceElement && element.id && (element.id.includes('products_grid') || element.id.includes('product_grid'))) {
              const parentTable = node.closest('table');
              if (parentTable && parentTable instanceof HTMLElement) {
                const containsPriceSpan = parentTable.querySelector('span[data-element*="price"]');
                if (containsPriceSpan === node) {
                  parentTable.style.removeProperty('display');
                }
              }
              
              // Also show the corresponding MSO version
              const msoDataElement = dataElementValue.endsWith('-mso') 
                ? dataElementValue.replace(/-mso$/, '')
                : dataElementValue + '-mso';
              const msoElement = container.querySelector(`span[data-element="${msoDataElement}"]`) as HTMLElement | null;
              if (msoElement) {
                msoElement.style.removeProperty('display');
                const msoParentTable = msoElement.closest('table');
                if (msoParentTable && msoParentTable instanceof HTMLElement) {
                  msoParentTable.style.removeProperty('display');
                }
              }
            }
            
            // Special handling for Single Product MSO prices
            // If this is a Single Product MSO price element, also show the corresponding non-MSO version
            if (isPriceElement && element.id && element.id.includes('single_product') && dataElementValue.includes('-mso-')) {
              // This is an MSO version (e.g., single-product-regular-price-mso-1)
              // Find the corresponding non-MSO version (e.g., single-product-regular-price)
              const nonMsoDataElement = dataElementValue.replace(/-mso-\d+$/, '').replace(/-mso$/, '');
              const nonMsoElement = container.querySelector(`span[data-element="${nonMsoDataElement}"]`) as HTMLElement | null;
              if (nonMsoElement) {
                nonMsoElement.style.removeProperty('display');
                const nonMsoParentTable = nonMsoElement.closest('table');
                if (nonMsoParentTable && nonMsoParentTable instanceof HTMLElement) {
                  nonMsoParentTable.style.removeProperty('display');
                }
              }
            } else if (isPriceElement && element.id && element.id.includes('single_product') && !dataElementValue.includes('-mso-')) {
              // This is a non-MSO Single Product price (e.g., single-product-regular-price)
              // Find the corresponding MSO version (e.g., single-product-regular-price-mso-1)
              const msoDataElement = dataElementValue + '-mso-1';
              const msoElement = container.querySelector(`span[data-element="${msoDataElement}"]`) as HTMLElement | null;
              if (msoElement) {
                msoElement.style.removeProperty('display');
                const msoParentTable = msoElement.closest('table');
                if (msoParentTable && msoParentTable instanceof HTMLElement) {
                  msoParentTable.style.removeProperty('display');
                }
              }
            }
          }
        });
      }
    });
    
    // Handle step row visibility: hide parent <tr> if all three step elements (number, title, description) are hidden
    for (let stepNum = 1; stepNum <= 3; stepNum++) {
      const stepNumberElement = template.elements.find(e => e.id === `text_step_${stepNum}_number`);
      const stepTitleElement = template.elements.find(e => e.id === `heading_sub_${stepNum}`);
      const stepDescriptionElement = template.elements.find(e => e.id === `text_step_${stepNum}_description`);
      
      // Check if all three elements exist and are hidden
      const allHidden = stepNumberElement && stepTitleElement && stepDescriptionElement &&
        stepNumberElement.visible === false &&
        stepTitleElement.visible === false &&
        stepDescriptionElement.visible === false;
      
      // Find all three step elements in the DOM
      const stepNumberNode = container.querySelector(`[data-element="step-${stepNum}-number"]`) as HTMLElement | null;
      const stepTitleNode = container.querySelector(`[data-element="step-${stepNum}-title"]`) as HTMLElement | null;
      const stepDescriptionNode = container.querySelector(`[data-element="step-${stepNum}-description"]`) as HTMLElement | null;
      
      // Find the common parent <tr> that contains all three elements
      // We need to find the <tr> that is a direct child of the steps table (not nested table rows)
      let parentTr: HTMLElement | null = null;
      
      if (stepNumberNode) {
        // Start from the step number node and walk up to find the correct parent <tr>
        // The correct <tr> is the one that contains both the step number and step title/description
        let current: Element | null = stepNumberNode;
        while (current && current !== container) {
          if (current.tagName === 'TR') {
            // Check if this <tr> also contains the step title or description
            // If it does, this is the correct parent <tr>
            const containsTitle = stepTitleNode && current.contains(stepTitleNode);
            const containsDescription = stepDescriptionNode && current.contains(stepDescriptionNode);
            if (containsTitle || containsDescription) {
              parentTr = current as HTMLElement;
              break;
            }
          }
          current = current.parentElement;
        }
        
        // Fallback: if we didn't find it by checking for title/description,
        // find the outermost <tr> that contains the step number
        if (!parentTr) {
          let current: Element | null = stepNumberNode;
          let outermostTr: HTMLElement | null = null;
          while (current && current !== container) {
            if (current.tagName === 'TR') {
              outermostTr = current as HTMLElement;
            }
            current = current.parentElement;
          }
          parentTr = outermostTr;
        }
      }
      
      if (parentTr) {
        if (allHidden) {
          // Hide the parent <tr> if all three elements are hidden
          parentTr.style.setProperty('display', 'none', 'important');
        } else {
          // If any element is visible, make sure the parent <tr> is visible
          parentTr.style.removeProperty('display');
        }
      }
    }
    
    // Handle icon row visibility: hide parent <tr> if all three icon elements (emoji, heading, text) are hidden
    for (let iconNum = 1; iconNum <= 5; iconNum++) {
      const iconEmojiElement = template.elements.find(e => e.id === `icon_${iconNum}_emoji`);
      const iconHeadingElement = template.elements.find(e => e.id === `icon_${iconNum}_heading`);
      const iconTextElement = template.elements.find(e => e.id === `icon_${iconNum}_text`);
      
      // Check if all three elements exist and are hidden
      const allHidden = iconEmojiElement && iconHeadingElement && iconTextElement &&
        iconEmojiElement.visible === false &&
        iconHeadingElement.visible === false &&
        iconTextElement.visible === false;
      
      // Find all three icon elements in the DOM
      const iconEmojiNode = container.querySelector(`[data-element="icon-${iconNum}-emoji"]`) as HTMLElement | null;
      const iconHeadingNode = container.querySelector(`[data-element="icon-${iconNum}-heading"]`) as HTMLElement | null;
      const iconTextNode = container.querySelector(`[data-element="icon-${iconNum}-text"]`) as HTMLElement | null;
      
      // Find the common parent <tr> that contains all three elements
      let parentTr: HTMLElement | null = null;
      
      if (iconEmojiNode) {
        // Start from the icon emoji node and walk up to find the correct parent <tr>
        // The correct <tr> is the one that contains both the emoji and heading/text
        let current: Element | null = iconEmojiNode;
        while (current && current !== container) {
          if (current.tagName === 'TR') {
            // Check if this <tr> also contains the icon heading or text
            // If it does, this is the correct parent <tr>
            const containsHeading = iconHeadingNode && current.contains(iconHeadingNode);
            const containsText = iconTextNode && current.contains(iconTextNode);
            if (containsHeading || containsText) {
              parentTr = current as HTMLElement;
              break;
            }
          }
          current = current.parentElement;
        }
        
        // Fallback: if we didn't find it by checking for heading/text,
        // find the outermost <tr> that contains the icon emoji
        if (!parentTr) {
          let current: Element | null = iconEmojiNode;
          let outermostTr: HTMLElement | null = null;
          while (current && current !== container) {
            if (current.tagName === 'TR') {
              outermostTr = current as HTMLElement;
            }
            current = current.parentElement;
          }
          parentTr = outermostTr;
        }
      }
      
      if (parentTr) {
        if (allHidden) {
          // Hide the parent <tr> if all three elements are hidden
          parentTr.style.setProperty('display', 'none', 'important');
        } else {
          // If any element is visible, make sure the parent <tr> is visible
          parentTr.style.removeProperty('display');
        }
      }
    }
    
    // Handle event info card row visibility: hide parent <tr> if all three elements (icon, heading, value) are hidden
    // This applies to Event Invitation template event info cards
    const eventInfoCards = [
      { iconId: 'img_event_date_icon', headingId: 'heading_event_date', valueId: 'text_event_date', iconDataElement: 'event-date-icon', headingDataElement: 'event-date-heading', valueDataElement: 'event-date-value' },
      { iconId: 'img_event_location_icon', headingId: 'heading_event_location', valueId: 'text_event_location', iconDataElement: 'event-location-icon', headingDataElement: 'event-location-heading', valueDataElement: 'event-location-value' },
      { iconId: 'img_event_attendees_icon', headingId: 'heading_event_attendees', valueId: 'text_event_attendees', iconDataElement: 'event-attendees-icon', headingDataElement: 'event-attendees-heading', valueDataElement: 'event-attendees-value' }
    ];
    
    eventInfoCards.forEach(card => {
      const iconElement = template.elements.find(e => e.id === card.iconId);
      const headingElement = template.elements.find(e => e.id === card.headingId);
      const valueElement = template.elements.find(e => e.id === card.valueId);
      
      // Check if all three elements exist and are hidden
      const allHidden = iconElement && headingElement && valueElement &&
        iconElement.visible === false &&
        headingElement.visible === false &&
        valueElement.visible === false;
      
      // Find all three elements in the DOM
      const iconNode = container.querySelector(`[data-element="${card.iconDataElement}"]`) as HTMLElement | null;
      const headingNode = container.querySelector(`[data-element="${card.headingDataElement}"]`) as HTMLElement | null;
      const valueNode = container.querySelector(`[data-element="${card.valueDataElement}"]`) as HTMLElement | null;
      
      // Find the common parent <tr> that contains all three elements
      let parentTr: HTMLElement | null = null;
      
      if (iconNode) {
        // Start from the icon node and walk up to find the correct parent <tr>
        // The correct <tr> is the one that contains both the icon and heading/value
        let current: Element | null = iconNode;
        while (current && current !== container) {
          if (current.tagName === 'TR') {
            // Check if this <tr> also contains the heading or value
            // If it does, this is the correct parent <tr>
            const containsHeading = headingNode && current.contains(headingNode);
            const containsValue = valueNode && current.contains(valueNode);
            if (containsHeading || containsValue) {
              parentTr = current as HTMLElement;
              break;
            }
          }
          current = current.parentElement;
        }
        
        // Fallback: if we didn't find it by checking for heading/value,
        // find the outermost <tr> that contains the icon
        if (!parentTr) {
          let current: Element | null = iconNode;
          let outermostTr: HTMLElement | null = null;
          while (current && current !== container) {
            if (current.tagName === 'TR') {
              outermostTr = current as HTMLElement;
            }
            current = current.parentElement;
          }
          parentTr = outermostTr;
        }
      }
      
      if (parentTr) {
        if (allHidden) {
          // Hide the parent <tr> if all three elements are hidden
          parentTr.style.setProperty('display', 'none', 'important');
        } else {
          // If any element is visible, make sure the parent <tr> is visible
          parentTr.style.removeProperty('display');
        }
      }
    });
    
    // Handle section visibility at component level
    // Hide all <tr> elements that contain elements from hidden sections
    if (template.sections && Array.isArray(template.sections)) {
      template.sections.forEach(section => {
        if (section.visible === false && section.elements && Array.isArray(section.elements)) {
          // Find all elements that belong to this section
          const sectionElementIds = section.elements;
          const sectionElements: HTMLElement[] = [];
          
          sectionElementIds.forEach(elementId => {
            const element = template.elements.find(e => e.id === elementId);
            if (element) {
              const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
              if (dataElementMatch) {
                const dataElementValue = dataElementMatch[1];
                const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
                sectionElements.push(...nodes);
              }
            }
          });
          
          // Special handling for Footer: Apply display: none to <td> with specific styles
          if (section.id === 'footer' || section.name === 'Footer' || section.name?.toLowerCase() === 'footer') {
            // Find <td> elements with padding: 40px 20px 30px 20px; background-color: #ffffff; border-radius: 0 0 12px 12px;
            const footerTds = Array.from(container.querySelectorAll('td')) as HTMLElement[];
            footerTds.forEach(td => {
              const style = td.getAttribute('style') || '';
              if (style.includes('padding: 40px 20px 30px 20px') || 
                  style.includes('padding:40px 20px 30px 20px') ||
                  (style.includes('padding') && style.includes('40px') && style.includes('20px') && style.includes('30px'))) {
                if (style.includes('background-color: #ffffff') || style.includes('background-color:#ffffff')) {
                  if (style.includes('border-radius: 0 0 12px 12px') || 
                      style.includes('border-radius: 0 0 8px 8px') ||
                      style.includes('border-radius:0 0 12px 12px') ||
                      style.includes('border-radius:0 0 8px 8px')) {
                    td.style.setProperty('display', 'none', 'important');
                  }
                }
              }
            });
          }
          
          // Find all unique parent <tr> elements that contain these section elements
          const parentTrs = new Set<HTMLElement>();
          sectionElements.forEach(el => {
            let current: Element | null = el;
            while (current && current !== container) {
              if (current.tagName === 'TR') {
                parentTrs.add(current as HTMLElement);
                break;
              }
              current = current.parentElement;
            }
          });
          
          // For components with multiple <tr> elements (like Hero Block), we need to find
          // all <tr> elements that are siblings in the main email table structure
          // Find the outermost table (main email container)
          let mainTable: HTMLTableElement | null = null;
          if (sectionElements.length > 0) {
            const firstElement = sectionElements[0];
            let current: Element | null = firstElement;
            while (current && current !== container) {
              if (current.tagName === 'TABLE' && current.getAttribute('role') === 'presentation' && 
                  (current.getAttribute('width') === '100%' || current.getAttribute('width') === '600')) {
                // This is likely the main email table
                mainTable = current as HTMLTableElement;
                break;
              }
              current = current.parentElement;
            }
          }
          
          // If we found the main table, find all <tr> elements that contain section elements
          // and hide all <tr> elements between the first and last one (inclusive)
          if (mainTable && parentTrs.size > 0) {
            try {
              // Use valid CSS selectors: find tr in tbody and direct tr children of table
              const tbodyTrs = Array.from(mainTable.querySelectorAll('tbody > tr')) as HTMLElement[];
              const directTrs = Array.from(mainTable.children).filter(
                child => child.tagName === 'TR'
              ) as HTMLElement[];
              const allTrs = [...tbodyTrs, ...directTrs];
              const trsWithElements: HTMLElement[] = [];
              
              allTrs.forEach(tr => {
                if (tr && sectionElements.length > 0) {
                  const containsSectionElement = sectionElements.some(se => se && tr.contains(se));
                  if (containsSectionElement) {
                    trsWithElements.push(tr);
                  }
                }
              });
              
              // Find the first and last <tr> indices in the main table
              if (trsWithElements.length > 0 && allTrs.length > 0) {
                const firstIndex = allTrs.indexOf(trsWithElements[0]);
                const lastIndex = allTrs.indexOf(trsWithElements[trsWithElements.length - 1]);
                
                // Only proceed if indices are valid
                if (firstIndex >= 0 && lastIndex >= 0 && firstIndex <= lastIndex) {
                  // Hide all <tr> elements from first to last (inclusive) to catch any spacers
                  for (let i = firstIndex; i <= lastIndex; i++) {
                    if (allTrs[i] && allTrs[i].style) {
                      allTrs[i].style.setProperty('display', 'none', 'important');
                    }
                  }
                }
              }
            } catch (error) {
                            // Fallback: hide the specific <tr> elements we found
              parentTrs.forEach(tr => {
                if (tr && tr.style) {
                  tr.style.setProperty('display', 'none', 'important');
                }
              });
            }
          } else {
            // Fallback: hide the specific <tr> elements we found
            parentTrs.forEach(tr => {
              if (tr && tr.style) {
                tr.style.setProperty('display', 'none', 'important');
              }
            });
          }
        } else if (section.visible === true && section.elements && Array.isArray(section.elements)) {
          // Show all <tr> elements when section is visible
          const sectionElementIds = section.elements;
          const sectionElements: HTMLElement[] = [];
          
          sectionElementIds.forEach(elementId => {
            const element = template.elements.find(e => e.id === elementId);
            if (element) {
              const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
              if (dataElementMatch) {
                const dataElementValue = dataElementMatch[1];
                const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
                sectionElements.push(...nodes);
              }
            }
          });
          
          // Find all unique parent <tr> elements that contain these section elements
          const parentTrs = new Set<HTMLElement>();
          sectionElements.forEach(el => {
            let current: Element | null = el;
            while (current && current !== container) {
              if (current.tagName === 'TR') {
                parentTrs.add(current as HTMLElement);
                break;
              }
              current = current.parentElement;
            }
          });
          
          // Find the main email table
          let mainTable: HTMLTableElement | null = null;
          if (sectionElements.length > 0) {
            const firstElement = sectionElements[0];
            let current: Element | null = firstElement;
            while (current && current !== container) {
              if (current.tagName === 'TABLE' && current.getAttribute('role') === 'presentation' && 
                  (current.getAttribute('width') === '100%' || current.getAttribute('width') === '600')) {
                mainTable = current as HTMLTableElement;
                break;
              }
              current = current.parentElement;
            }
          }
          
          // Show all <tr> elements in the component
          if (mainTable && parentTrs.size > 0) {
            try {
              // Use valid CSS selectors: find tr in tbody and direct tr children of table
              const tbodyTrs = Array.from(mainTable.querySelectorAll('tbody > tr')) as HTMLElement[];
              const directTrs = Array.from(mainTable.children).filter(
                child => child.tagName === 'TR'
              ) as HTMLElement[];
              const allTrs = [...tbodyTrs, ...directTrs];
              const trsWithElements: HTMLElement[] = [];
              allTrs.forEach(tr => {
                if (tr && sectionElements.length > 0) {
                  const containsSectionElement = sectionElements.some(se => se && tr.contains(se));
                  if (containsSectionElement) {
                    trsWithElements.push(tr);
                  }
                }
              });
              
              if (trsWithElements.length > 0 && allTrs.length > 0) {
                const firstIndex = allTrs.indexOf(trsWithElements[0]);
                const lastIndex = allTrs.indexOf(trsWithElements[trsWithElements.length - 1]);
                
                // Only proceed if indices are valid
                if (firstIndex >= 0 && lastIndex >= 0 && firstIndex <= lastIndex) {
                  for (let i = firstIndex; i <= lastIndex; i++) {
                    if (allTrs[i] && allTrs[i].style) {
                      allTrs[i].style.removeProperty('display');
                    }
                  }
                }
              }
            } catch (error) {
                            // Fallback: show the specific <tr> elements we found
              parentTrs.forEach(tr => {
                if (tr && tr.style) {
                  tr.style.removeProperty('display');
                }
              });
            }
          } else {
            parentTrs.forEach(tr => {
              if (tr && tr.style) {
                tr.style.removeProperty('display');
              }
            });
          }
        }
      });
      
      // Special handling for Text Block: it has data-element="text-block" on the <tr>
      const textBlockSection = template.sections.find(section => 
        section.id === 'text_block' || section.name === 'Text Block'
      );
      
      if (textBlockSection) {
        const textBlockTr = container.querySelector('tr[data-element="text-block"]') as HTMLElement | null;
        
        if (textBlockTr) {
          if (textBlockSection.visible === false) {
            // Hide the entire <tr> when section is not visible
            textBlockTr.style.setProperty('display', 'none', 'important');
            
            // Also hide the <td> with padding: 40px 30px; background-color: #ffffff;
            const tdWithStyles = textBlockTr.querySelector('td[style*="padding: 40px 30px"], td[style*="padding:40px 30px"]') as HTMLElement | null;
            if (tdWithStyles && tdWithStyles.getAttribute('style')?.includes('background-color: #ffffff')) {
              tdWithStyles.style.setProperty('display', 'none', 'important');
            }
          } else {
            // Show the <tr> when section is visible
            textBlockTr.style.removeProperty('display');
            
            // Also show the <td> with padding: 40px 30px; background-color: #ffffff;
            const tdWithStyles = textBlockTr.querySelector('td[style*="padding: 40px 30px"], td[style*="padding:40px 30px"]') as HTMLElement | null;
            if (tdWithStyles && tdWithStyles.getAttribute('style')?.includes('background-color: #ffffff')) {
              tdWithStyles.style.removeProperty('display');
            }
          }
        }
      }
      
      // Special handling for Dual CTA: it has data-element="dual-cta" on the <tr>
      const dualCtaSection = template.sections.find(section => 
        section.id === 'dual_cta' || section.id === 'checkout_cta' || 
        section.name === 'Dual CTA' || section.name === 'Checkout CTA'
      );
      
      if (dualCtaSection) {
        const dualCtaTr = container.querySelector('tr[data-element="dual-cta"]') as HTMLElement | null;
        
        if (dualCtaTr) {
          if (dualCtaSection.visible === false) {
            // Hide the entire <tr> when section is not visible
            dualCtaTr.style.setProperty('display', 'none', 'important');
            
            // Also hide the <td> with padding: 30px 20px; background-color: #ffffff;
            const tdWithStyles = dualCtaTr.querySelector('td[style*="padding: 30px 20px"], td[style*="padding:30px 20px"]') as HTMLElement | null;
            if (tdWithStyles && tdWithStyles.getAttribute('style')?.includes('background-color: #ffffff')) {
              tdWithStyles.style.setProperty('display', 'none', 'important');
            }
          } else {
            // Show the <tr> when section is visible
            dualCtaTr.style.removeProperty('display');
            
            // Also show the <td> with padding: 30px 20px; background-color: #ffffff;
            const tdWithStyles = dualCtaTr.querySelector('td[style*="padding: 30px 20px"], td[style*="padding:30px 20px"]') as HTMLElement | null;
            if (tdWithStyles && tdWithStyles.getAttribute('style')?.includes('background-color: #ffffff')) {
              tdWithStyles.style.removeProperty('display');
            }
          }
        }
      }
      
      // For all hidden sections, also hide the <td> with specific padding and background-color: #ffffff;
      // Supports both padding: 40px 30px (Text Block) and padding: 30px 20px (Dual CTA)
      template.sections.forEach(section => {
        if (section.visible === false && section.elements && Array.isArray(section.elements) && section.elements.length > 0) {
          // Find elements that belong to this section
          const sectionElementIds = section.elements;
          const foundTds = new Set<HTMLElement>();
          
          sectionElementIds.forEach(elementId => {
            const element = template.elements.find(e => e.id === elementId);
            if (element) {
              const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
              if (dataElementMatch) {
                const dataElementValue = dataElementMatch[1];
                const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
                
                // Find the <td> with the specific styles that contains these elements
                nodes.forEach(node => {
                  let current: Element | null = node;
                  while (current && current !== container) {
                    if (current.tagName === 'TD') {
                      const td = current as HTMLElement;
                      const style = td.getAttribute('style') || '';
                      // Check for padding: 40px 30px (Text Block) or padding: 30px 20px (Dual CTA)
                      // and background-color: #ffffff
                      const hasPadding40x30 = style.includes('padding: 40px 30px') || style.includes('padding:40px 30px');
                      const hasPadding30x20 = style.includes('padding: 30px 20px') || style.includes('padding:30px 20px');
                      const hasWhiteBg = style.includes('background-color: #ffffff');
                      
                      if ((hasPadding40x30 || hasPadding30x20) && hasWhiteBg) {
                        foundTds.add(td);
                        break;
                      }
                    }
                    current = current.parentElement;
                  }
                });
              }
            }
          });
          
          // Hide all found <td> elements
          foundTds.forEach(td => {
            td.style.setProperty('display', 'none', 'important');
          });
        } else if (section.visible === true && section.elements && Array.isArray(section.elements) && section.elements.length > 0) {
          // Show the <td> when section is visible
          const sectionElementIds = section.elements;
          const foundTds = new Set<HTMLElement>();
          
          sectionElementIds.forEach(elementId => {
            const element = template.elements.find(e => e.id === elementId);
            if (element) {
              const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
              if (dataElementMatch) {
                const dataElementValue = dataElementMatch[1];
                const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
                
                // Find the <td> with the specific styles that contains these elements
                nodes.forEach(node => {
                  let current: Element | null = node;
                  while (current && current !== container) {
                    if (current.tagName === 'TD') {
                      const td = current as HTMLElement;
                      const style = td.getAttribute('style') || '';
                      // Check for padding: 40px 30px (Text Block) or padding: 30px 20px (Dual CTA)
                      // and background-color: #ffffff
                      const hasPadding40x30 = style.includes('padding: 40px 30px') || style.includes('padding:40px 30px');
                      const hasPadding30x20 = style.includes('padding: 30px 20px') || style.includes('padding:30px 20px');
                      const hasWhiteBg = style.includes('background-color: #ffffff');
                      
                      if ((hasPadding40x30 || hasPadding30x20) && hasWhiteBg) {
                        foundTds.add(td);
                        break;
                      }
                    }
                    current = current.parentElement;
                  }
                });
              }
            }
          });
          
          // Show all found <td> elements
          foundTds.forEach(td => {
            td.style.removeProperty('display');
          });
        }
      });
    }
    
    // DEBUG: Check if Products Grid price elements exist in the container
    const debugPriceElements = Array.from(container.querySelectorAll('[data-element*="product-grid-"][data-element*="-price"], [data-element*="product-"][data-element*="-price"]'));
        
    // STEP 1: Tag ALL elements by their data-element attribute
    if (!template.elements || !Array.isArray(template.elements)) {
      return;
    }
    
    template.elements.forEach(element => {
      if (!element || !element.id) {
        return; // Skip invalid elements
      }
      const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
      if (dataElementMatch) {
        const dataElementValue = dataElementMatch[1];
        const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
        
        nodes.forEach(node => {
          if (!node.hasAttribute('data-element-id')) {
            node.setAttribute('data-element-id', element.id);
            node.setAttribute('data-element-type', element.type);
          }
        });
      }
    });
    
    // STEP 2: Process ALL editable elements and make them clickable
    template.elements.forEach(element => {
      if (!element || !element.id) {
        return; // Skip invalid elements
      }
      if (!isPreviewMode && EDITABLE_TYPES.includes(element.type)) {
        // Find by data-element-id
        const nodes = Array.from(container.querySelectorAll(`[data-element-id="${element.id}"]`)) as HTMLElement[];
        
        // If not found, try by data-element attribute
        let containerNodes = nodes;
        if (containerNodes.length === 0) {
          const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
          if (dataElementMatch) {
            const dataElementValue = dataElementMatch[1];
            containerNodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
            // Tag them
            containerNodes.forEach(node => {
              node.setAttribute('data-element-id', element.id);
              node.setAttribute('data-element-type', element.type);
            });
          }
        }
        
        const isProductsGridPrice = element.id.match(/^product_grid_[1-4]_price$/) || element.id.match(/^product_[1-4]_price$/);
        const isOrderElement = element.id.match(/^order_(subtotal|shipping|tax|total)$/);
        const isPriceElement = element.id && element.id.includes('price') && element.type === 'text';
        
        if (isProductsGridPrice) {
                  }
        
        if (isOrderElement) {
                  }
        
        containerNodes.forEach(node => {
          // CRITICAL: Check if element is visible before applying editing styles
          // If element is hidden, skip applying display: inline-block which would override display: none
          if (element.visible === false) {
            return; // Skip this node - visibility logic already handled it
          }
          
          // Don't make elements editable if they have contenteditable="false"
          // This preserves the hide parameter at the <tr> level for components like Text Block
          if (node.getAttribute('contenteditable') === 'false') {
            return; // Skip - this element should not be editable (e.g., Text Block <tr>)
          }
          
          // Set contenteditable
          node.setAttribute('contenteditable', 'true');
          node.setAttribute('spellcheck', 'false');
          if (node instanceof HTMLElement) {
            node.contentEditable = 'true';
            
            // Products Grid prices and Order elements need special handling (both in tables)
            if (isProductsGridPrice || isOrderElement) {
              // Apply ALL styles with !important
              node.style.setProperty('pointer-events', 'auto', 'important');
              node.style.setProperty('cursor', 'text', 'important');
              node.style.setProperty('position', 'relative', 'important');
              node.style.setProperty('z-index', '9999', 'important');
              node.style.setProperty('display', 'inline-block', 'important');
              node.style.setProperty('outline', 'none', 'important');
              node.style.setProperty('min-width', '1px', 'important');
              node.style.setProperty('min-height', '1px', 'important');
              node.style.setProperty('background-color', 'transparent', 'important');
              
              // CRITICAL: Disable pointer events on ALL parent elements
              let current: HTMLElement | Element | null = node;
              const parentsToDisable: HTMLElement[] = [];
              
              while (current && current !== container) {
                const parent = current.parentElement;
                if (!parent) break;
                
                // Disable ALL table-related parents
                if (parent.tagName === 'TD' || parent.tagName === 'TH' || 
                    parent.tagName === 'TABLE' || parent.tagName === 'TR') {
                  if (!parent.hasAttribute('data-element-id')) {
                    parentsToDisable.push(parent as HTMLElement);
                  }
                }
                current = parent;
              }
              
              // Apply pointer-events: none to all parents
              parentsToDisable.forEach(parent => {
                parent.style.setProperty('pointer-events', 'none', 'important');
              });
              
              const elementType = isProductsGridPrice ? 'Products Grid price' : (isOrderElement ? 'Order element' : 'Table-nested element');
                          } else if (isPriceElement) {
              // Other price elements (single product, order details)
              node.style.setProperty('pointer-events', 'auto', 'important');
              node.style.setProperty('cursor', 'text', 'important');
            } else {
              // Regular text elements
              node.style.setProperty('pointer-events', 'auto', 'important');
              node.style.setProperty('cursor', 'text', 'important');
            }
          }
        });
      }
    });

    // Final pass: Add classes and verify all editable elements
    const editableNodes = Array.from(container.querySelectorAll('[data-element-id]')) as HTMLElement[];
        
    editableNodes.forEach(node => {
      node.classList.add('editable-element');
      if (isPreviewMode) {
        node.classList.add('editable-disabled');
      } else {
        node.classList.remove('editable-disabled');
      }
      
      const elementId = node.getAttribute('data-element-id');
      const elementType = node.getAttribute('data-element-type');
      const isPriceElement = elementType === 'text' && elementId && elementId.includes('price');
      const isProductGridPrice = elementId && (elementId.match(/^product_grid_[1-4]_price$/) || elementId.match(/^product_[1-4]_price$/));
      
      // Images aren't contenteditable, but they must remain clickable for selection.
      // Ensure pointer events aren't disabled by defaults/parents.
      if (!isPreviewMode && elementType === 'image') {
        node.style.setProperty('pointer-events', 'auto', 'important');
        node.style.setProperty('cursor', 'pointer', 'important');
      }

      if (isPriceElement && node instanceof HTMLElement && !isPreviewMode) {
        // Final verification for price elements
        if (!template.elements || !Array.isArray(template.elements)) {
          return; // Skip if template elements are invalid
        }
        
        const element = template.elements.find(e => e && e.id === elementId);
        
        // CRITICAL: Skip if element is hidden - don't override display: none
        if (element && element.visible === false) {
          return; // Skip - visibility already handled
        }
        
        // Skip if element not found (but don't throw error - just log)
        if (!element) {
                    return;
        }
        
        // Ensure contenteditable is definitely set
        if (node.contentEditable !== 'true') {
          node.contentEditable = 'true';
          node.setAttribute('contenteditable', 'true');
                  }
        
        // Verify styles are applied
        const computedStyle = window.getComputedStyle(node);
        if (computedStyle.pointerEvents === 'none') {
          node.style.setProperty('pointer-events', 'auto', 'important');
                  }
        
        if (computedStyle.cursor !== 'text' && computedStyle.cursor !== 'auto') {
          node.style.setProperty('cursor', 'text', 'important');
                  }
        
        // For product-grid prices, apply even more aggressive styling
        if (isProductGridPrice) {
          node.style.setProperty('pointer-events', 'auto', 'important');
          node.style.setProperty('cursor', 'text', 'important');
          node.style.setProperty('position', 'relative', 'important');
          node.style.setProperty('z-index', '999999', 'important');
          node.style.setProperty('display', 'inline-block', 'important');
                  }
        
        // Final check: ensure parent table elements have pointer-events: none
        let current: HTMLElement | Element | null = node;
        while (current && current !== container) {
          const parent = current.parentElement;
          if (!parent) break;
          if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
              && !parent.hasAttribute('data-element-id')) {
            const parentStyle = window.getComputedStyle(parent as HTMLElement);
            if (parentStyle.pointerEvents !== 'none') {
              (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
            }
          }
          current = parent;
        }
        
              } else if (!isPreviewMode && node instanceof HTMLElement) {
        // For all other editable elements
        node.style.setProperty('pointer-events', 'auto', 'important');
      }
    });
    
    // Final audit: Count all price elements
    const allPriceElements = Array.from(container.querySelectorAll('[data-element-id*="price"]')) as HTMLElement[];
        
    // Final verification pass: ensure all price elements are properly configured
    if (!isPreviewMode) {
      // First, check elements with data-element-id
      const priceElementsWithId = Array.from(container.querySelectorAll('[data-element-id*="price"]')) as HTMLElement[];
            
      // Also check elements with data-element attribute (in case they weren't tagged)
      const priceElementsWithDataAttr = Array.from(container.querySelectorAll('[data-element*="price"]')) as HTMLElement[];
            
      // Process all price elements found
      // Each price element has a unique ID, so we process them individually
      const allPriceElements = new Set([...priceElementsWithId, ...priceElementsWithDataAttr]);
      
      allPriceElements.forEach(node => {
        const elementId = node.getAttribute('data-element-id');
        const dataElementAttr = node.getAttribute('data-element');
        
        // If no element-id but has data-element, try to find matching element by exact data-element match
        if (!elementId && dataElementAttr) {
          const matchingElement = template.elements.find(el => {
            const selectorMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
            return selectorMatch && selectorMatch[1] === dataElementAttr;
          });
          
          if (matchingElement) {
            node.setAttribute('data-element-id', matchingElement.id);
            node.setAttribute('data-element-type', matchingElement.type);
                      }
        }
        
        const finalElementId = node.getAttribute('data-element-id');
        // All price elements have unique IDs, so this check is safe
        const isPriceElement = finalElementId && finalElementId.includes('price');
        const isProductGridPrice = finalElementId && (finalElementId.match(/^product_grid_[1-4]_price$/) || finalElementId.match(/^product_[1-4]_price$/));
        
        if (isPriceElement) {
          const element = template.elements.find(e => e.id === finalElementId);
          if (element && EDITABLE_TYPES.includes(element.type)) {
            // CRITICAL: Skip if element is hidden - don't override display: none
            if (element.visible === false) {
              return; // Skip - visibility already handled
            }
            
            // Ensure contenteditable is set and working
            node.setAttribute('contenteditable', 'true');
            if (node instanceof HTMLElement) {
              node.contentEditable = 'true';
              // Force it to be editable
              node.setAttribute('spellcheck', 'false');
              // Remove any attributes that might prevent editing
              node.removeAttribute('readonly');
              node.removeAttribute('disabled');
                          }
            
            // Ensure pointer events are enabled
            if (node instanceof HTMLElement) {
              const computedStyle = window.getComputedStyle(node);
              if (computedStyle.pointerEvents === 'none') {
                node.style.setProperty('pointer-events', 'auto', 'important');
                              }
              
              // Force all styling - use even higher z-index for product-grid prices
              const zIndexValue = isProductGridPrice ? '999999' : '1000';
              node.style.setProperty('cursor', 'text', 'important');
              node.style.setProperty('position', 'relative', 'important');
              node.style.setProperty('z-index', zIndexValue, 'important');
              node.style.setProperty('display', 'inline-block', 'important');
              
              // For product-grid prices, apply even more aggressive styling
              if (isProductGridPrice) {
                node.style.setProperty('pointer-events', 'auto', 'important');
                node.style.setProperty('outline', 'none', 'important');
                node.style.setProperty('min-width', '1px', 'important');
                node.style.setProperty('min-height', '1px', 'important');
                              }
              
              // Disable pointer events on all parent table elements AND ensure they're not contenteditable
              let current: HTMLElement | Element | null = node;
              while (current && current !== container) {
                const parent = current.parentElement;
                if (!parent) break;
                if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
                    && !parent.hasAttribute('data-element-id')) {
                  (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
                  
                  // CRITICAL: Remove contenteditable from parent elements
                  (parent as HTMLElement).removeAttribute('contenteditable');
                  if (parent instanceof HTMLElement) {
                    parent.contentEditable = 'false';
                  }
                }
                current = parent;
              }
            }
        }
      }
    });
      
            
      // FINAL CLEANUP: Ensure no parent table elements have contenteditable set
      // This is a safety measure to ensure only the actual price spans are editable
      const allEditableElements = container.querySelectorAll('[data-element-id][contenteditable="true"]');
      allEditableElements.forEach(editableEl => {
        if (editableEl instanceof HTMLElement) {
          let current: HTMLElement | Element | null = editableEl;
          while (current && current !== container) {
            const parent = current.parentElement;
            if (!parent) break;
            
            // If parent is a table element and doesn't have data-element-id, remove contenteditable
            if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
                && !parent.hasAttribute('data-element-id')) {
              (parent as HTMLElement).removeAttribute('contenteditable');
              if (parent instanceof HTMLElement) {
                parent.contentEditable = 'false';
              }
            }
            current = parent;
          }
        }
      });
      
      // CRITICAL FIX: Products Grid prices - SIMPLE AND DIRECT APPROACH
      // Find ALL price elements by data-element attribute and fix them directly
      // Using the same pattern as "New Products Launch" template (arrival-X-price pattern)
      const productsGridPriceDataElements = ['product-grid-1-price', 'product-grid-2-price', 'product-grid-3-price', 'product-grid-4-price'];
      const orderDataElements = ['order-subtotal', 'order-shipping', 'order-tax', 'order-total'];
      // Also support "New Products Launch" pattern for reference
      const arrivalPriceDataElements = ['arrival-1-price', 'arrival-2-price', 'arrival-3-price', 'arrival-4-price'];
      const allPriceDataElements = [...productsGridPriceDataElements, ...arrivalPriceDataElements, ...orderDataElements];
      
      allPriceDataElements.forEach(dataElementValue => {
        // Find ALL elements with this data-element (there might be multiple)
        const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
        
        if (nodes.length === 0) {
                    return;
        }
        
        // Find the matching template element
        const element = template.elements.find(e => {
          const selectorMatch = e.selector?.match(/data-element=["']([^"']+)["']/);
          return selectorMatch && selectorMatch[1] === dataElementValue;
        });
        
        if (!element) {
                    return;
        }
        
        const isProductsGrid = productsGridPriceDataElements.includes(dataElementValue);
        const elementType = isProductsGrid ? 'Products Grid price' : 'Order element';
        
                
        nodes.forEach(node => {
          // CRITICAL: Skip if element is hidden - don't override display: none
          if (element.visible === false) {
            return; // Skip - visibility already handled
          }
          
          // Tag it with the element ID
          node.setAttribute('data-element-id', element.id);
          node.setAttribute('data-element-type', element.type);
          
          // Make it editable
          node.setAttribute('contenteditable', 'true');
          node.setAttribute('spellcheck', 'false');
          
          if (node instanceof HTMLElement) {
            node.contentEditable = 'true';
            
            // REMOVE any existing pointer-events styles first, then set new ones
            node.style.removeProperty('pointer-events');
            node.style.removeProperty('cursor');
            node.style.removeProperty('position');
            node.style.removeProperty('z-index');
            node.style.removeProperty('display');
            
            // Set styles with !important using setProperty
            node.style.setProperty('pointer-events', 'auto', 'important');
            node.style.setProperty('cursor', 'text', 'important');
            node.style.setProperty('position', 'relative', 'important');
            node.style.setProperty('z-index', '999999', 'important');
            node.style.setProperty('display', 'inline-block', 'important');
            node.style.setProperty('outline', 'none', 'important');
            node.style.setProperty('min-width', '1px', 'important');
            node.style.setProperty('min-height', '1px', 'important');
            
            // CRITICAL: Disable pointer events on ALL parent table elements
            // AND ensure parent elements are NOT contenteditable
            let current: HTMLElement | Element | null = node;
            const parentsDisabled: HTMLElement[] = [];
            
            while (current && current !== container) {
              const parent = current.parentElement;
              if (!parent) break;
              
              // Disable ALL table-related parents
              if (parent.tagName === 'TD' || parent.tagName === 'TH' || 
                  parent.tagName === 'TABLE' || parent.tagName === 'TR') {
                // Only disable if it's not itself an editable element
                if (!parent.hasAttribute('data-element-id')) {
                  (parent as HTMLElement).style.removeProperty('pointer-events');
                  (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
                  
                  // CRITICAL: Remove contenteditable from parent elements
                  (parent as HTMLElement).removeAttribute('contenteditable');
                  if (parent instanceof HTMLElement) {
                    parent.contentEditable = 'false';
                  }
                  
                  parentsDisabled.push(parent as HTMLElement);
                }
              }
              current = parent;
            }
            
            // Verify it's clickable
            const computed = window.getComputedStyle(node);
            const isClickable = computed.pointerEvents === 'auto';
            const hasCorrectCursor = computed.cursor === 'text' || computed.cursor === 'auto';
            
                        
            if (!isClickable) {
              console.error(`[FIX] ERROR: ${element.id} is still NOT clickable!`, {
                computedPointerEvents: computed.pointerEvents,
                inlineStyle: node.style.pointerEvents,
                parentsCount: parentsDisabled.length
              });
        }
      }
    });
      });
      
      // ADDITIONAL AGGRESSIVE FIX: Specifically for product-grid-* price elements
      // Run this after all other processing to ensure they're definitely editable
      const productGridPriceElements = ['product-grid-1-price', 'product-grid-2-price', 'product-grid-3-price', 'product-grid-4-price'];
      productGridPriceElements.forEach(dataElementValue => {
        const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
        
        nodes.forEach(node => {
          const element = template.elements.find(e => {
            const selectorMatch = e.selector?.match(/data-element=["']([^"']+)["']/);
            return selectorMatch && selectorMatch[1] === dataElementValue;
          });
          
          // CRITICAL: Skip if element is hidden - don't override display: none
          if (element && element.visible === false) {
            return; // Skip - visibility already handled
          }
          
          if (element && node instanceof HTMLElement) {
            // Force tag it
            node.setAttribute('data-element-id', element.id);
            node.setAttribute('data-element-type', element.type);
            node.setAttribute('contenteditable', 'true');
            node.setAttribute('spellcheck', 'false');
            node.contentEditable = 'true';
            
            // Force all styles with maximum priority using cssText
            const existingStyles = node.style.cssText || '';
            // Check if this is the order-details-total-wrapper element and add width: 100%
            const isOrderDetailsTotalWrapper = node.getAttribute('data-element') === 'order-details-total-wrapper';
            const widthStyle = isOrderDetailsTotalWrapper ? ' width: 100% !important;' : '';
            node.style.cssText = existingStyles + '; pointer-events: auto !important; cursor: text !important; position: relative !important; z-index: 999999 !important; display: inline-block !important; outline: none !important; min-width: 1px !important; min-height: 1px !important;' + widthStyle;
            
            // Aggressively disable ALL parent table elements
            // AND ensure parent elements are NOT contenteditable
            let current: HTMLElement | Element | null = node;
            while (current && current !== container) {
              const parent = current.parentElement;
              if (!parent) break;
              
              if (parent.tagName === 'TD' || parent.tagName === 'TH' || 
                  parent.tagName === 'TABLE' || parent.tagName === 'TR') {
                if (!parent.hasAttribute('data-element-id')) {
                  const parentStyles = (parent as HTMLElement).style.cssText || '';
                  (parent as HTMLElement).style.cssText = parentStyles + '; pointer-events: none !important;';
                  
                  // CRITICAL: Remove contenteditable from parent elements
                  (parent as HTMLElement).removeAttribute('contenteditable');
                  if (parent instanceof HTMLElement) {
                    parent.contentEditable = 'false';
                  }
                }
              }
              current = parent;
            }
            
            // Force a reflow
            void node.offsetHeight;
            
                      }
        });
      });
      
      // FINAL FINAL CHECK: Find product-grid-* price elements by data-element and ensure they're editable
      // This is a last resort to catch any that might have been missed
      const productGridPriceDataElementsFinal = ['product-grid-1-price', 'product-grid-2-price', 'product-grid-3-price', 'product-grid-4-price'];
      productGridPriceDataElementsFinal.forEach(dataElementValue => {
        const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
        
        nodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          
          // Find the matching element
          const element = template.elements.find(e => {
            const selectorMatch = e.selector?.match(/data-element=["']([^"']+)["']/);
            return selectorMatch && selectorMatch[1] === dataElementValue;
          });
          
          // CRITICAL: Skip if element is hidden - don't override display: none
          if (element && element.visible === false) {
            return; // Skip - visibility already handled
          }
          
          if (element) {
            // Tag it if not already tagged
            if (!node.hasAttribute('data-element-id')) {
              node.setAttribute('data-element-id', element.id);
              node.setAttribute('data-element-type', element.type);
            }
            
            // Force make it editable
            node.setAttribute('contenteditable', 'true');
            node.setAttribute('spellcheck', 'false');
            node.contentEditable = 'true';
            
            // Use cssText to completely override everything
            // Check if this is the order-details-total-wrapper element and add width: 100%
            const isOrderDetailsTotalWrapper = node.getAttribute('data-element') === 'order-details-total-wrapper';
            const widthStyle = isOrderDetailsTotalWrapper ? ' width: 100% !important;' : '';
            node.style.cssText += '; pointer-events: auto !important; cursor: text !important; position: relative !important; z-index: 999999 !important; display: inline-block !important; outline: none !important; min-width: 1px !important; min-height: 1px !important;' + widthStyle;
            
            // Disable all parent table elements
            // AND ensure parent elements are NOT contenteditable
            let current: HTMLElement | Element | null = node;
            while (current && current !== container) {
              const parent = current.parentElement;
              if (!parent) break;
              if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
                  && !parent.hasAttribute('data-element-id')) {
                (parent as HTMLElement).style.cssText += '; pointer-events: none !important;';
                
                // CRITICAL: Remove contenteditable from parent elements
                (parent as HTMLElement).removeAttribute('contenteditable');
                if (parent instanceof HTMLElement) {
                  parent.contentEditable = 'false';
                }
              }
              current = parent;
            }
            
                      }
        });
      });
    }
    
    // CRITICAL: Re-apply visibility styles LAST to ensure they override any editing styles
    // This must run after all editing setup to ensure hidden elements stay hidden
    if (!template.elements || !Array.isArray(template.elements)) {
      return;
    }
    
    template.elements.forEach(element => {
      if (!element || !element.id) {
        return; // Skip invalid elements
      }
      if (element.visible === false) {
        const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
        if (dataElementMatch) {
          const dataElementValue = dataElementMatch[1];
          const nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
          
          nodes.forEach(node => {
            if (node instanceof HTMLElement) {
              // Force hide - this must be the final word
              node.style.setProperty('display', 'none', 'important');
            }
          });
        }
      }
    });

    // Align copy and CTAs from editor state last — matches generatePreviewHtml / export without relying
    // on debounced previewHtml being fresh, and is not overridden by earlier editable setup passes.
    template.elements.forEach(element => {
      if (!element?.id) return;
      applyLiveTextAlignFromElement(container, element);
    });

    return () => {
      container.innerHTML = '';
    };
  }, [previewHtml, template, isPreviewMode, refreshTrigger]);

  /**
   * Manage click/blur interactions for inline editing.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      
      // Debug logging for price elements
      // Check if this is a price element by data-element attribute (more specific than text content)
      const dataElementAttr = target.getAttribute('data-element') || target.closest('[data-element]')?.getAttribute('data-element');
      const isPriceClick = dataElementAttr?.includes('price') || target.textContent?.includes('$');
      
      if (isPriceClick) {
              }
      
      // CRITICAL: For Products Grid prices, check if we clicked directly on the price element
      // This must happen BEFORE trying to find by data-element-id
      const isProductsGridPriceByAttr = dataElementAttr?.match(/^product-grid-[1-4]-price$/) || dataElementAttr?.match(/^product-[1-4]-price$/);
      const isOrderElementByAttr = dataElementAttr?.match(/^order-(subtotal|shipping|tax|total)$/);
      
      // If we clicked directly on a product-grid price element, use it immediately
      let editableTarget: HTMLElement | null = null;
      if (isProductsGridPriceByAttr && target.hasAttribute('data-element')) {
        // Find the matching element in template
        const matchingElement = template.elements.find(el => {
          const selectorMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
          return selectorMatch && selectorMatch[1] === dataElementAttr;
        });
        
        if (matchingElement && target instanceof HTMLElement) {
          // Tag it immediately
          target.setAttribute('data-element-id', matchingElement.id);
          target.setAttribute('data-element-type', matchingElement.type);
          
          // Make it immediately editable and focusable
          target.setAttribute('contenteditable', 'true');
          target.setAttribute('spellcheck', 'false');
          target.contentEditable = 'true';
          target.tabIndex = 0;
          
          // Apply styles immediately
          target.style.setProperty('pointer-events', 'auto', 'important');
          target.style.setProperty('cursor', 'text', 'important');
          target.style.setProperty('position', 'relative', 'important');
          target.style.setProperty('z-index', '999999', 'important');
          target.style.setProperty('display', 'inline-block', 'important');
          
          // Disable parent table elements AND ensure they're not contenteditable
          let current: HTMLElement | Element | null = target;
          while (current && current !== container) {
            const parent = current.parentElement;
            if (!parent) break;
            if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
                && !parent.hasAttribute('data-element-id')) {
              (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
              
              // CRITICAL: Remove contenteditable from parent elements
              (parent as HTMLElement).removeAttribute('contenteditable');
              if (parent instanceof HTMLElement) {
                parent.contentEditable = 'false';
              }
            }
            current = parent;
          }
          
          editableTarget = target;
          
          // Prevent default and stop propagation to ensure click is handled
          event.preventDefault();
          event.stopPropagation();
          
                  }
      }
      
      // If not found above, try to find by data-element-id
      if (!editableTarget) {
        editableTarget = target.closest<HTMLElement>('[data-element-id]');
      }
      
      // SPECIAL HANDLING: If we clicked on a parent element (td, table, tr) and it contains a Products Grid price,
      // find the actual price element inside it
      if (!editableTarget && (isProductsGridPriceByAttr || isOrderElementByAttr || isPriceClick)) {
        // Check if we clicked on a parent element that contains a price
        const clickedOnParent = target.tagName === 'TD' || target.tagName === 'TABLE' || target.tagName === 'TR';
        
        if (clickedOnParent) {
          // Look for price elements inside the clicked element - prioritize product-grid-* prices
          let priceElementInside = target.querySelector<HTMLElement>('[data-element*="product-grid-"][data-element*="-price"]');
          if (!priceElementInside) {
            priceElementInside = target.querySelector<HTMLElement>('[data-element*="price"]');
          }
          
          if (priceElementInside) {
            const priceDataElement = priceElementInside.getAttribute('data-element');
            if (priceDataElement) {
              const matchingElement = template.elements.find(el => {
                const selectorMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
                return selectorMatch && selectorMatch[1] === priceDataElement;
              });
              
              if (matchingElement && priceElementInside instanceof HTMLElement) {
                priceElementInside.setAttribute('data-element-id', matchingElement.id);
                priceElementInside.setAttribute('data-element-type', matchingElement.type);
                
                // Make it immediately editable and focusable
                priceElementInside.setAttribute('contenteditable', 'true');
                priceElementInside.setAttribute('spellcheck', 'false');
                priceElementInside.contentEditable = 'true';
                priceElementInside.tabIndex = 0;
                
                // Apply styles immediately
                priceElementInside.style.setProperty('pointer-events', 'auto', 'important');
                priceElementInside.style.setProperty('cursor', 'text', 'important');
                priceElementInside.style.setProperty('position', 'relative', 'important');
                priceElementInside.style.setProperty('z-index', '999999', 'important');
                priceElementInside.style.setProperty('display', 'inline-block', 'important');
                
                editableTarget = priceElementInside;
                
                // Prevent default to ensure click is handled
                event.preventDefault();
                event.stopPropagation();
                
                              }
            }
          }
        }
      }
      
      if (!editableTarget) {
        // Try to find by data-element attribute
        const dataElementValue = target.getAttribute('data-element') || 
                                target.closest('[data-element]')?.getAttribute('data-element');
        
        if (dataElementValue) {
          // Find the element in template that matches this data-element
          const matchingElement = template.elements.find(el => {
            const selectorMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
            return selectorMatch && selectorMatch[1] === dataElementValue;
          });
          
          if (matchingElement) {
            // Set the data-element-id on the target so it can be found
            target.setAttribute('data-element-id', matchingElement.id);
            target.setAttribute('data-element-type', matchingElement.type);
            editableTarget = target;
            
            // For Products Grid prices and Order elements, also ensure it's editable immediately
            if ((isProductsGridPriceByAttr || isOrderElementByAttr) && editableTarget instanceof HTMLElement) {
              editableTarget.setAttribute('contenteditable', 'true');
              editableTarget.contentEditable = 'true';
              editableTarget.style.setProperty('pointer-events', 'auto', 'important');
              editableTarget.style.setProperty('cursor', 'text', 'important');
              
              const elementType = isProductsGridPriceByAttr ? 'Products Grid price' : 'Order element';
                          } else if (isPriceClick) {
                          }
          }
        }
      }
      
      if (!editableTarget) {
        if (isPriceClick) {
                  }
        return;
      }

      const elementId = editableTarget.dataset.elementId;
      if (!elementId) {
        return;
      }

      const element = template.elements.find(el => el.id === elementId);
      if (!element) {
        return;
      }

      // In the email HTML, images are frequently wrapped in <a href="...">.
      // Only apply this navigation-prevention when the selected element is an image.
      // For link/button elements (like the footer links), stopping propagation can interfere
      // with inline editing/focus behavior.
      if (!isPreviewMode && element.type === 'image') {
        const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
        if (anchor) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }

      // Prevent navigation for anchor-based elements
      if (editableTarget.tagName === 'A') {
        event.preventDefault();
      }

      // Stop propagation to prevent parent elements from intercepting clicks
      // CRITICAL for Products Grid prices and Order elements in nested tables
      const isProductsGridPriceElement = element.id.match(/^product_grid_[1-4]_price$/) || element.id.match(/^product_[1-4]_price$/);
      const isOrderElementById = element.id.match(/^order_(subtotal|shipping|tax|total)$/);
      if (element.type === 'text' && (target.closest('td') || (element.id && element.id.includes('price')) || isProductsGridPriceElement || isOrderElementById)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        if (isProductsGridPriceElement) {
                  } else if (isOrderElementById) {
                  }
      }

      onSelectElement(element);

      // If previous aggressive pointer-event fixes (e.g. for nested price elements)
      // left parent table cells as `pointer-events: none`, restore clickability
      // for link/button elements so footer icons remain editable.
      if (!isPreviewMode && (element.type === 'link' || element.type === 'button') && editableTarget instanceof HTMLElement) {
        let current: HTMLElement | null = editableTarget;
        while (current && current !== container) {
          if (['TD', 'TH', 'TABLE', 'TR'].includes(current.tagName)) {
            current.style.setProperty('pointer-events', 'auto', 'important');
          }
          current = current.parentElement;
        }
      }

      // Ensure image nodes are actually clickable even when parent table cells were
      // previously set to pointer-events: none during other edits.
      if (!isPreviewMode && element.type === 'image' && editableTarget instanceof HTMLElement) {
        editableTarget.style.setProperty('pointer-events', 'auto', 'important');
        editableTarget.style.setProperty('cursor', 'pointer', 'important');
        const parentCell = editableTarget.closest('td,th');
        if (parentCell instanceof HTMLElement && !parentCell.hasAttribute('data-element-id')) {
          parentCell.style.setProperty('pointer-events', 'auto', 'important');
        }
      }

      if (!isPreviewMode && EDITABLE_TYPES.includes(element.type)) {
        // Ensure the element is contenteditable before focusing
        editableTarget.setAttribute('contenteditable', 'true');
        if (editableTarget instanceof HTMLElement) {
          editableTarget.contentEditable = 'true';
        }

        // Make anchors reliably focusable for inline editing (e.g. footer links)
        if (
          editableTarget instanceof HTMLElement &&
          (element.type === 'link' || element.type === 'button') &&
          editableTarget.tagName === 'A'
        ) {
          editableTarget.setAttribute('tabindex', '0');
          editableTarget.tabIndex = 0;
          editableTarget.style.setProperty('cursor', 'pointer', 'important');
        }
        
        // For price elements and order elements, ensure they're fully editable
        // Products Grid prices and Order elements need special handling (both in tables)
        const isProductsGridPrice = element.id.match(/^product_grid_[1-4]_price$/) || element.id.match(/^product_[1-4]_price$/);
        const isOrderElement = element.id.match(/^order_(subtotal|shipping|tax|total)$/);
        const isPriceElement = element.id && element.id.includes('price');
        
        if ((isProductsGridPrice || isOrderElement) && editableTarget instanceof HTMLElement) {
          // Products Grid prices - maximum priority styling
          editableTarget.style.setProperty('pointer-events', 'auto', 'important');
          editableTarget.style.setProperty('cursor', 'text', 'important');
          editableTarget.style.setProperty('outline', '2px solid #3b82f6', 'important');
          editableTarget.style.setProperty('outline-offset', '2px', 'important');
          editableTarget.style.setProperty('background-color', 'rgba(59, 130, 246, 0.1)', 'important');
          editableTarget.style.setProperty('position', 'relative', 'important');
          editableTarget.style.setProperty('z-index', '99999', 'important');
          editableTarget.style.setProperty('display', 'inline-block', 'important');
          
          // Ensure parent elements don't block input AND are not contenteditable
          let current: HTMLElement | Element | null = editableTarget;
          while (current && current !== container) {
            const parent = current.parentElement;
            if (!parent) break;
            if (parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') {
              (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
              
              // CRITICAL: Remove contenteditable from parent elements
              (parent as HTMLElement).removeAttribute('contenteditable');
              if (parent instanceof HTMLElement) {
                parent.contentEditable = 'false';
              }
            }
            current = parent;
          }
          
          const elementType = isProductsGridPrice ? 'Products Grid price' : 'Order element';
                  } else if (isPriceElement && editableTarget instanceof HTMLElement) {
          editableTarget.style.setProperty('pointer-events', 'auto', 'important');
          editableTarget.style.setProperty('cursor', 'text', 'important');
          editableTarget.style.setProperty('outline', '2px solid #3b82f6', 'important');
          editableTarget.style.setProperty('outline-offset', '2px', 'important');
          editableTarget.style.setProperty('background-color', 'rgba(59, 130, 246, 0.1)', 'important');
          
          // Ensure parent elements don't block input AND are not contenteditable
          let current: HTMLElement | Element | null = editableTarget;
          while (current && current !== container) {
            const parent = current.parentElement;
            if (!parent) break;
            if (parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') {
              (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
              
              // CRITICAL: Remove contenteditable from parent elements
              (parent as HTMLElement).removeAttribute('contenteditable');
              if (parent instanceof HTMLElement) {
                parent.contentEditable = 'false';
              }
            }
            current = parent;
          }
        }
        
        // Use setTimeout to ensure focus happens after all styles are applied
        setTimeout(() => {
          // CRITICAL: For product-grid prices, ensure they're definitely editable before focusing
          if (isProductsGridPrice && editableTarget instanceof HTMLElement) {
            editableTarget.setAttribute('contenteditable', 'true');
            editableTarget.contentEditable = 'true';
            editableTarget.setAttribute('spellcheck', 'false');
            editableTarget.removeAttribute('readonly');
            editableTarget.removeAttribute('disabled');
            
            // Force make it focusable - contenteditable elements should be focusable, but let's be explicit
            if (editableTarget.tabIndex === -1) {
              editableTarget.tabIndex = 0;
            }
            
            // Ensure it's in the DOM and visible
            if (editableTarget.offsetParent === null) {
                          }
            
                      }
          
          // Try to focus the element - use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            try {
              if (editableTarget instanceof HTMLElement) {
                // Ensure contenteditable is still set
                editableTarget.contentEditable = 'true';
                
                // Focus the element
        editableTarget.focus({ preventScroll: true });
                
                // For price elements, also select the text content to make editing easier
                const isPriceElement = element.id && element.id.includes('price');
                if (isPriceElement) {
                  // Select all text for easy replacement
                  try {
                    const range = document.createRange();
                    range.selectNodeContents(editableTarget);
                    const selection = window.getSelection();
                    if (selection) {
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                    
                                      } catch (e) {
                                      }
                }

                // For link/button elements (footer links), select contents so typing replaces it.
                if (!isPriceElement && (element.type === 'link' || element.type === 'button')) {
                  try {
                    const range = document.createRange();
                    range.selectNodeContents(editableTarget);
                    const selection = window.getSelection();
                    if (selection) {
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  } catch {
                    // Ignore selection failures; focus still lets users type.
                  }
                }
              }
            } catch (e) {
                          }
          });
        }, 10); // Small delay to ensure DOM is ready
      }
    };

    const handleBlur = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const elementId = target.dataset.elementId;
      if (!elementId || !EDITABLE_TYPES.includes((target.dataset.elementType as TemplateElement['type']) || 'text')) {
        return;
      }

      const element = template.elements.find(el => el.id === elementId);
      if (!element) {
        return;
      }

      // For link/button elements (footer links), use `textContent` because `innerText`
      // can be inconsistent for anchor elements in some email-HTML layouts.
      const rawValue =
        element.type === 'link' || element.type === 'button'
          ? (target.textContent || '')
          : target.innerText;

      const newValue = rawValue
        .replace(/\s+/g, match => (match.includes('\n') ? '\n' : ' '))
        .trim();
      
      // Reset styling for price elements
      // All price elements have unique IDs
      const isPriceElement = elementId.includes('price');
      if (isPriceElement && target instanceof HTMLElement) {
        target.style.removeProperty('background-color');
        target.style.removeProperty('outline');
        target.style.removeProperty('outline-offset');
      }
      
      if (newValue !== element.value) {
        onCommitValue(elementId, newValue);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const elementId = target.dataset.elementId;
      if (!elementId) {
        return;
      }
      const elementType = target.dataset.elementType as TemplateElement['type'] | undefined;
      if (!EDITABLE_TYPES.includes(elementType || 'text')) {
        return;
      }

      // For price elements, allow all key input
      // All price elements have unique IDs, so this is safe
      const isPriceElement = elementId.includes('price');
      if (isPriceElement) {
        // Allow all keys except Enter (which should blur)
        if (event.key === 'Enter') {
          event.preventDefault();
          target.blur();
        }
        // Don't prevent default for other keys - allow normal typing
        return;
      }

      if (event.key === 'Enter' && elementType !== 'text') {
        event.preventDefault();
        target.blur();
      }
    };

    const handleInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const elementId = target.dataset.elementId;
      if (!elementId || !EDITABLE_TYPES.includes((target.dataset.elementType as TemplateElement['type']) || 'text')) {
        return;
      }

      // For price elements, ensure the value is being updated
      // All price elements have unique IDs
      const isPriceElement = elementId.includes('price');
      if (isPriceElement) {
        // The blur handler will commit the value, but we can add visual feedback here
        target.style.setProperty('background-color', 'rgba(59, 130, 246, 0.15)', 'important');
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const elementId = target.dataset.elementId;
      if (!elementId || !EDITABLE_TYPES.includes((target.dataset.elementType as TemplateElement['type']) || 'text')) {
        return;
      }

      // For price elements, allow paste but clean the pasted content
      // All price elements have unique IDs
      const isPriceElement = elementId.includes('price');
      if (isPriceElement) {
        event.preventDefault();
        const pastedText = event.clipboardData?.getData('text/plain') || '';
        // Remove any HTML tags and clean the text
        const cleanText = pastedText.replace(/<[^>]*>/g, '').trim();
        if (target instanceof HTMLElement) {
          target.textContent = cleanText;
          // Trigger input event
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    };

    // CRITICAL: Add capture-phase listener for Products Grid prices to intercept clicks before parent elements block them
    // Supports both master template (product-X-price) and New Products Launch (arrival-X-price) patterns
    const handleProductsGridPriceClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      
      // Check if clicked element or any parent has a Products Grid price data-element
      let priceElement: HTMLElement | null = null;
      
      // First, check if the target itself is a price element
      const targetDataElement = target.getAttribute('data-element');
      // Support patterns: product-grid-X-price (new master template), product-X-price (old), arrival-X-price (New Products Launch), and order elements
      if (targetDataElement && (targetDataElement.match(/^product-grid-[1-4]-price$/) || targetDataElement.match(/^(product|arrival)-[1-4]-price$/) || targetDataElement.match(/^order-(subtotal|shipping|tax|total)$/))) {
        priceElement = target;
      } else {
        // Check parents - look for any price element in nested tables
        priceElement = target.closest<HTMLElement>('[data-element*="-price"]') || 
                      target.closest<HTMLElement>('[data-element*="order-"]');
      }
      
      if (priceElement) {
        const dataElement = priceElement.getAttribute('data-element');
        // Support all patterns
        if (dataElement && (dataElement.match(/^product-grid-[1-4]-price$/) || dataElement.match(/^(product|arrival)-[1-4]-price$/) || dataElement.match(/^order-(subtotal|shipping|tax|total)$/))) {
          // Find the matching element in template
          const matchingElement = template.elements.find(el => {
            const selectorMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
            return selectorMatch && selectorMatch[1] === dataElement;
          });
          
          if (matchingElement && !isPreviewMode) {
            // Tag it if not already tagged
            if (!priceElement.hasAttribute('data-element-id')) {
              priceElement.setAttribute('data-element-id', matchingElement.id);
              priceElement.setAttribute('data-element-type', matchingElement.type);
            }
            
            // Ensure it's editable and clickable
            priceElement.setAttribute('contenteditable', 'true');
            if (priceElement instanceof HTMLElement) {
              priceElement.contentEditable = 'true';
              priceElement.style.setProperty('pointer-events', 'auto', 'important');
              priceElement.style.setProperty('cursor', 'text', 'important');
              priceElement.style.setProperty('position', 'relative', 'important');
              priceElement.style.setProperty('z-index', '999999', 'important');
              priceElement.style.setProperty('display', 'inline-block', 'important');
              
              // Disable pointer events on parent table elements AND ensure they're not contenteditable
              let current: HTMLElement | Element | null = priceElement;
              while (current && current !== container) {
                const parent = current.parentElement;
                if (!parent) break;
                if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
                    && !parent.hasAttribute('data-element-id')) {
                  (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
                  
                  // CRITICAL: Remove contenteditable from parent elements
                  (parent as HTMLElement).removeAttribute('contenteditable');
                  if (parent instanceof HTMLElement) {
                    parent.contentEditable = 'false';
                  }
                }
                current = parent;
              }
            }
            
            // Don't stop propagation - let the normal click handler process it
            // But log that we intercepted it
            const elementType = dataElement.includes('product-grid') ? 'Products Grid (new)' : 
                               dataElement.includes('product') ? 'Products Grid (old)' : 
                               dataElement.includes('arrival') ? 'New Products Launch' : 'Order';
                      }
        }
      }
    };

    // Add mousedown handler for product-grid prices to ensure clicks are captured
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      
      const dataElementAttr = target.getAttribute('data-element');
      const isProductGridPrice = dataElementAttr?.match(/^product-grid-[1-4]-price$/);
      
      if (isProductGridPrice) {
        // Find the matching element
        const matchingElement = template.elements.find(el => {
          const selectorMatch = el.selector?.match(/data-element=["']([^"']+)["']/);
          return selectorMatch && selectorMatch[1] === dataElementAttr;
        });
        
        if (matchingElement && target instanceof HTMLElement && !isPreviewMode) {
          // Tag it immediately
          target.setAttribute('data-element-id', matchingElement.id);
          target.setAttribute('data-element-type', matchingElement.type);
          
          // Make it editable and focusable
          target.setAttribute('contenteditable', 'true');
          target.setAttribute('spellcheck', 'false');
          target.contentEditable = 'true';
          target.tabIndex = 0;
          
          // Apply styles
          target.style.setProperty('pointer-events', 'auto', 'important');
          target.style.setProperty('cursor', 'text', 'important');
          target.style.setProperty('position', 'relative', 'important');
          target.style.setProperty('z-index', '999999', 'important');
          target.style.setProperty('display', 'inline-block', 'important');
          
          // Disable parent table elements AND ensure they're not contenteditable
          let current: HTMLElement | Element | null = target;
          while (current && current !== container) {
            const parent = current.parentElement;
            if (!parent) break;
            if ((parent.tagName === 'TD' || parent.tagName === 'TH' || parent.tagName === 'TABLE' || parent.tagName === 'TR') 
                && !parent.hasAttribute('data-element-id')) {
              (parent as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
              
              // CRITICAL: Remove contenteditable from parent elements
              (parent as HTMLElement).removeAttribute('contenteditable');
              if (parent instanceof HTMLElement) {
                parent.contentEditable = 'false';
              }
            }
            current = parent;
          }
          
                  }
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('click', handleProductsGridPriceClick, true); // Capture phase
    container.addEventListener('mousedown', handleMouseDown, true); // Capture phase for mousedown
    container.addEventListener('blur', handleBlur, true);
    container.addEventListener('keydown', handleKeyDown, true);
    container.addEventListener('input', handleInput, true);
    container.addEventListener('paste', handlePaste, true);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('click', handleProductsGridPriceClick, true);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('blur', handleBlur, true);
      container.removeEventListener('keydown', handleKeyDown, true);
      container.removeEventListener('input', handleInput, true);
      container.removeEventListener('paste', handlePaste, true);
    };
  }, [template.elements, onSelectElement, onCommitValue, isPreviewMode]);

  /**
   * Keep visual selection in sync with React state.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const editableNodes = Array.from(container.querySelectorAll('[data-element-id]')) as HTMLElement[];
    editableNodes.forEach(node => node.classList.remove('editable-selected'));

    if (!selectedElement) {
      return;
    }

    const selectedNodes = Array.from(
      container.querySelectorAll<HTMLElement>(`[data-element-id="${selectedElement.id}"]`)
    );

    selectedNodes.forEach(node => node.classList.add('editable-selected'));
  }, [selectedElement]);

  /**
   * Apply all property changes immediately to the DOM for fluid updates.
   * This runs independently of preview HTML regeneration to provide instant feedback.
   * Handles: visibility, colors, padding, font properties, borders, etc.
   *
   * TEMPORARILY DISABLED - Relying on preview HTML regeneration only
   */
  useEffect(() => {
    
    // DISABLED - Just return early
    return;

    const container = containerRef.current;
    if (!container || !template || !template.elements || !Array.isArray(template.elements)) {
      return;
    }

    template.elements.forEach(element => {
      if (!element || !element.id) {
        return; // Skip invalid elements
      }

      // Special logging for Hero Description
      if (element.id === 'text_hero_description') {
              }

      const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
      if (!dataElementMatch) return;

      const dataElementValue = dataElementMatch[1];

      // Use the full selector if available, otherwise fall back to data-element only
      // This ensures we match the correct element type (e.g., h3 vs div)
      let nodes: HTMLElement[] = [];
      try {
        // Try using the full selector first for more precise matching
        nodes = Array.from(container.querySelectorAll(element.selector || `[data-element="${dataElementValue}"]`)) as HTMLElement[];
      } catch {
        // If selector is invalid, fall back to data-element only
        nodes = Array.from(container.querySelectorAll(`[data-element="${dataElementValue}"]`)) as HTMLElement[];
      }

      // Special logging for Hero Description
      if (element.id === 'text_hero_description') {
              }

      nodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;

        // Get element properties early
        const props = element.properties || {};

        // Special logging for Hero Description
        if (element.id === 'text_hero_description') {
                  }

        // Apply visibility immediately
        if (element.visible === false) {
          node.style.setProperty('display', 'none', 'important');
        } else {
          node.style.removeProperty('display');
        }

        // Skip applying other properties if element is hidden
        if (element.visible === false) {
          return;
        }

        // For image elements, update src immediately
        if (element.type === 'image') {
          const imgNode = node instanceof HTMLImageElement ? node : (node.querySelector('img') as HTMLImageElement | null);
          
          // Check if this is a header logo
          const label = element.label?.toLowerCase() ?? '';
          const altText = (props.alt || '').toLowerCase();
          const isLogo = element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo' || label.includes('logo') || label.includes('brand') || altText.includes('logo') || altText.includes('brand');
          const isHeaderLogo = isLogo && (template?.sections?.some(section => 
            section && section.elements?.includes(element.id) && 
            (section.name?.toLowerCase().includes('header') || section.id?.toLowerCase().includes('header'))
          ) || false);
          
          // Check if image is in Hero Product section
          const isHeroProductImage = !isLogo && (template?.sections?.some(section => 
            section && section.elements?.includes(element.id) && 
            (section.id === 'hero_product' || section.name?.toLowerCase() === 'hero product')
          ) || false);
          
          if (imgNode && element.value) {
            imgNode.setAttribute('src', element.value);
            // Also update data-src if it exists
            if (imgNode.hasAttribute('data-src')) {
              imgNode.setAttribute('data-src', element.value);
            }
          }
          
          // Apply image dimensions immediately
          if (imgNode) {
            // Apply default header logo styling
            if (isHeaderLogo) {
              // Default width if not set
              if (!props.width) {
                imgNode.setAttribute('width', '180');
                imgNode.style.setProperty('width', '180px', 'important');
              } else {
                const widthValue = String(props.width);
                imgNode.setAttribute('width', widthValue);
                const widthNum = parseInt(widthValue, 10);
                if (!isNaN(widthNum)) {
                  const widthUnit = widthValue.replace(/^\d+/, '') || 'px';
                  imgNode.style.setProperty('width', `${widthNum}${widthUnit}`, 'important');
                }
              }
              // Always set height to auto for header logos
              imgNode.setAttribute('height', 'auto');
              imgNode.style.setProperty('height', 'auto', 'important');
              
              // Apply default header logo styles
              imgNode.style.setProperty('display', 'block', 'important');
              imgNode.style.setProperty('margin', '0px auto 20px', 'important');
              imgNode.style.setProperty('border', '0px', 'important');
              imgNode.style.setProperty('pointer-events', 'auto', 'important');
              imgNode.style.removeProperty('max-width');
              
              // Apply border-radius and padding to parent container (td) if it exists
              const parentTd = imgNode.closest('td');
              if (parentTd instanceof HTMLElement) {
                parentTd.style.setProperty('border-radius', '8px 8px 0px 0px', 'important');
                parentTd.style.setProperty('padding', '30px 20px', 'important');
              }
            } else {
              // For non-header logos, apply standard width/height
              // Skip setting width for Hero Product images (they use width: auto)
              if (props.width && !isHeroProductImage) {
                const widthValue = String(props.width);
                imgNode.setAttribute('width', widthValue);
                const widthNum = parseInt(widthValue, 10);
                if (!isNaN(widthNum)) {
                  const widthUnit = widthValue.replace(/^\d+/, '') || 'px';
                  imgNode.style.setProperty('width', `${widthNum}${widthUnit}`, 'important');
                  imgNode.style.removeProperty('max-width');
                }
              }
              if (props.height) {
                const heightValue = String(props.height);
                imgNode.setAttribute('height', heightValue);
                const heightNum = parseInt(heightValue, 10);
                if (!isNaN(heightNum)) {
                  const heightUnit = heightValue.replace(/^\d+/, '') || 'px';
                  imgNode.style.setProperty('height', `${heightNum}${heightUnit}`, 'important');
                }
              }
            }
            
            // Apply default Hero Product image styling (after width/height to override if needed)
            if (isHeroProductImage) {
              // Remove width attribute to allow auto width
              imgNode.removeAttribute('width');
              
              // Remove width and max-width from style object directly
              imgNode.style.removeProperty('width');
              imgNode.style.removeProperty('max-width');
              
              // Clean up inline style attribute string to remove width: 100% and old max-width
              const existingStyle = imgNode.getAttribute('style') || '';
              let cleanedStyle = existingStyle
                .replace(/width\s*:\s*[^;]+;?/gi, '')  // Remove any width property
                .replace(/max-width\s*:\s*[^;]+;?/gi, '')  // Remove old max-width
                .replace(/;\s*;/g, ';')  // Clean up double semicolons
                .trim();
              
              // Remove trailing semicolon if present
              if (cleanedStyle.endsWith(';')) {
                cleanedStyle = cleanedStyle.slice(0, -1);
              }
              
              // Update the style attribute with cleaned version
              if (cleanedStyle) {
                imgNode.setAttribute('style', cleanedStyle);
              }
              
              imgNode.style.setProperty('width', 'auto', 'important');
              imgNode.style.setProperty('border-radius', String(props.borderRadius || '12px'), 'important');
              imgNode.style.setProperty('border', '0px', 'important');
              imgNode.style.setProperty('margin', '0px auto 25px', 'important');
              imgNode.style.setProperty('pointer-events', 'auto', 'important');
              imgNode.style.setProperty('max-width', '600px', 'important');
            }

            // Always honor explicit image border radius from the editor controls.
            if (props.borderRadius) {
              imgNode.style.setProperty('border-radius', String(props.borderRadius), 'important');
            }
            
            if (props.alt) {
              imgNode.setAttribute('alt', props.alt);
            }
          }
          
          // Apply href to parent <a> tag immediately
          if (props.href) {
            const targetNode = imgNode || node;
            const parentLink = targetNode.closest('a');
            if (parentLink) {
              parentLink.setAttribute('href', props.href);
            } else if (imgNode && imgNode.parentElement) {
              // Create parent link if it doesn't exist
              const parent = imgNode.parentElement;
              const doc = container.ownerDocument || document;
              const link = doc.createElement('a');
              link.setAttribute('href', props.href);
              parent.insertBefore(link, imgNode);
              link.appendChild(imgNode);
            }
          }
        }

        // Apply text color (props already declared above)
        if (props.textColor) {
          node.style.setProperty('color', props.textColor, 'important');
        }

        // Apply background color
        if (props.backgroundColor) {
          node.style.setProperty('background-color', props.backgroundColor, 'important');
          if (element.id === 'text_hero_description') {
                      }
        }

        // Apply font size
        if (props.fontSize) {
          node.style.setProperty('font-size', props.fontSize, 'important');
        }

        // Apply font family
        if (props.fontFamily) {
          node.style.setProperty('font-family', props.fontFamily, 'important');
        }

        // Apply font weight
        if (props.fontWeight) {
          node.style.setProperty('font-weight', props.fontWeight, 'important');
        }

        // Apply line height
        if (props.lineHeight) {
          node.style.setProperty('line-height', props.lineHeight, 'important');
        }

        // Apply text align — CTAs as block/inline-block need horizontal margins; <td> CTAs use cell text-align.
        if (props.textAlign) {
          const align = String(props.textAlign);
          const ctaBox = isCtaBoxElement(element, props as Record<string, unknown>);
          const tag = node.tagName.toLowerCase();
          if (ctaBox && tag === 'td') {
            node.style.setProperty('text-align', align, 'important');
          } else if (ctaBox && tag === 'a') {
            const marginTop = parseMarginTopFromInlineStyle(node.getAttribute('style') || '');
            node.style.setProperty('display', 'block', 'important');
            node.style.setProperty('width', 'fit-content', 'important');
            node.style.setProperty('max-width', '100%', 'important');
            node.style.setProperty('text-align', 'center', 'important');
            if (align === 'left') {
              node.style.setProperty('margin', `${marginTop} auto 0 0`, 'important');
            } else if (align === 'right') {
              node.style.setProperty('margin', `${marginTop} 0 0 auto`, 'important');
            } else {
              node.style.setProperty('margin', `${marginTop} auto 0 auto`, 'important');
            }
          } else {
            node.style.setProperty('text-align', align, 'important');
          }
        }

        // Apply margin
        if (props.margin) {
          node.style.setProperty('margin', props.margin, 'important');
        }

        // Apply border radius (only for section/container elements, not text/heading elements)
        if (props.borderRadius) {
          const isTextOrHeading = element.type === 'text' || element.type === 'heading';
          const isContainerElement = element.type === 'section' || 
                                     node.tagName.toLowerCase() === 'div' || 
                                     node.tagName.toLowerCase() === 'td' ||
                                     node.tagName.toLowerCase() === 'table';
          
          if (!isTextOrHeading || isContainerElement) {
            node.style.setProperty('border-radius', props.borderRadius, 'important');
          }
        }

        // Apply border color
        if (props.borderColor) {
          node.style.setProperty('border-color', props.borderColor, 'important');
        }

        // Apply border width
        if (props.borderWidth) {
          const borderWidthValue = String(props.borderWidth);
          const borderWidthNum = parseFloat(borderWidthValue.replace(/px|em|rem|%/g, ''));
          if (!isNaN(borderWidthNum) && borderWidthNum > 0) {
            node.style.setProperty('border-width', props.borderWidth, 'important');
            node.style.setProperty('border-style', 'solid', 'important');
          }
        }

        // Apply padding (handle both combined and individual padding)
        // CRITICAL: Always remove padding shorthand when using individual padding properties
        // This prevents padding: 0 !important; from overriding padding-top/padding-bottom
        // NOTE: Don't apply section container padding to text/heading child elements
        
        if (props.padding) {
          // Only apply padding shorthand to section/container elements, not text/heading elements
          // Text/heading elements should use individual padding properties (paddingTop, paddingBottom, etc.)
          const isTextOrHeading = element.type === 'text' || element.type === 'heading';
          const isContainerElement = element.type === 'section' || 
                                     node.tagName.toLowerCase() === 'div' || 
                                     node.tagName.toLowerCase() === 'td' ||
                                     node.tagName.toLowerCase() === 'table';
          
          if (!isTextOrHeading || isContainerElement) {
            // Only apply if padding is not "0" or "0px" or "0 0 0 0"
            const paddingValue = String(props.padding).trim();
            const isZeroPadding = paddingValue === '0' || paddingValue === '0px' || paddingValue === '0 0 0 0' || paddingValue === '0px 0px 0px 0px';
            if (!isZeroPadding) {
              node.style.setProperty('padding', props.padding, 'important');
            } else {
              // Remove padding if it's set to 0
              node.style.removeProperty('padding');
            }
          } else {
            // For text/heading elements, don't apply padding shorthand - use individual properties instead
            node.style.removeProperty('padding');
          }
        } else {
          // When using individual padding properties, ALWAYS remove padding shorthand first
          // This is critical to prevent padding: 0 !important; from being applied
          node.style.removeProperty('padding');
          
          // Also check and clean the style attribute for any padding: 0 !important;
          const existingStyle = node.getAttribute('style') || '';
          if (existingStyle.includes('padding: 0 !important') || existingStyle.includes('padding:0 !important') || 
              existingStyle.includes('padding: 0px !important') || existingStyle.includes('padding:0px !important')) {
            // Remove padding: 0 !important; from the style attribute
            let cleanedStyle = existingStyle
              .replace(/padding:\s*0\s*!important;?/gi, '')
              .replace(/padding:\s*0px\s*!important;?/gi, '')
              .replace(/padding:\s*0\s+0\s+0\s+0\s*!important;?/gi, '')
              .replace(/padding:\s*0px\s+0px\s+0px\s+0px\s*!important;?/gi, '')
              .replace(/;\s*;/g, ';')
              .trim();
            if (cleanedStyle.endsWith(';')) {
              cleanedStyle = cleanedStyle.slice(0, -1);
            }
            if (cleanedStyle) {
              node.setAttribute('style', cleanedStyle);
            } else {
              node.removeAttribute('style');
            }
          }
          
          // Apply individual padding values if set
          // Don't use !important for Hero Title to allow more natural padding behavior
          const useImportant = element.id !== 'heading_section_1';

          if (props.paddingTop) {
            const topValue = String(props.paddingTop) + (String(props.paddingTop).match(/px|em|rem|%/) ? '' : 'px');
            if (useImportant) {
              node.style.setProperty('padding-top', topValue, 'important');
            } else {
              node.style.setProperty('padding-top', topValue);
            }
            if (element.id === 'text_hero_description') {
                          }
          }
          if (props.paddingRight) {
            const rightValue = String(props.paddingRight) + (String(props.paddingRight).match(/px|em|rem|%/) ? '' : 'px');
            if (useImportant) {
              node.style.setProperty('padding-right', rightValue, 'important');
            } else {
              node.style.setProperty('padding-right', rightValue);
            }
          }
          if (props.paddingBottom) {
            const bottomValue = String(props.paddingBottom) + (String(props.paddingBottom).match(/px|em|rem|%/) ? '' : 'px');
            if (useImportant) {
              node.style.setProperty('padding-bottom', bottomValue, 'important');
            } else {
              node.style.setProperty('padding-bottom', bottomValue);
            }
          }
          if (props.paddingLeft) {
            const leftValue = String(props.paddingLeft) + (String(props.paddingLeft).match(/px|em|rem|%/) ? '' : 'px');
            if (useImportant) {
              node.style.setProperty('padding-left', leftValue, 'important');
            } else {
              node.style.setProperty('padding-left', leftValue);
            }
          }
        }

        // For text elements with padding, ensure display: inline-block
        if (element.type === 'text' && (props.padding || props.paddingTop || props.paddingRight || props.paddingBottom || props.paddingLeft)) {
          const hasNonZeroPadding = 
            (props.padding && parseFloat(String(props.padding).replace(/px|em|rem|%/g, '').split(/\s+/)[0]) > 0) ||
            (props.paddingTop && parseFloat(String(props.paddingTop).replace(/px|em|rem|%/g, '')) > 0) ||
            (props.paddingBottom && parseFloat(String(props.paddingBottom).replace(/px|em|rem|%/g, '')) > 0) ||
            (props.paddingLeft && parseFloat(String(props.paddingLeft).replace(/px|em|rem|%/g, '')) > 0) ||
            (props.paddingRight && parseFloat(String(props.paddingRight).replace(/px|em|rem|%/g, '')) > 0);
          
          if (hasNonZeroPadding) {
            node.style.setProperty('display', 'inline-block', 'important');
          }
        }

        // Handle button elements - split properties between container and anchor.
        // Use visual props instead of label/id keywords so footer links don't get
        // misclassified as buttons (e.g. "Footer CTA" labels).
        const hasButtonVisualProps =
          Boolean(props.backgroundColor || props.borderColor || props.borderWidth) ||
          Boolean(
            (props.padding && parseFloat(String(props.padding).replace(/px|em|rem|%/g, '').split(/\s+/)[0]) > 0) ||
            (props.paddingTop && parseFloat(String(props.paddingTop).replace(/px|em|rem|%/g, '')) > 0) ||
            (props.paddingBottom && parseFloat(String(props.paddingBottom).replace(/px|em|rem|%/g, '')) > 0) ||
            (props.paddingLeft && parseFloat(String(props.paddingLeft).replace(/px|em|rem|%/g, '')) > 0) ||
            (props.paddingRight && parseFloat(String(props.paddingRight).replace(/px|em|rem|%/g, '')) > 0)
          );
        const isFooterLink = Boolean(
          element.id?.toLowerCase().includes('footer_link') ||
          element.id?.toLowerCase().includes('footer-link') ||
          element.id?.toLowerCase().includes('footer')
        );
        const isButtonLikeLink = element.type === 'link' && hasButtonVisualProps && !isFooterLink;
        
        if ((element.type === 'button' || isButtonLikeLink) && node.tagName.toLowerCase() === 'td') {
          const anchor = node.querySelector('a');
          if (anchor instanceof HTMLElement) {
            // Text color and font properties go to anchor
            if (props.textColor) {
              anchor.style.setProperty('color', props.textColor, 'important');
            }
            if (props.fontSize) {
              anchor.style.setProperty('font-size', props.fontSize, 'important');
            }
            if (props.fontFamily) {
              anchor.style.setProperty('font-family', props.fontFamily, 'important');
            }
            if (props.fontWeight) {
              anchor.style.setProperty('font-weight', props.fontWeight, 'important');
            }
            
            // Background, padding, border-radius go to td
            if (props.backgroundColor) {
              node.style.setProperty('background-color', props.backgroundColor, 'important');
            }
            if (props.borderRadius) {
              node.style.setProperty('border-radius', props.borderRadius, 'important');
            }
            if (props.padding) {
              node.style.setProperty('padding', props.padding, 'important');
            }
          }
        }

        // Handle price elements with special parent table logic
        const isPriceElement = 
          (element.id && element.id.includes('price')) || 
          (element.id && element.id.includes('subtotal')) || 
          (element.id && element.id.includes('shipping')) || 
          (element.id && element.id.includes('tax')) || 
          (element.id && element.id.includes('total')) ||
          (element.label && element.label.toLowerCase().includes('price')) ||
          (element.label && element.label.toLowerCase().includes('subtotal')) ||
          (element.label && element.label.toLowerCase().includes('shipping')) ||
          (element.label && element.label.toLowerCase().includes('tax')) ||
          (element.label && element.label.toLowerCase().includes('total'));

        if (isPriceElement) {
          const parentTable = node.closest('table');
          if (parentTable instanceof HTMLElement) {
            if (element.visible === false) {
              parentTable.style.setProperty('display', 'none', 'important');
            } else {
              parentTable.style.removeProperty('display');
            }
          }
        }

        // Handle footer link separators
        if (element.id && (element.id.includes('footer_link_unsubscribe') || element.id.includes('footer-link-unsubscribe'))) {
          const separator = container.querySelector('#link_4_separator') as HTMLElement | null;
          if (separator) {
            separator.style.setProperty('display', element.visible === false ? 'none' : '', 'important');
          }
        } else if (element.id && (element.id.includes('footer_link_help') || element.id.includes('footer-link-help'))) {
          const separator = container.querySelector('#link_3_separator') as HTMLElement | null;
          if (separator) {
            separator.style.setProperty('display', element.visible === false ? 'none' : '', 'important');
          }
        } else if (element.id && (element.id.includes('footer_link_terms') || element.id.includes('footer-link-terms'))) {
          const separator = container.querySelector('#link_2_separator') as HTMLElement | null;
          if (separator) {
            separator.style.setProperty('display', element.visible === false ? 'none' : '', 'important');
          }
        }
      });
    });
  }, [template.elements]);

  return (
    <div className="email-preview-container">
      <div ref={containerRef} className="email-preview-canvas" />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  // Only re-render if these specific props change
  return (
    prevProps.previewHtml === nextProps.previewHtml &&
    prevProps.refreshTrigger === nextProps.refreshTrigger &&
    prevProps.selectedElement?.id === nextProps.selectedElement?.id &&
    prevProps.previewTheme === nextProps.previewTheme &&
    prevProps.isPreviewMode === nextProps.isPreviewMode &&
    prevProps.template?.meta?.templateId === nextProps.template?.meta?.templateId
  );
});

InteractiveEmailPreview.displayName = 'InteractiveEmailPreview';

export default InteractiveEmailPreview;

