import React from 'react';
import { auth, signInWithEmailAndPassword } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Monitor, Lock, User, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('123');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tanto el usuario como la contraseña.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, username, password);
      navigate('/');
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Error al iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100 relative overflow-hidden">
      {/* Background radial soft lights */}
      <div className="atmosphere absolute w-full h-full opacity-40" />
      
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 relative z-10">
        
        {/* Leonisa Red Logo Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-rose-600 p-4 rounded-3xl shadow-xl shadow-rose-900/40 transform rotate-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-bold text-3xl text-rose-600">
              L
            </div>
          </div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-1 text-center text-white">
          Leonisa <span className="text-rose-500">Connect</span>
        </h1>
        <p className="text-slate-400 mb-8 text-[11px] text-center tracking-widest uppercase font-bold">
          Signage Management System
        </p>
        
        {/* Error notification banner */}
        {error && (
          <div className="bg-rose-500/10 text-rose-400 p-4 rounded-2xl mb-6 text-xs font-mono border border-rose-500/20 flex items-start gap-3 transition-all">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">
              Usuario o Correo
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: admin"
                disabled={loading}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-slate-600 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 pl-11 pr-12 py-3.5 rounded-2xl text-white placeholder-slate-600 outline-none transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 hover:text-slate-300 outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Quick Access Helper Box */}
          <div className="bg-slate-950/50 border border-slate-800/60 p-3 rounded-2xl flex items-center gap-3 text-xs text-slate-400">
            <Info className="w-5 h-5 text-rose-500 shrink-0" />
            <p>
              Prueba con: <span className="text-white font-semibold font-mono">admin</span> y contraseña <span className="text-white font-semibold font-mono">123</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-white text-slate-950 disabled:bg-slate-800 disabled:text-slate-600 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:translate-y-[-1px] hover:bg-rose-50 transition-all shadow-xl active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
        
        {/* Decorative footer */}
        <div className="mt-10 flex items-center justify-center gap-4 opacity-30">
          <div className="h-[1px] w-8 bg-slate-500"></div>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">
            Est. 2026 Admin Portal
          </p>
          <div className="h-[1px] w-8 bg-slate-500"></div>
        </div>
      </div>
    </div>
  );
}
