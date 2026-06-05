// Style: visual character of the font (modern, classic, playful, etc.)
export type FontStyle = 'modern' | 'classic' | 'playful' | 'elegant' | 'minimalist' | 'display' | 'rounded' | 'geometric' | 'handwritten' | 'condensed';
// Tone: emotional/contextual feel (professional, friendly, formal, etc.)
export type FontTone = 'professional' | 'friendly' | 'formal' | 'casual' | 'creative' | 'luxury' | 'tech' | 'editorial' | 'minimal' | 'warm';

export interface Font {
  id: string;
  name: string;
  family: string;
  category: 'system' | 'web-safe' | 'serif' | 'sans-serif' | 'monospace';
  description?: string;
  emailSafe: boolean;
  style?: FontStyle[];
  tone?: FontTone[];
  /** Google Font ID for loading in preview (e.g., "Roboto" for fonts.googleapis.com) */
  googleFontId?: string;
}

export const fontsRepository: Font[] = [
  // System Fonts (Best for email compatibility)
  {
    id: 'system-default',
    name: 'System Default',
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
    category: 'system',
    description: 'Modern system font stack for maximum compatibility',
    emailSafe: true,
    style: ['modern', 'minimalist'],
    tone: ['professional', 'minimal'],
  },
  {
    id: 'system-sans',
    name: 'System Sans',
    family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
    category: 'system',
    description: 'Cross-platform system sans-serif',
    emailSafe: true,
    style: ['modern', 'minimalist'],
    tone: ['professional', 'casual'],
  },
  {
    id: 'system-serif',
    name: 'System Serif',
    family: "ui-serif, Georgia, 'Times New Roman', Times, serif",
    category: 'system',
    description: 'System serif font stack',
    emailSafe: true,
    style: ['classic'],
    tone: ['formal', 'editorial'],
  },

  // Web Safe Sans-Serif
  {
    id: 'arial',
    name: 'Arial',
    family: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
    category: 'sans-serif',
    description: 'Universal sans-serif, excellent email support',
    emailSafe: true,
    style: ['modern', 'minimalist'],
    tone: ['professional', 'formal', 'minimal'],
  },
  {
    id: 'helvetica',
    name: 'Helvetica',
    family: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    category: 'sans-serif',
    description: 'Clean and professional, widely supported',
    emailSafe: true,
    style: ['modern', 'classic', 'geometric'],
    tone: ['professional', 'formal', 'minimal'],
  },
  {
    id: 'verdana',
    name: 'Verdana',
    family: 'Verdana, Geneva, sans-serif',
    category: 'sans-serif',
    description: 'Highly readable, great for body text',
    emailSafe: true,
    style: ['modern', 'minimalist'],
    tone: ['professional', 'friendly', 'casual'],
  },
  {
    id: 'trebuchet',
    name: 'Trebuchet MS',
    family: "'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Modern and friendly',
    emailSafe: true,
    style: ['modern', 'rounded'],
    tone: ['friendly', 'casual'],
  },
  {
    id: 'tahoma',
    name: 'Tahoma',
    family: 'Tahoma, Verdana, Segoe, sans-serif',
    category: 'sans-serif',
    description: 'Compact and clear',
    emailSafe: true,
    style: ['modern', 'condensed'],
    tone: ['professional', 'tech'],
  },
  {
    id: 'lucida',
    name: 'Lucida Sans',
    family: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
    category: 'sans-serif',
    description: 'Clean and readable',
    emailSafe: true,
    style: ['classic', 'minimalist'],
    tone: ['professional', 'casual'],
  },

  // Web Safe Serif
  {
    id: 'georgia',
    name: 'Georgia',
    family: "Georgia, 'Times New Roman', Times, serif",
    category: 'serif',
    description: 'Elegant serif, excellent readability',
    emailSafe: true,
    style: ['classic', 'elegant'],
    tone: ['formal', 'editorial', 'warm'],
  },
  {
    id: 'times',
    name: 'Times New Roman',
    family: "'Times New Roman', Times, serif",
    category: 'serif',
    description: 'Classic serif, traditional look',
    emailSafe: true,
    style: ['classic'],
    tone: ['formal', 'editorial'],
  },
  {
    id: 'palatino',
    name: 'Palatino',
    family: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    category: 'serif',
    description: 'Elegant serif font',
    emailSafe: true,
    style: ['classic', 'elegant'],
    tone: ['formal', 'editorial', 'luxury'],
  },

  // Web Safe Monospace
  {
    id: 'courier',
    name: 'Courier New',
    family: "'Courier New', Courier, monospace",
    category: 'monospace',
    description: 'Monospace font for code or technical content',
    emailSafe: true,
    style: ['classic'],
    tone: ['tech', 'professional'],
  },
  {
    id: 'monaco',
    name: 'Monaco',
    family: "Monaco, 'Courier New', monospace",
    category: 'monospace',
    description: 'Clean monospace font',
    emailSafe: true,
    style: ['modern', 'minimalist'],
    tone: ['tech', 'minimal'],
  },

  // Google Fonts – Sans-Serif
  {
    id: 'roboto',
    name: 'Roboto',
    family: "'Roboto', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Modern Google Font, excellent readability',
    emailSafe: true,
    googleFontId: 'Roboto',
    style: ['modern', 'geometric'],
    tone: ['professional', 'tech', 'minimal'],
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    family: "'Open Sans', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Friendly and highly readable',
    emailSafe: true,
    googleFontId: 'Open+Sans',
    style: ['modern', 'minimalist'],
    tone: ['friendly', 'professional', 'warm'],
  },
  {
    id: 'lato',
    name: 'Lato',
    family: "'Lato', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Warm and professional',
    emailSafe: true,
    googleFontId: 'Lato',
    style: ['modern', 'rounded'],
    tone: ['friendly', 'professional', 'warm'],
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    family: "'Montserrat', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Geometric and modern',
    emailSafe: true,
    googleFontId: 'Montserrat',
    style: ['modern', 'geometric', 'display'],
    tone: ['professional', 'creative', 'minimal'],
  },
  {
    id: 'raleway',
    name: 'Raleway',
    family: "'Raleway', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Elegant and stylish',
    emailSafe: true,
    googleFontId: 'Raleway',
    style: ['elegant', 'modern', 'display'],
    tone: ['professional', 'creative', 'luxury'],
  },
  {
    id: 'poppins',
    name: 'Poppins',
    family: "'Poppins', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Modern geometric with friendly character',
    emailSafe: true,
    googleFontId: 'Poppins',
    style: ['modern', 'geometric', 'rounded'],
    tone: ['friendly', 'creative', 'casual'],
  },
  {
    id: 'source-sans',
    name: 'Source Sans 3',
    family: "'Source Sans 3', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Versatile and readable',
    emailSafe: true,
    googleFontId: 'Source+Sans+3',
    style: ['modern', 'minimalist'],
    tone: ['professional', 'editorial', 'friendly'],
  },
  {
    id: 'nunito',
    name: 'Nunito',
    family: "'Nunito', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Rounded and approachable',
    emailSafe: true,
    googleFontId: 'Nunito',
    style: ['rounded', 'playful'],
    tone: ['friendly', 'casual', 'warm'],
  },
  {
    id: 'work-sans',
    name: 'Work Sans',
    family: "'Work Sans', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Optimized for screens',
    emailSafe: true,
    googleFontId: 'Work+Sans',
    style: ['modern', 'geometric'],
    tone: ['professional', 'tech', 'minimal'],
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Designed for UI and digital',
    emailSafe: true,
    googleFontId: 'Inter',
    style: ['modern', 'geometric'],
    tone: ['professional', 'tech', 'minimal'],
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    family: "'DM Sans', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Low-contrast geometric',
    emailSafe: true,
    googleFontId: 'DM+Sans',
    style: ['modern', 'minimalist'],
    tone: ['professional', 'creative', 'minimal'],
  },
  {
    id: 'quicksand',
    name: 'Quicksand',
    family: "'Quicksand', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Rounded and friendly',
    emailSafe: true,
    googleFontId: 'Quicksand',
    style: ['rounded', 'playful'],
    tone: ['friendly', 'casual', 'creative'],
  },
  {
    id: 'rubik',
    name: 'Rubik',
    family: "'Rubik', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Slightly rounded corners',
    emailSafe: true,
    googleFontId: 'Rubik',
    style: ['rounded', 'modern'],
    tone: ['friendly', 'casual'],
  },
  {
    id: 'outfit',
    name: 'Outfit',
    family: "'Outfit', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Contemporary and versatile',
    emailSafe: true,
    googleFontId: 'Outfit',
    style: ['modern', 'geometric'],
    tone: ['professional', 'creative', 'minimal'],
  },
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    family: "'Plus Jakarta Sans', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Geometric with personality',
    emailSafe: true,
    googleFontId: 'Plus+Jakarta+Sans',
    style: ['modern', 'geometric'],
    tone: ['professional', 'creative', 'friendly'],
  },
  {
    id: 'manrope',
    name: 'Manrope',
    family: "'Manrope', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Open-source geometric sans',
    emailSafe: true,
    googleFontId: 'Manrope',
    style: ['modern', 'geometric'],
    tone: ['professional', 'tech', 'minimal'],
  },
  {
    id: 'karla',
    name: 'Karla',
    family: "'Karla', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Grotesque sans for UI',
    emailSafe: true,
    googleFontId: 'Karla',
    style: ['modern', 'minimalist'],
    tone: ['professional', 'friendly', 'editorial'],
  },
  {
    id: 'josefin-sans',
    name: 'Josefin Sans',
    family: "'Josefin Sans', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Geometric with vintage flair',
    emailSafe: true,
    googleFontId: 'Josefin+Sans',
    style: ['geometric', 'display'],
    tone: ['creative', 'casual', 'friendly'],
  },
  {
    id: 'figtree',
    name: 'Figtree',
    family: "'Figtree', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Fresh and readable',
    emailSafe: true,
    googleFontId: 'Figtree',
    style: ['modern', 'rounded'],
    tone: ['friendly', 'professional', 'casual'],
  },

  // Google Fonts – Serif
  {
    id: 'merriweather',
    name: 'Merriweather',
    family: "'Merriweather', Georgia, serif",
    category: 'serif',
    description: 'Readable serif for screens',
    emailSafe: true,
    googleFontId: 'Merriweather',
    style: ['classic'],
    tone: ['editorial', 'formal', 'professional'],
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    family: "'Playfair Display', Georgia, serif",
    category: 'serif',
    description: 'Elegant display serif',
    emailSafe: true,
    googleFontId: 'Playfair+Display',
    style: ['elegant', 'display', 'classic'],
    tone: ['luxury', 'formal', 'creative'],
  },
  {
    id: 'lora',
    name: 'Lora',
    family: "'Lora', Georgia, serif",
    category: 'serif',
    description: 'Contemporary serif',
    emailSafe: true,
    googleFontId: 'Lora',
    style: ['classic', 'elegant'],
    tone: ['editorial', 'warm', 'creative'],
  },
  {
    id: 'source-serif',
    name: 'Source Serif 4',
    family: "'Source Serif 4', Georgia, serif",
    category: 'serif',
    description: 'Designed for long reading',
    emailSafe: true,
    googleFontId: 'Source+Serif+4',
    style: ['classic', 'modern'],
    tone: ['editorial', 'professional', 'formal'],
  },
  {
    id: 'crimson-text',
    name: 'Crimson Text',
    family: "'Crimson Text', Georgia, serif",
    category: 'serif',
    description: 'Old-style serif',
    emailSafe: true,
    googleFontId: 'Crimson+Text',
    style: ['classic'],
    tone: ['editorial', 'formal', 'warm'],
  },
  {
    id: 'libre-baskerville',
    name: 'Libre Baskerville',
    family: "'Libre Baskerville', Georgia, serif",
    category: 'serif',
    description: 'Classic book serif',
    emailSafe: true,
    googleFontId: 'Libre+Baskerville',
    style: ['classic', 'elegant'],
    tone: ['editorial', 'formal', 'luxury'],
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    family: "'Cormorant Garamond', Georgia, serif",
    category: 'serif',
    description: 'Elegant Garamond revival',
    emailSafe: true,
    googleFontId: 'Cormorant+Garamond',
    style: ['elegant', 'classic'],
    tone: ['luxury', 'formal', 'editorial'],
  },
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    family: "'Bebas Neue', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Bold condensed display',
    emailSafe: true,
    googleFontId: 'Bebas+Neue',
    style: ['display', 'condensed'],
    tone: ['creative', 'casual', 'tech'],
  },
  {
    id: 'oswald',
    name: 'Oswald',
    family: "'Oswald', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Reworking of classic grotesques',
    emailSafe: true,
    googleFontId: 'Oswald',
    style: ['condensed', 'display'],
    tone: ['professional', 'tech', 'creative'],
  },
  {
    id: 'caveat',
    name: 'Caveat',
    family: "'Caveat', cursive",
    category: 'sans-serif',
    description: 'Casual brush handwriting',
    emailSafe: true,
    googleFontId: 'Caveat',
    style: ['handwritten'],
    tone: ['friendly', 'casual', 'creative'],
  },
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    family: "'Dancing Script', cursive",
    category: 'sans-serif',
    description: 'Casual script',
    emailSafe: true,
    googleFontId: 'Dancing+Script',
    style: ['handwritten'],
    tone: ['friendly', 'creative', 'casual'],
  },
  {
    id: 'pacifico',
    name: 'Pacifico',
    family: "'Pacifico', cursive",
    category: 'sans-serif',
    description: 'Retro brush script',
    emailSafe: true,
    googleFontId: 'Pacifico',
    style: ['handwritten', 'playful'],
    tone: ['friendly', 'casual', 'creative'],
  },
  {
    id: 'comfortaa',
    name: 'Comfortaa',
    family: "'Comfortaa', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Rounded geometric',
    emailSafe: true,
    googleFontId: 'Comfortaa',
    style: ['rounded', 'playful'],
    tone: ['friendly', 'casual', 'warm'],
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    family: "'Space Grotesk', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Tech-forward geometric',
    emailSafe: true,
    googleFontId: 'Space+Grotesk',
    style: ['modern', 'geometric'],
    tone: ['tech', 'professional', 'minimal'],
  },
  {
    id: 'syne',
    name: 'Syne',
    family: "'Syne', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Contemporary variable font',
    emailSafe: true,
    googleFontId: 'Syne',
    style: ['modern', 'display'],
    tone: ['creative', 'tech', 'minimal'],
  },
  {
    id: 'league-spartan',
    name: 'League Spartan',
    family: "'League Spartan', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Bold and geometric',
    emailSafe: true,
    googleFontId: 'League+Spartan',
    style: ['geometric', 'display'],
    tone: ['professional', 'tech', 'creative'],
  },
  {
    id: 'archivo',
    name: 'Archivo',
    family: "'Archivo', Arial, sans-serif",
    category: 'sans-serif',
    description: 'Optimized for screens',
    emailSafe: true,
    googleFontId: 'Archivo',
    style: ['modern', 'geometric'],
    tone: ['professional', 'tech', 'minimal'],
  },
];

