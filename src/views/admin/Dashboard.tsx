import React, { useEffect, useState } from 'react';
import { db, collection, onSnapshot, query, limit, orderBy } from '../../lib/supabase';
import { 
  Monitor, 
  Store, 
  CheckCircle2, 
  XCircle, 
  Activity,
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalScreens: 0,
    onlineScreens: 0,
    totalStores: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubScreens = onSnapshot(collection(db, 'screens'), 
      (snapshot) => {
        const screens = snapshot.docs.map(doc => doc.data());
        setStats(prev => ({
          ...prev,
          totalScreens: screens.length,
          onlineScreens: screens.filter(s => s.status === 'online').length
        }));
      },
      (error) => console.error("Screens Snapshot Error:", error)
    );

    const unsubStores = onSnapshot(collection(db, 'stores'), 
      (snapshot) => {
        setStats(prev => ({ ...prev, totalStores: snapshot.docs.length }));
      },
      (error) => console.error("Stores Snapshot Error:", error)
    );

    const logsQuery = query(collection(db, 'logs'), orderBy('playedAt', 'desc'), limit(10));
    const unsubLogs = onSnapshot(logsQuery, 
      (snapshot) => {
        setRecentLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Logs Snapshot Error:", error);
        setLoading(false); // Ensure loading stops even on error
      }
    );

    return () => {
      unsubScreens();
      unsubStores();
      unsubLogs();
    };
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white font-sans">System Overview</h2>
          <p className="text-slate-400 text-sm">Central management for {stats.totalScreens} regional store screens</p>
        </div>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-sm font-medium hover:bg-slate-800 transition-colors">
            + Quick Upload
          </button>
          <button className="px-4 py-2 bg-rose-600 rounded-lg text-sm font-medium shadow-lg shadow-rose-900/20 hover:bg-rose-500 transition-all">
            Sync All Displays
          </button>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Main Monitor / Stats */}
        <div className="col-span-12 lg:col-span-8 bento-card p-8 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Red de Distribución</h3>
              <p className="text-slate-400 text-xs">Monitoreo de tráfico y sincronización en tiempo real</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold rounded-full border border-emerald-500/20 tracking-widest animate-pulse-subtle">
              ● Live Status
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatPill label="Total Screens" value={stats.totalScreens} sub="Active Hardware" />
            <StatPill label="Online Now" value={stats.onlineScreens} sub="+2% from leak" color="text-emerald-400" />
            <StatPill label="Store Hubs" value={stats.totalStores} sub="Regional Clusters" />
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
            <div className="text-slate-700 flex flex-col items-center">
               <Activity className="w-12 h-12 mb-4 opacity-20" />
               <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Network Topology Active</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4">
               <div className="h-1 bg-rose-600/40 flex-1 rounded-full overflow-hidden">
                 <div className="h-full bg-rose-600 w-[68%] transition-all duration-1000 shadow-[0_0_10px_#e11d48]"></div>
               </div>
               <span className="text-[10px] font-mono text-slate-500">68% SYNC</span>
            </div>
          </div>
        </div>

        {/* Display Network List */}
        <div className="col-span-12 lg:col-span-4 bento-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Network Nodes</h3>
            <span className="text-[10px] bg-rose-600/10 text-rose-400 px-2 py-0.5 rounded font-bold uppercase">{stats.onlineScreens} online</span>
          </div>
          
          <div className="space-y-3 overflow-y-auto max-h-[320px] pr-2 custom-scrollbar">
            {recentLogs.map((log, idx) => (
              <div key={idx} className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/30 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
                  <span className="text-sm font-medium text-slate-200">Node_{log.screenId?.slice(0,4)}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono uppercase">Reproduciendo</span>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div className="py-12 text-center text-slate-600 italic text-sm">
                Iniciando monitoreo...
              </div>
            )}
          </div>
          
          <button className="mt-auto pt-6 text-rose-500 text-xs font-bold uppercase tracking-widest hover:text-rose-400 transition-colors flex items-center gap-2">
            Ver Mapa de Nodos <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Loop Performance */}
        <div className="col-span-12 md:col-span-6 lg:col-span-5 bento-card p-6 flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Loop Fidelity</h3>
          <div className="flex items-end gap-2 h-32 mb-6">
             {[40, 65, 85, 55, 95, 70, 80, 45, 90].map((h, i) => (
               <div 
                 key={i} 
                 className="flex-1 bg-slate-800 rounded-t-lg transition-all duration-500 hover:bg-rose-500 group relative"
                 style={{ height: `${h}%` }}
               >
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-600 text-[8px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                   {h}%
                 </div>
               </div>
             ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-auto">
            <div>
              <div className="text-2xl font-bold font-mono tracking-tighter">99.8%</div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Uptime Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tracking-tighter text-rose-500">1.2M</div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Plays / Month</div>
            </div>
          </div>
        </div>

        {/* Featured Campaign / Schedule */}
        <div className="col-span-12 md:col-span-6 lg:col-span-7 bg-rose-600 rounded-3xl p-8 relative overflow-hidden flex flex-col group cursor-pointer shadow-xl shadow-rose-900/20">
          <div className="z-10 bg-rose-500/20 backdrop-blur-md p-6 rounded-2xl border border-rose-400/30">
            <h3 className="text-rose-100/70 text-[10px] font-bold uppercase tracking-widest mb-1">Próxima Actualización</h3>
            <div className="text-3xl font-bold text-white tracking-tight leading-none mb-2">Switch Ventas Nocturnas</div>
            <div className="text-sm text-rose-200 opacity-80 font-medium">Lunes, 08:00 PM • 14 Pantallas</div>
          </div>
          <button className="mt-8 bg-white text-rose-600 font-bold py-3 rounded-xl z-10 text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all">
            Editar Programación
          </button>
          
          <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-rose-400 rounded-full blur-[80px] opacity-30 group-hover:opacity-50 transition-opacity"></div>
          <Calendar className="absolute -top-4 -right-4 w-32 h-32 text-rose-500 opacity-20 rotate-12" />
        </div>

      </div>
    </div>
  );
}

function StatPill({ label, value, sub, color }: any) {
  return (
    <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <div className={`text-2xl font-mono font-bold tracking-tighter ${color || 'text-white'}`}>
        {value}
      </div>
      <p className="text-[8px] text-slate-600 font-medium uppercase mt-0.5">{sub}</p>
    </div>
  );
}

