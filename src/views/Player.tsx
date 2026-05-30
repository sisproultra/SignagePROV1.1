import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, getDoc, addDoc, collection, query, where, getDocs, updateSupabaseConfig } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, MonitorOff } from 'lucide-react';

interface SignageMediaVideoProps {
  url: string;
  name: string;
  isActive: boolean;
  loop: boolean;
  onEnded: () => void;
  onPlayStarted: () => void;
}

/**
 * Custom player component that preloads the video and controls playback strictly
 * when the item becomes active or inactive. Keeps current position at 0 when waiting.
 */
function SignageMediaVideo({ url, name, isActive, loop, onEnded, onPlayStarted }: SignageMediaVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      console.log(`[SignagePlayer] Reproduciendo video activo: "${name}"`);
      video.muted = true;
      video.playsInline = true;
      video.play()
        .then(() => {
          onPlayStarted();
        })
        .catch(err => {
          console.warn("[SignagePlayer] Autoplay bloqueado o reproducción interrumpida:", err);
        });
    } else {
      console.log(`[SignagePlayer] Carga / Pausa en fondo de video: "${name}"`);
      video.pause();
      // Retrasar el rebobinado a 0 para evitar que la transición de desvanecimiento (crossfade)
      // muestre de repente el primer fotograma en lugar de quedarse congelado en el final/actual.
      const timeout = setTimeout(() => {
        if (!isActive && videoRef.current) {
          videoRef.current.currentTime = 0;
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isActive, url, name, onPlayStarted]);

  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full h-full object-contain bg-slate-950"
      muted
      playsInline
      controls={false}
      preload="auto"
      crossOrigin="anonymous"
      loop={loop}
      onEnded={onEnded}
      onPlaying={onPlayStarted}
      onError={(e) => {
        const videoElement = e.currentTarget;
        console.error('[SignagePlayer] Video error details:', {
          code: videoElement.error?.code,
          message: videoElement.error?.message,
          src: url
        });
        // Si hay una falla de codificación, gatillamos onEnded para no colgar la pantalla
        setTimeout(onEnded, 2000);
      }}
    />
  );
}

