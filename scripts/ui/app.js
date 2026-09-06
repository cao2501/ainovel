/**
 * AI Novel Studio - Main Application Entry Point
 * Orchestrates My Novels Library, Project Switcher, VietQR Payments, Diagnostics, and Exports
 */

import { KiraAPIClient } from '../api/kira.js';
import { storage } from '../core/storage.js';
import { BillingEngine } from '../core/billing.js';
import { ExportEngine } from '../core/export.js';
import { supabaseManager } from '../api/supabase.js';
import { appLogger } from '../core/logger.js';
import { StudioController } from './studio.js';

class Application {
  constructor() {
    this.config = storage.getConfig();
    this.apiClient = new KiraAPIClient(this.config.apiKey, this.config.baseUrl);
    this.studio = new StudioController(this.apiClient);
    this.currentView = 'home';
    this.currentGenreFilter = 'all';
  }

  async init() {
    window.StudioApp = this;
    this.bindModals();
    this.bindHeaderActions();
    this.bindAccountModal();
    this.bindSystemLogModal();
    this.bindViewRouter();
    this.bindProfileAndCommunityEvents();
    this.updateWalletDisplay();
    this.updateProjectsBadge();
    this.studio.init();

    // Auto-restore previous render / project / view session
    const session = storage.getSessionState();
    const hash = window.location.hash.replace('#', '');
    let targetView = 'home';

    if (['home', 'library', 'studio', 'profile'].includes(hash)) {
      targetView = hash;
    } else if (session.view && ['home', 'library', 'studio', 'profile'].includes(session.view)) {
      targetView = session.view;
    }

    if (session.projectId) {
      storage.setActiveProjectId(session.projectId);
      this.studio.loadActiveProject();
      if (session.chapterId) {
        this.studio.selectChapter(session.chapterId);
      }
    }

    this.switchView(targetView);
    await this.initSupabase();

    // Welcome message
    setTimeout(() => {
      if (supabaseManager.currentUser) {
        this.showToast('Chào mừng tác giả quay lại! Tác phẩm và ví Xu của bạn đã được kết nối.', 'success');
      } else {
        this.showToast('Chào mừng bạn đến với Aitory! Đăng ký tài khoản để nhận ngay 50.0 Xu tân thủ.', 'info');
      }
    }, 600);
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop, .modal').forEach(m => m.classList.remove('active'));
  }

  updateWalletDisplay() {
    const coinEl = document.getElementById('userCoinBalance');
    const badgeEl = document.getElementById('btnOpenTopup');
    const isLoggedIn = Boolean(supabaseManager.currentUser);

    if (badgeEl) {
      // Trước khi đăng nhập (đặc biệt ở trang Home): Ẩn hoàn toàn số dư Xu
      badgeEl.style.display = isLoggedIn ? 'inline-flex' : 'none';
    }

    if (coinEl) {
      if (isLoggedIn && supabaseManager.currentProfile?.coin_balance !== undefined) {
        coinEl.textContent = parseFloat(supabaseManager.currentProfile.coin_balance).toFixed(1);
      } else {
        const wallet = storage.getWallet();
        coinEl.textContent = wallet.balance.toFixed(1);
      }
    }
  }

