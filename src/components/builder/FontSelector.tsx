import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import { fontsRepository, Font, getCategories, getStyles, getTones, FontStyle, FontTone } from '../../utils/fontsRepository';

interface FontSelectorProps {
  value: string | undefined;
  onChange: (fontFamily: string) => void;
  label?: string;
}

// Helper to find font by family string
const findFontByFamily = (family: string | undefined): Font | null => {
  if (!family) return null;
  // Try exact match first
  const exactMatch = fontsRepository.find(font => font.family === family);
  if (exactMatch) return exactMatch;
  
  // Try partial match (e.g., if family contains the font name)
  const fontName = family.split(',')[0].replace(/['"]/g, '').trim();
  const partialMatch = fontsRepository.find(font => 
    font.family.toLowerCase().includes(fontName.toLowerCase()) ||
    fontName.toLowerCase().includes(font.name.toLowerCase())
  );
  
  return partialMatch || null;
};

// Human-readable labels for style and tone
const STYLE_LABELS: Record<FontStyle, string> = {
  modern: 'Modern',
  classic: 'Classic',
  playful: 'Playful',
  elegant: 'Elegant',
  minimalist: 'Minimalist',
  display: 'Display',
  rounded: 'Rounded',
  geometric: 'Geometric',
  handwritten: 'Handwritten',
  condensed: 'Condensed',
};
const TONE_LABELS: Record<FontTone, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  formal: 'Formal',
  casual: 'Casual',
  creative: 'Creative',
  luxury: 'Luxury',
  tech: 'Tech',
  editorial: 'Editorial',
  minimal: 'Minimal',
  warm: 'Warm',
};

export const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  label = 'Font Family',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Font['category'] | 'all'>('all');
  const [selectedStyle, setSelectedStyle] = useState<FontStyle | 'all'>('all');
  const [selectedTone, setSelectedTone] = useState<FontTone | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedFont = useMemo(() => findFontByFamily(value), [value]);
  
  const categories = useMemo(() => getCategories(), []);
  const styles = useMemo(() => getStyles(), []);
  const tones = useMemo(() => getTones(), []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredFonts = useMemo(() => {
    let fonts = fontsRepository;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      fonts = fonts.filter(font => font.category === selectedCategory);
    }
    
    // Filter by style
    if (selectedStyle !== 'all') {
      fonts = fonts.filter(font => font.style?.includes(selectedStyle));
    }
    
    // Filter by tone
    if (selectedTone !== 'all') {
      fonts = fonts.filter(font => font.tone?.includes(selectedTone));
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      fonts = fonts.filter(
        font =>
          font.name.toLowerCase().includes(query) ||
          font.family.toLowerCase().includes(query) ||
          font.description?.toLowerCase().includes(query) ||
          font.style?.some(s => s.toLowerCase().includes(query)) ||
          font.tone?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    return fonts;
  }, [searchQuery, selectedCategory, selectedStyle, selectedTone]);

  const handleFontSelect = (font: Font) => {
    onChange(font.family);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      
      {/* Selected Font Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedFont ? (
            <>
              <span 
                className="truncate font-medium"
                style={{ fontFamily: selectedFont.family }}
              >
                {selectedFont.name}
              </span>
              {selectedFont.description && (
                <span className="text-xs text-gray-500 truncate hidden sm:inline">
                  {selectedFont.description}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500 truncate">
              {value || 'Select a font...'}
            </span>
          )}
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-xl" style={{ maxHeight: '400px', minWidth: '100%' }}>
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fonts..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="px-3 py-2 border-b border-gray-200 flex flex-wrap gap-2 sticky top-14 bg-white z-10">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.replace('-', ' ')}
              </button>
            ))}
          </div>

          {/* Style & Tone Filter Toggle */}
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50/50">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter by style & tone
              {(selectedStyle !== 'all' || selectedTone !== 'all') && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                  Active
                </span>
              )}
            </button>
            {showFilters && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedStyle('all')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        selectedStyle === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      All
                    </button>
                    {styles.map(style => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setSelectedStyle(style)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                          selectedStyle === style
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'
                        }`}
                      >
                        {STYLE_LABELS[style] || style}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Tone</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedTone('all')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        selectedTone === 'all'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700'
                      }`}
                    >
                      All
                    </button>
                    {tones.map(tone => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => setSelectedTone(tone)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                          selectedTone === tone
                            ? 'bg-amber-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700'
                        }`}
                      >
                        {TONE_LABELS[tone] || tone}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Font List */}
          <div className="max-h-72 overflow-y-auto">
            {filteredFonts.length > 0 ? (
              <div className="py-2">
                {filteredFonts.map(font => {
                  const isSelected = selectedFont?.id === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => handleFontSelect(font)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className="font-medium text-gray-900 text-sm"
                              style={{ fontFamily: font.family }}
                            >
                              {font.name}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            )}
                            {font.emailSafe && (
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                                Email Safe
                              </span>
                            )}
                            {(font.style?.length || font.tone?.length) ? (
                              <span className="flex gap-1 flex-wrap">
                                {font.style?.slice(0, 2).map(s => (
                                  <span key={s} className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-600 rounded">
                                    {STYLE_LABELS[s]}
                                  </span>
                                ))}
                                {font.tone?.slice(0, 2).map(t => (
                                  <span key={t} className="px-1.5 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 rounded">
                                    {TONE_LABELS[t]}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </div>
                          {font.description && (
                            <p className="text-xs text-gray-500 mb-1">
                              {font.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 font-mono break-all">
                            {font.family}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {searchQuery
                  ? `No fonts found matching "${searchQuery}"`
                  : 'No fonts match the selected filters. Try adjusting style, tone, or category.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
