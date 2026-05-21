/**
 * api.js — Supabase data layer
 * Full CRUD for files table
 */

async function loadItems() {
  const { data, error } = await supabase
    .from('files')
    .select('*');

  if (error) throw error;
  return data;
}

async function createItem(item) {
  const { data, error } = await supabase
    .from('files')
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateItem(id, updates) {
  const { data, error } = await supabase
    .from('files')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteItem(id) {
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
