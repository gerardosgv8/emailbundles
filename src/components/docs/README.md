# Documentation Components

This directory contains React components that recreate the documentation page from `docs.html` using React and Tailwind CSS.

## Components

- **DocsHeader** - Navigation header with React Router links
- **DocsHero** - Documentation page hero section
- **TableOfContents** - Interactive table of contents with smooth scrolling
- **GettingStartedSection** - Step-by-step setup guide
- **TemplateStructureSection** - HTML structure explanation
- **CustomizationSection** - Colors, fonts, and images guide
- **ESPIntegrationSection** - ESP-specific integration guides
- **TroubleshootingSection** - Common issues and solutions
- **BestPracticesSection** - Design and technical guidelines
- **TemplateReferenceSection** - Available templates overview
- **SupportSection** - Help resources and contact information
- **DocsFooter** - Documentation footer with React Router links
- **DocumentationPage** - Main component that combines all sections

## Features

### ✅ **Enhanced User Experience**
- **React Router Integration** - Seamless navigation within the app
- **Smooth Scrolling** - Interactive table of contents with smooth scroll to sections
- **Consistent Navigation** - Links back to landing page and other sections
- **Mobile Responsive** - Optimized for all device sizes

### ✅ **Interactive Elements**
- **Clickable Table of Contents** - Navigate directly to sections
- **External Links** - Proper handling of external testing tools and resources
- **Email Links** - Direct mailto links for support
- **Cross-page Navigation** - Links between landing page and docs

### ✅ **Technical Improvements**
- **TypeScript Support** - Fully typed components
- **Component Architecture** - Modular, reusable components
- **Tailwind CSS** - Consistent styling with the rest of the app
- **Accessibility** - Proper semantic HTML and ARIA attributes

## Usage

The documentation page is accessible at `/docs` route in the React app. All components maintain the same visual design as the original HTML version while providing enhanced functionality.

## Navigation

- **From Landing Page**: Click "Docs" in the header or "View docs" button
- **Within Docs**: Use the table of contents for quick navigation
- **Back to Landing**: Click the logo or "Home" link in the header
- **Cross-references**: Links to FAQ, testimonials, and purchase sections

## Styling

- Uses the same custom `primary` color (`#0ea5e9`) as the landing page
- Maintains exact visual consistency with the original HTML
- Responsive design with mobile-first approach
- Consistent typography and spacing
