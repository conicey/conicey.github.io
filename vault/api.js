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
