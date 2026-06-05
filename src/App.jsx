import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import { TemplateBuilderProvider } from "./context/TemplateBuilderContext";
import { AuthProvider } from "./context/AuthContext";
import { UserThemeProvider } from "./context/UserThemeContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import ProtectedAdminRoute from "./components/common/ProtectedAdminRoute";
import ProtectedUserRoute from "./components/common/ProtectedUserRoute";
import { ProtectedTierRoute } from "./components/common/ProtectedTierRoute";
import { ProtectedSubscriptionRoute } from "./components/common/ProtectedSubscriptionRoute";
import { LandingPage } from "./components/landing";
import { DocumentationPage } from "./components/docs";
import { DownloadPage } from "./pages/DownloadPage";
import { CheckoutPage } from "./components/checkout";
import { ProductsPage } from "./pages/ProductsPage";
import { EcommerceMailKitPage } from "./pages/EcommerceMailKitPage";
// Stripe checkout + confirmation routes
import { TransactionsPage } from "./pages/TransactionsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { AdminProducts } from "./pages/admin/AdminProducts";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminTransactions } from "./pages/admin/AdminTransactions";
import { AdminAnalytics } from "./pages/admin/AdminAnalytics";
import { AdminStorageReport } from "./pages/admin/AdminStorageReport";
import { AdminUserTiers } from "./pages/admin/AdminUserTiers";
import { AdminTickets } from "./pages/admin/AdminTickets";
import { AdminEmailAlerts } from "./pages/admin/AdminEmailAlerts";
import { AdminComponentBuilder } from "./pages/admin/AdminComponentBuilder";
import { UserDashboard, UserOverview, UserProfile, UserSettings, UserEmailBuilder, TemplateSelector, TemplateBuilder as EmailTemplateBuilder, TemplateComposer, ComponentsCatalogue } from "./pages/user";
import { Dashboard } from "./pages/Newsletter/Dashboard";
import { TemplateBuilder } from "./pages/Newsletter/TemplateBuilder";
import { SavedTemplates } from "./pages/Newsletter/SavedTemplates";
import { EmailBuilder } from "./pages/Newsletter/EmailBuilder";
import { EmailLibrary } from "./pages/Newsletter/EmailLibrary";
import { EmailBuilderPanel } from "./pages/Newsletter/EmailBuilderPanel";
import { Mailcraft } from "./pages/Newsletter/Mailcraft";
import { UpgradeSuccessPage } from "./pages/UpgradeSuccessPage";
import { SupportPage } from "./pages/SupportPage";
// Stripe success pages

