/**
 * Utility functions for user-specific saved emails storage
 * Email Builder - Save email instances with customizations
 * All tiers can save up to 30 emails
 */

import { DynamicTemplate, TemplateElement, TemplateSection, TemplateMeta } from '../services/templateService';

// Type definitions
export interface SavedEmailData {
  id: string;
  name: string;
  templateId: string; // Original template ID this email was based on
  templateName: string; // Original template name
  html: string; // Full HTML of the email
  elements: TemplateElement[]; // All editable elements with their current values
  sections?: TemplateSection[]; // Optional sections
  createdAt: string;
  updatedAt: string;
  description?: string;
  /** Matches TemplateMeta.themeCssMode; omitted on legacy saves (treated as adaptive). */
  themeCssMode?: 'adaptive' | 'light-only';
}

// Storage limits for emails (same for all tiers)
export const EMAIL_STORAGE_LIMITS = {
  MAX_EMAILS: 30,
  MAX_STORAGE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_STORAGE_MB: 10,
  WARNING_THRESHOLD: 0.8, // Warn at 80% capacity
  CRITICAL_THRESHOLD: 0.9, // Critical at 90% capacity
};

export interface EmailStorageInfo {
  emailsCount: number;
  storageUsed: number; // bytes
  storageUsedMB: number;
  storageLimitMB: number;
  storagePercentage: number;
  emailsRemaining: number;
  isWarning: boolean;
  isCritical: boolean;
  isAtLimit: boolean;
}

/**
 * Get the storage key for saved emails based on user ID
 * @param userId - The user ID (number or string)
 * @returns The storage key string
 */
export function getSavedEmailsKey(userId?: number | string | null): string {
  if (!userId) {
    return 'savedEmails_anonymous';
  }
  return `savedEmails_${userId}`;
}

/**
 * Get saved emails for a specific user
 * @param userId - The user ID
 * @returns Array of saved emails
 */
export function getSavedEmails(userId?: number | string | null): SavedEmailData[] {
  try {
    const key = getSavedEmailsKey(userId);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading saved emails:', error);
    return [];
  }
}

/**
 * Calculate storage size of emails
 * @param emails - Array of emails
 * @returns Size in bytes
 */
export function calculateEmailsSize(emails: SavedEmailData[]): number {
  try {
    const jsonString = JSON.stringify(emails);
    return new Blob([jsonString]).size;
  } catch (error) {
    console.error('Error calculating emails size:', error);
    return 0;
  }
}

/**
 * Get storage information for a user's saved emails
 * @param userId - The user ID
 * @returns Storage information object
 */
export function getEmailStorageInfo(userId?: number | string | null): EmailStorageInfo {
  const emails = getSavedEmails(userId);
  const storageUsed = calculateEmailsSize(emails);
  const storageUsedMB = storageUsed / (1024 * 1024);
  const storageLimitMB = EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB;
  const maxStorageBytes = EMAIL_STORAGE_LIMITS.MAX_STORAGE_BYTES;
  const maxEmails = EMAIL_STORAGE_LIMITS.MAX_EMAILS;
  
  const storagePercentage = (storageUsed / maxStorageBytes) * 100;
  const emailsCount = emails.length;
  const emailsRemaining = maxEmails - emailsCount;
  
  return {
    emailsCount,
    storageUsed,
    storageUsedMB,
    storageLimitMB,
    storagePercentage,
    emailsRemaining,
    isWarning: storagePercentage >= EMAIL_STORAGE_LIMITS.WARNING_THRESHOLD * 100 || emailsCount >= maxEmails * EMAIL_STORAGE_LIMITS.WARNING_THRESHOLD,
    isCritical: storagePercentage >= EMAIL_STORAGE_LIMITS.CRITICAL_THRESHOLD * 100 || emailsCount >= maxEmails * EMAIL_STORAGE_LIMITS.CRITICAL_THRESHOLD,
    isAtLimit: emailsCount >= maxEmails || storagePercentage >= 100,
  };
}

/**
 * Check if a new email can be saved
 * @param userId - The user ID
 * @param newEmailSize - Estimated size of the new email in bytes (optional)
 * @returns Object with canSave flag and reason if cannot save
 */
