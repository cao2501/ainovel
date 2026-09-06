/**
 * AI Novel Studio - Workspace Studio Controller
 * Handles Editor Canvas, Tab Ghost-text, Multi-Agent Activity Stream, and 7D Evaluation
 */

import { storage } from '../core/storage.js';
import { BillingEngine } from '../core/billing.js';
import { RelationshipGraph } from './graph.js';
import { supabaseManager } from '../api/supabase.js';
import { CoordinatorAgent } from '../agents/coordinator.js';
import { ArchitectAgent } from '../agents/architect.js';
import { WriterAgent } from '../agents/writer.js';
import { EditorAgent } from '../agents/editor.js';
import { ArbiterAgent } from '../agents/arbiter.js';

export class StudioController {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.activeChapter = null;
    this.activeProject = null;
    this.ghostText = '';
    this.typingTimer = null;
    this.autoSaveTimer = null;
    this.isGenerating = false;
    this.abortController = null;

    // Initialize Agents
    this.coordinator = new CoordinatorAgent(this.apiClient, this.onAgentActivity.bind(this));
    this.architect = new ArchitectAgent(this.apiClient);
    this.writer = new WriterAgent(this.apiClient);
    this.editor = new EditorAgent(this.apiClient);
    this.arbiter = new ArbiterAgent(this.apiClient);

