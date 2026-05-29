import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, deleteDoc, doc, updateDoc } from '../../lib/supabase';
import { Calendar, Plus, Trash2, Monitor, ListMusic, CheckCircle2, Clock, Edit2 } from 'lucide-react';

export default function Schedules() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [scheduleToEdit, setScheduleToEdit] = useState<any>(null);
  const [newSchedule, setNewSchedule] = useState({
    playlistId: '',
    screenIds: [] as string[],
    name: '',
    active: true
  });

  useEffect(() => {
    const unsubS = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubP = onSnapshot(collection(db, 'playlists'), (snapshot) => {
      setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubC = onSnapshot(collection(db, 'screens'), (snapshot) => {
      setScreens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubS(); unsubP(); unsubC(); };
  }, []);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.playlistId || newSchedule.screenIds.length === 0) return alert('Selecciona playlist y al menos una pantalla');
    
    if (scheduleToEdit) {
      await updateDoc(doc(db, 'schedules', scheduleToEdit.id), {
        ...newSchedule
      });
    } else {
      // Create the schedule
      await addDoc(collection(db, 'schedules'), {
        ...newSchedule,
        createdAt: new Date().toISOString()
      });
    }

    // Update the screens immediately for real-time sync
    for (const screenId of newSchedule.screenIds) {
      await updateDoc(doc(db, 'screens', screenId), {
        currentPlaylistId: newSchedule.playlistId
      });
    }

    setIsModalOpen(false);
    setScheduleToEdit(null);
    setNewSchedule({ playlistId: '', screenIds: [], name: '', active: true });
  };

  const openEdit = (schedule: any) => {
    setScheduleToEdit(schedule);
    setNewSchedule({
      playlistId: schedule.playlistId,
      screenIds: schedule.screenIds,
      name: schedule.name,
      active: schedule.active
    });
    setIsModalOpen(true);
  };

  const deleteSchedule = async (id: string) => {
    if (window.confirm('¿Eliminar esta programación?')) {
      await deleteDoc(doc(db, 'schedules', id));
    }
  };

  const toggleScreen = (id: string) => {
    setNewSchedule(prev => ({
      ...prev,
      screenIds: prev.screenIds.includes(id) 
        ? prev.screenIds.filter(sid => sid !== id) 
        : [...prev.screenIds, id]
    }));
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Programación</h2>
          <p className="text-slate-400">Control maestro de despliegue en red.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20 italic"
        >
          <Plus className="w-5 h-5" />
          Nueva Programación
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {schedules.map((schedule) => {
          const playlist = playlists.find(p => p.id === schedule.playlistId);
          return (
            <div key={schedule.id} className="bento-card p-6 flex flex-col md:flex-row items-center gap-8 group">
              <div className="w-20 h-20 bg-slate-950 rounded-3xl border border-white/5 flex items-center justify-center relative overflow-hidden">
                <Calendar className="w-8 h-8 text-rose-500 relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-tr from-rose-600/20 to-transparent"></div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <h3 className="text-xl font-bold text-white">{schedule.name || 'Programación Activa'}</h3>
                   <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-bold uppercase tracking-widest rounded border border-emerald-500/20">Active</span>
                </div>
                <div className="flex flex-wrap gap-6 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Source Playlist</span>
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      <ListMusic className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-sm">{playlist?.name || '---'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Target Nodes</span>
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      <Monitor className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm">{schedule.screenIds?.length || 0} screens</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Deployment Time</span>
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-mono">{schedule.createdAt ? new Date(schedule.createdAt).toLocaleDateString() : 'REALTIME'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                 <button 
                  onClick={() => openEdit(schedule)}
                  className="p-3 text-slate-700 hover:text-emerald-500 hover:bg-emerald-500/5 rounded-2xl transition-all border border-transparent hover:border-emerald-500/20"
                  title="Editar"
                >
                  <Edit2 className="w-6 h-6" />
                </button>
                 <button 
                  onClick={() => deleteSchedule(schedule.id)}
                  className="p-3 text-slate-700 hover:text-rose-500 hover:bg-rose-500/5 rounded-2xl transition-all border border-transparent hover:border-rose-500/20"
                  title="Eliminar"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            </div>
          );
        })}

        {schedules.length === 0 && (
          <div className="py-32 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-[2.5rem] bg-slate-900/10 italic">
            <Calendar className="w-12 h-12 mx-auto mb-6 opacity-5" />
            <p className="text-sm">Red en modo espera. No hay despliegues activos.</p>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md italic">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-3xl p-10 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-white/5">
            <h3 className="text-2xl font-bold text-white tracking-tight mb-8">{scheduleToEdit ? 'Reprogramar Lanzamiento' : 'Programar Lanzamiento'}</h3>
            
            <form onSubmit={handleCreateSchedule} className="space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <div className="luxury-border p-6 rounded-[2rem] bg-slate-950/30">
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Nombre de la Campaña</label>
                <input 
                  required
                  className="w-full bg-slate-900 text-white px-6 py-4 rounded-2xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all italic font-sans"
                  value={newSchedule.name}
                  onChange={e => setNewSchedule({...newSchedule, name: e.target.value})}
                  placeholder="Ej: Lanzamiento Panties Seamless"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-4 block tracking-widest">1. Playlist Origen</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {playlists.map(p => (
                      <label key={p.id} className={`
                        flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all
                        ${newSchedule.playlistId === p.id ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-900/20' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:border-slate-700'}
                      `}>
                        <input 
                          type="radio" 
                          name="playlist" 
                          className="hidden"
                          checked={newSchedule.playlistId === p.id}
                          onChange={() => setNewSchedule({...newSchedule, playlistId: p.id})}
                        />
                        <ListMusic className={`w-4 h-4 ${newSchedule.playlistId === p.id ? 'text-white' : 'opacity-30'}`} />
                        <span className="text-sm font-bold truncate">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-4 block tracking-widest">2. Nodos Destino</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {screens.map(s => (
                      <label key={s.id} className={`
                        flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all
                        ${newSchedule.screenIds.includes(s.id) ? 'bg-slate-800 text-white border-rose-500/50' : 'bg-slate-950/50 border-white/5 text-slate-500 hover:border-slate-700'}
                      `}>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={newSchedule.screenIds.includes(s.id)}
                          onChange={() => toggleScreen(s.id)}
                        />
                        <Monitor className={`w-4 h-4 ${newSchedule.screenIds.includes(s.id) ? 'text-rose-500' : 'opacity-20'}`} />
                        <div className="flex-1 truncate">
                          <p className="text-sm font-bold text-white">{s.name}</p>
                          <p className="text-[9px] uppercase font-bold opacity-50 tracking-tighter">{s.locationInStore}</p>
                        </div>
                        {newSchedule.screenIds.includes(s.id) && <CheckCircle2 className="w-4 h-4 text-rose-500" />}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-5 font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest text-[10px]"
                >
                  Cerrar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-5 font-bold bg-rose-600 text-white rounded-2xl hover:bg-rose-500 shadow-xl shadow-rose-900/20 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
                >
                  {scheduleToEdit ? 'Guardar Cambios' : 'Confirmar Despliegue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
