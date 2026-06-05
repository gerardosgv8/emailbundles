/**
 * Delete Feature Overview and Feature Demo components from Supabase component_library
 * Run this script to remove unwanted components from the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteComponents() {
  try {
    console.log('🔍 Searching for Feature Overview and Feature Demo components...\n');

    // Find components by name
    const { data: components, error: fetchError } = await supabase
      .from('component_library')
      .select('id, name, category, status')
      .or('name.ilike.%Feature Overview%,name.ilike.%Feature Demo%');

    if (fetchError) {
      console.error('❌ Error fetching components:', fetchError);
      throw fetchError;
    }

    if (!components || components.length === 0) {
      console.log('✅ No Feature Overview or Feature Demo components found in database');
      console.log('Components have already been removed or were never added');
      return;
    }

    console.log(`Found ${components.length} component(s) to delete:\n`);
    components.forEach(comp => {
      console.log(`  - ${comp.name} (ID: ${comp.id}, Category: ${comp.category}, Status: ${comp.status})`);
    });

    console.log('\n🗑️  Deleting components...\n');

    // Delete each component
    for (const component of components) {
      const { error: deleteError } = await supabase
        .from('component_library')
        .delete()
        .eq('id', component.id);

      if (deleteError) {
        console.error(`❌ Error deleting ${component.name}:`, deleteError);
      } else {
        console.log(`✅ Deleted: ${component.name} (${component.id})`);
      }
    }

    console.log('\n✨ Component deletion complete!');
    console.log('Please refresh the Template Composer page to see the changes.');

  } catch (error) {
    console.error('❌ Error in deleteComponents:', error);
    process.exit(1);
  }
}

// Run the script
deleteComponents();