export default function App() {
  return (
    <AuthProvider>
      <TemplateBuilderProvider>
        <Router>
          <ScrollToTop />
              <Routes>
                {/* Marketing homepage — same UserThemeProvider as /user (system light/dark preference) */}
                <Route
                  element={
                    <UserThemeProvider>
                      <Outlet />
                    </UserThemeProvider>
                  }
                >
                  <Route index element={<LandingPage />} />
                  <Route path="landing" element={<LandingPage />} />
                </Route>

                {/* Mailcraft Page - Public */}
                <Route path="/mailcraft" element={<Mailcraft />} />
                
                {/* Product Landing Pages */}
                <Route path="/ecommerce-mail-kit" element={<EcommerceMailKitPage />} />
                
                {/* Products Page */}
                <Route path="/products" element={<ProductsPage />} />
                
                {/* Documentation Page */}
                <Route path="/docs" element={<DocumentationPage />} />
                
                {/* Register Page */}
                <Route path="/register" element={<RegisterPage />} />
                
                {/* Download Page */}
                <Route path="/download" element={<DownloadPage />} />
                
                {/* Stripe Checkout + Confirmation */}
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/confirmation" element={<ConfirmationPage />} />
                <Route path="/upgrade-success" element={<UpgradeSuccessPage />} />
                
                {/* Stripe success/test routes removed */}
                
                {/* Transactions Page */}
                <Route path="/transactions" element={<TransactionsPage />} />
                
                {/* Login Page */}
                <Route path="/login" element={<LoginPage />} />

                {/* Supabase OAuth callback */}
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                
                {/* Admin Dashboard - Protected */}
                <Route 
                  path="/gestion" 
                  element={
                    <ProtectedAdminRoute>
                      <AdminDashboard />
                    </ProtectedAdminRoute>
                  }
                >
                  <Route index element={<AdminOverview />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="transactions" element={<AdminTransactions />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="storage-report" element={<AdminStorageReport />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="user-tiers" element={<AdminUserTiers />} />
                  <Route path="support" element={<SupportPage context="admin" />} />
                  <Route path="tickets" element={<AdminTickets />} />
                  <Route path="email-alerts" element={<AdminEmailAlerts />} />
                  <Route path="component-builder" element={<AdminComponentBuilder />} />
                  <Route path="component-builder/:componentName" element={<AdminComponentBuilder />} />
                  <Route path="email-builder" element={<TemplateSelector />} />
                  <Route path="email-builder/:templateId" element={<EmailTemplateBuilder />} />
                  <Route path="email-library" element={<EmailLibrary />} />
                  <Route path="template-composer" element={<TemplateComposer />} />
                  <Route path="template-composer/:templateId" element={<TemplateComposer />} />
                  <Route path="saved-templates" element={<SavedTemplates />} />
                  <Route path="components" element={<ComponentsCatalogue />} />
                </Route>

                {/* Template Builder - Full Screen Route (BEFORE /user to avoid conflicts) */}
                <Route
                  path="/user/builder/:templateId/:sessionId"
                  element={
                    <ProtectedUserRoute>
                      <UserThemeProvider>
                        <EmailTemplateBuilder />
                      </UserThemeProvider>
                    </ProtectedUserRoute>
                  }
                />

                {/* User Dashboard - Protected */}
                <Route 
                  path="/user" 
                  element={
                    <ProtectedUserRoute>
                      <UserThemeProvider>
                        <UserDashboard />
                      </UserThemeProvider>
                    </ProtectedUserRoute>
                  }
                >
                  <Route index element={<UserOverview />} />
                  <Route path="email-builder" element={<TemplateSelector />} />
                  <Route 
                    path="template-composer" 
                    element={
                      <ProtectedSubscriptionRoute>
                      <ProtectedTierRoute requiredCapability="canUseTemplateComposer">
                        <TemplateComposer />
                      </ProtectedTierRoute>
                      </ProtectedSubscriptionRoute>
                    } 
                  />
                  <Route 
                    path="template-composer/:templateId" 
                    element={
                      <ProtectedSubscriptionRoute>
                      <ProtectedTierRoute requiredCapability="canUseTemplateComposer">
                        <TemplateComposer />
                      </ProtectedTierRoute>
                      </ProtectedSubscriptionRoute>
                    } 
                  />
                  <Route
                    path="saved-templates"
                    element={
                      <ProtectedSubscriptionRoute>
                        <ProtectedTierRoute requiredCapability="canSaveTemplates">
                          <SavedTemplates />
                        </ProtectedTierRoute>
                      </ProtectedSubscriptionRoute>
                    }
                  />
                  <Route
                    path="email-library"
                    element={
                      <ProtectedSubscriptionRoute>
                        <ProtectedTierRoute requiredCapability="canSaveEmails">
                          <EmailLibrary />
                        </ProtectedTierRoute>
                      </ProtectedSubscriptionRoute>
                    }
                  />
                  <Route path="email-builder/:templateId" element={<EmailTemplateBuilder />} />
                  <Route path="components" element={<ComponentsCatalogue />} />
                  <Route path="profile" element={<UserProfile />} />
                  <Route path="settings" element={<UserSettings />} />
                  <Route path="support" element={<SupportPage context="subscriber" />} />
                </Route>
              
              {/* Template Builder Layout - Protected for standard users only */}
              <Route element={
                <ProtectedUserRoute>
                  <AppLayout />
                </ProtectedUserRoute>
              }>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/template-builder" element={<TemplateBuilder />} />
                <Route
                  path="/email-builder"
                  element={
                    <ProtectedSubscriptionRoute>
                      <EmailBuilder />
                    </ProtectedSubscriptionRoute>
                  }
                />
                <Route
                  path="/email-builder-panel"
                  element={
                    <ProtectedSubscriptionRoute>
                      <EmailBuilderPanel />
                    </ProtectedSubscriptionRoute>
                  }
                />
                <Route
                  path="/email-library"
                  element={
                    <ProtectedSubscriptionRoute>
                      <ProtectedTierRoute requiredCapability="canSaveEmails">
                        <EmailLibrary />
                      </ProtectedTierRoute>
                    </ProtectedSubscriptionRoute>
                  }
                />
              </Route>

                {/* Fallback Route — same theme shell as homepage */}
                <Route
                  path="*"
                  element={
                    <UserThemeProvider>
                      <LandingPage />
                    </UserThemeProvider>
                  }
                />
              </Routes>
        </Router>
      </TemplateBuilderProvider>
    </AuthProvider>
  );
}