// Get font by ID
export const getFontById = (id: string): Font | undefined => {
  return fontsRepository.find(font => font.id === id);
};

// Get fonts by category
export const getFontsByCategory = (category: Font['category']): Font[] => {
  return fontsRepository.filter(font => font.category === category);
};

// Search fonts by name
export const searchFonts = (query: string): Font[] => {
  const lowerQuery = query.toLowerCase();
  return fontsRepository.filter(
    font =>
      font.name.toLowerCase().includes(lowerQuery) ||
      font.family.toLowerCase().includes(lowerQuery) ||
      font.description?.toLowerCase().includes(lowerQuery)
  );
};

// Get font family string from font ID
export const getFontFamilyById = (id: string): string | undefined => {
  const font = getFontById(id);
  return font?.family;
};

// Get all categories
export const getCategories = (): Font['category'][] => {
  return Array.from(new Set(fontsRepository.map(font => font.category)));
};

// Get all unique styles used in the repository
export const getStyles = (): FontStyle[] => {
  const styleSet = new Set<FontStyle>();
  fontsRepository.forEach(font => {
    font.style?.forEach(s => styleSet.add(s));
  });
  return Array.from(styleSet).sort();
};// Get all unique tones used in the repository
export const getTones = (): FontTone[] => {
  const toneSet = new Set<FontTone>();
  fontsRepository.forEach(font => {
    font.tone?.forEach(t => toneSet.add(t));
  });
  return Array.from(toneSet).sort();
};// Get Google Font IDs for fonts that need to be loaded (for preview)
export const getGoogleFontIds = (): string[] => {
  return fontsRepository
    .filter(f => f.googleFontId)
    .map(f => f.googleFontId!);
};