import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize auth
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      // Check stored admin auth
      const storedAdmin = localStorage.getItem('techpulse_admin_auth');
      if (storedAdmin) {
        try {
          const parsed = JSON.parse(storedAdmin);
          setUser(parsed.user);
          setProfile(parsed.profile);
          setIsAdmin(true);
        } catch {
          localStorage.removeItem('techpulse_admin_auth');
        }
      }

      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            setUser(session.user);
            await loadProfile(session.user.id);
          }
        } catch (err) {
          console.warn('Supabase auth session error:', err);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            if (!mounted) return;
            if (session?.user) {
              setUser(session.user);
              await loadProfile(session.user.id);
            }
          }
        );

        if (mounted) setLoading(false);
        return () => subscription.unsubscribe();
      }

      if (mounted) setLoading(false);
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
        setIsAdmin(data.role === 'admin');
      }
    } catch (err) {
      console.warn('Profile fetch notice:', err.message);
    }
  }

  // Sign in: username 'admin' and password 'Paras@20'
  const login = async (usernameOrEmail, password) => {
    const cleanUser = usernameOrEmail.trim().toLowerCase();

    // Check requested admin credentials: admin / Paras@20
    if ((cleanUser === 'admin' || cleanUser === 'admin@monkeyonki.com') && password === 'Paras@20') {
      const adminUser = {
        id: 'admin-master-001',
        email: 'admin@techpulse.io',
        user_metadata: { full_name: 'Administrator' },
      };
      const adminProfile = {
        id: 'admin-master-001',
        display_name: 'Admin',
        role: 'admin',
        created_at: new Date().toISOString(),
      };

      localStorage.setItem(
        'techpulse_admin_auth',
        JSON.stringify({ user: adminUser, profile: adminProfile })
      );
      setUser(adminUser);
      setProfile(adminProfile);
      setIsAdmin(true);
      return { user: adminUser };
    }

    // Attempt Supabase Auth if configured and password is not Paras@20
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameOrEmail,
        password,
      });
      if (error) throw error;
      return data;
    }

    throw new Error('Invalid credentials. Please enter correct username and password.');
  };

  // Sign out
  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }
    }
    localStorage.removeItem('techpulse_admin_auth');
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
        login,
        logout,
        isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
