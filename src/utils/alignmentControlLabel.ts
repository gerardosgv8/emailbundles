import type { TemplateElement } from '../services/templateService';

function isButtonLikeLinkForAlignment(element: TemplateElement): boolean {
  if (element.type !== 'link') return false;
  const p = (element.properties || {}) as Record<string, unknown>;
  const hasButtonVisualProps =
    Boolean(p.backgroundColor || p.borderColor || p.borderWidth) ||
    Boolean(
      (p.padding &&
        parseFloat(String(p.padding).replace(/px|em|rem|%/g, '').split(/\s+/)[0]) > 0) ||
      (p.paddingTop && parseFloat(String(p.paddingTop).replace(/px|em|rem|%/g, '')) > 0) ||
      (p.paddingBottom && parseFloat(String(p.paddingBottom).replace(/px|em|rem|%/g, '')) > 0) ||
      (p.paddingLeft && parseFloat(String(p.paddingLeft).replace(/px|em|rem|%/g, '')) > 0) ||
      (p.paddingRight && parseFloat(String(p.paddingRight).replace(/px|em|rem|%/g, '')) > 0)
    );
  const id = element.id?.toLowerCase() ?? '';
  const isFooterLink =
    id.includes('footer_link') ||
    id.includes('footer-link') ||
    (id.includes('footer') && element.type === 'link');
  return hasButtonVisualProps && !isFooterLink;
}

/** "Element alignment" for CTAs (positions the control in the layout); "Text alignment" for copy. */
export function getAlignmentControlLabel(element: TemplateElement): string {
  if (element.type === 'button' || isButtonLikeLinkForAlignment(element)) {
    return 'Element alignment';
  }
  return 'Text alignment';
}
