/**
 * AI Novel Studio - Supabase API Client & Cloud Sync Layer
 * Manages Supabase Auth, PostgreSQL operations, and cloud sync for Stories, Chapters, Lorebook, and Wallet.
 */

import { SUPABASE_CONFIG } from '../config.js';

export class SupabaseClientManager {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.currentProfile = null;
    this.authListeners = [];
    this.init();
  }

  normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    let url = rawUrl.trim();
    url = url.replace(/\/rest\/v1\/?$/, '');
    url = url.replace(/\/+$/, '');
    return url;
  }

  getCredentials() {
    // Ưu tiên cấu hình hệ thống từ config.js cho nền tảng thương mại
    if (SUPABASE_CONFIG.URL && SUPABASE_CONFIG.ANON_KEY) {
      return {
        url: this.normalizeUrl(SUPABASE_CONFIG.URL),
        anonKey: SUPABASE_CONFIG.ANON_KEY.trim()
      };
    }

    try {
      const stored = localStorage.getItem('ainovel_supabase_config_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return {
            url: this.normalizeUrl(parsed.url),
            anonKey: parsed.anonKey.trim()
          };
        }
      }
    } catch {
      // Fallback
    }

    return { url: '', anonKey: '' };
  }

  init() {
    const creds = this.getCredentials();
    if (!creds.url || !creds.anonKey) {
      this.client = null;
      return false;
    }

    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
      try {
        this.client = window.supabase.createClient(creds.url, creds.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });

        // Setup auth state change listener
        this.client.auth.onAuthStateChange(async (event, session) => {
          this.currentUser = session?.user || null;
          if (this.currentUser) {
            await this.loadProfile();
          } else {
            // Kiểm tra phiên tác giả dự phòng nếu Supabase đang tắt Email Signup
            try {
              const stored = localStorage.getItem('ainovel_fallback_author');
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.user && parsed.profile) {
                  this.currentUser = parsed.user;
                  this.currentProfile = parsed.profile;
                }
              } else {
                this.currentProfile = null;
              }
            } catch {
              this.currentProfile = null;
            }
          }
          this.notifyAuthListeners(event, session);
        });

        return true;
      } catch (err) {
        console.error('Lỗi khởi tạo Supabase Client:', err);
        this.client = null;
        return false;
      }
    }
    return false;
  }

  isConfigured() {
    const creds = this.getCredentials();
    return Boolean(creds.url && creds.anonKey && this.client);
  }

  onAuthStateChange(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
    }
  }

  notifyAuthListeners(event, session) {
    for (const listener of this.authListeners) {
      try {
        listener(event, session, this.currentUser, this.currentProfile);
      } catch (e) {
        console.error('Lỗi listener Supabase:', e);
      }
    }
  }

  async getSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return data?.session || null;
  }

  async getUser() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getUser();
    this.currentUser = data?.user || null;
    return this.currentUser;
  }

  async signUp(email, password, displayName = '') {
    if (!this.client) throw new Error('Supabase chưa được cấu hình URL và Anon Key.');
    
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0]
          }
        }
      });

      if (error) throw error;
      this.currentUser = data.user;
      if (this.currentUser) {
        await this.loadProfile();
      }
      return data;
    } catch (err) {
      const msg = (err.message || String(err)).toLowerCase();
      // Nếu Supabase Project tắt Email Signups trong Dashboard
      if (msg.includes('email signups are disabled') || msg.includes('signup is disabled') || msg.includes('signups are disabled')) {
        console.warn('Supabase Email Signups đang tắt. Tự động kích hoạt Fallback Author Profile.');
        const fallbackId = 'author_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        const fallbackUser = {
          id: fallbackId,
          email: email,
          user_metadata: { display_name: displayName || email.split('@')[0] },
          created_at: new Date().toISOString()
        };
        const fallbackProfile = {
          id: fallbackId,
          email: email,
          display_name: displayName || email.split('@')[0],
          coin_balance: 50.0,
          total_spent: 0.0,
          created_at: new Date().toISOString()
        };

        this.currentUser = fallbackUser;
        this.currentProfile = fallbackProfile;
        localStorage.setItem('ainovel_fallback_author', JSON.stringify({
          user: fallbackUser,
          profile: fallbackProfile,
          password: password
        }));

        this.notifyAuthListeners('SIGNED_IN', { user: fallbackUser });
        return { user: fallbackUser, isFallback: true };
      }
      throw err;
    }
  }

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase chưa được cấu hình URL và Anon Key.');

    // Kiểm tra tài khoản tác giả dự phòng trước
    try {
      const stored = localStorage.getItem('ainovel_fallback_author');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user?.email === email && parsed.password === password) {
          this.currentUser = parsed.user;
          this.currentProfile = parsed.profile;
          this.notifyAuthListeners('SIGNED_IN', { user: parsed.user });
          return { user: parsed.user, isFallback: true };
        }
      }
    } catch {}

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    this.currentUser = data.user;
    if (this.currentUser) {
      await this.loadProfile();
    }
    return data;
  }

  async signOut() {
    localStorage.removeItem('ainovel_fallback_author');
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch {}
    }
    this.currentUser = null;
    this.currentProfile = null;
    this.notifyAuthListeners('SIGNED_OUT', null);
  }

  // --- Profile & Wallet Operations ---
  async loadProfile() {
    if (!this.client || !this.currentUser) return null;
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (!error && data) {
        this.currentProfile = data;
        return data;
      }

      // If profile doesn't exist yet, create it
      const newProfile = {
        id: this.currentUser.id,
        email: this.currentUser.email,
        display_name: this.currentUser.user_metadata?.display_name || this.currentUser.email.split('@')[0],
        coin_balance: 50.0,
        total_spent: 0.0
      };

      const { data: inserted, error: insertError } = await this.client
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (!insertError && inserted) {
        this.currentProfile = inserted;
        return inserted;
      }
    } catch (e) {
      console.warn('Không thể tải profile Supabase:', e);
    }
    return null;
  }

  async updateWallet(coinBalance, totalSpent = null) {
    if (!this.client || !this.currentUser) return null;
    try {
      const updateData = {
        coin_balance: coinBalance,
        updated_at: new Date().toISOString()
      };
      if (totalSpent !== null) {
        updateData.total_spent = totalSpent;
      }

      const { data, error } = await this.client
        .from('profiles')
        .update(updateData)
        .eq('id', this.currentUser.id)
        .select()
        .single();

      if (!error && data) {
        this.currentProfile = data;
      }
      return data;
    } catch (e) {
      console.error('Lỗi cập nhật ví Supabase:', e);
      return null;
    }
  }

  async addTransaction(type, amount, description) {
    if (!this.client || !this.currentUser) return null;
    try {
      const tx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        user_id: this.currentUser.id,
        type,
        amount,
        description,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.client
        .from('transactions')
        .insert([tx]);

      return !error ? tx : null;
    } catch (e) {
      console.warn('Lỗi ghi giao dịch Supabase:', e);
      return null;
    }
  }

  // --- Projects (Tủ Truyện) CRUD ---
  async fetchCloudProjects() {
    if (!this.client || !this.currentUser) return [];
    try {
      const { data: projects, error } = await this.client
        .from('projects')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch chapters & lorebook for each project
      const fullProjects = [];
      for (const p of (projects || [])) {
        const [chaptersRes, lorebookRes] = await Promise.all([
          this.client.from('chapters').select('*').eq('project_id', p.id).order('chapter_index', { ascending: true }),
          this.client.from('lorebook_entries').select('*').eq('project_id', p.id)
        ]);

        fullProjects.push({
          id: p.id,
          title: p.title,
          genre: p.genre || 'xianxia',
          authorName: p.author_name || 'Tác Giả',
          premise: p.premise || '',
          isPublic: Boolean(p.is_public),
          viewsCount: p.views_count || 0,
          followersCount: p.followers_count || 0,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          worldSettings: p.world_settings || {},
          rollingOutlines: p.rolling_outlines || [],
          chapters: (chaptersRes.data || []).map(c => ({
            id: c.id,
            chapterIndex: c.chapter_index,
            title: c.title,
            summary: c.summary,
            content: c.content,
            wordCount: c.word_count,
            updatedAt: c.updated_at
          })),
          lorebook: (lorebookRes.data || []).map(l => {
            const attrs = l.attributes || {};
            const rels = l.relationships || attrs._relationships || [];
            const cleanAttrs = { ...attrs };
            delete cleanAttrs._relationships;
            return {
              id: l.id,
              name: l.name,
              aliases: l.aliases || [],
              category: l.category,
              role: l.role,
              description: l.description,
              attributes: cleanAttrs,
              relationships: rels
            };
          })
        });
      }

      return fullProjects;
    } catch (e) {
      console.error('Lỗi tải danh sách truyện từ Supabase:', e);
      return [];
    }
  }

  // Lấy danh sách truyện công khai trên toàn cầu (cho Tủ Truyện Cộng Đồng)
  async fetchPublicCommunityProjects() {
    if (!this.client) return [];
    try {
      const { data: projects, error } = await this.client
        .from('projects')
        .select(`
          id,
          user_id,
          title,
          genre,
          author_name,
          premise,
          is_public,
          views_count,
          followers_count,
          created_at,
          updated_at
        `)
        .eq('is_public', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Không thể truy vấn projects công khai từ Supabase:', error.message);
        return [];
      }

      // Lấy danh sách tóm tắt chương cho các truyện công khai
      const publicNovels = [];
      for (const p of (projects || [])) {
        const { data: chapters } = await this.client
          .from('chapters')
          .select('id, chapter_index, title, word_count, updated_at')
          .eq('project_id', p.id)
          .order('chapter_index', { ascending: true });

        const chapterList = chapters || [];
        const totalWords = chapterList.reduce((sum, c) => sum + (c.word_count || 0), 0);

        publicNovels.push({
          id: p.id,
          userId: p.user_id,
          title: p.title,
          genre: p.genre || 'xianxia',
          authorName: p.author_name || 'Vô Danh',
          premise: p.premise || '',
          isPublic: true,
          viewsCount: p.views_count || 0,
          followersCount: p.followers_count || 0,
          chaptersCount: chapterList.length,
          totalWords: totalWords,
          chapters: chapterList,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        });
      }

      return publicNovels;
    } catch (e) {
      console.error('Lỗi tải truyện công khai cộng đồng:', e);
      return [];
    }
  }

  // Toggle trạng thái đăng công khai / gỡ xuống của một bộ truyện
  async togglePublishProject(projectId, isPublic) {
    if (!this.client || !this.currentUser) return false;
    try {
      const { error } = await this.client
        .from('projects')
        .update({
          is_public: isPublic,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', this.currentUser.id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Lỗi chuyển trạng thái công khai:', e);
      return false;
    }
  }

  // Tăng lượt đọc của truyện
  async incrementProjectViews(projectId) {
    if (!this.client) return;
    try {
      const { data: proj } = await this.client
        .from('projects')
        .select('views_count')
        .eq('id', projectId)
        .single();

      if (proj) {
        await this.client
          .from('projects')
          .update({ views_count: (proj.views_count || 0) + 1 })
          .eq('id', projectId);
      }
    } catch {
      // Non-blocking
    }
  }

  // Đọc nội dung 1 chương cụ thể của truyện công khai
  async fetchPublicChapterContent(projectId, chapterIndex) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('chapters')
        .select('*')
        .eq('project_id', projectId)
        .eq('chapter_index', chapterIndex)
        .single();

      if (!error && data) return data;
    } catch (e) {
      console.error('Lỗi tải nội dung chương:', e);
    }
    return null;
  }

  async saveCloudProject(project) {
    if (!this.client || !this.currentUser) return null;
    try {
      const projectRow = {
        id: project.id,
        user_id: this.currentUser.id,
        title: project.title,
        genre: project.genre || 'xianxia',
        author_name: project.authorName || 'Vô Danh',
        premise: project.premise || '',
        is_public: Boolean(project.isPublic),
        views_count: project.viewsCount || 0,
        followers_count: project.followersCount || 0,
        world_settings: project.worldSettings || {},
        rolling_outlines: project.rollingOutlines || [],
        updated_at: new Date().toISOString()
      };

      const { error: projErr } = await this.client
        .from('projects')
        .upsert(projectRow, { onConflict: 'id' });

      if (projErr) throw projErr;

      // Upsert chapters
      if (Array.isArray(project.chapters) && project.chapters.length > 0) {
        const chapterRows = project.chapters.map(c => ({
          id: c.id,
          project_id: project.id,
          user_id: this.currentUser.id,
          chapter_index: c.chapterIndex || 1,
          title: c.title || 'Chương Chưa Đặt Tên',
          summary: c.summary || '',
          content: c.content || '',
          word_count: c.wordCount || 0,
          updated_at: c.updatedAt || new Date().toISOString()
        }));

        await this.client.from('chapters').upsert(chapterRows, { onConflict: 'id' });
      }

      // Upsert lorebook
      if (Array.isArray(project.lorebook) && project.lorebook.length > 0) {
        const loreRows = project.lorebook.map(l => ({
          id: l.id,
          project_id: project.id,
          user_id: this.currentUser.id,
          name: l.name,
          aliases: l.aliases || [],
          category: l.category || 'character',
          role: l.role || '',
          description: l.description || '',
          attributes: { ...(l.attributes || {}), _relationships: l.relationships || [] },
          updated_at: new Date().toISOString()
        }));

        await this.client.from('lorebook_entries').upsert(loreRows, { onConflict: 'id' });
      }

      return true;
    } catch (e) {
      console.error('Lỗi lưu truyện lên Supabase:', e);
      return false;
    }
  }

  async deleteCloudProject(projectId) {
    if (!this.client || !this.currentUser) return false;
    try {
      const { error } = await this.client
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', this.currentUser.id);

      return !error;
    } catch (e) {
      console.error('Lỗi xóa truyện trên Supabase:', e);
      return false;
    }
  }

  async saveCloudChapter(chapter, projectId) {
    if (!this.client || !this.currentUser) return false;
    try {
      const row = {
        id: chapter.id,
        project_id: projectId,
        user_id: this.currentUser.id,
        chapter_index: chapter.chapterIndex,
        title: chapter.title,
        summary: chapter.summary || '',
        content: chapter.content || '',
        word_count: chapter.wordCount || 0,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from('chapters')
        .upsert(row, { onConflict: 'id' });

      return !error;
    } catch (e) {
      console.error('Lỗi lưu chương lên Supabase:', e);
      return false;
    }
  }

  async deleteCloudChapter(chapterId) {
    if (!this.client || !this.currentUser) return false;
    try {
      const { error } = await this.client
        .from('chapters')
        .delete()
        .eq('id', chapterId)
        .eq('user_id', this.currentUser.id);

      return !error;
    } catch (e) {
      console.error('Lỗi xóa chương trên Supabase:', e);
      return false;
    }
  }

  async saveCloudLorebookEntry(entry, projectId) {
    if (!this.client || !this.currentUser) return false;
    try {
      const row = {
        id: entry.id,
        project_id: projectId,
        user_id: this.currentUser.id,
        name: entry.name,
        aliases: entry.aliases || [],
        category: entry.category || 'character',
        role: entry.role || '',
        description: entry.description || '',
        attributes: entry.attributes || {},
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from('lorebook_entries')
        .upsert(row, { onConflict: 'id' });

      return !error;
    } catch (e) {
      console.error('Lỗi lưu lorebook lên Supabase:', e);
      return false;
    }
  }
}

export const supabaseManager = new SupabaseClientManager();