export function canSaveEmail(
  userId?: number | string | null,
  newEmailSize?: number
): { canSave: boolean; reason?: string } {
  const storageInfo = getEmailStorageInfo(userId);
  
  // Check email count limit
  if (storageInfo.emailsCount >= EMAIL_STORAGE_LIMITS.MAX_EMAILS) {
    return {
      canSave: false,
      reason: `You've reached the maximum limit of ${EMAIL_STORAGE_LIMITS.MAX_EMAILS} saved emails. Please delete some emails to save new ones.`,
    };
  }
  
  // Check storage limit
  const estimatedNewSize = newEmailSize || 0;
  const estimatedTotalSize = storageInfo.storageUsed + estimatedNewSize;
  const estimatedPercentage = (estimatedTotalSize / EMAIL_STORAGE_LIMITS.MAX_STORAGE_BYTES) * 100;
  
  if (estimatedPercentage > 100) {
    return {
      canSave: false,
      reason: `Not enough storage space. You're using ${storageInfo.storageUsedMB.toFixed(2)} MB of ${storageInfo.storageLimitMB} MB. Please delete some emails to free up space.`,
    };
  }
  
  return { canSave: true };
}

/**
 * Save emails for a specific user with storage validation
 * @param userId - The user ID
 * @param emails - Array of emails to save
 * @throws Error if storage limit would be exceeded
 */
export function saveEmails(
  userId: number | string | null | undefined,
  emails: SavedEmailData[]
): void {
  try {
    // Validate before saving
    if (emails.length > EMAIL_STORAGE_LIMITS.MAX_EMAILS) {
      throw new Error(`Cannot save more than ${EMAIL_STORAGE_LIMITS.MAX_EMAILS} emails.`);
    }
    
    const newSize = calculateEmailsSize(emails);
    if (newSize > EMAIL_STORAGE_LIMITS.MAX_STORAGE_BYTES) {
      throw new Error(`Email data exceeds storage limit of ${EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB} MB.`);
    }
    
    const key = getSavedEmailsKey(userId);
    localStorage.setItem(key, JSON.stringify(emails));
  } catch (error) {
    console.error('Error saving emails:', error);
    throw error;
  }
}

/**
 * Save a single email (adds or updates)
 * @param userId - The user ID
 * @param emailData - The email data to save
 * @returns The saved email data with updated timestamps
 */
export function saveEmail(
  userId: number | string | null | undefined,
  emailData: Omit<SavedEmailData, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }
): SavedEmailData {
  const emails = getSavedEmails(userId);
  const existingIndex = emails.findIndex(e => e.id === emailData.id);
  
  const now = new Date().toISOString();
  const savedEmail: SavedEmailData = {
    ...emailData,
    createdAt: emailData.createdAt || now,
    updatedAt: now,
  };
  
  if (existingIndex >= 0) {
    // Update existing email (preserve createdAt)
    savedEmail.createdAt = emails[existingIndex].createdAt;
    emails[existingIndex] = savedEmail;
  } else {
    // Add new email
    emails.push(savedEmail);
  }
  
  saveEmails(userId, emails);
  return savedEmail;
}

/**
 * Delete an email by ID
 * @param userId - The user ID
 * @param emailId - The email ID to delete
 */
export function deleteEmail(
  userId: number | string | null | undefined,
  emailId: string
): void {
  const emails = getSavedEmails(userId);
  const filtered = emails.filter(e => e.id !== emailId);
  saveEmails(userId, filtered);
}

/**
 * Get a single email by ID
 * @param userId - The user ID
 * @param emailId - The email ID
 * @returns The email data or null if not found
 */
export function getSavedEmail(
  userId: number | string | null | undefined,
  emailId: string
): SavedEmailData | null {
  const emails = getSavedEmails(userId);
  return emails.find(e => e.id === emailId) || null;
}

/**
 * Check if an email name already exists for a user
 * @param userId - The user ID
 * @param name - The email name to check
 * @param excludeEmailId - Optional email ID to exclude from check (for updates)
 * @returns true if name exists, false otherwise
 */
export function emailNameExists(
  userId: number | string | null | undefined,
  name: string,
  excludeEmailId?: string
): boolean {
  const emails = getSavedEmails(userId);
  const trimmedName = name.trim().toLowerCase();
  return emails.some(
    email => 
      email.id !== excludeEmailId && 
      email.name.trim().toLowerCase() === trimmedName
  );
}

