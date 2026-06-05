import React from 'react';
import { UnifiedHeader } from '../common/UnifiedHeader';
import { DocsHero } from './DocsHero';
import { TableOfContents } from './TableOfContents';
import { GettingStartedSection } from './GettingStartedSection';
import { TemplateStructureSection } from './TemplateStructureSection';
import { CustomizationSection } from './CustomizationSection';
import { ESPIntegrationSection } from './ESPIntegrationSection';
import { TroubleshootingSection } from './TroubleshootingSection';
import { BestPracticesSection } from './BestPracticesSection';
import { TemplateReferenceSection } from './TemplateReferenceSection';
import { SupportSection } from './SupportSection';
import { DocsFooter } from './DocsFooter';

export const DocumentationPage: React.FC = () => {
  return (
    <div className="antialiased text-gray-800 bg-gray-50">
      <UnifiedHeader />
      
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          <aside className="hidden w-56 shrink-0 lg:sticky lg:top-20 lg:block xl:w-64">
            <TableOfContents variant="aside" />
          </aside>
          <div className="min-w-0 flex-1">
            <DocsHero />
            <div className="lg:hidden">
              <TableOfContents variant="mobile-card" />
            </div>
            <GettingStartedSection />
            <TemplateStructureSection />
            <CustomizationSection />
            <ESPIntegrationSection />
            <TroubleshootingSection />
            <BestPracticesSection />
            <TemplateReferenceSection />
            <SupportSection />
          </div>
        </div>
      </main>
      
      <DocsFooter />
    </div>
  );
};
