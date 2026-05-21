const _db = window.supabaseClient;

const API = {
  async createItem(payload) {
    const { data, error } = await _db
      .from('items')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async deleteItem(id) {
    const { error } = await _db
      .from('items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  async updateItem(id, updates) {
    const { data, error } = await _db
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async fetchItems() {
    const { data, error } = await _db
      .from('items')
      .select('*');
    if (error) throw error;
    return data;
  }
};

window.API = API;
