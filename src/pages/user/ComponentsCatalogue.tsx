import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Package, ArrowLeft, ImageIcon, Type, Link as LinkIcon, MousePointerClick, Layout, X } from 'lucide-react';
import { componentLibraryService, ComponentData } from '../../services/componentLibraryService';
import { extractSectionsFromTemplate } from '../../utils/extractTemplateSections';
import { TemplateElement } from '../../services/templateService';

export const ComponentsCatalogue: React.FC = () => {
  const navigate = useNavigate();
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [filteredComponents, setFilteredComponents] = useState<ComponentData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<ComponentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load available components from Master Template and Supabase Component Library
  const loadComponents = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Extract sections from master_template
      const allComponents = await extractSectionsFromTemplate('master_template');
      
      // Also load from Supabase Component Library
      let supabaseComponents: ComponentData[] = [];
      try {
        const { getAllComponentsSupabase } = await import('../../services/componentLibrarySupabase');
        supabaseComponents = await getAllComponentsSupabase();
        supabaseComponents = supabaseComponents.filter(c => c.status === 'live');
      } catch {
        /* Supabase optional */
      }
      
      // Convert SectionComponent to ComponentData format
      const masterTemplateData: ComponentData[] = allComponents.map((component: any) => ({
        id: component.id,
        name: component.name,
        html: component.html,
        category: component.category,
        elements: component.elements.map((el: TemplateElement) => ({
          id: el.id,
          type: el.type,
          selector: el.selector,
          label: el.label,
          defaultValue: el.defaultValue,
          value: el.value,
          visible: el.visible,
          properties: el.properties,
        })),
        status: 'live' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      // Combine master template components with Supabase components
      // Prioritize Supabase components over master template (Supabase is more up-to-date)
      const allComponentsCombined: ComponentData[] = [...supabaseComponents, ...masterTemplateData];
      
      // Deduplicate components: keep only unique components based on name + HTML structure
      const createComponentHash = (html: string): string => {
        if (!html || html.trim() === '') return '';
        // More aggressive normalization to catch variations
        const normalized = html
          .replace(/\s+/g, ' ') // Normalize all whitespace to single space
          .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
          .replace(/\s*=\s*/g, '=') // Normalize attribute spacing
          .replace(/\s*>\s*/g, '>') // Normalize tag closing
          .replace(/\s*<\s*/g, '<') // Normalize tag opening
          .replace(/\s+/g, ' ') // Normalize again after replacements
          .trim()
          .toLowerCase(); // Case-insensitive comparison
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
          const char = normalized.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
      };
      
      // Normalize component name for comparison (lowercase, trim, remove special chars)
      const normalizeName = (name: string): string => {
        return name.toLowerCase().trim().replace(/[^\w\s]/g, '');
      };
      
      // Track components by normalized name (to catch same-name duplicates)
      const seenByNormalizedName = new Map<string, ComponentData>();
      // Track by signature (name + HTML hash) for exact duplicates
      const seenSignatures = new Set<string>();
      const uniqueComponents: ComponentData[] = [];
      
      allComponentsCombined.forEach(component => {
        if (!component.html || component.html.trim() === '') {
          return;
        }
        
        const normalizedName = normalizeName(component.name);
        const htmlHash = createComponentHash(component.html);
        const signature = `${normalizedName}_${htmlHash}`;
        
        // Check if we've already seen this exact component (same name + same HTML)
        if (seenSignatures.has(signature)) {
          return;
        }
        
        // Check if we have a component with the same normalized name
        const existingByName = seenByNormalizedName.get(normalizedName);
        if (existingByName) {
          // Compare HTML hashes - if they're the same, it's a duplicate
          const existingHash = createComponentHash(existingByName.html);
          if (existingHash === htmlHash) {
            return;
          }
          // If name matches but HTML is different, prefer Supabase version
          const isSupabaseComponent = component.id && (component.id.includes('supabase') || supabaseComponents.some(sc => sc.id === component.id));
          const existingIsSupabase = existingByName.id && (existingByName.id.includes('supabase') || supabaseComponents.some(sc => sc.id === existingByName.id));
          
          if (isSupabaseComponent && !existingIsSupabase) {
            // Replace with Supabase version
            const index = uniqueComponents.findIndex(c => c.id === existingByName.id);
            if (index !== -1) {
              uniqueComponents[index] = component;
              seenByNormalizedName.set(normalizedName, component);
            }
            return;
          } else {
            // Keep existing, skip this one
            return;
          }
        }
        
        // Add to seen signatures and unique components
        seenSignatures.add(signature);
        seenByNormalizedName.set(normalizedName, component);
        uniqueComponents.push(component);
      });

      // Don't sort - preserve the order from template_design_system.html
      // Components are already ordered in parseDesignSystemComponents.ts

      // Final pass: remove any remaining duplicates by name (keep first occurrence)
      const finalUnique: ComponentData[] = [];
      const finalSeenNames = new Set<string>();
      uniqueComponents.forEach(component => {
        const normalizedName = normalizeName(component.name);
        if (!finalSeenNames.has(normalizedName)) {
          finalSeenNames.add(normalizedName);
          finalUnique.push(component);
        }
      });
      
      // Filter out unwanted components
      const excludedComponents = ['bulletpoints', 'bullet points', 'bullets', 'hero component'];
      const filtered = finalUnique.filter(component => {
        const normalizedName = normalizeName(component.name);
        const shouldExclude = excludedComponents.some(excluded => 
          normalizedName.includes(excluded) || excluded.includes(normalizedName)
        );
        return !shouldExclude;
      });
      
      setComponents(filtered);
      setFilteredComponents(filtered);
    } catch (error) {
      console.error('Error loading components:', error);
      setComponents([]);
      setFilteredComponents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  // Filter components based on search and category
  useEffect(() => {
    let filtered = components;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(component =>
        component.name.toLowerCase().includes(query) ||
        component.elements.some(el => el.label.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(component => component.category === categoryFilter);
    }

    setFilteredComponents(filtered);
  }, [searchQuery, categoryFilter, components]);

  // Generate preview HTML for a component
  const generatePreviewHtml = (component: ComponentData): string => {
    // Ensure component HTML exists and is valid
    if (!component || !component.html || component.html.trim() === '') {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .preview-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 40px; text-align: center; }
  </style>
</head>
<body>
  <div class="preview-container">
    <p style="color: #64748b;">No preview available for this component</p>
  </div>
</body>
</html>`;
    }

    // Component HTML is typically a <tr> element extracted from master template
    // We need to wrap it in a proper email table structure
    const componentHtml = component.html.trim();

    // Check if it's already a complete HTML document
    const isCompleteHtml = componentHtml.toLowerCase().startsWith('<!doctype') ||
                          (componentHtml.toLowerCase().includes('<html') && componentHtml.toLowerCase().includes('</html>'));

    let finalHtml = '';
    if (isCompleteHtml) {
      finalHtml = componentHtml;
    } else {
      // It's a <tr> element or partial HTML, wrap it in a proper email table structure
      finalHtml = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;" role="presentation">
  <tbody>
    ${componentHtml}
  </tbody>
</table>`;
    }

    const emailWrapper = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .preview-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
  </style>
</head>
<body>
  <div class="preview-container">
    ${finalHtml}
  </div>
</body>
</html>`;

    return emailWrapper;
  };

  // Get unique categories
  const categories = Array.from(new Set(components.map(c => c.category || 'other'))).sort();

  // Get element type icon
  const getElementTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-3 h-3" />;
      case 'heading':
      case 'text':
        return <Type className="w-3 h-3" />;
      case 'button':
        return <MousePointerClick className="w-3 h-3" />;
      case 'link':
        return <LinkIcon className="w-3 h-3" />;
      default:
        return <Layout className="w-3 h-3" />;
    }
  };

  const handleBack = () => {
    if (window.location.pathname.includes('/gestion')) {
      navigate('/gestion');
    } else {
      navigate('/user');
    }
  };

  // Get preview image URL for a component
  const getComponentPreviewImage = (componentName: string): string => {
    // Normalize component name for matching (lowercase, remove special chars)
    const normalizedName = componentName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    // Direct mapping of component names to preview images
    const imageMap: Record<string, string> = {
      // Exact matches - mapped to actual files in /component_images/
      'header': '/component_images/header.png',
      'header2': '/component_images/header2.png',
      'hero': '/component_images/hero.png',
      'hero block': '/component_images/hero_block.png',
      'hero block2': '/component_images/hero_block2.png',
      'hero component': '/component_images/hero.png',
      'text block': '/component_images/text_block__.png',
      'text block2': '/component_images/text_block2.png',
      'notification block': '/component_images/notification_block.png',
      'single product': '/component_images/single_product.png',
      'order details': '/component_images/order_details.png',
      'products grid': '/component_images/products_grid.png',
      'product recommendations': '/component_images/product_recommendations.png',
      'icons list': '/component_images/icons_list.png',
      'metrics block': '/component_images/metrics_block.png',
      'cta section': '/component_images/cta_section.png',
      'dual cta': '/component_images/dual_cta.png',
      'footer': '/component_images/footer.png',
      'image': '/component_images/image.png',

      // Additional pattern matches
      'text': '/component_images/text_block__.png',
      'notification': '/component_images/notification_block.png',
      'product': '/component_images/single_product.png',
      'order': '/component_images/order_details.png',
      'grid': '/component_images/products_grid.png',
      'recommendation': '/component_images/product_recommendations.png',
      'icons': '/component_images/icons_list.png',
      'metrics': '/component_images/metrics_block.png',
      'cta': '/component_images/cta_section.png',
    };

    // Try exact match first
    if (imageMap[normalizedName]) {
      return imageMap[normalizedName];
    }

    // Try partial matching
    for (const [key, imagePath] of Object.entries(imageMap)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return imagePath;
      }
    }

    // Default fallback
    return '/component_images/image.png';
  };

  const handleViewComponent = (component: ComponentData) => {
    setSelectedComponent(component);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading components...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Components Catalogue</h1>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search components or elements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredComponents.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No components found</h3>
            <p className="text-gray-500 dark:text-gray-500">
              {searchQuery || categoryFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No components are currently available'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredComponents.map((component) => (
              <div
                key={component.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Component Preview */}
                <div className="bg-gray-50 dark:bg-gray-950 p-4 border-b border-gray-200 dark:border-gray-800">
                  <div className="aspect-video bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-hidden flex items-center justify-center">
                    {component.preview || getComponentPreviewImage(component.name) ? (
                      <img
                        src={component.preview || getComponentPreviewImage(component.name)}
                        alt={`Preview of ${component.name}`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          console.error(`Image failed to load for ${component.name}, using fallback`);
                          e.currentTarget.src = '/component_images/image.png';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <Package className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Component Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{component.name}</h3>
                    {component.category && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 rounded">
                        {component.category}
                      </span>
                    )}
                  </div>

                  {/* Elements Count */}
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <Package className="w-4 h-4 mr-1" />
                    <span>{component.elements.length} editable element{component.elements.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Element Types Preview */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Array.from(new Set(component.elements.map(el => el.type)))
                      .slice(0, 4)
                      .map(type => (
                        <div
                          key={type}
                          className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300"
                          title={type}
                        >
                          {getElementTypeIcon(type)}
                          <span className="capitalize">{type}</span>
                        </div>
                      ))}
                    {component.elements.length > 4 && (
                      <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300">
                        +{component.elements.length - 4} more
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleViewComponent(component);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Component Preview Modal - Amplified View */}
      {selectedComponent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[1000000] flex items-center justify-center p-4"
          style={{ 
            zIndex: 1000000,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          onClick={() => {
            setSelectedComponent(null);
          }}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col z-[1000001] relative"
            style={{ 
              zIndex: 1000001,
              position: 'relative',
              backgroundColor: 'white'
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedComponent?.name || 'Component Preview'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {selectedComponent.elements.length} editable element{selectedComponent.elements.length !== 1 ? 's' : ''}
                  {selectedComponent.category && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 rounded">
                      {selectedComponent.category}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedComponent(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Content - Component Preview Image */}
            <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-8 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 shadow-lg max-w-4xl w-full">
                <div className="p-6">
                  {/* Component Preview Image */}
                  {getComponentPreviewImage(selectedComponent.name) && (
                    <div className="bg-gray-50 dark:bg-gray-950 rounded-lg border-2 border-gray-200 dark:border-gray-800 overflow-hidden">
                      <img
                        src={getComponentPreviewImage(selectedComponent.name)}
                        alt={`Preview of ${selectedComponent.name} component`}
                        className="w-full h-auto"
                        style={{ maxHeight: '70vh', objectFit: 'contain' }}
                        onError={(e) => {
                          console.error('Image failed to load, using fallback');
                          e.currentTarget.src = '/component_images/image.png';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end bg-gray-50 dark:bg-gray-950">
              <button
                onClick={() => setSelectedComponent(null)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

