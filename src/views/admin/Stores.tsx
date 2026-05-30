import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, where, doc, updateDoc, deleteDoc } from '../../lib/supabase';
import { Store, Monitor, Plus, MapPin, Trash2, Edit2, AlertCircle, Link as LinkIcon, ListMusic, Check, HelpCircle, ArrowRight, Film, Image as ImageIcon, Play, X, ChevronUp, ChevronDown, Music } from 'lucide-react';

export default function Stores() {
  const [stores, setStores] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [contents, setContents] = useState<any[]>([]);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  
  // Custom Playlist Direct in Screen States
  const [isContentSelectModalOpen, setIsContentSelectModalOpen] = useState(false);
  const [activeScreenForContents, setActiveScreenForContents] = useState<any>(null);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [tempScreenItems, setTempScreenItems] = useState<any[]>([]);
  const [tempBgAudioUrl, setTempBgAudioUrl] = useState<string>('');
  const [modalGalleryTab, setModalGalleryTab] = useState<'visual' | 'audio'>('visual');
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null);

  const [storeToEdit, setStoreToEdit] = useState<any>(null);
  const [screenToEdit, setScreenToEdit] = useState<any>(null);

  const [newStore, setNewStore] = useState({ name: '', city: '', address: '' });
  const [newScreen, setNewScreen] = useState({ name: '', locationInStore: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubScreens = onSnapshot(collection(db, 'screens'), (snapshot) => {
      setScreens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubPlaylists = onSnapshot(collection(db, 'playlists'), (snapshot) => {
      setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubContents = onSnapshot(collection(db, 'contents'), (snapshot) => {
      setContents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubStores();
      unsubScreens();
      unsubPlaylists();
      unsubContents();
    };
  }, []);

  const handleAssignPlaylist = async (screenId: string, playlistId: string) => {
    try {
      await updateDoc(doc(db, 'screens', screenId), {
        currentPlaylistId: playlistId
      });
    } catch (err) {
      console.error('Error assigning playlist:', err);
      alert('Error al asignar playlist');
    }
  };

  const handleSaveScreenContents = async (screenId: string) => {
    try {
      await updateDoc(doc(db, 'screens', screenId), {
        items: tempScreenItems,
        bgAudioUrl: tempBgAudioUrl,
        currentPlaylistId: null // limpia playlist fija para priorizar la lista directa
      });

      setIsContentSelectModalOpen(false);
      setActiveScreenForContents(null);
    } catch (err) {
      console.error('Error saving screen contents:', err);
      alert('Error al guardar la lista de reproducción');
    }
  };

  const handleCopyLink = (screenId: string) => {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const s_url = localStorage.getItem('leonisa_supabase_url');
    const s_key = localStorage.getItem('leonisa_supabase_anon_key');
    let url = `${window.location.origin}/screen/${screenId}_${randomSuffix}`;
    
    if (s_url && s_key) {
      url += `?s_url=${encodeURIComponent(s_url)}&s_key=${encodeURIComponent(s_key)}`;
    }
    
    navigator.clipboard.writeText(url);
    setCopiedId(screenId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storeToEdit) {
      await updateDoc(doc(db, 'stores', storeToEdit.id), newStore);
    } else {
      await addDoc(collection(db, 'stores'), newStore);
    }
    setIsStoreModalOpen(false);
    setStoreToEdit(null);
    setNewStore({ name: '', city: '', address: '' });
  };

  const handleAddScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (screenToEdit) {
      await updateDoc(doc(db, 'screens', screenToEdit.id), newScreen);
    } else {
      if (!selectedStoreId) return;

      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const slugName = newScreen.name
        .toLowerCase()
        .normalize('NFD') // remove accents
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
        .replace(/(^-|-$)+/g, ''); // trim hyphens
      const customId = `scr-${slugName || 'pantalla'}-${randomSuffix}`;

      await addDoc(collection(db, 'screens'), {
        id: customId,
        ...newScreen,
        storeId: selectedStoreId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
        currentPlaylistId: null
      });
    }
    setIsScreenModalOpen(false);
    setScreenToEdit(null);
    setNewScreen({ name: '', locationInStore: '' });
  };

  const deleteStore = async (id: string) => {
    if (window.confirm('¿Eliminar esta tienda? Se perderán las pantallas asociadas.')) {
      await deleteDoc(doc(db, 'stores', id));
    }
  };

  const deleteScreen = async (id: string) => {
    if (window.confirm('¿Eliminar esta pantalla?')) {
      await deleteDoc(doc(db, 'screens', id));
    }
  };

  const openStoreEdit = (store: any) => {
    setStoreToEdit(store);
    setNewStore({ name: store.name, city: store.city, address: store.address });
    setIsStoreModalOpen(true);
  };

  const openScreenEdit = (screen: any) => {
    setScreenToEdit(screen);
    setNewScreen({ name: screen.name, locationInStore: screen.locationInStore });
    setIsScreenModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Tiendas & Pantallas</h2>
          <p className="text-slate-400">Distribución física de dispositivos en la red.</p>
        </div>
        <button 
          onClick={() => setIsStoreModalOpen(true)}
          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20"
        >
          <Plus className="w-5 h-5" />
          Nueva Tienda
        </button>
      </header>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 gap-8">
        {stores.map((store) => (
          <section key={store.id} className="bento-card overflow-hidden">
            <div className="p-6 bg-slate-800/20 flex items-center justify-between border-b border-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-800 rounded-2xl shadow-inner border border-slate-700/50">
                  <Store className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{store.name}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {store.city} — {store.address}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setSelectedStoreId(store.id); setIsScreenModalOpen(true); setScreenToEdit(null); }}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-slate-800 text-white rounded-xl border border-slate-700 hover:bg-slate-700 transition-all flex items-center gap-2"
                >
                  <Monitor className="w-3 h-3" /> Agregar Pantalla
                </button>
                <button 
                  onClick={() => openStoreEdit(store)}
                  className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/5 rounded-xl transition-all"
                  title="Editar Tienda"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => deleteStore(store.id)}
                  className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"
                  title="Eliminar Tienda"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {screens.filter(s => s.storeId === store.id).map(screen => (
                <div key={screen.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/30 hover:border-rose-500/30 transition-all group relative flex flex-col justify-between luxury-border">
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/30">
                          <Monitor className={`w-4 h-4 ${screen.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-white line-clamp-1">{screen.name}</h4>
                          <span className="text-[10px] text-slate-500 font-mono font-medium block leading-none mt-1">{screen.locationInStore || 'Sin ubicación'}</span>
                          {screen.bgAudioUrl && (
                            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 font-sans">
                              <Music className="w-2.5 h-2.5 text-rose-500 animate-pulse" /> Música de fondo activa
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/50">
                          <span className={`w-1.5 h-1.5 rounded-full ${screen.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 font-mono leading-none">
                            {screen.status}
                          </span>
                        </div>
                        {screen.status === 'online' && screen.lastSeen && (
                          <span className="text-[7.5px] font-mono text-slate-600">Sync: {new Date(screen.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>

                    {/* Content Player Loop & Selector */}
                    <div className="mt-4 p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/40 flex flex-col justify-between min-h-[160px]">
                      <div>
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/40">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1">
                            <ListMusic className="w-3 h-3 text-rose-500" />
                            Reproducción en Vivo (Loop)
                          </span>
                          <span className="text-[8px] font-mono text-slate-500 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800 font-bold">
                            {screen.items?.length || 0} clips
                          </span>
                        </div>
                        
                        {/* Auto-play looping media player embedded directly in the card */}
                        <div className="mt-1.5 mb-2">
                          <ScreenMiniPlayer items={screen.items || []} contents={contents} />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewScreenId(screen.id);
                          }}
                          className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider py-2 transition-all text-center cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-current text-emerald-400" /> Ver en Vivo
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveScreenForContents(screen);
                            setTempScreenItems(screen.items ? [...screen.items] : []);
                            setTempBgAudioUrl(screen.bgAudioUrl || '');
                            setIsContentSelectModalOpen(true);
                          }}
                          className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider py-2 transition-all text-center cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-1"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Editar Clips
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer Utilities */}
                  <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-800/30">
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => handleCopyLink(screen.id)}
                        className={`p-1.5 px-2.5 rounded-lg border transition-all flex items-center gap-1 ${
                          copiedId === screen.id 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' 
                            : 'bg-slate-800/40 text-slate-450 border-slate-850 hover:border-emerald-500/30 hover:text-emerald-400'
                        }`}
                        title="Copiar URL del Dispositivo"
                      >
                        {copiedId === screen.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <LinkIcon className="w-3 h-3 text-slate-500 group-hover:text-emerald-450" />
                        )}
                        <span className="text-[8.5px] font-extrabold uppercase font-mono tracking-tighter">Copiar Link</span>
                      </button>
                      <a 
                        href={(() => {
                          const randomSuffix = Math.random().toString(36).substring(2, 7);
                          const s_url = localStorage.getItem('leonisa_supabase_url');
                          const s_key = localStorage.getItem('leonisa_supabase_anon_key');
                          let url = `/screen/${screen.id}_${randomSuffix}`;
                          if (s_url && s_key) {
                            url += `?s_url=${encodeURIComponent(s_url)}&s_key=${encodeURIComponent(s_key)}`;
                          }
                          return url;
                        })()}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-slate-800/40 border border-slate-850 hover:border-rose-500/30 text-slate-450 hover:text-rose-400 p-1.5 px-2 rounded-lg transition-all"
                        title="Abrir Pantalla Completa"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => openScreenEdit(screen)}
                        className="p-1 px-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/40 border border-slate-850/50 rounded-lg transition-all text-[9.5px] uppercase tracking-wider font-extrabold font-mono"
                        title="Editar"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => deleteScreen(screen.id)}
                        className="p-1 px-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800/40 border border-slate-850/50 rounded-lg transition-all text-[9.5px] uppercase tracking-wider font-extrabold font-mono"
                        title="Eliminar"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {screens.filter(s => s.storeId === store.id).length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-600 italic border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/30">
                  <Monitor className="w-10 h-10 mx-auto mb-4 opacity-10" />
                  No hay pantallas activas en esta ubicación.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Store Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-[2rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/5">
            <h3 className="text-2xl font-bold text-white mb-8">{storeToEdit ? 'Editar Ubicación Hub' : 'Nueva Ubicación Hub'}</h3>
            <form onSubmit={handleAddStore} className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Nombre de Tienda</label>
                <input 
                  required
                  className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                  value={newStore.name}
                  onChange={e => setNewStore({...newStore, name: e.target.value})}
                  placeholder="Ej: Leonisa CC El Tesoro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Ciudad</label>
                  <input 
                    required
                    className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-sans"
                    value={newStore.city}
                    onChange={e => setNewStore({...newStore, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Dirección</label>
                  <input 
                    required
                    className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-sans"
                    value={newStore.address}
                    onChange={e => setNewStore({...newStore, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button 
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest text-xs"
                >
                  Cerrar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 font-bold bg-rose-600 text-white rounded-2xl hover:bg-rose-500 shadow-lg shadow-rose-900/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  {storeToEdit ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screen Modal */}
      {isScreenModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-[2rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/5 italic">
            <h3 className="text-2xl font-bold text-white mb-8">{screenToEdit ? 'Editar Pantalla' : 'Nueva Pantalla'}</h3>
            <form onSubmit={handleAddScreen} className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Identificador de Pantalla</label>
                <input 
                  required
                  className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-sans"
                  value={newScreen.name}
                  onChange={e => setNewScreen({...newScreen, name: e.target.value})}
                  placeholder="Ej: Pantalla Vitrina A"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Ubicación en Tienda</label>
                <input 
                  required
                  className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-sans"
                  value={newScreen.locationInStore}
                  onChange={e => setNewScreen({...newScreen, locationInStore: e.target.value})}
                  placeholder="Ej: Segundo piso junto a caja"
                />
              </div>
              <div className="flex gap-4 mt-10">
                <button 
                  type="button"
                  onClick={() => setIsScreenModalOpen(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:text-white transition-all text-xs uppercase tracking-widest"
                >
                  Cerrar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 font-bold bg-rose-600 text-white rounded-2xl hover:bg-rose-500 shadow-lg shadow-rose-900/20 transition-all text-xs uppercase tracking-widest"
                >
                  {screenToEdit ? 'Guardar' : 'Vincular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Selector Modal */}
      {isContentSelectModalOpen && activeScreenForContents && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-white/5 overflow-hidden">
            {/* Modal Header */}
            <div className="p-8 pb-6 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest font-mono">Asignación de Playlist Activa</span>
                <h3 className="text-2xl font-black text-white mt-1">Sintonizar {activeScreenForContents.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Agrega videos de tu galería, ordénalos con las flechas, personaliza su duración en segundos y guarda. Todo se sincroniza en vivo en el televisor.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsContentSelectModalOpen(false);
                  setActiveScreenForContents(null);
                }} 
                className="bg-slate-800 hover:bg-slate-700 p-2.5 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: List of all loaded contents (Span 5) */}
              <div className="lg:col-span-5 space-y-4 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">1. Galería de Contenidos</h4>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    {modalGalleryTab === 'visual' 
                      ? `${contents.filter(c => c.type !== 'audio').length} visuales` 
                      : `${contents.filter(c => c.type === 'audio').length} audios`
                    } disponibles
                  </span>
                </div>

                {/* Categorías de Galería con diseño Leonisa Luxury */}
                <div className="flex bg-slate-950 p-1.5 rounded-[1.25rem] border border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setModalGalleryTab('visual')}
                    className={`flex-grow py-2.5 rounded-xl font-extrabold text-[10px] tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      modalGalleryTab === 'visual'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-955/40 font-mono'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    Videos/Fotos ({contents.filter(c => c.type !== 'audio').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalGalleryTab('audio')}
                    className={`flex-grow py-2.5 rounded-xl font-extrabold text-[10px] tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      modalGalleryTab === 'audio'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-955/40 font-mono'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    Audios/MP3 ({contents.filter(c => c.type === 'audio').length})
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 flex-1 max-h-[46vh] custom-scrollbar">
                  {modalGalleryTab === 'visual' ? (
                    contents.filter(c => c.type !== 'audio').map((content) => {
                      const countInSequence = tempScreenItems.filter(item => item.contentId === content.id).length;
                      return (
                        <div
                          key={content.id}
                          className="bg-slate-850/50 border border-slate-800/60 hover:border-slate-700 p-3.5 rounded-2xl flex gap-3.5 items-center justify-between transition-all"
                        >
                          <div className="flex gap-3.5 items-center min-w-0">
                            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/40 shrink-0 relative">
                              {content.type === 'video' ? (
                                <Film className="w-4 h-4 text-rose-400" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-emerald-400" />
                              )}
                              {countInSequence > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-mono text-[8px] font-black rounded-full w-4.5 h-4.5 flex items-center justify-center border border-slate-900 shadow">
                                  x{countInSequence}
                                </span>
                              )}
                            </div>
                            
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-white truncate">{content.name}</p>
                              <p className="font-mono text-[9px] text-slate-500 mt-0.5 capitalize">{content.type} • {content.duration || 15}s</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setTempScreenItems(prev => [
                                ...prev,
                                {
                                  contentId: content.id,
                                  name: content.name,
                                  type: content.type || 'video',
                                  duration: content.duration || 15,
                                  url: content.url || ''
                                }
                              ]);
                            }}
                            className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white px-3.5 py-2 rounded-xl text-[10px] uppercase font-mono font-black tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-150"
                          >
                            ＋ Agregar
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    contents.filter(c => c.type === 'audio').map((content) => {
                      const isSelected = tempBgAudioUrl === content.url;
                      return (
                        <div
                          key={content.id}
                          className={`p-3.5 rounded-2xl flex gap-3.5 items-center justify-between transition-all border ${
                            isSelected 
                              ? 'bg-rose-950/10 border-rose-500/40 shadow-lg shadow-rose-950/10' 
                              : 'bg-slate-850/50 border-slate-800/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex gap-3.5 items-center min-w-0">
                            <div className={`p-2.5 rounded-xl border shrink-0 transition-all ${
                              isSelected 
                                ? 'bg-rose-900/30 border-rose-500/30 text-rose-400' 
                                : 'bg-slate-950/80 border-slate-800/40 text-slate-400'
                            }`}>
                              <Music className={`w-4 h-4 ${isSelected ? 'animate-pulse text-rose-500' : ''}`} />
                            </div>
                            
                            <div className="min-w-0">
                              <p className={`font-bold text-xs truncate ${isSelected ? 'text-rose-400' : 'text-white'}`}>{content.name}</p>
                              <p className="font-mono text-[8.5px] text-slate-500 mt-0.5">Música de fondo MP3</p>
                            </div>
                          </div>

                          {isSelected ? (
                            <button
                              type="button"
                              onClick={() => setTempBgAudioUrl('')}
                              className="bg-rose-600 text-white px-3.5 py-2 rounded-xl text-[10px] uppercase font-mono font-black tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-150"
                            >
                              🔇 Desactivar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setTempBgAudioUrl(content.url || '')}
                              className="bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 px-3.5 py-2 rounded-xl text-[10px] uppercase font-mono font-black tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95 duration-150"
                            >
                              🔊 Sintonizar
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}

                  {modalGalleryTab === 'visual' && contents.filter(c => c.type !== 'audio').length === 0 && (
                    <div className="text-center py-16 bg-slate-850/30 border border-dashed border-slate-800 rounded-2xl italic text-xs text-slate-500">
                      No hay videos ni fotos en la biblioteca de contenidos.
                    </div>
                  )}

                  {modalGalleryTab === 'audio' && contents.filter(c => c.type === 'audio').length === 0 && (
                    <div className="text-center py-16 bg-slate-850/30 border border-dashed border-slate-800 rounded-2xl italic text-xs text-slate-500">
                      No hay archivos de música de fondo MP3 en la biblioteca. Sube sonidos para asignarlos aquí.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Ordered Sequence Summary (Span 7) */}
              <div className="lg:col-span-7 bg-slate-950/40 border border-slate-800/80 rounded-[1.5rem] p-6 flex flex-col justify-between min-h-0">
                <div className="flex flex-col min-h-0">
                  <div className="border-b border-slate-800/60 pb-3 mb-4 flex justify-between items-center">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-400 font-mono">2. Secuencia de Reproducción</h4>
                      <p className="text-[8px] text-slate-500 font-mono mt-0.5">ORDEN DE REPRODUCCIÓN EN PANTALLA</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/10">
                      {tempScreenItems.length} CLIPS EN COLA
                    </span>
                  </div>

                  {/* Selector de Música de Fondo directa ultra-compacto y elegante */}
                  <div className="mb-4 bg-slate-900/60 border border-slate-800/40 p-3.5 rounded-2xl flex items-center justify-between gap-4 transition-all hover:bg-slate-900 hover:border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                        <Music className={`w-3.5 h-3.5 ${tempBgAudioUrl ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider font-sans block">
                          Música de Fondo
                        </label>
                        {tempBgAudioUrl ? (
                          <span className="text-[10.5px] text-rose-400 font-bold block truncate max-w-[140px] md:max-w-[200px]">
                            {contents.find(c => c.url === tempBgAudioUrl)?.name || 'Audio Sintonizado'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono italic block">Silenciado</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="w-48 shrink-0">
                      <select 
                        className="w-full bg-slate-950 text-slate-300 px-3 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-1 focus:ring-rose-500/55 transition-all text-[11px] font-mono tracking-wide"
                        value={tempBgAudioUrl}
                        onChange={e => setTempBgAudioUrl(e.target.value)}
                      >
                        <option value="">🔇 Desactivar música</option>
                        {contents.filter(c => c.type === 'audio').map(c => (
                          <option key={c.id} value={c.url}>
                            🎵 {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 overflow-y-auto pr-1 max-h-[42vh] custom-scrollbar flex-1">
                    {tempScreenItems.map((item, idx) => {
                      return (
                        <div key={`${idx}-${item.contentId}`} className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-4 transition-all hover:bg-slate-900/80">
                          {/* Order & Title */}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[9px] font-black font-mono text-rose-400 bg-rose-950/40 border border-rose-500/20 px-2 py-0.5 rounded-lg shrink-0">
                              {idx + 1}º
                            </span>
                            <div className="min-w-0">
                              <span className="truncate text-slate-200 font-bold block text-xs">{item.name}</span>
                              <span className="text-[8.5px] font-mono text-slate-500 capitalize leading-none">{item.type}</span>
                            </div>
                          </div>

                          {/* Controls (Duration & Reorder) */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Duration Input */}
                            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg">
                              <input 
                                type="number"
                                min="1"
                                value={item.duration || 15}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  const updated = [...tempScreenItems];
                                  updated[idx] = { ...updated[idx], duration: val };
                                  setTempScreenItems(updated);
                                }}
                                className="w-9 bg-transparent focus:outline-none text-white text-right text-[10px] font-bold font-mono"
                              />
                              <span className="text-[8.5px] font-mono text-slate-500 select-none">seg</span>
                            </div>

                            {/* Move Up */}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                if (idx === 0) return;
                                const updated = [...tempScreenItems];
                                const temp = updated[idx];
                                updated[idx] = updated[idx - 1];
                                updated[idx - 1] = temp;
                                setTempScreenItems(updated);
                              }}
                              className={`p-1.5 rounded bg-slate-850 transition-all ${idx === 0 ? 'opacity-30 cursor-not-allowed text-slate-600' : 'hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer'}`}
                              title="Subir en la lista"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              disabled={idx === tempScreenItems.length - 1}
                              onClick={() => {
                                if (idx === tempScreenItems.length - 1) return;
                                const updated = [...tempScreenItems];
                                const temp = updated[idx];
                                updated[idx] = updated[idx + 1];
                                updated[idx + 1] = temp;
                                setTempScreenItems(updated);
                              }}
                              className={`p-1.5 rounded bg-slate-850 transition-all ${idx === tempScreenItems.length - 1 ? 'opacity-30 cursor-not-allowed text-slate-600' : 'hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer'}`}
                              title="Bajar en la lista"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Instance */}
                            <button
                              type="button"
                              onClick={() => {
                                setTempScreenItems(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 rounded bg-slate-850 hover:bg-rose-950/40 text-slate-400 hover:text-rose-450 transition-all cursor-pointer"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {tempScreenItems.length === 0 && (
                      <div className="text-center py-20 text-[10px] text-slate-600 italic">
                        No hay clips en la cola. Agrega videos usando el botón ＋ Agregar de la galería izquierda.
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirm Actions */}
                <div className="pt-4 border-t border-slate-800 mt-4 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-mono font-semibold text-slate-500 px-1">
                    <span>DURACIÓN TOTAL DEL LOOP:</span>
                    <span className="text-emerald-400 font-black text-xs">
                      {tempScreenItems.reduce((acc, item) => acc + (Number(item.duration) || 0), 0)}s
                    </span>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsContentSelectModalOpen(false);
                        setActiveScreenForContents(null);
                      }}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[10px] tracking-widest uppercase rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveScreenContents(activeScreenForContents.id)}
                      className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-rose-950/20 active:scale-95 cursor-pointer"
                    >
                      Guardar Secuencia
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal Overlay */}
      {previewScreenId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-5xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-white/5 overflow-hidden">
            {/* Modal Header */}
            <div className="p-8 pb-5 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sintonizado en Vivo • Transmisión Online
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  {screens.find(s => s.id === previewScreenId)?.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Simulador de TV en tiempo real. Cualquier cambio en la lista de reproducción o en los videos se reflejará aquí instantáneamente.
                </p>
              </div>
              
              <button 
                type="button"
                onClick={() => setPreviewScreenId(null)} 
                className="bg-slate-800 hover:bg-slate-700 p-2.5 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Live Player Frame */}
            <div className="p-8 bg-slate-950/50 flex-1 flex flex-col justify-center items-center">
              <div className="w-full max-w-4xl">
                <ScreenLivePreviewPlayer 
                  screen={screens.find(s => s.id === previewScreenId)} 
                  contents={contents} 
                />
              </div>
            </div>

            {/* Footer controls */}
            <div className="p-6 bg-slate-900 border-t border-slate-800/60 flex justify-between items-center whitespace-nowrap">
              <div className="text-xs text-slate-500 font-mono hidden sm:block">
                Presiona los controles para simular loops manuales.
              </div>
              <button
                type="button"
                onClick={() => setPreviewScreenId(null)}
                className="bg-slate-850 hover:bg-slate-800 text-white font-extrabold text-[10px] tracking-widest uppercase px-6 py-3 rounded-xl transition-all cursor-pointer"
              >
                Cerrar Simulador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenLivePreviewPlayer({ screen, contents }: { screen: any; contents: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = React.useRef<any>(null);

  const playlistItems = React.useMemo(() => {
    if (!screen?.items || screen.items.length === 0) return [];
    return screen.items.map((item: any) => {
      const contentDetail = contents.find(c => c.id === item.contentId);
      return contentDetail ? { ...item, ...contentDetail } : null;
    }).filter(Boolean);
  }, [screen?.items, contents]);

  const prevPlaylistIdsStrRef = React.useRef<string>('');
  useEffect(() => {
    if (playlistItems.length > 0 && currentIndex >= playlistItems.length) {
      setCurrentIndex(0);
    }

    const currentPlaylistIdsStr = playlistItems.map((item: any) => item.contentId).join(',');
    if (prevPlaylistIdsStrRef.current !== currentPlaylistIdsStr) {
      prevPlaylistIdsStrRef.current = currentPlaylistIdsStr;
      setCurrentIndex(0);
    }
  }, [playlistItems, currentIndex]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (playlistItems.length <= 1) {
      return;
    }

    const currentItem = playlistItems[currentIndex];
    if (!currentItem) return;

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
    }, (currentItem.duration || 15) * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, playlistItems]);

  if (playlistItems.length === 0) {
    return (
      <div className="w-full aspect-video bg-slate-950 flex flex-col items-center justify-center p-8 text-center border border-slate-800 rounded-3xl">
        <Monitor className="w-16 h-16 text-slate-705 mb-4 opacity-30 animate-pulse" />
        <h4 className="text-white text-lg font-bold">Pantalla sin Contenidos</h4>
        <p className="text-slate-500 text-xs mt-1">Usa el botón Editar para añadir videos a esta pantalla.</p>
      </div>
    );
  }

  const currentItem = playlistItems[currentIndex];
  if (!currentItem) return null;

  const directUrl = getDirectUrl(currentItem.url);
  const ytId = getYouTubeId(currentItem.url);

  return (
    <div className="w-full aspect-video rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden relative group shadow-2xl">
      {/* Top overlay navigation indicators */}
      <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2.5">
        <span className="text-[10px] font-black text-rose-500 font-mono">
          CLIP {currentIndex + 1} DE {playlistItems.length}
        </span>
        <div className="h-3 w-[1px] bg-slate-800" />
        <span className="text-[10px] font-bold text-white tracking-tight truncate max-w-sm">
          {currentItem.name}
        </span>
        <span className="text-[8px] uppercase bg-slate-955 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono">
          {currentItem.type}
        </span>
      </div>

      <div className="absolute top-4 right-4 z-20 bg-rose-600 px-3 py-1 text-[10px] font-black uppercase text-white tracking-wider font-mono shadow-md rounded-lg">
        {currentItem.duration}s
      </div>

      {currentItem.type === 'video' ? (
        ytId ? (
          <iframe
            title={currentItem.name}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&playsinline=1&showinfo=0&rel=0`}
            className="w-full h-full border-0 pointer-events-none scale-105"
            allow="autoplay; encrypted-media"
          />
        ) : (
          <video
            key={directUrl}
            src={directUrl}
            className="w-full h-full object-contain bg-slate-950"
            autoPlay
            muted
            playsInline
            controls={false}
            loop={playlistItems.length === 1}
            onEnded={() => {
              if (playlistItems.length > 1) {
                if (timerRef.current) clearTimeout(timerRef.current);
                setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
              }
            }}
          />
        )
      ) : currentItem.type === 'image' ? (
        <div
          className="w-full h-full bg-center bg-contain bg-slate-950 bg-no-repeat transition-all duration-700"
          style={{ backgroundImage: `url(${directUrl})` }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-12 text-center">
          <p className="text-white text-2xl font-black max-w-2xl leading-tight">{currentItem.name}</p>
          <p className="text-slate-500 font-mono text-sm max-w-xl truncate mt-4">{currentItem.url}</p>
        </div>
      )}

      {/* Playback sequence timeline dots indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-full border border-slate-850">
        {playlistItems.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
              idx === currentIndex ? 'bg-rose-500 scale-110 shadow-[0_0_6px_#f43f5e]' : 'bg-slate-700 hover:bg-slate-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M7 7h10v10"/><path d="M7 17 17 7"/>
    </svg>
  );
}

// Helpers to extract YouTube ID and convert Cloudflare Stream and Google Drive links
const getYouTubeId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  if (url.trim().length === 11 && !url.includes('/') && !url.includes('.')) {
    return url.trim();
  }
  return null;
};

const getDirectUrl = (url: string) => {
  if (!url) return url;
  const clMatch = url.match(/(?:cloudflarestream\.com|cloudflare:)?\/?([a-f0-9]{32})/i);
  if (clMatch && clMatch[1]) {
    const videoId = clMatch[1];
    const cachedCreds = localStorage.getItem('leonisa_cloudflare_creds');
    let customerCode = 'demo-customer';
    if (cachedCreds) {
      try {
        const parsed = JSON.parse(cachedCreds);
        if (parsed.subdomain) customerCode = parsed.subdomain;
      } catch (e) {}
    }
    return `https://customer-${customerCode}.cloudflarestream.com/${videoId}/downloads/default.mp4`;
  }
  const match = url.match(/\/(?:d|file\/d|open\?id=)([a-zA-Z0-9_-]{25,})[^\w-]?/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?id=${match[1]}&export=media`;
  }
  return url;
};

function ScreenMiniPlayer({ items, contents }: { items: any[]; contents: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = React.useRef<any>(null);

  // Clear timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const validItems = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.map(item => {
      const fullContent = contents.find(c => c.id === item.contentId);
      return fullContent ? { ...item, ...fullContent } : null;
    }).filter(Boolean) as any[];
  }, [items, contents]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (validItems.length <= 1) {
      setCurrentIndex(0);
      return;
    }

    const currentItem = validItems[currentIndex];
    const duration = currentItem?.duration || 10;
    
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % validItems.length);
    }, duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, validItems]);

  if (validItems.length === 0) {
    return (
      <div className="w-full aspect-video rounded-xl bg-slate-950 flex flex-col items-center justify-center border border-slate-800 text-slate-600 relative overflow-hidden">
        <Monitor className="w-7 h-7 opacity-20 mb-1.5" />
        <span className="text-[9px] font-mono tracking-wider opacity-60 italic">[ Sin videos asignados ]</span>
      </div>
    );
  }

  const currentItem = validItems[currentIndex];
  if (!currentItem) return null;

  const directUrl = getDirectUrl(currentItem.url);
  const ytId = getYouTubeId(currentItem.url);

  return (
    <div className="w-full aspect-video rounded-xl bg-slate-955 border border-slate-800 overflow-hidden relative group shadow-inner">
      {/* Title overlay with Index/total */}
      <div className="absolute top-1.5 left-1.5 z-10 bg-slate-950/80 backdrop-blur-sm border border-slate-800/40 px-2 py-0.5 rounded-md flex items-center gap-1.5">
        <span className="text-[8px] font-black text-rose-500 font-mono">
          {currentIndex + 1}/{validItems.length}
        </span>
        <span className="text-[8px] font-bold text-slate-300 truncate max-w-[130px] font-sans">
          {currentItem.name || "Contenido"}
        </span>
      </div>

      <div className="absolute top-1.5 right-1.5 z-10 bg-rose-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest font-mono">
        {currentItem.duration}s
      </div>

      {currentItem.type === 'video' ? (
        ytId ? (
          <iframe
            title={currentItem.name}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&playsinline=1&showinfo=0&rel=0`}
            className="w-full h-full border-0 pointer-events-none scale-105"
            allow="autoplay; encrypted-media"
          />
        ) : (
          <video
            key={directUrl}
            src={directUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            controls={false}
            loop={validItems.length === 1}
            onEnded={() => {
              if (validItems.length > 1) {
                if (timerRef.current) clearTimeout(timerRef.current);
                setCurrentIndex((prev) => (prev + 1) % validItems.length);
              }
            }}
          />
        )
      ) : currentItem.type === 'image' ? (
        <div
          className="w-full h-full bg-center bg-cover bg-no-repeat transition-all duration-700"
          style={{ backgroundImage: `url(${directUrl})` }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
          <p className="text-white text-[10px] font-bold leading-tight truncate w-full">{currentItem.name}</p>
          <p className="text-slate-500 font-mono text-[8px] truncate w-full mt-1">{currentItem.url}</p>
        </div>
      )}
    </div>
  );
}
