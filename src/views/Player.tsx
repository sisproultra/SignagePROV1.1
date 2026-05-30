import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, getDoc, addDoc, collection, query, where, getDocs, updateSupabaseConfig } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, MonitorOff, Volume2, VolumeX, Music } from 'lucide-react';

interface SignageMediaVideoProps {
  url: string;
  name: string;
  isActive: boolean;
  isNext: boolean;      // ← NUEVO: es el siguiente en la cola
  loop: boolean;
  onEnded: () => void;
  onPlayStarted: () => void;
  onNextReady?: () => void; // ← NUEVO: callback cuando el siguiente está listo
}

/**
 * Custom player component that preloads the video and controls playback strictly
 * when the item becomes active or inactive. Keeps current position at 0 when waiting.
 */
function SignageMediaVideo({ url, name, isActive, isNext, loop, onEnded, onPlayStarted, onNextReady }: SignageMediaVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Reset isReady cuando cambia la URL
  useEffect(() => {
    setIsReady(false);
  }, [url]);

  // Control de reproducción
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && isReady) {
      video.currentTime = 0;
      video.muted = true;
      video.playsInline = true;
      video.play()
        .then(() => onPlayStarted())
        .catch(err => console.warn("[SignagePlayer] Autoplay bloqueado:", err));
    } else if (!isActive && !isNext) {
      // Solo pausar si no es activo NI siguiente (ahorrar recursos)
      video.pause();
      video.currentTime = 0;
    }
    // Si isNext: no hacer nada, dejar que el browser cargue en background
  }, [isActive, isNext, isReady]);

  return (
    <video
      ref={videoRef}
      src={url}
      className="w-full h-full object-cover bg-slate-950"
      muted
      playsInline
      controls={false}
      preload="auto"           // ← Carga agresiva en background
      crossOrigin="anonymous"
      loop={loop}
      onCanPlay={() => {
        setIsReady(true);
        // Si soy el siguiente, notificar que estoy listo
        if (isNext && onNextReady) {
          onNextReady();
        }
      }}
      onEnded={onEnded}
      onError={(e) => {
        const videoElement = e.currentTarget;
        console.error('[SignagePlayer] Video error:', {
          code: videoElement.error?.code,
          message: videoElement.error?.message,
          src: url
        });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackStarted, setPlaybackStarted] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const [loadProgress, setLoadProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Iniciando...");

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadProgress(prev => {
          if (prev < 30) {
            setProgressLabel("Estableciendo enlace seguro...");
            return prev + Math.floor(Math.random() * 8) + 4;
          } else if (prev < 65) {
            setProgressLabel("Descargando contenidos de tienda...");
            return prev + Math.floor(Math.random() * 5) + 2;
          } else if (prev < 90) {
            setProgressLabel("Sincronizando flujos y clips...");
            return prev + Math.floor(Math.random() * 3) + 1;
          } else if (prev < 98) {
            setProgressLabel("Cargando reproductor... casi listo");
            return prev + 1;
          } else {
            setProgressLabel("Cargando reproductor... casi listo");
            return prev;
          }
        });
      }, 120);
    } else {
      setProgressLabel("Señal sincronizada correctamente");
      setLoadProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);
  
  const timerRef = useRef<any>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);

  const bgAudioUrlToPlay = useMemo(() => {
    if (screen?.items && screen.items.length > 0) {
      return screen.bgAudioUrl || "";
    }
    return rawPlaylist?.bgAudioUrl || "";
  }, [screen?.items, screen?.bgAudioUrl, rawPlaylist?.bgAudioUrl]);

  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    const audioObj = bgAudioRef.current;
    if (!audioObj) return;

    if (playbackStarted && bgAudioUrlToPlay) {
      const directUrl = getDirectUrl(bgAudioUrlToPlay);
      console.log(`[Player] Iniciando música de fondo en bucle: ${directUrl}`);
      audioObj.volume = 0.5; // Música de fondo agradable al 50% de volumen para no saturar
      audioObj.play()
        .then(() => {
          setAudioBlocked(false);
        })
        .catch(err => {
          console.warn("[Player] Fallo al reproducir audio de fondo, re-intentando al hacer click:", err);
          setAudioBlocked(true);
        });
    } else {
      audioObj.pause();
    }
  }, [playbackStarted, bgAudioUrlToPlay]);

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
    }

    const currentPlaylistIdsStr = playlistItems.map((item: any) => item.id).join(',');
    if (prevPlaylistIdsStrRef.current !== currentPlaylistIdsStr) {
      console.log("[Player] Cambio en la secuencia de videos detectado en vivo:", currentPlaylistIdsStr);
      prevPlaylistIdsStrRef.current = currentPlaylistIdsStr;
      setCurrentIndex(0);
      if (playlistItems.length > 0) {
        setPlaybackStarted(true);
      }
    }
  }, [playlistItems, currentIndex]);

  // Precargar la siguiente imagen para evitar flash negro en TV
  useEffect(() => {
    if (playlistItems.length <= 1) return;
    const nextIndex = (currentIndex + 1) % playlistItems.length;
    const nextItem = playlistItems[nextIndex];
    
    if (nextItem?.type === 'image' && nextItem?.url) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = getDirectUrl(nextItem.url);
      document.head.appendChild(link);
      
      return () => {
        document.head.removeChild(link);
      };
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

  if (loading || loadProgress < 100) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-md p-10 bg-white rounded-3xl border border-slate-200/60 shadow-[0_12px_40px_rgb(0,0,0,0.04)] flex flex-col items-center">
          {/* Leonisa Brand Header */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-rose-200">
              L
            </div>
            <span className="text-sm font-black tracking-widest text-slate-900 uppercase">LEONISA</span>
            <span className="text-xs font-medium text-slate-400 font-mono">Signage</span>
          </div>

          <div className="w-full space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-sans">
                {progressLabel}
              </span>
              <span className="text-xs font-mono font-bold text-rose-600">
                {Math.min(loadProgress, 100)}%
              </span>
            </div>

            {/* Modern intelligence progress bar */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-100/55">
              <motion.div
                className="h-full bg-rose-600 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(loadProgress, 100)}%` }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              />
            </div>

            <div className="flex items-center gap-2 justify-center pt-4">
              <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin" />
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                Conectando Señal...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-md p-10 bg-white rounded-3xl border border-slate-200/60 shadow-[0_12px_40px_rgb(0,0,0,0.06)] flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">
            <MonitorOff className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight text-slate-900">Configurando Pantalla</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 font-sans">
            Estamos sincronizando la señal de este nodo. Si es la primera vez que se inicia, verifica la vinculación.
          </p>
          
          <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left mb-8">
            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider font-mono block mb-1">Estado de Conexión</span>
            <p className="text-[10px] text-slate-600 font-mono font-medium leading-normal">{error}</p>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest py-3.5 transition-all text-center cursor-pointer shadow-md shadow-rose-100 active:scale-95"
          >
            Sincronizar Señal Ahora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-screen w-screen bg-slate-950 overflow-hidden relative p-0 m-0 ${audioBlocked ? 'cursor-default' : 'cursor-none'}`}
      onClick={() => {
        // Forzar la reproducción de música de fondo mediante interacción de usuario (clic)
        if (bgAudioRef.current && bgAudioUrlToPlay) {
          bgAudioRef.current.play()
            .then(() => {
              console.log("[Player] Éxito: Música de fondo iniciada por clic de usuario");
              setAudioBlocked(false);
            })
            .catch(err => console.warn("[Player] Autoplay de audio bloqueado por navegador:", err));
        }
      }}
    >
      <AnimatePresence mode="wait">

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
          <div className="absolute inset-0 w-full h-full bg-slate-950 overflow-hidden">
            {(() => {
              const nextIndex = (currentIndex + 1) % playlistItems.length;
              return playlistItems.map((item: any, index: number) => {
                const isActive = index === currentIndex;
                const isNext = index === nextIndex && playlistItems.length > 1;
                const directUrl = getDirectUrl(item.url);
                const ytId = getYouTubeId(item.url);

                return (
                  <div
                    key={item.id}
                    className={`absolute inset-0 w-full h-full ${
                      isActive 
                        ? "opacity-100 pointer-events-auto z-10" 
                        : "opacity-0 pointer-events-none z-0"
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
                        isNext={isNext}
                        loop={playlistItems.length === 1}
                        onPlayStarted={() => {
                          if (!bgAudioUrlToPlay) {
                            setPlaybackStarted(true);
                          }
                        }}
                        onNextReady={() => console.log(`[Player] Video siguiente pre-buffereado: "${playlistItems[nextIndex]?.name}"`)}
                        onEnded={() => {
                          console.log('[Player] Final natural de clip alcanzado:', item.name);
                          if (playlistItems.length > 1) {
                            setCurrentIndex((prev) => (prev + 1) % playlistItems.length);
                          }
                        }}
                      />
                    ) : item.type === 'image' ? (
                      <img
                        src={directUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="eager"
                        decoding="sync"
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
              });
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* Control / Indicador interactivo de reproducción de música de fondo */}
      {bgAudioUrlToPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const audioObj = bgAudioRef.current;
            if (!audioObj) return;

            if (audioBlocked || audioObj.paused) {
              audioObj.play()
                .then(() => {
                  setAudioBlocked(false);
                })
                .catch(err => {
                  console.warn("[Player] Error al reproducir audio:", err);
                  setAudioBlocked(true);
                });
            } else {
              audioObj.pause();
              setAudioBlocked(true);
            }
          }}
          className={`absolute bottom-6 right-6 z-[300] bg-slate-950/90 hover:bg-slate-900 border backdrop-blur-xl px-4 py-2.5 rounded-2xl flex items-center gap-2.5 text-[10px] font-black tracking-wider transition-all cursor-pointer shadow-2xl active:scale-95 ${
            audioBlocked 
              ? 'border-rose-500/30 text-rose-500 animate-bounce' 
              : 'border-slate-800 text-white opacity-40 hover:opacity-100'
          }`}
          title={audioBlocked ? "Hacer clic para activar música de fondo" : "Hacer clic para silenciar"}
        >
          {audioBlocked ? (
            <>
              <VolumeX className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>💥 HACER CLIC PARA ACTIVAR AUDIO DE FONDO</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400">MÚSICA DE FONDO REPRODUCIENDO</span>
            </>
          )}
        </button>
      )}

      {/* Overlay de Estado del Servidor */}
      <div className="absolute bottom-6 left-6 flex items-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-500 z-50">
        <div className="bg-slate-950/80 backdrop-blur-xl px-12 py-3 rounded-full flex items-center gap-4 border border-white/5 shadow-2xl">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]" />
          <span className="text-[10px] text-white font-mono uppercase font-bold tracking-[0.3em]">{screen?.name}</span>
          <span className="text-[10px] text-slate-500 font-mono">/ RED SÍCRONA</span>
        </div>
      </div>

      {/* Hidden audio player for looping background music */}
      <audio 
        ref={bgAudioRef} 
        src={getDirectUrl(bgAudioUrlToPlay)} 
        loop 
        style={{ display: 'none' }} 
      />
    </div>
  );
}
