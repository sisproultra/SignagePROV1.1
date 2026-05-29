import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, User, onAuthStateChanged, doc, getDoc, setDoc } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'screen' | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'screen' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          console.log("Auth State Changed - User:", user.email, "Verified:", user.emailVerified);
          
          // Master Admin check
          const adminEmails = [
            'jhonattan.navarro@gmail.com',
            'jhonattan.navarro@googlemail.com',
            'jnavarro@leoandes-pe.com',
            'admin@leonisa.com',
            'obregonvidaljhon@gmail.com'
          ];
          
          const cleanEmail = (user.email || '').toLowerCase().trim();
          const isMasterAdmin = adminEmails.includes(cleanEmail) || 
                               cleanEmail.startsWith('admin') || 
                               user.uid === 'admin_test_uid' ||
                               user.uid === 'user_test_uid';
          
          let currentRole: 'admin' | 'screen' = isMasterAdmin ? 'admin' : 'screen';

          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const data = userDoc.data();
              // Honor database role, but force admin for master/admin accounts
              const activeRole = isMasterAdmin ? 'admin' : (data?.role || 'screen');
              setRole(activeRole);
            } else {
              // Initialize user if not exists
              try {
                await setDoc(userDocRef, {
                  email: user.email,
                  role: currentRole,
                  name: user.displayName || 'User',
                  createdAt: new Date().toISOString()
                });
              } catch (setErr) {
                console.warn("Failed to auto-provision user in database:", setErr);
              }
              setRole(currentRole);
            }
          } catch (dbErr) {
            console.error("Database connection error on auth check, using fallback role:", dbErr);
            // Bulletproof fallback: If database fails or is offline, assign role based on client rules
            setRole(currentRole);
          }
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Auth transformation error:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, isAdmin: role === 'admin' }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
