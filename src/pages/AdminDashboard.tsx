import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RestaurantSwitcher } from '../components/RestaurantSwitcher';
import { Plus, Settings, LogOut, Package, Eye, Clock, ArrowRight, Utensils } from 'lucide-react';
import type { MenuItem } from '../types/database';

export function AdminDashboard() {
  const { selectedRestaurant, signOut } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedRestaurant) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', selectedRestaurant.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems(data || []);
        setLoading(false);
      });
  }, [selectedRestaurant]);

  const handleNewItem = async () => {
    if (!selectedRestaurant) return;
    const { data } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: selectedRestaurant.id,
        name: 'New Item',
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        ui_config: [],
      })
      .select()
      .single();
    if (data) {
      navigate(`/admin/item/${data.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100">
      <header className="bg-white/70 backdrop-blur-2xl border-b border-neutral-200/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20 gap-4">
            <div className="flex items-center gap-4">
              <RestaurantSwitcher />
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/admin/settings')}
                disabled={!selectedRestaurant}
                className="p-2.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-2xl transition-colors disabled:opacity-40"
              >
                <Settings className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={signOut}
                className="p-2.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-2xl transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {selectedRestaurant ? (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Menu Items</h1>
                <p className="text-neutral-500 mt-1">{items.length} items in {selectedRestaurant.name}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNewItem}
                className="px-5 py-3 bg-neutral-900 text-white rounded-2xl font-semibold text-sm flex items-center gap-2.5 hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/20"
              >
                <Plus className="w-4 h-4" />
                New Item
              </motion.button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">No items yet</h3>
                <p className="text-neutral-500 text-sm mb-6">Create your first menu item to get started</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNewItem}
                  className="px-5 py-3 bg-neutral-900 text-white rounded-2xl font-semibold text-sm inline-flex items-center gap-2.5 hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Item
                </motion.button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -4 }}
                    onClick={() => navigate(`/admin/item/${item.id}`)}
                    className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg shadow-neutral-200/50 border border-neutral-100 overflow-hidden cursor-pointer group"
                  >
                    <div className="aspect-square bg-gradient-to-br from-neutral-100 to-neutral-200 relative overflow-hidden">
                      {item.target_image_url ? (
                        <img
                          src={item.target_image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="w-10 h-10 text-neutral-300" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        {item.model_url && (
                          <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            3D
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-neutral-900 text-lg">{item.name}</h3>
                      {item.price && (
                        <p className="text-neutral-500 text-sm mt-1">{item.price}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-neutral-400">
                        {item.target_image_url && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> AR Ready
                          </span>
                        )}
                        {item.min_wait_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.min_wait_time}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <a
                          href={`/ar/${selectedRestaurant.slug}/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View AR
                          <ArrowRight className="w-3 h-3" />
                        </a>
                        <span className="text-xs font-medium text-neutral-400 group-hover:text-neutral-900 transition-colors">
                          Edit →
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Utensils className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">No restaurant selected</h3>
            <p className="text-neutral-500 text-sm">Create a restaurant using the switcher above to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
