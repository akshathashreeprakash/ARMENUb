import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Building2, Palette, Check } from 'lucide-react';

export function SettingsPage() {
  const { selectedRestaurant: restaurant, refreshRestaurants } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [accentColor, setAccentColor] = useState('#171717');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setSlug(restaurant.slug);
      setAccentColor((restaurant.theme as { accentColor?: string })?.accentColor || '#171717');
    }
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);

    const { error } = await supabase
      .from('restaurants')
      .update({
        name,
        slug,
        theme: { accentColor },
      })
      .eq('id', restaurant.id);

    if (!error) {
      await refreshRestaurants();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100">
      <header className="bg-white/70 backdrop-blur-2xl border-b border-neutral-200/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2.5 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </motion.button>
            <motion.button
              onClick={handleSave}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-5 py-2.5 rounded-2xl font-semibold text-sm flex items-center gap-2.5 transition-all shadow-lg ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-neutral-900/25'
              }`}
              style={{ backgroundColor: saved ? undefined : (restaurant?.theme as { accentColor?: string })?.accentColor || '#171717' }}
            >
              {saving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-neutral-700" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-900 text-lg">Restaurant Details</h2>
                <p className="text-sm text-neutral-500">Update your restaurant information</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Restaurant Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-neutral-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all font-mono text-sm text-neutral-900"
              />
              <p className="text-xs text-neutral-400">
                Your AR URLs: /ar/{slug}/item-id
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl flex items-center justify-center">
                <Palette className="w-6 h-6 text-neutral-700" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-900 text-lg">Theme</h2>
                <p className="text-sm text-neutral-500">Customize your brand appearance</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-neutral-700">Accent Color</label>
              <div className="flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="relative"
                >
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-16 h-16 rounded-2xl cursor-pointer border-2 border-neutral-200 bg-transparent"
                  />
                </motion.div>
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all font-mono text-sm text-neutral-900"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100">
              <p className="text-sm font-semibold text-neutral-700 mb-4">Preview</p>
              <div className="flex flex-wrap gap-3">
                <motion.button
                  style={{ backgroundColor: accentColor }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 text-white rounded-2xl font-semibold text-sm shadow-lg"
                >
                  Order Now
                </motion.button>
                <motion.button
                  style={{ backgroundColor: accentColor }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-3 text-white rounded-xl shadow-lg"
                >
                  <Building2 className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
