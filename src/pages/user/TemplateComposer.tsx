import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Plus, Trash2, Edit2, Save, Eye, Code, GripVertical, X, Search, RefreshCw, ChevronDown, ChevronRight, ChevronUp, Type, ImageIcon, Link as LinkIcon, MousePointerClick, Mail, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { componentLibraryService, ComponentData } from '../../services/componentLibraryService';
import { extractSectionsFromTemplate } from '../../utils/extractTemplateSections';
import { TemplateElement } from '../../services/templateService';
import { useAuth } from '../../context/AuthContext';
import { getSavedTemplates, saveTemplates, getStorageInfo, canSaveTemplate, formatBytes, StorageInfo, STORAGE_LIMITS, TemplateComponent, TemplateData } from '../../utils/savedTemplatesStorage';
import { getTierStorageLimits, hasCapability } from '../../utils/userTiers';
import { useUserTier } from '../../hooks/useUserTier';
import { removeFooterSocialIcons } from '../../utils/removeFooterSocialIcons';
import { getAlignmentControlLabel } from '../../utils/alignmentControlLabel';
import { buildEmbeddedThemeStyleContent, type ThemeCssMode } from '../../utils/emailBuilderEmbeddedThemeCss';

/**
 * Block *new* template saves when quotas are exceeded. Uses effective UI tier + server counts.
 * Do not rely on API `isAtLimit` alone: storage-summary limits are derived from DB tier and can
 * disagree with `/api/auth/me`, which incorrectly disabled Save for some Pro users.
 */
function isComposerNewTemplateStorageBlocked(
  storageInfo: StorageInfo | null,
  tier: string | null | undefined,
  isAdmin: boolean,
  currentTemplateId: string | null
): boolean {
  if (isAdmin || currentTemplateId) return false;
  if (!storageInfo) return false;
  const limits = getTierStorageLimits(tier);
  if (limits.maxTemplates <= 0) return true;
  if (storageInfo.templatesCount >= limits.maxTemplates) return true;
  if (limits.maxStorageMB > 0 && storageInfo.storageUsedMB >= limits.maxStorageMB) return true;
  return false;
}

/** Email-client resets only; theme rules come from `buildEmbeddedThemeStyleContent` (matches Email Builder). */
const COMPOSER_RESET_STYLE_INNER = `    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }`;

function buildComposerThemeHeadBlock(themeCssMode: ThemeCssMode): string {
  return `  <!--[if !mso]><!-->
  <style type="text/css">
${COMPOSER_RESET_STYLE_INNER}
  </style>
  <style type="text/css">
${buildEmbeddedThemeStyleContent(themeCssMode)}
  </style>
  <!--<![endif]-->`;
}

/** Initial Light/Dark preview toggle: match OS preference (user can still change it). */
function getSystemPreviewTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTextAlignToComponentHtml(htmlFragment: string, element: TemplateElement, textAlign: string): string {
  try {
    const wrapped = `<div id="composer-style-wrap">${htmlFragment}</div>`;
    const doc = new DOMParser().parseFromString(wrapped, 'text/html');
    const root = doc.getElementById('composer-style-wrap');
    if (!root) return htmlFragment;
    const sel = element.selector || '';
    const m = sel.match(/data-element=["']([^"']+)["']/);
    if (!m) return htmlFragment;
    const key = m[1].replace(/\\/g, '');
    const node = root.querySelector(`[data-element="${key}"]`);
    if (!node || !(node instanceof HTMLElement)) return htmlFragment;

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

    const tag = node.tagName.toLowerCase();
    const st = node.getAttribute('style') || '';

    if (element.type === 'button' && tag === 'td') {
      const cleaned = st
        .replace(/\s*text-align\s*:\s*[^;]+;?/gi, '')
        .replace(/;\s*;/g, ';')
        .trim()
        .replace(/^;|;$/g, '');
      const addition = `text-align: ${textAlign}`;
      const next = cleaned ? `${cleaned.replace(/;$/, '')}; ${addition}` : addition;
      node.setAttribute('style', next);
      return root.innerHTML;
    }

    if (element.type === 'button' && tag === 'a') {
      const marginTop = parseMarginTop(st);
      let marginVal = '';
      if (textAlign === 'left') marginVal = `${marginTop} auto 0 0`;
      else if (textAlign === 'right') marginVal = `${marginTop} 0 0 auto`;
      else marginVal = `${marginTop} auto 0 auto`;
      const cleaned = st
        .replace(/\s*text-align\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*display\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*width\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*max-width\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*margin\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*margin-top\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*margin-right\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*margin-bottom\s*:\s*[^;]+;?/gi, '')
        .replace(/\s*margin-left\s*:\s*[^;]+;?/gi, '')
        .replace(/;\s*;/g, ';')
        .trim()
        .replace(/^;|;$/g, '');
      const additions = `display: block; width: fit-content; max-width: 100%; text-align: center; margin: ${marginVal}`;
      const next = cleaned ? `${cleaned.replace(/;$/, '')}; ${additions}` : additions;
      node.setAttribute('style', next);
      return root.innerHTML;
    }

    const cleaned = st.replace(/\s*text-align\s*:\s*[^;]+;?/gi, '').replace(/;\s*;/g, ';').trim();
    const addition = `text-align: ${textAlign}`;
    const next = cleaned ? `${cleaned.replace(/;$/, '')}; ${addition}` : addition;
    node.setAttribute('style', next);
    return root.innerHTML;
  } catch {
    return htmlFragment;
  }
}

// Color picker component for components
interface ComponentColorPickerProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

const ComponentColorPicker: React.FC<ComponentColorPickerProps> = ({ label, value, onChange }) => {
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

  const colorValue = hexToRgb(value || '#000000');
  const displayValue = value || '';
  
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer"
          style={{ padding: '2px', backgroundColor: colorValue }}
        />
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </div>
    </div>
  );
};

