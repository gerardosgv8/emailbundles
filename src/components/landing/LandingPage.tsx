import React from 'react';
import { UnifiedHeader } from '../common/UnifiedHeader';
import { MailcraftHeroSection } from './MailcraftHeroSection';
import { ProblemSolutionSection } from './ProblemSolutionSection';
import { TemplateCreationShowcase } from './TemplateCreationShowcase';
import { FeaturesGrid } from './FeaturesGrid';
import { TemplatesGallery } from './TemplatesGallery';
import { TechnicalHighlights } from './TechnicalHighlights';
import { DocsSection } from './DocsSection';
import { TestimonialsSection } from './TestimonialsSection';
import { FAQSection } from './FAQSection';
import { CheckoutSection } from './CheckoutSection';
import { Footer } from './Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-0 flex-1 antialiased bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200">
      <UnifiedHeader />
      
      <main>
        <MailcraftHeroSection />
        <ProblemSolutionSection />
        <TemplateCreationShowcase />
        <FeaturesGrid />
        <TemplatesGallery />
        <TechnicalHighlights />
        <DocsSection />
        <TestimonialsSection />
        <FAQSection />
      </main>
      
      <Footer />
    </div>
  );
};
