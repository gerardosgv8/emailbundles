import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Loader2, Eye, EyeOff, Save, X, Image as ImageIcon, Type, Link as LinkIcon, MousePointerClick, FileText, Edit2, ChevronDown, ChevronRight, Layout, Check, PenSquare, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { templateService, DynamicTemplate, TemplateElement, TemplateSection } from '../../services/templateService';
import InteractiveEmailPreview from '../../components/builder/InteractiveEmailPreview';
import { FontSelector } from '../../components/builder/FontSelector';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { getSavedTemplates, saveTemplates } from '../../utils/savedTemplatesStorage';
import {
  saveEmail,
  canSaveEmail,
  convertTemplateToSavedEmail,
  getSavedEmails,
  getEmailStorageInfo,
  formatBytes,
  EMAIL_STORAGE_LIMITS,
  getSavedEmail,
  convertSavedEmailToTemplate,
  emailNameExists,
  buildSavedEmailFromEditorState,
  type SavedEmailData,
} from '../../utils/savedEmailsStorage';
import { SuccessModal, ModalType } from '../../components/common/SuccessModal';
import { removeFooterSocialIcons } from '../../utils/removeFooterSocialIcons';
import { buildEmbeddedThemeStyleContent, type ThemeCssMode } from '../../utils/emailBuilderEmbeddedThemeCss';
import { getAlignmentControlLabel } from '../../utils/alignmentControlLabel';

/** Component-level backgrounds that are only white or black still use light/dark preview rules. */
function normalizeSectionBackgroundForComparison(value: string): string {
  let s = value.trim().toLowerCase();
  s = s.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, r, g, b) => `rgb(${r},${g},${b})`);
  s = s.replace(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g,
    (_, r, g, b, a) => `rgba(${r},${g},${b},${a})`
  );
  s = s.replace(/\s+/g, '');
  return s;
}

function isWhiteOrBlackSectionBackground(color: string): boolean {
  const n = normalizeSectionBackgroundForComparison(color);
  const whites = new Set([
    '#fff',
    '#ffffff',
    'white',
    'rgb(255,255,255)',
    'rgba(255,255,255,1)',
    'rgba(255,255,255,1.0)',
  ]);
  const blacks = new Set([
    '#000',
    '#000000',
    'black',
    'rgb(0,0,0)',
    'rgba(0,0,0,1)',
    'rgba(0,0,0,1.0)',
  ]);
  return whites.has(n) || blacks.has(n);
}

/** Step index badges: must not inherit section theme `td { background !important }` or section background pass. */
function isStepBadgeNumberElement(element: TemplateElement): boolean {
  return (
    element.type === 'text' &&
    (element.id === 'text_step_1_number' ||
      element.id === 'text_step_2_number' ||
      element.id === 'text_step_3_number')
  );
}

