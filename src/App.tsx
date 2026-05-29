/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { auth } from './lib/supabase';
import Login from './views/Login';
import AdminDashboard from './views/admin/Dashboard';
import Stores from './views/admin/Stores';
import ContentLibrary from './views/admin/ContentLibrary';
import Playlists from './views/admin/Playlists';
import Schedules from './views/admin/Schedules';
import Player from './views/Player';
import AdminLayout from './components/layout/AdminLayout';

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-500">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse">Initializing Security...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  
  if (requireAdmin && role !== 'admin') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-500 p-8 text-center">
        <div className="atmosphere absolute w-full h-full opacity-20" />
        <h2 className="text-4xl font-bold mb-4 tracking-tighter text-white relative z-10">Acceso Denegado</h2>
        <p className="text-sm text-rose-400 font-medium mb-2 relative z-10">{user?.email}</p>
        <p className="text-xs opacity-50 font-mono uppercase tracking-widest relative z-10 mb-8">Role: {role || 'No asignado'}</p>
        <button 
          onClick={() => auth.signOut()}
          className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-bold relative z-10 hover:bg-rose-500 transition-all"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/screen/:screenId" element={<Player />} />
          
          <Route path="/" element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="stores" element={<Stores />} />
            <Route path="content" element={<ContentLibrary />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="schedules" element={<Schedules />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

