import { useState } from "react";
import { Info, FolderOpen, Plus, Pencil, Trash2, X } from "lucide-react";
import { useAppSelector } from "../app/hooks";
import { useGetCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation } from "../services/categoryApi";
import type { Category } from "../types/category";

const inputClass =
  "w-full rounded border border-slate-500 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

type AppInfoTab = "category";

export default function AppInfo() {
  const { user } = useAppSelector((state) => state.auth);
  const canManageCategories = user?.role === "admin" || user?.role === "team_manager";

  const [activeTab, setActiveTab] = useState<AppInfoTab>("category");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useGetCategoriesQuery(undefined, { skip: false });
  const [createCategory, { isLoading: createLoading }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: updateLoading }] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: deleteLoading }] = useDeleteCategoryMutation();

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    try {
      await createCategory({ name }).unwrap();
      setCategoryName("");
    } catch {
      // Error from RTK Query
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    const name = categoryName.trim();
    if (!name) return;
    try {
      await updateCategory({ _id: editingCategory._id, name }).unwrap();
      setEditingCategory(null);
      setCategoryName("");
    } catch {
      // Error from RTK Query
    }
  };

  const startEdit = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setCategoryName("");
  };

  const confirmDelete = async () => {
    if (!deleteConfirmCategory) return;
    try {
      await deleteCategory(deleteConfirmCategory._id).unwrap();
      setDeleteConfirmCategory(null);
    } catch {
      // Error from RTK Query
    }
  };

  const tabs = [
    { id: "category" as const, label: "Category", icon: FolderOpen },
  ];

  return (
    <div className="w-full min-w-0 px-3 py-4 sm:px-4">
      <h1 className="text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
        <Info className="h-7 w-7 text-slate-400" />
        App Info
      </h1>

      <div className="flex gap-2 mb-6 border-b border-slate-600">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === id ? "bg-slate-700/80 text-white border-b-2 border-blue-500 -mb-px" : "text-slate-400 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "category" && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/60 backdrop-blur p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-white">Categories</h2>
            {canManageCategories && !editingCategory && (
              <form onSubmit={handleCreateCategory} className="flex gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className={inputClass}
                  placeholder="New category name"
                />
                <button
                  type="submit"
                  disabled={createLoading || !categoryName.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>
            )}
            {canManageCategories && editingCategory && (
              <form onSubmit={handleUpdateCategory} className="flex gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className={inputClass}
                  placeholder="Category name"
                />
                <button type="submit" disabled={updateLoading || !categoryName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 shrink-0">
                  Save
                </button>
                <button type="button" onClick={cancelEdit} className="p-2 rounded-lg border border-slate-500 text-slate-300 hover:bg-slate-700 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>

          {isLoading ? (
            <p className="text-slate-400 text-sm">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-slate-400 text-sm">{canManageCategories ? "No categories yet. Add one above." : "No categories yet."}</p>
          ) : (
            <div className="rounded-lg border border-slate-600 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50 border-b border-slate-600">
                    <th className="text-left text-slate-300 font-medium px-4 py-3">Name</th>
                    {canManageCategories && (
                      <th className="text-right text-slate-300 font-medium px-4 py-3">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat._id} className="border-b border-slate-600/80 last:border-b-0 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-white font-medium">{cat.name}</td>
                      {canManageCategories && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(cat)}
                              disabled={!!editingCategory}
                              className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-50"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmCategory(cat)}
                              disabled={!!editingCategory}
                              className="p-2 rounded-lg text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {deleteConfirmCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete category?</h3>
            <p className="text-slate-300 text-sm mb-6">
              Are you sure you want to delete &quot;{deleteConfirmCategory.name}&quot;?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmCategory(null)}
                className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