export default function Player() {
  const { screenId } = useParams();
  const [screen, setScreen] = useState<any>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [rawPlaylist, setRawPlaylist] = useState<any>(null);
  const [contentsMap, setContentsMap] = useState<Record<string, any>>({});
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const timerRef = useRef<any>(null);

  // Escuchar el evento 'supabase-ready' para re-iniciar la conexión si 
  // Supabase se configura dinámicamente después del primer render
  useEffect(() => {
    const handleSupabaseReady = () => {
      console.log('[Player] Supabase inicializado dinámicamente. Re-cargando datos...');
      setLoading(true);
      setError(null);
      setScreen(null);
      setRawPlaylist(null);
      setContentsMap({});
      // Forzar re-ejecución del efecto principal incrementando un contador
      setRetryCount(prev => prev + 1);
    };
    
    window.addEventListener('supabase-ready', handleSupabaseReady);
    return () => window.removeEventListener('supabase-ready', handleSupabaseReady);
  }, []);

  // 1. ESCUCHAR DE MANERA CONSTANTE Y EN TIEMPO REAL LA COLECCIÓN DE CONTENIDOS ('contents')
  useEffect(() => {
    console.log("[Player] Conectando escuchador en tiempo real para contents...");
    const unsub = onSnapshot(collection(db, 'contents'), (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        map[doc.id] = { id: doc.id, ...doc.data() };
      });
      console.log("[Player] Mapa de contenidos actualizado. Items cargados:", Object.keys(map).length);
      setContentsMap(map);
    }, (err) => {
      console.error("[Player] Error al escuchar colección contents en vivo:", err);
    });
    return () => unsub();
  }, [retryCount]);

  // 2. ESCUCHAR DE MANERA CONSTANTE Y EN TIEMPO REAL LA PANTALLA ('screens')
  useEffect(() => {
    const cleanId = screenId?.trim();
    if (!cleanId) return;

    console.log('[Player] Conectando canal de escucha en vivo para Nodo:', cleanId);
    setLoading(true);

    let unsubScreen: () => void = () => {};
    let statusInterval: any = null;

    const startRealtimeScreenStream = async () => {
      try {
        // Parse and automatically persist/synchronize Supabase connection from the URL parameters
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const sUrl = urlParams.get('s_url');
          const sKey = urlParams.get('s_key');
          if (sUrl && sKey) {
            console.log('[Player] Sincronización de base de datos remota detectada. Vinculando...');
            updateSupabaseConfig(sUrl, sKey);
            
            // Clean URL query parameters to avoid showing active keys in the address bar
            const cleanUrl = window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
          }
        } catch (urlErr) {
          console.error('[Player] Error al parsear credenciales de auto-configuración:', urlErr);
        }

        const docRef = doc(db, 'screens', cleanId);
        const docSnap = await getDoc(docRef);
        let targetId = cleanId;

        if (!docSnap.exists()) {
          console.log('[Player] ID directo no encontrado. Buscando coincidencias insensibles o alternativas...');
          const screensSnap = await getDocs(collection(db, 'screens'));
          const matchingDoc = screensSnap.docs.find(d => {
            const dbId = d.id.toLowerCase();
            const urlId = cleanId.toLowerCase();
            
            // Check direct case-insensitive match
            if (dbId === urlId) return true;
            
            // Check if URL ends with a random suffix we appended (e.g. screen_1_abc12 where DB is screen_1)
            if (urlId.startsWith(dbId + '_') && urlId.length > dbId.length + 1) {
              return true;
            }
            
            // Reverse prefix check just in case
            if (dbId.startsWith(urlId + '_') && dbId.length > urlId.length + 1) {
              return true;
            }
            
            return false;
          });

          if (matchingDoc) {
            targetId = matchingDoc.id;
            setResolvedId(targetId);
            // No longer doing replaceState to keep the dynamic unique suffix in the URL bar
          } else {
            setError(`Error de Vinculación: El Nodo con ID [${cleanId}] no existe.`);
            setLoading(false);
            return;
          }
        } else {
          setResolvedId(cleanId);
        }

        // Suscribirse a los cambios de la pantalla para reaccionar a re-ordenamientos o cambios de playlist
        unsubScreen = onSnapshot(doc(db, 'screens', targetId), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setScreen({ id: snapshot.id, ...data });
            setError(null);

            // Determinar origen de contenidos
            if (data.items && data.items.length > 0) {
              console.log("[Player] Modo: Items agregados directamente a la pantalla.", data.items);
              setActivePlaylistId(null);
              setRawPlaylist(null);
            } else if (data.currentPlaylistId) {
              console.log("[Player] Modo: Playlist asignada:", data.currentPlaylistId);
              setActivePlaylistId(data.currentPlaylistId);
            } else {
              // Buscar programaciones agendadas
              try {
                console.log("[Player] Modo: Evaluando programación horaria...");
                const schedulesSnap = await getDocs(collection(db, 'schedules'));
                const now = new Date();
                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const currentDay = days[now.getDay()];
                const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

                const schedules = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
                const activeForNode = schedules.find(s => {
                  const isTargetNode = s.screenIds && s.screenIds.includes(targetId);
                  const matchesDay = !s.days || s.days.includes(currentDay);
                  const matchesTime = !s.startTime || !s.endTime || (currentTime >= s.startTime && currentTime <= s.endTime);
                  return isTargetNode && matchesDay && matchesTime;
                });

                if (activeForNode) {
                  console.log("[Player] Programación horaria activa encontrada:", activeForNode.name);
                  setActivePlaylistId(activeForNode.playlistId);
                } else {
                  console.warn("[Player] Sin programaciones válidas para este horario.");
                  setActivePlaylistId(null);
                  setRawPlaylist(null);
                }
              } catch (scheduleErr) {
                console.error("[Player] Error al calcular horarios agendados:", scheduleErr);
              }
            }
          } else {
            setError(`Error: Este Nodo de Pantalla [${targetId}] ha sido desvinculado o eliminado.`);
          }
          setLoading(false);
        }, (err) => {
          console.error("[Player] Error de suscripción onSnapshot para pantallas:", err);
          setError(`Fallo de Enlace de Red: ${err.message}`);
          setLoading(false);
        });

        // Loop de latido (Heatbeat) para mantener la pantalla reportada como ONLINE
        const updateStatus = async () => {
          try {
            await updateDoc(doc(db, 'screens', targetId), {
              status: 'online',
              lastSeen: new Date().toISOString()
            });
          } catch (e) {
            console.error("[Player] Error actualizando estado de latido:", e);
          }
        };

        updateStatus();
        statusInterval = setInterval(updateStatus, 30000);

      } catch (err) {
        console.error("[Player] Error de inicialización en stream:", err);
        setError("Fallo crítico de sincronización de datos.");
        setLoading(false);
      }
    };

    startRealtimeScreenStream();

    return () => {
      unsubScreen();
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [screenId, retryCount]);

  // 3. ESCUCHAR DE MANERA CONSTANTE Y EN TIEMPO REAL LA PLAYLIST ACTIVA
  useEffect(() => {
    if (!activePlaylistId) {
      setRawPlaylist(null);
      return;
    }

    console.log("[Player] Conectando canal de escucha en vivo para la playlist:", activePlaylistId);
    const unsub = onSnapshot(doc(db, 'playlists', activePlaylistId), (snapshot) => {
      if (snapshot.exists()) {
        setRawPlaylist({ id: snapshot.id, ...snapshot.data() });
      } else {
        console.warn("[Player] La Playlist asignada ha dejado de existir en la base de datos.");
        setRawPlaylist(null);
      }
    }, (err) => {
      console.error("[Player] Error de suscripción onSnapshot para playlist:", err);
    });

    return () => unsub();
  }, [activePlaylistId, retryCount]);

  // 4. GENERACIÓN EN TIEMPO REAL DE LOS ITEMS DE REPRODUCCIÓN (Mapeados desde contentsMap)
  const playlistItems = useMemo(() => {
    // Escenario A: Contenido asignado directamente en el panel de la Tienda
    if (screen?.items && screen.items.length > 0) {
      return screen.items.map((item: any, idx: number) => {
        const contentDetail = contentsMap[item.contentId] || {};
        return {
          id: `direct-${idx}-${item.contentId}`,
          contentId: item.contentId,
          name: item.name || contentDetail.name || "Video Directo",
          type: contentDetail.type || item.type || "video",
          url: contentDetail.url || item.url || "",
          duration: Number(item.duration || contentDetail.duration || 15)
        };
      }).filter((item: any) => item.url);
    }

    // Escenario B: Playlist asignada
    if (rawPlaylist?.items && rawPlaylist.items.length > 0) {
      return rawPlaylist.items.map((item: any, idx: number) => {
        const contentDetail = contentsMap[item.contentId] || {};
        return {
          id: `playlist-${idx}-${item.contentId}`,
          contentId: item.contentId,
          name: item.name || contentDetail.name || "Video Playlist",
          type: contentDetail.type || item.type || "video",
          url: contentDetail.url || item.url || "",
          duration: Number(item.duration || contentDetail.duration || 15)
        };
      }).filter((item: any) => item.url);
    }

    return [];
  }, [screen?.items, rawPlaylist?.items, contentsMap]);

  // 5. AJUSTAR ÍNDICE DE REPRODUCCIÓN EN CASO DE CAMBIOS DINÁMICOS EN EL NÚMERO DE ITEMS O ACTUALIZACIÓN EN VIVO
  const prevPlaylistIdsStrRef = useRef<string>('');
  useEffect(() => {
    if (playlistItems.length > 0 && currentIndex >= playlistItems.length) {
      setCurrentIndex(0);
      setVisibleIndex(0);
    }

    const currentPlaylistIdsStr = playlistItems.map((item: any) => item.id).join(',');
    if (prevPlaylistIdsStrRef.current !== currentPlaylistIdsStr) {
      console.log("[Player] Cambio en la secuencia de videos detectado en vivo:", currentPlaylistIdsStr);
      prevPlaylistIdsStrRef.current = currentPlaylistIdsStr;
      setCurrentIndex(0);
      setVisibleIndex(0);
      // Si la playlist cambia con contenido válido, habilitamos el inicio de playback automático
      if (playlistItems.length > 0) {
        setPlaybackStarted(true);
      }
    }
  }, [playlistItems, currentIndex]);

  // Sincronizar visibleIndex con currentIndex usando transiciones pre-amortiguadas con un failsafe de 800ms
  useEffect(() => {
    const currentItem = playlistItems[currentIndex];
    if (!currentItem) {
      setVisibleIndex(currentIndex);
      return;
    }

    if (currentItem.type !== 'video') {
      // Para imágenes o textos, realizar la transición inmediatamente
      setVisibleIndex(currentIndex);
    } else {
      // Failsafe: Si el video tarda demasiado o no dispara el evento onPlaying/onPlayStarted,
      // forzar la transición visual pasados 800ms para evitar que la pantalla se quede colgada
      const timeout = setTimeout(() => {
        setVisibleIndex(currentIndex);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, playlistItems]);

  // 6. CONTROLADOR DE TEMPORIZACIÓN CLÁSICA (Failsafe para transiciones automáticas)
  useEffect(() => {
    if (playlistItems.length <= 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const currentItem = playlistItems[currentIndex];
    if (!currentItem) return;

    // Reportar log de reproducción asíncrono
    const logPlayback = async () => {
      try {
        await addDoc(collection(db, 'logs'), {
          screenId: resolvedId || screenId || 'unknown',
          contentId: currentItem.contentId,
          playlistId: activePlaylistId || 'direct',
          playedAt: new Date().toISOString(),
          duration: currentItem.duration
        });
      } catch (e) {
        console.error('Audit playback log failed:', e);
      }
    };
    logPlayback();

    console.log(`[Player] Iniciado "${currentItem.name}". Programando cambio en ${currentItem.duration}s`);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
    }, currentItem.duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, playlistItems, resolvedId, screenId, activePlaylistId]);

  // Helper para extraer ID de YouTube
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

  // Helper para CDN local o reescritura directa de URLs
  const getDirectUrl = (url: string) => {
    if (!url) return url;
    
    // Cloudflare Stream
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

    // Google Drive
    const match = url.match(/\/(?:d|file\/d|open\?id=)([a-zA-Z0-9_-]{25,})[^\w-]?/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?id=${match[1]}&export=media`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-500">
        <Loader2 className="w-12 h-12 animate-spin mb-6" />
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse font-bold text-slate-500">Sincronización Leonisa</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-500 p-8 text-center relative overflow-hidden">
        <div className="atmosphere absolute w-full h-full opacity-20" />
        <MonitorOff className="w-32 h-32 mb-8 opacity-20 relative z-10" />
        <h2 className="text-4xl font-bold mb-4 tracking-tighter text-white relative z-10">Fallo de Nodo</h2>
        <p className="text-xs opacity-50 font-mono uppercase tracking-widest relative z-10">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-12 bg-rose-500/10 px-6 py-3 rounded-2xl border border-rose-500/20 text-[10px] font-bold uppercase tracking-widest text-rose-400 relative z-10 hover:bg-rose-500/20 cursor-pointer"
        >
          REINTENTAR CONEXIÓN
        </button>
      </div>
    );
  }

  return (
    <div 
      className="h-screen bg-slate-950 overflow-hidden relative cursor-none"
      onClick={() => {
        if (!playbackStarted) {
          setPlaybackStarted(true);
        }
      }}
    >
      <AnimatePresence mode="wait">
        {!playbackStarted && playlistItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[200] bg-slate-950 flex items-center justify-center cursor-pointer"
          >
             <div className="text-center p-12 bg-white/5 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl">
                <p className="text-rose-500 font-black text-xs uppercase tracking-[0.4em] mb-4">Señal Sincronizada</p>
                <h2 className="text-white text-3xl font-bold mb-8">Toca para Iniciar Reproducción</h2>
                <div className="w-16 h-16 bg-rose-600 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-lg shadow-rose-900/40">
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
                </div>
             </div>
          </motion.div>
        )}

        {playlistItems.length === 0 ? (
          <motion.div 
            key="fallback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen w-full flex flex-col items-center justify-center bg-slate-950"
          >
             <div className="atmosphere absolute w-full h-full opacity-30" />
             <div className="text-center p-16 bento-card backdrop-blur-2xl relative z-10 scale-110">
                <div className="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center font-bold text-4xl text-white mx-auto mb-8 shadow-2xl shadow-rose-900/40">S</div>
                <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.5em] mb-3 italic">Estación Sincronizada</h3>
                <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em] mb-1 font-bold">{screen?.name || 'Cargando Nodo...'}</p>
                <p className="text-slate-600 text-[8px] font-mono opacity-50">ID: {resolvedId || screenId}</p>
                
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3 h-3 text-rose-500 animate-spin" />
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                      Sincronizando con Servidor...
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[7px] text-slate-700 uppercase font-bold tracking-widest">Estado del Nodo</p>
                    <p className="text-[8px] text-slate-600 italic">
                      {!screen ? 'Buscando Hardware...' : 'Buscando Programación Activa o Playlist...'}
                    </p>
                  </div>
                </div>
             </div>
          </motion.div>
        ) : (
          <div className="absolute inset-0 w-full h-full relative overflow-hidden">
            {playlistItems.map((item: any, index: number) => {
              const isActive = index === currentIndex || index === visibleIndex;
              const isVisible = index === visibleIndex;
              const directUrl = getDirectUrl(item.url);
              const ytId = getYouTubeId(item.url);

              return (
                <div
                  key={item.id}
                  className={`absolute inset-0 w-full h-full transition-all duration-300 ease-in-out ${
                    isVisible 
                      ? "opacity-100 pointer-events-auto z-10 scale-100 shadow-2xl" 
                      : "opacity-0 pointer-events-none z-0 scale-98"
                  }`}
                >
                  {item.type === 'video' && ytId ? (
                    <div className="w-full h-full bg-slate-950 flex items-center justify-center relative overflow-hidden">
                      <iframe
                        title={item.name}
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=${isActive ? 1 : 0}&mute=1&controls=0&loop=1&playlist=${ytId}&playsinline=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1`}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none shadow-2xl"
                        style={{
                          width: '100vw',
                          height: '56.25vw', /* 16:9 ratio */
                          minHeight: '100vh',
                          minWidth: '177.77vh', /* 16:9 ratio */
                        }}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </div>
                  ) : item.type === 'video' ? (
                    <SignageMediaVideo
                      url={directUrl}
                      name={item.name}
                      isActive={isActive}
                      loop={playlistItems.length === 1}
                      onPlayStarted={() => {
                        setPlaybackStarted(true);
                        setVisibleIndex(index);
                      }}
                      onEnded={() => {
                        console.log('[Player] Final natural de clip alcanzado:', item.name);
                        if (playlistItems.length > 1) {
                          setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
                        }
                      }}
                    />
                  ) : item.type === 'image' ? (
                    <div 
                      className="w-full h-full bg-center bg-cover bg-no-repeat"
                      style={{ backgroundImage: `url(${directUrl})` }}
                    />
                  ) : item.type === 'text' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-24 text-center relative overflow-hidden">
                       <div className="atmosphere absolute inset-0 pointer-events-none opacity-40" />
                       <motion.div
                         initial={{ opacity: 0, scale: 0.9 }}
                         animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.9 }}
                         className="relative z-10"
                       >
                         <h2 className="text-white text-6xl md:text-9xl font-bold tracking-tighter max-w-6xl leading-[0.85] mb-12 drop-shadow-2xl">
                           {item.name}
                         </h2>
                         <div className="h-1 bg-rose-600 w-24 mx-auto mb-12 rounded-full shadow-[0_0_20px_#e11d48]"></div>
                         <p className="text-slate-400 text-2xl md:text-4xl font-mono leading-relaxed max-w-3xl mx-auto italic opacity-80 font-medium font-sans">
                           {item.url}
                         </p>
                       </motion.div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Overlay de Estado del Servidor */}
      <div className="absolute bottom-6 right-6 flex items-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-500 z-50">
        <div className="bg-slate-950/80 backdrop-blur-xl px-12 py-3 rounded-full flex items-center gap-4 border border-white/5 shadow-2xl">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]" />
          <span className="text-[10px] text-white font-mono uppercase font-bold tracking-[0.3em]">{screen?.name}</span>
          <span className="text-[10px] text-slate-500 font-mono">/ RED SÍCRONA</span>
        </div>
      </div>
    </div>
  );
}
