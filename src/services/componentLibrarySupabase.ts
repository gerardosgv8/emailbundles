/**
 * Supabase Service for Component Library
 * Replaces localStorage with Supabase database
 * Table: component_library
 */

import { supabase } from './supabase-client';
import { ComponentData, ComponentElement } from './componentLibraryService';

// Supabase table interface
interface ComponentLibraryRow {
  id: string;
  name: string;
  html: string;
  elements: ComponentElement[]; // JSONB stored as array
  category: 'navigation' | 'footer' | 'cta' | 'ecommerce' | 'content' | 'layout';
  status: 'draft' | 'live';
  created_at: string;
  updated_at: string;
}

/**
 * Convert Supabase row to ComponentData format
 */
function rowToComponent(row: ComponentLibraryRow): ComponentData {
  return {
    id: row.id,
    name: row.name,
    html: row.html,
    elements: row.elements || [],
    status: row.status,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert ComponentData to Supabase row format
 */
function componentToRow(component: ComponentData): Omit<ComponentLibraryRow, 'created_at' | 'updated_at'> {
  return {
    id: component.id,
    name: component.name,
    html: component.html,
    elements: component.elements || [],
    category: (component.category as ComponentLibraryRow['category']) || 'layout',
    status: component.status || 'live',
  };
}

/**
 * Get all components from Supabase
 */
export async function getAllComponentsSupabase(): Promise<ComponentData[]> {
  try {
    const { data, error } = await supabase
      .from('component_library')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching components:', error);
      throw error;
    }

    return (data || []).map(rowToComponent);
  } catch (error) {
    console.error('Error in getAllComponentsSupabase:', error);
    throw error;
  }
}

/**
 * Get components by category from Supabase
 */
export async function getComponentsByCategorySupabase(
  category: ComponentLibraryRow['category']
): Promise<ComponentData[]> {
  try {
    const { data, error } = await supabase
      .from('component_library')
      .select('*')
      .eq('category', category)
      .eq('status', 'live')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching components by category:', error);
      throw error;
    }

    return (data || []).map(rowToComponent);
  } catch (error) {
    console.error('Error in getComponentsByCategorySupabase:', error);
    throw error;
  }
}

/**
 * Get a single component by ID from Supabase
 */
export async function getComponentByIdSupabase(componentId: string): Promise<ComponentData | null> {
  try {
    const { data, error } = await supabase
      .from('component_library')
      .select('*')
      .eq('id', componentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Error fetching component:', error);
      throw error;
    }

    return rowToComponent(data);
  } catch (error) {
    console.error('Error in getComponentByIdSupabase:', error);
    throw error;
  }
}

/**
 * Get a component by name from Supabase
 */
export async function getComponentByNameSupabase(name: string): Promise<ComponentData | null> {
  try {
    const { data, error } = await supabase
      .from('component_library')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Error fetching component by name:', error);
      throw error;
    }

    return rowToComponent(data);
  } catch (error) {
    console.error('Error in getComponentByNameSupabase:', error);
    throw error;
  }
}

/**
 * Save/Update a component in Supabase
 */
export async function saveComponentSupabase(component: ComponentData): Promise<ComponentLibraryRow> {
  try {
    const row = componentToRow(component);
    
    const { data, error } = await supabase
      .from('component_library')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving component:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in saveComponentSupabase:', error);
    throw error;
  }
}

/**
 * Save multiple components to Supabase
 */
export async function saveComponentsSupabase(components: ComponentData[]): Promise<ComponentLibraryRow[]> {
  try {
    const rows = components.map(componentToRow);

    const { data, error } = await supabase
      .from('component_library')
      .upsert(rows, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Error saving components:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in saveComponentsSupabase:', error);
    throw error;
  }
}

/**
 * Delete a component from Supabase
 */
export async function deleteComponentSupabase(componentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('component_library')
      .delete()
      .eq('id', componentId);

    if (error) {
      console.error('Error deleting component:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteComponentSupabase:', error);
    throw error;
  }
}

/**
 * Update component status in Supabase
 */
export async function updateComponentStatusSupabase(
  componentId: string,
  status: 'draft' | 'live'
): Promise<ComponentLibraryRow> {
  try {
    const { data, error } = await supabase
      .from('component_library')
      .update({ 
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', componentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating component status:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateComponentStatusSupabase:', error);
    throw error;
  }
}

/**
 * Search components by name in Supabase
 */
export async function searchComponentsSupabase(query: string): Promise<ComponentData[]> {
  try {
    const { data, error } = await supabase
      .from('component_library')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching components:', error);
      throw error;
    }

    return (data || []).map(rowToComponent);
  } catch (error) {
    console.error('Error in searchComponentsSupabase:', error);
    throw error;
  }
}

