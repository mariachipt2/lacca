import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl.includes('sua-url-do-supabase')) {
  console.warn('Supabase URL não está configurada corretamente no arquivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
