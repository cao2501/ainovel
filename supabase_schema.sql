-- ==============================================================================
-- AI NOVEL STUDIO - SUPABASE POSTGRESQL DATABASE SCHEMA
-- Hỗ trợ lưu trữ Đám Mây: Người dùng, Tủ Truyện, Danh Sách Chương, Lorebook & Ví Xu
-- Script này được thiết kế IDEMPOTENT (có thể chạy lại nhiều lần mà không bị lỗi)
-- ==============================================================================

-- Bật UUID extension nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. BẢNG HỒ SƠ TÁC GIẢ & VÍ XU (PROFILES)
-- Liên kết trực tiếp với bảng auth.users của Supabase
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT DEFAULT 'Tác Giả',
    avatar_url TEXT,
    coin_balance NUMERIC(10, 2) DEFAULT 50.00,
    total_spent NUMERIC(10, 2) DEFAULT 0.00,
    last_daily_checkin DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt Row-Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Chính sách RLS cho Profiles: Drop trước khi tạo để tránh lỗi 42710
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Trigger tự động tạo profile khi người dùng đăng ký tài khoản mới qua Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, coin_balance, total_spent)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        50.00,
        0.00
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 2. BẢNG TỦ TRUYỆN (PROJECTS)
-- Lưu trữ thông tin tiểu thuyết của tác giả
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    genre TEXT DEFAULT 'xianxia',
    author_name TEXT DEFAULT 'Vô Danh',
    premise TEXT DEFAULT '',
    is_public BOOLEAN DEFAULT false,
    views_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    world_settings JSONB DEFAULT '{}'::jsonb,
    rolling_outlines JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hỗ trợ thêm cột cho database đã tạo sẵn trước đó
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- Index tìm kiếm theo tác giả và công khai
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON public.projects(is_public);

-- RLS cho Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage own projects"
    ON public.projects FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view published projects" ON public.projects;
CREATE POLICY "Public can view published projects"
    ON public.projects FOR SELECT
    USING (is_public = true OR auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 3. BẢNG CHƯƠNG HỒI (CHAPTERS)
-- Lưu trữ từng chương truyện thuộc về một bộ truyện
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chapters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_index INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    content TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tìm kiếm chương theo truyện và thứ tự
CREATE INDEX IF NOT EXISTS idx_chapters_project_index ON public.chapters(project_id, chapter_index ASC);
CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON public.chapters(user_id);

-- RLS cho Chapters
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chapters" ON public.chapters;
CREATE POLICY "Users can manage own chapters"
    ON public.chapters FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view published chapters" ON public.chapters;
CREATE POLICY "Public can view published chapters"
    ON public.chapters FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE public.projects.id = public.chapters.project_id 
            AND (public.projects.is_public = true OR public.projects.user_id = auth.uid())
        )
    );


-- ------------------------------------------------------------------------------
-- 4. BẢNG HỒ SƠ THẾ GIỚI & NHÂN VẬT (LOREBOOK_ENTRIES)
-- Codex ghi nhận nhân vật, địa danh, công pháp, bảo vật
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lorebook_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    aliases JSONB DEFAULT '[]'::jsonb,
    category TEXT DEFAULT 'character',
    role TEXT DEFAULT '',
    description TEXT DEFAULT '',
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tìm kiếm Lorebook
CREATE INDEX IF NOT EXISTS idx_lorebook_project_id ON public.lorebook_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_lorebook_user_id ON public.lorebook_entries(user_id);

-- RLS cho Lorebook
ALTER TABLE public.lorebook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own lorebook" ON public.lorebook_entries;
CREATE POLICY "Users can manage own lorebook"
    ON public.lorebook_entries FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 5. BẢNG LỊCH SỬ GIAO DỊCH XU (TRANSACTIONS)
-- Ghi nhận lịch sử nạp, tiêu Xu và nhận thưởng hàng ngày
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'topup', 'spend', 'bonus'
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tìm kiếm giao dịch
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id, created_at DESC);

-- RLS cho Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- HOÀN TẤT SCHEMA (IDEMPOTENT & SAFE TO RE-RUN)
-- ==============================================================================
