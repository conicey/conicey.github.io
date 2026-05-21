/**
 * api.js — Supabase data layer
 * Handles all database operations for files table
 */

// ─────────────────────────────────────────────
// READ (load everything)
// ─────────────────────────────────────────────
async function loadItems() {
  const { data, error } = await supabase
    .from('files')
    .select('*');

  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// CREATE (new file/folder)
// ─────────────────────────────────────────────
async function createItem(item) {
  const { data, error } = await supabase
    .from('files')
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// UPDATE (rename/edit content)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// DELETE (remove file/folder)
// ─────────────────────────────────────────────
async function deleteItem(id) {
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────
// GLOBAL ACCESS (IMPORTANT FIX)
// ─────────────────────────────────────────────
window.API = {
  loadItems,
  createItem,
  updateItem,
  deleteItem
};
