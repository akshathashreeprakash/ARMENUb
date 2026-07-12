import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Restaurant } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurants: Restaurant[];
  selectedRestaurant: Restaurant | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRestaurants: () => Promise<void>;
  selectRestaurant: (restaurant: Restaurant) => void;
  createRestaurant: (name: string, slug: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ar-menu-studio-selected-restaurant';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRestaurants = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true });
    setRestaurants(data || []);

    if (data && data.length > 0) {
      const storedId = localStorage.getItem(STORAGE_KEY);
      const found = storedId ? data.find((r) => r.id === storedId) : null;
      setSelectedRestaurant(found || data[0]);
    } else {
      setSelectedRestaurant(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRestaurants(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRestaurants(session.user.id);
      } else {
        setRestaurants([]);
        setSelectedRestaurant(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRestaurants]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
  };

  const refreshRestaurants = async () => {
    if (user) {
      await fetchRestaurants(user.id);
    }
  };

  const selectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    localStorage.setItem(STORAGE_KEY, restaurant.id);
  };

  const createRestaurant = async (name: string, slug: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        owner_user_id: user.id,
        name,
        slug,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    if (data) {
      await refreshRestaurants();
      selectRestaurant(data as Restaurant);
    }

    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        restaurants,
        selectedRestaurant,
        loading,
        signUp,
        signIn,
        signOut,
        refreshRestaurants,
        selectRestaurant,
        createRestaurant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
