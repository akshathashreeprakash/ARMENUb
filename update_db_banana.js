import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const supabaseUrl = 'https://dzprhxmvffmemmlpkgkb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cHJoeG12ZmZtZW1tbHBrZ2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxODEzOTEsImV4cCI6MjA5ODc1NzM5MX0.u3nLXm2Pyz0tiivHuHLfFtzQGhk79CDxHkB4zFbFqH0';

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function run() {
  console.log('--- Supabase Banana Transform Updater ---');
  const email = await askQuestion('Enter your admin email: ');
  const password = await askQuestion('Enter your password: ');
  rl.close();
  
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error('Login failed:', authError.message);
    return;
  }
  
  console.log('Login successful!');
  
  const itemsToUpdate = [
    { id: 'a0d9453c-3e7d-47a0-a852-2f97657c7f92', name: 'BANANA ', scale: 0.41 },
    { id: '69f317b5-8d3b-4ff0-9d53-899f069e87a0', name: 'Banana', scale: 1.0 }
  ];
  
  for (const item of itemsToUpdate) {
    console.log(`Updating item "${item.name}" (ID: ${item.id})...`);
    const { data, error } = await supabase
      .from('menu_items')
      .update({
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: item.scale
        }
      })
      .eq('id', item.id)
      .select();
      
    if (error) {
      console.error(`Failed to update ${item.name}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Successfully updated ${item.name}!`);
    } else {
      console.log(`Item ${item.name} not updated (check restaurant ownership).`);
    }
  }
}

run();