  updateProjectsBadge() {
    const projects = storage.getProjects();
    const badge = document.getElementById('totalProjectsBadge');
    if (badge) {
      badge.textContent = projects.length;
    }
    const navBadge = document.getElementById('navLibraryCount');
    if (navBadge) {
      navBadge.textContent = projects.length;
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : '💡'}</span>
      <div>${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  bindHeaderActions() {
    // Open My Novels Library
    document.getElementById('btnOpenLibrary')?.addEventListener('click', () => {
      this.openLibraryModal();
    });

    // Quick switch from sidebar
    document.getElementById('btnSwitchProjectQuick')?.addEventListener('click', () => {
      this.openLibraryModal();
    });

    // Create New Project (from library modal only — header button removed)
    document.getElementById('btnLibraryCreateNew')?.addEventListener('click', () => {
      document.getElementById('libraryModal').classList.remove('active');
      this.openNewProjectModal();
    });

    // Top-up VietQR button
    document.getElementById('btnOpenTopup')?.addEventListener('click', () => {
      this.openTopupModal();
    });

    // New Chapter button
    document.getElementById('btnNewChapter')?.addEventListener('click', () => {
      this.openNewChapterModal();
    });

    // Diagnostics /diag button
    document.getElementById('btnOpenDiag')?.addEventListener('click', () => {
      this.openDiagModal();
    });

    // Export button
    document.getElementById('btnOpenExport')?.addEventListener('click', () => {
      this.openExportModal();
    });

    // Daily bonus button
    document.getElementById('btnDailyBonus')?.addEventListener('click', () => {
      if (!supabaseManager.currentUser) {
        this.showToast('Vui lòng đăng nhập tài khoản tác giả để điểm danh nhận Xu!', 'info');
        this.openAccountModal('tabAuthLogin');
        return;
      }
      const res = storage.claimDailyBonus();
      if (res.success) {
        this.updateWalletDisplay();
        this.showToast(res.message, 'success');
      } else {
        this.showToast(res.message, 'info');
      }
    });

    // Open Account — if not logged in, open login modal; if logged in, dropdown handles it
    document.getElementById('btnOpenAccount')?.addEventListener('click', () => {
      if (!supabaseManager.currentUser) {
        this.openAccountModal('tabAuthLogin');
      }
      // When logged in, hover dropdown shows profile/logout options
    });

    // Dropdown: Trang Cá Nhân
    document.getElementById('dropdownProfileBtn')?.addEventListener('click', () => {
      this.switchView('profile');
    });

    // Dropdown: Đăng Xuất
    document.getElementById('dropdownLogoutBtn')?.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản tác giả không?')) {
        await supabaseManager.signOut();
        this.showToast('Đã đăng xuất tài khoản thành công.', 'info');
        this.switchView('home');
        this.updateAccountUI(null, null);
        this.updateWalletDisplay();
      }
    });
  }

  bindModals() {
    // Close modal clicks
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeAllModals();
      });
    });

    document.querySelectorAll('.modal-backdrop, .modal').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          this.closeAllModals();
        }
      });
    });

    // VietQR Package selection & Simulated Top-up
    document.querySelectorAll('.package-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const pkgId = card.getAttribute('data-pkg');
        this.renderVietQrForPackage(pkgId);
      });
    });

    document.getElementById('btnSimulateTopup')?.addEventListener('click', () => {
      const activeCard = document.querySelector('.package-card.active');
      const pkgId = activeCard ? activeCard.getAttribute('data-pkg') : 'author';
      const res = BillingEngine.simulateTopup(pkgId);
      this.updateWalletDisplay();
      document.getElementById('topupModal').classList.remove('active');
      this.showToast(`Nạp thành công +${res.package.coins} Xu (${res.package.name})!`, 'success');
    });

    // Create New Project Form Submit
    document.getElementById('btnSubmitNewProject')?.addEventListener('click', () => {
      const title = document.getElementById('newProjectTitle').value.trim();
      const genre = document.getElementById('newProjectGenre').value;
      const premise = document.getElementById('newProjectPremise').value.trim();
      const author = document.getElementById('newProjectAuthor').value.trim();
      const protagonist = document.getElementById('newProjectProtagonist')?.value.trim() || '';
      const worldContext = document.getElementById('newProjectWorldContext')?.value.trim() || '';

      if (!title) {
        this.showToast('Vui lòng nhập tên tác phẩm!', 'error');
        return;
      }

      storage.createNewProject({ 
        title, 
        genre, 
        premise, 
        authorName: author,
        protagonistName: protagonist,
        worldContext: worldContext
      });
      document.getElementById('newProjectModal').classList.remove('active');
      this.updateProjectsBadge();
      this.studio.loadActiveProject();
      this.updateStudioTopBarTitle();
      this.renderLibraryGrid();
      this.renderFullLibraryGrid();
      this.switchView('studio');
      this.showToast(`Đã tạo tác phẩm [${title}] thành công!`, 'success');

      // Clear form
      document.getElementById('newProjectTitle').value = '';
      document.getElementById('newProjectPremise').value = '';
      if (document.getElementById('newProjectProtagonist')) document.getElementById('newProjectProtagonist').value = '';
      if (document.getElementById('newProjectWorldContext')) document.getElementById('newProjectWorldContext').value = '';
    });

    // Create New Chapter Form Submit
    document.getElementById('btnSubmitNewChapter')?.addEventListener('click', () => {
      const title = document.getElementById('newChapterTitle').value.trim();
      if (!title) return;

      const project = storage.getActiveProject();
      if (!project) return;

      const newIndex = (project.chapters || []).length + 1;
      const newChap = {
        id: 'chap_' + Date.now(),
        chapterIndex: newIndex,
        title: `Chương ${newIndex}: ${title}`,
        summary: '',
        content: `Chương ${newIndex}: ${title}\n\n`,
        wordCount: 0,
        updatedAt: new Date().toISOString()
      };

      project.chapters.push(newChap);
      storage.saveProject(project);
      document.getElementById('newChapterModal').classList.remove('active');
      this.studio.loadActiveProject();
      this.studio.selectChapter(newChap.id);
      this.showToast(`Đã thêm ${newChap.title}!`, 'success');

      document.getElementById('newChapterTitle').value = '';
    });

    // Lorebook Form Submit
    document.getElementById('btnSubmitLorebookEntry')?.addEventListener('click', () => {
      const proj = storage.getActiveProject();
      if (!proj) return;

      const id = document.getElementById('loreFormId').value.trim();
      const name = document.getElementById('loreFormName').value.trim();
      const category = document.getElementById('loreFormCategory').value;
      const role = document.getElementById('loreFormRole').value.trim();
      const aliasesStr = document.getElementById('loreFormAliases').value.trim();
      const description = document.getElementById('loreFormDesc').value.trim();
      const attrsStr = document.getElementById('loreFormAttrs').value.trim();
      const relTarget = document.getElementById('loreFormRelTarget').value;
      const relType = document.getElementById('loreFormRelType').value;
      const relText = document.getElementById('loreFormRelText').value.trim();

      if (!name) {
        this.showToast('Vui lòng nhập tên nhân vật/thực thể!', 'error');
        return;
      }

      // Parse aliases
      const aliases = aliasesStr ? aliasesStr.split(',').map(s => s.trim()).filter(Boolean) : [];

      // Parse attributes
      const attributes = {};
      if (attrsStr) {
        attrsStr.split('|').forEach(part => {
          const colonIdx = part.indexOf(':');
          if (colonIdx > 0) {
            const k = part.substring(0, colonIdx).trim();
            const v = part.substring(colonIdx + 1).trim();
            if (k && v) attributes[k] = v;
          } else if (part.trim()) {
            attributes['info'] = part.trim();
          }
        });
      }

      // Parse relationships
      const relationships = [];
      if (relTarget) {
        relationships.push({
          targetName: relTarget,
          relation: relText || 'Liên kết',
          type: relType || 'ally'
        });
      }

      const loreData = {
        name,
        aliases,
        category,
        role,
        description,
        attributes,
        relationships
      };

      if (id) {
        storage.updateLorebookEntry(proj.id, id, loreData);
        this.showToast(`Đã cập nhật hồ sơ [${name}]!`, 'success');
      } else {
        storage.addLorebookEntry(proj.id, loreData);
        this.showToast(`Đã thêm [${name}] vào Lorebook!`, 'success');
      }

      document.getElementById('lorebookModal')?.classList.remove('active');
      this.studio.activeProject = storage.getActiveProject();
      this.studio.renderLoreList();
      this.studio.graph.render(this.studio.activeProject);
    });

    // Export buttons
    document.getElementById('btnExportTxt')?.addEventListener('click', () => {
      ExportEngine.exportToTxt(storage.getActiveProject());
      this.showToast('Đang tải file TXT...', 'success');
    });
    document.getElementById('btnExportMd')?.addEventListener('click', () => {
      ExportEngine.exportToMarkdown(storage.getActiveProject());
      this.showToast('Đang tải file Markdown...', 'success');
    });
    document.getElementById('btnExportHtml')?.addEventListener('click', () => {
      ExportEngine.exportToHtml(storage.getActiveProject());
      this.showToast('Đang tải file HTML Reader...', 'success');
    });
  }

  // --- Novel Library Modal ---
  openLibraryModal() {
    this.closeAllModals();
    this.renderLibraryGrid();
    document.getElementById('libraryModal').classList.add('active');
  }

  renderLibraryGrid() {
    const container = document.getElementById('novelLibraryGrid');
    if (!container) return;

    const projects = storage.getProjects();
    const activeId = storage.getActiveProjectId();
    container.innerHTML = '';

    projects.forEach(proj => {
      const isActive = proj.id === activeId;
      const chapters = proj.chapters || [];
      const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
      const updatedTime = new Date(proj.updatedAt || proj.createdAt).toLocaleDateString('vi-VN');

      const card = document.createElement('div');
      card.className = `novel-card ${isActive ? 'active-novel' : ''}`;
      card.innerHTML = `
        <div>
          <div class="novel-card-header">
            <span class="novel-card-genre">${(proj.genre || 'Tiên Hiệp').toUpperCase()}</span>
            ${isActive ? '<span class="novel-card-active-tag">ĐANG VIẾT</span>' : ''}
          </div>
          <div class="novel-card-title">${proj.title}</div>
          <div class="novel-card-desc">${proj.premise || 'Chưa có tóm tắt tiền đề cho tác phẩm này.'}</div>
        </div>

        <div>
          <div class="novel-card-stats">
            <span>📖 ${chapters.length} chương</span>
            <span>✍️ ${totalWords.toLocaleString()} từ</span>
            <span>🕒 ${updatedTime}</span>
          </div>

          <div class="novel-card-actions">
            ${
              isActive
                ? '<button class="btn btn-sm btn-primary" style="flex:1;" disabled>Đang Mở</button>'
                : `<button class="btn btn-sm btn-cyan btn-switch-proj" data-id="${proj.id}" style="flex:1;">➡️ Mở Viết</button>`
            }
            ${
              projects.length > 1
                ? `<button class="btn btn-sm btn-outline btn-delete-proj" data-id="${proj.id}" title="Xóa tác phẩm" style="color:var(--accent-rose); border-color:rgba(244,63,94,0.3);">🗑️</button>`
                : ''
            }
          </div>
        </div>
      `;

      // Event listeners for switch & delete
      card.querySelector('.btn-switch-proj')?.addEventListener('click', () => {
        this.switchProject(proj.id);
      });

      card.querySelector('.btn-delete-proj')?.addEventListener('click', () => {
        if (confirm(`Bạn có chắc chắn muốn xóa bộ truyện "${proj.title}" không?`)) {
          this.deleteProject(proj.id);
        }
      });

      container.appendChild(card);
    });
  }

  switchProject(projectId) {
    if (!supabaseManager.currentUser) {
      this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi sáng tác!', 'info');
      this.openAccountModal('tabAuthLogin');
      return;
    }
    storage.setActiveProjectId(projectId);
    this.studio.loadActiveProject();
    this.updateStudioTopBarTitle();
    document.getElementById('libraryModal')?.classList.remove('active');
    this.switchView('studio');
    const project = storage.getActiveProject();
    this.showToast(`Đã chuyển sang tác phẩm [${project?.title || ''}]!`, 'success');
  }

  deleteProject(projectId) {
    storage.deleteProject(projectId);
    this.updateProjectsBadge();
    this.studio.loadActiveProject();
    this.updateStudioTopBarTitle();
    this.renderLibraryGrid();
    this.renderFullLibraryGrid();
    this.showToast('Đã xóa bộ truyện thành công.', 'info');
  }

  updateStudioTopBarTitle() {
    const proj = storage.getActiveProject();
    const titleEl = document.getElementById('studioTopBarTitle');
    if (titleEl && proj) {
      titleEl.textContent = `${proj.title} (${(proj.genre || 'Tiên Hiệp').toUpperCase()})`;
    }
  }

  toggleMobileNavDrawer() {
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileNavBackdrop');
    const isOpen = drawer?.classList.contains('open');
    if (isOpen) {
      this.closeMobileNavDrawer();
    } else {
      drawer?.classList.add('open');
      backdrop?.classList.add('active');
    }
  }

  closeMobileNavDrawer() {
    document.getElementById('mobileNavDrawer')?.classList.remove('open');
    document.getElementById('mobileNavBackdrop')?.classList.remove('active');
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle views
    document.querySelectorAll('.app-view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });

    const targetView = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    if (targetView) {
      targetView.style.display = 'block';
      targetView.classList.add('active');
    }

    // Toggle nav active tabs on desktop
    document.querySelectorAll('.app-nav-menu .nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Toggle nav active tabs on mobile drawer
    document.querySelectorAll('.drawer-nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Update URL hash without jumping
    if (window.location.hash !== '#' + viewName) {
      history.replaceState(null, '', '#' + viewName);
    }

    // Save view to persistent session state
    storage.saveSessionState({ view: viewName });

    // View specific updates
    if (viewName === 'profile') {
      if (!supabaseManager.currentUser) {
        this.showToast('Vui lòng đăng nhập tài khoản tác giả để vào Trang Cá Nhân!', 'info');
        this.openAccountModal('tabAuthLogin');
        return;
      }
      this.renderAuthorProfile();
    } else if (viewName === 'library') {
      this.renderFullLibraryGrid();
    } else if (viewName === 'studio') {
      if (!supabaseManager.currentUser) {
        this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi bắt đầu sáng tác!', 'info');
        this.openAccountModal('tabAuthLogin');
        return;
      }
      this.studio.loadActiveProject();
      this.updateStudioTopBarTitle();
    }

    this.updateWalletDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  bindViewRouter() {
    // Desktop Navigation bar tabs
    document.querySelectorAll('.app-nav-menu .nav-tab-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Dedicated Mobile Hamburger button: opens drawer
    document.getElementById('btnOpenMobileNav')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMobileNavDrawer();
    });

    // Brand logo: Click on mobile (<= 768px) opens Mobile Drawer; click on desktop goes home
    document.getElementById('brandHomeLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        this.toggleMobileNavDrawer();
      } else {
        this.switchView('home');
      }
    });

    // Mobile Navigation Drawer Close controls
    document.getElementById('btnCloseNavDrawer')?.addEventListener('click', () => {
      this.closeMobileNavDrawer();
    });
    document.getElementById('mobileNavBackdrop')?.addEventListener('click', () => {
      this.closeMobileNavDrawer();
    });

    // Mobile Navigation Drawer 5 Core Items
    document.getElementById('drawerBtnHome')?.addEventListener('click', () => {
      this.switchView('home');
      this.closeMobileNavDrawer();
    });
    document.getElementById('drawerBtnLibrary')?.addEventListener('click', () => {
      this.switchView('library');
      this.closeMobileNavDrawer();
    });
    document.getElementById('drawerBtnStudio')?.addEventListener('click', () => {
      this.switchView('studio');
      this.closeMobileNavDrawer();
    });
    document.getElementById('drawerBtnPricing')?.addEventListener('click', () => {
      scrollToSection('sectionPricing');
      this.closeMobileNavDrawer();
    });
    document.getElementById('drawerBtnFeatures')?.addEventListener('click', () => {
      scrollToSection('sectionFeatures');
      this.closeMobileNavDrawer();
    });

    // Pricing & Features navigation shortcuts
    const scrollToSection = (sectionId) => {
      if (this.currentView !== 'home') {
        this.switchView('home');
        setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      } else {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    document.getElementById('navBtnPricing')?.addEventListener('click', () => scrollToSection('sectionPricing'));
    document.getElementById('navBtnFeatures')?.addEventListener('click', () => scrollToSection('sectionFeatures'));
    document.getElementById('heroBtnPricingScroll')?.addEventListener('click', () => scrollToSection('sectionPricing'));

    // Browser URL hash changes (back/forward button support)
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== this.currentView && ['home', 'library', 'studio', 'profile'].includes(hash)) {
        this.switchView(hash);
      }
    });

    // Studio Mobile Drawers Controls
    const leftDrawer = document.getElementById('studioSidebarLeft');
    const rightDrawer = document.getElementById('studioSidebarRight');
    const drawerBackdrop = document.getElementById('studioDrawerBackdrop');

    const closeDrawers = () => {
      leftDrawer?.classList.remove('drawer-open');
      rightDrawer?.classList.remove('drawer-open');
      drawerBackdrop?.classList.remove('active');
    };

    document.getElementById('btnToggleLeftDrawer')?.addEventListener('click', () => {
      rightDrawer?.classList.remove('drawer-open');
      leftDrawer?.classList.toggle('drawer-open');
      drawerBackdrop?.classList.toggle('active', leftDrawer?.classList.contains('drawer-open'));
    });

    document.getElementById('btnCloseLeftDrawer')?.addEventListener('click', closeDrawers);

    document.getElementById('btnToggleRightDrawer')?.addEventListener('click', () => {
      leftDrawer?.classList.remove('drawer-open');
      rightDrawer?.classList.toggle('drawer-open');
      drawerBackdrop?.classList.toggle('active', rightDrawer?.classList.contains('drawer-open'));
    });

    document.getElementById('btnCloseRightDrawer')?.addEventListener('click', closeDrawers);
    drawerBackdrop?.addEventListener('click', closeDrawers);

    // Auto-close left drawer on mobile when clicking a chapter in the list
    document.getElementById('studioChapterList')?.addEventListener('click', (e) => {
      if (window.innerWidth <= 992 && (e.target.closest('.chapter-item') || e.target.closest('.chapter-title-row'))) {
        closeDrawers();
      }
    });

    // Hero CTA buttons
    document.getElementById('heroBtnStartWriting')?.addEventListener('click', () => {
      if (!supabaseManager.currentUser) {
        this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi bắt đầu sáng tác!', 'info');
        this.openAccountModal('tabAuthLogin');
        return;
      }
      const activeProj = storage.getActiveProject();
      if (activeProj) {
        this.switchView('studio');
      } else {
        this.openNewProjectModal();
      }
    });

    document.getElementById('heroBtnOpenLibrary')?.addEventListener('click', () => {
      this.switchView('library');
    });

    document.getElementById('btnHeroTryEditor')?.addEventListener('click', () => {
      if (!supabaseManager.currentUser) {
        this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi bắt đầu sáng tác!', 'info');
        this.openAccountModal('tabAuthLogin');
        return;
      }
      this.switchView('studio');
    });

    // Studio sub-header navigation
    document.getElementById('btnStudioBackToHome')?.addEventListener('click', () => {
      this.switchView('home');
    });
    document.getElementById('btnStudioOpenLibrary')?.addEventListener('click', () => {
      this.switchView('library');
    });
    document.getElementById('btnStudioDiag')?.addEventListener('click', () => {
      this.openDiagModal();
    });
    document.getElementById('btnStudioExport')?.addEventListener('click', () => {
      this.openExportModal();
    });

    // Full-page Library actions
    document.getElementById('btnLibraryViewCreateNew')?.addEventListener('click', () => {
      this.openNewProjectModal();
    });

    // Library genre filter buttons
    document.querySelectorAll('.library-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.library-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentGenreFilter = btn.getAttribute('data-genre') || 'all';
        this.renderFullLibraryGrid();
      });
    });

    // Library search input
    document.getElementById('librarySearchInput')?.addEventListener('input', () => {
      this.renderFullLibraryGrid();
    });

    // Genre Cards: "Viết Ngay Thể Loại Này"
    document.querySelectorAll('.btnCreateGenreStory').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!supabaseManager.currentUser) {
          this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi sáng tác thể loại này!', 'info');
          this.openAccountModal('tabAuthLogin');
          return;
        }
        const genre = btn.getAttribute('data-genre') || 'xianxia';
        const genreSelect = document.getElementById('newProjectGenre');
        if (genreSelect) genreSelect.value = genre;
        this.openNewProjectModal();
      });
    });

    // Pricing Cards: "Nạp Gói..."
    document.querySelectorAll('.btnBuyPackage').forEach(btn => {
      btn.addEventListener('click', () => {
        const pkgId = btn.getAttribute('data-pkg') || 'author';
        this.openTopupModal(pkgId);
      });
    });

    // Footer nav links
    document.querySelectorAll('.footer-nav-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.switchView(view);
      });
    });
  }

  // ==============================================================================
  // 1. TỦ TRUYỆN CỘNG ĐỒNG TOÀN CẦU (PUBLIC COMMUNITY NOVEL LIBRARY)
  // ==============================================================================
  async renderFullLibraryGrid() {
    const container = document.getElementById('fullLibraryGrid');
    if (!container) return;

    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 8px;">⏳</div>
        <div>Đang tải tác phẩm từ Không Gian Văn Học Mở...</div>
      </div>
    `;

    const subTab = this.currentLibSubTab || 'public';
    const searchText = (document.getElementById('librarySearchInput')?.value || '').toLowerCase().trim();
    const genreFilter = this.currentGenreFilter || 'all';

    // 1. Lấy danh sách truyện từ Supabase Cloud
    let cloudPublicNovels = [];
    try {
      cloudPublicNovels = await supabaseManager.fetchPublicCommunityProjects();
    } catch {
      cloudPublicNovels = [];
    }

    // 2. Kết hợp với các truyện cục bộ có cờ isPublic hoặc truyện đang mở
    const localProjects = storage.getProjects();
    const followedIds = storage.getFollowedProjectIds();

    // Cập nhật huy hiệu số truyện theo dõi
    const followBadge = document.getElementById('followedCountBadge');
    if (followBadge) followBadge.textContent = followedIds.length;

    // Hợp nhất dữ liệu tránh trùng ID
    const novelMap = new Map();

    // Thêm truyện từ cloud
    cloudPublicNovels.forEach(p => {
      novelMap.set(p.id, p);
    });

    // Thêm các truyện cục bộ chỉ khi đã được đánh dấu công khai (isPublic)
    localProjects.forEach(lp => {
      if (lp.isPublic && !novelMap.has(lp.id)) {
        const chapters = Array.isArray(lp.chapters) ? lp.chapters : [];
        const words = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
        novelMap.set(lp.id, {
          id: lp.id,
          userId: lp.userId,
          title: lp.title,
          genre: lp.genre || 'xianxia',
          authorName: lp.authorName || 'Vô Danh',
          premise: lp.premise || '',
          isPublic: true,
          viewsCount: lp.viewsCount || 0,
          followersCount: lp.followersCount || 0,
          chaptersCount: chapters.length,
          totalWords: words,
          chapters: chapters,
          createdAt: lp.createdAt,
          updatedAt: lp.updatedAt,
          isLocalOwner: true
        });
      }
    });

    let list = Array.from(novelMap.values());

    // Lọc theo Tab: Công Khai hay Đang Theo Dõi
    if (subTab === 'followed') {
      list = list.filter(n => followedIds.includes(n.id));
    }

    // Lọc theo thể loại
    if (genreFilter && genreFilter !== 'all') {
      list = list.filter(n => (n.genre || 'xianxia') === genreFilter);
    }

    // Lọc theo tìm kiếm
    if (searchText) {
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(searchText) ||
        (n.authorName || '').toLowerCase().includes(searchText) ||
        (n.premise || '').toLowerCase().includes(searchText)
      );
    }

    container.innerHTML = '';

    if (list.length === 0) {
      const emptyMsg = subTab === 'followed'
        ? 'Bạn chưa theo dõi bộ truyện nào. Hãy khám phá và bấm "⭐ Theo Dõi" những tác phẩm bạn yêu thích!'
        : 'Chưa có tác phẩm nào phù hợp trong Tủ Truyện Cộng Đồng. Hãy là tác giả đầu tiên công khai tác phẩm của mình!';

      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">📖</div>
          <div style="font-size: 1.15rem; font-weight: 600; margin-bottom: 6px;">Chưa tìm thấy tác phẩm</div>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px; max-width: 500px; margin-left: auto; margin-right: auto;">
            ${emptyMsg}
          </p>
          <button class="btn btn-primary" id="btnEmptyLibGoProfile">👤 Vào Trang Cá Nhân Để Đăng Truyện</button>
        </div>
      `;
      document.getElementById('btnEmptyLibGoProfile')?.addEventListener('click', () => {
        if (supabaseManager.currentUser) {
          this.switchView('profile');
        } else {
          this.openAccountModal('tabAuthLogin');
        }
      });
      return;
    }

    list.forEach(novel => {
      const isFollowed = followedIds.includes(novel.id);
      const isOwner = Boolean(
        novel.isLocalOwner ||
        (supabaseManager.currentUser && novel.userId === supabaseManager.currentUser.id)
      );

      const card = document.createElement('div');
      card.className = 'full-novel-card';
      card.innerHTML = `
        <div class="full-novel-header">
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="genre-pill">${(novel.genre || 'Tiên Hiệp').toUpperCase()}</span>
              <span class="status-pill-public">🌐 CỘNG ĐỒNG</span>
              ${isOwner ? '<span class="badge badge-warning" style="font-size:0.7rem;">👑 CỦA BẠN</span>' : ''}
            </div>
            <h3 class="full-novel-title" style="margin-top:6px;">${novel.title}</h3>
            <div style="font-size:0.82rem; color:var(--text-dim);">✍️ Bút danh: <strong>${novel.authorName || 'Vô Danh'}</strong></div>
          </div>
        </div>

        <p class="full-novel-premise">${novel.premise || 'Chưa có tóm tắt tác phẩm.'}</p>

        <div class="full-novel-stats-row">
          <div>📖 <strong>${novel.chaptersCount || (novel.chapters?.length || 0)}</strong> chương</div>
          <div>✍️ <strong>${(novel.totalWords || 0).toLocaleString()}</strong> từ</div>
          <div>👁️ <strong>${novel.viewsCount || 0}</strong> đọc</div>
          <div>⭐ <strong>${novel.followersCount || 0}</strong> theo dõi</div>
        </div>

        <div class="full-novel-actions" style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn btn-sm ${isFollowed ? 'btn-secondary' : 'btn-outline'} btn-follow-novel" data-id="${novel.id}">
            ⭐ ${isFollowed ? 'Đang Theo Dõi' : 'Theo Dõi'}
          </button>
          <button class="btn btn-sm btn-primary btn-read-novel" data-id="${novel.id}">
            📖 Đọc Truyện
          </button>
          ${isOwner ? `<button class="btn btn-sm btn-outline btn-edit-own-novel" data-id="${novel.id}">✍️ Viết Tiếp</button>` : ''}
        </div>
      `;

      // Event: Read Novel
      card.querySelector('.btn-read-novel')?.addEventListener('click', () => {
        this.openNovelReader(novel.id, 1);
      });

      // Event: Follow Novel
      card.querySelector('.btn-follow-novel')?.addEventListener('click', () => {
        const followed = storage.toggleFollowProject(novel.id);
        this.showToast(followed ? `Đã thêm "${novel.title}" vào danh sách theo dõi!` : `Đã bỏ theo dõi "${novel.title}".`, 'info');
        this.renderFullLibraryGrid();
      });

      // Event: Edit Own Novel
      card.querySelector('.btn-edit-own-novel')?.addEventListener('click', () => {
        this.switchProject(novel.id);
      });

      container.appendChild(card);
    });
  }

  // ==============================================================================
  // 2. TRANG CÁ NHÂN TÁC GIẢ (AUTHOR PERSONAL PROFILE & NOVELS)
  // ==============================================================================
  renderAuthorProfile() {
    const user = supabaseManager.currentUser;
    const profile = supabaseManager.currentProfile;

    if (!user) {
      this.switchView('home');
      return;
    }

    // 1. Cập nhật thông tin tác giả
    const displayName = profile?.display_name || user.email.split('@')[0];
    const nameEl = document.getElementById('profilePageAuthorName');
    const emailEl = document.getElementById('profilePageEmail');
    const joinEl = document.getElementById('profilePageJoinDate');
    const coinEl = document.getElementById('profileStatCoinsBalance');

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = `📧 ${user.email}`;
    if (joinEl) {
      const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '2026';
      joinEl.textContent = `📅 Thành viên từ: ${joinDate}`;
    }
    if (coinEl) {
      coinEl.textContent = `${parseFloat(profile?.coin_balance ?? 50.0).toFixed(1)} 🪙`;
    }

    // 2. Tính toán thống kê tác phẩm của tác giả
    const projects = storage.getProjects();
    let totalChapters = 0;
    let totalWords = 0;
    let totalViews = 0;

    projects.forEach(p => {
      const chaps = Array.isArray(p.chapters) ? p.chapters : [];
      totalChapters += chaps.length;
      totalWords += chaps.reduce((sum, c) => sum + (c.wordCount || 0), 0);
      totalViews += (p.viewsCount || 0);
    });

    const statNovels = document.getElementById('profileStatNovelsCount');
    const statChapters = document.getElementById('profileStatChaptersCount');
    const statWords = document.getElementById('profileStatWordsCount');
    const statViews = document.getElementById('profileStatViewsTotal');
    const roleEl = document.getElementById('profilePageRole');

    if (statNovels) statNovels.textContent = projects.length;
    if (statChapters) statChapters.textContent = totalChapters;
    if (statWords) statWords.textContent = totalWords.toLocaleString();
    if (statViews) statViews.textContent = totalViews;

    if (roleEl) {
      roleEl.textContent = (totalWords > 20000 || totalChapters >= 10)
        ? '👑 Đại Thần Sáng Tác'
        : '✍️ Tác Giả Xuất Sắc';
    }

    // 3. Hiển thị danh sách tác phẩm của tác giả
    const container = document.getElementById('authorStoriesGrid');
    if (!container) return;

    container.innerHTML = '';

    if (projects.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
          <div style="font-size: 2.2rem; margin-bottom: 10px;">✍️</div>
          <div style="font-size: 1.1rem; font-weight: 600;">Bạn chưa có bộ truyện nào</div>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin: 8px 0 16px;">Hãy tạo bộ tiểu thuyết đầu tiên để thỏa sức xây dựng thế giới của bạn!</p>
          <button class="btn btn-primary" id="btnProfileEmptyCreate">➕ Tạo Tác Phẩm Đầu Tiên</button>
        </div>
      `;
      document.getElementById('btnProfileEmptyCreate')?.addEventListener('click', () => this.openNewProjectModal());
      return;
    }

    projects.forEach(proj => {
      const chapters = Array.isArray(proj.chapters) ? proj.chapters : [];
      const wordCount = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
      const isPublic = Boolean(proj.isPublic);

      const card = document.createElement('div');
      card.className = 'full-novel-card';
      card.innerHTML = `
        <div class="full-novel-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="genre-pill">${(proj.genre || 'Tiên Hiệp').toUpperCase()}</span>
              ${
                isPublic
                  ? '<span class="status-pill-public">🌐 ĐÃ CÔNG KHAI</span>'
                  : '<span class="status-pill-private">🔒 RIÊNG TƯ</span>'
              }
            </div>
            <h3 class="full-novel-title" style="margin-top:6px;">${proj.title}</h3>
            <div style="font-size:0.82rem; color:var(--text-dim);">✍️ Bút danh: <strong>${proj.authorName || displayName}</strong></div>
          </div>
        </div>

        <p class="full-novel-premise">${proj.premise || 'Chưa có tóm tắt tác phẩm.'}</p>

        <div class="full-novel-stats-row">
          <div>📖 <strong>${chapters.length}</strong> chương</div>
          <div>✍️ <strong>${wordCount.toLocaleString()}</strong> từ</div>
          <div>👁️ <strong>${proj.viewsCount || 0}</strong> đọc</div>
          <div>⭐ <strong>${proj.followersCount || 0}</strong> theo dõi</div>
        </div>

        <div class="full-novel-actions" style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn btn-sm ${isPublic ? 'btn-outline' : 'btn-cyan'} btn-toggle-publish" data-id="${proj.id}">
            ${isPublic ? '🔒 Gỡ Xuống' : '🌐 Đăng Lên Tủ Truyện'}
          </button>
          <button class="btn btn-sm btn-outline btn-full-diag" data-id="${proj.id}" title="Chẩn đoán cốt truyện">🔍 /diag</button>
          <button class="btn btn-sm btn-outline btn-full-export" data-id="${proj.id}" title="Xuất bản sách">📥 Xuất Bản</button>
          <button class="btn btn-sm btn-primary btn-author-write" data-id="${proj.id}">✍️ Soạn Thảo</button>
          ${
            projects.length > 1
              ? `<button class="btn btn-sm btn-outline btn-author-delete" data-id="${proj.id}" title="Xóa tác phẩm" style="color:var(--accent-rose); border-color:rgba(244,63,94,0.3);">🗑️</button>`
              : ''
          }
        </div>
      `;

      // Toggle Publish / Unpublish to Community Library
      card.querySelector('.btn-toggle-publish')?.addEventListener('click', async () => {
        const updated = await storage.togglePublishProject(proj.id);
        if (updated) {
          this.showToast(
            updated.isPublic
              ? `Bộ truyện "${proj.title}" đã được ĐĂNG CÔNG KHAI lên Tủ Truyện Cộng Đồng!`
              : `Bộ truyện "${proj.title}" đã chuyển về chế độ RIÊNG TƯ.`,
            'success'
          );
          this.renderAuthorProfile();
          this.updateProjectsBadge();
        }
      });

      // Write / Studio
      card.querySelector('.btn-author-write')?.addEventListener('click', () => {
        this.switchProject(proj.id);
      });

      // Diagnostics /diag
      card.querySelector('.btn-full-diag')?.addEventListener('click', () => {
        storage.setActiveProjectId(proj.id);
        this.openDiagModal();
      });

      // Export
      card.querySelector('.btn-full-export')?.addEventListener('click', () => {
        storage.setActiveProjectId(proj.id);
        this.openExportModal();
      });

      // Delete
      card.querySelector('.btn-author-delete')?.addEventListener('click', () => {
        if (confirm(`Bạn có chắc chắn muốn xóa bộ truyện "${proj.title}" không?`)) {
          this.deleteProject(proj.id);
          this.renderAuthorProfile();
        }
      });

      container.appendChild(card);
    });
  }

  // ==============================================================================
  // 3. ĐỘC GIẢ WEB NOVEL READER (ĐỌC TRUYỆN TRỰC TUYẾN CHUẨN THƯƠNG MẠI)
  // ==============================================================================
  async openNovelReader(novelId, chapterIndex = 1) {
    const modal = document.getElementById('novelReaderModal');
    if (!modal) return;

    // Tìm truyện từ local hoặc fetch
    let novel = storage.getProjects().find(p => p.id === novelId);
    let chapters = novel ? novel.chapters : [];

    if (!novel || !chapters || chapters.length === 0) {
      // Thử lấy danh sách chương từ Supabase
      try {
        const cloudNovels = await supabaseManager.fetchPublicCommunityProjects();
        novel = cloudNovels.find(p => p.id === novelId) || novel;
      } catch {
        // Fallback
      }
    }

    if (!novel) {
      this.showToast('Không tìm thấy dữ liệu tác phẩm này.', 'error');
      return;
    }

    this.currentReaderNovel = novel;
    this.currentReaderChapterIndex = chapterIndex;

    // Tăng lượt xem
    storage.incrementProjectViews(novel.id);

    // Header info
    document.getElementById('readerModalGenre').textContent = (novel.genre || 'Tiên Hiệp').toUpperCase();
    document.getElementById('readerModalNovelTitle').textContent = novel.title;
    document.getElementById('readerModalAuthorName').textContent = novel.authorName || 'Vô Danh';

    // Populate chapters dropdown
    const selectEl = document.getElementById('readerChapterSelect');
    selectEl.innerHTML = '';

    const chapterList = Array.isArray(novel.chapters) && novel.chapters.length > 0
      ? novel.chapters
      : [{ id: 'c1', chapterIndex: 1, title: 'Chương 1: Khởi Đầu Mới', content: novel.premise || 'Tác phẩm đang được tác giả cập nhật những chương tiếp theo...' }];

    chapterList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.chapterIndex || 1;
      opt.textContent = `Chương ${c.chapterIndex || 1}: ${c.title || 'Chưa đặt tên'}`;
      if ((c.chapterIndex || 1) === chapterIndex) opt.selected = true;
      selectEl.appendChild(opt);
    });

    // Update Follow Button
    const followedIds = storage.getFollowedProjectIds();
    const isFollowed = followedIds.includes(novel.id);
    const followBtn = document.getElementById('readerBtnFollowStory');
    if (followBtn) {
      followBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFollowed ? '#fbbf24' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>${isFollowed ? 'Đang Theo Dõi' : 'Theo Dõi'}</span>
      `;
      followBtn.className = `btn btn-sm ${isFollowed ? 'btn-secondary' : 'btn-primary'}`;
    }

    this.closeAllModals();
    this.loadReaderChapter(chapterIndex);
    modal.classList.add('active');
  }

  async loadReaderChapter(chapterIndex) {
    const novel = this.currentReaderNovel;
    if (!novel) return;

    this.currentReaderChapterIndex = chapterIndex;
    const chapterList = Array.isArray(novel.chapters) && novel.chapters.length > 0
      ? novel.chapters
      : [{ id: 'c1', chapterIndex: 1, title: 'Chương 1: Khởi Đầu Mới', content: novel.premise || 'Tác phẩm đang được tác giả hoàn thiện...' }];

    let chapter = chapterList.find(c => (c.chapterIndex || 1) === chapterIndex);

    // Nếu chương chưa có content đầy đủ (do tải tóm tắt từ cloud), fetch từ Supabase
    if (!chapter?.content && supabaseManager.isConfigured()) {
      const fullCloudChap = await supabaseManager.fetchPublicChapterContent(novel.id, chapterIndex);
      if (fullCloudChap) {
        chapter = {
          ...chapter,
          title: fullCloudChap.title,
          content: fullCloudChap.content,
          wordCount: fullCloudChap.word_count
        };
      }
    }

    const titleEl = document.getElementById('readerChapterTitle');
    const contentEl = document.getElementById('readerChapterContent');
    const wordCountEl = document.getElementById('readerChapterWordCount');
    const progressEl = document.getElementById('readerFooterProgress');
    const statsEl = document.getElementById('readerModalStats');

    const chapTitle = chapter ? (chapter.title || `Chương ${chapterIndex}`) : `Chương ${chapterIndex}`;
    const chapContent = chapter?.content || 'Chương này hiện đang được tác giả chau chuốt nội dung...';
    const wordCount = chapter?.wordCount || chapContent.trim().split(/\s+/).length;

    if (titleEl) titleEl.textContent = `Chương ${chapterIndex}: ${chapTitle}`;
    if (contentEl) contentEl.textContent = chapContent;
    if (wordCountEl) wordCountEl.textContent = `${wordCount.toLocaleString()} chữ`;
    if (progressEl) progressEl.textContent = `Chương ${chapterIndex} / ${chapterList.length}`;
    if (statsEl) statsEl.textContent = `Chương ${chapterIndex} / ${chapterList.length} • ${wordCount.toLocaleString()} chữ`;

    // Dropdown sync
    const selectEl = document.getElementById('readerChapterSelect');
    if (selectEl) selectEl.value = chapterIndex;

    // Scroll to top of reading area
    contentEl?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==============================================================================
  // 4. BIND CÁC SỰ KIỆN TRANG CÁ NHÂN & ĐỘC GIẢ
  // ==============================================================================
  bindProfileAndCommunityEvents() {
    // Community Library Sub-Tabs
    document.getElementById('tabLibCommunityAll')?.addEventListener('click', () => {
      this.currentLibSubTab = 'public';
      document.getElementById('tabLibCommunityAll')?.classList.add('active', 'btn-secondary');
      document.getElementById('tabLibCommunityAll')?.classList.remove('btn-outline');
      document.getElementById('tabLibFollowed')?.classList.remove('active', 'btn-secondary');
      document.getElementById('tabLibFollowed')?.classList.add('btn-outline');
      this.renderFullLibraryGrid();
    });

    document.getElementById('tabLibFollowed')?.addEventListener('click', () => {
      this.currentLibSubTab = 'followed';
      document.getElementById('tabLibFollowed')?.classList.add('active', 'btn-secondary');
      document.getElementById('tabLibFollowed')?.classList.remove('btn-outline');
      document.getElementById('tabLibCommunityAll')?.classList.remove('active', 'btn-secondary');
      document.getElementById('tabLibCommunityAll')?.classList.add('btn-outline');
      this.renderFullLibraryGrid();
    });

    // Jump from Library to Author Profile
    document.getElementById('btnLibraryGoToProfile')?.addEventListener('click', () => {
      if (supabaseManager.currentUser) {
        this.switchView('profile');
      } else {
        this.showToast('Vui lòng đăng nhập tài khoản tác giả để quản lý tác phẩm của bạn!', 'info');
        this.openAccountModal('tabAuthLogin');
      }
    });

    // Author Profile banner actions
    document.getElementById('btnProfileCreateNewStory')?.addEventListener('click', () => {
      this.openNewProjectModal();
    });
    document.getElementById('btnProfileSectionNew')?.addEventListener('click', () => {
      this.openNewProjectModal();
    });
    document.getElementById('btnProfileTopup')?.addEventListener('click', () => {
      this.openTopupModal();
    });
    document.getElementById('btnProfileDailyBonus')?.addEventListener('click', () => {
      const res = storage.claimDailyBonus();
      if (res.success) {
        this.showToast(res.message, 'success');
        this.updateWalletDisplay();
        this.renderAuthorProfile();
      } else {
        this.showToast(res.message, 'info');
      }
    });
    document.getElementById('btnProfileSignOut')?.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản tác giả không?')) {
        await supabaseManager.signOut();
        this.showToast('Đã đăng xuất tài khoản thành công.', 'info');
        this.switchView('home');
      }
    });

    // Change Pen Name Modal
    document.getElementById('btnOpenEditPenName')?.addEventListener('click', () => {
      const currentName = supabaseManager.currentProfile?.display_name || '';
      const input = document.getElementById('inputNewPenName');
      if (input) input.value = currentName;
      this.closeAllModals();
      document.getElementById('editPenNameModal')?.classList.add('active');
    });

    document.getElementById('btnSaveNewPenName')?.addEventListener('click', async () => {
      const newName = document.getElementById('inputNewPenName')?.value.trim();
      if (!newName) {
        this.showToast('Vui lòng nhập bút danh mới!', 'error');
        return;
      }

      if (supabaseManager.client && supabaseManager.currentUser) {
        try {
          await supabaseManager.client
            .from('profiles')
            .update({ display_name: newName, updated_at: new Date().toISOString() })
            .eq('id', supabaseManager.currentUser.id);
        } catch {
          // Non-blocking
        }
      }

      if (supabaseManager.currentProfile) {
        supabaseManager.currentProfile.display_name = newName;
      }

      // Update authorName on current projects
      const projects = storage.getProjects();
      projects.forEach(p => {
        p.authorName = newName;
        storage.saveProject(p);
      });

      document.getElementById('editPenNameModal')?.classList.remove('active');
      this.showToast(`Bút danh đã được cập nhật thành: ${newName}`, 'success');
      this.renderAuthorProfile();
      this.renderFullLibraryGrid();
    });

    // Web Novel Reader Controls
    document.getElementById('readerChapterSelect')?.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10) || 1;
      this.loadReaderChapter(idx);
    });

    document.getElementById('readerBtnPrevChapter')?.addEventListener('click', () => {
      if (this.currentReaderChapterIndex > 1) {
        this.loadReaderChapter(this.currentReaderChapterIndex - 1);
      } else {
        this.showToast('Đây đã là chương đầu tiên của tác phẩm!', 'info');
      }
    });

    document.getElementById('readerBtnNextChapter')?.addEventListener('click', () => {
      const totalChaps = this.currentReaderNovel?.chapters?.length || 1;
      if (this.currentReaderChapterIndex < totalChaps) {
        this.loadReaderChapter(this.currentReaderChapterIndex + 1);
      } else {
        this.showToast('Bạn đã đọc đến chương mới nhất của tác phẩm!', 'info');
      }
    });

    document.getElementById('readerBtnFollowStory')?.addEventListener('click', () => {
      if (!this.currentReaderNovel) return;
      const followed = storage.toggleFollowProject(this.currentReaderNovel.id);
      const followBtn = document.getElementById('readerBtnFollowStory');
      if (followBtn) {
        followBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${followed ? '#fbbf24' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>${followed ? 'Đang Theo Dõi' : 'Theo Dõi'}</span>
        `;
        followBtn.className = `btn btn-sm ${followed ? 'btn-secondary' : 'btn-primary'}`;
      }
      this.showToast(followed ? 'Đã thêm truyện vào danh sách theo dõi!' : 'Đã bỏ theo dõi truyện.', 'info');
    });

    // Font Controls
    document.getElementById('readerBtnFontBigger')?.addEventListener('click', () => {
      const prose = document.getElementById('readerChapterContent');
      if (prose) {
        this.readerFontSize = Math.min(1.6, (this.readerFontSize || 1.05) + 0.1);
        prose.style.fontSize = `${this.readerFontSize}rem`;
      }
    });

    document.getElementById('readerBtnFontSmaller')?.addEventListener('click', () => {
      const prose = document.getElementById('readerChapterContent');
      if (prose) {
        this.readerFontSize = Math.max(0.85, (this.readerFontSize || 1.05) - 0.1);
        prose.style.fontSize = `${this.readerFontSize}rem`;
      }
    });
  }

  // --- VietQR Modal ---
  openTopupModal(pkgId = 'author') {
    // Yêu cầu đăng nhập trước khi cho phép nạp
    if (!supabaseManager.currentUser) {
      this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi nạp Xu!', 'info');
      this.openAccountModal('tabAuthLogin');
      return;
    }

    this.closeAllModals();
    document.getElementById('topupModal').classList.add('active');
    this.renderVietQrForPackage(pkgId || 'author');
  }

  renderVietQrForPackage(pkgId) {
    const pkg = BillingEngine.getPackages().find(p => p.id === pkgId) || BillingEngine.getPackages()[1];
    const qrData = BillingEngine.generateVietQrUrl({ amount: pkg.price });

    document.getElementById('vietqrImg').src = qrData.qrUrl;
    document.getElementById('vietqrAmount').textContent = qrData.formattedAmount;
    document.getElementById('vietqrMemo').textContent = qrData.memo;
    document.getElementById('vietqrBank').textContent = `${qrData.bankId} - ${qrData.accountNumber}`;
    document.getElementById('vietqrName').textContent = qrData.accountName;
  }

  openNewProjectModal() {
    if (!supabaseManager.currentUser) {
      this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi tạo bộ truyện mới!', 'info');
      this.openAccountModal('tabAuthLogin');
      return;
    }
    this.closeAllModals();
    document.getElementById('newProjectModal').classList.add('active');
  }

  openNewChapterModal() {
    if (!supabaseManager.currentUser) {
      this.showToast('Vui lòng đăng nhập tài khoản tác giả trước khi tạo chương mới!', 'info');
      this.openAccountModal('tabAuthLogin');
      return;
    }
    this.closeAllModals();
    document.getElementById('newChapterModal').classList.add('active');
  }

  openExportModal() {
    this.closeAllModals();
    document.getElementById('exportModal').classList.add('active');
  }

  async openDiagModal() {
    this.closeAllModals();
    const modal = document.getElementById('diagModal');
    modal.classList.add('active');
    const output = document.getElementById('diagOutput');
    output.textContent = 'Đang tiến hành chẩn đoán toàn diện mâu thuẫn cốt truyện (/diag)...';

    try {
      const fundCheck = BillingEngine.checkFunds('DIAGNOSTICS');
      if (fundCheck.hasFunds) {
        BillingEngine.charge('DIAGNOSTICS', 'Chẩn đoán mâu thuẫn cốt truyện /diag');
        this.updateWalletDisplay();
      }

      const res = await this.studio.editor.runStoryDiagnostics({
        project: storage.getActiveProject()
      });
      output.textContent = res.content;
    } catch (err) {
      output.textContent = `Lỗi chẩn đoán: ${err.message}`;
    }
  }

  openLorebookModal(entry = null) {
    const proj = storage.getActiveProject();
    const modal = document.getElementById('lorebookModal');
    if (!modal) return;

    // Populate Target Character dropdown
    const relTargetSelect = document.getElementById('loreFormRelTarget');
    if (relTargetSelect && proj) {
      const otherChars = (proj.lorebook || []).filter(l => !entry || l.id !== entry.id);
      relTargetSelect.innerHTML = '<option value="">-- Chọn nhân vật liên kết --</option>';
      otherChars.forEach(c => {
        relTargetSelect.innerHTML += `<option value="${c.name}">${c.name} (${c.role || c.category})</option>`;
      });
    }

    if (entry) {
      document.getElementById('lorebookModalTitle').textContent = `✏️ Chỉnh Sửa Hồ Sơ [${entry.name}]`;
      document.getElementById('loreFormId').value = entry.id || '';
      document.getElementById('loreFormName').value = entry.name || '';
      document.getElementById('loreFormCategory').value = entry.category || 'character';
      document.getElementById('loreFormRole').value = entry.role || '';
      document.getElementById('loreFormAliases').value = Array.isArray(entry.aliases) ? entry.aliases.join(', ') : (entry.aliases || '');
      document.getElementById('loreFormDesc').value = entry.description || '';
      
      if (entry.attributes && typeof entry.attributes === 'object') {
        document.getElementById('loreFormAttrs').value = Object.entries(entry.attributes).map(([k, v]) => `${k}: ${v}`).join(' | ');
      } else {
        document.getElementById('loreFormAttrs').value = '';
      }

      if (Array.isArray(entry.relationships) && entry.relationships.length > 0) {
        document.getElementById('loreFormRelTarget').value = entry.relationships[0].targetName || '';
        document.getElementById('loreFormRelType').value = entry.relationships[0].type || 'ally';
        document.getElementById('loreFormRelText').value = entry.relationships[0].relation || '';
      } else {
        document.getElementById('loreFormRelTarget').value = '';
        document.getElementById('loreFormRelType').value = 'ally';
        document.getElementById('loreFormRelText').value = '';
      }
    } else {
      document.getElementById('lorebookModalTitle').textContent = '👤 Thiết Lập Hồ Sơ Lorebook';
      document.getElementById('loreFormId').value = '';
      document.getElementById('loreFormName').value = '';
      document.getElementById('loreFormCategory').value = 'character';
      document.getElementById('loreFormRole').value = '';
      document.getElementById('loreFormAliases').value = '';
      document.getElementById('loreFormDesc').value = '';
      document.getElementById('loreFormAttrs').value = '';
      document.getElementById('loreFormRelTarget').value = '';
      document.getElementById('loreFormRelType').value = 'ally';
      document.getElementById('loreFormRelText').value = '';
    }

    this.closeAllModals();
    modal.classList.add('active');
  }

  // --- Supabase Cloud & Account Management ---
  openAccountModal(targetTab = null) {
    this.closeAllModals();
    document.getElementById('accountModal').classList.add('active');
    if (targetTab) {
      this.switchAccountTab(targetTab);
    }
    this.updateSupabaseConnectionStatus();
  }

  async initSupabase() {
    const creds = supabaseManager.getCredentials();
    const urlInput = document.getElementById('supabaseUrlInput');
    const keyInput = document.getElementById('supabaseAnonKeyInput');
    if (urlInput && creds.url) urlInput.value = creds.url;
    if (keyInput && creds.anonKey) keyInput.value = creds.anonKey;

    this.updateSupabaseConnectionStatus();

    // Listen to Auth changes
    supabaseManager.onAuthStateChange(async (event, session, user, profile) => {
      this.updateAccountUI(user, profile);
      if (event === 'SIGNED_IN' && user) {
        this.showToast(`Đã đăng nhập thành công tài khoản [${profile?.display_name || user.email}]!`, 'success');
        if (profile) {
          storage.syncProfileWallet(profile);
          this.updateWalletDisplay();
        }
        // Auto-sync stories from Cloud
        const cloudProjects = await storage.syncFromCloud();
        if (cloudProjects && cloudProjects.length > 0) {
          this.updateProjectsBadge();
          this.studio.loadActiveProject();
          this.showToast(`Đã đồng bộ ${cloudProjects.length} tác phẩm từ Supabase Cloud.`, 'success');
        }
      } else if (event === 'SIGNED_OUT') {
        this.showToast('Đã đăng xuất tài khoản.', 'info');
      }
    });

    // Check existing session
    try {
      const session = await supabaseManager.getSession();
      if (session?.user) {
        await supabaseManager.loadProfile();
        this.updateAccountUI(supabaseManager.currentUser, supabaseManager.currentProfile);
        if (supabaseManager.currentProfile) {
          storage.syncProfileWallet(supabaseManager.currentProfile);
          this.updateWalletDisplay();
        }
      } else {
        this.updateAccountUI(null, null);
      }
    } catch {
      this.updateAccountUI(null, null);
    }
  }

  updateSupabaseConnectionStatus() {
    const statusEl = document.getElementById('supabaseConnectionStatus');
    if (!statusEl) return;
    if (supabaseManager.isConfigured()) {
      statusEl.innerHTML = 'Trạng thái: <span style="color:#22c55e; font-weight:600;">🟢 Đã kết nối Supabase</span>';
    } else {
      statusEl.innerHTML = 'Trạng thái: <span style="color:#ef4444;">Chưa kết nối (Đang chạy chế độ Cục Bộ)</span>';
    }
  }

  updateAccountUI(user, profile) {
    const dot = document.getElementById('cloudStatusDot');
    const btnText = document.getElementById('accountBtnText');
    const tabProfile = document.getElementById('btnTabProfile');
    const tabLogin = document.getElementById('btnTabLogin');
    const tabRegister = document.getElementById('btnTabRegister');
    const dropdownMenu = document.getElementById('accountDropdownMenu');

    // Show/hide the dropdown menu based on login state
    if (dropdownMenu) {
      dropdownMenu.style.display = user ? '' : 'none';
    }

    const mobNavAccountLabel = document.getElementById('mobNavAccountLabel');

    if (user) {
      if (dot) dot.className = 'status-dot dot-online';
      if (btnText) btnText.textContent = profile?.display_name || user.email.split('@')[0];
      if (mobNavAccountLabel) mobNavAccountLabel.textContent = 'Hồ Sơ';
      if (tabProfile) tabProfile.style.display = 'block';
      if (tabLogin) tabLogin.style.display = 'none';
      if (tabRegister) tabRegister.style.display = 'none';

      // Update profile display
      const nameEl = document.getElementById('userProfileName');
      const emailEl = document.getElementById('userProfileEmail');
      const coinEl = document.getElementById('userProfileCoin');
      const spentEl = document.getElementById('userProfileSpent');

      if (nameEl) nameEl.textContent = profile?.display_name || 'Tác Giả';
      if (emailEl) emailEl.textContent = user.email;
      if (coinEl) coinEl.textContent = `${parseFloat(profile?.coin_balance ?? 50.0).toFixed(1)} Xu`;
      if (spentEl) spentEl.textContent = `${parseFloat(profile?.total_spent ?? 0.0).toFixed(1)} Xu`;

      this.switchAccountTab('tabUserProfile');

      if (this.currentView === 'profile') {
        this.renderAuthorProfile();
      } else if (this.currentView === 'library') {
        this.renderFullLibraryGrid();
      }
    } else {
      if (dot) dot.className = 'status-dot dot-offline';
      if (btnText) btnText.textContent = 'Đăng Nhập';
      if (mobNavAccountLabel) mobNavAccountLabel.textContent = 'Tài Khoản';
      if (tabProfile) tabProfile.style.display = 'none';
      if (tabLogin) tabLogin.style.display = 'block';
      if (tabRegister) tabRegister.style.display = 'block';

      this.switchAccountTab('tabAuthLogin');

      if (this.currentView === 'profile') {
        this.switchView('home');
      } else if (this.currentView === 'library') {
        this.renderFullLibraryGrid();
      }
    }
  }

  switchAccountTab(tabId) {
    document.querySelectorAll('#accountModalTabs .modal-sub-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.account-tab-content').forEach(c => {
      c.style.display = c.id === tabId ? 'block' : 'none';
    });
  }

  bindAccountModal() {
    // Tabs switching
    document.querySelectorAll('#accountModalTabs .modal-sub-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const tabId = tabBtn.getAttribute('data-tab');
        this.switchAccountTab(tabId);
      });
    });

    // Quick switch links inside tabs
    document.getElementById('btnSwitchToReg')?.addEventListener('click', () => {
      this.switchAccountTab('tabAuthRegister');
    });
    document.getElementById('btnSwitchToLog')?.addEventListener('click', () => {
      this.switchAccountTab('tabAuthLogin');
    });

    // Submit Login
    document.getElementById('btnSubmitLogin')?.addEventListener('click', async () => {
      const email = document.getElementById('authLoginEmail')?.value.trim();
      const password = document.getElementById('authLoginPassword')?.value;
      if (!email || !password) {
        this.showToast('Vui lòng nhập đầy đủ Email và Mật khẩu!', 'error');
        return;
      }
      if (!supabaseManager.isConfigured()) {
        this.showToast('Hệ thống lưu trữ đám mây đang được bảo trì. Vui lòng thử lại sau!', 'error');
        return;
      }

      const btn = document.getElementById('btnSubmitLogin');
      btn.disabled = true;
      btn.textContent = 'Đang đăng nhập...';

      try {
        await supabaseManager.signIn(email, password);
        document.getElementById('accountModal').classList.remove('active');
      } catch (err) {
        const errMsg = (err.message || String(err)).toLowerCase();
        if (
          errMsg.includes('invalid login credentials') ||
          errMsg.includes('user not found') ||
          errMsg.includes('email not found') ||
          errMsg.includes('invalid_grant') ||
          errMsg.includes('invalid_credentials')
        ) {
          this.showToast('Tài khoản chưa tồn tại hoặc sai mật khẩu. Đang tự động chuyển sang Đăng ký...', 'info');
          this.switchAccountTab('tabAuthRegister');

          const regEmail = document.getElementById('authRegEmail');
          const regPass = document.getElementById('authRegPassword');
          const regName = document.getElementById('authRegName');
          if (regEmail) regEmail.value = email;
          if (regPass) regPass.value = password;
          if (regName) {
            regName.focus();
            if (!regName.value) {
              regName.value = email.split('@')[0];
            }
          }
        } else {
          this.showToast(`Đăng nhập thất bại: ${err.message || err}`, 'error');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Đăng Nhập Tài Khoản';
      }
    });

    // Submit Register
    document.getElementById('btnSubmitRegister')?.addEventListener('click', async () => {
      const name = document.getElementById('authRegName')?.value.trim();
      const email = document.getElementById('authRegEmail')?.value.trim();
      const password = document.getElementById('authRegPassword')?.value;
      if (!email || !password) {
        this.showToast('Vui lòng nhập Email và Mật khẩu!', 'error');
        return;
      }
      if (password.length < 6) {
        this.showToast('Mật khẩu cần tối thiểu 6 ký tự!', 'error');
        return;
      }
      if (!supabaseManager.isConfigured()) {
        this.showToast('Hệ thống lưu trữ đám mây đang được bảo trì. Vui lòng thử lại sau!', 'error');
        return;
      }

      const btn = document.getElementById('btnSubmitRegister');
      btn.disabled = true;
      btn.textContent = 'Đang tạo tài khoản...';

      try {
        const res = await supabaseManager.signUp(email, password, name);
        if (res?.isFallback) {
          this.showToast('✨ Đã kích hoạt tài khoản tác giả thành công (Tặng 50.0 Xu)! Bạn có thể sáng tác ngay.', 'success');
        } else {
          this.showToast('✨ Đăng ký thành công! Chào mừng bạn đến với AI Novel Studio (Tặng 50.0 Xu).', 'success');
        }
        document.getElementById('accountModal').classList.remove('active');
        this.updateWalletDisplay();
      } catch (err) {
        this.showToast(`Đăng ký thất bại: ${err.message || err}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '✨ Tạo Tài Khoản Tác Giả';
      }
    });

    // Sign Out
    document.getElementById('btnUserSignOut')?.addEventListener('click', async () => {
      await supabaseManager.signOut();
      this.updateAccountUI(null, null);
      document.getElementById('accountModal').classList.remove('active');
    });

    // Sync cloud down to local
    document.getElementById('btnSyncAllCloud')?.addEventListener('click', async () => {
      const btn = document.getElementById('btnSyncAllCloud');
      btn.disabled = true;
      btn.textContent = '🔄 Đang tải từ Đám mây...';
      try {
        const projs = await storage.syncFromCloud();
        if (projs && projs.length > 0) {
          this.updateProjectsBadge();
          this.studio.loadActiveProject();
          this.showToast(`Đã đồng bộ thành công ${projs.length} tác phẩm từ Đám mây!`, 'success');
        } else {
          this.showToast('Tủ truyện của bạn trên đám mây đã đồng bộ mới nhất.', 'info');
        }
      } catch (err) {
        this.showToast(`Lỗi đồng bộ: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Tải Lại Dữ Liệu Tủ Truyện Từ Đám Mây';
      }
    });

    // Upload local to cloud
    document.getElementById('btnUploadLocalToCloud')?.addEventListener('click', async () => {
      const btn = document.getElementById('btnUploadLocalToCloud');
      btn.disabled = true;
      btn.textContent = '⬆️ Đang sao lưu lên Đám mây...';
      try {
        const count = await storage.uploadAllToCloud();
        this.showToast(`Đã sao lưu thành công ${count} bộ truyện lên Đám mây!`, 'success');
      } catch (err) {
        this.showToast(`Lỗi sao lưu: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '⬆️ Sao Lưu Tất Cả Truyện Cục Bộ Lên Đám Mây';
      }
    });
  }

  bindSystemLogModal() {
    // Open system log modal
    document.getElementById('btnOpenSystemLogs')?.addEventListener('click', () => {
      this.openSystemLogModal();
    });

    // Ping KiraAI
    document.getElementById('btnPingKiraNow')?.addEventListener('click', async () => {
      const pingBtn = document.getElementById('btnPingKiraNow');
      const resSpan = document.getElementById('kiraPingResult');
      pingBtn.disabled = true;
      pingBtn.textContent = '⏳ Đang ping...';
      resSpan.textContent = 'Đang kiểm tra kết nối tới https://kiraai.vn...';
      resSpan.style.color = 'var(--text-muted)';

      try {
        const pingRes = await this.apiClient.testConnection();
        if (pingRes.success) {
          resSpan.textContent = `🟢 Thành công (${pingRes.latency}) - Model: ${pingRes.model}`;
          resSpan.style.color = 'var(--accent-emerald)';
          appLogger.log('INFO', `Ping KiraAI thành công: ${pingRes.latency} (Model: ${pingRes.model})`);
        } else {
          resSpan.textContent = `🔴 Thất bại: ${pingRes.message}`;
          resSpan.style.color = 'var(--danger)';
          appLogger.log('ERROR', `Ping KiraAI thất bại: ${pingRes.message}`);
        }
      } catch (e) {
        resSpan.textContent = `🔴 Lỗi mạng: ${e.message}`;
        resSpan.style.color = 'var(--danger)';
        appLogger.log('ERROR', `Lỗi ping KiraAI: ${e.message}`);
      } finally {
        pingBtn.disabled = false;
        pingBtn.textContent = '⚡ Ping Kiểm Tra KiraAI';
        this.renderSystemLogs();
      }
    });

    // Copy system logs
    document.getElementById('btnCopySystemLogs')?.addEventListener('click', async () => {
      try {
        const text = appLogger.exportAsText();
        await navigator.clipboard.writeText(text);
        this.showToast('Đã sao chép toàn bộ nhật ký lỗi vào bộ nhớ tạm!', 'success');
      } catch (_) {
        this.showToast('Không thể sao chép tự động, vui lòng chọn thủ công.', 'error');
      }
    });

    // Clear system logs
    document.getElementById('btnClearSystemLogs')?.addEventListener('click', () => {
      appLogger.clear();
      this.renderSystemLogs();
      this.showToast('Đã xóa sạch nhật ký lỗi.', 'info');
    });

    // Auto-update if modal is open
    appLogger.onLog(() => {
      const modal = document.getElementById('systemLogModal');
      if (modal && modal.classList.contains('active')) {
        this.renderSystemLogs();
      }
    });
  }

  openSystemLogModal() {
    this.closeAllModals();
    this.renderSystemLogs();
    const modal = document.getElementById('systemLogModal');
    if (modal) modal.classList.add('active');
  }

  renderSystemLogs() {
    const container = document.getElementById('systemLogContainer');
    const countEl = document.getElementById('systemLogCount');
    if (!container) return;

    const logs = appLogger.getLogs();
    if (countEl) countEl.textContent = `${logs.length} sự kiện`;

    if (logs.length === 0) {
      container.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:24px 0;">Hệ thống đang hoạt động ổn định, chưa ghi nhận lỗi nào.</div>';
      return;
    }

    container.innerHTML = logs.map(l => {
      let badgeColor = '#38bdf8';
      let icon = 'ℹ️';
      let rowBg = 'transparent';

      if (l.type === 'ERROR') {
        badgeColor = '#ef4444';
        icon = '❌';
        rowBg = 'rgba(239, 68, 68, 0.08)';
      } else if (l.type === 'WARN') {
        badgeColor = '#f59e0b';
        icon = '⚠️';
        rowBg = 'rgba(245, 158, 11, 0.06)';
      } else if (l.type === 'API') {
        badgeColor = '#a855f7';
        icon = '⚡';
      }

      let detailsHtml = '';
      if (l.details) {
        const detailsStr = typeof l.details === 'object' ? JSON.stringify(l.details, null, 2) : String(l.details);
        detailsHtml = `<pre style="margin:4px 0 0; padding:6px 8px; background:rgba(0,0,0,0.4); border-radius:4px; font-size:0.75rem; color:var(--text-dim); white-space:pre-wrap; max-height:120px; overflow-y:auto;">${this.escapeHtml(detailsStr)}</pre>`;
      }

      return `
        <div style="padding:6px 8px; margin-bottom:6px; border-radius:4px; background:${rowBg}; border-left:3px solid ${badgeColor};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <span style="color:var(--text-muted); font-size:0.75rem; flex-shrink:0;">[${l.time}]</span>
            <span style="color:${badgeColor}; font-weight:700; font-size:0.75rem; flex-shrink:0;">${icon} [${l.type}]</span>
            <span style="flex:1; color:var(--text-main); font-size:0.8rem; word-break:break-word;">${this.escapeHtml(l.message)}</span>
          </div>
          ${detailsHtml}
        </div>
      `;
    }).join('');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.StudioApp = new Application();
  window.StudioApp.init();
});
