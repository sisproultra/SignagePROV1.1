import React, { useState, useEffect, useRef } from 'react';
import { 
  db, storage, supabase, updateSupabaseConfig,
  collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc,
  ref as fbRef, uploadBytesResumable, getDownloadURL 
} from '../../lib/supabase';
import { 
  Film, Image as ImageIcon, Type, Plus, Trash2, ExternalLink, 
  Play, Clock, UploadCloud, Loader2, CheckCircle2, Edit2,
  Server, HelpCircle, ArrowRight, Code, Key, Settings, Terminal, Info, Copy,
  RefreshCw, Music
} from 'lucide-react';

export default function ContentLibrary() {
  const [contents, setContents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supabase runtime config states (saved to localStorage for seamless fallback)
  const [isSupaModalOpen, setIsSupaModalOpen] = useState(false);
  const [supaUrl, setSupaUrl] = useState(
    localStorage.getItem('leonisa_supabase_url') || 
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL || 
    ''
  );
  const [supaKey, setSupaKey] = useState(
    localStorage.getItem('leonisa_supabase_anon_key') || 
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_ANON_KEY || 
    ''
  );
  const [hasSupaClient, setHasSupaClient] = useState(!!supabase);

  const handleSaveSupaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const success = updateSupabaseConfig(supaUrl, supaKey);
    if (success) {
      setHasSupaClient(true);
      setIsSupaModalOpen(false);
      alert('¡Supabase configurado y conectado con éxito!');
      window.location.reload();
    } else {
      alert('Error al inicializar el cliente de Supabase. Revisa las credenciales ingresadas.');
    }
  };
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showDriveHelper, setShowDriveHelper] = useState(false);
  const [showYoutubeHelper, setShowYoutubeHelper] = useState(false);
  
  // Cloudflare and Multi-Tenant configuration states (Local / Persisted)
  const [activeTab, setActiveTab] = useState<'library' | 'cloudflare'>('library');
  const [cfCreds, setCfCreds] = useState({
    accountId: '',
    apiToken: '',
    subdomain: '',
  });

  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testVideoId, setTestVideoId] = useState('');
  const [testVideoName, setTestVideoName] = useState('Promo Campaña 10 Minutos');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('leonisa_cloudflare_creds');
    if (saved) {
      try {
        setCfCreds(JSON.parse(saved));
      } catch (e) {}
    } else {
      // Sembrar por defecto para pruebas sencillas
      const defaults = {
        accountId: '98d9760a9f8f4317b9b772b1d6f12345',
        apiToken: 'cf_stream_token_8871239b98ac89efae231adcf0',
        subdomain: 'f6b2bc23e8', // ID de cliente demo
      };
      setCfCreds(defaults);
      localStorage.setItem('leonisa_cloudflare_creds', JSON.stringify(defaults));
    }
  }, []);

  const handleSaveCfCreds = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('leonisa_cloudflare_creds', JSON.stringify(cfCreds));
    alert('¡Configuración guardada localmente! Se usará para simular la arquitectura y renderizar los reproductores HD.');
  };

  const executeCloudflareSimulation = async () => {
    setIsTesting(true);
    setTestLogs([]);
    
    const addLog = (msg: string) => {
      setTestLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    addLog('Iniciando handshake con Supabase Edge Function: /functions/v1/cloudflare-upload-ticket...');
    await new Promise(r => setTimeout(r, 800));
    
    addLog(`Generando clave temporal pre-firmada usando Account ID: ${cfCreds.accountId || 'demo-customer'} y políticas TUS.`);
    await new Promise(r => setTimeout(r, 600));

    addLog('Generando parámetros TUS en cabecera HTTP Post...');
    await new Promise(r => setTimeout(r, 500));
    addLog('Cloudflare Upload-Metadata: "maxDurationSeconds 600, requiresApproved true"');

    addLog('Subiendo chunks del video de 10 Minutos a la zona CDN Cloudflare (Bypass Egress No-Cost)...');
    await new Promise(r => setTimeout(r, 1200));

    // Simulamos un ID de video de Cloudflare Stream real
    const mockId = 'ea95132c15732412d22c1476d05ac114';
    setTestVideoId(mockId);
    addLog(`¡Transcodificación exitosa en CDN! ID del Video Generado: ${mockId}`);
    
    addLog('Sincronizando ID del video en el catálogo local de forma automatizada...');
    await new Promise(r => setTimeout(r, 400));

    try {
      await addDoc(collection(db, 'contents'), {
        name: `${testVideoName} (Cloudflare CDN)`,
        type: 'video',
        url: `cloudflare:${mockId}`,
        duration: 25, // Un loop de demo
        createdAt: new Date().toISOString()
      });
      addLog('¡Base de Datos Local Actualizada! Video vinculado a la lista de bucles.');
    } catch (e) {
      addLog('Error de guardado local');
    }
    
    setIsTesting(false);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(key);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const convertDriveLink = (url: string) => {
    // Regex to find Google Drive file ID
    const match = url.match(/\/(?:d|file\/d|open\?id=)([\w-]{25,})[^\w-]?/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
  };

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

  const [contentToEdit, setContentToEdit] = useState<any>(null);
  const [newContent, setNewContent] = useState({
    name: '',
    type: 'video' as 'video' | 'image' | 'audio' | 'text',
    url: '',
    duration: 15,
  });

  const [syncing, setSyncing] = useState(false);

  const syncFromSupabaseStorage = async (silent: boolean = false) => {
    if (!supabase) {
      if (!silent) setIsSupaModalOpen(true);
      return;
    }

    setSyncing(true);
    try {
      // 1. List files from 'signage-contents' bucket
      const { data: files, error } = await supabase.storage.from('signage-contents').list('', {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });

      if (error) {
        console.error("Error al listar archivos de Supabase Storage:", error);
        if (!silent) alert(`Error de Conexión a Supabase Storage: ${error.message}`);
        return;
      }

      if (!files || files.length === 0) {
        if (!silent) alert("No se encontraron archivos cargados en el bucket 'signage-contents' de tu Supabase Storage.");
        return;
      }

      // Fetch existing records from Supabase directly to guarantee latest data instead of waiting for async onSnapshot to propagate
      let currentDbContents: any[] = [];
      const { data: selectData, error: selectError } = await supabase.from('contents').select('url, name');
      if (!selectError && selectData) {
        currentDbContents = selectData;
      } else {
        currentDbContents = contents;
      }

      // Convert existing media files in db to set for ultra-fast check (preventing duplicates)
      const existingUrls = new Set(currentDbContents.map((c: any) => (c.url || '').toLowerCase()));
      const existingNames = new Set(currentDbContents.map((c: any) => (c.name || '').toLowerCase()));

      let importedCount = 0;

      for (const file of files) {
        // Skip hidden config files or empty placeholders
        if (file.name.startsWith('.') || file.name === '.emptyFolderPlaceholder') continue;

        // Get the real public URL for this file in the 'signage-contents' bucket
        const { data: urlData } = supabase.storage.from('signage-contents').getPublicUrl(file.name);
        if (!urlData || !urlData.publicUrl) continue;
        
        const publicUrl = urlData.publicUrl;
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");

        // Check if already registered
        const alreadyExists = existingUrls.has(publicUrl.toLowerCase()) || 
                            existingNames.has(nameWithoutExt.toLowerCase());

        if (alreadyExists) {
          continue;
        }

        // Detect correct type based on file extension
        const lowerName = file.name.toLowerCase();
        const isVideo = lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.mov') || lowerName.endsWith('.m4v') || lowerName.endsWith('.avi');
        const isImage = lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.gif') || lowerName.endsWith('.webp');
        const isAudio = lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.m4a') || lowerName.endsWith('.ogg');

        if (!isVideo && !isImage && !isAudio) continue; // Only process media
        
        const fileType = isVideo ? 'video' : isImage ? 'image' : 'audio';

        // Add document to 'contents' Firestore-Supabase collection
        await addDoc(collection(db, 'contents'), {
          name: nameWithoutExt,
          type: fileType,
          url: publicUrl,
          duration: fileType === 'video' ? 15 : fileType === 'audio' ? 5 : 10,
          createdAt: new Date().toISOString()
        });

        importedCount++;
      }

      if (importedCount > 0) {
        if (!silent) alert(`🎉 ¡Sincronización Exitosa! Se revisó el storage y se agregaron ${importedCount} recursos nuevos (videos, imágenes o audios) que ya estaban en tu bucket 'signage-contents'.`);
      } else {
        if (!silent) alert(`💡 Tu Biblioteca está al día. Los ${files.length} archivos subidos al bucket 'signage-contents' ya se encuentran visibles.`);
      }

    } catch (err: any) {
      console.error("Critical storage synchronization error:", err);
      if (!silent) alert(`Error crítico al escanear storage: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'contents'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setContents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Firestore error:", error);
    });
    return () => unsub();
  }, []);

  // Silent sync on initial load
  useEffect(() => {
    if (supabase) {
      const timer = setTimeout(() => {
        syncFromSupabaseStorage(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSupaClient]);

  const processUploadedFile = (file: File) => {
    // Detect type based on file or webm extension
    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.webm');
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav') || file.name.toLowerCase().endsWith('.m4a');
    
    let type: 'video' | 'image' | 'audio' | 'text' = 'video';
    if (isImage) {
      type = 'image';
    } else if (isVideo) {
      type = 'video';
    } else if (isAudio) {
      type = 'audio';
    } else {
      alert('Por favor sube solo videos (MP4, WEBM), imágenes (JPG, JPEG, PNG, GIF) o audios (MP3, WAV, M4A).');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const prettyName = file.name.replace(/\.[^/.]+$/, "");
    setNewContent(prev => ({ ...prev, type, name: prev.name || prettyName }));

    const sRef = fbRef(storage, `content/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(sRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
      }, 
      (error) => {
        console.error("Upload error:", error);
        const errorMsg = error?.message || (typeof error === 'string' ? error : '') || '';
        const isSizeError = errorMsg.toLowerCase().includes('exceeded') || 
                            errorMsg.toLowerCase().includes('size') || 
                            errorMsg.toLowerCase().includes('limit');

        if (isSizeError) {
          alert(
            "⚠️ ¡EL ARCHIVO EXCEDE EL LÍMITE DE TAMAÑO DE SUPABASE STORAGE!\n\n" +
            "Para poder subir videos grandes (hasta 200MB - 500MB), debes actualizar el límite de tamaño de archivo de tu Bucket 'signage-contents' en tu panel de Supabase:\n\n" +
            "OPCIÓN A: Desde el panel visual de Supabase:\n" +
            "1. Entra a tu proyecto en Supabase.\n" +
            "2. Ve a la pestaña 'Storage' (Almacenamiento) en la barra de navegación izquierda.\n" +
            "3. Busca tu bucket de almacenamiento llamado 'signage-contents'.\n" +
            "4. Haz clic en los tres puntos (...) al lado de 'signage-contents' y selecciona 'Edit bucket'.\n" +
            "5. Cambia el campo 'Maximum File Size' a 500 MB (o desactiva el límite).\n" +
            "6. ¡Listo! Intenta subir el video de nuevo.\n\n" +
            "OPCIÓN B: Desde la consola SQL de Supabase:\n" +
            "Ejecuta la siguiente línea en tu SQL Editor para actualizarlo al instante:\n" +
            "update storage.buckets set file_size_limit = 524288000 where id = 'signage-contents';"
          );
        } else {
          alert("Error al subir el archivo a Supabase Storage. Verifica tu conexión y que el bucket 'signage-contents' esté configurado correctamente con políticas públicas de inserción.\n\nDetalle: " + errorMsg);
        }
        setUploading(false);
      }, 
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Save file immediately to database for instant display under CONTENIDO
          const cleanName = file.name.replace(/\.[^/.]+$/, "");
          await addDoc(collection(db, 'contents'), {
            name: cleanName,
            type,
            url: downloadURL,
            duration: type === 'video' ? 15 : 10,
            createdAt: new Date().toISOString()
          });

          // Reset forms and close modal automatically
          setIsModalOpen(false);
          setNewContent({ name: '', type: 'video', url: '', duration: 15 });
        } catch (err) {
          console.error("Error al obtener URL de descarga o guardar contenido:", err);
          alert("Error al registrar el archivo subido en la base de datos.");
        } finally {
          setUploading(false);
        }
      }
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleAddContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.url) return;

    const finalUrl = convertDriveLink(newContent.url);

    try {
      if (contentToEdit) {
        await updateDoc(doc(db, 'contents', contentToEdit.id), {
          ...newContent,
          url: finalUrl
        });
      } else {
        await addDoc(collection(db, 'contents'), {
          ...newContent,
          url: finalUrl,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setContentToEdit(null);
      setNewContent({ name: '', type: 'video', url: '', duration: 15 });
    } catch (err) {
      console.error("Error adding content:", err);
      alert("Error al guardar en la base de datos.");
    }
  };

  const openEdit = (content: any) => {
    setContentToEdit(content);
    setNewContent({
      name: content.name,
      type: content.type,
      url: content.url,
      duration: content.duration
    });
    setIsModalOpen(true);
  };

  const deleteContent = async (id: string) => {
    if (window.confirm('¿Eliminar este contenido? Se quitará de las playlists.')) {
      await deleteDoc(doc(db, 'contents', id));
    }
  };

  const filteredContents = contents.filter(c => filter === 'all' || c.type === filter);

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Central de Contenidos</h2>
          <p className="text-slate-400">Tus recursos multimedia y configuración CDN.</p>
        </div>
        
        {activeTab === 'library' && (
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={syncFromSupabaseStorage}
              disabled={syncing}
              className={`
                px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all text-xs uppercase cursor-pointer
                ${syncing 
                  ? 'bg-slate-850 text-slate-500 border border-slate-805' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300 shadow-md shadow-emerald-950/40'
                }
              `}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Storage (Supabase)'}
            </button>

            <button 
              onClick={() => setIsSupaModalOpen(true)}
              type="button"
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer"
              title="Configurar Conexión Supabase"
            >
              <Settings className="w-4 h-4 text-emerald-450" />
              <span>Conexión</span>
              <span className={`w-2 h-2 rounded-full ${hasSupaClient ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'}`} />
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20 text-xs uppercase cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Agregar Contenido
            </button>
          </div>
        )}
      </header>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'library' ? 'bg-slate-800 text-white border-b-2 border-rose-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
        >
          <Film className="w-4 h-4" />
          Biblioteca de Medias
        </button>
        <button
          onClick={() => setActiveTab('cloudflare')}
          className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'cloudflare' ? 'bg-orange-500/10 text-orange-400 border-b-2 border-orange-500' : 'text-slate-400 hover:text-orange-350 hover:bg-slate-900'}`}
        >
          <Server className="w-4 h-4 text-orange-400" />
          Pasarela Cloudflare Stream™ (Integración real)
        </button>
      </div>

      {activeTab === 'library' ? (
        <>
          {/* Filters */}
          <div className="flex gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800 w-fit">
            {['all', 'video', 'image', 'audio', 'text'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`
                  px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all
                  ${filter === type ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-800'}
                `}
              >
                {type === 'all' ? 'Todos' : type === 'video' ? 'Videos' : type === 'image' ? 'Imágenes' : type === 'audio' ? 'Audios' : 'Texto'}
              </button>
            ))}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredContents.map((content) => (
              <div key={content.id} className="bento-card overflow-hidden group hover:border-rose-500/30 transition-all flex flex-col">
                <div className="aspect-video bg-slate-950 relative overflow-hidden flex items-center justify-center">
                  {content.type === 'image' ? (
                    <img src={content.url} alt={content.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : content.type === 'video' ? (
                    (() => {
                      const ytId = getYouTubeId(content.url);
                      if (ytId) {
                        return (
                          <div className="w-full h-full relative">
                            <img 
                              src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} 
                              alt={content.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center gap-1.5">
                              <Play className="w-8 h-8 text-white opacity-80 group-hover:text-rose-500 group-hover:scale-110 transition-all" />
                              <span className="text-[8px] uppercase tracking-wider bg-red-650/90 text-white font-extrabold font-mono px-2.5 py-1 rounded border border-red-500/20 shadow-md">
                                YouTube Live Video
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="w-full h-full relative group/video">
                          <video 
                            src={content.url.startsWith('cloudflare:') ? `https://customer-${cfCreds.subdomain || 'demo-customer'}.cloudflarestream.com/${content.url.replace('cloudflare:', '')}/downloads/default.mp4` : content.url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                            crossOrigin="anonymous"
                          />
                          <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center transition-colors">
                            <Play className="w-10 h-10 text-white/85 group-hover:text-rose-500 group-hover:scale-110 transition-all filter drop-shadow" />
                          </div>
                          {content.url.startsWith('cloudflare:') && (
                            <div className="absolute bottom-2 right-2 bg-slate-900/90 text-[8px] uppercase tracking-wide px-2 py-0.5 rounded text-slate-400 font-mono">
                              Cloudflare Stream
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : content.type === 'audio' ? (
                    <div className="p-6 text-center w-full h-full flex flex-col items-center justify-center bg-slate-950">
                      <Music className="w-10 h-10 text-rose-500 mb-2 animate-pulse" />
                      <audio 
                        src={content.url} 
                        controls 
                        className="w-full h-8 max-w-[200px]" 
                        preload="none"
                      />
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <Type className="w-10 h-10 text-slate-700 mx-auto mb-3 opacity-30" />
                      <p className="text-[10px] line-clamp-3 text-slate-500 italic font-mono">"{content.url}"</p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur text-white p-2 rounded-xl border border-white/5 italic">
                    {content.type === 'video' ? <Film className="w-3.5 h-3.5" /> : content.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : content.type === 'audio' ? <Music className="w-3.5 h-3.5 text-rose-500" /> : <Type className="w-3.5 h-3.5" />}
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-sm text-white line-clamp-1">{content.name}</h4>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openEdit(content)}
                        className="text-slate-600 hover:text-emerald-500 transition-colors p-1"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteContent(content.id)}
                        className="text-slate-600 hover:text-rose-500 transition-colors p-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-mono tracking-tighter uppercase">{content.duration} seg</span>
                    </div>
                    <a 
                      href={content.url.startsWith('cloudflare:') ? `https://customer-${cfCreds.subdomain || 'demo-customer'}.cloudflarestream.com/${content.url.replace('cloudflare:', '')}/downloads/default.mp4` : content.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {filteredContents.length === 0 && (
              <div className="col-span-full py-32 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-[2.5rem] bg-slate-900/10">
                <Film className="w-12 h-12 mx-auto mb-6 opacity-5" />
                <p className="italic text-sm">Biblioteca vacía. Sincroniza contenido nuevo.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-8 text-slate-900 bg-[#f8fafc] p-8 md:p-12 rounded-[2.5rem] border border-slate-200">
          
          {/* Header de Integración */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="space-y-2">
              <span className="bg-orange-100 text-orange-600 px-3.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                Arquitectura Sin Costos Ocultos (Bypass Egress)
              </span>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Pasarela Cloudflare Stream™ & Supabase</h3>
              <p className="text-sm text-slate-500 leading-normal max-w-2xl">
                Configura, simula o programa la subida directa de videos de hasta 10 minutos al CDN global de Cloudflare. 
                Los televisores reproducirán video HD en bucle de forma rápida con cero consumo de ancho de banda (Egress) en Supabase.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              <p className="text-xs font-mono font-bold text-slate-500 uppercase">Handshake listo para Supabase</p>
            </div>
          </div>

          {/* Formulario de Credenciales Reales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <h4 className="font-bold text-lg text-slate-900 flex items-center gap-3">
                  <Key className="w-5 h-5 text-orange-500" />
                  Credenciales de Conexión del Canal
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Configura tus llaves de Cloudflare. Estas se sincronizarán localmente para resolver todas las solicitudes del reproductor de pantallas.
                </p>

                <form onSubmit={handleSaveCfCreds} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-2 tracking-widest">Cloudflare Account ID</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                        value={cfCreds.accountId}
                        onChange={e => setCfCreds({...cfCreds, accountId: e.target.value})}
                        placeholder="ej: ea95132c1572d22c11d24567..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-2 tracking-widest">Subdominio Único (Customer Code)</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                        value={cfCreds.subdomain}
                        onChange={e => setCfCreds({...cfCreds, subdomain: e.target.value})}
                        placeholder="ej: customer-f6b2bc23e8"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-2 tracking-widest">API Stream API Key (Token con permisos de Stream:Edit)</label>
                    <input 
                      type="password" 
                      required
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded-xl font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                      value={cfCreds.apiToken}
                      onChange={e => setCfCreds({...cfCreds, apiToken: e.target.value})}
                      placeholder="ej: cf_stream_token_8871239b98ac89efae231adcf0..."
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button 
                      type="submit"
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/15"
                    >
                      Guardar Configuración Local
                    </button>
                  </div>
                </form>
              </div>

              {/* Simulador Playground */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-lg text-slate-900 flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-orange-500" />
                    Simulador de Carga TUS (Handshake Supabase Api)
                  </h4>
                  <span className="bg-emerald-50 text-emerald-600 text-[9px] px-2 py-0.5 rounded-md font-bold uppercase">Sandbox</span>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <p className="text-xs text-slate-600 leading-normal font-medium">
                    Introduce un identificador de prueba para simular la generación de firma de carga segura. 
                    Toda la comunicación ocurre de forma simulada emulando llamadas directas API TUS.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-xl text-xs font-semibold focus:outline-none"
                      value={testVideoName}
                      onChange={e => setTestVideoName(e.target.value)}
                      placeholder="Nombre del Video"
                    />
                    <button
                      onClick={executeCloudflareSimulation}
                      disabled={isTesting}
                      className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm"
                    >
                      {isTesting ? 'Procesando API...' : 'Simular Handshake e Inyectar en Loop'}
                    </button>
                  </div>
                </div>

                {/* Logs del Terminal */}
                {testLogs.length > 0 && (
                  <div className="bg-slate-950 p-6 rounded-2xl font-mono text-[9px] text-slate-300 space-y-1.5 shadow-inner leading-relaxed select-all">
                    {testLogs.map((log, idx) => (
                      <p key={idx}>{log}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel de Costos y Recursos */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-orange-600 tracking-widest flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Estructura de Costos de Cloudflare
                </h5>
                <p className="text-xs text-slate-600 leading-normal font-medium">
                  Cloudflare Stream cobra una suscripción fija básica de <strong className="text-slate-900">$5.00 USD al mes</strong>.
                </p>
                <div className="h-px bg-slate-100" />
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Minutos Almacenados Incluidos</span>
                    <span className="font-extrabold text-slate-900">1,000 minutos</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Minutos Transmitidos Incluidos</span>
                    <span className="font-extrabold text-slate-900">1,000 minutos</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Minutos Almacenados Extra</span>
                    <span className="font-extrabold text-slate-900">+$1.00 USD / 1,000 mins</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Minutos Transmitidos Extra</span>
                    <span className="font-extrabold text-slate-900">+$1.00 USD / 1,000 mins</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-600 font-bold bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                    <span>Egress (Tráfico de Red CDN)</span>
                    <span>$0.00 USD (GRATIS LIMITADO)</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  *A diferencia de Supabase Storage que cobra por gigabyte de descarga (Egress), Cloudflare no tiene cobro de transferencia. Esto es crítico para pantallas que reproducen el mismo video 12 horas continuas diariamente.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h5 className="font-extrabold text-[10px] uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Fórmula Multi-Tenant Segura
                </h5>
                <p className="text-xs text-slate-600 leading-normal font-medium">
                  Cada tienda o empresa tiene su propio catálogo aislado. Para evitar costos cruzados, las credenciales dinámicas de cada tenant se guardan en su respectiva columna de la tabla <strong className="text-slate-900">companies</strong>. Las solicitudes API heredan estas llaves dinámicamente en el backend.
                </p>
              </div>
            </div>
          </div>

          {/* Paso a Paso Detallado */}
          <div className="py-6 border-t border-slate-200 space-y-6">
            <h4 className="font-black text-xl text-slate-900">Guía de Configuración Paso a Paso (Producción)</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="w-8 h-8 bg-orange-100 text-orange-600 font-extrabold rounded-xl flex items-center justify-center text-sm font-mono shadow-sm">
                  1
                </div>
                <h5 className="font-bold text-sm text-slate-800">Activar Stream en Cloudflare</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Inicia sesión en <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline font-semibold">dash.cloudflare.com</a>. Busca la pestaña **Stream** en el menú de la izquierda y activa la suscripción básica de $5 USD. Esto te proporciona almacenamiento HD y reproductor nativo.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="w-8 h-8 bg-orange-100 text-orange-600 font-extrabold rounded-xl flex items-center justify-center text-sm font-mono shadow-sm">
                  2
                </div>
                <h5 className="font-bold text-sm text-slate-800">Obtener API Token de Seguridad</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ve a **Mi Perfil** &gt; **API Tokens**. Crea un Token personalizado con permisos exclusivos de: **Account &gt; Stream &gt; Edit**. Nunca uses el API Token Global para evitar riesgos de acceso a tus DNS. Copia también tu **Account ID**.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="w-8 h-8 bg-orange-100 text-orange-600 font-extrabold rounded-xl flex items-center justify-center text-sm font-mono shadow-sm">
                  3
                </div>
                <h5 className="font-bold text-sm text-slate-800">Configurar Supabase Edge</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Crea una Supabase Edge Function que asocie e invoque de forma privada la credencial de Cloudflare por cada Tenant para generar el tiquete TUS de carga directa. El cliente subirá el video en pedazos de forma segura desde el panel del navegador.
                </p>
              </div>
            </div>
          </div>

          {/* Código para Supabase SQL y Edge Functions */}
          <div className="py-6 border-t border-slate-200 space-y-6">
            <h4 className="font-black text-xl text-slate-900">Bocetos del Código Backend</h4>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center bg-slate-900 text-slate-300 text-[10px] font-mono px-5 py-2.5 rounded-t-xl">
                  <span>1. SQL SCRIPT PARA SUPABASE (Aislamiento Multi-Tenant)</span>
                  <button 
                    onClick={() => handleCopyText(`-- Agregar campos de Cloudflare en la tabla de Empresas / Tenants
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS cloudflare_account_id text,
ADD COLUMN IF NOT EXISTS cloudflare_api_token text,
ADD COLUMN IF NOT EXISTS cloudflare_subdomain text DEFAULT 'demo';`, 'sql')}
                    className="text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copyFeedback === 'sql' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-5 rounded-b-xl border border-slate-800 font-mono text-[10px] text-white line-clamp-6 select-all overflow-x-auto leading-relaxed">
{`-- Agregar campos de Cloudflare en la tabla de Empresas / Tenants
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS cloudflare_account_id text,
ADD COLUMN IF NOT EXISTS cloudflare_api_token text,
ADD COLUMN IF NOT EXISTS cloudflare_subdomain text DEFAULT 'demo';`}
                </pre>
              </div>

              <div>
                <div className="flex justify-between items-center bg-slate-900 text-slate-300 text-[10px] font-mono px-5 py-2.5 rounded-t-xl">
                  <span>2. SUPABASE EDGE FUNCTION (Firma de carga directa para Cloudflare API)</span>
                  <button 
                    onClick={() => handleCopyText(`// Supabase Edge Function: /functions/v1/cloudflare-upload-ticket
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { company_id, file_name, file_size } = await req.json();

  // 1. Obtener credenciales de Cloudflare del Tenant de manera privada en PostgreSQL
  const { data: company } = await supabase
    .from('companies')
    .select('cloudflare_account_id, cloudflare_api_token')
    .eq('id', company_id)
    .single();

  const accountId = company.cloudflare_account_id;
  const token = company.cloudflare_api_token;

  // 2. Comunicar con API de Cloudflare para crear Ticket de carga segura
  const response = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${accountId}/stream/direct_upload\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      maxDurationSeconds: 600, // Limitar a 10 min por videos publicitarios
      creator: \`Company_\${company_id}\`,
      meta: { name: file_name }
    })
  });

  const uploadTicket = await response.json();
  
  // Devuelve la URL TUS al navegador del cliente
  return new Response(JSON.stringify({ 
    uploadURL: uploadTicket.result.uploadURL, 
    videoId: uploadTicket.result.uid 
  }), {
    headers: { "Content-Type": "application/json" }
  });
})`, 'edge_func')}
                    className="text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copyFeedback === 'edge_func' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-5 rounded-b-xl border border-slate-800 font-mono text-[10px] text-white line-clamp-10 select-all overflow-x-auto leading-relaxed">
{`// Supabase Edge Function: /functions/v1/cloudflare-upload-ticket
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { company_id, file_name, file_size } = await req.json();

  // 1. Obtener credenciales de Cloudflare del Tenant de manera privada en PostgreSQL
  const { data: company } = await supabase
    .from('companies')
    .select('cloudflare_account_id, cloudflare_api_token')
    .eq('id', company_id)
    .single();

  const accountId = company.cloudflare_account_id;
  const token = company.cloudflare_api_token;

  // 2. Comunicar con API de Cloudflare para crear Ticket de carga segura
  const response = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${accountId}/stream/direct_upload\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      maxDurationSeconds: 600, // Limitar a 10 min por videos de tienda
      creator: \`Company_\${company_id}\`,
      meta: { name: file_name }
    })
  });

  const uploadTicket = await response.json();
  
  // Devuelve la URL TUS al navegador del cliente
  return new Response(JSON.stringify({ 
    uploadURL: uploadTicket.result.uploadURL, 
    videoId: uploadTicket.result.uid 
  }), {
    headers: { "Content-Type": "application/json" }
  });
})`}
                </pre>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-md md:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <h3 className="text-2xl font-black text-white italic tracking-tight">
                {contentToEdit ? 'Editar Media' : 'Ingreso de Media'}
              </h3>
              <span className="text-[10px] uppercase font-mono tracking-widest text-rose-500 font-black px-3 py-1 bg-rose-500/10 rounded-full">
                {newContent.type} Mode
              </span>
            </div>
            
            <form onSubmit={handleAddContent} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                
                {/* COLUMNA IZQUIERDA: Métodos de Carga y Nube */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Métodos de Carga & Nube</span>
                    <span className="h-px bg-slate-800 flex-1 ml-4" />
                  </div>

                  {/* Google Drive Block */}
                  <div className="bg-slate-950/60 border border-emerald-500/10 rounded-2xl p-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase text-white tracking-widest">Google Drive Ready</h4>
                          <p className="text-[9px] text-slate-500 font-mono">Uso gratuito e ilimitado</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowDriveHelper(!showDriveHelper)}
                        className={`text-[8px] px-3 py-1 rounded-full font-black uppercase tracking-tighter transition-all cursor-pointer ${showDriveHelper ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-450 hover:bg-slate-700'}`}
                      >
                        {showDriveHelper ? '[ Cerrar ]' : '[ ¿Cómo? ]'}
                      </button>
                    </div>

                    {showDriveHelper && (
                      <div className="space-y-3 mt-3 pt-3 border-t border-slate-900 animate-in slide-in-from-top-3 duration-300">
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-slate-350 leading-relaxed font-sans font-medium">
                            1. Sube tu video a <strong className="text-white">Google Drive</strong>.
                          </p>
                          <p className="text-[9px] text-slate-350 leading-relaxed font-sans">
                            2. Cambia el acceso a <strong className="text-emerald-450">"Cualquier persona con el enlace"</strong>.
                          </p>
                          <p className="text-[9px] text-slate-350 leading-relaxed font-sans">
                            3. Pega la URL normal abajo. ¡La app la convertirá automáticamente!
                          </p>
                        </div>
                        <div className="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                          <p className="text-[8px] text-emerald-400 text-center leading-normal italic font-sans">
                            Evita el consumo de cuotas del servidor y es ultrarrápido.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* YouTube Block */}
                  <div className="bg-slate-950/60 border border-red-500/10 rounded-2xl p-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                          <Film className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase text-white tracking-widest">YouTube Ready</h4>
                          <p className="text-[9px] text-slate-500 font-mono">Prueba gratis e instantánea</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowYoutubeHelper(!showYoutubeHelper)}
                        className={`text-[8px] px-3 py-1 rounded-full font-black uppercase tracking-tighter transition-all cursor-pointer ${showYoutubeHelper ? 'bg-red-600 text-white' : 'bg-slate-800 text-red-400 hover:bg-slate-750'}`}
                      >
                        {showYoutubeHelper ? '[ Cerrar ]' : '[ ¿Cómo? ]'}
                      </button>
                    </div>

                    {showYoutubeHelper && (
                      <div className="space-y-3 mt-3 pt-3 border-t border-slate-900 animate-in slide-in-from-top-3 duration-300">
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-slate-350 leading-relaxed font-sans font-medium">
                            1. Copia el enlace del video de <strong className="text-white">YouTube</strong>.
                          </p>
                          <p className="text-[9px] text-slate-350 leading-relaxed font-sans">
                            2. Pégalo abajo; para reproducirse en bucle perfecto.
                          </p>
                        </div>
                        <div className="bg-red-500/5 p-2 rounded-xl border border-red-500/10 font-sans">
                          <p className="text-[8px] text-red-400 text-center leading-normal italic">
                            Perfecto para streaming publicitario directo sin demoras.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Drag-and-drop / Storage Uploader */}
                  {newContent.type !== 'text' && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 ml-1">Subida Directa Local</span>
                  <div 
                    id="upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      w-full mb-4 border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                      ${isDragging 
                        ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.15)] scale-[1.02]' 
                        : uploading 
                          ? 'bg-slate-900/45 border-rose-500/50 cursor-wait' 
                          : 'bg-slate-950/50 border-slate-700 hover:border-rose-500/40 hover:bg-slate-900/30'}
                    `}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="video/mp4,video/webm,video/quicktime,video/*,image/*,audio/mp3,audio/mpeg,audio/*"
                      onChange={handleFileUpload}
                    />
                    
                    {uploading ? (
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="relative">
                          <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                          <div className="absolute inset-0 bg-rose-500/10 rounded-full blur animate-pulse" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white mb-1 tracking-wide">Subiendo Archivo...</p>
                          <p className="text-[10px] font-mono text-rose-450 uppercase tracking-widest animate-pulse">Sincronizando con Supabase Storage</p>
                        </div>
                        
                        <div className="w-56 mt-2">
                          <div className="flex justify-between items-center mb-1 text-[9px] font-mono text-slate-500">
                            <span>PROGRESO</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-[2px] border border-white/5">
                            <div 
                              className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all duration-300 shadow-[0_0_8px_#f43f5e]" 
                              style={{ width: `${uploadProgress}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    ) : newContent.url ? (
                      (() => {
                        const ytId = getYouTubeId(newContent.url);
                        if (ytId) {
                          return (
                            <div className="w-full aspect-video rounded-xl overflow-hidden relative border border-red-500/20 shadow-lg" onClick={(e) => e.stopPropagation()}>
                              <iframe
                                title="YouTube Preview"
                                src={`https://www.youtube.com/embed/${ytId}?mute=1&playsinline=1`}
                                className="w-full h-full border-0"
                                allow="autoplay; encrypted-media"
                              />
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col items-center text-center text-emerald-400 space-y-2 p-2">
                            <div className="p-3 bg-emerald-500/10 rounded-full shadow-inner border border-emerald-500/20">
                              <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-white">¡Sincronizado con Éxito!</p>
                              <span className="inline-block mt-1 text-[9px] px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/20 text-emerald-400 font-extrabold font-mono rounded-full uppercase tracking-wider animate-pulse">
                                Storage Público Listo
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-mono truncate max-w-[280px] bg-slate-950/60 p-2 rounded-xl border border-white/5 w-full mt-2 select-all">{newContent.url}</p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl group-hover:scale-110 transition-transform">
                          <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-rose-500 transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-200">Arrastra o selecciona un archivo (Video, Imagen o MP3)</p>
                          <p className="text-[10px] text-slate-500 mt-1 max-w-[280px] leading-normal">
                            Los archivos se guardan de forma automática en tu bucket de <strong className="text-rose-450/90 font-black">Supabase</strong>.
                          </p>
                        </div>
                        
                        {/* Format Pills */}
                        <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                          <span className="text-[8px] font-extrabold font-mono uppercase bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-white/5 transition-all hover:border-rose-500/25">WEBM Soportado</span>
                          <span className="text-[8px] font-extrabold font-mono uppercase bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-white/5 transition-all hover:border-rose-500/25">MP4/MP3</span>
                          <span className="text-[8px] font-extrabold font-mono uppercase bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-emerald-500/20 transition-all hover:border-rose-500/25">Sincronía Auto</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: Metadatos y Configuración */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Metadatos & Configuración</span>
                <span className="h-px bg-slate-800 flex-1 ml-4" />
              </div>

              {/* 1. Identificador */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Identificador</label>
                <input 
                  required
                  className="w-full bg-slate-850/60 text-white px-5 py-3.5 rounded-2xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-rose-500/55 transition-all text-sm font-sans"
                  value={newContent.name}
                  onChange={e => setNewContent({...newContent, name: e.target.value})}
                  placeholder="Ej: Promo Verano V1"
                />
              </div>
              
              {/* 2. Format Button Selector */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Formato</label>
                <div className="grid grid-cols-4 gap-2">
                  {['video', 'image', 'audio', 'text'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewContent({...newContent, type: t as any})}
                      className={`
                        py-3 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer
                        ${newContent.type === t ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-900/20' : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-350 hover:bg-slate-800'}
                      `}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Dynamic content block */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">
                  {newContent.type === 'text' ? 'Contenido de Texto' : 'Archivo o URL Directa'}
                </label>

                {newContent.type === 'text' ? (
                  <textarea 
                    required
                    className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-sans text-sm"
                    value={newContent.url}
                    onChange={e => setNewContent({...newContent, url: e.target.value})}
                    placeholder="Escribe el mensaje..."
                    rows={4}
                  />
                ) : (
                  <div className="relative">
                    <input 
                      required
                      type="url"
                      className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-mono text-[10px]"
                      value={newContent.url}
                      onChange={e => setNewContent({...newContent, url: e.target.value})}
                      placeholder="https://cdn.leonisa.com/media/clip.mp4"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 font-mono uppercase">URL Directa</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block tracking-widest">Timing (seg)</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-slate-800/50 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-mono"
                  value={newContent.duration}
                  onChange={e => setNewContent({...newContent, duration: parseInt(e.target.value)})}
                />
              </div>

              <div className="flex gap-4 mt-8 pt-4 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:text-white transition-all text-[10px] uppercase tracking-widest cursor-pointer"
                >
                  Cerrar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 font-bold bg-rose-600 text-white rounded-2xl hover:bg-rose-500 shadow-lg shadow-rose-900/20 transition-all text-[10px] uppercase tracking-widest cursor-pointer"
                >
                  {contentToEdit ? 'Guardar Cambios' : 'Publicar Media'}
                </button>
              </div>

            </div> {/* End Columna Derecha */}
          </div> {/* End Grid */}
        </form>
          </div>
        </div>
      )}

      {/* Supabase Connection Configuration Modal */}
      {isSupaModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-xl p-6 sm:p-10 shadow-2xl border border-white/5 mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Server className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Sincronizar Supabase</h3>
                  <p className="text-xs text-slate-400">Verifica o ingresa tu enlace de conexión en vivo.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsSupaModalOpen(false)}
                className="text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSupaConfig} className="space-y-6">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-xs text-slate-400 leading-normal">
                  Puedes conectar directamente tu proyecto de Supabase para recuperar imágenes y videos desde tu bucket <code className="text-emerald-400 font-mono">&apos;signage-contents&apos;</code>.
                </p>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-slate-500">Estado actual:</span>
                  {hasSupaClient ? (
                    <span className="text-emerald-400 font-bold">&#9679; Conectado (En línea)</span>
                  ) : (
                    <span className="text-amber-500 font-bold">&#9679; Local Offline Sandbox</span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-2 tracking-widest">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    required
                    className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-xs"
                    value={supaUrl}
                    onChange={(e) => setSupaUrl(e.target.value)}
                    placeholder="https://gswqxygclbyepnpsptqp.supabase.co"
                  />
                  <p className="text-[9px] text-slate-500 mt-1 font-mono">
                    Ingresa el subdominio principal de tu API de Supabase.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-2 tracking-widest">
                    Supabase Anon/Public Key
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-xs resize-none"
                    value={supaKey}
                    onChange={(e) => setSupaKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                  <p className="text-[9px] text-slate-500 mt-1 font-mono">
                    Usa la clave ANON pública segura de tu proyecto de Supabase.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsSupaModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-all uppercase tracking-widest cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition-all uppercase tracking-widest cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Guardar y Sincronizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