/**
 * Get a unique email name by appending a number if needed
 * @param userId - The user ID
 * @param baseName - The base name to make unique
 * @returns A unique email name
 */
export function getUniqueEmailName(
  userId: number | string | null | undefined,
  baseName: string
): string {
  const emails = getSavedEmails(userId);
  const trimmedBase = baseName.trim();
  let uniqueName = trimmedBase;
  let counter = 1;
  
  while (emails.some(email => email.name.trim().toLowerCase() === uniqueName.toLowerCase())) {
    uniqueName = `${trimmedBase} (${counter})`;
    counter++;
  }
  
  return uniqueName;
}

/**
 * Convert DynamicTemplate to SavedEmailData
 * @param template - The DynamicTemplate to convert
 * @param name - Custom name for the saved email
 * @param description - Optional description
 * @returns SavedEmailData
 */
export function convertTemplateToSavedEmail(
  template: DynamicTemplate,
  name: string,
  description?: string
): Omit<SavedEmailData, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    templateId: template.meta.templateId,
    templateName: template.meta.templateName,
    html: template.html,
    elements: template.elements,
    sections: template.sections,
    description,
    themeCssMode: template.meta.themeCssMode ?? 'adaptive',
  };
}

/**
 * Build a full SavedEmailData from the editor when the stored row cannot be loaded
 * (e.g. Supabase-only row, save failed before local sync, or storage key mismatch).
 * `overrideName` is used for rename flows so the payload matches the new name.
 */
export function buildSavedEmailFromEditorState(
  template: DynamicTemplate,
  savedEmailId: string,
  html: string,
  overrideName?: string
): SavedEmailData {
  const partial = convertTemplateToSavedEmail(
    { ...template, html },
    overrideName ?? template.meta.templateName,
    template.meta.description
  );
  const now = new Date().toISOString();
  return {
    id: savedEmailId,
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert SavedEmailData back to DynamicTemplate
 * @param savedEmail - The saved email data
 * @returns DynamicTemplate
 */
export function convertSavedEmailToTemplate(savedEmail: SavedEmailData): DynamicTemplate {
  return {
    meta: {
      templateId: savedEmail.templateId,
      templateName: savedEmail.templateName,
      category: 'saved',
      version: '1.0',
      createdAt: savedEmail.createdAt,
      updatedAt: savedEmail.updatedAt,
      description: savedEmail.description,
      themeCssMode: savedEmail.themeCssMode ?? 'adaptive',
    },
    html: savedEmail.html,
    elements: savedEmail.elements,
    sections: savedEmail.sections,
  };
}

/**
 * Duplicate an existing saved email
 * @param userId - The user ID
 * @param emailId - The email ID to duplicate
 * @returns The duplicated email data
 * @throws Error if email not found or storage limit would be exceeded
 */
export function duplicateEmail(
  userId: number | string | null | undefined,
  emailId: string
): SavedEmailData {
  const originalEmail = getSavedEmail(userId, emailId);
  if (!originalEmail) {
    throw new Error('Email not found');
  }

  // Check if user can save another email
  const canSave = canSaveEmail(userId);
  if (!canSave.canSave) {
    throw new Error(canSave.reason || 'Cannot duplicate email. Storage limit reached.');
  }

  // Generate new ID
  const newId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate unique name
  const baseName = originalEmail.name.trim();
  let newName = `${baseName} (Copy)`;
  let counter = 1;
  while (emailNameExists(userId, newName)) {
    newName = `${baseName} (Copy ${counter})`;
    counter++;
  }

  // Create duplicate with new ID and name
  const duplicatedEmail: Omit<SavedEmailData, 'createdAt' | 'updatedAt'> = {
    id: newId,
    name: newName,
    templateId: originalEmail.templateId,
    templateName: originalEmail.templateName,
    html: originalEmail.html,
    elements: JSON.parse(JSON.stringify(originalEmail.elements)), // Deep copy
    sections: originalEmail.sections ? JSON.parse(JSON.stringify(originalEmail.sections)) : undefined, // Deep copy
    description: originalEmail.description,
    themeCssMode: originalEmail.themeCssMode ?? 'adaptive',
  };

  // Save the duplicate
  return saveEmail(userId, duplicatedEmail);
}

/**
 * Format bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

