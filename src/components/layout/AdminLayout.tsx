import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Film, 
  ListMusic, 
  Calendar, 
  LogOut,
  Monitor,
  Menu,
  X
} from 'lucide-react';
import { auth, signOut } from '../../lib/supabase';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Tiendas & Pantallas', path: '/stores', icon: Store },
  { name: 'Contenido', path: '/content', icon: Film },
  { name: 'Playlists', path: '/playlists', icon: ListMusic },
  { name: 'Programación', path: '/schedules', icon: Calendar },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 border-r border-slate-800
      `}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center gap-3">
            <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-rose-900/20">L</div>
            <span className="text-xl font-semibold tracking-tight text-white">Leonisa <span className="text-slate-400 font-light italic">Signage</span></span>
          </div>
          
          <nav className="flex-1 mt-6 px-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${location.pathname === item.path 
                    ? 'bg-slate-800 text-rose-400 shadow-sm' 
                    : 'hover:bg-slate-800/50 text-slate-400'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-6 border-t border-slate-800">
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Network Health</span>
                <span className="text-[10px] text-slate-200 font-mono">99%</span>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 w-[99%]"></div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:bg-slate-800 rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header (Mobile Only) */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-rose-600 rounded flex items-center justify-center font-bold text-xs uppercase">L</div>
            <span className="font-bold text-white uppercase tracking-tight">Connect</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