const STEP_BADGE_TD_DATA_ATTR_RE =
  /data-element=["'](?:step-[123]-number|text_step_[123]_number)["']/i;

/** Outlook VML step badges: fillcolor sits inside conditional-comment HTML; keep in sync when exporting. */
function syncMsoStepBadgeFillcolors(html: string, templateData: DynamicTemplate): string {
  const pairs: [string, string][] = [
    ['step-1-number', 'text_step_1_number'],
    ['step-2-number', 'text_step_2_number'],
    ['step-3-number', 'text_step_3_number'],
  ];
  let out = html;
  for (const [dataAttr, elId] of pairs) {
    const el = templateData.elements.find(e => e.id === elId);
    const fill = el?.properties?.backgroundColor;
    if (!fill) continue;
    const esc = dataAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(fillcolor=\")(#[0-9a-fA-F]{3,8}|rgb\\([^)]+\\))(\")(?=[\\s\\S]{0,800}?data-element=\"${esc}\")`,
      'i'
    );
    out = out.replace(re, `$1${fill}$3`);
  }
  return out;
}

export const TemplateBuilder: React.FC = () => {
  const { templateId, sessionId } = useParams<{ templateId: string; sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Detect if we're in admin route
  const isAdminRoute = location.pathname.startsWith('/gestion');
  const basePath = isAdminRoute ? '/gestion' : '/user';
  const [template, setTemplate] = useState<DynamicTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasCapability } = useUserTier();
  const canSaveEmails = hasCapability('canSaveEmails');
  const canSaveTemplates = hasCapability('canSaveTemplates');
  const isSavedComposerTemplate = useMemo(
    () => Boolean(templateId && (templateId.startsWith('template_') || templateId.startsWith('saved_'))),
    [templateId]
  );
  const isSavedEmailRoute = useMemo(
    () => Boolean(templateId && templateId.startsWith('email_')),
    [templateId]
  );
  const showMainSaveButton = useMemo(
    () =>
      (isSavedComposerTemplate && canSaveTemplates) ||
      (isSavedEmailRoute && canSaveEmails) ||
      (!isSavedComposerTemplate && !isSavedEmailRoute && canSaveEmails),
    [isSavedComposerTemplate, isSavedEmailRoute, canSaveTemplates, canSaveEmails]
  );
  const [selectedElement, setSelectedElement] = useState<TemplateElement | null>(null);
  const [selectedSection, setSelectedSection] = useState<TemplateSection | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0); // Forces InteractiveEmailPreview to re-render
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const themeCssMode: ThemeCssMode = template?.meta.themeCssMode ?? 'adaptive';
  const effectivePreviewTheme: 'light' | 'dark' =
    themeCssMode === 'light-only' ? 'light' : previewTheme;
  const [mobileTab, setMobileTab] = useState<'elements' | 'preview' | 'properties'>('preview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sectionView, setSectionView] = useState<'flat' | 'grouped'>('grouped');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [emailName, setEmailName] = useState('');
  const [emailDescription, setEmailDescription] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [savedEmailName, setSavedEmailName] = useState<string | null>(null); // Store saved email name for display
  const [isEditingName, setIsEditingName] = useState(false); // Track if editing email name
  const [editingNameValue, setEditingNameValue] = useState(''); // Value while editing
  const [nameEditError, setNameEditError] = useState<string | null>(null); // Error for name editing
  const [isRenamingEmail, setIsRenamingEmail] = useState(false); // Loading state for renaming
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: ModalType;
    message: string;
    title?: string;
    secondaryAction?: { label: string; onClick: () => void };
  }>({
    isOpen: false,
    type: 'success',
    message: '',
  });

  const openEmailSavedModal = useCallback(
    (title: string, emailDisplayName: string, updated: boolean) => {
      setModalState({
        isOpen: true,
        type: 'success',
        title,
        message: `Email "${emailDisplayName}" ${updated ? 'updated' : 'saved'}. Open your library from the sidebar (Saved Emails) or Email Builder → Saved Emails tab.`,
        secondaryAction: {
          label: 'Open saved emails',
          onClick: () => {
            setModalState((s) => ({ ...s, isOpen: false, secondaryAction: undefined }));
            navigate(`${basePath}/email-library`);
          },
        },
      });
    },
    [basePath, navigate]
  );

  const originalHtmlRef = useRef<string>('');
  const domParserRef = useRef<DOMParser | null>(null);
  const hasInitializedSectionsRef = useRef<boolean>(false);
  const sectionsInitializedRef = useRef<string | null>(null); // Track which template's sections we've initialized
  const previousTemplateRef = useRef<DynamicTemplate | null>(null); // Track previous template for change detection
  const nameValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce for name validation

  // Standardize button styling across all templates (based on `freeflow_image_powered` "Explore Now")
  const STANDARD_BUTTON_STYLES = useMemo(
    () => ({
      backgroundColor: '#2563eb',
      textColor: '#ffffff',
      padding: '14px 28px',
    }),
    []
  );

  const normalizeButtonsInTemplate = useCallback(
    (templateData: DynamicTemplate): DynamicTemplate => {
      if (!templateData?.elements || !Array.isArray(templateData.elements)) return templateData;

      const missing = (v: unknown) =>
        v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

      const hasAnyPadding = (p: Record<string, any>) =>
        (!missing(p.padding) && String(p.padding).trim() !== '') ||
        p.paddingTop != null ||
        p.paddingRight != null ||
        p.paddingBottom != null ||
        p.paddingLeft != null;

      const normalizedElements = templateData.elements.map((el) => {
        const props = (el?.properties || {}) as Record<string, any>;
        const hasButtonLikeProps = Boolean(
          props.backgroundColor &&
            props.textColor &&
            (props.padding ||
              props.paddingTop != null ||
              props.paddingRight != null ||
              props.paddingBottom != null ||
              props.paddingLeft != null)
        );
        const isFooterLink = el.type === 'link' && (
          el.id?.toLowerCase().includes('footer_link') ||
          el.id?.toLowerCase().includes('footer-link') ||
          el.id?.toLowerCase().includes('footer')
        );

        // Footer links must remain plain links (no button visuals).
        if (isFooterLink) {
          const {
            backgroundColor,
            borderColor,
            borderWidth,
            borderRadius,
            padding,
            paddingTop,
            paddingRight,
            paddingBottom,
            paddingLeft,
            ...rest
          } = props;

          return {
            ...el,
            type: 'link',
            properties: {
              ...rest,
              textColor: props.textColor || '#111827',
            },
          };
        }

        // Real buttons and obvious CTA links: only backfill missing colors/padding so template JSON colors are kept.
        const shouldNormalize = el.type === 'button' || (el.type === 'link' && hasButtonLikeProps);
        if (!shouldNormalize) return el;

        const nextProps: Record<string, any> = { ...props };
        if (missing(nextProps.backgroundColor)) {
          nextProps.backgroundColor = STANDARD_BUTTON_STYLES.backgroundColor;
        }
        if (missing(nextProps.textColor)) {
          nextProps.textColor = STANDARD_BUTTON_STYLES.textColor;
        }
        if (!hasAnyPadding(nextProps)) {
          nextProps.padding = STANDARD_BUTTON_STYLES.padding;
        }

        return {
          ...el,
          properties: nextProps,
        };
      });

      // Sync inline HTML with merged element properties (per-template colors), not a single global blue.
      try {
        const html = templateData.html;
        if (html && domParserRef.current) {
          const doc = domParserRef.current.parseFromString(html, 'text/html');

          normalizedElements.forEach((el) => {
            if (el.type !== 'button') return;
            if (!el.selector) return;

            const p = (el.properties || {}) as Record<string, any>;
            const bg = p.backgroundColor ?? STANDARD_BUTTON_STYLES.backgroundColor;
            const fg = p.textColor ?? STANDARD_BUTTON_STYLES.textColor;
            const pad = p.padding;

            const nodes = Array.from(doc.querySelectorAll(el.selector));
            nodes.forEach((node) => {
              if (!(node instanceof HTMLElement)) return;

              if (node.tagName.toLowerCase() === 'td') {
                node.style.setProperty('background-color', String(bg), 'important');
                if (!missing(pad)) {
                  node.style.setProperty('padding', String(pad), 'important');
                } else {
                  ['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
                    const key = `padding${side}` as keyof typeof p;
                    if (p[key] != null) {
                      node.style.setProperty(
                        `padding-${side.toLowerCase()}` as 'padding-top',
                        String(p[key]),
                        'important'
                      );
                    }
                  });
                }

                if (p.borderRadius) {
                  node.style.setProperty('border-radius', String(p.borderRadius), 'important');
                }

                const anchor = node.querySelector('a') as HTMLAnchorElement | null;
                if (anchor) {
                  anchor.style.setProperty('color', String(fg), 'important');
                  anchor.style.setProperty('text-decoration', 'none', 'important');
                }
              } else {
                node.style.setProperty('background-color', String(bg), 'important');
                if (!missing(pad)) {
                  node.style.setProperty('padding', String(pad), 'important');
                }
                if (p.borderRadius) {
                  node.style.setProperty('border-radius', String(p.borderRadius), 'important');
                }

                if (node.tagName.toLowerCase() === 'a') {
                  node.style.setProperty('color', String(fg), 'important');
                  node.style.setProperty('text-decoration', 'none', 'important');
                }
              }
            });
          });

          return { ...templateData, elements: normalizedElements, html: doc.documentElement.outerHTML };
        }
      } catch {
        // Best-effort only
      }

      return { ...templateData, elements: normalizedElements };
    },
    [STANDARD_BUTTON_STYLES]
  );

  const normalizeNewsletterTopicCtas = useCallback((templateData: DynamicTemplate): DynamicTemplate => {
    if (!templateData) return templateData;
    if (templateData.meta?.templateId !== 'freeflow_newsletter') return templateData;

    const topicCtaIds = new Set(['button_2', 'button_3', 'button_4', 'button_5']);
    const topicSelectors = [
      'topic-1-cta',
      'topic-2-cta',
      'topic-3-cta',
      'topic-4-cta',
    ];

    const normalizedElements = (templateData.elements || []).map((el) => {
      if (!topicCtaIds.has(el.id)) return el;
      return {
        ...el,
        type: 'link',
        properties: {
          ...(el.properties || {}),
          url: el.properties?.url || '#',
          textColor: '#1e40af',
          fontSize: '14px',
          fontWeight: '600',
          paddingTop: '0px',
          paddingRight: '0px',
          paddingBottom: '0px',
          paddingLeft: '0px',
          // Clear any stale button-like props that could trigger button rendering rules.
          backgroundColor: undefined,
          borderColor: undefined,
          borderWidth: undefined,
          borderRadius: undefined,
          padding: undefined,
        },
      };
    });

    let normalizedHtml = templateData.html || '';
    topicSelectors.forEach((selector) => {
      const regex = new RegExp(
        `(data-element=["']${selector}["']\\s+href=["'][^"']*["']\\s+style=["'])([^"']*)(["'])`,
        'gi'
      );
      normalizedHtml = normalizedHtml.replace(
        regex,
        `$1display: inline-block; color: #1e40af; text-decoration: underline; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;$3`
      );
    });

    return {
      ...templateData,
      elements: normalizedElements,
      html: normalizedHtml,
    };
  }, []);

  const hasNonZeroPadding = useCallback((props: Record<string, any>): boolean => {
    const values = [
      props.padding,
      props.paddingTop,
      props.paddingRight,
      props.paddingBottom,
      props.paddingLeft,
    ].filter((value) => value !== undefined && value !== null);

    return values.some((value) => {
      if (typeof value === 'number') return value > 0;
      const text = String(value).trim();
      if (!text) return false;
      const numeric = parseFloat(text.replace(/px|em|rem|%/gi, ''));
      return !Number.isNaN(numeric) && numeric > 0;
    });
  }, []);

  const isNewsletterTopicCtaElement = useCallback(
    (element: TemplateElement, templateData?: DynamicTemplate): boolean =>
      templateData?.meta?.templateId === 'freeflow_newsletter' &&
      ['button_2', 'button_3', 'button_4', 'button_5'].includes(element.id),
    []
  );

  const isLinkWithButtonVisuals = useCallback((element: TemplateElement): boolean => {
    if (element.type !== 'link') return false;
    const isFooterLink = Boolean(
      element.id?.toLowerCase().includes('footer_link') ||
      element.id?.toLowerCase().includes('footer-link') ||
      element.id?.toLowerCase().includes('footer')
    );
    if (isFooterLink) return false;
    const props = (element.properties || {}) as Record<string, any>;
    return Boolean(
      props.backgroundColor ||
      props.borderColor ||
      props.borderWidth ||
      hasNonZeroPadding(props)
    );
  }, [hasNonZeroPadding]);

  useEffect(() => {
    if (template?.meta.themeCssMode === 'light-only' && previewTheme === 'dark') {
      setPreviewTheme('light');
    }
  }, [template?.meta.themeCssMode, previewTheme]);

  // Keep the mobile iframe preview in sync with the Light/Dark toggle (respects light-only embedded CSS).
  useEffect(() => {
    const iframe = previewIframeRef.current;
    if (!iframe) return;
    try {
      const body = iframe.contentDocument?.body;
      if (!body) return;
      body.setAttribute('data-preview-theme', effectivePreviewTheme);
    } catch {
      // Best-effort only; srcDoc should be same-origin but we avoid breaking the builder if not.
    }
  }, [effectivePreviewTheme]);

  // Auto-expand all sections by default when template loads (only once per template)
  useEffect(() => {
    if (template?.sections && template.sections.length > 0) {
      // Only auto-expand if we haven't initialized sections for this template yet
      const templateId = template.meta.templateId;
      if (sectionsInitializedRef.current !== templateId) {
        const allSectionIds = new Set(template.sections.map(s => s.id));
        setExpandedSections(allSectionIds);
        sectionsInitializedRef.current = templateId;
      }
    }
  }, [template]);

  if (typeof window !== 'undefined' && !domParserRef.current) {
    domParserRef.current = new DOMParser();
  }

  const findNodesForElement = useCallback((doc: Document, element: TemplateElement): Element[] => {
    const selector = element.selector;
    if (!selector) return [];
    const nodes: Element[] = [];

    const tryQuerySelector = () => {
      try {
        const result = Array.from(doc.querySelectorAll(selector));
        if (result.length) {
          nodes.push(...result);
        }
      } catch {
        // Ignore invalid selector syntax (e.g., :contains)
      }
    };

    const tryContainsSelector = () => {
      const containsMatch = selector.match(/^(.*):contains\(['"](.+)['"]\)$/i);
      if (!containsMatch) return;

      const baseSelector = containsMatch[1] || '*';
      const text = containsMatch[2].trim();
      let candidates: Element[] = [];

      try {
        candidates = Array.from(doc.querySelectorAll(baseSelector));
      } catch {
        candidates = Array.from(doc.querySelectorAll('*'));
      }

      candidates.forEach(candidate => {
        if (candidate.textContent && candidate.textContent.trim().includes(text)) {
          nodes.push(candidate);
        }
      });
    };

    const tryImageFallback = () => {
      if (element.type !== 'image') return;
      const url = element.value || element.defaultValue;
      const alt = element.properties?.alt;
      const images = Array.from(doc.querySelectorAll('img'));
      images.forEach(img => {
        if (url && img.getAttribute('src') === url) {
          nodes.push(img);
        } else if (alt && img.getAttribute('alt') === alt) {
          nodes.push(img);
        }
      });
    };

    const tryDefaultValueMatch = () => {
      const comparisonValue = (element.value || element.defaultValue || '').trim();
      if (!comparisonValue) return;

      // First, try to find by data-element attribute if it exists
      const dataElementMatch = element.selector?.match(/data-element=["']([^"']+)["']/);
      if (dataElementMatch) {
        const dataElementValue = dataElementMatch[1];
        const byDataElement = Array.from(doc.querySelectorAll(`[data-element="${dataElementValue}"]`));
        if (byDataElement.length > 0) {
          nodes.push(...byDataElement);
          return;
        }
      }

      // Fallback: find by text content, but prioritize elements with data-element attributes
      const allNodes = Array.from(doc.querySelectorAll('*'));
      const nodesWithDataElement: Element[] = [];
      const nodesWithoutDataElement: Element[] = [];
      
      allNodes.forEach(node => {
        if (node.textContent?.trim() === comparisonValue) {
          if (node.hasAttribute('data-element')) {
            nodesWithDataElement.push(node);
          } else {
            nodesWithoutDataElement.push(node);
          }
        }
      });
      
      // Prefer nodes with data-element attributes
      if (nodesWithDataElement.length > 0) {
        nodes.push(...nodesWithDataElement);
      } else {
        nodes.push(...nodesWithoutDataElement);
      }
    };

    tryQuerySelector();
    if (!nodes.length) {
      tryContainsSelector();
    }
    if (!nodes.length) {
      tryImageFallback();
    }
    if (!nodes.length) {
      tryDefaultValueMatch();
    }

    return nodes;
  }, []);

  const parseStyleString = useCallback((styleString: string | null | undefined): Record<string, string> => {
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
  }, []);

  const getStyleValueFromSources = useCallback(
    (sources: (HTMLElement | null | undefined)[], property: string): string | undefined => {
      for (const source of sources) {
        if (!source) continue;
        const styles = parseStyleString(source.getAttribute('style'));
        if (styles[property]) {
          return styles[property];
        }
      }
      return undefined;
    },
    [parseStyleString]
  );

  const hydrateTemplateElements = useCallback(
    (templateData: DynamicTemplate): DynamicTemplate => {
      if (!domParserRef.current) {
        return templateData;
      }

      const doc = domParserRef.current.parseFromString(templateData.html, 'text/html');

      const hydratedElements = templateData.elements.map(element => {
        const targets = findNodesForElement(doc, element);
        if (!targets.length) {
          return element;
        }

        const primaryNode = targets[0];
        if (!(primaryNode instanceof HTMLElement)) {
          return element;
        }

        const existingProps = element.properties || {};
        const nextProps: Record<string, any> = { ...existingProps };

        if (element.type === 'image' && primaryNode instanceof HTMLImageElement) {
          if (!nextProps.alt) {
            nextProps.alt = primaryNode.getAttribute('alt') || '';
          }
          // Extract href from parent <a> tag if it exists
          const parentLink = primaryNode.closest('a');
          if (parentLink && !nextProps.href) {
            const href = parentLink.getAttribute('href') || '';
            if (href) {
              nextProps.href = href;
            }
          }
          if (nextProps.width == null) {
            const widthAttr = primaryNode.getAttribute('width');
            if (widthAttr) {
              const parsedWidth = parseInt(widthAttr, 10);
              if (!Number.isNaN(parsedWidth)) {
                nextProps.width = parsedWidth;
              }
            }
          }
          if (nextProps.height == null) {
            const heightAttr = primaryNode.getAttribute('height');
            if (heightAttr) {
              const parsedHeight = parseInt(heightAttr, 10);
              if (!Number.isNaN(parsedHeight)) {
                nextProps.height = parsedHeight;
              }
            }
          }
        }

        if ((element.type === 'button' || element.type === 'link') && primaryNode instanceof HTMLAnchorElement) {
          if (!nextProps.url) {
            nextProps.url = primaryNode.getAttribute('href') || '';
          }
        }

        const styleSources: (HTMLElement | null)[] = [
          primaryNode,
          primaryNode.parentElement,
          primaryNode.closest('td'),
          primaryNode.closest('a'),
        ];

        // Check if this is a logo image - skip backgroundColor for logos
        const elementLabel = element.label?.toLowerCase() ?? '';
        const altText = (element.properties?.alt || '').toLowerCase();
        const isLogo = element.type === 'image' && 
          (element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo' || elementLabel.includes('logo') || elementLabel.includes('brand') || altText.includes('logo') || altText.includes('brand'));
        
        // Don't extract or set backgroundColor for logo images
        if (!isLogo) {
          const backgroundColor =
            nextProps.backgroundColor ||
            getStyleValueFromSources(styleSources, 'background-color') ||
            getStyleValueFromSources(styleSources, 'background');
          if (backgroundColor) {
            nextProps.backgroundColor = backgroundColor;
          }
        } else if (nextProps.backgroundColor) {
          // Remove any existing backgroundColor from logo images
          delete nextProps.backgroundColor;
        }

        const textColor = nextProps.textColor || getStyleValueFromSources(styleSources, 'color');
        if (textColor) {
          nextProps.textColor = textColor;
        }

        const fontSize = nextProps.fontSize || getStyleValueFromSources(styleSources, 'font-size');
        if (fontSize) {
          nextProps.fontSize = fontSize;
        }

        const fontWeight = nextProps.fontWeight || getStyleValueFromSources(styleSources, 'font-weight');
        if (fontWeight) {
          nextProps.fontWeight = fontWeight;
        }

        const fontFamily = nextProps.fontFamily || getStyleValueFromSources(styleSources, 'font-family');
        if (fontFamily) {
          nextProps.fontFamily = fontFamily;
        }

        const borderRadius = nextProps.borderRadius || getStyleValueFromSources(styleSources, 'border-radius');
        if (borderRadius) {
          nextProps.borderRadius = borderRadius;
        }

        const padding = nextProps.padding || getStyleValueFromSources(styleSources, 'padding');
        if (padding) {
          nextProps.padding = padding;
        }

        return {
          ...element,
          // Always merge properties, never replace - preserve existing properties like padding we initialized
          properties: {
            ...(element.properties || {}),  // Start with existing properties (preserves initialized padding)
            ...nextProps,  // Then override with hydrated values
          },
        };
      });

      return {
        ...templateData,
        elements: hydratedElements,
      };
    },
    [findNodesForElement, getStyleValueFromSources]
  );

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;

    try {
      setLoading(true);

      let loadedTemplate: DynamicTemplate | null = null;
      
      // Check if this is a saved email (starts with "email_")
      if (templateId.startsWith('email_')) {
        if (!isAdminRoute && !canSaveEmails) {
          navigate(`${basePath}/email-builder`, { replace: true });
          return;
        }
        if (user?.id) {
          try {
            // Try Supabase first
            const { getSavedEmailSupabase } = await import('../../services/savedEmailsSupabase');
            const savedEmail = await getSavedEmailSupabase(user.id, templateId);
            if (savedEmail) {
              loadedTemplate = convertSavedEmailToTemplate(savedEmail);
              setSavedEmailName(savedEmail.name); // Store the saved email name for display
            } else {
              console.error('Saved email not found in Supabase:', templateId);
              navigate(`${basePath}/email-builder`);
              return;
            }
          } catch {
            // Fallback to localStorage
            const savedEmail = getSavedEmail(user.id, templateId);
            if (savedEmail) {
              loadedTemplate = convertSavedEmailToTemplate(savedEmail);
              setSavedEmailName(savedEmail.name);
            } else {
              console.error('Saved email not found:', templateId);
              navigate(`${basePath}/email-builder`);
              return;
            }
          }
        } else {
          // Fallback if no user ID
          const savedEmail = getSavedEmail(user?.id, templateId);
          if (savedEmail) {
            loadedTemplate = convertSavedEmailToTemplate(savedEmail);
            setSavedEmailName(savedEmail.name);
          } else {
            console.error('Saved email not found:', templateId);
            navigate(`${basePath}/email-builder`);
            return;
          }
        }
      } else {
        setSavedEmailName(null); // Clear saved email name for regular templates
        if (!isAdminRoute && !canSaveTemplates && user?.id) {
          try {
            const { getTemplateByIdSupabase } = await import('../../services/savedTemplatesSupabase');
            const fromDb = await getTemplateByIdSupabase(templateId, user.id);
            if (fromDb) {
              navigate(`${basePath}/email-builder`, { replace: true });
              return;
            }
          } catch {
            /* ignore */
          }
          const { getSavedTemplates } = await import('../../utils/savedTemplatesStorage');
          if (getSavedTemplates(user.id).some((t: { id: string }) => t.id === templateId)) {
            navigate(`${basePath}/email-builder`, { replace: true });
            return;
          }
        }
        // Load from template service (handles both regular templates and saved templates)
        loadedTemplate = await templateService.getTemplate(templateId, user?.id);

        if (!loadedTemplate) {
          console.error('Template not found:', {
            templateId,
            userId: user?.id,
            isEmailPrefix: templateId.startsWith('email_'),
            isTemplatePrefix: templateId.startsWith('template_'),
            isSavedPrefix: templateId.startsWith('saved_'),
            isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId)
          });
        }
      }
      
      if (!loadedTemplate) {
        console.error('❌ Template not found after all attempts:', templateId);
        console.error('   This could mean:');
        console.error('   1. Template ID is incorrect');
        console.error('   2. Template was not saved properly');
        console.error('   3. User ID mismatch (template belongs to different user)');
        console.error('   4. Template conversion failed');
        navigate(`${basePath}/email-builder`);
        return;
      }
      const newsletterNormalizedTemplate = normalizeNewsletterTopicCtas(loadedTemplate);
      const hydratedTemplate = hydrateTemplateElements(newsletterNormalizedTemplate);

      // Make button styling consistent across stock templates before preview/export.
      // Skip for saved emails (email_*) — normalizeButtonsInTemplate overwrites button
      // properties and HTML with standard styles, which would erase user-saved bg/text/padding.
      const normalizedTemplate =
        templateId.startsWith('email_') ? hydratedTemplate : normalizeButtonsInTemplate(hydratedTemplate);
      
      // Apply width: 100% to order-details-total-wrapper when template is loaded
      // This ensures it's in the original HTML reference
      let processedHtml = normalizedTemplate.html;
      processedHtml = processedHtml.replace(
        /<td([^>]*data-element=["']order-details-total-wrapper["'][^>]*)>/gi,
        (match, attrs) => {
          // Check if style attribute exists
          const styleMatch = attrs.match(/style=["']([^"']*)["']/);
          if (styleMatch) {
            const styleContent = styleMatch[1];
            // Check if width: 100% is already present (check for both formats)
            if (!styleContent.includes('width: 100%') && !styleContent.includes('width:100%') && !styleContent.includes('width:100%;')) {
              const separator = styleContent.trim() && !styleContent.trim().endsWith(';') ? '; ' : ' ';
              const newStyle = styleContent + separator + 'width: 100%';
              return match.replace(/style=["'][^"']*["']/, `style="${newStyle}"`);
            }
          } else {
            // No style attribute, add one
            return match.replace(/>$/, ' style="width: 100%">');
          }
          return match;
        }
      );
      
      // Update the template HTML with the processed version
      normalizedTemplate.html = processedHtml;
      originalHtmlRef.current = processedHtml;
      setTemplate(normalizedTemplate);
    } catch (error) {
      console.error('Error loading template:', error);
      navigate(`${basePath}/email-builder`);
    } finally {
      setLoading(false);
    }
  }, [
    templateId,
    navigate,
    hydrateTemplateElements,
    normalizeNewsletterTopicCtas,
    user?.id,
    basePath,
    isAdminRoute,
    canSaveEmails,
    canSaveTemplates,
  ]);

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    }
  }, [templateId, loadTemplate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nameValidationTimeoutRef.current) {
        clearTimeout(nameValidationTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to rebuild style attribute from current properties
  // This creates a complete snapshot of the current styling state
  const rebuildStyleAttribute = useCallback((target: HTMLElement, element: TemplateElement, templateData?: DynamicTemplate): void => {
    // FIRST: Read existing styles BEFORE we modify anything
    const originalStyle = target.getAttribute('style') || '';
    const originalStyles = originalStyle.split(';').map(s => s.trim()).filter(Boolean);
    
    const styles: string[] = [];
    
    // For images, preserve width/height from properties or attributes
    if (element.type === 'image' && target instanceof HTMLImageElement) {
      // Check if this is a logo
      const label = element.label?.toLowerCase() ?? '';
      const altText = (element.properties?.alt || '').toLowerCase();
      const isLogo = element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo' || label.includes('logo') || label.includes('brand') || altText.includes('logo') || altText.includes('brand');
      
      // Check if image is in Hero Product section
      const isHeroProductImage = templateData?.sections?.some(section => 
        section && section.elements?.includes(element.id) && 
        (section.id === 'hero_product' || section.name?.toLowerCase() === 'hero product')
      ) || false;
      
      // Skip setting width for Hero Product images (they use width: auto)
      if (element.properties?.width && !isHeroProductImage) {
        const widthValue = String(element.properties.width);
        const widthNum = parseInt(widthValue, 10);
        if (!isNaN(widthNum)) {
          const widthUnit = widthValue.replace(/^\d+/, '') || 'px';
          styles.push(`width: ${widthNum}${widthUnit}`);
        }
      }
      
      // For Hero Product images, add width: auto and max-width: 600px
      if (isHeroProductImage && !isLogo) {
        styles.push(`width: auto`);
        styles.push(`max-width: 600px`);
      }
      // For logos, always use height: auto (ignore any height property)
      if (isLogo) {
        styles.push(`height: auto`);
      } else if (element.properties?.height) {
        // For non-logo images, use the height property if set
        const heightValue = String(element.properties.height);
        const heightNum = parseInt(heightValue, 10);
        if (!isNaN(heightNum)) {
          const heightUnit = heightValue.replace(/^\d+/, '') || 'px';
          styles.push(`height: ${heightNum}${heightUnit}`);
        }
      }
    }
    
    // Treat links as button-like only when they actually carry button visual props.
    // This avoids stripping underline from editorial "Read More" style links.
    const isButtonLikeLink = isLinkWithButtonVisuals(element) && !isNewsletterTopicCtaElement(element, templateData);
    const ctaAlign = (element.properties as { textAlign?: string })?.textAlign;

    if (element.type === 'button' || isButtonLikeLink) {
      styles.push(`text-decoration: none`);
    }
    
    // Check if this is a compare price element (should have strikethrough by default)
    const label = element.label?.toLowerCase() ?? '';
    const id = element.id?.toLowerCase() ?? '';
    const isComparePrice = element.type === 'text' && (label.includes('compare') || id.includes('compare'));
    const isFooterLinkElement = element.type === 'link' && (
      id.includes('footer_link') ||
      id.includes('footer-link') ||
      id.includes('footer')
    );
    
    // Build style string from all current properties
      if (element.properties?.textColor) {
      styles.push(`color: ${element.properties.textColor}`);
    } else if (isFooterLinkElement) {
      styles.push(`color: #111827`);
    }
    
    // For compare price elements, add text-decoration: line-through by default
    // unless explicitly overridden by a textDecoration property
    if (isComparePrice) {
      const textDecoration = (element.properties as any)?.textDecoration;
      if (textDecoration !== undefined && textDecoration !== null) {
        styles.push(`text-decoration: ${textDecoration}`);
      } else {
        // Default to line-through for compare prices
        styles.push(`text-decoration: line-through`);
      }
    } else if ((element.properties as any)?.textDecoration) {
      // For other elements, only add if explicitly set
      styles.push(`text-decoration: ${(element.properties as any).textDecoration}`);
      }

      if (element.properties?.fontSize) {
      styles.push(`font-size: ${element.properties.fontSize}`);
      }

      if (element.properties?.fontWeight) {
      styles.push(`font-weight: ${element.properties.fontWeight}`);
      }

      if (element.properties?.fontFamily) {
      styles.push(`font-family: ${element.properties.fontFamily}`);
      }

      if (ctaAlign) {
        const isCtaBox = element.type === 'button' || isButtonLikeLink;
        const tag = target.tagName.toLowerCase();
        if (isCtaBox && tag === 'td') {
          styles.push(`text-align: ${ctaAlign}`);
        } else if (isCtaBox && tag === 'a') {
          const parseMarginTop = (styleStr: string): string => {
            if (!styleStr) return '0';
            const rules = styleStr.split(';').map((s) => s.trim()).filter(Boolean);
            for (const rule of rules) {
              const idx = rule.indexOf(':');
              if (idx === -1) continue;
              const prop = rule.slice(0, idx).trim().toLowerCase();
              const val = rule.slice(idx + 1).trim().replace(/\s*!important\s*$/i, '');
              if (prop === 'margin-top') return val || '0';
            }
            for (const rule of rules) {
              const idx = rule.indexOf(':');
              if (idx === -1) continue;
              const prop = rule.slice(0, idx).trim().toLowerCase();
              if (prop !== 'margin') continue;
              const val = rule.slice(idx + 1).trim().replace(/\s*!important\s*$/i, '');
              const parts = val.split(/\s+/).filter(Boolean);
              if (parts.length === 1) return parts[0];
              if (parts.length >= 2) return parts[0];
            }
            return '0';
          };
          const marginTop = parseMarginTop(originalStyle);
          styles.push(`display: block`);
          styles.push(`width: fit-content`);
          styles.push(`max-width: 100%`);
          styles.push(`text-align: center`);
          if (ctaAlign === 'left') {
            styles.push(`margin: ${marginTop} auto 0 0`);
          } else if (ctaAlign === 'right') {
            styles.push(`margin: ${marginTop} 0 0 auto`);
          } else {
            styles.push(`margin: ${marginTop} auto 0 auto`);
          }
        } else {
          styles.push(`text-align: ${ctaAlign}`);
        }
      }

      if (element.properties?.borderRadius) {
      styles.push(`border-radius: ${element.properties.borderRadius}`);
    }
    
    if (element.properties?.borderColor && !isFooterLinkElement) {
      styles.push(`border-color: ${element.properties.borderColor}`);
    }
    
    if (element.properties?.borderWidth && !isFooterLinkElement) {
      const borderWidth = element.properties.borderWidth;
      const borderWidthValue = String(borderWidth).replace(/px/g, '').trim();
      const borderWidthNum = parseInt(borderWidthValue, 10);
      
      // Only add border-width if it's greater than 0
      if (!isNaN(borderWidthNum) && borderWidthNum > 0) {
        styles.push(`border-width: ${borderWidth}`);
        // Add border-style: solid when we have both borderWidth and borderColor to ensure border is visible
        if (element.properties?.borderColor) {
          styles.push(`border-style: solid`);
        }
      }
    }
    
    // Handle padding - check both combined and individual
    const padding = element.properties?.padding;
    const paddingTop = (element.properties as any)?.paddingTop;
    const paddingBottom = (element.properties as any)?.paddingBottom;
    const paddingLeft = (element.properties as any)?.paddingLeft;
    const paddingRight = (element.properties as any)?.paddingRight;
    
    // Check if any padding is being set
    const hasAnyPadding = paddingTop !== undefined || paddingBottom !== undefined || paddingLeft !== undefined || paddingRight !== undefined || padding;
    
    if (!isFooterLinkElement && (paddingTop !== undefined || paddingBottom !== undefined || paddingLeft !== undefined || paddingRight !== undefined)) {
      // Use individual padding properties
      // Only add to inline styles if value is non-zero (keep HTML clean for default 0 padding)
      if (paddingTop !== undefined) {
        const topValue = String(paddingTop) + (String(paddingTop).match(/px|em|rem|%/) ? '' : 'px');
        const numValue = parseFloat(String(paddingTop).replace(/px|em|rem|%/g, ''));
        if (numValue !== 0) {
          styles.push(`padding-top: ${topValue} !important`);
        }
      }
      if (paddingRight !== undefined) {
        const rightValue = String(paddingRight) + (String(paddingRight).match(/px|em|rem|%/) ? '' : 'px');
        const numValue = parseFloat(String(paddingRight).replace(/px|em|rem|%/g, ''));
        if (numValue !== 0) {
          styles.push(`padding-right: ${rightValue} !important`);
        }
      }
      if (paddingBottom !== undefined) {
        const bottomValue = String(paddingBottom) + (String(paddingBottom).match(/px|em|rem|%/) ? '' : 'px');
        const numValue = parseFloat(String(paddingBottom).replace(/px|em|rem|%/g, ''));
        if (numValue !== 0) {
          styles.push(`padding-bottom: ${bottomValue} !important`);
        }
      }
      if (paddingLeft !== undefined) {
        const leftValue = String(paddingLeft) + (String(paddingLeft).match(/px|em|rem|%/) ? '' : 'px');
        const numValue = parseFloat(String(paddingLeft).replace(/px|em|rem|%/g, ''));
        if (numValue !== 0) {
          styles.push(`padding-left: ${leftValue} !important`);
        }
      }
    } else if (!isFooterLinkElement && padding !== undefined) {
      // Apply combined padding value only if non-zero (keep HTML clean for default 0 padding)
      const numValue = parseFloat(String(padding).replace(/px|em|rem|%/g, '').split(/\s+/)[0]);
      if (numValue !== 0) {
        styles.push(`padding: ${padding} !important`);
      }
    }
    
    // For text elements (like price spans), ensure display: inline-block when padding is set
    // This makes padding visible on inline elements
    // Note: Block-level elements like <p> and <h1-h6> don't need display: inline-block
    if (element.type === 'text' && hasAnyPadding && target instanceof HTMLElement) {
      const targetTag = target.tagName.toLowerCase();
      const isInlineElement = !['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(targetTag);

      // Only set display: inline-block for actually inline elements (like span) with non-zero padding
      if (isInlineElement) {
        const hasNonZeroPadding =
          (paddingTop !== undefined && parseFloat(String(paddingTop).replace(/px|em|rem|%/g, '')) > 0) ||
          (paddingBottom !== undefined && parseFloat(String(paddingBottom).replace(/px|em|rem|%/g, '')) > 0) ||
          (paddingLeft !== undefined && parseFloat(String(paddingLeft).replace(/px|em|rem|%/g, '')) > 0) ||
          (paddingRight !== undefined && parseFloat(String(paddingRight).replace(/px|em|rem|%/g, '')) > 0) ||
          (padding && parseFloat(String(padding).replace(/px|em|rem|%/g, '').split(/\s+/)[0]) > 0);

        if (hasNonZeroPadding) {
          styles.push(`display: inline-block`);
        }
      }
    }
    
    // Handle backgroundColor - always include if defined (even if empty string)
    // Skip for logo images as they should not have background colors
    const elementLabel = element.label?.toLowerCase() ?? '';
    const altText = (element.properties?.alt || '').toLowerCase();
    const isLogo = element.type === 'image' &&
      (element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo' || elementLabel.includes('logo') || elementLabel.includes('brand') || altText.includes('logo') || altText.includes('brand'));
    const backgroundColor = element.properties?.backgroundColor;
    if (backgroundColor !== undefined && backgroundColor !== null && !isLogo && !isFooterLinkElement) {
      const stepBadge = isStepBadgeNumberElement(element);
      styles.push(
        stepBadge ? `background-color: ${backgroundColor} !important` : `background-color: ${backgroundColor}`
      );
    }
    
    // Handle display/visibility
    // Special handling for price elements - ensure they can be hidden properly
    const isPriceElement = 
      element.id.includes('price') || 
      element.id.includes('subtotal') || 
      element.id.includes('shipping') || 
      element.id.includes('tax') || 
      element.id.includes('total') ||
      elementLabel.includes('price') ||
      elementLabel.includes('subtotal') ||
      elementLabel.includes('shipping') ||
      elementLabel.includes('tax') ||
      elementLabel.includes('total');
    
    if (element.visible === false) {
      styles.push(`display: none !important`);
      // For price elements, also ensure the style is applied directly to the node later
      // This is handled in the special price element code below
    } else if (element.type === 'image') {
            const label = element.label?.toLowerCase() ?? '';
            const altText = (element.properties?.alt || '').toLowerCase();
            const isLogo = element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo' || label.includes('logo') || label.includes('brand') || altText.includes('logo') || altText.includes('brand');
            if (isLogo) {
        styles.push(`display: block`);
      }
    }
    
    // Check if we're setting any padding properties - if so, we control padding completely
    const hasPaddingProperties = element.properties?.padding !== undefined || 
      (element.properties as any)?.paddingTop !== undefined ||
      (element.properties as any)?.paddingBottom !== undefined ||
      (element.properties as any)?.paddingLeft !== undefined ||
      (element.properties as any)?.paddingRight !== undefined;
    
    // Preserve existing structural styles that aren't in properties (like margin, border: 0 for images, etc.)
    // Use the ORIGINAL styles we read at the start, BEFORE we modify anything
    // Check if we're setting any border properties
    const hasBorderProperties = element.properties?.borderColor || element.properties?.borderWidth;
    
    originalStyles.forEach(existingStyleRule => {
      const [property] = existingStyleRule.split(':').map(s => s.trim());
      const propertyLower = property.toLowerCase();
      
      // NEVER preserve any existing padding styles - controls determine padding completely
      if (propertyLower.startsWith('padding')) {
        return; // Skip preserving existing padding - controls determine padding
      }
      
      // Preserve structural styles that we don't control
      const structuralProperties = ['margin', 'border', 'max-width', 'object-fit', 'line-height'];
      if (structuralProperties.some(sp => propertyLower.startsWith(sp))) {
        if (
          ctaAlign &&
          (element.type === 'button' || isButtonLikeLink) &&
          (propertyLower === 'margin' || propertyLower.startsWith('margin-'))
        ) {
          return;
        }
        // Only add if we haven't already set a conflicting property
        const conflicts = ['border-width', 'border-color', 'border-style', 'border-radius'];
        // If we're setting border properties, don't preserve the 'border' shorthand
        if (hasBorderProperties && propertyLower === 'border') {
          return; // Skip preserving the border shorthand
        }
        if (!conflicts.some(cp => propertyLower.startsWith(cp))) {
          styles.push(existingStyleRule);
        }
      }
    });
    
    // Set the complete style attribute - this is the snapshot of current state
    // Add !important to padding AND margin properties to ensure they override existing inline styles
    const finalStyles = styles.map(style => {
      // Add !important to padding and margin properties to ensure they take precedence over existing inline styles
      const trimmedStyle = style.trim();
      if (trimmedStyle.startsWith('padding') || trimmedStyle.startsWith('margin')) {
        // Check if !important is already there
        if (!style.includes('!important')) {
          return style.replace(/;?\s*$/, '') + ' !important';
        }
      }
      return style;
    });
    
    if (finalStyles.length > 0) {
      const finalStyleString = finalStyles.join('; ');
      target.setAttribute('style', finalStyleString);
        } else {
      // If no styles, remove the style attribute to ensure clean export
      target.removeAttribute('style');
    }

    if (isStepBadgeNumberElement(element)) {
      if (element.properties?.backgroundColor) {
        target.setAttribute('data-user-bg-color', 'true');
      } else {
        target.removeAttribute('data-user-bg-color');
      }
    }

    // Mark nodes where the user explicitly chose text color so dark-mode preview does not override it.
    if (element.type !== 'image' && element.type !== 'spacer' && element.type !== 'divider' && element.type !== 'section') {
      if (element.properties?.userSetTextColor && element.properties?.textColor) {
        target.setAttribute('data-user-text-color', 'true');
      } else {
        target.removeAttribute('data-user-text-color');
      }
    }
  }, []);

  const applyElementPropertiesToNode = useCallback((node: Element, element: TemplateElement, templateData?: DynamicTemplate) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    // Get the document for querying (needed for MSO version handling)
    const doc = node.ownerDocument || (node as any).document || document;
    const labelLc = (element.label ?? '').toLowerCase();

    // Remove footer social icons entirely (book/bird/camera/portfolio placeholders are these elements).
    // We force-hide the nodes so they never render in preview/export.
    if (element.id.startsWith('footer_social_')) {
      node.style.setProperty('display', 'none', 'important');
      return;
    }

    // Special handling for price elements - ensure visibility is applied immediately
    // Check for price-related elements: price, subtotal, shipping, tax, total
    const isPriceElement = 
      element.id.includes('price') || 
      element.id.includes('subtotal') || 
      element.id.includes('shipping') || 
      element.id.includes('tax') || 
      element.id.includes('total') ||
      labelLc.includes('price') ||
      labelLc.includes('subtotal') ||
      labelLc.includes('shipping') ||
      labelLc.includes('tax') ||
      labelLc.includes('total');
    
    if (isPriceElement && element.visible === false) {
      node.style.setProperty('display', 'none', 'important');
    } else if (isPriceElement && element.visible === true) {
      node.style.removeProperty('display');
    }

    const styleTargets = new Set<HTMLElement>();
    
    // For image elements, ensure we target the actual <img> element, not a parent container
    // Also apply dimensions from properties to ensure latest updates are reflected
    if (element.type === 'image' && node instanceof HTMLImageElement) {
      styleTargets.add(node);
      
      // Check if image is in Hero Product section
      const isHeroProductImage = templateData?.sections?.some(section => 
        section && section.elements?.includes(element.id) && 
        (section.id === 'hero_product' || section.name?.toLowerCase() === 'hero product')
      ) || false;
      
      // Skip setting width for Hero Product images (they use width: auto)
      // Apply image dimensions from properties to ensure latest updates are exported
      if (element.properties?.width && !isHeroProductImage) {
        const widthValue = String(element.properties.width);
        node.setAttribute('width', widthValue);
        const widthNum = parseInt(widthValue, 10);
        if (!isNaN(widthNum)) {
          const widthUnit = widthValue.replace(/^\d+/, '') || 'px';
          node.style.width = `${widthNum}${widthUnit}`;
          node.style.maxWidth = '';
        }
      }
      
      // Apply Hero Product styling if applicable
      if (isHeroProductImage) {
        node.removeAttribute('width');
        
        // Remove width and max-width from style object directly
        node.style.removeProperty('width');
        node.style.removeProperty('max-width');
        
        // Clean up inline style attribute string to remove width: 100% and old max-width
        const existingStyle = node.getAttribute('style') || '';
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
          node.setAttribute('style', cleanedStyle);
        }
        
        node.style.setProperty('width', 'auto', 'important');
        node.style.setProperty('max-width', '600px', 'important');
      }
      if (element.properties?.height) {
        const heightValue = String(element.properties.height);
        node.setAttribute('height', heightValue);
        const heightNum = parseInt(heightValue, 10);
        if (!isNaN(heightNum)) {
          const heightUnit = heightValue.replace(/^\d+/, '') || 'px';
          node.style.height = `${heightNum}${heightUnit}`;
        }
      }
    } else if (element.type === 'image') {
      // If the node is not an img, find the img element within it
      const imgElement = node.querySelector('img') as HTMLImageElement | null;
      if (imgElement) {
        styleTargets.add(imgElement);
        
        // Check if image is in Hero Product section
        const isHeroProductImage = templateData?.sections?.some(section => 
          section && section.elements?.includes(element.id) && 
          (section.id === 'hero_product' || section.name?.toLowerCase() === 'hero product')
        ) || false;
        
        // Skip setting width for Hero Product images (they use width: auto)
        // Apply dimensions to the found img element
        if (element.properties?.width && !isHeroProductImage) {
          const widthValue = String(element.properties.width);
          imgElement.setAttribute('width', widthValue);
          const widthNum = parseInt(widthValue, 10);
          if (!isNaN(widthNum)) {
            const widthUnit = widthValue.replace(/^\d+/, '') || 'px';
            imgElement.style.width = `${widthNum}${widthUnit}`;
            imgElement.style.maxWidth = '';
          }
        }
        
        // Apply Hero Product styling if applicable
        if (isHeroProductImage) {
          imgElement.removeAttribute('width');
          
          // Remove width and max-width from style object directly
          imgElement.style.removeProperty('width');
          imgElement.style.removeProperty('max-width');
          
          // Clean up inline style attribute string to remove width: 100% and old max-width
          const existingStyle = imgElement.getAttribute('style') || '';
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
            imgElement.setAttribute('style', cleanedStyle);
          }
          
          imgElement.style.setProperty('width', 'auto', 'important');
          imgElement.style.setProperty('max-width', '600px', 'important');
        }
        if (element.properties?.height) {
          const heightValue = String(element.properties.height);
          imgElement.setAttribute('height', heightValue);
          const heightNum = parseInt(heightValue, 10);
          if (!isNaN(heightNum)) {
            const heightUnit = heightValue.replace(/^\d+/, '') || 'px';
            imgElement.style.height = `${heightNum}${heightUnit}`;
          }
        }
      } else {
        styleTargets.add(node);
      }
    } else {
      styleTargets.add(node);
    }

    // Same rule as rebuildStyleAttribute: only treat links as button-like
    // when they have button-style container properties.
    const isButtonLikeLink = isLinkWithButtonVisuals(element) && !isNewsletterTopicCtaElement(element, templateData);
    const isNewsletterTopicCta = isNewsletterTopicCtaElement(element, templateData);

    let anchorTarget: HTMLElement | null = null;
    const containerTargets: HTMLElement[] = [];
    const isTdButton = element.type === 'button' && node.tagName.toLowerCase() === 'td';

    if (element.type === 'button' || isButtonLikeLink || isNewsletterTopicCta) {
      anchorTarget =
        node instanceof HTMLAnchorElement ? node : (node.querySelector('a') as HTMLElement | null) || (node.closest('a') as HTMLElement | null);
      if (anchorTarget) {
        // Always add the anchor to styleTargets for non-td buttons
        // For td buttons, styling is handled separately in the isTdButton block
        if (!isTdButton) {
          styleTargets.add(anchorTarget);
        } else if (anchorTarget !== node) {
          // For td buttons, only add if anchor is different from node
          styleTargets.add(anchorTarget);
        }
      }

      const cellTarget = anchorTarget?.closest('td') as HTMLElement | null;
      if (cellTarget) {
        containerTargets.push(cellTarget);
      }
    }

    // Force newsletter topic CTAs to render as plain links (not buttons), even if stale
    // saved HTML carries button-like styles from previous versions.
    if (isNewsletterTopicCta && anchorTarget) {
      const tdTarget = anchorTarget.closest('td') as HTMLElement | null;
      if (tdTarget) {
        const cleanedTdStyles = (tdTarget.getAttribute('style') || '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => {
            const prop = s.split(':')[0].trim().toLowerCase();
            return ![
              'background-color',
              'padding',
              'padding-top',
              'padding-right',
              'padding-bottom',
              'padding-left',
              'border',
              'border-radius',
              'border-color',
              'border-width',
              'border-style',
              'box-shadow',
            ].includes(prop);
          })
          .join('; ');
        tdTarget.setAttribute('style', cleanedTdStyles);
      }

      anchorTarget.setAttribute(
        'style',
        "text-decoration: none; color: rgb(37, 99, 235); font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 12px; pointer-events: auto !important; cursor: text !important;"
      );
      return;
    }

    // For buttons where the node is a td, split properties:
    // - Background, padding, border-radius -> td
    // - Text color, font properties -> anchor
    if (isTdButton && anchorTarget) {
      // Apply container properties (background, padding, border-radius) to td
      const containerStyles: string[] = [];
      if (element.properties?.backgroundColor) {
        containerStyles.push(`background-color: ${element.properties.backgroundColor} !important`);
      }
      if (element.properties?.borderRadius) {
        containerStyles.push(`border-radius: ${element.properties.borderRadius} !important`);
      }
      // Handle padding
      const padding = element.properties?.padding;
      const paddingTop = (element.properties as any)?.paddingTop;
      const paddingBottom = (element.properties as any)?.paddingBottom;
      const paddingLeft = (element.properties as any)?.paddingLeft;
      const paddingRight = (element.properties as any)?.paddingRight;
      if (paddingTop !== undefined || paddingBottom !== undefined || paddingLeft !== undefined || paddingRight !== undefined) {
        if (paddingTop !== undefined) {
          const topValue = String(paddingTop) + (String(paddingTop).match(/px|em|rem|%/) ? '' : 'px');
          containerStyles.push(`padding-top: ${topValue}`);
        }
        if (paddingRight !== undefined) {
          const rightValue = String(paddingRight) + (String(paddingRight).match(/px|em|rem|%/) ? '' : 'px');
          containerStyles.push(`padding-right: ${rightValue}`);
        }
        if (paddingBottom !== undefined) {
          const bottomValue = String(paddingBottom) + (String(paddingBottom).match(/px|em|rem|%/) ? '' : 'px');
          containerStyles.push(`padding-bottom: ${bottomValue}`);
        }
        if (paddingLeft !== undefined) {
          const leftValue = String(paddingLeft) + (String(paddingLeft).match(/px|em|rem|%/) ? '' : 'px');
          containerStyles.push(`padding-left: ${leftValue}`);
        }
      } else if (padding !== undefined) {
        // Apply padding value, including 0 - user wants full control
        containerStyles.push(`padding: ${padding}`);
      }
      // Check if we're controlling padding - if so, remove ALL existing padding first
      const hasButtonPadding = padding !== undefined || paddingTop !== undefined || paddingBottom !== undefined || paddingLeft !== undefined || paddingRight !== undefined;
      
      if (hasButtonPadding || containerStyles.length > 0) {
        const existingStyle = node.getAttribute('style') || '';
        const existingStyles = existingStyle.split(';').filter(s => s.trim());
        
        // If we're controlling padding, remove ALL padding from existing styles
        // This ensures the controls are the single source of truth
        const filteredStyles = existingStyles.filter(s => {
          const prop = s.split(':')[0].trim().toLowerCase();
          // Remove old background/background-color, padding, border-radius from existing styles
          // Always remove padding if we're controlling it
          if (hasButtonPadding && prop.startsWith('padding')) {
            return false; // Remove all padding - controls determine it
          }
          return !['background', 'background-color', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-radius'].includes(prop);
        });
        
        // Add !important to padding properties to ensure they override existing styles
        const finalContainerStyles = containerStyles.map(style => {
          if (style.trim().startsWith('padding')) {
            if (!style.includes('!important')) {
              return style.replace(/;?\s*$/, '') + ' !important';
            }
          }
          return style;
        });
        const newStyle = [...filteredStyles, ...finalContainerStyles].join('; ').replace(/;\s*;/g, ';');
        node.setAttribute('style', newStyle);
      }
      
      // Apply text/font properties to anchor
      const anchorStyles: string[] = [];
      anchorStyles.push(`text-decoration: none`);
      if (element.properties?.textColor) {
        anchorStyles.push(`color: ${element.properties.textColor}`);
      }
      if (element.properties?.fontSize) {
        anchorStyles.push(`font-size: ${element.properties.fontSize}`);
      }
      if (element.properties?.fontWeight) {
        anchorStyles.push(`font-weight: ${element.properties.fontWeight}`);
      }
      if (element.properties?.fontFamily) {
        anchorStyles.push(`font-family: ${element.properties.fontFamily}`);
      }
      if (anchorStyles.length > 0) {
        const existingStyle = anchorTarget.getAttribute('style') || '';
        const existingStyles = existingStyle.split(';').filter(s => s.trim());
        // Remove old text/font properties from existing styles
        const filteredStyles = existingStyles.filter(s => {
          const prop = s.split(':')[0].trim().toLowerCase();
          return !['color', 'font-size', 'font-weight', 'font-family', 'text-decoration'].includes(prop);
        });
        const newStyle = [...filteredStyles, ...anchorStyles].join('; ').replace(/;\s*;/g, ';');
        anchorTarget.setAttribute('style', newStyle);
      }
      if (element.properties?.userSetTextColor && element.properties?.textColor) {
        anchorTarget.setAttribute('data-user-text-color', 'true');
      } else {
        anchorTarget.removeAttribute('data-user-text-color');
      }
    } else {
      // Rebuild style attribute from scratch for all style targets to ensure current state is captured
      styleTargets.forEach(target => {
        rebuildStyleAttribute(target, element, templateData);
      });
    }
    
    // Apply visibility styles directly after rebuildStyleAttribute to ensure they take precedence
    // This is especially important for price elements which need special handling
    if (element.visible === false && node instanceof HTMLElement) {
      // Special handling for footer links: hide adjacent separator cells by ID
      if (element.id.includes('footer_link_unsubscribe') || element.id.includes('footer-link-unsubscribe')) {
        const separator = doc.getElementById('link_4_separator');
        if (separator && separator instanceof HTMLElement) {
          separator.style.setProperty('display', 'none', 'important');
        }
      } else if (element.id.includes('footer_link_help') || element.id.includes('footer-link-help')) {
        const separator = doc.getElementById('link_3_separator');
        if (separator && separator instanceof HTMLElement) {
          separator.style.setProperty('display', 'none', 'important');
        }
      } else if (element.id.includes('footer_link_terms') || element.id.includes('footer-link-terms')) {
        const separator = doc.getElementById('link_2_separator');
        if (separator && separator instanceof HTMLElement) {
          separator.style.setProperty('display', 'none', 'important');
        }
      }
      
      // Check for price-related elements: price, subtotal, shipping, tax, total
      const isPriceElement = 
        element.id.includes('price') || 
        element.id.includes('subtotal') || 
        element.id.includes('shipping') || 
        element.id.includes('tax') || 
        element.id.includes('total') ||
        labelLc.includes('price') ||
        labelLc.includes('subtotal') ||
        labelLc.includes('shipping') ||
        labelLc.includes('tax') ||
        labelLc.includes('total');
      
      if (isPriceElement) {
        // For price elements, ensure display:none is applied directly
        node.style.setProperty('display', 'none', 'important');
        
        // Special handling for Products Grid prices: also hide the parent table structure
        if (element.id.includes('products_grid') || element.id.includes('product_grid')) {
          // Find the parent table that contains this price element
          const parentTable = node.closest('table');
          if (parentTable && parentTable instanceof HTMLElement) {
            // Check if this is the table that directly contains the price span
            const containsPriceSpan = parentTable.querySelector('span[data-element*="price"]');
            if (containsPriceSpan === node) {
              // This is the direct parent table, hide it
              parentTable.style.setProperty('display', 'none', 'important');
            }
          }
          
          // Also try to find and hide the corresponding MSO version
          const dataElementValue = node.getAttribute('data-element');
          if (dataElementValue) {
            // Determine the MSO data-element value
            let msoDataElement: string;
            if (dataElementValue.endsWith('-mso')) {
              // Already MSO version, find the non-MSO version
              msoDataElement = dataElementValue.replace(/-mso$/, '');
            } else {
              // Non-MSO version, find the MSO version
              msoDataElement = dataElementValue + '-mso';
            }
            
            const msoElement = doc.querySelector(`span[data-element="${msoDataElement}"]`);
            if (msoElement && msoElement instanceof HTMLElement) {
              msoElement.style.setProperty('display', 'none', 'important');
              // Also hide the parent table of the MSO version
              const msoParentTable = msoElement.closest('table');
              if (msoParentTable && msoParentTable instanceof HTMLElement) {
                msoParentTable.style.setProperty('display', 'none', 'important');
              }
            }
          }
        }
        
        // Special handling for Single Product MSO prices
        // If this is a Single Product MSO price element, also hide the corresponding non-MSO version
        if (element.id.includes('single_product') && node.hasAttribute('data-element')) {
          const dataElementValue = node.getAttribute('data-element');
          if (dataElementValue) {
            if (dataElementValue.includes('-mso-')) {
              // This is an MSO version (e.g., single-product-regular-price-mso-1)
              // Find the corresponding non-MSO version (e.g., single-product-regular-price)
              const nonMsoDataElement = dataElementValue.replace(/-mso-\d+$/, '').replace(/-mso$/, '');
              const nonMsoElement = doc.querySelector(`span[data-element="${nonMsoDataElement}"]`);
              if (nonMsoElement && nonMsoElement instanceof HTMLElement) {
                nonMsoElement.style.setProperty('display', 'none', 'important');
                const nonMsoParentTable = nonMsoElement.closest('table');
                if (nonMsoParentTable && nonMsoParentTable instanceof HTMLElement) {
                  nonMsoParentTable.style.setProperty('display', 'none', 'important');
                }
              }
            } else {
              // This is a non-MSO Single Product price (e.g., single-product-regular-price)
              // Find the corresponding MSO version (e.g., single-product-regular-price-mso-1)
              const msoDataElement = dataElementValue + '-mso-1';
              const msoElement = doc.querySelector(`span[data-element="${msoDataElement}"]`);
              if (msoElement && msoElement instanceof HTMLElement) {
                msoElement.style.setProperty('display', 'none', 'important');
                const msoParentTable = msoElement.closest('table');
                if (msoParentTable && msoParentTable instanceof HTMLElement) {
                  msoParentTable.style.setProperty('display', 'none', 'important');
                }
              }
            }
          }
        }
      }
    } else if (element.visible === true && node instanceof HTMLElement) {
      // Special handling for footer links: show adjacent separator cells by ID
      if (element.id.includes('footer_link_unsubscribe') || element.id.includes('footer-link-unsubscribe')) {
        const separator = doc.getElementById('link_4_separator');
        if (separator && separator instanceof HTMLElement) {
          separator.style.removeProperty('display');
        }
      } else if (element.id.includes('footer_link_help') || element.id.includes('footer-link-help')) {
        const separator = doc.getElementById('link_3_separator');
        if (separator && separator instanceof HTMLElement) {
          separator.style.removeProperty('display');
        }
      } else if (element.id.includes('footer_link_terms') || element.id.includes('footer-link-terms')) {
        const separator = doc.getElementById('link_2_separator');
        if (separator && separator instanceof HTMLElement) {
          separator.style.removeProperty('display');
        }
      }
      
      // Check for price-related elements when showing
      const isPriceElement = 
        element.id.includes('price') || 
        element.id.includes('subtotal') || 
        element.id.includes('shipping') || 
        element.id.includes('tax') || 
        element.id.includes('total') ||
        labelLc.includes('price') ||
        labelLc.includes('subtotal') ||
        labelLc.includes('shipping') ||
        labelLc.includes('tax') ||
        labelLc.includes('total');
      
      if (isPriceElement) {
        // For price elements, ensure display is removed
        node.style.removeProperty('display');
        
        // Special handling for Products Grid prices: also show the parent table structure
        if (element.id.includes('products_grid') || element.id.includes('product_grid')) {
          // Find the parent table that contains this price element
          const parentTable = node.closest('table');
          if (parentTable && parentTable instanceof HTMLElement) {
            // Check if this is the table that directly contains the price span
            const containsPriceSpan = parentTable.querySelector('span[data-element*="price"]');
            if (containsPriceSpan === node) {
              // This is the direct parent table, show it
              parentTable.style.removeProperty('display');
            }
          }
          
          // Also try to find and show the corresponding MSO version
          const dataElementValue = node.getAttribute('data-element');
          if (dataElementValue) {
            // Determine the MSO data-element value
            let msoDataElement: string;
            if (dataElementValue.endsWith('-mso')) {
              // Already MSO version, find the non-MSO version
              msoDataElement = dataElementValue.replace(/-mso$/, '');
            } else {
              // Non-MSO version, find the MSO version
              msoDataElement = dataElementValue + '-mso';
            }
            
            const msoElement = doc.querySelector(`span[data-element="${msoDataElement}"]`);
            if (msoElement && msoElement instanceof HTMLElement) {
              msoElement.style.removeProperty('display');
              // Also show the parent table of the MSO version
              const msoParentTable = msoElement.closest('table');
              if (msoParentTable && msoParentTable instanceof HTMLElement) {
                msoParentTable.style.removeProperty('display');
              }
            }
          }
        }
        
        // Special handling for Single Product MSO prices
        // If this is a Single Product MSO price element, also show the corresponding non-MSO version
        if (element.id.includes('single_product') && node.hasAttribute('data-element')) {
          const dataElementValue = node.getAttribute('data-element');
          if (dataElementValue) {
            if (dataElementValue.includes('-mso-')) {
              // This is an MSO version (e.g., single-product-regular-price-mso-1)
              // Find the corresponding non-MSO version (e.g., single-product-regular-price)
              const nonMsoDataElement = dataElementValue.replace(/-mso-\d+$/, '').replace(/-mso$/, '');
              const nonMsoElement = doc.querySelector(`span[data-element="${nonMsoDataElement}"]`);
              if (nonMsoElement && nonMsoElement instanceof HTMLElement) {
                nonMsoElement.style.removeProperty('display');
                const nonMsoParentTable = nonMsoElement.closest('table');
                if (nonMsoParentTable && nonMsoParentTable instanceof HTMLElement) {
                  nonMsoParentTable.style.removeProperty('display');
                }
              }
            } else {
              // This is a non-MSO Single Product price (e.g., single-product-regular-price)
              // Find the corresponding MSO version (e.g., single-product-regular-price-mso-1)
              const msoDataElement = dataElementValue + '-mso-1';
              const msoElement = doc.querySelector(`span[data-element="${msoDataElement}"]`);
              if (msoElement && msoElement instanceof HTMLElement) {
                msoElement.style.removeProperty('display');
                const msoParentTable = msoElement.closest('table');
                if (msoParentTable && msoParentTable instanceof HTMLElement) {
                  msoParentTable.style.removeProperty('display');
                }
              }
            }
          }
        }
      }
    }
    
    // Special handling for Step 1, 2, 3 numbers: hide the parent table (circle) when number is hidden
    if (templateData && (element.id === 'text_step_1_number' || element.id === 'text_step_2_number' || element.id === 'text_step_3_number')) {
      const parentTable = node.closest('table');
      if (parentTable && parentTable instanceof HTMLElement) {
        const stepNumber = templateData.elements.find(e => e.id === element.id);
        const numberHidden = stepNumber?.visible === false;
        
        if (numberHidden) {
          // Hide the parent table (circle) if number is hidden
          parentTable.style.setProperty('display', 'none', 'important');
        } else {
          // Show the parent table (circle) if number is visible
          parentTable.style.removeProperty('display');
        }
      }
    }
    
    // Special handling for non-price text elements inside table cells: also hide parent td when element is hidden
    // This ensures proper hiding in email HTML where table cells can maintain spacing even when content is hidden
    // Note: Price elements are handled earlier in this function, right after rebuildStyleAttribute
    if (element.type === 'text' && element.visible === false && node instanceof HTMLElement) {
      // Check if this is a price element - if so, skip this section (already handled above)
      const isPriceElement = 
        element.id.includes('price') || 
        element.id.includes('subtotal') || 
        element.id.includes('shipping') || 
        element.id.includes('tax') || 
        element.id.includes('total') ||
        labelLc.includes('price') ||
        labelLc.includes('subtotal') ||
        labelLc.includes('shipping') ||
        labelLc.includes('tax') ||
        labelLc.includes('total');
      
      // Only handle non-price elements here
      if (!isPriceElement) {
        const parentTd = node.closest('td');
        if (parentTd && parentTd instanceof HTMLElement && parentTd !== node) {
          // Only hide the parent td if it only contains this element (or whitespace)
          const tdContent = parentTd.textContent?.trim() || '';
          const elementText = (element.value || element.defaultValue || '').trim();
          // Check if the td content matches the element text (allowing for whitespace)
          if (tdContent === elementText || parentTd.querySelectorAll('*').length === 1) {
            parentTd.style.setProperty('display', 'none', 'important');
          } else {
            // If td contains other content, just ensure the element itself is hidden
            node.style.setProperty('display', 'none', 'important');
          }
        }
      }
    } else if (element.type === 'text' && element.visible === true && node instanceof HTMLElement) {
      // Show non-price elements - price elements are handled earlier
      const isPriceElement = 
        element.id.includes('price') || 
        element.id.includes('subtotal') || 
        element.id.includes('shipping') || 
        element.id.includes('tax') || 
        element.id.includes('total') ||
        labelLc.includes('price') ||
        labelLc.includes('subtotal') ||
        labelLc.includes('shipping') ||
        labelLc.includes('tax') ||
        labelLc.includes('total');
      
      // Only handle non-price elements here
      if (!isPriceElement) {
        // Show the parent td when element becomes visible
        const parentTd = node.closest('td');
        if (parentTd && parentTd instanceof HTMLElement) {
          parentTd.style.removeProperty('display');
        }
      }
    }
    
    
    // Handle special cases for sections and buttons/links
    if (element.type === 'section' && node instanceof HTMLTableElement) {
        const firstRow = node.querySelector('tr');
        if (firstRow) {
          const firstTd = firstRow.querySelector('td') as HTMLElement | null;
          if (firstTd) {
          rebuildStyleAttribute(firstTd, element);
          }
        }
      } else if (element.type === 'section' && node instanceof HTMLTableRowElement) {
        const demoHeading = node.querySelector('[data-element="demo-heading"]');
        if (demoHeading) {
          let demoDiv = demoHeading.parentElement;
          while (demoDiv && demoDiv.tagName !== 'DIV') {
            demoDiv = demoDiv.parentElement;
          }
          if (demoDiv && demoDiv instanceof HTMLElement) {
          rebuildStyleAttribute(demoDiv, element, templateData);
          }
        } else {
          const featureDemoDiv = node.querySelector('div[style*="background-color: #f9fafb"], div[style*="background-color:#f9fafb"]') as HTMLElement | null;
          if (featureDemoDiv) {
          rebuildStyleAttribute(featureDemoDiv, element, templateData);
          } else {
            const firstTd = node.querySelector('td') as HTMLElement | null;
            if (firstTd) {
            rebuildStyleAttribute(firstTd, element, templateData);
          }
        }
      }
    } else if (element.type === 'section' && node instanceof HTMLDivElement) {
      // For div sections, apply styles directly to the div
      rebuildStyleAttribute(node, element, templateData);
    } else if (element.type === 'section' && node instanceof HTMLTableCellElement) {
      // For td sections, apply styles directly to the td
      rebuildStyleAttribute(node, element, templateData);
    }
    
    // Handle buttons/links - apply to anchor target as well (only if not td button)
    if (anchorTarget && (element.type === 'button' || isButtonLikeLink) && !isTdButton) {
      rebuildStyleAttribute(anchorTarget, element, templateData);
    }
  }, [rebuildStyleAttribute]);

  const applyElementsToHtml = useCallback((html: string, templateData: DynamicTemplate): string => {
    if (!domParserRef.current) {
      return html;
    }
    const doc = domParserRef.current.parseFromString(html, 'text/html');

    templateData.elements.forEach(element => {
      const targets = findNodesForElement(doc, element);

      targets.forEach(node => {
        switch (element.type) {
          case 'image': {
            if (node instanceof HTMLImageElement) {
              const src = element.value || element.defaultValue;
              if (src) {
                node.setAttribute('src', src);
              }
              if (element.properties?.alt) {
                node.setAttribute('alt', element.properties.alt);
              }
              
              // Apply href to parent <a> tag if it exists
              if (element.properties?.href) {
                const parentLink = node.closest('a');
                if (parentLink) {
                  parentLink.setAttribute('href', element.properties.href);
                } else {
                  // If no parent link exists, create one
                  const parent = node.parentElement;
                  if (parent) {
                    const link = doc.createElement('a');
                    link.setAttribute('href', element.properties.href);
                    parent.insertBefore(link, node);
                    link.appendChild(node);
                  }
                }
              }
              
              // Check if this is a logo image
              const label = element.label?.toLowerCase() ?? '';
              const altText = (element.properties?.alt || '').toLowerCase();
              const isLogo = element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo' || label.includes('logo') || label.includes('brand') || altText.includes('logo') || altText.includes('brand');
              
              // Check if image is in Hero Product section
              const isHeroProductImage = template?.sections?.some(section => 
                section && section.elements?.includes(element.id) && 
                (section.id === 'hero_product' || section.name?.toLowerCase() === 'hero product')
              ) || false;
              
              // Skip setting width for Hero Product images (they use width: auto)
              if (element.properties?.width && !isHeroProductImage) {
                const widthValue = String(element.properties.width);
                node.setAttribute('width', widthValue);
                // Ensure inline style width matches the attribute to prevent compression
                // Parse the width value to handle both numbers and strings with units
                const widthNum = parseInt(widthValue, 10);
                if (!isNaN(widthNum)) {
                  const widthUnit = widthValue.replace(/^\d+/, '') || 'px';
                  const targetWidth = `${widthNum}${widthUnit}`;
                  node.style.width = targetWidth;
                  // For logos, remove any responsive styles that might compress the image
                  if (isLogo) {
                    node.style.maxWidth = '';
                    // Parse existing style attribute to check for width: 100% or other responsive styles
                    const existingStyle = node.getAttribute('style') || '';
                    if (existingStyle.includes('width') && (existingStyle.includes('100%') || existingStyle.includes('max-width'))) {
                      // Remove width: 100% and max-width from the style string
                      let cleanedStyle = existingStyle
                        .replace(/width\s*:\s*100%\s*;?/gi, '')
                        .replace(/max-width\s*:[^;]+;?/gi, '')
                        .replace(/;\s*;/g, ';')
                        .trim();
                      // Add back the correct width
                      if (cleanedStyle && !cleanedStyle.endsWith(';')) {
                        cleanedStyle += ';';
                      }
                      cleanedStyle += ` width: ${targetWidth};`;
                      node.setAttribute('style', cleanedStyle);
                    }
                  }
                }
              }
              // For logos, always set height to auto (ignore any height property)
              if (isLogo) {
                node.setAttribute('height', 'auto');
              } else if (element.properties?.height) {
                // For non-logo images, use the height property if set
                const heightValue = String(element.properties.height);
                node.setAttribute('height', heightValue);
                // Ensure inline style height matches the attribute to prevent compression
                const heightNum = parseInt(heightValue, 10);
                if (!isNaN(heightNum)) {
                  const heightUnit = heightValue.replace(/^\d+/, '') || 'px';
                  const targetHeight = `${heightNum}${heightUnit}`;
                  node.style.height = targetHeight;
                }
              }
              
              // For logos, ensure display is block and prevent any compression
              // Use only email-compatible CSS (no flex, grid, or modern CSS)
              if (isLogo) {
                // Check if logo is in header section
                const isHeaderLogo = template?.sections?.some(section => 
                  section && section.elements?.includes(element.id) && 
                  (section.name?.toLowerCase().includes('header') || section.id?.toLowerCase().includes('header'))
                ) || false;
                
                // Apply default header logo styling
                if (isHeaderLogo) {
                  // Default width if not set
                  if (!element.properties?.width) {
                    node.setAttribute('width', '180');
                    node.style.width = '180px';
                  }
                  // Always set height to auto for header logos
                  node.setAttribute('height', 'auto');
                  node.style.height = 'auto';
                  
                  // Apply default styles
                  node.style.display = 'block';
                  node.style.margin = '0px auto 20px';
                  node.style.border = '0px';
                  node.style.setProperty('pointer-events', 'auto', 'important');
                  
                  // Remove any responsive styles that might compress logos
                  node.style.maxWidth = '';
                  
                  // Apply border-radius and padding to parent container (td) if it exists
                  const parentTd = node.closest('td');
                  if (parentTd instanceof HTMLElement) {
                    parentTd.style.setProperty('border-radius', '8px 8px 0px 0px', 'important');
                    parentTd.style.setProperty('padding', '30px 20px', 'important');
                  }
                } else {
                  // For non-header logos, just apply basic styling
                  node.style.display = 'block';
                  node.style.maxWidth = '';
                }
                
                // Ensure logo maintains its exact dimensions using email-compatible properties only
                // Note: object-fit is not well-supported in email clients, so we rely on width/height attributes
              }
              
              // Apply default Hero Product image styling
              if (isHeroProductImage && !isLogo) {
                // Remove width attribute to allow auto width
                node.removeAttribute('width');
                
                // Remove width and max-width from style object directly
                node.style.removeProperty('width');
                node.style.removeProperty('max-width');
                
                // Clean up inline style attribute string to remove width: 100% and old max-width
                const existingStyle = node.getAttribute('style') || '';
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
                  node.setAttribute('style', cleanedStyle);
                }
                
                // Apply Hero Product styling with !important to ensure it overrides
                node.style.setProperty('width', 'auto', 'important');
                node.style.setProperty('border-radius', '12px', 'important');
                node.style.setProperty('border', '0px', 'important');
                node.style.setProperty('margin', '0px auto 25px', 'important');
                node.style.setProperty('pointer-events', 'auto', 'important');
                node.style.setProperty('max-width', '600px', 'important');
              }
            }
            break;
          }
          case 'button':
          case 'link':
          case 'heading':
          case 'text': {
            const value = element.value ?? element.defaultValue ?? '';
            if (node instanceof HTMLElement) {
              // For buttons, if the node is a td, update the anchor inside it instead
              if (element.type === 'button' && node.tagName.toLowerCase() === 'td') {
                const anchor = node.querySelector('a');
                if (anchor) {
                  // Footer social icons can optionally render as <img> inside the anchor.
                  if (element.id.startsWith('footer_social_')) {
                    const iconSrc = element.properties?.iconSrc || element.properties?.imageSrc || '';
                    if (iconSrc) {
                      let img = anchor.querySelector('img') as HTMLImageElement | null;
                      if (!img) {
                        img = doc.createElement('img');
                        anchor.appendChild(img);
                      }

                      img.setAttribute('src', iconSrc);
                      img.setAttribute('alt', String(value || element.label || ''));
                      img.style.setProperty('display', 'inline-block', 'important');
                      img.style.setProperty('border', '0', 'important');
                      img.style.setProperty('max-width', '100%', 'important');
                      img.style.setProperty('height', 'auto', 'important');

                      // Render icon-only: remove existing text and ensure we keep the img node
                      anchor.textContent = '';
                      anchor.appendChild(img);

                      if (element.properties?.url) {
                        anchor.setAttribute('href', element.properties.url);
                      }
                    } else {
                      anchor.textContent = value;
                      if (element.properties?.url) {
                        anchor.setAttribute('href', element.properties.url);
                      }
                    }
                  } else {
                    anchor.textContent = value;
                    if (element.properties?.url) {
                      anchor.setAttribute('href', element.properties.url);
                    }
                  }
                } else {
                  // Fallback: update the td if no anchor found
                  node.textContent = value;
                }
              } else {
                // Social footer links can optionally render an icon image instead of text.
                let socialIconHandled = false;
                if ((element.type === 'link' || element.type === 'button') && element.id.startsWith('footer_social_')) {
                  const iconSrc = element.properties?.iconSrc || element.properties?.imageSrc || '';
                  if (iconSrc) {
                    // Prefer rendering as: <a><img/></a>
                    if (node.tagName.toLowerCase() === 'a') {
                      const anchor = node as HTMLAnchorElement;
                      let img = anchor.querySelector('img') as HTMLImageElement | null;
                      if (!img) {
                        img = doc.createElement('img');
                        anchor.appendChild(img);
                      }

                      img.setAttribute('src', iconSrc);
                      img.setAttribute('alt', String(value || element.label || ''));
                      img.style.setProperty('display', 'inline-block', 'important');
                      img.style.setProperty('border', '0', 'important');
                      img.style.setProperty('max-width', '100%', 'important');
                      img.style.setProperty('height', 'auto', 'important');

                      // Remove any existing text (we're rendering icon-only)
                      anchor.textContent = '';
                      anchor.appendChild(img);

                      if (element.properties?.url) {
                        anchor.setAttribute('href', element.properties.url);
                      }

                      socialIconHandled = true;
                    }
                  }
                }

                if (!socialIconHandled) {
                  // For text elements, ensure we're updating the correct node
                  // If the node is a span inside a td, make sure we update the span, not the td
                  if (element.type === 'text' && node.tagName.toLowerCase() === 'span' && node.hasAttribute('data-element')) {
                    // This is the correct span element, update it
                    node.textContent = value;
                  } else if (element.type === 'text' && node.tagName.toLowerCase() !== 'span') {
                    // If we somehow got a non-span element, try to find the span inside it
                    const span = node.querySelector('span[data-element]');
                    if (span) {
                      span.textContent = value;
                    } else {
                      // Fallback: update the node itself
                      node.textContent = value;
                    }
                  } else {
                    // For other types (heading, link, button), update directly
                    node.textContent = value;
                    if ((element.type === 'link' || element.type === 'button') && element.properties?.url) {
                      node.setAttribute('href', element.properties.url);
                    }
                  }
                }
              }
            }
            break;
          }
          case 'section': {
            // Section elements don't have text content, just apply properties
            break;
          }
          default: {
            const value = element.value ?? element.defaultValue ?? '';
            if (node instanceof HTMLElement) {
              node.textContent = value;
            }
            break;
          }
        }

        applyElementPropertiesToNode(node, element, templateData);
      });
    });
    
    // Special handling for Metrics Block: hide the parent <tr> when all elements are hidden
    const metricsSection = templateData.sections?.find(s => s.name === 'Metrics Block');
    if (metricsSection) {
      // Check if all elements in Metrics Block are hidden
      const allMetricsElementsHidden = metricsSection.elements.every(elementId => {
        const el = templateData.elements.find(e => e.id === elementId);
        return el?.visible === false;
      });
      
      if (allMetricsElementsHidden) {
        // Find the parent <tr> with id="metrics_text_content"
        const metricsTr = doc.querySelector('tr#metrics_text_content');
        if (metricsTr instanceof HTMLElement) {
          metricsTr.style.setProperty('display', 'none', 'important');
        }
      } else {
        // Show the parent <tr> if at least one element is visible
        const metricsTr = doc.querySelector('tr#metrics_text_content');
        if (metricsTr instanceof HTMLElement) {
          metricsTr.style.removeProperty('display');
        }
      }
    }
    
    // Special handling for Steps table: hide when all 3 steps are completely hidden
    // A step is completely hidden when all its elements (number, heading, description) are hidden
    const step1Elements = ['text_step_1_number', 'heading_sub_1', 'text_step_1_description'];
    const step2Elements = ['text_step_2_number', 'heading_sub_2', 'text_step_2_description'];
    const step3Elements = ['text_step_3_number', 'heading_sub_3', 'text_step_3_description'];
    
    const isStepCompletelyHidden = (stepElementIds: string[]): boolean => {
      return stepElementIds.every(elementId => {
        const el = templateData.elements.find(e => e.id === elementId);
        return el?.visible === false;
      });
    };
    
    const step1Hidden = isStepCompletelyHidden(step1Elements);
    const step2Hidden = isStepCompletelyHidden(step2Elements);
    const step3Hidden = isStepCompletelyHidden(step3Elements);
    
    // If all 3 steps are completely hidden, hide the Steps table
    if (step1Hidden && step2Hidden && step3Hidden) {
      const stepsTable = doc.querySelector('table[data-element="steps-table"]');
      if (stepsTable instanceof HTMLElement) {
        stepsTable.style.setProperty('display', 'none', 'important');
      }
    } else {
      // Show the Steps table if any step is visible
      const stepsTable = doc.querySelector('table[data-element="steps-table"]');
      if (stepsTable instanceof HTMLElement) {
        stepsTable.style.removeProperty('display');
      }
    }
    
    // Special handling for footer links: hide/show separator cells by ID
    templateData.elements.forEach(element => {
      if (element.id.includes('footer_link_unsubscribe') || element.id.includes('footer-link-unsubscribe')) {
        const separator = doc.getElementById('link_4_separator');
        if (separator && separator instanceof HTMLElement) {
          if (element.visible === false) {
            separator.style.setProperty('display', 'none', 'important');
          } else {
            separator.style.removeProperty('display');
          }
        }
      } else if (element.id.includes('footer_link_help') || element.id.includes('footer-link-help')) {
        const separator = doc.getElementById('link_3_separator');
        if (separator && separator instanceof HTMLElement) {
          if (element.visible === false) {
            separator.style.setProperty('display', 'none', 'important');
          } else {
            separator.style.removeProperty('display');
          }
        }
      } else if (element.id.includes('footer_link_terms') || element.id.includes('footer-link-terms')) {
        const separator = doc.getElementById('link_2_separator');
        if (separator && separator instanceof HTMLElement) {
          if (element.visible === false) {
            separator.style.setProperty('display', 'none', 'important');
          } else {
            separator.style.removeProperty('display');
          }
        }
      }
    });
    
    return syncMsoStepBadgeFillcolors(doc.documentElement.outerHTML, templateData);
  }, [applyElementPropertiesToNode, findNodesForElement]);

  const generatePreviewHtml = useCallback((templateData: DynamicTemplate): string => {
    const themeCssMode: ThemeCssMode = templateData.meta.themeCssMode ?? 'adaptive';
    const baseHtml =
      templateData.html && templateData.html.trim().length > 0
        ? templateData.html
        : originalHtmlRef.current || '';
    let html = baseHtml;
    
    // Early application: Ensure width: 100% is on order-details-total-wrapper before any other processing
    // This must happen first to ensure it's not lost during other transformations
    html = html.replace(
      /<td([^>]*data-element=["']order-details-total-wrapper["'][^>]*)>/gi,
      (match, attrs) => {
        // Check if style attribute exists
        const styleMatch = attrs.match(/style=["']([^"']*)["']/);
        if (styleMatch) {
          const styleContent = styleMatch[1];
          // Check if width: 100% is already present (check for both formats)
          if (!styleContent.includes('width: 100%') && !styleContent.includes('width:100%') && !styleContent.includes('width:100%;')) {
            const separator = styleContent.trim() && !styleContent.trim().endsWith(';') ? '; ' : ' ';
            const newStyle = styleContent + separator + 'width: 100%';
            return match.replace(/style=["'][^"']*["']/, `style="${newStyle}"`);
          }
        } else {
          // No style attribute, add one
          return match.replace(/>$/, ' style="width: 100%">');
        }
        return match;
      }
    );
    
    // Handle section-level visibility by hiding entire component blocks
    if (templateData.sections) {
      // First, identify which sections are visible and find the last visible one
      const visibleSections = templateData.sections.filter(s => s.visible);
      const lastVisibleSection = visibleSections.length > 0 ? visibleSections[visibleSections.length - 1] : null;
      const isFooterHidden = templateData.sections.find(s => s.id === 'footer' && !s.visible);
      
      // Process sections in reverse order to avoid matching issues with similar names
      // (e.g., "Hero Block" should be processed before "Hero" to avoid partial matches)
      const sortedSections = [...templateData.sections].sort((a, b) => {
        // Sort by name length (longer names first) to process "Hero Block" before "Hero"
        return b.name.length - a.name.length;
      });
      
      sortedSections.forEach(section => {
        if (!section.visible) {
          // Find the component start/end markers for this section
          // Use exact matching to prevent partial matches (e.g., "Hero" matching "Hero Block")
          const escapeMarker = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Ensure exact match by using the full comment format with exact section name
          const startMarker = escapeMarker(`<!-- Component start ${section.name} -->`);
          const endMarker = escapeMarker(`<!-- Component end ${section.name} -->`);
          
          // Match everything between the start and end markers (non-greedy)
          // This ensures we only match the exact section, not sections with similar names
          const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
          
          // When a component is hidden, hide ALL <tr> elements inside that component
          html = html.replace(pattern, (match) => {
            // Hide ALL <tr> elements within the component block
            let result = match.replace(/<tr([^>]*)>/g, (trMatch, trAttrs) => {
              // Check if style attribute already exists
              if (trAttrs.includes('style=')) {
                // Add display:none to existing style, ensuring !important
                return trMatch.replace(/style="([^"]*)"/, (styleMatch, styleContent) => {
                  // Remove any existing display property and add display:none !important
                  const cleanedStyle = styleContent.replace(/display\s*:\s*[^;]+;?/gi, '').trim();
                  const newStyle = cleanedStyle 
                    ? `${cleanedStyle}; display: none !important;`
                    : 'display: none !important;';
                  return `style="${newStyle}"`;
                });
              } else {
                // Add style attribute with display:none
                return `<tr${trAttrs} style="display: none !important;">`;
              }
            });
            
            // Remove bottom border-radius from footer when hiding it
            if (section.id === 'footer' || section.name.toLowerCase() === 'footer') {
              result = result.replace(/border-radius:\s*0\s+0\s+\d+px\s+\d+px[;"\s]/gi, '');
              result = result.replace(/border-radius[^;]*;\s*/gi, (match) => {
                // Remove bottom border-radius values
                return match.replace(/0\s+0\s+\d+px\s+\d+px/g, '').replace(/border-radius:\s*;/g, '');
              });
            }
            return result;
          });
          
          // Specifically hide hero_block_text_content and hero_text_content elements when their sections are hidden
          if (section.id === 'hero_block' || section.name === 'Hero Block') {
            html = html.replace(/<tr\s+id="hero_block_text_content"([^>]*)>/g, (trMatch, trAttrs) => {
              if (trAttrs.includes('style=')) {
                return trMatch.replace(/style="([^"]*)"/, (styleMatch, styleContent) => {
                  const cleanedStyle = styleContent.replace(/display\s*:\s*[^;]+;?/gi, '').trim();
                  const newStyle = cleanedStyle 
                    ? `${cleanedStyle}; display: none !important;`
                    : 'display: none !important;';
                  return `style="${newStyle}"`;
                });
              } else {
                return `<tr id="hero_block_text_content"${trAttrs} style="display: none !important;">`;
              }
            });
          }
          
          if (section.id === 'hero' || section.name === 'Hero') {
            html = html.replace(/<tr\s+id="hero_text_content"([^>]*)>/g, (trMatch, trAttrs) => {
              if (trAttrs.includes('style=')) {
                return trMatch.replace(/style="([^"]*)"/, (styleMatch, styleContent) => {
                  const cleanedStyle = styleContent.replace(/display\s*:\s*[^;]+;?/gi, '').trim();
                  const newStyle = cleanedStyle 
                    ? `${cleanedStyle}; display: none !important;`
                    : 'display: none !important;';
                  return `style="${newStyle}"`;
                });
              } else {
                return `<tr id="hero_text_content"${trAttrs} style="display: none !important;">`;
              }
            });
          }
          
          // Specifically hide metrics_text_content element when Metrics Block section is hidden
          if (section.id === 'metrics_block' || section.name === 'Metrics Block') {
            html = html.replace(/<tr\s+id="metrics_text_content"([^>]*)>/g, (trMatch, trAttrs) => {
              if (trAttrs.includes('style=')) {
                return trMatch.replace(/style="([^"]*)"/, (styleMatch, styleContent) => {
                  const cleanedStyle = styleContent.replace(/display\s*:\s*[^;]+;?/gi, '').trim();
                  const newStyle = cleanedStyle 
                    ? `${cleanedStyle}; display: none !important;`
                    : 'display: none !important;';
                  return `style="${newStyle}"`;
                });
              } else {
                return `<tr id="metrics_text_content"${trAttrs} style="display: none !important;">`;
              }
            });
          }
          
          // Specifically hide footer <td> element when Footer section is hidden
          // Apply display: none to <td> with padding: 40px 20px 30px 20px; background-color: #ffffff; border-radius: 0 0 12px 12px;
          if (section.id === 'footer' || section.name === 'Footer' || section.name?.toLowerCase() === 'footer') {
            html = html.replace(
              /(<td[^>]*style=")([^"]*padding:\s*40px\s+20px\s+30px\s+20px[^"]*background-color:\s*#ffffff[^"]*border-radius:\s*0\s+0\s+(?:12px|8px)\s+(?:12px|8px)[^"]*)(")/gi,
              (match, start, styleContent, end) => {
                // Check if display: none is already present
                if (!styleContent.includes('display: none') && !styleContent.includes('display:none')) {
                  const separator = styleContent.trim().endsWith(';') ? ' ' : '; ';
                  return start + styleContent + separator + 'display: none !important' + end;
                }
                return match;
              }
            );
          }
        }
      });
      
      // If footer is hidden, apply bottom border-radius to the last visible section
      if (isFooterHidden && lastVisibleSection) {
        const escapeMarker = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const startMarker = escapeMarker(`<!-- Component start ${lastVisibleSection.name} -->`);
        const endMarker = escapeMarker(`<!-- Component end ${lastVisibleSection.name} -->`);
        const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
        
        html = html.replace(pattern, (match) => {
          // Find the first <td> in the section's main <tr> and add/update border-radius for bottom corners
          // Match the pattern: <tr...><td...style="..." (only the first occurrence)
          const tdPattern = /(<tr[^>]*>\s*<td[^>]*style=")([^"]*)(")/i;
          const tdMatch = match.match(tdPattern);
          
          if (tdMatch) {
            const styleStart = tdMatch[1];
            const styleContent = tdMatch[2];
            const styleEnd = tdMatch[3];
            
            // Check if border-radius already exists in style
            if (styleContent.includes('border-radius')) {
              // Update existing border-radius to include bottom corners (remove old, add new)
              const updatedStyle = styleContent.replace(/border-radius:\s*[^;]+/gi, '').trim();
              const newStyle = updatedStyle ? updatedStyle + '; border-radius: 0 0 12px 12px' : 'border-radius: 0 0 12px 12px';
              // Clean up any double semicolons
              const cleanedStyle = newStyle.replace(/;;+/g, ';').replace(/^;\s*|;\s*$/g, '');
              return match.replace(tdPattern, styleStart + cleanedStyle + styleEnd);
            } else {
              // Add border-radius for bottom corners
              const separator = styleContent.trim() && !styleContent.trim().endsWith(';') ? '; ' : ' ';
              return match.replace(tdPattern, styleStart + styleContent + separator + 'border-radius: 0 0 12px 12px' + styleEnd);
            }
          }
          
          return match;
        });
      }
    }
    
    // Apply section background colors
    if (templateData.sections) {
      templateData.sections.forEach(section => {
        if (section.backgroundColor) {
          const sectionBackground = String(section.backgroundColor);
          const skipLightDarkRulesForSection =
            !isWhiteOrBlackSectionBackground(sectionBackground);
          const escapeMarker = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const startMarker = escapeMarker(`<!-- Component start ${section.name} -->`);
          const endMarker = escapeMarker(`<!-- Component end ${section.name} -->`);
          const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
          
          html = html.replace(pattern, (match) => {
            // Apply section background color to all <td> containers in the section block.
            // Some templates (like footer blocks) span multiple <tr>/<td> rows.
            const withUpdatedStyledTds = match.replace(/(<td[^>]*style=")([^"]*)(")/gi, (whole, start, styleContent, end) => {
              if (STEP_BADGE_TD_DATA_ATTR_RE.test(String(start))) {
                return whole;
              }
              const cleanedStyle = styleContent.replace(/background-color\s*:\s*[^;]+;?/gi, '').trim();
              const separator = cleanedStyle && !cleanedStyle.endsWith(';') ? '; ' : ' ';
              const newStyle = cleanedStyle
                ? `${cleanedStyle}${separator}background-color: ${section.backgroundColor} !important;`
                : `background-color: ${section.backgroundColor} !important;`;
              return start + newStyle + end;
            });

            // Add style for <td> elements that do not yet have a style attribute.
            let updatedSectionMarkup = withUpdatedStyledTds.replace(
              /<td(?![^>]*\bstyle=)([^>]*)>/gi,
              (whole, attrs) => {
                if (STEP_BADGE_TD_DATA_ATTR_RE.test(String(attrs))) {
                  return whole;
                }
                return `<td style="background-color: ${section.backgroundColor} !important;"${attrs}>`;
              }
            );

            // Mark sections whose component background is neither white nor black so
            // light/dark preview overrides do not apply there.
            if (skipLightDarkRulesForSection) {
              updatedSectionMarkup = updatedSectionMarkup.replace(
                /<(p|li|blockquote|span|div|h1|h2|h3|h4|h5|h6|th|td|a|table|tr)(?![^>]*data-user-bg-color)([^>]*)>/gi,
                `<$1 data-user-bg-color="true"$2>`
              );
            }

            return updatedSectionMarkup;
          });
        }
      });
    }
    
    
    // Update parent table background color from rgb(240, 249, 255) to #ffffff
    // This is the outer wrapper table that comes right after the body/div elements
    html = html.replace(
      /background-color:\s*(?:#f0f9ff|rgb\(240,\s*249,\s*255\)|rgba\(240,\s*249,\s*255[^)]*\))/gi,
      'background-color: #ffffff'
    );
    
    // Also ensure the first parent table (width="100%") has the correct background color
    // Match tables with width="100%" that have background-color in their style
    html = html.replace(
      /(<table[^>]*width="100%"[^>]*style="[^"]*background-color:\s*)(?:#f0f9ff|rgb\(240,\s*249,\s*255\)|rgba\(240,\s*249,\s*255[^)]*\)|#f8fafc|rgb\(248,\s*250,\s*252\))([^"]*")/gi,
      '$1#ffffff$2'
    );
    
    // Add CSS isolation and CSP meta tag to prevent parent styles from affecting iframe
    html = html.replace(
      /<\/head>/i,
      `  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *; script-src 'self' 'unsafe-inline' 'unsafe-eval' *; style-src 'self' 'unsafe-inline' *; img-src 'self' data: https: *;">
  <style>
    /* Ensure body is isolated */
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      overflow-x: hidden !important;
    }
  </style>
  <style>
${buildEmbeddedThemeStyleContent(themeCssMode)}
  </style>
</head>`
    );
    
    html = applyElementsToHtml(html, templateData);

    // Ensure footer social placeholders are removed even if template HTML bypasses element-level logic.
    html = removeFooterSocialIcons(html);

    // Normalize email background to white regardless of the source template.
    html = html.replace(/background-color:\s*#f8fafc/gi, 'background-color: #ffffff');

    // Replace ©YYYY placeholder with current year in footer copyright
    html = html.replace(/©YYYY/g, '©' + new Date().getFullYear());

    return html;
  }, [applyElementsToHtml]);

  const updateElement = useCallback((elementId: string, updates: Partial<TemplateElement>) => {
    setTemplate(prev => {
      if (!prev) return prev;
      
      const updatedElements = prev.elements.map(el => {
        // Update the target element
        if (el.id === elementId) {
          const merged: TemplateElement = {
            ...el,
            ...updates,
          };

          // Always ensure properties object exists and merge correctly
          if (updates.properties) {
            merged.properties = {
              ...(el.properties || {}),  // Ensure we start with an object, never undefined
              ...updates.properties,
            };
          } else if (!merged.properties) {
            // Ensure properties is always defined as an object
            merged.properties = el.properties || {};
          }

          return merged;
        }
        
        return el;
      });

      return { ...prev, elements: updatedElements };
    });

    // Force InteractiveEmailPreview to re-render when properties change
    if (updates.properties) {
      setPreviewRefreshKey(prev => prev + 1);
    }
  }, []);

  const updateSection = useCallback(
    (sectionId: string, updates: Partial<TemplateSection>) => {
      let affectedElements: string[] | null = null;
      let affectedSectionName: string | null = null;

      setTemplate(prev => {
        if (!prev || !prev.sections) {
          return prev;
        }

        const section = prev.sections.find(sec => sec.id === sectionId);
        if (!section) {
          return prev;
        }

        const updatedSections = prev.sections.map(sec =>
          sec.id === sectionId ? { ...sec, ...updates } : sec
        );

        let updatedElements = prev.elements;
        if ('visible' in updates) {
          affectedElements = section.elements;
          affectedSectionName = section.name;
          updatedElements = prev.elements.map(el =>
            section.elements.includes(el.id) ? { ...el, visible: updates.visible! } : el
          );
        }

        return { ...prev, sections: updatedSections, elements: updatedElements };
      });

      const elementsList = Array.isArray(affectedElements) ? (affectedElements as string[]) : null;

      if (
        'visible' in updates &&
        updates.visible === false &&
        selectedElement &&
        elementsList?.includes(selectedElement.id)
      ) {
        setSelectedElement(null);
      }
    },
    [selectedElement]
  );

  const toggleSectionExpand = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Expand all sections on initial load only
  useEffect(() => {
    if (template && template.sections && !hasInitializedSectionsRef.current) {
      setExpandedSections(new Set(template.sections.map(s => s.id)));
      hasInitializedSectionsRef.current = true;
    }
  }, [template]);

  // Sync selectedElement with template changes
  useEffect(() => {
    if (template && selectedElement) {
      const updatedElement = template.elements.find(el => el.id === selectedElement.id);
      if (updatedElement) {
        // Always update to the latest element from template to ensure ElementEditor receives updated properties
        setSelectedElement(updatedElement);
      } else {
        setSelectedElement(null);
      }
    }
  }, [template, selectedElement?.id]);

  // Store latest template in ref to avoid stale closures in debounced updates
  const latestTemplateRef = useRef<DynamicTemplate | null>(null);
  useEffect(() => {
    latestTemplateRef.current = template;
  }, [template]);

  // Generate preview HTML with debouncing to prevent constant regeneration
  // Use shorter debounce for property/style changes (instant feedback) vs content changes
  useEffect(() => {
    if (!template) return;

    // Detect if this is primarily a property/style change (not content) by comparing with previous template
    let isPropertyChange = false;
    if (previousTemplateRef.current && previousTemplateRef.current.elements) {
      const prevElements = previousTemplateRef.current.elements;
      const currentElements = template.elements;

      // Check if only properties/visibility changed (same element count and values, different properties)
      if (prevElements.length === currentElements.length) {
        const propertiesChanged = currentElements.some((el, idx) => {
          const prevEl = prevElements[idx];
          if (!prevEl || prevEl.id !== el.id) return false;

          // Check if value changed (content change)
          if (prevEl.value !== el.value) return false;

          // Check if visibility changed
          if (prevEl.visible !== el.visible) return true;

          // Check if any properties changed
          const prevProps = prevEl.properties || {};
          const currProps = el.properties || {};

          // Compare all property keys
          const allKeys = new Set([...Object.keys(prevProps), ...Object.keys(currProps)]);
          for (const key of allKeys) {
            if (prevProps[key] !== currProps[key]) {
              return true; // Property changed
            }
          }

          return false;
        });

        const valuesChanged = currentElements.some((el, idx) => {
          const prevEl = prevElements[idx];
          return prevEl &&
                 prevEl.id === el.id &&
                 prevEl.value !== el.value;
        });

        // It's a property change if properties changed but values didn't
        isPropertyChange = propertiesChanged && !valuesChanged;
      }
    }

    // Check if this is a padding/margin change (for near-instant feedback)
    // CRITICAL: Do this BEFORE updating previousTemplateRef!
    let isPaddingOrMarginChange = false;
    if (previousTemplateRef.current && previousTemplateRef.current.elements && isPropertyChange) {
      const prevElements = previousTemplateRef.current.elements;
      const currentElements = template.elements;
      isPaddingOrMarginChange = currentElements.some((el, idx) => {
        const prevEl = prevElements[idx];
        if (!prevEl || prevEl.id !== el.id) return false;

        const prevProps = prevEl.properties || {};
        const currProps = el.properties || {};

        // Check if only padding or margin properties changed
        const quickLayoutKeys = ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'textAlign'];
        return quickLayoutKeys.some(key => prevProps[key] !== currProps[key]);
      });
    }

    // Store current template for next comparison (AFTER checking for padding changes!)
    previousTemplateRef.current = template;

    const debounceDelay = isPaddingOrMarginChange ? 50 : (isPropertyChange ? 150 : 300); // Near-instant for padding/margin changes

    const timeoutId = setTimeout(() => {
      // CRITICAL FIX: Use latestTemplateRef to get the most current template state
      // This prevents stale closures when multiple rapid updates occur
      const currentTemplate = latestTemplateRef.current;
      if (!currentTemplate) return;

      const html = generatePreviewHtml(currentTemplate);
      setPreviewHtml(html);
    }, debounceDelay);

    return () => clearTimeout(timeoutId);
  }, [template, generatePreviewHtml]);

  // Memoize sections to prevent unnecessary re-renders (must be before any early returns)
  // Sort sections by their order in the HTML (maintain original order)
  const memoizedSections = useMemo(() => {
    if (!template?.sections) return [];
    // Return sections in their current order (they should already be in HTML order)
    return [...template.sections];
  }, [template?.sections]);

  // Memoize elements to prevent unnecessary re-renders
  const memoizedElements = useMemo(() => {
    return template?.elements || [];
  }, [template?.elements]);

  // Memoize selected element ID for comparison
  const selectedElementId = useMemo(() => selectedElement?.id, [selectedElement?.id]);
  const selectedSectionId = useMemo(() => selectedSection?.id, [selectedSection?.id]);

  const handleBack = () => {
    navigate(`${basePath}/email-builder`);
  };

  const handleSave = useCallback(async () => {
    if (!template) return;
    
    // Check if this is a saved template (from Template Composer)
    const isSavedTemplate = templateId && (templateId.startsWith('template_') || templateId.startsWith('saved_'));
    
    // Check if this is a saved email
    const isSavedEmail = templateId && templateId.startsWith('email_');
    
    if (isSavedTemplate) {
      // Save back to Supabase
      if (!user?.id) {
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'User ID is required. Please log in again.',
          title: 'Error',
        });
        return;
      }

      if (!canSaveTemplates) {
        setModalState({
          isOpen: true,
          type: 'warning',
          message:
            'Saving composer templates requires Pro. You can preview changes here and export HTML, or download templates from your library.',
          title: 'Cannot save template',
        });
        return;
      }

      try {
        // Try Supabase first
        try {
          const { 
            getTemplateByIdSupabase, 
            updateTemplateSupabase 
          } = await import('../../services/savedTemplatesSupabase');
          
          // Get existing template from Supabase
          const existingTemplate = await getTemplateByIdSupabase(templateId, user.id);
          
          if (existingTemplate) {
            // Generate HTML from current template using the preview HTML generator
            const html = generatePreviewHtml(template);
            
            // Update template data
            const updatedTemplate = {
              id: existingTemplate.id,
              name: template.meta.templateName || existingTemplate.name,
              components: existingTemplate.components, // Preserve component structure
              createdAt: existingTemplate.createdAt,
              updatedAt: new Date().toISOString(),
            };
            
            // Update in Supabase
            await updateTemplateSupabase(updatedTemplate, user.id, html);

            setModalState({
              isOpen: true,
              type: 'success',
              message: `Template "${template.meta.templateName}" saved successfully!`,
              title: 'Template Saved',
            });
          } else {
            setModalState({
              isOpen: true,
              type: 'error',
              message: 'Template not found in Supabase.',
              title: 'Error',
            });
          }
        } catch {
          // Fallback to localStorage
          const savedTemplates = getSavedTemplates(user.id);
        const savedTemplateIndex = savedTemplates.findIndex((t: any) => t.id === templateId);
        
        if (savedTemplateIndex >= 0) {
          const updatedTemplate = {
            ...savedTemplates[savedTemplateIndex],
            updatedAt: new Date().toISOString(),
          };
          savedTemplates[savedTemplateIndex] = updatedTemplate;
            saveTemplates(user.id, savedTemplates);
          
          setModalState({
            isOpen: true,
            type: 'success',
            message: `Template "${template.meta.templateName}" saved successfully!`,
            title: 'Template Saved',
          });
        } else {
          setModalState({
            isOpen: true,
            type: 'error',
            message: 'Template not found in saved templates.',
            title: 'Error',
          });
          }
        }
      } catch (error) {
        console.error('Error saving template:', error);
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'Failed to save template. Please try again.',
          title: 'Error',
        });
      }
    } else if (isSavedEmail) {
      // Update existing saved email
      if (!user?.id) {
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'User ID is required. Please log in again.',
          title: 'Error',
        });
        return;
      }

      if (!canSaveEmails) {
        setModalState({
          isOpen: true,
          type: 'warning',
          message: 'Saving emails requires Pro. You can still export HTML from the builder.',
          title: 'Cannot save email',
        });
        return;
      }

      try {
        const currentTemplate = JSON.parse(JSON.stringify(template));
        const currentHtml = generatePreviewHtml(currentTemplate);

        let savedEmail: SavedEmailData | null = null;
        try {
          const { getSavedEmailSupabase, saveEmailSupabase } = await import('../../services/savedEmailsSupabase');
          savedEmail = await getSavedEmailSupabase(user.id, templateId);
          if (!savedEmail) {
            savedEmail = getSavedEmail(user.id, templateId);
          }
          if (!savedEmail) {
            savedEmail = buildSavedEmailFromEditorState(template, templateId, currentHtml);
          }

          const updatedEmail = {
            ...savedEmail,
            html: currentHtml,
            elements: currentTemplate.elements,
            sections: currentTemplate.sections,
          };

          await saveEmailSupabase(updatedEmail, user.id);

          openEmailSavedModal('Email Updated', savedEmail.name, true);
        } catch {
          if (!savedEmail) {
            savedEmail = getSavedEmail(user.id, templateId);
          }
          if (!savedEmail) {
            savedEmail = buildSavedEmailFromEditorState(template, templateId, currentHtml);
          }

          const updatedEmail = {
            ...savedEmail,
            html: currentHtml,
            elements: currentTemplate.elements,
            sections: currentTemplate.sections,
            updatedAt: new Date().toISOString(),
          };

          saveEmail(user.id, updatedEmail);

          openEmailSavedModal('Email Updated', savedEmail.name, true);
        }
      } catch (error: any) {
        console.error('Error updating email:', error);
        setModalState({
          isOpen: true,
          type: 'error',
          message: error.message || 'Failed to update email. Please try again.',
          title: 'Error',
        });
      }
    } else {
      // For regular templates, open save dialog to save as email
      if (!user?.id) {
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'User ID is required. Please log in again.',
          title: 'Error',
        });
        return;
      }

      if (!canSaveEmails) {
        setModalState({
          isOpen: true,
          type: 'warning',
          message: 'Saved emails are a Pro feature. Upgrade to Pro to save emails.',
          title: 'Pro Feature',
        });
        return;
      }

      // Check if we can save
      try {
        // Try Supabase first
        try {
          const { canSaveEmailSupabase } = await import('../../services/savedEmailsSupabase');
          const canSave = await canSaveEmailSupabase(user.id);
          if (!canSave.canSave) {
            setModalState({
              isOpen: true,
              type: 'warning',
              message: canSave.reason || 'Cannot save email. Please delete some saved emails first.',
              title: 'Cannot Save',
            });
            return;
          }
          
          // Generate current HTML to estimate size
          const currentTemplate = JSON.parse(JSON.stringify(template));
          const currentHtml = generatePreviewHtml(currentTemplate);
          const emailData = convertTemplateToSavedEmail(
            { ...currentTemplate, html: currentHtml },
            template.meta.templateName,
            template.meta.description
          );
          const estimatedSize = new Blob([JSON.stringify(emailData)]).size;
          
          const canSaveWithSize = await canSaveEmailSupabase(user.id, estimatedSize);
          if (!canSaveWithSize.canSave) {
            setModalState({
              isOpen: true,
              type: 'warning',
              message: canSaveWithSize.reason || 'Email is too large to save.',
              title: 'Cannot Save',
            });
            return;
          }
        } catch {
          // Fallback to localStorage
          const canSave = canSaveEmail(user.id);
          if (!canSave.canSave) {
            setModalState({
              isOpen: true,
              type: 'warning',
              message: canSave.reason || 'Cannot save email. Please delete some saved emails first.',
              title: 'Cannot Save',
            });
            return;
          }
          
          const currentTemplate = JSON.parse(JSON.stringify(template));
          const currentHtml = generatePreviewHtml(currentTemplate);
          const emailData = convertTemplateToSavedEmail(
            { ...currentTemplate, html: currentHtml },
            template.meta.templateName,
            template.meta.description
          );
          const estimatedSize = new Blob([JSON.stringify(emailData)]).size;
          
          const canSaveWithSize = canSaveEmail(user.id, estimatedSize);
          if (!canSaveWithSize.canSave) {
            setModalState({
              isOpen: true,
              type: 'warning',
              message: canSaveWithSize.reason || 'Email is too large to save.',
              title: 'Cannot Save',
            });
            return;
          }
        }
      } catch (error: any) {
        console.error('Error checking save capability:', error);
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'Failed to check save capability. Please try again.',
          title: 'Error',
        });
        return;
      }
      
      // Set default name and open dialog
      setEmailName(template.meta.templateName);
      setEmailDescription(template.meta.description || '');
      setSaveError(null);
      setNameValidationError(null);
      setShowSaveDialog(true);
    }
  }, [template, templateId, user?.id, generatePreviewHtml, canSaveEmails, canSaveTemplates, openEmailSavedModal]);
  
  const handleSaveEmail = useCallback(async () => {
    if (!template) return;

    if (!canSaveEmails) {
      setSaveError('Saved emails are a Pro feature. Upgrade to Pro to save emails.');
      return;
    }
    
    const trimmedName = emailName.trim();
    if (!trimmedName) {
      setSaveError('Please enter a name for your email.');
      return;
    }
    
    // Check if this is a new email or updating existing
    const isUpdating = templateId && templateId.startsWith('email_');
    
    if (!user?.id) {
      setSaveError('User ID is required. Please log in again.');
      return;
    }

    // Validate unique name (only for new emails, or if name changed)
    if (!isUpdating || (isUpdating && template.meta.templateName !== trimmedName)) {
      try {
        // Try Supabase first
        try {
          const { emailNameExistsSupabase } = await import('../../services/savedEmailsSupabase');
          const nameExists = await emailNameExistsSupabase(user.id, trimmedName, isUpdating ? templateId : undefined);
          if (nameExists) {
            setSaveError(`An email with the name "${trimmedName}" already exists. Please choose a different name.`);
            return;
          }
        } catch {
          // Fallback to localStorage
          if (emailNameExists(user.id, trimmedName, isUpdating ? templateId : undefined)) {
            setSaveError(`An email with the name "${trimmedName}" already exists. Please choose a different name.`);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking email name:', error);
        // Continue anyway, let Supabase handle the duplicate check
      }
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Generate current HTML with all updates
      const currentTemplate = JSON.parse(JSON.stringify(template));
      const currentHtml = generatePreviewHtml(currentTemplate);
      
      // Convert to saved email format
      const emailData = convertTemplateToSavedEmail(
        { ...currentTemplate, html: currentHtml },
        trimmedName,
        emailDescription.trim() || undefined
      );
      
      // Use existing ID if updating, otherwise generate new one
      const emailId = isUpdating && templateId 
        ? templateId 
        : `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Try Supabase first
      try {
        const { saveEmailSupabase } = await import('../../services/savedEmailsSupabase');
        await saveEmailSupabase({
          ...emailData,
          id: emailId,
        }, user.id);
      } catch {
        // Fallback to localStorage
        saveEmail(user.id, {
          ...emailData,
          id: emailId,
        });
      }
      
      setIsSaving(false);
      setShowSaveDialog(false);
      setEmailName('');
      setEmailDescription('');

      openEmailSavedModal(
        isUpdating ? 'Email Updated' : 'Email Saved',
        trimmedName,
        isUpdating
      );
    } catch (error: any) {
      console.error('Error saving email:', error);
      setSaveError(error.message || 'Failed to save email. Please try again.');
      setIsSaving(false);
    }
  }, [template, emailName, emailDescription, user?.id, templateId, generatePreviewHtml, canSaveEmails, openEmailSavedModal]);

  const downloadFile = (content: BlobPart, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    if (!template) return;
    try {
      const currentTemplate = JSON.parse(JSON.stringify(template));
      const htmlContent = generatePreviewHtml(currentTemplate);
      const cleanedHtml = htmlContent
        .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/gi, '')
        .replace(/<style>\s*\/\* Ensure body is isolated \*\/[^<]*<\/style>/gi, '');
      downloadFile(cleanedHtml, 'text/html', `${template.meta.templateName.replace(/\s+/g, '_')}.html`);
    } catch (err) {
      console.error('[handleExportHtml] Failed to export HTML', err);
      window.alert(`Could not export HTML: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleStartEditName = () => {
    if (!savedEmailName || !templateId) return;
    setEditingNameValue(savedEmailName);
    setIsEditingName(true);
    setNameEditError(null);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditingNameValue('');
    setNameEditError(null);
  };

  const handleSaveName = useCallback(async () => {
    if (!templateId || !templateId.startsWith('email_') || !template) return;

    if (!canSaveEmails) {
      setNameEditError('Renaming saved emails requires Pro.');
      return;
    }
    
    const trimmedName = editingNameValue.trim();
    
    if (!trimmedName) {
      setNameEditError('Email name cannot be empty.');
      return;
    }

    if (!user?.id) {
      setNameEditError('User ID is required. Please log in again.');
      return;
    }

    // Check if name already exists (excluding current email)
    try {
      // Try Supabase first
      try {
        const { emailNameExistsSupabase } = await import('../../services/savedEmailsSupabase');
        const nameExists = await emailNameExistsSupabase(user.id, trimmedName, templateId);
        if (nameExists) {
          setNameEditError(`An email with the name "${trimmedName}" already exists.`);
          return;
        }
      } catch {
        // Fallback to localStorage
        if (emailNameExists(user.id, trimmedName, templateId)) {
          setNameEditError(`An email with the name "${trimmedName}" already exists.`);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking email name:', error);
      // Continue anyway
    }

    setIsRenamingEmail(true);
    try {
      const currentTemplate = JSON.parse(JSON.stringify(template));
      const currentHtml = generatePreviewHtml(currentTemplate);

      let savedEmail: SavedEmailData | null = null;
      try {
        const { getSavedEmailSupabase, saveEmailSupabase } = await import('../../services/savedEmailsSupabase');
        savedEmail = await getSavedEmailSupabase(user.id, templateId);
        if (!savedEmail) {
          savedEmail = getSavedEmail(user.id, templateId);
        }
        if (!savedEmail) {
          savedEmail = buildSavedEmailFromEditorState(template, templateId, currentHtml, trimmedName);
        }

        await saveEmailSupabase(
          {
            ...savedEmail,
            name: trimmedName,
          },
          user.id
        );
      } catch {
        if (!savedEmail) {
          savedEmail = getSavedEmail(user.id, templateId);
        }
        if (!savedEmail) {
          savedEmail = buildSavedEmailFromEditorState(template, templateId, currentHtml, trimmedName);
        }

        saveEmail(user.id, {
          ...savedEmail,
          name: trimmedName,
        });
      }

      setSavedEmailName(trimmedName);
      setIsEditingName(false);
      setEditingNameValue('');
      setNameEditError(null);
    } catch (error: any) {
      console.error('Error renaming email:', error);
      setNameEditError(error?.message || 'Failed to rename email. Please try again.');
    } finally {
      setIsRenamingEmail(false);
    }
  }, [templateId, editingNameValue, user?.id, template, generatePreviewHtml, canSaveEmails]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading template...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Template Not Found</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">Could not load the selected template.</p>
          <button onClick={handleBack} className="btn w-full">
            Back to Templates
          </button>
        </div>
      </div>
    );
  }

  const elementIcons = {
    text: Type,
    heading: Type,
    image: ImageIcon,
    link: LinkIcon,
    button: MousePointerClick,
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              {isEditingName && savedEmailName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="edit-email-name"
                    name="edit-email-name"
                    value={editingNameValue}
                    onChange={(e) => {
                      setEditingNameValue(e.target.value);
                      setNameEditError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveName();
                      } else if (e.key === 'Escape') {
                        handleCancelEditName();
                      }
                    }}
                    className="flex-1 text-base md:text-xl font-bold text-gray-900 dark:text-gray-100 border border-blue-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Edit email name"
                    autoFocus
                    disabled={isRenamingEmail}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isRenamingEmail || !editingNameValue.trim() || !!nameEditError}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save name"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    disabled={isRenamingEmail}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-base md:text-xl font-bold text-gray-900 dark:text-gray-100">
                    {savedEmailName || template.meta.templateName}
                  </h1>
                  {savedEmailName && canSaveEmails && (
                    <button
                      type="button"
                      onClick={handleStartEditName}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Rename email"
                    >
                      <PenSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              {nameEditError && (
                <p className="text-xs text-red-600 mt-1">{nameEditError}</p>
              )}
              <p className="hidden md:block text-sm text-gray-600 dark:text-gray-400">
                {savedEmailName ? `Template: ${template.meta.templateName}` : template.meta.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
            <button 
              className="btn-secondary btn-sm group hidden md:flex items-center gap-2"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
              {previewMode ? 'Edit' : 'Preview'}
            </button>
            <div className="hidden md:flex items-center gap-1.5 mr-1">
              <label htmlFor="theme-css-mode" className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Theme CSS
              </label>
              <select
                id="theme-css-mode"
                value={themeCssMode}
                onChange={(e) => {
                  const v = e.target.value as ThemeCssMode;
                  setTemplate((prev) => {
                    if (!prev) return prev;
                    return { ...prev, meta: { ...prev.meta, themeCssMode: v } };
                  });
                  setPreviewRefreshKey((k) => k + 1);
                }}
                className="border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 max-w-[220px]"
                title="What gets embedded in HTML: adaptive adds dark + light rules; light-only adds light rules only (no dark-mode CSS)."
              >
                <option value="adaptive">Light + dark (adaptive)</option>
                <option value="light-only">Light only</option>
              </select>
            </div>
            <div
              className={`hidden md:flex items-center border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden ${
                themeCssMode === 'light-only' ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setPreviewTheme('light')}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  previewTheme === 'light'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                title="Preview Light Mode"
                disabled={themeCssMode === 'light-only'}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme('dark')}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  previewTheme === 'dark'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                title="Preview Dark Mode"
                disabled={themeCssMode === 'light-only'}
              >
                Dark
              </button>
            </div>
            <div className="hidden md:block w-px h-6 bg-gray-200 mx-2"></div>
            {showMainSaveButton && (
              <button type="button" className="btn-outline btn-sm group flex items-center gap-2" onClick={handleSave}>
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="hidden lg:inline">Save</span>
              </button>
            )}
            <button className="btn-secondary btn-sm group flex items-center gap-2" onClick={handleExportHtml}>
              <FileText className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
              <span className="hidden lg:inline">Export HTML</span>
            </button>
          </div>
        </div>
        
        {/* Mobile Tab Navigation */}
        <div className="md:hidden flex items-center gap-1 border-t border-gray-200 dark:border-gray-800 pt-2">
          <button
            onClick={() => setMobileTab('elements')}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
              mobileTab === 'elements' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Elements
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
              mobileTab === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMobileTab('properties')}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
              mobileTab === 'properties' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Properties
          </button>
        </div>
      </div>

      {/* Layout - Responsive */}
      <div className="hidden md:grid flex-1 grid-cols-[280px_1fr_320px] overflow-hidden">
        {/* Desktop: Left Panel - Elements List */}
        <div className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Elements</h3>
              {template.sections && template.sections.length > 0 && (
                <button
                  onClick={() => setSectionView(sectionView === 'flat' ? 'grouped' : 'flat')}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  title={sectionView === 'flat' ? 'Group by section' : 'Flat view'}
                >
                  <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Grouped by component</p>
          </div>
          
          {/* Listmode/flat view toggle */}
          {sectionView === 'grouped' && memoizedSections && memoizedSections.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {memoizedSections.map((section) => (
                <div key={section.id} className="border-b border-gray-200 dark:border-gray-800">
                  <div className={`flex items-center justify-between transition-colors px-3 py-2 ${
                    selectedSectionId === section.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSection(section);
                        setSelectedElement(null);
                        toggleSectionExpand(section.id);
                      }}
                      className="flex items-center gap-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 flex-1"
                    >
                      {expandedSections.has(section.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                      <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span>{section.name}</span>
                      {!section.visible && (
                        <span className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full">
                          Hidden
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSection(section.id, { visible: !section.visible })}
                      className={`p-1.5 rounded-md transition-colors ${
                        section.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title={section.visible ? 'Hide section' : 'Show section'}
                    >
                      {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  {expandedSections.has(section.id) && (
                    <div className={`divide-y divide-gray-200 ${section.visible ? '' : 'opacity-50'}`}>
                      {section.elements.map((elementId) => {
                        const element = memoizedElements.find(el => el.id === elementId);
                        if (!element) return null;
                        
                        const Icon = elementIcons[element.type] || Mail;
                        const isSelected = selectedElementId === element.id;
                        const isHidden = element.visible === false;
                        return (
                          <button
                            key={element.id}
                            onClick={() => {
                              setSelectedElement(element);
                              setSelectedSection(null);
                            }}
                            className={`
                              w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-all pl-8
                              ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''}
                              ${isHidden ? 'opacity-50' : ''}
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{element.label}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{element.type}</p>
                              </div>
                            </div>
                            {element.value && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-2 pl-8">
                                {String(element.value).substring(0, 40)}...
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {memoizedElements.map((element) => {
                const Icon = elementIcons[element.type] || Mail;
                const isSelected = selectedElementId === element.id;
                const isHidden = element.visible === false;
                return (
                  <button
                    key={element.id}
                    type="button"
                    onClick={() => {
                      setSelectedElement(element);
                    }}
                    className={`
                      w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-all bg-white dark:bg-gray-900
                      ${isSelected ? 'bg-blue-600 border-l-4 border-blue-700' : ''}
                      ${isHidden ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate text-sm ${isSelected ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>{element.label}</p>
                        <p className={`text-xs mt-0.5 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                          {element.type}
                          {isHidden && (
                            <span className={`ml-2 uppercase tracking-wide text-[10px] ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                              Hidden
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {element.value && (
                      <p className={`text-xs truncate mt-2 pl-8 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        {String(element.value).substring(0, 40)}...
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop: Center Panel - Preview */}
        <div className="overflow-auto bg-gray-100 dark:bg-gray-800 p-8">
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 shadow-xl rounded-lg">
            {previewHtml ? (
              <div style={{ height: '800px', overflow: 'auto' }} className={previewMode ? 'pointer-events-none opacity-95' : ''}>
                <InteractiveEmailPreview
                  template={template}
                  previewHtml={previewHtml}
                  previewTheme={effectivePreviewTheme}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  onCommitValue={(elementId, value) => updateElement(elementId, { value })}
                  isPreviewMode={previewMode}
                  refreshTrigger={previewRefreshKey}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[800px] bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-500">Loading preview...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Right Panel - Properties Editor */}
        <div className="bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Properties</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {selectedElement ? `Editing: ${selectedElement.label}` : 
               selectedSection ? `Editing: ${selectedSection.name}` : 
               'Select an element or section to edit'}
            </p>
          </div>
          
          {selectedElement ? (
            <div className="p-4 space-y-4">
              <ElementEditor
                element={selectedElement}
                onUpdate={updateElement}
                sourceTemplateId={template?.meta?.templateId}
              />
            </div>
          ) : selectedSection ? (
            <div className="p-4 space-y-4">
              <SectionEditor section={selectedSection} onUpdate={updateSection} />
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Edit2 className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select an element or section from the list to edit its properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout - Tab-based */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col">
        {/* Mobile: Elements Panel */}
        {mobileTab === 'elements' && (
          <div className="bg-white dark:bg-gray-900 overflow-y-auto flex-1">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Elements</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Grouped by component</p>
            </div>
            
            {/* Listmode/flat view toggle */}
            {sectionView === 'grouped' && template.sections && template.sections.length > 0 ? (
              <div>
                {template.sections.map((section) => (
                  <div key={section.id} className="border-b border-gray-200 dark:border-gray-800">
                    <div className={`flex items-center justify-between transition-colors px-4 py-3 ${
                      selectedSection?.id === section.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSection(section);
                          setSelectedElement(null);
                          setMobileTab('properties');
                          toggleSectionExpand(section.id);
                        }}
                        className="flex items-center gap-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 flex-1"
                      >
                        {expandedSections.has(section.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                        <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span>{section.name}</span>
                        {!section.visible && (
                          <span className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full">
                            Hidden
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSection(section.id, { visible: !section.visible })}
                        className={`p-1.5 rounded-md transition-colors ${
                          section.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        title={section.visible ? 'Hide section' : 'Show section'}
                      >
                        {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                    {expandedSections.has(section.id) && (
                      <div className={`divide-y divide-gray-200 ${section.visible ? '' : 'opacity-50'}`}>
                        {section.elements.map((elementId) => {
                          const element = template.elements.find(el => el.id === elementId);
                          if (!element) return null;
                          
                          const Icon = elementIcons[element.type] || Mail;
                          const isSelected = selectedElement?.id === element.id;
                          const isHidden = element.visible === false;
                          return (
                            <button
                              key={element.id}
                              onClick={() => {
                                setSelectedElement(element);
                                setMobileTab('properties');
                              }}
                              className={`
                                w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-all pl-8
                                ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''}
                                ${isHidden ? 'opacity-50' : ''}
                              `}
                            >
                              <div className="flex items-start gap-3">
                                <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{element.label}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{element.type}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {template.elements.map((element) => {
                  const Icon = elementIcons[element.type] || Mail;
                  const isSelected = selectedElement?.id === element.id;
                  const isHidden = element.visible === false;
                  return (
                    <button
                      key={element.id}
                      onClick={() => {
                        setSelectedElement(element);
                        setSelectedSection(null);
                        setMobileTab('properties');
                      }}
                      className={`
                        w-full p-4 text-left transition-all relative bg-white dark:bg-gray-900
                        ${isSelected ? 'bg-blue-600 border-l-4 border-blue-700' : ''}
                        ${isHidden ? 'opacity-50' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isSelected ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>{element.label}</p>
                          <p className={`text-xs mt-0.5 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                            {element.type}
                            {isHidden && (
                              <span className={`ml-2 uppercase tracking-wide text-[10px] ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>
                                Hidden
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mobile: Preview Panel */}
        {mobileTab === 'preview' && (
          <div className="overflow-auto bg-gray-100 dark:bg-gray-800 p-4 flex-1">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden">
              <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-col gap-1">
                  <label htmlFor="theme-css-mode-mobile" className="text-xs text-gray-600 dark:text-gray-400">
                    Theme CSS (embedded in HTML)
                  </label>
                  <select
                    id="theme-css-mode-mobile"
                    value={themeCssMode}
                    onChange={(e) => {
                      const v = e.target.value as ThemeCssMode;
                      setTemplate((prev) => {
                        if (!prev) return prev;
                        return { ...prev, meta: { ...prev.meta, themeCssMode: v } };
                      });
                      setPreviewRefreshKey((k) => k + 1);
                    }}
                    className="border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-full"
                  >
                    <option value="adaptive">Light + dark (adaptive)</option>
                    <option value="light-only">Light only</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Light / Dark preview</p>
                  <div
                    className={`inline-flex items-center border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden ${
                      themeCssMode === 'light-only' ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewTheme('light')}
                      className={`px-2.5 py-1 text-xs transition-colors ${
                        previewTheme === 'light'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      title="Preview Light Mode"
                      disabled={themeCssMode === 'light-only'}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTheme('dark')}
                      className={`px-2.5 py-1 text-xs transition-colors ${
                        previewTheme === 'dark'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      title="Preview Dark Mode"
                      disabled={themeCssMode === 'light-only'}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </div>
              {previewHtml ? (
                <iframe
                  ref={previewIframeRef}
                  srcDoc={previewHtml}
                  title="Email Preview"
                  className="w-full border-0"
                  style={{ height: '600px' }}
                  onLoad={() => {
                    try {
                      const body = previewIframeRef.current?.contentDocument?.body;
                      if (!body) return;
                      body.setAttribute('data-preview-theme', effectivePreviewTheme);
                    } catch {
                      // no-op
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-[600px] bg-gray-50 dark:bg-gray-950">
                  <div className="text-center">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-500">Loading preview...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile: Properties Panel */}
        {mobileTab === 'properties' && (
          <div className="bg-white dark:bg-gray-900 overflow-y-auto flex-1">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Properties</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {selectedElement ? `Editing: ${selectedElement.label}` : 
                 selectedSection ? `Editing: ${selectedSection.name}` : 
                 'Select an element or section to edit'}
              </p>
            </div>
            
            {selectedElement ? (
              <div className="p-4 space-y-4">
                <ElementEditor
                element={selectedElement}
                onUpdate={updateElement}
                sourceTemplateId={template?.meta?.templateId}
              />
              </div>
            ) : selectedSection ? (
              <div className="p-4 space-y-4">
                <SectionEditor section={selectedSection} onUpdate={updateSection} />
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Edit2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select an element or section from the list to edit its properties
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Save Email Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000000] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 z-[1000001] relative">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Save Email</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email-name-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="email-name-input"
                  name="email-name"
                  value={emailName}
                  onChange={async (e) => {
                    const newName = e.target.value;
                    setEmailName(newName);
                    setSaveError(null);
                    
                    // Clear previous timeout
                    if (nameValidationTimeoutRef.current) {
                      clearTimeout(nameValidationTimeoutRef.current);
                    }
                    
                    // Debounce validation to avoid too many Supabase calls
                    nameValidationTimeoutRef.current = setTimeout(async () => {
                      const trimmedName = newName.trim();
                      if (trimmedName && user?.id) {
                        const isUpdating = templateId && templateId.startsWith('email_');
                        
                        try {
                          // Try Supabase first
                          try {
                            const { emailNameExistsSupabase } = await import('../../services/savedEmailsSupabase');
                            const nameExists = await emailNameExistsSupabase(
                              user.id, 
                              trimmedName, 
                              isUpdating ? templateId : undefined
                            );
                            
                            if (nameExists && (!isUpdating || (isUpdating && template?.meta.templateName !== trimmedName))) {
                              setNameValidationError(`An email with this name already exists.`);
                            } else {
                              setNameValidationError(null);
                            }
                          } catch {
                            // Fallback to localStorage
                            const nameExists = emailNameExists(
                              user.id, 
                              trimmedName, 
                              isUpdating ? templateId : undefined
                            );
                            
                            if (nameExists && (!isUpdating || (isUpdating && template?.meta.templateName !== trimmedName))) {
                              setNameValidationError(`An email with this name already exists.`);
                            } else {
                              setNameValidationError(null);
                            }
                          }
                        } catch (error) {
                          console.error('Error validating email name:', error);
                          // Don't set error on validation failure, let user try to save
                          setNameValidationError(null);
                        }
                      } else {
                        setNameValidationError(null);
                      }
                    }, 300); // 300ms debounce
                  }}
                  placeholder="Enter email name"
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    nameValidationError 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500'
                  }`}
                  autoFocus
                />
                {nameValidationError && (
                  <p className="mt-1 text-xs text-red-600">{nameValidationError}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={emailDescription}
                  onChange={(e) => setEmailDescription(e.target.value)}
                  placeholder="Enter email description"
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 dark:bg-red-950/35 dark:border-red-900/60">
                  <p className="text-sm text-red-600 dark:text-red-300">{saveError}</p>
                </div>
              )}
              
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setEmailName('');
                  setEmailDescription('');
                  setSaveError(null);
                  setNameValidationError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmail}
                disabled={isSaving || !emailName.trim() || !!nameValidationError}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Email'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      <SuccessModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false, secondaryAction: undefined })}
        type={modalState.type}
        message={modalState.message}
        title={modalState.title}
        secondaryAction={modalState.secondaryAction}
      />
    </div>
  );
};

/** Stock Thank You template is the only one where button CTAs expose alignment in the builder. */
const THANK_YOU_TEMPLATE_ID = 'freeflow_thank_you';

interface ElementEditorProps {
  element: TemplateElement;
  onUpdate: (elementId: string, updates: Partial<TemplateElement>) => void;
  /** When set, controls whether `type: "button"` shows alignment (only Thank You stock template). */
  sourceTemplateId?: string | null;
}

// Helper function to parse padding string into individual values
// Also checks for individual padding properties (paddingTop, paddingBottom, etc.)
const parsePadding = (element: TemplateElement): { top: number; right: number; bottom: number; left: number } => {
  // First check for individual padding properties
  const paddingTop = (element.properties as any)?.paddingTop;
  const paddingRight = (element.properties as any)?.paddingRight;
  const paddingBottom = (element.properties as any)?.paddingBottom;
  const paddingLeft = (element.properties as any)?.paddingLeft;
  
  if (paddingTop !== undefined || paddingRight !== undefined || paddingBottom !== undefined || paddingLeft !== undefined) {
    // Helper to parse padding value (handles both number and string like "10px")
    const parsePaddingValue = (val: any): number => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return val;
      const num = parseInt(String(val).replace(/px|em|rem|%/g, ''), 10);
      return isNaN(num) ? 0 : num;
    };
    
    return {
      top: parsePaddingValue(paddingTop),
      right: parsePaddingValue(paddingRight),
      bottom: parsePaddingValue(paddingBottom),
      left: parsePaddingValue(paddingLeft),
    };
  }
  
  // Fall back to combined padding string
  const padding = element.properties?.padding;
  if (!padding) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  
  // Remove 'px' and split by spaces
  const values = String(padding).replace(/px/g, '').trim().split(/\s+/).map(v => parseInt(v, 10) || 0);
  
  if (values.length === 1) {
    // All sides same
    return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
  } else if (values.length === 2) {
    // Top/bottom, left/right
    return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
  } else if (values.length === 4) {
    // Top, right, bottom, left
    return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
  }
  
  return { top: 0, right: 0, bottom: 0, left: 0 };
};

// Helper function to combine padding values into CSS string
const combinePadding = (padding: { top: number; right: number; bottom: number; left: number }): string => {
  if (padding.top === padding.right && padding.right === padding.bottom && padding.bottom === padding.left) {
    return `${padding.top}px`;
  } else if (padding.top === padding.bottom && padding.left === padding.right) {
    return `${padding.top}px ${padding.right}px`;
  } else {
    return `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`;
  }
};

// Helper function to extract numeric value from fontSize string
const parseFontSize = (fontSize: string | undefined): number => {
  if (!fontSize) return 16;
  const match = fontSize.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 16;
};

// Helper function to extract numeric value from borderRadius string
const parseBorderRadius = (borderRadius: string | undefined): number => {
  if (!borderRadius) return 0;
  const match = borderRadius.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Helper function to extract numeric value from borderWidth string
const parseBorderWidth = (borderWidth: string | undefined): number => {
  if (!borderWidth) return 0;
  const match = borderWidth.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Helper function to convert hex to rgb for color input compatibility
const hexToRgb = (hex: string | undefined): string => {
  if (!hex) return '#000000';
  // If already in hex format, return as is
  if (hex.startsWith('#')) return hex;
  // If it's a named color or rgb, try to convert
  if (hex.includes('rgb')) return hex;
  // Try to parse as hex
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (match) {
    return `#${match[1]}${match[2]}${match[3]}`;
  }
  // Default fallback
  return '#000000';
};

// Slider component - Only uses range input (slider), no text input fields
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, unit = 'px', onChange }) => {
  const [localValue, setLocalValue] = React.useState(value);
  const percentage = ((localValue - min) / (max - min)) * 100;
  
  // Sync local value with prop value
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setLocalValue(newValue);
    if (onChange) {
      onChange(newValue);
    } else {
      console.error('[Slider] onChange prop is not a function!', onChange);
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{localValue}{unit}</span>
      </div>
      <input
        type="range"
        id={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}
        name={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}
        min={min}
        max={max}
        value={localValue}
        onChange={handleChange}
        className="w-full"
        aria-label={label}
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
  const [localValue, setLocalValue] = React.useState(value || '');
  
  // Sync local value with prop value when it changes externally
  React.useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  // Get the color value for the color picker - use localValue if available (for real-time updates), otherwise use value
  const getColorValue = (hexValue: string | undefined): string => {
    if (!hexValue) return '#000000';
    
    // If it's already a valid 6-character hex color, return it
    if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
      return hexValue;
    }
    
    // If it's a valid hex without #, add it
    if (/^[0-9A-Fa-f]{6}$/.test(hexValue)) {
      return '#' + hexValue;
    }
    
    // For partial hex codes (e.g., "#ff" or "#ff00"), pad with zeros to make it valid
    if (/^#[0-9A-Fa-f]{1,5}$/.test(hexValue)) {
      const hexPart = hexValue.substring(1); // Remove #
      // Pad with zeros to make it 6 characters
      const padded = (hexPart + '000000').substring(0, 6);
      return '#' + padded;
    }
    
    // Try to use hexToRgb for other formats (rgb, named colors, etc.)
    return hexToRgb(hexValue);
  };
  
  // Use localValue for real-time color preview while typing, fallback to value
  const colorValue = getColorValue(localValue || value);
  
  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove all # symbols first to handle cases where user pastes with #
    inputValue = inputValue.replace(/#/g, '');
    
    // Only allow hex characters (0-9, a-f, A-F)
    inputValue = inputValue.replace(/[^0-9a-fA-F]/g, '');
    
    // Limit to 6 hex characters (max length for hex color)
    if (inputValue.length > 6) {
      inputValue = inputValue.substring(0, 6);
    }
    
    // If there's any content, add a single # prefix
    // If empty, set to empty string
    const finalValue = inputValue.length > 0 ? '#' + inputValue : '';
    
    // Update local state immediately for responsive typing
    setLocalValue(finalValue);
    
    // Update parent
    onChange(finalValue);
  };
  
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          id={`color-picker-${label.toLowerCase().replace(/\s+/g, '-')}`}
          name={`color-picker-${label.toLowerCase().replace(/\s+/g, '-')}`}
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer"
          aria-label={`${label} color picker`}
          style={{ padding: '2px', backgroundColor: colorValue }}
        />
        <input
          type="text"
          id={`color-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
          name={`color-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
          value={localValue}
          onChange={handleTextInputChange}
          placeholder="#000000"
          aria-label={`${label} hex value`}
          className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
};

interface SectionEditorProps {
  section: TemplateSection;
  onUpdate: (sectionId: string, updates: Partial<TemplateSection>) => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({ section, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{section.name}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">Section Properties</p>
      </div>
      
      <ColorPicker
        label="Background Color"
        value={section.backgroundColor}
        onChange={(value) => onUpdate(section.id, { backgroundColor: value })}
      />
    </div>
  );
};

/** Image Powered (and similar) bundled previews under /EmailDemoImages/image_1.png … image_5.png */
function isBundledEmailDemoImageSrc(raw: string): boolean {
  const u = (raw || '').trim();
  if (!u) return false;
  if (/^\/EmailDemoImages\/image_[1-5]\.png$/i.test(u)) return true;
  return /(?:^|\/)(EmailDemoImages\/image_[1-5]\.png)(?:\?|#|$)/i.test(u);
}

const ElementEditor: React.FC<ElementEditorProps> = React.memo(({ element, onUpdate, sourceTemplateId }) => {
  const [localValue, setLocalValue] = useState(element.value);
  const [demoImageSrcUnmasked, setDemoImageSrcUnmasked] = useState(false);
  const [imageHref, setImageHref] = useState(element.properties?.href || '');
  const [iconSrc, setIconSrc] = useState(
    element.properties?.iconSrc || element.properties?.imageSrc || ''
  );
  const [padding, setPadding] = useState(parsePadding(element));
  const [fontSize, setFontSize] = useState(parseFontSize(element.properties?.fontSize));
  const [borderRadius, setBorderRadius] = useState(parseBorderRadius(element.properties?.borderRadius));
  const [borderWidth, setBorderWidth] = useState(parseBorderWidth(element.properties?.borderWidth));

  // Sync state when element changes (using element.id as primary dependency to avoid unnecessary re-renders)
  useEffect(() => {
    setLocalValue(element.value);
    setImageHref(element.properties?.href || '');
    setIconSrc(element.properties?.iconSrc || element.properties?.imageSrc || '');
    setPadding(parsePadding(element));
    setFontSize(parseFontSize(element.properties?.fontSize));
    setBorderRadius(parseBorderRadius(element.properties?.borderRadius));
    setBorderWidth(parseBorderWidth(element.properties?.borderWidth));
  }, [
    element.id,
    element.value,
    element.properties?.href,
    element.properties?.iconSrc,
    element.properties?.imageSrc,
    element.properties?.padding,
    element.properties?.paddingTop,
    element.properties?.paddingBottom,
    element.properties?.paddingLeft,
    element.properties?.paddingRight,
    element.properties?.fontSize,
    element.properties?.borderRadius,
    element.properties?.borderWidth
  ]);

  useEffect(() => {
    setDemoImageSrcUnmasked(false);
  }, [element.id]);

  // Helper function to detect logo images in header
  const isLogoImage = (): boolean => {
    if (element.type !== 'image') return false;
    const label = element.label?.toLowerCase() ?? '';
    const altText = (element.properties?.alt || '').toLowerCase();
    return (
      (element.id === 'img_1' || element.id === 'img_logo' || element.id === 'logo') ||
      label.includes('logo') ||
      label.includes('brand') ||
      altText.includes('logo') ||
      altText.includes('brand')
    );
  };

  const handleUpdate = () => {
    // For images, update the value (which is used for src)
    if (element.type === 'image') {
      const updatedProperties = { ...(element.properties || {}) };
      
      // Only include href if it has a value
      if (imageHref && imageHref.trim()) {
        updatedProperties.href = imageHref.trim();
      } else {
        // Remove href if it's empty
        delete updatedProperties.href;
      }
      
      onUpdate(element.id, {
        value: localValue,
        properties: updatedProperties,
      });
    } else {
      onUpdate(element.id, { value: localValue });
    }
  };

  const handleImageHrefUpdate = () => {
    // Update the href property separately (only if not empty)
    if (element.type === 'image') {
      const updatedProperties = { ...(element.properties || {}) };
      
      // Only include href if it has a value
      if (imageHref && imageHref.trim()) {
        updatedProperties.href = imageHref.trim();
      } else {
        // Remove href if it's empty
        delete updatedProperties.href;
      }
      
      onUpdate(element.id, {
        properties: updatedProperties,
      });
    }
  };

  const handleIconSrcUpdate = () => {
    if (!(element.type === 'link' || element.type === 'button')) return;

    // Only support "social footer icon" links in this editor for now.
    if (!element.id.startsWith('footer_social_')) return;

    const updatedProperties = { ...(element.properties || {}) };
    const next = iconSrc.trim();

    if (next) {
      updatedProperties.iconSrc = next;
    } else {
      delete updatedProperties.iconSrc;
      delete updatedProperties.imageSrc;
    }

    onUpdate(element.id, { properties: updatedProperties });
  };

  const handlePaddingChange = (side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
    const newPadding = { ...padding, [side]: value };
    setPadding(newPadding);
    // Update properties with individual padding values for better control
    // Explicitly set all four padding properties to preserve values
    const updatedProperties = {
      ...(element.properties || {}),
      padding: combinePadding(newPadding),
      paddingTop: `${newPadding.top}px`,
      paddingRight: `${newPadding.right}px`,
      paddingBottom: `${newPadding.bottom}px`,
      paddingLeft: `${newPadding.left}px`
    };
    onUpdate(element.id, {
      properties: updatedProperties
    });
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    onUpdate(element.id, {
      properties: { ...(element.properties || {}), fontSize: `${value}px` }
    });
  };

  const handleBorderRadiusChange = (value: number) => {
    setBorderRadius(value);
    onUpdate(element.id, {
      properties: { ...(element.properties || {}), borderRadius: `${value}px` }
    });
  };

  const handleBorderWidthChange = (value: number) => {
    setBorderWidth(value);
    onUpdate(element.id, {
      properties: { ...(element.properties || {}), borderWidth: `${value}px` }
    });
  };

  const handleColorChange = (property: 'textColor' | 'backgroundColor' | 'borderColor', value: string) => {
    if (property === 'textColor') {
      const trimmed = (value || '').trim();
      if (!trimmed) {
        const rest = { ...(element.properties || {}) };
        delete (rest as { textColor?: string }).textColor;
        delete (rest as { userSetTextColor?: boolean }).userSetTextColor;
        onUpdate(element.id, {
          properties: rest,
        });
        return;
      }
      onUpdate(element.id, {
        properties: {
          ...(element.properties || {}),
          textColor: trimmed,
          userSetTextColor: true,
        },
      });
      return;
    }
    onUpdate(element.id, {
      properties: { ...(element.properties || {}), [property]: value }
    });
  };

  // These footer social placeholders are removed from the templates entirely.
  if (element.id.startsWith('footer_social_')) {
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
        Footer social icons were removed from this template.
      </div>
    );
  }

  const maskBundledDemoImageSrc =
    element.type === 'image' && isBundledEmailDemoImageSrc(localValue) && !demoImageSrcUnmasked;
  const imageSrcFieldValue = maskBundledDemoImageSrc ? '' : localValue;
  const imageSrcPlaceholder = maskBundledDemoImageSrc
    ? 'Bundled demo image — paste or type a URL to replace'
    : 'https://example.com/image.jpg';

  return (
    <div className="space-y-6">
      {/* Visibility Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Visibility
          </label>
          {element.visible === false && (
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full">
              Hidden
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onUpdate(element.id, { visible: !element.visible });
          }}
          className={`p-2 rounded-md transition-colors ${
            element.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title={element.visible ? 'Hide element' : 'Show element'}
        >
          {element.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Value Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {element.type === 'image' ? 'Image link (src)' : 'Value'}
        </label>
        {element.type === 'text' || element.type === 'heading' ? (
          <textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleUpdate}
            rows={element.type === 'heading' ? 2 : 4}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <input
            type={element.type === 'image' ? 'url' : 'text'}
            value={element.type === 'image' ? imageSrcFieldValue : localValue}
            onChange={(e) => {
              if (element.type === 'image' && isBundledEmailDemoImageSrc(localValue) && !demoImageSrcUnmasked) {
                setDemoImageSrcUnmasked(true);
              }
              setLocalValue(e.target.value);
            }}
            onBlur={handleUpdate}
            placeholder={element.type === 'image' ? imageSrcPlaceholder : ''}
            autoComplete="off"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      {/* Social Footer Icon Image URL (only for 4 footer_social_* links) */}
      {(element.type === 'link' || element.type === 'button') && element.id.startsWith('footer_social_') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Icon Image URL
          </label>
          <input
            type="url"
            value={iconSrc}
            onChange={(e) => setIconSrc(e.target.value)}
            onBlur={handleIconSrcUpdate}
            placeholder="https://example.com/facebook-icon.png"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            When set, this replaces the text with an image inside the footer link.
          </p>
        </div>
      )}

      {/* Image URL (href) - Only for images (including logos) */}
      {element.type === 'image' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            URL (href) - Parent link
          </label>
          <input
            type="url"
            value={imageHref}
            onChange={(e) => setImageHref(e.target.value)}
            onBlur={handleImageHrefUpdate}
            placeholder="https://example.com/product-page"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">The link that wraps the image (optional). Works for all images including logos.</p>
        </div>
      )}

      {/* Font Family Selector - Show for text, heading, button, link elements */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.properties?.fontFamily) && (
        <div>
          <FontSelector
            value={element.properties?.fontFamily}
            onChange={(fontFamily) => {
              onUpdate(element.id, {
                properties: { ...(element.properties || {}), fontFamily }
              });
            }}
            label="Font Family"
          />
        </div>
      )}

      {/* Font Size Slider - Show for text, heading, button, link elements */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link') && (
        <div>
          <Slider
            label="Font Size"
            value={fontSize}
            min={10}
            max={72}
            onChange={handleFontSizeChange}
          />
        </div>
      )}

      {/* Font Weight - Show for text, heading, button, link elements or if property exists */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.properties?.fontWeight) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Font Weight</label>
          <select
            value={element.properties?.fontWeight || '400'}
            onChange={(e) => {
              onUpdate(element.id, {
                properties: { ...(element.properties || {}), fontWeight: e.target.value }
              });
            }}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semi-bold (600)</option>
            <option value="700">Bold (700)</option>
          </select>
        </div>
      )}

      {/* Line Height - Show for text, heading, button, link elements or if property exists */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.properties?.lineHeight) && (
        <div>
          <Slider
            label="Line Height"
            value={parseFontSize(element.properties?.lineHeight)}
            min={10}
            max={60}
            onChange={(value) => {
              onUpdate(element.id, {
                properties: { ...(element.properties || {}), lineHeight: `${value}px` }
              });
            }}
          />
        </div>
      )}

      {/* Text vs element alignment — `button` only on Thank You (stock `freeflow_thank_you` or derived saved emails). */}
      {(element.type === 'text' ||
        element.type === 'heading' ||
        element.type === 'link' ||
        (element.type === 'button' && sourceTemplateId === THANK_YOU_TEMPLATE_ID) ||
        (element.properties?.textAlign && element.type !== 'button')) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{getAlignmentControlLabel(element)}</label>
          <div className="flex gap-2">
            {(
              [
                { value: 'left', label: 'Left', Icon: AlignLeft },
                { value: 'center', label: 'Center', Icon: AlignCenter },
                { value: 'right', label: 'Right', Icon: AlignRight },
              ] as const
            ).map(({ value, label, Icon }) => {
              const current = (element.properties?.textAlign as string) || 'left';
              const active = current === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onUpdate(element.id, {
                      properties: { ...(element.properties || {}), textAlign: value },
                    });
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border text-sm transition-colors ${
                    active ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Margin - Show for text, heading, button, link elements or if property exists */}
      {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.properties?.margin) && (
        <div>
          <label htmlFor={`margin-${element.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Margin</label>
          <input
            type="text"
            id={`margin-${element.id}`}
            name={`margin-${element.id}`}
            value={element.properties?.margin || ''}
            onChange={(e) => {
              onUpdate(element.id, {
                properties: { ...(element.properties || {}), margin: e.target.value }
              });
            }}
            placeholder="0 0 8px 0"
            aria-label="Margin values"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">CSS margin format: "top right bottom left" or "vertical horizontal"</p>
        </div>
      )}

      {/* Border Radius Slider - Show for button, link, section elements and any element that can have border radius, but hide for logo images and Contact Support link */}
      {!isLogoImage() && (element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.borderRadius) && element.id !== 'link_alternate' && (
        <div>
          <Slider
            label="Border Radius"
            value={borderRadius}
            min={0}
            max={50}
            onChange={handleBorderRadiusChange}
          />
        </div>
      )}

      {/* Border Width Slider - Show for button, link, section elements and any element that can have border, but hide for logo images, Contact Support link, and Read More links */}
      {!isLogoImage() && (element.type === 'button' || element.type === 'link' || element.type === 'section' || element.properties?.borderWidth || element.properties?.borderColor) && element.id !== 'link_alternate' && element.id !== 'read_more_1' && element.id !== 'read_more_2' && element.id !== 'read_more_3' && (
        <div>
          <Slider
            label="Border Width"
            value={borderWidth}
            min={0}
            max={20}
            onChange={handleBorderWidthChange}
          />
        </div>
      )}

      {/* Padding Sliders - Only sliders are used, no text input fields. Show for button, link, heading, text, section elements and any element that can have padding, but hide all padding controls for logo images, Contact Support link, and Read More links */}
      {!isLogoImage() && (element.type === 'button' || element.type === 'link' || element.type === 'heading' || element.type === 'text' || element.type === 'section' || element.properties?.padding || element.properties?.paddingTop || element.properties?.paddingBottom || element.properties?.paddingLeft || element.properties?.paddingRight) && element.id !== 'link_contact_support' && element.id !== 'link_alternate' && element.id !== 'read_more_1' && element.id !== 'read_more_2' && element.id !== 'read_more_3' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Padding</label>
          <div className="space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-800">
            {/* Check if this is a stat label or stat value element - hide padding top/bottom for these */}
            {(() => {
              const label = element.label?.toLowerCase() ?? '';
              const id = element.id?.toLowerCase() ?? '';
              const isStatElement = (label.includes('stat') && (label.includes('label') || label.includes('value'))) ||
                                   (id.includes('stat') && (id.includes('label') || id.includes('value')));
              return (
                <>
                  {!isStatElement && (
            <Slider
              label="Padding Top"
              value={padding.top}
              min={0}
              max={50}
              onChange={(value) => {
                handlePaddingChange('top', value);
              }}
            />
                  )}
            <Slider
              label="Padding Right"
              value={padding.right}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('right', value)}
            />
                  {!isStatElement && (
            <Slider
              label="Padding Bottom"
              value={padding.bottom}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('bottom', value)}
            />
                  )}
            <Slider
              label="Padding Left"
              value={padding.left}
              min={0}
              max={50}
              onChange={(value) => handlePaddingChange('left', value)}
            />
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Color Pickers */}
      <div className="space-y-4">
        {/* Text Color - Show for text, heading, button, link elements */}
        {(element.type === 'text' || element.type === 'heading' || element.type === 'button' || element.type === 'link' || element.properties?.textColor) && (
          <ColorPicker
            label="Text Color"
            value={element.properties?.textColor}
            onChange={(value) => handleColorChange('textColor', value)}
          />
        )}
        {/* Background Color - Show for button, link, section elements, step number elements, and any element that can have background, but hide for logo images, Contact Support link, and Read More links */}
        {!isLogoImage() && (element.type === 'button' || element.type === 'link' || element.type === 'section' || element.id === 'text_step_1_number' || element.id === 'text_step_2_number' || element.id === 'text_step_3_number' || element.properties?.backgroundColor) && element.id !== 'link_contact_support' && element.id !== 'read_more_1' && element.id !== 'read_more_2' && element.id !== 'read_more_3' && (
          <ColorPicker
            label="Background Color"
            value={element.properties?.backgroundColor}
            onChange={(value) => handleColorChange('backgroundColor', value)}
          />
        )}
        {/* Border Color - Show for link, section elements, Button: View Order Details, buttons with borderColor property, and any element that can have border (but not Order Total Container, Support Container, Pricing Container, Contact Support link, Read More links, or Secondary CTA) */}
        {(element.id === 'button_view_order' || element.type === 'link' || element.type === 'section' || element.properties?.borderColor) && element.id !== 'section_order_total_container' && element.id !== 'section_support_container' && element.id !== 'section_pricing_container' && element.id !== 'link_contact_support' && element.id !== 'link_alternate' && element.id !== 'read_more_1' && element.id !== 'read_more_2' && element.id !== 'read_more_3' && element.id !== 'button_cta_secondary' && (
          <ColorPicker
            label="Border Color"
            value={element.properties?.borderColor}
            onChange={(value) => handleColorChange('borderColor', value)}
          />
        )}
      </div>

      {/* Other Properties */}
      {element.properties && Object.entries(element.properties).map(([key, value]) => {
        // Skip properties that are already handled with custom controls
        if (['width', 'height', 'fontSize', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius', 'borderWidth', 'textColor', 'backgroundColor', 'borderColor', 'fontFamily', 'fontWeight', 'lineHeight', 'margin', 'textAlign'].includes(key)) {
          return null;
        }
        
        return (
          <div key={key}>
            <label htmlFor={`property-${element.id}-${key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            {key === 'url' && value ? (
              <input
                type="url"
                id={`property-${element.id}-${key}`}
                name={`property-${element.id}-${key}`}
                value={value}
                onChange={(e) => {
                  onUpdate(element.id, {
                    properties: { ...element.properties, [key]: e.target.value }
                  });
                }}
                aria-label={`URL for ${element.label || element.id}`}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : key === 'alt' ? (
              <input
                type="text"
                id={`property-${element.id}-${key}`}
                name={`property-${element.id}-${key}`}
                value={value}
                onChange={(e) => {
                  onUpdate(element.id, {
                    properties: { ...element.properties, [key]: e.target.value }
                  });
                }}
                aria-label={`Alt text for ${element.label || element.id}`}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : key === 'fontWeight' ? (
              <select
                id={`property-${element.id}-${key}`}
                name={`property-${element.id}-${key}`}
                value={value}
                onChange={(e) => {
                  onUpdate(element.id, {
                    properties: { ...element.properties, [key]: e.target.value }
                  });
                }}
                aria-label={`Font weight for ${element.label || element.id}`}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="400">Normal</option>
                <option value="600">Semi-bold</option>
                <option value="700">Bold</option>
              </select>
            ) : (
              <input
                type="text"
                id={`property-${element.id}-${key}`}
                name={`property-${element.id}-${key}`}
                value={value}
                onChange={(e) => {
                  onUpdate(element.id, {
                    properties: { ...element.properties, [key]: e.target.value }
                  });
                }}
                aria-label={`${key.replace(/([A-Z])/g, ' $1').trim()} for ${element.label || element.id}`}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  // Only re-render if element ID or key properties change
  if (prevProps.element.id !== nextProps.element.id) return false;
  if (prevProps.element.value !== nextProps.element.value) return false;
  if (prevProps.element.visible !== nextProps.element.visible) return false;
  if (JSON.stringify(prevProps.element.properties) !== JSON.stringify(nextProps.element.properties)) return false;
  if (prevProps.sourceTemplateId !== nextProps.sourceTemplateId) return false;
  return true;
});

ElementEditor.displayName = 'ElementEditor';

// Add save dialog before closing the main return
