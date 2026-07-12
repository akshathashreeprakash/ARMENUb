import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { ChevronDown, Plus, Building2, Check, X } from 'lucide-react';
import type { Restaurant } from '../types/database';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function RestaurantSwitcher() {
  const { restaurants, selectedRestaurant, selectRestaurant, createRestaurant } = useAuth();
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNew(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNameChange = (value: string) => {
    setNewName(value);
    if (!slugEdited) {
      setNewSlug(slugify(value));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    setError('');

    const { error: createError } = await createRestaurant(newName.trim(), newSlug.trim());
    if (createError) {
      setError(createError);
      setCreating(false);
      return;
    }

    setNewName('');
    setNewSlug('');
    setSlugEdited(false);
    setError('');
    setCreating(false);
    setShowNew(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          setShowNew(false);
        }}
        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-300 transition-all min-w-[200px]"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-xl flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-neutral-700" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs text-neutral-400 font-medium">Restaurant</p>
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {selectedRestaurant?.name || 'Select...'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl shadow-neutral-300/40 border border-neutral-100 overflow-hidden z-50"
          >
            {!showNew ? (
              <>
                <div className="max-h-64 overflow-y-auto">
                  {restaurants.length === 0 && (
                    <div className="p-6 text-center">
                      <p className="text-sm text-neutral-500">No restaurants yet.</p>
                      <p className="text-xs text-neutral-400 mt-1">Create one to get started.</p>
                    </div>
                  )}
                  {restaurants.map((r: Restaurant) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        selectRestaurant(r);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left ${
                        selectedRestaurant?.id === r.id ? 'bg-neutral-50' : ''
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-neutral-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{r.name}</p>
                        <p className="text-xs text-neutral-400 font-mono truncate">/{r.slug}</p>
                      </div>
                      {selectedRestaurant?.id === r.id && (
                        <Check className="w-4 h-4 text-neutral-900 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowNew(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-neutral-100 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-neutral-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">New Restaurant</span>
                </button>
              </>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">New Restaurant</h3>
                  <button
                    onClick={() => setShowNew(false)}
                    className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="My Restaurant"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Slug</label>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => {
                      setNewSlug(slugify(e.target.value));
                      setSlugEdited(true);
                    }}
                    placeholder="my-restaurant"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
                  />
                  <p className="text-xs text-neutral-400">URL: /ar/{newSlug || '...'}/item-id</p>
                </div>
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim() || !newSlug.trim()}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Restaurant'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