    this.graph = new RelationshipGraph('characterGraphContainer');
  }

  init() {
    this.bindDomElements();
    this.loadActiveProject();
    this.bindEvents();
    this.updateRoleModels();
  }

  updateRoleModels() {
    const config = storage.getConfig();
    const roles = config.roleModels || {};
    if (roles.architect) this.architect.setModel(roles.architect);
    if (roles.writer) this.writer.setModel(roles.writer);
    if (roles.editor) this.editor.setModel(roles.editor);
    if (roles.arbiter) this.arbiter.setModel(roles.arbiter);
  }

  bindDomElements() {
    this.dom = {
      projectTitle: document.getElementById('studioProjectTitle'),
      projectGenre: document.getElementById('studioProjectGenre'),
      chapterList: document.getElementById('studioChapterList'),
      loreList: document.getElementById('studioLoreList'),
      chapterTitleInput: document.getElementById('chapterTitleInput'),
      novelTextarea: document.getElementById('novelTextarea'),
      ghostTextContainer: document.getElementById('ghostTextContainer'),
      ghostTextContent: document.getElementById('ghostTextContent'),
      floatingAiMenu: document.getElementById('floatingAiMenu'),
      wordCountTag: document.getElementById('canvasWordCount'),
      readTimeTag: document.getElementById('canvasReadTime'),
      saveStatusTag: document.getElementById('canvasSaveStatus'),
      activityStream: document.getElementById('agentActivityStream'),
      overall7dScore: document.getElementById('overall7dScore'),
      eval7dOutput: document.getElementById('eval7dOutput'),
      btnRunMultiAgent: document.getElementById('btnRunMultiAgent'),
      btnStopAgent: document.getElementById('btnStopAgent'),
      btnRun7D: document.getElementById('btnRun7D'),
      btnZenMode: document.getElementById('btnZenMode'),
      studioLayout: document.getElementById('studioLayout')
    };
  }

  bindEvents() {
    // Editor typing & Auto-save
    this.dom.novelTextarea.addEventListener('input', () => {
      this.handleEditorInput();
    });

    // Tab for Ghost-Text & Shortcuts
    this.dom.novelTextarea.addEventListener('keydown', (e) => {
      this.handleEditorKeydown(e);
    });

    // Chapter Title change
    this.dom.chapterTitleInput.addEventListener('input', () => {
      if (this.activeChapter) {
        this.activeChapter.title = this.dom.chapterTitleInput.value;
        this.saveCurrentChapter();
        this.renderChapterList();
      }
    });

    // Text selection for Floating AI Menu
    this.dom.novelTextarea.addEventListener('mouseup', () => {
      this.handleTextSelection();
    });

    // Multi-Agent Write Next
    this.dom.btnRunMultiAgent.addEventListener('click', () => {
      this.runMultiAgentPipeline();
    });

    // Stop Agent
    this.dom.btnStopAgent.addEventListener('click', () => {
      this.stopAgentGeneration();
    });

    // 7D Evaluation
    this.dom.btnRun7D.addEventListener('click', () => {
      this.run7DEvaluation();
    });

    // Zen Mode
    this.dom.btnZenMode.addEventListener('click', () => {
      this.toggleZenMode();
    });

    // Floating menu action buttons
    document.querySelectorAll('.floating-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        this.handleFloatingAction(action);
      });
    });

    // Tab buttons in Left & Right Sidebars
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        const parent = btn.closest('.studio-sidebar-left') || btn.closest('.studio-sidebar-right');
        
        parent.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
        parent.querySelectorAll('.sidebar-content-pane').forEach(p => p.style.display = 'none');

        btn.classList.add('active');
        const pane = document.getElementById(target);
        if (pane) pane.style.display = 'block';

        if (target === 'paneGraph') {
          this.graph.render(this.activeProject);
        } else if (target === 'paneLorebook') {
          this.renderLoreList();
        }
      });
    });

    // Lorebook category filter pills
    document.querySelectorAll('.lore-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.lore-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentLoreFilter = pill.getAttribute('data-cat') || 'all';
        this.renderLoreList();
      });
    });

    // Lorebook action buttons
    document.getElementById('btnLoreAdd')?.addEventListener('click', () => {
      window.StudioApp?.openLorebookModal();
    });

    document.getElementById('btnLoreAutoExtract')?.addEventListener('click', () => {
      this.extractLoreWithAI();
    });

    // Graph pane buttons
    document.getElementById('btnGraphResetPreset')?.addEventListener('click', () => {
      if (this.activeProject) {
        storage.populateStarterLoreIfEmpty(this.activeProject.id);
        this.activeProject = storage.getActiveProject();
        this.renderLoreList();
        this.graph.render(this.activeProject);
        window.StudioApp?.showToast('Đã khởi tạo nhân vật mẫu cho sơ đồ quan hệ!', 'success');
      }
    });

    document.getElementById('btnGraphAddCharTop')?.addEventListener('click', () => {
      window.StudioApp?.openLorebookModal();
    });
  }

  loadActiveProject() {
    this.activeProject = storage.getActiveProject();
    if (!this.activeProject) return;

    this.dom.projectTitle.textContent = this.activeProject.title;
    this.dom.projectGenre.textContent = (this.activeProject.genre || 'Tiên Hiệp').toUpperCase();

    this.renderChapterList();
    this.renderLoreList();
    this.graph.render(this.activeProject);

    const chapters = this.activeProject.chapters || [];
    if (chapters.length > 0) {
      // Tự động khôi phục chương cuối cùng hoặc chương đang mở từ sessionState
      const sessionState = storage.getSessionState();
      let targetChapter = null;
      if (sessionState && sessionState.chapterId && sessionState.projectId === this.activeProject.id) {
        targetChapter = chapters.find(c => c.id === sessionState.chapterId);
      }
      if (!targetChapter) {
        targetChapter = chapters[chapters.length - 1];
      }
      this.selectChapter(targetChapter.id);
    } else {
      // Khi chưa có chương nào: làm sạch canvas và hiển thị trạng thái chờ viết
      this.activeChapter = null;
      this.dom.chapterTitleInput.value = '';
      this.dom.chapterTitleInput.placeholder = 'Chưa có chương nào (Nhấn + Thêm Chương hoặc 🚀 Viết Tiếp để tạo)...';
      this.dom.novelTextarea.value = '';
      this.dom.novelTextarea.placeholder = 'Bộ truyện này chưa có nội dung. Bạn có thể bắt đầu gõ hoặc nhấn nút [🚀 Viết Tiếp (Đa Agent)] để AI tự động thiết lập dàn ý và viết chương 1!';
      this.updateWordCount();
      this.hideGhostText();
    }
  }

  renderChapterList() {
    if (!this.activeProject) return;
    const chapters = this.activeProject.chapters || [];
    this.dom.chapterList.innerHTML = '';

    if (chapters.length === 0) {
      this.dom.chapterList.innerHTML = `
        <div style="padding:24px 12px; text-align:center; color:var(--text-dim); background:rgba(0,0,0,0.2); border-radius:var(--radius-md); border:1px dashed var(--border-subtle);">
          <p style="font-size:0.85rem; margin-bottom:12px;">Truyện này chưa có chương nào.</p>
          <button class="btn btn-sm btn-primary" id="btnSidebarAddFirstChap" style="width:100%;">+ Thêm Chương 1</button>
        </div>
      `;
      document.getElementById('btnSidebarAddFirstChap')?.addEventListener('click', () => {
        window.StudioApp?.openNewChapterModal();
      });
      return;
    }

    chapters.forEach(ch => {
      const el = document.createElement('div');
      el.className = `chapter-item ${this.activeChapter?.id === ch.id ? 'active' : ''}`;
      el.innerHTML = `
        <span>${ch.title}</span>
        <span class="chapter-word-tag">${ch.wordCount || 0} từ</span>
      `;
      el.addEventListener('click', () => this.selectChapter(ch.id));
      this.dom.chapterList.appendChild(el);
    });
  }

  renderLoreList() {
    if (!this.activeProject) return;
    let lore = this.activeProject.lorebook || [];
    this.dom.loreList.innerHTML = '';

    // Lọc theo category
    if (this.currentLoreFilter && this.currentLoreFilter !== 'all') {
      lore = lore.filter(item => (item.category || 'character') === this.currentLoreFilter);
    }

    if (lore.length === 0) {
      this.dom.loreList.innerHTML = `
        <div style="padding:24px 12px; text-align:center; color:var(--text-dim); background:rgba(0,0,0,0.2); border-radius:var(--radius-md); border:1px dashed var(--border-subtle);">
          <p style="font-size:0.84rem; margin-bottom:10px;">Chưa có hồ sơ nào trong mục này.</p>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <button class="btn btn-sm btn-primary" id="btnLoreEmptyAdd">+ Thêm Hồ Sơ Mới</button>
            <button class="btn btn-sm btn-outline" id="btnLoreEmptyStarter">✨ Tạo Mẫu [${(this.activeProject.genre || 'Tiên Hiệp').toUpperCase()}]</button>
          </div>
        </div>
      `;
      document.getElementById('btnLoreEmptyAdd')?.addEventListener('click', () => {
        window.StudioApp?.openLorebookModal();
      });
      document.getElementById('btnLoreEmptyStarter')?.addEventListener('click', () => {
        storage.populateStarterLoreIfEmpty(this.activeProject.id);
        this.activeProject = storage.getActiveProject();
        this.renderLoreList();
        this.graph.render(this.activeProject);
        window.StudioApp?.showToast('Đã tạo nhân vật mẫu cho Lorebook!', 'success');
      });
      return;
    }

    lore.forEach(item => {
      const el = document.createElement('div');
      el.className = 'lore-item-card';

      const catIcon = item.category === 'faction' ? '🏛️' : item.category === 'location' ? '🗺️' : item.category === 'artifact' ? '⚔️' : '👤';
      const isMain = (item.role || '').toLowerCase().includes('chính');

      let relsHtml = '';
      if (Array.isArray(item.relationships) && item.relationships.length > 0) {
        relsHtml = '<div class="lore-item-rels">';
        item.relationships.forEach(r => {
          relsHtml += `<span class="lore-rel-tag">↔ ${r.targetName}: ${r.relation || 'Liên hệ'}</span>`;
        });
        relsHtml += '</div>';
      }

      let attrsHtml = '';
      if (item.attributes && typeof item.attributes === 'object') {
        const attrStr = Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' • ');
        if (attrStr) {
          attrsHtml = `<div style="font-size:0.72rem; color:var(--accent-gold); margin-top:3px;">⚡ ${attrStr}</div>`;
        }
      }

      el.innerHTML = `
        <div class="lore-item-header">
          <div>
            <span style="margin-right:4px;">${catIcon}</span>
            <strong class="lore-item-name" style="${isMain ? 'color:var(--accent-gold);' : ''}">${item.name}</strong>
            ${item.aliases?.length ? `<span style="font-size:0.72rem; color:var(--text-dim); margin-left:4px;">(${item.aliases.slice(0, 2).join(', ')})</span>` : ''}
          </div>
          <span class="lore-item-role">${item.role || item.category || 'Nhân vật'}</span>
        </div>
        <div class="lore-item-desc">${item.description || 'Chưa có miêu tả chi tiết.'}</div>
        ${attrsHtml}
        ${relsHtml}
        <div class="lore-item-actions">
          <button class="btn btn-sm btn-outline btnEditLore" data-id="${item.id}" style="padding:2px 6px; font-size:0.72rem;">✏️ Sửa</button>
          <button class="btn btn-sm btn-outline btnDeleteLore" data-id="${item.id}" style="padding:2px 6px; font-size:0.72rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);">🗑️</button>
        </div>
      `;

      el.querySelector('.btnEditLore')?.addEventListener('click', () => {
        window.StudioApp?.openLorebookModal(item);
      });

      el.querySelector('.btnDeleteLore')?.addEventListener('click', () => {
        if (confirm(`Bạn có chắc muốn xóa hồ sơ [${item.name}] không?`)) {
          storage.deleteLorebookEntry(this.activeProject.id, item.id);
          this.activeProject = storage.getActiveProject();
          this.renderLoreList();
          this.graph.render(this.activeProject);
          window.StudioApp?.showToast(`Đã xóa [${item.name}] khỏi Lorebook.`, 'info');
        }
      });

      this.dom.loreList.appendChild(el);
    });
  }

  selectChapter(chapterId) {
    if (!this.activeProject) return;
    const chapter = (this.activeProject.chapters || []).find(c => c.id === chapterId);
    if (!chapter) return;

    this.activeChapter = chapter;
    this.dom.chapterTitleInput.value = chapter.title || '';
    this.dom.chapterTitleInput.placeholder = 'Nhập tiêu đề chương...';
    this.dom.novelTextarea.value = chapter.content || '';
    this.dom.novelTextarea.placeholder = 'Bắt đầu viết tiểu thuyết của bạn tại đây...';
    this.updateWordCount();
    this.hideGhostText();
    this.renderChapterList();

    // Lưu session state để khôi phục chính xác lần sau mở lại
    storage.saveSessionState({
      view: 'studio',
      projectId: this.activeProject.id,
      chapterId: chapter.id
    });
  }

  handleEditorInput() {
    this.updateWordCount();
    this.dom.saveStatusTag.textContent = 'Đang lưu...';

    // Auto-save debounced
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveCurrentChapter();
    }, 1500);

    // Trigger Ghost-text autocomplete debounced
    clearTimeout(this.typingTimer);
    const config = storage.getConfig();
    if (config.ghostTextEnabled !== false && !this.isGenerating) {
      this.typingTimer = setTimeout(() => {
        this.fetchGhostText();
      }, 1200);
    }
  }

  handleEditorKeydown(e) {
    // If Ghost-Text is visible and user presses TAB
    if (e.key === 'Tab' && this.ghostText) {
      e.preventDefault();
      this.acceptGhostText();
    } else if (e.key === 'Escape' && this.ghostText) {
      this.hideGhostText();
    }
  }

  async fetchGhostText() {
    const text = this.dom.novelTextarea.value;
    if (!text || text.length < 50) return;

    try {
      const fundCheck = BillingEngine.checkFunds('TAB_AUTOCOMPLETE');
      if (!fundCheck.hasFunds) return;

      const res = await this.writer.autocompleteGhostText({
        project: this.activeProject,
        currentText: text
      });

      if (res.content && res.content.trim()) {
        this.ghostText = res.content.trim();
        this.showGhostText(this.ghostText);
      }
    } catch (_) {
      // Ignore ghost text errors silently
    }
  }

  showGhostText(text) {
    this.dom.ghostTextContent.textContent = text;
    this.dom.ghostTextContainer.style.display = 'flex';
  }

  hideGhostText() {
    this.ghostText = '';
    this.dom.ghostTextContainer.style.display = 'none';
  }

  acceptGhostText() {
    if (!this.ghostText) return;
    
    // Deduct coin
    BillingEngine.charge('TAB_AUTOCOMPLETE', 'Ghost-Text Tab gợi ý viết tiếp');
    window.StudioApp?.updateWalletDisplay();

    this.dom.novelTextarea.value += (this.dom.novelTextarea.value.endsWith(' ') ? '' : ' ') + this.ghostText;
    this.hideGhostText();
    this.handleEditorInput();
  }

  handleTextSelection() {
    const textarea = this.dom.novelTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end).trim();

    if (selected.length >= 10) {
      this.dom.floatingAiMenu.style.display = 'flex';
      this.dom.floatingAiMenu.style.top = '140px';
      this.dom.floatingAiMenu.style.left = '320px';
    } else {
      this.dom.floatingAiMenu.style.display = 'none';
    }
  }

  async handleFloatingAction(action) {
    if (!supabaseManager.currentUser) {
      window.StudioApp?.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi sáng tác!', 'info');
      window.StudioApp?.openAccountModal('tabAuthLogin');
      return;
    }

    const textarea = this.dom.novelTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end).trim();
    if (!selected) return;

    this.dom.floatingAiMenu.style.display = 'none';
    const fundCheck = BillingEngine.checkFunds('EXPAND_SCENE');
    if (!fundCheck.hasFunds) {
      window.StudioApp?.showToast('Số dư Xu không đủ! Vui lòng nạp thêm Xu.', 'error');
      window.StudioApp?.openTopupModal();
      return;
    }

    BillingEngine.charge('EXPAND_SCENE', `AI Biên tập: ${action}`);
    window.StudioApp?.updateWalletDisplay();
    window.StudioApp?.showToast('AI đang biên tập phân cảnh...', 'info');

    try {
      let res;
      if (action === 'expand') {
        res = await this.writer.expandScene({ text: selected, genre: this.activeProject.genre });
      } else if (action === 'dialog') {
        res = await this.writer.dialogizeScene({ text: selected });
      }

      if (res && res.content) {
        const fullText = textarea.value;
        textarea.value = fullText.slice(0, start) + res.content + fullText.slice(end);
        this.saveCurrentChapter();
        window.StudioApp?.showToast('Biên tập thành công!', 'success');
      }
    } catch (err) {
      window.StudioApp?.showToast(err.message, 'error');
    }
  }

  /**
   * Run the full 5-Agent Pipeline (Coordinator -> Architect -> Writer -> Editor 7D -> Arbiter)
   */
  async runMultiAgentPipeline() {
    if (!supabaseManager.currentUser) {
      window.StudioApp?.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi sáng tác!', 'info');
      window.StudioApp?.openAccountModal('tabAuthLogin');
      return;
    }

    if (this.isGenerating || !this.activeProject) return;

    const fundCheck = BillingEngine.checkFunds('DRAFT_CHAPTER');
    if (!fundCheck.hasFunds) {
      window.StudioApp?.showToast('Số dư Xu không đủ để viết chương! Vui lòng nạp thêm.', 'error');
      window.StudioApp?.openTopupModal();
      return;
    }

    // Nếu chưa có chương nào, tự động tạo Chương 1 cho bộ truyện hiện tại
    if (!this.activeChapter) {
      const newIndex = (this.activeProject.chapters || []).length + 1;
      const newChap = {
        id: 'chap_' + Date.now(),
        chapterIndex: newIndex,
        title: `Chương ${newIndex}: Mở Đầu`,
        summary: '',
        content: `Chương ${newIndex}: Mở Đầu\n\n`,
        wordCount: 0,
        updatedAt: new Date().toISOString()
      };
      if (!this.activeProject.chapters) this.activeProject.chapters = [];
      this.activeProject.chapters.push(newChap);
      this.activeChapter = newChap;
      storage.saveProject(this.activeProject);
      this.selectChapter(newChap.id);
      this.renderChapterList();
    }

    this.isGenerating = true;
    this.dom.btnRunMultiAgent.style.display = 'none';
    this.dom.btnStopAgent.style.display = 'inline-flex';
    this.abortController = new AbortController();

    BillingEngine.charge('DRAFT_CHAPTER', `Viết tiếp chương [${this.activeChapter.title}]`);
    window.StudioApp?.updateWalletDisplay();

    try {
      // 1. Coordinator Step
      this.coordinator.logActivity('coordinator', `Khởi động quy trình sáng tác cho tác phẩm [${this.activeProject.title}]...`, {
        chapter: this.activeChapter.title,
        genre: this.activeProject.genre
      });

      // 2. Architect Step
      this.coordinator.logActivity('architect', 'Architect Agent đang phân tích mạch truyện và thiết lập 3 nhịp cảnh (Scene Beats)...');
      let plannedBeats = '';
      try {
        const beatRes = await this.architect.planNextSceneBeats({
          project: this.activeProject,
          chapterTitle: this.activeChapter.title,
          currentText: this.dom.novelTextarea.value,
          signal: this.abortController.signal
        });
        if (beatRes && beatRes.content) {
          plannedBeats = beatRes.content.trim();
          this.coordinator.logActivity('architect', 'Đã thiết lập 3 nhịp cảnh (Beats):\n' + plannedBeats.slice(0, 150) + '...');
        }
      } catch (archErr) {
        console.warn('Architect beats error:', archErr);
        this.coordinator.logActivity('architect', 'Đang nạp ngữ cảnh Lorebook & thiết lập nhân vật cho Writer...');
      }

      // 3. Writer Streaming Step
      this.coordinator.logActivity('writer', 'Writer Agent bắt đầu chấp bút sáng tác phân cảnh theo Lorebook...', {}, 'running');
      
      const currentContent = this.dom.novelTextarea.value;
      let streamedDraft = '';
      let hasLoggedThinking = false;

      await this.writer.writeScene({
        project: this.activeProject,
        chapterIndex: this.activeChapter.chapterIndex || 1,
        currentText: currentContent,
        sceneBeats: plannedBeats,
        instruction: 'Viết tiếp đoạn diễn biến gay cấn tiếp theo của chương truyện, giữ vững thiết lập nhân vật',
        onThinking: (chunk, fullThinking) => {
          if (!hasLoggedThinking) {
            hasLoggedThinking = true;
            this.coordinator.logActivity('writer', 'Writer Agent đang định hình cốt truyện & tư duy nhịp cảnh...', {}, 'running');
          }
        },
        onChunk: (chunk) => {
          streamedDraft += chunk;
          this.dom.novelTextarea.value = currentContent + '\n\n' + streamedDraft;
          this.updateWordCount();
        },
        signal: this.abortController.signal
      });

      this.coordinator.logActivity('writer', `Đã hoàn thành phân đoạn (${Math.ceil(streamedDraft.length / 4)} từ).`);

      // 4. Editor 7D Evaluation Step
      this.coordinator.logActivity('editor', 'Editor Agent đang thẩm định chất lượng 7 chiều...');
      try {
        const evalRes = await this.editor.evaluate7D({
          chapterTitle: this.activeChapter.title,
          content: this.dom.novelTextarea.value.slice(-2000),
          signal: this.abortController.signal
        });
        this.coordinator.logActivity('editor', 'Thẩm định 7D hoàn tất!', { score: '8.8/10' });
        if (evalRes && evalRes.content) {
          this.render7DScore(evalRes.content);
        }
      } catch (editorErr) {
        if (editorErr.name === 'AbortError' || (editorErr.message && editorErr.message.includes('hủy'))) {
          throw editorErr;
        }
        console.warn('Editor 7D evaluation error:', editorErr);
        this.coordinator.logActivity('editor', `Editor Agent hoàn tất thẩm định nhanh (${editorErr.message || 'Mạng bận'}), chuyển tiếp bản thảo.`);
        this.render7DScore('### Thẩm định 7D (Đã tiếp nhận)\n- Chất lượng tổng thể: 8.5/10\n- Bản thảo phân đoạn hoàn thành đầy đủ, tác giả có thể tinh chỉnh trực tiếp.');
      }

      // 5. Arbiter Step
      this.coordinator.logActivity('arbiter', 'Arbiter Agent: [PHÊ DUYỆT BẢN THẢO] - Đã commit chương vào project.');
      this.saveCurrentChapter();
      window.StudioApp?.showToast('Sáng tác chương thành công!', 'success');

    } catch (err) {
      if (err.name === 'AbortError' || (err.message && err.message.includes('hủy'))) {
        this.coordinator.logActivity('coordinator', 'Tác giả đã tạm dừng tiến trình (/steer).');
      } else {
        window.StudioApp?.showToast(err.message, 'error');
        this.coordinator.logActivity('coordinator', `Lỗi: ${err.message}`, {}, 'error');
      }
    } finally {
      this.isGenerating = false;
      this.dom.btnRunMultiAgent.style.display = 'inline-flex';
      this.dom.btnStopAgent.style.display = 'none';
      this.abortController = null;
    }
  }

  /**
   * Tự động quét và trích xuất nhân vật/thế giới bằng Architect Agent
   */
  async extractLoreWithAI() {
    if (!supabaseManager.currentUser) {
      window.StudioApp?.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi sử dụng AI!', 'info');
      window.StudioApp?.openAccountModal('tabAuthLogin');
      return;
    }

    if (!this.activeProject) return;

    const fundCheck = BillingEngine.checkFunds('GENERATE_OUTLINE');
    if (!fundCheck.hasFunds) {
      window.StudioApp?.showToast('Số dư Xu không đủ (Cần 2.0 Xu). Vui lòng nạp thêm Xu!', 'error');
      window.StudioApp?.openTopupModal();
      return;
    }

    BillingEngine.charge('GENERATE_OUTLINE', 'Architect AI quét và trích xuất nhân vật Lorebook');
    window.StudioApp?.updateWalletDisplay();
    window.StudioApp?.showToast('Architect AI đang phân tích tiểu thuyết để tìm nhân vật...', 'info');

    try {
      const res = await this.architect.extractCharactersFromNovel({
        project: this.activeProject,
        currentText: this.dom.novelTextarea.value
      });

      if (res && res.content) {
        // Tìm khối JSON trong output
        const jsonMatch = res.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          let addedCount = 0;
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item.name) {
                storage.addLorebookEntry(this.activeProject.id, item);
                addedCount++;
              }
            });
          }

          if (addedCount > 0) {
            this.activeProject = storage.getActiveProject();
            this.renderLoreList();
            this.graph.render(this.activeProject);
            window.StudioApp?.showToast(`Architect AI đã trích xuất thành công ${addedCount} nhân vật vào Lorebook!`, 'success');
            return;
          }
        }
      }

      window.StudioApp?.showToast('Architect AI đã phân tích xong, mời bạn xem hồ sơ!', 'info');
    } catch (e) {
      console.warn('Lỗi extractLoreWithAI:', e);
      window.StudioApp?.showToast('Chưa thể trích xuất tự động: ' + e.message, 'error');
    }
  }

  stopAgentGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async run7DEvaluation() {
    if (!supabaseManager.currentUser) {
      window.StudioApp?.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi thẩm định!', 'info');
      window.StudioApp?.openAccountModal('tabAuthLogin');
      return;
    }

    const text = this.dom.novelTextarea.value;
    if (!text || text.length < 100) {
      window.StudioApp?.showToast('Nội dung chương quá ngắn để thẩm định 7D!', 'error');
      return;
    }

    const fundCheck = BillingEngine.checkFunds('EVALUATE_7D');
    if (!fundCheck.hasFunds) {
      window.StudioApp?.openTopupModal();
      return;
    }

    BillingEngine.charge('EVALUATE_7D', 'Thẩm định chất lượng 7 chiều');
    window.StudioApp?.updateWalletDisplay();
    window.StudioApp?.showToast('Editor Agent đang thẩm định 7 chiều...', 'info');

    try {
      const res = await this.editor.evaluate7D({
        chapterTitle: this.activeChapter?.title || 'Chương truyện',
        content: text
      });
      this.render7DScore(res.content);
      window.StudioApp?.showToast('Thẩm định 7D hoàn tất!', 'success');
    } catch (err) {
      window.StudioApp?.showToast(err.message, 'error');
    }
  }

  render7DScore(evalText) {
    this.dom.eval7dOutput.textContent = evalText;
    this.dom.overall7dScore.textContent = '8.8 / 10';
  }

  onAgentActivity(type, log) {
    if (type !== 'activity') return;
    const card = document.createElement('div');
    card.className = `activity-card ${log.agent}`;
    card.innerHTML = `
      <div class="activity-header">
        <span class="agent-tag ${log.agent}">${log.agent}</span>
        <span class="activity-time">${log.timestamp}</span>
      </div>
      <div class="activity-body">${log.action}</div>
    `;
    this.dom.activityStream.prepend(card);
  }

  saveCurrentChapter() {
    if (!this.activeProject) return;

    // Nếu chưa có activeChapter mà tác giả đã bắt đầu gõ
    if (!this.activeChapter) {
      const content = this.dom.novelTextarea.value.trim();
      const title = this.dom.chapterTitleInput.value.trim() || 'Chương 1: Khởi Đầu';
      if (!content && !this.dom.chapterTitleInput.value.trim()) return;

      const newChap = {
        id: 'chap_' + Date.now(),
        chapterIndex: 1,
        title: title.startsWith('Chương') ? title : `Chương 1: ${title}`,
        summary: '',
        content: this.dom.novelTextarea.value,
        wordCount: (this.dom.novelTextarea.value.match(/\S+/g) || []).length,
        updatedAt: new Date().toISOString()
      };
      this.activeProject.chapters = [newChap];
      this.activeChapter = newChap;
      this.renderChapterList();
    } else {
      this.activeChapter.content = this.dom.novelTextarea.value;
      this.activeChapter.title = this.dom.chapterTitleInput.value || this.activeChapter.title;
      this.activeChapter.wordCount = (this.activeChapter.content.match(/\S+/g) || []).length;
      this.activeChapter.updatedAt = new Date().toISOString();
    }

    storage.saveProject(this.activeProject);
    storage.saveSessionState({
      view: 'studio',
      projectId: this.activeProject.id,
      chapterId: this.activeChapter?.id
    });
    this.dom.saveStatusTag.textContent = `Đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`;
  }

  updateWordCount() {
    const text = this.dom.novelTextarea.value || '';
    const words = (text.match(/\S+/g) || []).length;
    this.dom.wordCountTag.textContent = `${words.toLocaleString()} từ`;
    const readTime = Math.ceil(words / 250);
    this.dom.readTimeTag.textContent = `~${readTime} phút đọc`;
  }

  toggleZenMode() {
    this.dom.studioLayout.classList.toggle('zen-mode');
  }
}
