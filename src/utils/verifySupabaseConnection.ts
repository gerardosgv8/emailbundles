/**
 * Supabase connection verification utility.
 */

import { supabase } from '../services/supabase-client';

export interface ConnectionStatus {
  connected: boolean;
  message: string;
  details?: {
    tables?: string[];
    errors?: string[];
  };
}

export async function verifySupabaseConnection(): Promise<ConnectionStatus> {
  const errors: string[] = [];
  const tables: string[] = [];

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        connected: false,
        message: 'Supabase environment variables not set',
        details: {
          errors: ['Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'],
        },
      };
    }

    try {
      const { error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        errors.push(`Session error: ${sessionError.message}`);
      }
    } catch (err: any) {
      errors.push(`Session check failed: ${err.message}`);
    }

    try {
      const { error: templatesError } = await supabase
        .from('saved_templates')
        .select('id')
        .limit(1);
      
      if (templatesError) {
        if (!templatesError.message.includes('does not exist') && !templatesError.message.includes('relation')) {
          errors.push(`saved_templates: ${templatesError.message}`);
        }
      } else {
        tables.push('saved_templates');
      }
    } catch (err: any) {
      errors.push(`saved_templates check failed: ${err.message}`);
    }

    try {
      const { error: componentsError } = await supabase
        .from('component_library')
        .select('id')
        .limit(1);
      
      if (componentsError) {
        if (!componentsError.message.includes('does not exist') && !componentsError.message.includes('relation')) {
          errors.push(`component_library: ${componentsError.message}`);
        }
      } else {
        tables.push('component_library');
      }
    } catch (err: any) {
      errors.push(`component_library check failed: ${err.message}`);
    }

    const connected = errors.length === 0;

    return {
      connected,
      message: connected
        ? `Supabase connection verified (${tables.length} tables accessible)`
        : `Supabase connection issues detected (${errors.length} error(s))`,
      details: {
        tables,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Connection verification failed: ${error.message}`,
      details: {
        errors: [error.message],
      },
    };
  }
}

export async function verifySupabaseServices(): Promise<{
  savedTemplates: boolean;
  componentLibrary: boolean;
  storageReport: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let savedTemplates = false;
  let componentLibrary = false;
  let storageReport = false;

  try {
    const { error } = await supabase
      .from('saved_templates')
      .select('id')
      .limit(1);
    
    savedTemplates = !error || error.message.includes('does not exist') === false;
    if (error && !error.message.includes('does not exist')) {
      errors.push(`saved_templates: ${error.message}`);
    }
  } catch (err: any) {
    errors.push(`saved_templates: ${err.message}`);
  }

  try {
    const { error } = await supabase
      .from('component_library')
      .select('id')
      .limit(1);
    
    componentLibrary = !error || error.message.includes('does not exist') === false;
    if (error && !error.message.includes('does not exist')) {
      errors.push(`component_library: ${error.message}`);
    }
  } catch (err: any) {
    errors.push(`component_library: ${err.message}`);
  }

  storageReport = savedTemplates;

  return {
    savedTemplates,
    componentLibrary,
    storageReport,
    errors,
  };
}

