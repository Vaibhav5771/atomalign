import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "MANAGER")
    .order("full_name", { ascending: true });
    
  console.log("Error:", error);
  console.log("Managers fetched:", data?.length ?? 0);
  if (data?.length > 0) {
    console.log("First manager:", data[0].email, data[0].role);
  } else {
    console.log("Raw profile count:", (await supabase.from("profiles").select("*")).data?.length);
  }
}

check();
