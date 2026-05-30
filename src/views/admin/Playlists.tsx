import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from '../../lib/supabase';
import { ListMusic, Plus, Trash2, GripVertical, Clock, Film, Image as ImageIcon, Type, Save, Edit2, Music } from 'lucide-react';

export default function Playlists() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [contents, setContents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [playlistToEdit, setPlaylistToEdit] = useState<any>(null);
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    items: [] as any[],
    bgAudioUrl: ''
  });

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'playlists'), (snapshot) => {
      setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubC = onSnapshot(collection(db, 'contents'), (snapshot) => {
      setContents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubP(); unsubC(); };
  }, []);

  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylist.items.length === 0) return alert('Agrega al menos un contenido');
    
    if (playlistToEdit) {
      await updateDoc(doc(db, 'playlists', playlistToEdit.id), {
        name: newPlaylist.name,
        items: newPlaylist.items,
        bgAudioUrl: newPlaylist.bgAudioUrl || ''
      });
    } else {
      await addDoc(collection(db, 'playlists'), {
        name: newPlaylist.name,
        items: newPlaylist.items,
        bgAudioUrl: newPlaylist.bgAudioUrl || '',
        createdAt: new Date().toISOString()
      });
    }
    setIsModalOpen(false);
    setPlaylistToEdit(null);
    setNewPlaylist({ name: '', items: [], bgAudioUrl: '' });
  };

  const openEdit = (playlist: any) => {
    setPlaylistToEdit(playlist);
    setNewPlaylist({
      name: playlist.name,
      items: playlist.items,
      bgAudioUrl: playlist.bgAudioUrl || ''
    });
    setIsModalOpen(true);
  };

  const addItem = (contentId: string) => {
    const content = contents.find(c => c.id === contentId);
    if (!content) return;
    setNewPlaylist(prev => ({
      ...prev,
      items: [...prev.items, { contentId, name: content.name, type: content.type, duration: content.duration }]
    }));
  };

  const removeItem = (index: number) => {
    setNewPlaylist(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const deletePlaylist = async (id: string) => {
    if (window.confirm('¿Eliminar esta playlist?')) {
      await deleteDoc(doc(db, 'playlists', id));
    }
  };

  return (
    <div className="space-y-8 animate-in zoom-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Playlists</h2>
          <p className="text-slate-400">Diseñando secuencias de marca.</p>
        </div>
        <button 
          onClick={() => {
            setPlaylistToEdit(null);
            setNewPlaylist({ name: '', items: [], bgAudioUrl: '' });
            setIsModalOpen(true);
          }}
          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20"
        >
          <Plus className="w-5 h-5" />
          Nueva Playlist
        </button>
      </header>

      {/* Playlists List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="bento-card overflow-hidden flex flex-col group">
            <div className="p-6 bg-slate-900 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">{playlist.name}</h3>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{playlist.items.length} clips • {playlist.items.reduce((acc: number, item: any) => acc + item.duration, 0)}s DURACIÓN</p>
                {playlist.bgAudioUrl && (
                  <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1 font-sans">
                    <Music className="w-3 h-3 text-rose-500" /> Música en fondo activa
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => openEdit(playlist)}
                  className="p-2 text-slate-600 hover:text-emerald-500 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => deletePlaylist(playlist.id)}
                  className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 flex-1 space-y-2 overflow-y-auto max-h-48 custom-scrollbar">
              {playlist.items.map((item: any, idx: number) => (
                <div key={idx} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
                  <div className="text-slate-600">
                    {item.type === 'video' ? <Film className="w-3.5 h-3.5" /> : item.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                  </div>
                  <span className="flex-1 text-[11px] font-medium text-slate-300 line-clamp-1">{item.name}</span>
                  <span className="font-mono text-[9px] text-slate-600">{item.duration}s</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {playlists.length === 0 && (
          <div className="col-span-full py-32 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-[2.5rem] bg-slate-900/10 italic">
            No hay playlists disponibles. Crea una secuencia.
          </div>
        )}
      </div>

      {/* Modal Builder */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-white/5 italic">
            <div className="p-8 flex items-center justify-between border-b border-white/5">
              <h3 className="text-2xl font-bold text-white tracking-tight">{playlistToEdit ? 'Esculpir Secuencia' : 'Secuenciador Leonisa'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white transition-all">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left: Library */}
              <div className="w-full md:w-5/12 p-8 overflow-y-auto border-r border-white/5 bg-slate-950/30 custom-scrollbar">
                <div className="mb-6 flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] italic">Media Nodes</h4>
                  <span className="text-[10px] font-mono text-slate-600 uppercase">Available: {contents.filter(c => c.type !== 'audio').length}</span>
                </div>
                <div className="space-y-2">
                  {contents.filter(c => c.type !== 'audio').map(content => (
                    <button
                      key={content.id}
                      onClick={() => addItem(content.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-slate-900/50 hover:bg-slate-800 hover:border-rose-500/30 transition-all text-left group italic"
                    >
                      <div className="p-2.5 bg-slate-800 rounded-xl group-hover:bg-rose-600 transition-colors text-slate-400 group-hover:text-white">
                        {content.type === 'video' ? <Film className="w-4 h-4" /> : content.type === 'image' ? <ImageIcon className="w-4 h-4" /> : <Type className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <p className="text-sm font-bold text-white">{content.name}</p>
                        <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">{content.duration} SEC CYCLE</p>
                      </div>
                      <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Sequence */}
              <div className="w-full md:w-7/12 p-8 flex flex-col bg-slate-900">
                <div className="mb-6">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest italic">Playlist ID / Name</label>
                  <input 
                    required
                    className="w-full bg-slate-950/50 text-white px-6 py-4 rounded-2xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-sans text-lg tracking-tight"
                    value={newPlaylist.name}
                    onChange={e => setNewPlaylist({...newPlaylist, name: e.target.value})}
                    placeholder="Ej: Lanzamiento Tienda Sur"
                  />
                </div>

                <div className="mb-8">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest italic flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-rose-500" />
                    Música de Fondo en Bucle (Opcional)
                  </label>
                  <select 
                    className="w-full bg-slate-950/50 text-white px-5 py-3.5 rounded-2xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-rose-500/55 transition-all font-sans text-xs tracking-wide text-slate-300"
                    value={newPlaylist.bgAudioUrl}
                    onChange={e => setNewPlaylist({...newPlaylist, bgAudioUrl: e.target.value})}
                  >
                    <option value="" className="bg-slate-900">🔇 Sin Música de Fondo (Loops mudos)</option>
                    {contents.filter(c => c.type === 'audio').map(c => (
                      <option key={c.id} value={c.url} className="bg-slate-900">
                        🎵 {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] italic">Active Sequence</h4>
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-white/5">
                      <Clock className="w-3 h-3 text-rose-500" />
                      <span className="text-[10px] font-mono text-slate-300">
                        {newPlaylist.items.reduce((acc, i) => acc + i.duration, 0)}s TOTAL RUNTIME
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {newPlaylist.items.length === 0 && (
                      <div className="py-24 text-center text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-950/20 italic">
                        Selecciona media para construir el loop
                      </div>
                    )}
                    {newPlaylist.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-white/5 group luxury-border group transition-all hover:bg-slate-900">
                        <GripVertical className="w-4 h-4 text-slate-700" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white line-clamp-1">{item.name}</p>
                          <p className="text-[8px] uppercase font-bold text-slate-600 tracking-widest">{item.type} node</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-mono text-slate-500">{item.duration}s</span>
                          <button onClick={() => removeItem(idx)} className="text-slate-700 hover:text-rose-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSavePlaylist}
                  disabled={!newPlaylist.name || newPlaylist.items.length === 0}
                  className={`
                    mt-8 w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all uppercase tracking-[0.1em] text-xs
                    ${!newPlaylist.name || newPlaylist.items.length === 0 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5' 
                      : 'bg-rose-600 text-white hover:translate-y-[-2px] shadow-xl shadow-rose-900/20'}
                  `}
                >
                  <Save className="w-5 h-5" />
                  {playlistToEdit ? 'Guardar Cambios' : 'Publicar Secuencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
