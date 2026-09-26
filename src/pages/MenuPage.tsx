import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search, Package, DollarSign } from 'lucide-react';
import type { MenuItem } from '@/types';
import { formatCurrency, saveMenu } from '@/data/store';

interface MenuPageProps {
  menu: MenuItem[];
  onMenuChanged: () => Promise<void> | void;
}

export default function MenuPage({ menu, onMenuChanged }: MenuPageProps) {
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formIsNewCategory, setFormIsNewCategory] = useState(false);
  const [formNewCategory, setFormNewCategory] = useState('');

  const categories = useMemo(() => {
    const set = new Set(menu.map((m) => m.category));
    return Array.from(set).sort();
  }, [menu]);

  const groupedMenu = useMemo(() => {
    const filtered = menu.filter((m) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
    const groups: Record<string, MenuItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [menu, search]);

  function openAddForm() {
    setEditingItem(null);
    setFormName('');
    setFormPrice('');
    setFormCategory(categories[0] || '');
    setFormIsNewCategory(false);
    setFormNewCategory('');
    setShowForm(true);
  }

  function openEditForm(item: MenuItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(String(item.price));
    setFormCategory(item.category);
    setFormIsNewCategory(false);
    setFormNewCategory('');
    setShowForm(true);
  }

  async function handleSave() {
    const name = formName.trim();
    const price = Number(formPrice);
    if (!name || isNaN(price) || price < 0) return;

    const category = formIsNewCategory ? formNewCategory.trim() : formCategory;
    if (!category) return;

    if (editingItem) {
      const updated = menu.map((m) =>
        m.id === editingItem.id ? { ...m, name, price, category } : m,
      );
      await saveMenu(updated);
    } else {
      const newItem: MenuItem = {
        id: 'item-' + Date.now(),
        name,
        price,
        category,
      };
      await saveMenu([...menu, newItem]);
    }

    setShowForm(false);
    await onMenuChanged();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const updated = menu.filter((m) => m.id !== deleteId);
    await saveMenu(updated);
    setDeleteId(null);
    await onMenuChanged();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {/* Menu list grouped by category */}
      <div className="flex-1 overflow-y-auto pr-1">
        {Object.keys(groupedMenu).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <Package className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">No items found</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedMenu)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                    {category}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({items.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                          <DollarSign className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.name}
                          </p>
                          <p className="text-sm font-bold text-green-600">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                        <button
                          onClick={() => openEditForm(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Item Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Chicken Shawarma"
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  autoFocus
                />
              </div>

              {/* Price */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-8 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Category
                </label>
                {!formIsNewCategory ? (
                  <div className="flex gap-2">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setFormIsNewCategory(true)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                      New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formNewCategory}
                      onChange={(e) => setFormNewCategory(e.target.value)}
                      placeholder="New category name"
                      className="flex-1 rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      autoFocus
                    />
                    <button
                      onClick={() => setFormIsNewCategory(false)}
                      className="rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  !formName.trim() ||
                  isNaN(Number(formPrice)) ||
                  Number(formPrice) < 0 ||
                  (!formIsNewCategory && !formCategory) ||
                  (formIsNewCategory && !formNewCategory.trim())
                }
                className="flex-1 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {editingItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Delete Item?</h3>
            </div>
            <p className="mb-5 text-sm text-slate-500">
              This will remove the item from your menu. Past sales records will not
              be affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
