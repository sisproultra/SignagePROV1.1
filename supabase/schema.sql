-- ====================================================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS PARA SUPABASE
-- Proyecto: Leonisa Digital Signage (SignagePRO V1)
-- Propósito: Gestión y distribución remota de contenidos para pantallas publicitarias
-- ====================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. TABLA: stores (Tiendas)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name text NOT NULL,
    city text NOT NULL,
    address text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------
-- 2. TABLA: users (Usuarios y Roles)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id text PRIMARY KEY, -- ID proveniente de Supabase Auth o Firebase
    email text UNIQUE NOT NULL,
    role text NOT NULL DEFAULT 'screen' CHECK (role IN ('admin', 'screen')),
    name text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------
-- 3. TABLA: contents (Librería de Contenedores Multimedia)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contents (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('video', 'image', 'text')),
    url text NOT NULL,
    duration integer NOT NULL DEFAULT 15, -- Duración de reproducción en segundos
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------
-- 4. TABLA: playlists (Listas de Reproducción)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlists (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name text NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb, -- Almacena array con { contentId, name, type, duration }
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------
-- 5. TABLA: screens (Pantallas o Nodos de Reproducción)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screens (
    id text PRIMARY KEY, -- ID manual (ej: screen_1) o generado por UUID
    store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
    name text NOT NULL,
    location_in_store text,
    status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_seen timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    current_playlist_id text REFERENCES public.playlists(id) ON DELETE SET NULL,
    items jsonb DEFAULT '[]'::jsonb, -- Items de playlist directa exclusivos del nodo
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------
-- 6. TABLA: schedules (Programaciones Horarias)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedules (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    playlist_id text REFERENCES public.playlists(id) ON DELETE CASCADE,
    screen_ids text[] DEFAULT '{}'::text[], -- ID de pantallas asignadas
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    days text[] DEFAULT '{}'::text[], -- Días aplicables: monday, tuesday, etc.
    start_time text, -- Formato "HH:MM" (ej: "08:00")
    end_time text, -- Formato "HH:MM" (ej: "21:00")
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------
-- 7. TABLA: logs (Bitácora de Reproducción en Bucle)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logs (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    screen_id text,
    content_id text REFERENCES public.contents(id) ON DELETE SET NULL,
    playlist_id text,
    played_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    duration integer NOT NULL
);

-- ====================================================================
-- CONFIGURACIÓN DE SEGURIDAD (RLS) & ACCESOS PÚBLICOS PARA PRUEBAS
-- ====================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir Lectura/Escritura total de forma simplificada para desarrollo rápido
-- Nota: En producción real de Supabase puedes restringir 'authenticated'
CREATE POLICY "Permitir select público" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.stores FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update público" ON public.stores FOR UPDATE USING (true);
CREATE POLICY "Permitir delete público" ON public.stores FOR DELETE USING (true);

CREATE POLICY "Permitir select público" ON public.users FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update público" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Permitir select público" ON public.contents FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.contents FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update público" ON public.contents FOR UPDATE USING (true);
CREATE POLICY "Permitir delete público" ON public.contents FOR DELETE USING (true);

CREATE POLICY "Permitir select público" ON public.playlists FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.playlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update público" ON public.playlists FOR UPDATE USING (true);
CREATE POLICY "Permitir delete público" ON public.playlists FOR DELETE USING (true);

CREATE POLICY "Permitir select público" ON public.screens FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.screens FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update público" ON public.screens FOR UPDATE USING (true);
CREATE POLICY "Permitir delete público" ON public.screens FOR DELETE USING (true);

CREATE POLICY "Permitir select público" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update público" ON public.schedules FOR UPDATE USING (true);
CREATE POLICY "Permitir delete público" ON public.schedules FOR DELETE USING (true);

CREATE POLICY "Permitir select público" ON public.logs FOR SELECT USING (true);
CREATE POLICY "Permitir insert público" ON public.logs FOR INSERT WITH CHECK (true);

-- ====================================================================
-- CONFIGURACIÓN DE SUPABASE STORAGE (BUCKETS)
-- ====================================================================

-- 1. Crear el bucket 'signage-contents' de forma pública para reproducir videos en bucle sin redirecciones complejas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signage-contents', 'signage-contents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir que cualquier usuario acceda a descargar/ver archivos multimedia del bucket 'signage-contents'
CREATE POLICY "Permitir lectura de bucket publico" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'signage-contents');

-- 3. Permitir subidas directas al bucket 'signage-contents' para pruebas de loop de video
CREATE POLICY "Permitir insercion al bucket publico" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'signage-contents');

-- 4. Permitir eliminaciones en el bucket para mantención
CREATE POLICY "Permitir eliminaciones en bucket publico" 
ON storage.objects FOR DELETE 
TO public 
USING (bucket_id = 'signage-contents');

-- ====================================================================
-- SEMILLAS INICIALES (MOCK DATA) PARA PRUEBAS INMEDIATAS
-- ====================================================================
INSERT INTO public.stores (id, name, city, address) VALUES
('store_1', 'Leonisa CC El Tesoro', 'Medellín', 'Local 1420 - Planta Alta'),
('store_2', 'Leonisa CC Jockey Plaza', 'Lima', 'Primer Nivel - Pasillos de Accesorios'),
('store_3', 'Leonisa CC Andino', 'Bogotá', 'Local 215 - Sector Premium')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contents (id, name, type, url, duration) VALUES
('content_1', 'Campaña Activewear - Colección 2026', 'video', 'https://assets.mixkit.co/videos/preview/mixkit-running-in-the-forest-43187-large.mp4', 15),
('content_2', 'Lencería Seamless - Confort Sostenible', 'image', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=640', 10),
('content_3', 'Mensaje Corporativo - Promo 20%', 'text', 'Código de descuento: LEOLIVE20. Válido en toda la tienda física hoy.', 8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.playlists (id, name, items) VALUES
('playlist_1', 'Loop General - Vitrina Lanzamientos', '[{"contentId": "content_1", "name": "Campaña Activewear - Colección 2026", "type": "video", "duration": 15}, {"contentId": "content_2", "name": "Lencería Seamless - Confort Sostenible", "type": "image", "duration": 10}]'::jsonb),
('playlist_2', 'Loop Probadores - Consejos de Estilo', '[{"contentId": "content_2", "name": "Lencería Seamless - Confort Sostenible", "type": "image", "duration": 10}, {"contentId": "content_3", "name": "Mensaje Corporativo - Promo 20%", "type": "text", "duration": 8}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.screens (id, store_id, name, location_in_store, status, current_playlist_id) VALUES
('screen_1', 'store_1', 'Pantalla Vitrina Principal', 'Vitrina de ingreso principal de la tienda', 'online', 'playlist_1'),
('screen_2', 'store_1', 'Pantalla Probadores', 'Pasillo de probadores de lencería', 'offline', 'playlist_2'),
('screen_3', 'store_2', 'Pantalla Pasillo General', 'Sección de fajas y vestidos de baño', 'online', 'playlist_1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.schedules (id, playlist_id, screen_ids, name, active, days, start_time, end_time) VALUES
('schedule_1', 'playlist_1', '{screen_1, screen_3}', 'Campaña Seamless El Tesoro', true, '{monday, tuesday, wednesday, thursday, friday, saturday, sunday}', '08:00', '22:00'),
('schedule_2', 'playlist_2', '{screen_2}', 'Consejos de Probador CC El Tesoro', true, '{monday, tuesday, wednesday, thursday, friday, saturday, sunday}', '08:00', '22:00')
ON CONFLICT (id) DO NOTHING;