export const TemplateComposer: React.FC = () => {
  const { templateId } = useParams<{ templateId?: string }>();
  const navigate = useNavigate();
  const { user, refreshUser, isLoading: authLoading } = useAuth();
  const { tier } = useUserTier();
  const savedTemplatesTierSyncRef = useRef(false);

  useEffect(() => {
    savedTemplatesTierSyncRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || savedTemplatesTierSyncRef.current) return;
    savedTemplatesTierSyncRef.current = true;
    void refreshUser();
  }, [authLoading, user?.id, refreshUser]);

  const [availableComponents, setAvailableComponents] = useState<ComponentData[]>([]);
  const [templateComponents, setTemplateComponents] = useState<TemplateComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<TemplateComponent | null>(null);
  const [selectedElement, setSelectedElement] = useState<TemplateElement | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [templateName, setTemplateName] = useState('');
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [draggedComponent, setDraggedComponent] = useState<ComponentData | null>(null);
  const [draggedTemplateComponent, setDraggedTemplateComponent] = useState<TemplateComponent | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [themeCssMode, setThemeCssMode] = useState<ThemeCssMode>('adaptive');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>(() => getSystemPreviewTheme());
  const effectivePreviewTheme: 'light' | 'dark' =
    themeCssMode === 'light-only' ? 'light' : previewTheme;
  
  // Constants for drag data types
  const DRAG_TYPE_COMPONENT = 'application/x-component-library';
  const DRAG_TYPE_TEMPLATE_COMPONENT = 'application/x-template-component';

  /**
   * Normalize component order values to ensure they are sequential (0, 1, 2, 3...)
   * Handles edge cases:
   * - Components without order property (legacy templates)
   * - Gaps in order values
   * - Duplicate order values
   * @param components - Array of template components
   * @returns Array of components with normalized order values
   */
  const normalizeComponentOrder = useCallback((components: TemplateComponent[]): TemplateComponent[] => {
    if (!components || components.length === 0) {
      return [];
    }

    // Sort by existing order (or use array index as fallback for legacy components)
    const sorted = [...components].sort((a, b) => {
      const orderA = a.order ?? components.indexOf(a);
      const orderB = b.order ?? components.indexOf(b);
      return orderA - orderB;
    });

    // Re-assign sequential order values (0, 1, 2, 3...)
    return sorted.map((comp, index) => ({
      ...comp,
      order: index,
    }));
  }, []);

  const handleBack = () => {
    // Navigate back based on current path
    if (window.location.pathname.includes('/gestion')) {
      navigate('/gestion');
    } else {
      navigate('/user');
    }
  };

  // Load available components from Master Template and Component Library
  const loadComponents = useCallback(async () => {
    try {
      // Extract sections from Master Template
      const sectionComponents = await extractSectionsFromTemplate('master_template');

      // Define excluded components (components that shouldn't be in Template Composer)
      const excludedComponentNames = ['Bulletpoints', 'Hero Component', 'Header Split'];
      const excludedComponentIds: string[] = ['header_split'];
      
      // Convert SectionComponent to ComponentData format
      // Filter out excluded components (but keep "Hero Block" - only exclude exact "Hero")
      const templateComponents: ComponentData[] = sectionComponents
        .filter(section => {
          // Check name match - must be exact match (not "Hero Block")
          const nameMatch = excludedComponentNames.some(excluded => 
            section.name === excluded || section.name.toLowerCase() === excluded.toLowerCase()
          );
          
          // Check ID match - must be exact match (not "hero_block")
          const idMatch = excludedComponentIds.some(id => 
            section.id.toLowerCase() === id.toLowerCase() // Exact match only, not includes
          );
          
          if (nameMatch || idMatch) {
            return false;
          }
          return true;
        })
        .map(section => ({
          id: section.id,
          name: section.name,
          html: section.html,
          category: section.category,
          status: 'live' as const,
          elements: section.elements.map(el => ({
            id: el.id,
            type: el.type,
            selector: el.selector,
            label: el.label,
            defaultValue: el.defaultValue,
            value: el.value,
            visible: el.visible,
            properties: el.properties,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      
      // Also load components from Component Library Service (now using Supabase)
      // Try Supabase first, fallback to localStorage for backward compatibility
      let libraryComponents: ComponentData[] = [];
      try {
        const { getAllComponentsSupabase } = await import('../../services/componentLibrarySupabase');
        libraryComponents = await getAllComponentsSupabase();
        // Filter to only live components
        libraryComponents = libraryComponents.filter(c => c.status === 'live');
      } catch {
        // Fallback to localStorage
        libraryComponents = componentLibraryService.getLiveComponents();
      }
      
      // Create a set of template component IDs and names for deduplication
      const templateComponentIds = new Set(templateComponents.map(c => c.id));
      const templateComponentNames = new Set(templateComponents.map(c => c.name.toLowerCase()));
      
      // Only include library components that don't exist in master template
      // (by ID or by name - case insensitive) and are not excluded
      const uniqueLibraryComponents = libraryComponents.filter(libComponent => {
        // Check if excluded - exact match only (not "Hero Block")
        const nameExcluded = excludedComponentNames.some(excluded => 
          libComponent.name === excluded || libComponent.name.toLowerCase() === excluded.toLowerCase()
        );
        const idExcluded = excludedComponentIds.some(id => 
          libComponent.id.toLowerCase() === id.toLowerCase() // Exact match only
        );
        if (nameExcluded || idExcluded) {
          return false;
        }
        
        // Check if duplicate of master template component
        const idMatch = libComponent.id && templateComponentIds.has(libComponent.id);
        const nameMatch = libComponent.name && templateComponentNames.has(libComponent.name.toLowerCase());
        
        if (idMatch || nameMatch) {
          return false;
        }
        return true;
      });

      // Combine both sources (master template takes priority)
      const allComponents: ComponentData[] = [...templateComponents, ...uniqueLibraryComponents];
      
      // Deduplicate components: keep only unique components based on name + HTML structure
      // Create a simple hash of the HTML for comparison
      const createComponentHash = (html: string): string => {
        // Normalize HTML: remove whitespace, comments, and normalize attributes
        // This helps identify truly duplicate components even if they have minor formatting differences
        const normalized = html
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
          .replace(/\s*=\s*/g, '=') // Normalize attribute spacing
          .trim();
        // Create a simple hash (for uniqueness, not security)
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
          const char = normalized.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
      };
      
      // Group components by ID first (most reliable), then by name + hash
      const componentMap = new Map<string, ComponentData>();
      const seenIds = new Set<string>();
      const seenHashes = new Map<string, { id: string; name: string; count: number }>(); // Track duplicates
      
      allComponents.forEach(component => {
        if (!component.html || component.html.trim() === '') {
          return; // Skip empty components
        }
        
        // First check by ID (most reliable - each component should have unique ID)
        if (component.id && seenIds.has(component.id)) {
          return; // Skip duplicate ID
        }
        
        const hash = createComponentHash(component.html);
        
        // Check if we've seen this HTML structure before (even with different name/ID)
        const existing = seenHashes.get(hash);
        if (existing) {
          existing.count++;
          return; // Skip this duplicate
        }
        
        // New unique component
        if (component.id) {
          seenIds.add(component.id);
        }
        componentMap.set(component.id || `component_${Date.now()}_${Math.random()}`, component);
        seenHashes.set(hash, { id: component.id || '', name: component.name, count: 1 });
      });
      
      // Convert map to array, filter out excluded components, and sort by name
      const uniqueComponents = Array.from(componentMap.values())
        .filter(component => {
          // Check if excluded - exact match only (not "Hero Block")
          const nameExcluded = excludedComponentNames.some(excluded => 
            component.name === excluded || component.name.toLowerCase() === excluded.toLowerCase()
          );
          const idExcluded = excludedComponentIds.some(id => 
            component.id.toLowerCase() === id.toLowerCase() // Exact match only
          );
          if (nameExcluded || idExcluded) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Log deduplication stats
      setAvailableComponents(uniqueComponents);
    } catch (error) {
      console.error('Error loading components from templates:', error);
      setAvailableComponents([]);
    }
  }, []);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  useEffect(() => {
    if (themeCssMode === 'light-only' && previewTheme === 'dark') {
      setPreviewTheme('light');
    }
  }, [themeCssMode, previewTheme]);

  useEffect(() => {
    const iframe = previewIframeRef.current;
    const body = iframe?.contentDocument?.body;
    if (!body) return;
    try {
      body.setAttribute('data-preview-theme', effectivePreviewTheme);
    } catch {
      // ignore
    }
  }, [effectivePreviewTheme]);

  // New composer route (no :templateId) — reset draft. Only depends on templateId so user?.id
  // becoming available does not wipe components/name the user already added.
  useEffect(() => {
    if (templateId) return;
    setTemplateName('');
    setTemplateComponents([]);
    setCurrentTemplateId(null);
    setThemeCssMode('adaptive');
    setPreviewTheme(getSystemPreviewTheme());
  }, [templateId]);

  // Load existing template when URL contains templateId
  useEffect(() => {
    if (!templateId || !user?.id) return;

    const loadTemplate = async () => {
      try {
        try {
          const { getTemplateByIdSupabase } = await import('../../services/savedTemplatesSupabase');
          const template = await getTemplateByIdSupabase(templateId, user.id);

          if (template) {
            setTemplateName(template.name);
            const normalizedComponents = normalizeComponentOrder(template.components);
            setTemplateComponents(normalizedComponents);
            setCurrentTemplateId(template.id);
            setThemeCssMode(template.themeCssMode ?? 'adaptive');
            return;
          }
        } catch {
          /* fallback to localStorage below */
        }

        const savedTemplates = getSavedTemplates(user.id);
        const template = savedTemplates.find((t: TemplateData) => t.id === templateId);

        if (template) {
          setTemplateName(template.name);
          const normalizedComponents = normalizeComponentOrder(template.components);
          setTemplateComponents(normalizedComponents);
          setCurrentTemplateId(template.id);
          setThemeCssMode(template.themeCssMode ?? 'adaptive');
        } else {
          const isAdminPath = window.location.pathname.includes('/gestion');
          navigate(isAdminPath ? '/gestion/template-composer' : '/user/template-composer');
        }
      } catch (error) {
        console.error('Error loading template:', error);
      }
    };

    void loadTemplate();
  }, [templateId, user?.id, navigate, normalizeComponentOrder]);

  // Get unique categories from components
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    availableComponents.forEach(c => {
      const category = c.category?.trim() || 'other';
      if (category) {
        categorySet.add(category);
      }
    });
    return Array.from(categorySet).sort();
  }, [availableComponents]);
  
  // Filter components based on search and category, then sort with Header first and Footer last
  const filteredComponents = useMemo(() => {
    const filtered = availableComponents.filter(component => {
      const matchesSearch = component.name.toLowerCase().includes(searchQuery.toLowerCase());
      const componentCategory = component.category?.trim() || 'other';
      const matchesCategory = categoryFilter === 'all' || componentCategory === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    
    // Sort components: Header first, Footer last, others in between
    return filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aIsHeader = aName.includes('header');
      const bIsHeader = bName.includes('header');
      const aIsFooter = aName.includes('footer');
      const bIsFooter = bName.includes('footer');
      
      // Header always first
      if (aIsHeader && !bIsHeader) return -1;
      if (!aIsHeader && bIsHeader) return 1;
      
      // Footer always last
      if (aIsFooter && !bIsFooter) return 1;
      if (!aIsFooter && bIsFooter) return -1;
      
      // For other components, maintain alphabetical order
      return a.name.localeCompare(b.name);
    });
  }, [availableComponents, searchQuery, categoryFilter]);


  // Load and update storage info (with tier support)
  useEffect(() => {
    const loadStorageInfo = async () => {
      if (!user?.id) {
        // Set default storage info if no user
        const defaultInfo: StorageInfo = {
          templatesCount: 0,
          storageUsed: 0,
          storageUsedMB: 0,
          storageLimitMB: 10, // Default limit
          storagePercentage: 0,
          templatesRemaining: 10,
          isWarning: false,
          isCritical: false,
          isAtLimit: false,
        };
        setStorageInfo(defaultInfo);
        return;
      }
      
      try {
        // Try Supabase first
        const { getStorageInfoSupabase } = await import('../../services/savedTemplatesSupabase');
        const info = await getStorageInfoSupabase(user.id, tier);
        setStorageInfo({
          templatesCount: info.templatesCount,
          storageUsed: info.storageUsed,
          storageUsedMB: info.storageUsedMB,
          storageLimitMB: info.storageLimitMB,
          storagePercentage: info.storagePercentage,
          templatesRemaining: info.templatesRemaining,
          isWarning: info.isWarning,
          isCritical: info.isCritical,
          isAtLimit: info.isAtLimit,
        });
      } catch {
        // Fallback to localStorage
        try {
          const info = getStorageInfo(user.id, tier);
          setStorageInfo(info);
        } catch (localError) {
          console.error('Failed to load storage info from localStorage:', localError);
          // Set default storage info on error
          const defaultInfo: StorageInfo = {
            templatesCount: 0,
            storageUsed: 0,
            storageUsedMB: 0,
            storageLimitMB: 10,
            storagePercentage: 0,
            templatesRemaining: 10,
            isWarning: false,
            isCritical: false,
            isAtLimit: false,
          };
          setStorageInfo(defaultInfo);
        }
      }
    };
    
    loadStorageInfo();
  }, [user?.id, tier]);

  // Update storage info when saved templates change (after save/delete operations)
  useEffect(() => {
    const updateStorageInfo = async () => {
      if (!user?.id) return;
      
      try {
        // Try Supabase first
        const { getStorageInfoSupabase } = await import('../../services/savedTemplatesSupabase');
        const info = await getStorageInfoSupabase(user.id, tier);
        setStorageInfo({
          templatesCount: info.templatesCount,
          storageUsed: info.storageUsed,
          storageUsedMB: info.storageUsedMB,
          storageLimitMB: info.storageLimitMB,
          storagePercentage: info.storagePercentage,
          templatesRemaining: info.templatesRemaining,
          isWarning: info.isWarning,
          isCritical: info.isCritical,
          isAtLimit: info.isAtLimit,
        });
      } catch {
        // Fallback to localStorage
        try {
          const info = getStorageInfo(user.id, tier);
          setStorageInfo(info);
        } catch (localError) {
          console.error('Failed to update storage info:', localError);
        }
      }
    };
    
    // Update immediately
    updateStorageInfo();
    
    // Also listen for storage events (in case storage changes in another tab)
    // Note: This only works for localStorage, not Supabase
    const handleStorage = () => {
      if (user?.id) {
        try {
          const info = getStorageInfo(user.id, tier);
          setStorageInfo(info);
        } catch (error) {
          console.error('Error updating storage info from localStorage event:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user?.id, tier]);

  // Same gate as the route: if you can open Composer, you can attempt save (both are Pro today).
  const canSaveTemplates = useMemo(() => {
    if (user?.is_admin || user?.user_type === 'admin') {
      return true;
    }
    return (
      hasCapability(tier, 'canSaveTemplates') ||
      hasCapability(tier, 'canUseTemplateComposer')
    );
  }, [tier, user?.is_admin, user?.user_type]);

  const isAdmin = user?.is_admin || user?.user_type === 'admin';

  const saveGateBlocked = !canSaveTemplates && !isAdmin;
  const saveStorageBlocked = useMemo(
    () => isComposerNewTemplateStorageBlocked(storageInfo, tier, isAdmin, currentTemplateId),
    [storageInfo, tier, isAdmin, currentTemplateId]
  );
  const tierLimitsSave = useMemo(() => getTierStorageLimits(tier), [tier]);

  /** Tooltip: hard blocks (tier, storage, saving) + soft hints (name / canvas) when Save is still clickable. */
  const saveButtonHint = useMemo(() => {
    if (isSaving) return 'Saving...';
    if (saveGateBlocked) {
      if (user?.subscription_status === 'expired') {
        return 'Your Pro period has ended. Renew to save templates again.';
      }
      return 'Saving custom templates requires an active Pro subscription.';
    }
    if (saveStorageBlocked) {
      return 'You reached your saved template limit. Delete one to save a new template, or free storage space.';
    }
    if (templateComponents.length === 0) {
      return 'Add at least one component (click or drag from the library), then click Save.';
    }
    if (!templateName.trim()) {
      return 'Enter a template name above, then click Save.';
    }
    if (nameError) return nameError;
    if (storageError) return storageError;
    return 'Save Template';
  }, [
    isSaving,
    saveGateBlocked,
    saveStorageBlocked,
    user?.subscription_status,
    templateComponents.length,
    templateName,
    nameError,
    storageError,
  ]);

  /**
   * Move a component up one position in the template order
   * Swaps the component with the one above it and normalizes order values
   * 
   * @param componentId - The ID of the component to move up
   * @returns void - Component is moved and order is normalized
   * 
   * @example
   * // Move component with id "comp_123" up one position
   * handleMoveComponentUp("comp_123");
   */
  const handleMoveComponentUp = useCallback((componentId: string) => {
    const currentIndex = templateComponents.findIndex(c => c.id === componentId);
    if (currentIndex <= 0) return; // Already at top or not found

    const newComponents = [...templateComponents];
    // Swap with component above
    [newComponents[currentIndex - 1], newComponents[currentIndex]] = 
      [newComponents[currentIndex], newComponents[currentIndex - 1]];
    
    // Normalize order
    const normalizedComponents = normalizeComponentOrder(newComponents);
    setTemplateComponents(normalizedComponents);
    
    // Keep component selected after move
    const movedComponent = normalizedComponents.find(c => c.id === componentId);
    if (movedComponent) {
      setSelectedComponent(movedComponent);
    }
  }, [templateComponents, normalizeComponentOrder]);

  /**
   * Move a component down one position in the template order
   * Swaps the component with the one below it and normalizes order values
   * 
   * @param componentId - The ID of the component to move down
   * @returns void - Component is moved and order is normalized
   * 
   * @example
   * // Move component with id "comp_123" down one position
   * handleMoveComponentDown("comp_123");
   */
  const handleMoveComponentDown = useCallback((componentId: string) => {
    const currentIndex = templateComponents.findIndex(c => c.id === componentId);
    if (currentIndex < 0 || currentIndex >= templateComponents.length - 1) return; // Already at bottom or not found

    const newComponents = [...templateComponents];
    // Swap with component below
    [newComponents[currentIndex], newComponents[currentIndex + 1]] = 
      [newComponents[currentIndex + 1], newComponents[currentIndex]];
    
    // Normalize order
    const normalizedComponents = normalizeComponentOrder(newComponents);
    setTemplateComponents(normalizedComponents);
    
    // Keep component selected after move
    const movedComponent = normalizedComponents.find(c => c.id === componentId);
    if (movedComponent) {
      setSelectedComponent(movedComponent);
    }
  }, [templateComponents, normalizeComponentOrder]);

  /**
   * Keyboard shortcuts for component reordering
   * Listens for Arrow Up/Down keys when a component is selected
   * - Arrow Up (↑): Moves selected component up
   * - Arrow Down (↓): Moves selected component down
   * 
   * Only active when:
   * - A component is selected
   * - User is not typing in an input/textarea field
   * 
   * @effect Sets up global keyboard event listener
   * @dependencies selectedComponent, handleMoveComponentUp, handleMoveComponentDown
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when a component is selected and no input is focused
      if (!selectedComponent) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return; // Don't interfere with text input
      }

      if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleMoveComponentUp(selectedComponent.id);
      } else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleMoveComponentDown(selectedComponent.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponent, handleMoveComponentUp, handleMoveComponentDown]);

  // Handle drag start from component library
  const handleDragStart = (e: React.DragEvent, component: ComponentData) => {
    setIsDragging(true);
    setDraggedComponent(component);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.dropEffect = 'copy';
    // Store component data in dataTransfer
    e.dataTransfer.setData(DRAG_TYPE_COMPONENT, JSON.stringify({
      id: component.id,
      name: component.name,
      category: component.category
    }));
    // Also set as text for fallback
    e.dataTransfer.setData('text/plain', component.id);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  // Handle drag start from template canvas or Elements sidebar
  const handleTemplateDragStart = (e: React.DragEvent, component: TemplateComponent) => {
    setIsDragging(true);
    setDraggedTemplateComponent(component);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    // Store component ID in dataTransfer
    e.dataTransfer.setData(DRAG_TYPE_TEMPLATE_COMPONENT, component.id);
    // Also set as text for fallback
    e.dataTransfer.setData('text/plain', component.id);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };


  // Handle drop on canvas or Elements sidebar
  const handleDrop = useCallback((e: React.DragEvent, dropIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    setIsDragging(false);
    
    // Try to get data from dataTransfer first (best practice)
    const componentData = e.dataTransfer.getData(DRAG_TYPE_COMPONENT);
    const templateComponentId = e.dataTransfer.getData(DRAG_TYPE_TEMPLATE_COMPONENT);
    
    if (componentData) {
      // Add new component from library
      try {
        const parsed = JSON.parse(componentData);
        const sourceComponent = availableComponents.find(c => c.id === parsed.id);
        if (sourceComponent) {
          const insertIndex = dropIndex !== undefined ? dropIndex : templateComponents.length;
          const newComponent: TemplateComponent = {
            id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            componentId: sourceComponent.id,
            html: sourceComponent.html,
            order: insertIndex,
          };
          const newComponents = [...templateComponents];
          newComponents.splice(insertIndex, 0, newComponent);
          // Update order
          newComponents.forEach((comp, idx) => {
            comp.order = idx;
          });
          setTemplateComponents(newComponents);
        }
      } catch (error) {
        console.error('Error parsing component data:', error);
      }
      setDraggedComponent(null);
    } else if (templateComponentId) {
      // Reorder existing component
      const oldIndex = templateComponents.findIndex(c => c.id === templateComponentId);
      const newIndex = dropIndex !== undefined ? dropIndex : oldIndex;
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newComponents = [...templateComponents];
        const [removed] = newComponents.splice(oldIndex, 1);
        
        // Calculate the correct insert index
        // Drop zones are positioned "above" each component
        // When dragging down (oldIndex < newIndex), we need to account for the removed item
        // When dragging up (oldIndex > newIndex), we can insert directly
        let adjustedIndex: number;
        if (oldIndex < newIndex) {
          // Dragging down: after removing, indices shift down by 1
          // Drop zone at newIndex means "above component at newIndex"
          // After removal, that component is now at newIndex - 1
          // So we insert at newIndex - 1 to place it above that component
          adjustedIndex = newIndex - 1;
        } else {
          // Dragging up: indices don't shift for items above
          // Drop zone at newIndex means "above component at newIndex"
          // We insert directly at newIndex
          adjustedIndex = newIndex;
        }
        
        newComponents.splice(adjustedIndex, 0, removed);
        // Update order
        newComponents.forEach((comp, idx) => {
          comp.order = idx;
        });
        setTemplateComponents(newComponents);
      }
      setDraggedTemplateComponent(null);
    } else {
      // Fallback to state-based approach if dataTransfer doesn't work
      if (draggedComponent) {
        const insertIndex = dropIndex !== undefined ? dropIndex : templateComponents.length;
        const newComponent: TemplateComponent = {
          id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          componentId: draggedComponent.id,
          html: draggedComponent.html,
          order: insertIndex,
        };
        const newComponents = [...templateComponents];
        newComponents.splice(insertIndex, 0, newComponent);
        newComponents.forEach((comp, idx) => {
          comp.order = idx;
        });
        setTemplateComponents(newComponents);
        setDraggedComponent(null);
      } else if (draggedTemplateComponent) {
        const oldIndex = templateComponents.findIndex(c => c.id === draggedTemplateComponent.id);
        const newIndex = dropIndex !== undefined ? dropIndex : oldIndex;
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newComponents = [...templateComponents];
          const [removed] = newComponents.splice(oldIndex, 1);
          
          // Calculate the correct insert index (same logic as above)
          let adjustedIndex: number;
          if (oldIndex < newIndex) {
            // Dragging down
            adjustedIndex = newIndex - 1;
          } else {
            // Dragging up
            adjustedIndex = newIndex;
          }
          
          newComponents.splice(adjustedIndex, 0, removed);
          newComponents.forEach((comp, idx) => {
            comp.order = idx;
          });
          setTemplateComponents(newComponents);
        }
        setDraggedTemplateComponent(null);
      }
    }
  }, [draggedComponent, draggedTemplateComponent, templateComponents, availableComponents]);

  // Handle drag over - must preventDefault to allow drop
  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Determine drop effect based on what's being dragged
    const hasComponentData = e.dataTransfer.types.includes(DRAG_TYPE_COMPONENT);
    const hasTemplateComponent = e.dataTransfer.types.includes(DRAG_TYPE_TEMPLATE_COMPONENT);
    
    if (hasComponentData) {
      e.dataTransfer.dropEffect = 'copy';
    } else if (hasTemplateComponent) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = draggedComponent ? 'copy' : 'move';
    }
    
    if (index !== undefined) {
      setDragOverIndex(index);
    }
  };

  // Handle drag enter
  const handleDragEnter = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (index !== undefined) {
      setDragOverIndex(index);
    }
  };

  // Handle drag leave - improved to prevent false triggers
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing timeout
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }
    
    // Check if we're actually leaving the drop zone (not just moving to a child element)
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    // Only clear if we're leaving the drop zone entirely
    if (!currentTarget.contains(relatedTarget)) {
      // Small delay to prevent flickering when moving between drop zones
      dragOverTimeoutRef.current = setTimeout(() => {
        // Double-check we're still not over the drop zone
        const rect = currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          setDragOverIndex(null);
        }
        dragOverTimeoutRef.current = null;
      }, 100);
    }
  };

  // Handle drag end - cleanup
  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    // Clear timeout if exists
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }
    setIsDragging(false);
    setDraggedComponent(null);
    setDraggedTemplateComponent(null);
    setDragOverIndex(null);
    // Restore opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  // Add component to template (functional update avoids stale length when React batches events)
  const handleAddComponent = useCallback((component: ComponentData) => {
    setTemplateComponents((prev) => {
      const newComponent: TemplateComponent = {
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        componentId: component.id,
        html: component.html,
        order: prev.length,
      };
      return [...prev, newComponent];
    });
  }, []);

  // Remove component from template
  const handleRemoveComponent = (componentId: string) => {
    // Filter out the removed component and normalize order values
    const remainingComponents = templateComponents.filter(c => c.id !== componentId);
    const normalizedComponents = normalizeComponentOrder(remainingComponents);
    setTemplateComponents(normalizedComponents);
    
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(null);
    }
  };

  // Select component
  const handleSelectComponent = (component: TemplateComponent) => {
    setSelectedComponent(component);
    setSelectedElement(null); // Clear element selection when selecting component
    // Auto-expand the component to show its elements
    if (!expandedComponents.has(component.id)) {
      setExpandedComponents(new Set([...expandedComponents, component.id]));
    }
  };

  const toggleComponentExpand = (componentId: string) => {
    setExpandedComponents(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(componentId)) {
        newExpanded.delete(componentId);
      } else {
        newExpanded.add(componentId);
      }
      return newExpanded;
    });
  };

  // Expand all components
  const expandAllComponents = () => {
    const allComponentIds = new Set(templateComponents.map(c => c.id));
    setExpandedComponents(allComponentIds);
  };

  // Collapse all components
  const collapseAllComponents = () => {
    setExpandedComponents(new Set());
  };

  const elementIcons = {
    text: Type,
    heading: Type,
    image: ImageIcon,
    link: LinkIcon,
    button: MousePointerClick,
  };

  // Update component HTML
  const handleUpdateComponentHtml = (componentId: string, newHtml: string) => {
    setTemplateComponents(templateComponents.map(c => 
      c.id === componentId ? { ...c, html: newHtml } : c
    ));
    if (selectedComponent?.id === componentId) {
      setSelectedComponent({ ...selectedComponent, html: newHtml });
    }
  };

  // Validate template name
  const validateTemplateName = async (name: string): Promise<string | null> => {
    const trimmedName = name.trim();
    
    // Check if name is empty
    if (!trimmedName) {
      return 'Template name is required';
    }
    
    if (!user?.id) {
      return 'User ID is required';
    }
    
    // Check for duplicate names (excluding current template if editing)
    try {
      // Try Supabase first
      try {
        const { getSavedTemplatesSupabase } = await import('../../services/savedTemplatesSupabase');
        const savedTemplates = await getSavedTemplatesSupabase(user.id);
        const duplicateTemplate = savedTemplates.find((t: TemplateData) => {
          const nameMatches = t.name.trim().toLowerCase() === trimmedName.toLowerCase();
          const isNotCurrentTemplate = !currentTemplateId || t.id !== currentTemplateId;
          return nameMatches && isNotCurrentTemplate;
        });
        
        if (duplicateTemplate) {
          return 'A template with this name already exists. Please choose a different name.';
        }
        return null;
      } catch {
        /* fallback to localStorage below */
      }
      
      // Fallback to localStorage
      const savedTemplates = getSavedTemplates(user.id);
      const duplicateTemplate = savedTemplates.find((t: TemplateData) => {
        const nameMatches = t.name.trim().toLowerCase() === trimmedName.toLowerCase();
        const isNotCurrentTemplate = !currentTemplateId || t.id !== currentTemplateId;
        return nameMatches && isNotCurrentTemplate;
      });
      
      if (duplicateTemplate) {
        return 'A template with this name already exists. Please choose a different name.';
      }
    } catch (error) {
      console.error('Error validating template name:', error);
      // Don't block save on validation error
    }
    
    return null;
  };

  // Save template
  const handleSave = async () => {
    // Clear previous errors
    setNameError(null);
    setStorageError(null);
    
    if (!user?.id) {
      setStorageError('User ID is required. Please log in again.');
      return;
    }

    if (templateComponents.length === 0) {
      setStorageError('Add at least one component from the library (click or drag) before saving.');
      return;
    }

    // Validate template name
    const trimmedName = templateName.trim();
    const validationError = await validateTemplateName(trimmedName);
    
    if (validationError) {
      setNameError(validationError);
      return;
    }
    
    const isAdminUser = user?.is_admin || user?.user_type === 'admin';
    const isNewTemplate = !currentTemplateId;
    if (isNewTemplate && !isAdminUser) {
      // Try Supabase first for storage check
      try {
        const { getStorageInfoSupabase } = await import('../../services/savedTemplatesSupabase');
        const freshStorage = await getStorageInfoSupabase(user.id, tier);

        if (isComposerNewTemplateStorageBlocked(freshStorage, tier, isAdminUser, currentTemplateId)) {
          setStorageError(
            `Storage limit reached. You're using ${freshStorage.storageUsedMB.toFixed(2)} MB / ${freshStorage.storageLimitMB} MB ` +
            `(${freshStorage.templatesCount} templates). Please delete some templates or upgrade your plan.`
          );
          return;
        }
      } catch {
        // Fallback to localStorage check
        const canSave = canSaveTemplate(user.id, tier);
        if (!canSave.canSave) {
          setStorageError(canSave.reason || 'Cannot save template due to storage limits.');
          return;
        }
      }
    }
    
    setIsSaving(true);
    try {
      let templateData: TemplateData;
      const now = new Date().toISOString();
      
      if (currentTemplateId) {
        // Update existing template
        templateData = {
          id: currentTemplateId,
          name: trimmedName,
          components: templateComponents,
          createdAt: '', // Will be preserved from existing
          updatedAt: now,
          themeCssMode,
        };
      } else {
        // Create new template with text-based ID
        // Generate ID that works with TEXT/VARCHAR column type
        const generateId = () => {
          // Use crypto.randomUUID() if available (modern browsers), otherwise fallback
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          // Fallback: timestamp + random string
          return `template_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        };
        templateData = {
          id: generateId(),
          name: trimmedName,
          components: templateComponents,
          createdAt: now,
          updatedAt: now,
          themeCssMode,
        };
        setCurrentTemplateId(templateData.id);
      }
      
      // Try Supabase first
      try {
        const { 
          saveTemplateSupabase, 
          updateTemplateSupabase,
          getStorageInfoSupabase 
        } = await import('../../services/savedTemplatesSupabase');
        
        // Generate HTML for the template (required by Supabase service)
        const html = removeFooterSocialIcons(generateFinalHtml());
        
        if (currentTemplateId) {
          // Update existing template
          await updateTemplateSupabase(templateData, user.id, html);
        } else {
          // Create new template
          await saveTemplateSupabase(templateData, user.id, html);
        }
        
        // Update storage info from Supabase
        const updatedInfo = await getStorageInfoSupabase(user.id, tier);
        setStorageInfo({
          templatesCount: updatedInfo.templatesCount,
          storageUsed: updatedInfo.storageUsed,
          storageUsedMB: updatedInfo.storageUsedMB,
          storageLimitMB: updatedInfo.storageLimitMB,
          storagePercentage: updatedInfo.storagePercentage,
          templatesRemaining: updatedInfo.templatesRemaining,
          isWarning: updatedInfo.isWarning,
          isCritical: updatedInfo.isCritical,
          isAtLimit: updatedInfo.isAtLimit,
        });
        
      } catch (supabaseError: any) {
        console.error('Failed to save to Supabase:', supabaseError);
        
        // Show error to user
        const errorMessage = supabaseError?.message || supabaseError?.details || 'Unknown error';
        setStorageError(`Failed to save to Supabase: ${errorMessage}. Please check your connection and try again.`);
        setIsSaving(false);
        
        // Don't fallback to localStorage - we want Supabase to work
        // Re-throw to be caught by outer catch block
        throw supabaseError;
      }
      
      // Update URL if this is a new template
      if (!templateId && templateData.id) {
        const isAdmin = window.location.pathname.includes('/gestion');
        navigate(isAdmin ? `/gestion/template-composer/${templateData.id}` : `/user/template-composer/${templateData.id}`, { replace: true });
      }
      
      // Navigate to template library page after successful save
      const isAdmin = window.location.pathname.includes('/gestion');
      navigate(isAdmin ? '/gestion/saved-templates' : '/user/saved-templates');
    } catch (error: any) {
      console.error('Error saving template:', error);
      const errorMessage = error.message || 'Failed to save template. Please try again.';
      setStorageError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Generate final HTML
  // Strip comment markers and clean up component HTML
  const cleanComponentHtml = (html: string): string => {
    if (!html) return '';
    
    // Remove component start/end markers
    let cleaned = html
      .replace(/<!--\s*Component\s+(?:start|Start|end|End)\s+[^>]+-->/gi, '')
      .trim();
    
    // Remove empty <tr> elements that might cause visual lines
    cleaned = cleaned.replace(/<tr[^>]*>\s*<\/tr>/gi, '');
    
    // Remove empty table rows with only whitespace or empty tds
    cleaned = cleaned.replace(/<tr[^>]*>\s*<td[^>]*>\s*<\/td>\s*<\/tr>/gi, '');
    cleaned = cleaned.replace(/<tr[^>]*>\s*<td[^>]*>\s*&nbsp;\s*<\/td>\s*<\/tr>/gi, '');
    
    // Remove any leading/trailing empty divs or spans
    cleaned = cleaned.replace(/^<div[^>]*>\s*<\/div>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>$/gi, '');
    cleaned = cleaned.replace(/^<span[^>]*>\s*<\/span>/gi, '');
    cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>$/gi, '');
    
    // Remove leading/trailing whitespace and newlines
    cleaned = cleaned.replace(/^\s+|\s+$/g, '');
    
    // Remove any standalone <br> tags at the start
    cleaned = cleaned.replace(/^(<br\s*\/?>)+/gi, '');
    
    return cleaned;
  };

  // Disable links and buttons in preview (but keep them visible)
  const disableLinksAndButtons = (html: string): string => {
    if (!html) return '';
    
    let modifiedHtml = html;
    
    // Disable all <a> tags (links and buttons styled as links)
    // Keep them fully visible but make them non-clickable
    modifiedHtml = modifiedHtml.replace(
      /<a\s+([^>]*)>/gi,
      (match, attrs) => {
        // Extract existing style - be more flexible with quote matching
        let existingStyle = '';
        const styleMatchDouble = attrs.match(/style\s*=\s*"([^"]*)"/i);
        const styleMatchSingle = attrs.match(/style\s*=\s*'([^']*)'/i);
        
        if (styleMatchDouble) {
          existingStyle = styleMatchDouble[1];
        } else if (styleMatchSingle) {
          existingStyle = styleMatchSingle[1];
        }
        
        // Preserve ALL existing styles - just remove cursor if it exists and add our own
        let cleanedStyle = existingStyle
          .replace(/cursor\s*:\s*[^;]+;?/gi, '')
          .trim();
        
        // Clean up any double semicolons or trailing/leading semicolons
        cleanedStyle = cleanedStyle.replace(/;\s*;/g, ';').replace(/^;+|;+$/g, '');
        
        // Append cursor style to existing styles (don't remove anything else)
        const cursorStyle = 'cursor: not-allowed';
        const newStyle = cleanedStyle 
          ? `${cleanedStyle}; ${cursorStyle}`.trim()
          : cursorStyle;
        
        // Remove old href, style, title, aria-label, onclick but preserve everything else
        let newAttrs = attrs
          .replace(/href\s*=\s*["'][^"']*["']/gi, '')
          .replace(/style\s*=\s*["'][^"']*["']/gi, '')
          .replace(/title\s*=\s*["'][^"']*["']/gi, '')
          .replace(/aria-label\s*=\s*["'][^"']*["']/gi, '')
          .replace(/onclick\s*=\s*["'][^"']*["']/gi, '')
          .trim();
        
        // Clean up extra spaces but preserve structure
        newAttrs = newAttrs.replace(/\s+/g, ' ').trim();
        
        // Add new attributes - keep button visible but non-clickable
        // Preserve all original styling including background-color, color, padding, etc.
        return `<a ${newAttrs} href="javascript:void(0)" style="${newStyle}" title="Link to be set on Email Builder" aria-label="Link to be set on Email Builder" onclick="return false; event.preventDefault(); event.stopPropagation();">`;
      }
    );
    
    // Disable all <button> tags - keep them visible
    modifiedHtml = modifiedHtml.replace(
      /<button\s+([^>]*)>/gi,
      (match, attrs) => {
        // Extract existing style
        const styleMatch = attrs.match(/style\s*=\s*(["'])((?:(?!\1).)*)\1/i);
        const existingStyle = styleMatch ? styleMatch[2] : '';
        
        // Preserve all existing styles
        let cleanedStyle = existingStyle
          .replace(/opacity\s*:\s*[^;]+;?/gi, '')
          .replace(/cursor\s*:\s*[^;]+;?/gi, '')
          .trim();
        
        // Clean up any double semicolons
        cleanedStyle = cleanedStyle.replace(/;\s*;/g, ';').replace(/^;|;$/g, '');
        
        // Add disabled cursor but keep ALL other styles intact
        const disabledStyles = 'cursor: not-allowed;';
        const newStyle = cleanedStyle 
          ? `${cleanedStyle}; ${disabledStyles}`.trim()
          : disabledStyles;
        
        // Remove old style, title, aria-label, disabled
        let newAttrs = attrs
          .replace(/style\s*=\s*["'][^"']*["']/gi, '')
          .replace(/title\s*=\s*["'][^"']*["']/gi, '')
          .replace(/aria-label\s*=\s*["'][^"']*["']/gi, '')
          .replace(/disabled\s*=\s*["'][^"']*["']/gi, '')
          .trim();
        
        // Clean up extra spaces
        newAttrs = newAttrs.replace(/\s+/g, ' ').trim();
        
        // Add new attributes - keep button visible but disabled
        return `<button ${newAttrs} style="${newStyle}" title="Button to be set on Email Builder" aria-label="Button to be set on Email Builder" disabled="disabled" onclick="return false; event.preventDefault(); event.stopPropagation();">`;
      }
    );
    
    return modifiedHtml;
  };

  // Generate preview HTML with proper email structure (Audit 10: Match Email Builder structure)
  const generatePreviewHtml = useCallback((): string => {
    const sortedComponents = [...templateComponents].sort((a, b) => a.order - b.order);
    
    if (sortedComponents.length === 0) {
      // Empty template - return minimal structure
      return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Template Preview</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px;">
          <tbody>
            <tr>
              <td style="padding: 40px; text-align: center; color: #64748b;">No components added yet</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    
    // Clean and prepare component HTML, applying background colors and visibility
    const componentsHtml = sortedComponents
      .map(c => {
        let html = cleanComponentHtml(c.html);
        
        // If component is hidden, add display: none to <td> with specific padding and background-color: #ffffff;
        if (c.visible === false) {
          // Find <td> elements with padding: 40px 30px; background-color: #ffffff; (for Text Block)
          html = html.replace(
            /(<td[^>]*style=")([^"]*padding:\s*40px\s+30px[^"]*background-color:\s*#ffffff[^"]*)(")/gi,
            (match, start, styleContent, end) => {
              // Check if display: none is already present
              if (!styleContent.includes('display: none') && !styleContent.includes('display:none')) {
                const separator = styleContent.trim().endsWith(';') ? ' ' : '; ';
                return start + styleContent + separator + 'display: none !important' + end;
              }
              return match;
            }
          );
          
          // Find <td> elements with padding: 30px 20px; background-color: #ffffff; (for Dual CTA)
          html = html.replace(
            /(<td[^>]*style=")([^"]*padding:\s*30px\s+20px[^"]*background-color:\s*#ffffff[^"]*)(")/gi,
            (match, start, styleContent, end) => {
              // Check if display: none is already present
              if (!styleContent.includes('display: none') && !styleContent.includes('display:none')) {
                const separator = styleContent.trim().endsWith(';') ? ' ' : '; ';
                return start + styleContent + separator + 'display: none !important' + end;
              }
              return match;
            }
          );
          
          // Find <td> elements with padding: 40px 20px 30px 20px; background-color: #ffffff; border-radius: 0 0 12px 12px; (for Footer)
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
          
          // Also hide the entire <tr> if it contains the hidden <td> (for both padding styles)
          html = html.replace(
            /(<tr[^>]*>[\s\S]*?<td[^>]*style="[^"]*padding:\s*(40px\s+30px|30px\s+20px|40px\s+20px\s+30px\s+20px)[^"]*background-color:\s*#ffffff[^"]*"[\s\S]*?<\/tr>)/gi,
            (match) => {
              if (!match.includes('display: none') && !match.includes('display:none')) {
                return match.replace(/(<tr[^>]*style=")([^"]*)(")/i, (trMatch, trStart, trStyle, trEnd) => {
                  const separator = trStyle.trim().endsWith(';') ? ' ' : '; ';
                  return trStart + trStyle + separator + 'display: none !important' + trEnd;
                });
              }
              return match;
            }
          );
        }
        
        // Apply width: 100% to order-details-total-wrapper element
        html = html.replace(
          /(<td[^>]*data-element="order-details-total-wrapper"[^>]*style=")([^"]*)(")/gi,
          (match, start, styleContent, end) => {
            // Check if width: 100% is already present
            if (!styleContent.includes('width: 100%') && !styleContent.includes('width:100%')) {
              const separator = styleContent.trim() && !styleContent.trim().endsWith(';') ? '; ' : ' ';
              return start + styleContent + separator + 'width: 100%' + end;
            }
            return match;
          }
        );
        
        // Apply background color if set
        if (c.backgroundColor) {
          // Find the first <tr> in the component and apply background color to its first <td>
          const trMatch = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
          if (trMatch) {
            const trContent = trMatch[0];
            const updatedTr = trContent.replace(/(<td[^>]*style=")([^"]*)(")/i, (tdMatch, start, styleContent, end) => {
              // Remove any existing background-color
              const cleanedStyle = styleContent.replace(/background-color\s*:\s*[^;]+;?/gi, '').trim();
              // Add the new background color
              const separator = cleanedStyle && !cleanedStyle.endsWith(';') ? '; ' : ' ';
              const newStyle = cleanedStyle 
                ? `${cleanedStyle}${separator}background-color: ${c.backgroundColor};`
                : `background-color: ${c.backgroundColor};`;
              return start + newStyle + end;
            });
            html = html.replace(trContent, updatedTr);
          }
        }
        return html;
      })
      .map(html => disableLinksAndButtons(html))
      .join('\n')
      .replace(/background-color:\s*#f8fafc/gi, 'background-color: #ffffff');
    
    // Check if components are already wrapped in a table structure
    // Components should be <tr> elements that need to be in a <tbody>
    const trimmedHtml = componentsHtml.trim();
    const isAlreadyWrapped = trimmedHtml.toLowerCase().startsWith('<!doctype') || 
                            (trimmedHtml.toLowerCase().includes('<html') && trimmedHtml.toLowerCase().includes('</html>'));
    
    let finalComponentsHtml = componentsHtml;
    
    // If components are <tr> elements (which they should be), ensure they're in a tbody
    if (!isAlreadyWrapped && trimmedHtml.toLowerCase().startsWith('<tr')) {
      // Components are already <tr> elements, just wrap in tbody if not already wrapped
      if (!trimmedHtml.toLowerCase().includes('<tbody')) {
        finalComponentsHtml = `<tbody>${componentsHtml}</tbody>`;
      }
    }
    
    // Audit 6: Apply border-radius to first and last components for preview (simplified)
    if (sortedComponents.length > 0) {
      const trMatches = finalComponentsHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      if (trMatches && trMatches.length > 0) {
        // First component - add top border-radius
        const firstTr = trMatches[0];
        const updatedFirstTr = firstTr.replace(
          /(<td[^>]*style=")([^"]*)(")/i,
          (match, start, style, end) => {
            if (!style.includes('border-radius')) {
              const separator = style.trim() && !style.trim().endsWith(';') ? '; ' : ' ';
              const borderRadius = sortedComponents.length === 1 ? 'border-radius: 12px' : 'border-radius: 12px 12px 0 0';
              return start + style + separator + borderRadius + end;
            }
            return match;
          }
        );
        finalComponentsHtml = finalComponentsHtml.replace(firstTr, updatedFirstTr);
        
        // Last component - add bottom border-radius (if more than one component)
        if (trMatches.length > 1) {
          const lastTr = trMatches[trMatches.length - 1];
          const updatedLastTr = lastTr.replace(
            /(<td[^>]*style=")([^"]*)(")/i,
            (match, start, style, end) => {
              if (!style.includes('border-radius')) {
                const separator = style.trim() && !style.trim().endsWith(';') ? '; ' : ' ';
                return start + style + separator + 'border-radius: 0 0 12px 12px' + end;
              }
              return match;
            }
          );
          finalComponentsHtml = finalComponentsHtml.replace(lastTr, updatedLastTr);
        }
      }
    }

    // Replace ©YYYY placeholder with current year in footer copyright
    finalComponentsHtml = finalComponentsHtml.replace(/©YYYY/g, '©' + new Date().getFullYear());
    
    // Audit 1-2, 4-5, 8: Complete HTML structure matching Email Builder
    return removeFooterSocialIcons(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>Template Preview</title>
${buildComposerThemeHeadBlock(themeCssMode)}
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #ffffff;">
  <!--[if mso | IE]>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
    <tr>
      <td>
  <![endif]-->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0; width: 100%; background-color: #ffffff; mso-table-lspace: 0pt; mso-table-rspace: 0pt;" role="presentation">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <!--[if mso | IE]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px;">
          <tr>
            <td>
        <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); mso-table-lspace: 0pt; mso-table-rspace: 0pt;" role="presentation">
          ${finalComponentsHtml}
        </table>
        <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
  <!--[if mso | IE]>
      </td>
    </tr>
  </table>
  <![endif]-->
</body>
</html>`);
  }, [templateComponents, themeCssMode]);

  const generateFinalHtml = useCallback(() => {
    // Audit 1-3: Clean and prepare component HTML with proper structure
    const sortedComponents = [...templateComponents].sort((a, b) => a.order - b.order);
    
    if (sortedComponents.length === 0) {
      // Empty template - return minimal structure
      return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${templateName || 'Email Template'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px;">
          <tbody>
            <tr>
              <td style="padding: 40px; text-align: center; color: #64748b;">No components added yet</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    
    // Clean and prepare component HTML, applying background colors
    const cleanedComponents = sortedComponents.map(c => {
      let html = cleanComponentHtml(c.html);
      // Apply background color if set
      if (c.backgroundColor) {
        // Find the first <tr> in the component and apply background color to its first <td>
        const trMatch = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
        if (trMatch) {
          const trContent = trMatch[0];
          const updatedTr = trContent.replace(/(<td[^>]*style=")([^"]*)(")/i, (tdMatch, start, styleContent, end) => {
            // Remove any existing background-color
            const cleanedStyle = styleContent.replace(/background-color\s*:\s*[^;]+;?/gi, '').trim();
            // Add the new background color
            const separator = cleanedStyle && !cleanedStyle.endsWith(';') ? '; ' : ' ';
            const newStyle = cleanedStyle 
              ? `${cleanedStyle}${separator}background-color: ${c.backgroundColor};`
              : `background-color: ${c.backgroundColor};`;
            return start + newStyle + end;
          });
          html = html.replace(trContent, updatedTr);
        }
      }
      return html;
    });
    let componentsHtml = cleanedComponents
      .join('\n')
      .replace(/background-color:\s*#f8fafc/gi, 'background-color: #ffffff');
    const trimmedHtml = componentsHtml.trim();
    const isAlreadyWrapped = trimmedHtml.toLowerCase().startsWith('<!doctype') || 
                            (trimmedHtml.toLowerCase().includes('<html') && trimmedHtml.toLowerCase().includes('</html>'));
    
    let finalComponentsHtml = componentsHtml;
    
    // If components are <tr> elements (which they should be), ensure they're in a tbody
    if (!isAlreadyWrapped && trimmedHtml.toLowerCase().startsWith('<tr')) {
      // Components are already <tr> elements, just wrap in tbody if not already wrapped
      if (!trimmedHtml.toLowerCase().includes('<tbody')) {
        finalComponentsHtml = `<tbody>${componentsHtml}</tbody>`;
      }
    }
    
    // Audit 6: Apply border-radius to first and last components (simplified approach)
    if (sortedComponents.length > 0) {
      // Process the HTML to add border-radius to first and last <tr><td> elements
      const trMatches = finalComponentsHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      if (trMatches && trMatches.length > 0) {
        // First component - add top border-radius
        const firstTr = trMatches[0];
        const updatedFirstTr = firstTr.replace(
          /(<td[^>]*style=")([^"]*)(")/i,
          (match, start, style, end) => {
            if (!style.includes('border-radius')) {
              const separator = style.trim() && !style.trim().endsWith(';') ? '; ' : ' ';
              const borderRadius = sortedComponents.length === 1 ? 'border-radius: 12px' : 'border-radius: 12px 12px 0 0';
              return start + style + separator + borderRadius + end;
            }
            return match;
          }
        );
        finalComponentsHtml = finalComponentsHtml.replace(firstTr, updatedFirstTr);
        
        // Last component - add bottom border-radius (if more than one component)
        if (trMatches.length > 1) {
          const lastTr = trMatches[trMatches.length - 1];
          const updatedLastTr = lastTr.replace(
            /(<td[^>]*style=")([^"]*)(")/i,
            (match, start, style, end) => {
              if (!style.includes('border-radius')) {
                const separator = style.trim() && !style.trim().endsWith(';') ? '; ' : ' ';
                return start + style + separator + 'border-radius: 0 0 12px 12px' + end;
              }
              return match;
            }
          );
          finalComponentsHtml = finalComponentsHtml.replace(lastTr, updatedLastTr);
        }
      }
    }
    
    // Audit 1-2: Complete HTML structure with all required meta tags
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>${templateName || 'Email Template'}</title>
${buildComposerThemeHeadBlock(themeCssMode)}
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #ffffff;">
  <!--[if mso | IE]>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
    <tr>
      <td>
  <![endif]-->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0; width: 100%; background-color: #ffffff; mso-table-lspace: 0pt; mso-table-rspace: 0pt;" role="presentation">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <!--[if mso | IE]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px;">
          <tr>
            <td>
        <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); mso-table-lspace: 0pt; mso-table-rspace: 0pt;" role="presentation">
          ${finalComponentsHtml}
        </table>
        <!--[if mso | IE]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
  <!--[if mso | IE]>
      </td>
    </tr>
  </table>
  <![endif]-->
</body>
</html>`;
  }, [templateComponents, templateName, themeCssMode]);

  return (
    <div className="fixed inset-0 flex bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <style>{`
        .email-preview table {
          width: 100% !important;
          max-width: 100% !important;
        }
        .email-preview img {
          max-width: 100% !important;
          height: auto !important;
        }
        .email-preview * {
          max-width: 100% !important;
        }
      `}</style>
      {/* Left Panel - Component Library */}
      <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Components</h2>
            <button
              onClick={loadComponents}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh components"
            >
              <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mb-3">
            {availableComponents.length} component{availableComponents.length !== 1 ? 's' : ''} from Master Template
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="category-filter" className="sr-only">Filter by category</label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                // Reset search when changing category to show all items in that category
                if (e.target.value !== 'all' && searchQuery) {
                  // Keep search query but ensure it works with the new category
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 cursor-pointer hover:border-gray-400 transition-colors"
              aria-label="Filter components by category"
            >
              <option value="all">All Categories ({availableComponents.length})</option>
              {categories.length > 0 ? (
                categories.map((category) => {
                  const count = availableComponents.filter(c => (c.category?.trim() || 'other') === category).length;
                  return (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
                    </option>
                  );
                })
              ) : (
                <option value="other" disabled>No categories available</option>
              )}
            </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredComponents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-500">
              <Layout className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {availableComponents.length === 0 
                  ? 'No components available' 
                  : `No components match "${searchQuery}"`}
              </p>
              <p className="text-xs mt-1">
                {availableComponents.length === 0 
                  ? 'Loading components from templates...' 
                  : 'Try a different search or category'}
              </p>
              {availableComponents.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                  }}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredComponents.map((component) => (
                <div
                  key={component.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, component)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleAddComponent(component)}
                  data-component-id={component.id}
                  data-component-type="library"
                  className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg cursor-move hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{component.name}</h3>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                        {component.elements?.length || 0} element{component.elements?.length !== 1 ? 's' : ''} • {component.category || 'uncategorized'}
                      </div>
                    </div>
                    <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 ml-2" />
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                    <Plus className="w-3 h-3" />
                    <span>Click or drag to add</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Template Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Template Limit Reached Banner */}
        {storageInfo &&
          saveStorageBlocked &&
          !(user?.is_admin || user?.user_type === 'admin') && (
          <div className="px-4 md:px-6 py-3 bg-red-50 border-b border-red-200 dark:bg-red-950/40 dark:border-red-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-red-700 dark:text-red-300">🚫</span>
                <span className="text-red-800 dark:text-red-200 font-medium">
                  Template limit reached! You have {storageInfo.templatesCount}/{storageInfo.templatesCount + storageInfo.templatesRemaining} templates saved.
                </span>
                <span className="text-red-700 dark:text-red-300/90">
                  Please delete some templates to create new ones.
                </span>
              </div>
              <button
                onClick={() => {
                  const isAdmin = window.location.pathname.includes('/gestion');
                  navigate(isAdmin ? '/gestion/saved-templates' : '/user/saved-templates');
                }}
                className="text-xs px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70 transition-colors"
              >
                Manage Templates
              </button>
            </div>
          </div>
        )}
        {/* Storage Warning Banner */}
        {storageInfo &&
          (storageInfo.isWarning || storageInfo.isCritical) &&
          !saveStorageBlocked &&
          (() => {
          const tierLimits = getTierStorageLimits(tier);
          const isPro = tier === 'pro';
          return (
            <div className={`px-4 md:px-6 py-2 ${
              storageInfo.isCritical 
                ? 'bg-red-50 border-b border-red-200 dark:bg-red-950/40 dark:border-red-900/50' 
                : 'bg-yellow-50 border-b border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className={storageInfo.isCritical ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}>
                    {storageInfo.isCritical ? '⚠️' : '⚡'}
                  </span>
                  {!isPro && (
                    <span className={storageInfo.isCritical ? 'text-red-800 dark:text-red-200 font-medium' : 'text-yellow-800 dark:text-yellow-200'}>
                      {storageInfo.isCritical 
                        ? `Storage almost full! You're using ${storageInfo.storageUsedMB.toFixed(2)} MB of ${storageInfo.storageLimitMB} MB (${storageInfo.storagePercentage.toFixed(1)}%).`
                        : `Storage getting full: ${storageInfo.storageUsedMB.toFixed(2)} MB / ${storageInfo.storageLimitMB} MB (${storageInfo.storagePercentage.toFixed(1)}%).`
                      }
                    </span>
                  )}
                  {storageInfo.templatesRemaining <= 5 && (
                    <span className={storageInfo.isCritical ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}>
                      Only {storageInfo.templatesRemaining} template{storageInfo.templatesRemaining !== 1 ? 's' : ''} remaining.
                    </span>
                  )}
                  {tier !== 'pro' && (
                    <span className="text-xs text-gray-600 dark:text-gray-400 italic">
                      (Upgrade to Pro for more storage)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    const isAdmin = window.location.pathname.includes('/gestion');
                    navigate(isAdmin ? '/gestion/saved-templates' : '/user/saved-templates');
                  }}
                  className={`text-xs px-3 py-1 rounded ${
                    storageInfo.isCritical 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70' 
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/45 dark:text-yellow-200 dark:hover:bg-yellow-900/65'
                  } transition-colors`}
                >
                  Manage Templates
                </button>
              </div>
            </div>
          );
        })()}
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Close Template Composer"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => {
                    setTemplateName(e.target.value);
                    if (nameError) setNameError(null);
                    if (storageError) setStorageError(null);
                  }}
                  onBlur={async () => {
                    if (!templateName.trim()) {
                      setNameError(null);
                      return;
                    }
                    const error = await validateTemplateName(templateName);
                    setNameError(error);
                  }}
                  required
                  className={`text-base md:text-xl font-semibold text-gray-900 dark:text-gray-100 border-none focus:outline-none focus:ring-2 rounded px-2 py-1 bg-transparent ${
                    nameError 
                      ? 'focus:ring-red-500 border-b-2 border-red-500' 
                      : 'focus:ring-blue-500'
                  }`}
                  placeholder="Template name (required)"
                />
                {storageError && (
                  <p className="text-xs text-red-600 mt-1 px-2">{storageError}</p>
                )}
                {nameError && (
                  <p className="text-xs text-red-600 px-2">{nameError}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Storage Info */}
              {storageInfo && (() => {
                const tierLimits = getTierStorageLimits(tier);
                const isPro = tier === 'pro';
                return (
                  <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                    storageInfo.isCritical 
                      ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/55' 
                      : storageInfo.isWarning 
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-800/55'
                        : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">
                        {storageInfo.templatesCount}/{tierLimits.maxTemplates} templates
                      </span>
                      {!isPro && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span>
                            {storageInfo.storageUsedMB.toFixed(2)}/{storageInfo.storageLimitMB} MB
                          </span>
                        </>
                      )}
                      <span className="text-gray-400">•</span>
                      <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-500">
                        {tier}
                      </span>
                    </div>
                    {(storageInfo.isWarning || storageInfo.isCritical) && (
                      <span className="ml-1 font-semibold">
                        {storageInfo.isCritical ? '⚠️' : '⚡'}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="hidden lg:flex items-center gap-1.5">
                <label htmlFor="composer-theme-css-mode" className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  Theme CSS
                </label>
                <select
                  id="composer-theme-css-mode"
                  value={themeCssMode}
                  onChange={(e) => setThemeCssMode(e.target.value as ThemeCssMode)}
                  className="border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 max-w-[200px]"
                  title="Embedded in preview and export: adaptive adds light + dark rules; light-only adds light rules only."
                >
                  <option value="adaptive">Light + dark (adaptive)</option>
                  <option value="light-only">Light only</option>
                </select>
              </div>
              <div
                className={`hidden lg:flex items-center border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden ${
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
                  disabled={themeCssMode === 'light-only'}
                  title="Preview light"
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
                  disabled={themeCssMode === 'light-only'}
                  title="Preview dark"
                >
                  Dark
                </button>
              </div>
              <button
                onClick={() => {
                  const html = removeFooterSocialIcons(generateFinalHtml());
                  const blob = new Blob([html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${templateName.replace(/\s+/g, '_')}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                <Code className="w-4 h-4" />
                <span className="hidden md:inline">Export HTML</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || saveGateBlocked || saveStorageBlocked}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                title={saveButtonHint}
              >
                <Save className="w-4 h-4" />
                <span className="hidden md:inline">
                  {isSaving
                    ? 'Saving...'
                    : saveGateBlocked
                      ? user?.subscription_status === 'expired'
                        ? 'Renew to Save'
                        : 'Pro required to Save'
                    : saveStorageBlocked
                      ? `Limit (${storageInfo?.templatesCount ?? 0}/${tierLimitsSave.maxTemplates})`
                    : 'Save Template'}
                </span>
                <span className="md:hidden">
                  {isSaving
                    ? '...'
                    : saveGateBlocked
                      ? user?.subscription_status === 'expired'
                        ? 'Renew'
                        : 'Pro'
                    : saveStorageBlocked
                      ? 'Limit'
                    : 'Save'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragEnter(e);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDragOver(e);
          }}
          onDragLeave={(e) => {
            // Only clear if actually leaving the canvas area
            const currentTarget = e.currentTarget as HTMLElement;
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!currentTarget.contains(relatedTarget)) {
              setDragOverIndex(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Drop at the end if no specific index
            handleDrop(e, templateComponents.length);
          }}
          data-drop-zone="canvas"
          className={`flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-gray-950 transition-colors relative ${
            isDragging ? 'bg-blue-50 ring-2 ring-blue-200' : ''
          }`}
        >
          {templateComponents.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center max-w-md px-4">
                <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <Layout className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Start Building Your Template</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Drag components from the left panel or click the buttons below to add your first component</p>
                {filteredComponents.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {filteredComponents.slice(0, 3).map((component) => (
                      <button
                        key={component.id}
                        onClick={() => handleAddComponent(component)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                      >
                        Add {component.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      No components available. Create components in the Component Builder first.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto relative">
              {/* Single Wrapped Preview Section - Component cards removed to avoid visual lines */}
              <div className="relative border-2 border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-950">
                <iframe
                  ref={previewIframeRef}
                  srcDoc={generatePreviewHtml()}
                  className="w-full border-0"
                  style={{ 
                    minHeight: '400px',
                    width: '100%',
                    display: 'block',
                    border: 'none',
                    background: '#ffffff'
                  }}
                  title="Template Preview"
                  scrolling="no"
                  onLoad={(e) => {
                    const iframe = e.currentTarget;
                    try {
                      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                      if (iframeDoc?.body) {
                        iframeDoc.body.setAttribute('data-preview-theme', effectivePreviewTheme);
                      }
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
                    } catch {
                      /* iframe resize is best-effort */
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Elements</h2>
            {templateComponents.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAllComponents}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 transition-colors"
                  title="Expand all"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={collapseAllComponents}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100 transition-colors"
                  title="Collapse all"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Grouped by component ({templateComponents.length})</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {templateComponents.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-500 px-4">
              <Layout className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No components added</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Add components to the canvas to see their elements</p>
            </div>
          ) : (
            <div>
              {templateComponents
                .sort((a, b) => a.order - b.order)
                .map((component, index) => {
                  const sourceComponent = availableComponents.find(c => c.id === component.componentId);
                  const componentElements = sourceComponent?.elements || [];
                  const isExpanded = expandedComponents.has(component.id);
                  const isSelected = selectedComponent?.id === component.id;
                  const isDragging = draggedTemplateComponent?.id === component.id;
                  const isDragOver = dragOverIndex === index;

                  return (
                    <div key={component.id}>
                      {/* Drop zone above component - larger and more reliable */}
                      <div
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragOverTimeoutRef.current) {
                            clearTimeout(dragOverTimeoutRef.current);
                            dragOverTimeoutRef.current = null;
                          }
                          // Immediately set drag over index for better responsiveness
                          setDragOverIndex(index);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Keep updating drag over index for smooth tracking
                          setDragOverIndex(index);
                          handleDragOver(e, index);
                        }}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragOverTimeoutRef.current) {
                            clearTimeout(dragOverTimeoutRef.current);
                            dragOverTimeoutRef.current = null;
                          }
                          handleDrop(e, index);
                        }}
                        data-drop-index={index}
                        className={`min-h-[12px] py-2 -my-1 transition-all duration-200 z-10 flex items-center justify-center ${
                          isDragOver && dragOverIndex === index 
                            ? 'bg-blue-500 shadow-lg border-t-2 border-blue-600 scale-y-110 min-h-[40px] ring-2 ring-blue-300' 
                            : isDragging 
                              ? 'bg-blue-50 hover:bg-blue-100 border-t-2 border-dashed border-blue-300 min-h-[32px]' 
                              : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {isDragging && (
                          <span className={`text-xs font-medium transition-all ${
                            isDragOver && dragOverIndex === index
                              ? 'text-white opacity-100 font-semibold'
                              : 'text-blue-600 opacity-80'
                          }`}>
                            {isDragOver && dragOverIndex === index ? 'Drop here' : 'Drop zone'}
                          </span>
                        )}
                      </div>
                      <div 
                        className={`border-b border-gray-200 dark:border-gray-800 transition-all duration-200 ${
                          isDragging && draggedTemplateComponent?.id === component.id 
                            ? 'opacity-30 scale-95' 
                            : isSelected 
                              ? 'ring-1 ring-blue-200' 
                              : ''
                        }`}
                        draggable={true}
                        onDragStart={(e) => handleTemplateDragStart(e, component)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          // Prevent dropping on the component itself, only on drop zones
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        data-component-id={component.id}
                        data-component-index={index}
                      >
                        <div className={`flex items-center justify-between px-4 py-3 transition-colors cursor-move ${
                          isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}>
                          <div className="flex items-center gap-2 flex-1">
                            <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            {/* Up/Down arrow buttons for reordering */}
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveComponentUp(component.id);
                                }}
                                disabled={index === 0}
                                className="p-0.5 hover:bg-blue-100 text-gray-500 dark:text-gray-500 hover:text-blue-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up (↑)"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveComponentDown(component.id);
                                }}
                                disabled={index === templateComponents.length - 1}
                                className="p-0.5 hover:bg-blue-100 text-gray-500 dark:text-gray-500 hover:text-blue-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down (↓)"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectComponent(component);
                                toggleComponentExpand(component.id);
                              }}
                              className="flex items-center gap-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 flex-1"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                              )}
                              <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                              <span className="truncate">{sourceComponent?.name || 'Unknown Component'}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                                ({componentElements.length})
                              </span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveComponent(component.id);
                            }}
                            className="p-1.5 hover:bg-red-100 text-gray-500 dark:text-gray-500 hover:text-red-600 rounded transition-colors flex-shrink-0 ml-2"
                            title="Remove component from template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      {isExpanded && componentElements.length > 0 && (
                        <div className="divide-y divide-gray-200">
                          {componentElements.map((element) => {
                            const Icon = elementIcons[element.type] || Mail;
                            const isElementSelected = selectedElement?.id === element.id;
                            const isHidden = element.visible === false;

                            return (
                              <button
                                key={element.id}
                                type="button"
                                onClick={() => {
                                  setSelectedElement(element);
                                  setSelectedComponent(null);
                                  handleSelectComponent(component);
                                }}
                                className={`
                                  w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-all pl-8
                                  ${isElementSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''}
                                  ${isHidden ? 'opacity-50' : ''}
                                `}
                              >
                                <div className="flex items-start gap-3">
                                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                    isElementSelected ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{element.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                      {element.type}
                                      {isHidden && (
                                        <span className="ml-2 uppercase tracking-wide text-[10px] text-gray-500 dark:text-gray-500">
                                          Hidden
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                {element.value && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-2 pl-7">
                                    {String(element.value).substring(0, 50)}
                                    {String(element.value).length > 50 ? '...' : ''}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      </div>
                      {/* Drop zone below last component - larger and more reliable */}
                      {index === templateComponents.length - 1 && (
                        <div
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOverTimeoutRef.current) {
                              clearTimeout(dragOverTimeoutRef.current);
                              dragOverTimeoutRef.current = null;
                            }
                            // Immediately set drag over index for better responsiveness
                            setDragOverIndex(templateComponents.length);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Keep updating drag over index for smooth tracking
                            setDragOverIndex(templateComponents.length);
                            handleDragOver(e, templateComponents.length);
                          }}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOverTimeoutRef.current) {
                              clearTimeout(dragOverTimeoutRef.current);
                              dragOverTimeoutRef.current = null;
                            }
                            handleDrop(e, templateComponents.length);
                          }}
                          data-drop-index={templateComponents.length}
                          className={`min-h-[12px] py-2 -my-1 transition-all duration-150 z-10 flex items-center justify-center ${
                            dragOverIndex === templateComponents.length 
                              ? 'bg-blue-500 shadow-lg border-b-2 border-blue-600 scale-y-110 min-h-[40px]' 
                              : isDragging 
                                ? 'bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 border-b border-dashed border-gray-300 dark:border-gray-700 min-h-[32px]' 
                                : 'bg-transparent'
                          }`}
                        >
                          {isDragging && (
                            <span className={`text-xs font-medium transition-all ${
                              dragOverIndex === templateComponents.length
                                ? 'text-white opacity-100 font-semibold'
                                : 'text-gray-600 dark:text-gray-400 opacity-70'
                            }`}>
                              Drag to center
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Component Properties Panel */}
        {selectedComponent && !selectedElement && (
          <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 max-h-[300px] overflow-y-auto">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {availableComponents.find(c => c.id === selectedComponent.componentId)?.name || 'Component'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500">Component Properties</p>
            </div>
            <div className="space-y-3 text-sm">
              <ComponentColorPicker
                label="Background Color"
                value={selectedComponent.backgroundColor}
                onChange={(value) => {
                  setTemplateComponents(prev => 
                    prev.map(c => 
                      c.id === selectedComponent.id 
                        ? { ...c, backgroundColor: value } 
                        : c
                    )
                  );
                  setSelectedComponent({ ...selectedComponent, backgroundColor: value });
                }}
              />
            </div>
          </div>
        )}

        {/* Element Properties Panel */}
        {selectedElement && (
          <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 max-h-[300px] overflow-y-auto">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{selectedElement.label}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-500">{selectedElement.type}</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                <input
                  type="text"
                  value={selectedElement.value || ''}
                  onChange={(e) => {
                    // Update element value in the source component
                    const sourceComponent = availableComponents.find(c => 
                      c.id === selectedComponent?.componentId
                    );
                    if (sourceComponent && selectedComponent) {
                      const updatedElements = sourceComponent.elements.map(el =>
                        el.id === selectedElement.id ? { ...el, value: e.target.value } : el
                      );
                      // Update the component in availableComponents
                      const updatedSourceComponent = { ...sourceComponent, elements: updatedElements };
                      const updatedAvailable = availableComponents.map(c =>
                        c.id === sourceComponent.id ? updatedSourceComponent : c
                      );
                      setAvailableComponents(updatedAvailable);
                      // Update the template component HTML if needed
                      // This is a simplified update - in a full implementation, you'd rebuild HTML from elements
                    }
                    setSelectedElement({ ...selectedElement, value: e.target.value });
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(selectedElement.type === 'text' ||
                selectedElement.type === 'heading' ||
                selectedElement.type === 'link' ||
                (selectedElement.type === 'button' && selectedElement.id === 'button_gift_cta')) &&
                selectedComponent && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{getAlignmentControlLabel(selectedElement)}</label>
                    <div className="flex gap-1">
                      {(
                        [
                          { value: 'left' as const, Icon: AlignLeft },
                          { value: 'center' as const, Icon: AlignCenter },
                          { value: 'right' as const, Icon: AlignRight },
                        ] as const
                      ).map(({ value: align, Icon }) => {
                        const active =
                          ((selectedElement.properties?.textAlign as string) || 'left') === align;
                        return (
                          <button
                            key={align}
                            type="button"
                            onClick={() => {
                              const nextProps = {
                                ...(selectedElement.properties || {}),
                                textAlign: align,
                              };
                              const updatedEl = { ...selectedElement, properties: nextProps };
                              setSelectedElement(updatedEl);
                              setTemplateComponents((prev) =>
                                prev.map((c) =>
                                  c.id === selectedComponent.id
                                    ? {
                                        ...c,
                                        html: applyTextAlignToComponentHtml(c.html, selectedElement, align),
                                      }
                                    : c
                                )
                              );
                              const sourceComponent = availableComponents.find(
                                (x) => x.id === selectedComponent.componentId
                              );
                              if (sourceComponent) {
                                const updatedElements = sourceComponent.elements.map((el) =>
                                  el.id === selectedElement.id
                                    ? { ...el, properties: { ...el.properties, ...nextProps } }
                                    : el
                                );
                                setAvailableComponents(
                                  availableComponents.map((c) =>
                                    c.id === sourceComponent.id
                                      ? { ...sourceComponent, elements: updatedElements }
                                      : c
                                  )
                                );
                              }
                            }}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded border text-[11px] capitalize ${
                              active
                                ? 'border-blue-600 bg-blue-50 text-blue-800'
                                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            {align}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              {selectedElement.properties && Object.keys(selectedElement.properties).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Properties</label>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-2 text-xs">
                    <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                      {JSON.stringify(selectedElement.properties, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

