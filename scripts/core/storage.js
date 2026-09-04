/**
 * AI Novel Studio - Storage Engine
 * Handles persistent storage for Projects, Chapters, Lorebook, Configuration, and Coin Ledger
 */

import { KIRA_CONFIG, BILLING_CONFIG } from '../config.js';
import { supabaseManager } from '../api/supabase.js';

const STORAGE_KEYS = {
  CONFIG: 'ainovel_config_v1',
  WALLET: 'ainovel_wallet_v1',
  PROJECTS: 'ainovel_projects_v1',
  ACTIVE_PROJECT: 'ainovel_active_project_id_v1',
  ACTIVITY_LOGS: 'ainovel_activity_logs_v1'
};

export class StorageEngine {
  constructor() {
    this.initDefaults();
  }

  initDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
      const defaultConfig = {
        apiKey: '',
        baseUrl: KIRA_CONFIG.DEFAULT_BASE_URL,
        roleModels: { ...KIRA_CONFIG.DEFAULT_ROLES },
        language: 'vi',
        autoSaveInterval: 3000,
        ghostTextEnabled: true,
        zenMode: false,
        soundEffects: true
      };
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(defaultConfig));
    }

    if (!localStorage.getItem(STORAGE_KEYS.WALLET)) {
      const defaultWallet = {
        balance: BILLING_CONFIG.INITIAL_FREE_COINS,
        totalSpent: 0,
        lastDailyCheckin: null,
        transactions: [
          {
            id: 'tx_init_' + Date.now(),
            type: 'bonus',
            amount: BILLING_CONFIG.INITIAL_FREE_COINS,
            description: 'Tặng Xu Tân Thủ chào mừng tác giả',
            timestamp: new Date().toISOString()
          }
        ]
      };
      localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(defaultWallet));
    }

    if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
      const demoProject = this.createDefaultDemoProject();
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify([demoProject]));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, demoProject.id);
    }
  }

  getConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG)) || {};
      if (cfg.roleModels) {
        Object.keys(cfg.roleModels).forEach(role => {
          const currentM = cfg.roleModels[role] || '';
          if (currentM.includes('deepseek')) {
            if (role === 'architect' || role === 'editor' || role === 'arbiter') {
              cfg.roleModels[role] = 'glm-5.3-flash';
            } else {
              cfg.roleModels[role] = 'qwen3.8-flash';
            }
          }
        });
      }
      return cfg;
    } catch {
      return {};
    }
  }

  saveConfig(config) {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
    return updated;
  }

  getWallet() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.WALLET)) || { balance: 0, transactions: [] };
    } catch {
      return { balance: 0, transactions: [] };
    }
  }

  deductCoins(amount, description = 'Sử dụng AI sáng tác') {
    const wallet = this.getWallet();
    if (wallet.balance < amount) {
      return {
        success: false,
        balance: wallet.balance,
        message: `Số dư Xu không đủ (${wallet.balance.toFixed(1)} / ${amount} Xu). Vui lòng nạp thêm Xu!`
      };
    }

    wallet.balance = Math.max(0, wallet.balance - amount);
    wallet.totalSpent = (wallet.totalSpent || 0) + amount;
    wallet.transactions.unshift({
      id: 'tx_sub_' + Date.now(),
      type: 'spend',
      amount: -amount,
      description,
      timestamp: new Date().toISOString()
    });

    if (wallet.transactions.length > 50) {
      wallet.transactions = wallet.transactions.slice(0, 50);
    }

    localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(wallet));

    // Đồng bộ lên Supabase Cloud nếu đã đăng nhập
    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      supabaseManager.updateWallet(wallet.balance, wallet.totalSpent);
      supabaseManager.addTransaction('spend', -amount, description);
    }

    return { success: true, balance: wallet.balance };
  }

  addCoins(amount, description = 'Nạp Xu qua VietQR') {
    const wallet = this.getWallet();
    wallet.balance += amount;
    wallet.transactions.unshift({
      id: 'tx_add_' + Date.now(),
      type: 'topup',
      amount: amount,
      description,
      timestamp: new Date().toISOString()
    });

    localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(wallet));

    // Đồng bộ lên Supabase Cloud nếu đã đăng nhập
    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      supabaseManager.updateWallet(wallet.balance, wallet.totalSpent);
      supabaseManager.addTransaction('topup', amount, description);
    }

    return { success: true, balance: wallet.balance };
  }

  claimDailyBonus() {
    const wallet = this.getWallet();
    const today = new Date().toDateString();
    if (wallet.lastDailyCheckin === today) {
      return { success: false, message: 'Bạn đã điểm danh nhận Xu hôm nay rồi!' };
    }

    wallet.balance += BILLING_CONFIG.DAILY_CHECKIN_COINS;
    wallet.lastDailyCheckin = today;
    wallet.transactions.unshift({
      id: 'tx_daily_' + Date.now(),
      type: 'bonus',
      amount: BILLING_CONFIG.DAILY_CHECKIN_COINS,
      description: 'Điểm danh nhận Xu hàng ngày',
      timestamp: new Date().toISOString()
    });

    localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(wallet));

    // Đồng bộ lên Supabase Cloud nếu đã đăng nhập
    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      supabaseManager.updateWallet(wallet.balance, wallet.totalSpent);
      supabaseManager.addTransaction('bonus', BILLING_CONFIG.DAILY_CHECKIN_COINS, 'Điểm danh nhận Xu hàng ngày');
    }

    return {
      success: true,
      balance: wallet.balance,
      coinsAdded: BILLING_CONFIG.DAILY_CHECKIN_COINS,
      message: `Điểm danh thành công! Nhận +${BILLING_CONFIG.DAILY_CHECKIN_COINS} Xu.`
    };
  }

  getProjects() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS)) || [];
    } catch {
      return [];
    }
  }

  saveProjects(projects) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  }

  getActiveProjectId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT) || '';
  }

  setActiveProjectId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, id);
  }

  getActiveProject() {
    const projects = this.getProjects();
    const activeId = this.getActiveProjectId();
    let project = projects.find(p => p.id === activeId);
    if (!project && projects.length > 0) {
      project = projects[0];
      this.setActiveProjectId(project.id);
    }
    return project || null;
  }

  deleteProject(projectId) {
    let projects = this.getProjects();
    projects = projects.filter(p => p.id !== projectId);
    if (projects.length === 0) {
      const demo = this.createDefaultDemoProject();
      projects = [demo];
    }
    this.saveProjects(projects);
    if (this.getActiveProjectId() === projectId) {
      this.setActiveProjectId(projects[0].id);
    }

    // Xóa trên Supabase Cloud nếu đã kết nối
    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      supabaseManager.deleteCloudProject(projectId);
    }

    return projects;
  }

  saveProject(project) {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    project.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.unshift(project);
    }

    this.saveProjects(projects);

    // Đồng bộ lên Supabase Cloud
    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      supabaseManager.saveCloudProject(project);
    }

    return project;
  }

  createNewProject({ title, genre = 'xianxia', premise = '', authorName = 'Vô Danh', protagonistName = '', worldContext = '' }) {
    const starterLore = this.generateGenreStarterLore(genre, protagonistName, worldContext);
    const resolvedProtagonist = (protagonistName && protagonistName.trim()) 
      ? protagonistName.trim() 
      : (starterLore.find(l => l.role?.includes('chính'))?.name || 'Nhân vật chính');

    const newProj = {
      id: 'proj_' + Date.now(),
      title: title || 'Bộ Tiểu Thuyết Mới',
      genre,
      authorName,
      premise,
      protagonistName: resolvedProtagonist,
      isPublic: false,
      viewsCount: 0,
      followersCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      worldSettings: {
        background: worldContext || '',
        powerSystem: '',
        factions: starterLore.filter(l => l.category === 'faction').map(f => f.name),
        locations: starterLore.filter(l => l.category === 'location').map(loc => loc.name)
      },
      lorebook: starterLore,
      rollingOutlines: [],
      chapters: []
    };

    const projects = this.getProjects();
    projects.unshift(newProj);
    this.saveProjects(projects);
    this.setActiveProjectId(newProj.id);

    // Đồng bộ truyện mới lên Supabase Cloud
    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      supabaseManager.saveCloudProject(newProj);
    }

    return newProj;
  }

  async togglePublishProject(projectId) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return null;

    proj.isPublic = !Boolean(proj.isPublic);
    proj.updatedAt = new Date().toISOString();
    this.saveProjects(projects);

    if (supabaseManager.isConfigured() && supabaseManager.currentUser) {
      await supabaseManager.saveCloudProject(proj);
      await supabaseManager.togglePublishProject(projectId, proj.isPublic);
    }

    return proj;
  }

  getFollowedProjectIds() {
    try {
      return JSON.parse(localStorage.getItem('ainovel_followed_projects')) || [];
    } catch {
      return [];
    }
  }

  toggleFollowProject(projectId) {
    let followed = this.getFollowedProjectIds();
    const isFollowed = followed.includes(projectId);
    if (isFollowed) {
      followed = followed.filter(id => id !== projectId);
    } else {
      followed.push(projectId);
    }
    localStorage.setItem('ainovel_followed_projects', JSON.stringify(followed));

    // Update local project followersCount if available
    const projects = this.getProjects();
    const p = projects.find(item => item.id === projectId);
    if (p) {
      p.followersCount = Math.max(0, (p.followersCount || 0) + (isFollowed ? -1 : 1));
      this.saveProjects(projects);
    }

    return !isFollowed;
  }

  incrementProjectViews(projectId) {
    const projects = this.getProjects();
    const p = projects.find(item => item.id === projectId);
    if (p) {
      p.viewsCount = (p.viewsCount || 0) + 1;
      this.saveProjects(projects);
    }
    if (supabaseManager.isConfigured()) {
      supabaseManager.incrementProjectViews(projectId);
    }
  }

  async syncFromCloud() {
    if (!supabaseManager.isConfigured() || !supabaseManager.currentUser) return null;
    try {
      const cloudProjects = await supabaseManager.fetchCloudProjects();
      if (cloudProjects && cloudProjects.length > 0) {
        this.saveProjects(cloudProjects);
        const activeId = this.getActiveProjectId();
        if (!cloudProjects.some(p => p.id === activeId)) {
          this.setActiveProjectId(cloudProjects[0].id);
        }
        return cloudProjects;
      }
      return [];
    } catch (e) {
      console.error('Lỗi syncFromCloud:', e);
      return null;
    }
  }

  async uploadAllToCloud() {
    if (!supabaseManager.isConfigured() || !supabaseManager.currentUser) return 0;
    const projects = this.getProjects();
    let count = 0;
    for (const p of projects) {
      await supabaseManager.saveCloudProject(p);
      count++;
    }
    const wallet = this.getWallet();
    await supabaseManager.updateWallet(wallet.balance, wallet.totalSpent);
    return count;
  }

  syncProfileWallet(profile) {
    if (!profile) return;
    const wallet = this.getWallet();
    if (profile.coin_balance !== undefined && profile.coin_balance !== null) {
      wallet.balance = parseFloat(profile.coin_balance) || 0;
    }
    if (profile.total_spent !== undefined && profile.total_spent !== null) {
      wallet.totalSpent = parseFloat(profile.total_spent) || 0;
    }
    localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(wallet));
  }

  generateGenreStarterLore(genre = 'xianxia', customName = '', worldContext = '') {
    const defaultNames = {
      xianxia: 'Diệp Trần',
      wuxia: 'Tiêu Nhất Kiếm',
      urban: 'Lâm Phong',
      romance: 'Thẩm Tri Niệm',
      mystery: 'Lucas Vance',
      scifi: 'La Viêm'
    };
    const mainName = (customName && customName.trim()) ? customName.trim() : (defaultNames[genre] || 'Diệp Trần');

    const presets = {
      xianxia: [
        {
          id: 'lore_' + Date.now() + '_1',
          name: mainName,
          aliases: ['Trần thiếu', 'Diệp sư đệ', 'Nhân vật chính'],
          category: 'character',
          role: 'Nhân vật chính',
          description: '18 tuổi, thân hình gầy gò nhưng ánh mắt sắc bén như kiếm. Trầm tĩnh, quyết đoán, mang huyết mạch lôi đình.',
          attributes: { realm: 'Luyện Khí tầng 9', bloodline: 'Cửu Thiên Thần Lôi' },
          relationships: [
            { targetName: 'Liễu Như Yên', relation: 'Tri kỷ đồng môn', type: 'ally' },
            { targetName: 'Mặc Vô Nhai', relation: 'Tử thù hãm hại', type: 'enemy' },
            { targetName: 'Huyền Phong Trưởng Lão', relation: 'Sư phụ che chở', type: 'master' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_2',
          name: 'Liễu Như Yên',
          aliases: ['Liễu sư tỷ', 'Băng Sơn Tiên Tử'],
          category: 'character',
          role: 'Nữ chính / Sư tỷ',
          description: 'Nữ đệ tử kiệt xuất nhất môn phái, sở hữu Băng Phách Linh Thể. Luôn âm thầm trợ giúp nhân vật chính.',
          attributes: { realm: 'Trúc Cơ tầng 3', weapon: 'Hàn Sương Kiếm' },
          relationships: [
            { targetName: mainName, relation: 'Tình cảm thầm kín / Bảo bọc', type: 'romance' },
            { targetName: 'Mặc Vô Nhai', relation: 'Cảnh giác / Khinh thường', type: 'rival' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_3',
          name: 'Mặc Vô Nhai',
          aliases: ['Mặc sư huynh', 'Thanh Vân Thủ Tịch'],
          category: 'character',
          role: 'Phản diện / Kẻ địch',
          description: 'Đại đệ tử kiêu ngạo, nhiều mưu mô, tìm mọi thủ đoạn triệt hạ nhân vật chính để độc chiếm tài nguyên.',
          attributes: { realm: 'Trúc Cơ tầng 5', weapon: 'Hắc Xà Kiếm' },
          relationships: [
            { targetName: mainName, relation: 'Muốn diệt trừ tận gốc', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_4',
          name: 'Huyền Phong Trưởng Lão',
          aliases: ['Huyền Phong Chân Nhân'],
          category: 'character',
          role: 'Tiền bối / Sư phụ',
          description: 'Trưởng lão Tàng Kinh Các ẩn thế, tính tình phóng khoáng, nhìn thấu tiềm năng phi thường của nhân vật chính.',
          attributes: { realm: 'Kim Đan Hậu kỳ', faction: 'Thanh Vân Tông' },
          relationships: [
            { targetName: mainName, relation: 'Truyền thụ tuyệt học', type: 'master' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_loc',
          name: 'Thanh Vân Sơn Mạch',
          aliases: ['Thanh Vân Tông'],
          category: 'location',
          role: 'Ngoại cảnh khởi đầu',
          description: 'Dãy núi hiểm trở quanh năm mây mù bao phủ, linh khí tụ hội, nơi đóng quân của Thanh Vân Tông.',
          attributes: { type: 'Linh địa tu hành' },
          relationships: [
            { targetName: mainName, relation: 'Nơi khởi đầu tu đạo', type: 'origin' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_fac',
          name: 'Thanh Vân Tông',
          aliases: ['Thanh Vân Môn'],
          category: 'faction',
          role: 'Tông môn sở thuộc',
          description: 'Chính đạo tông môn ngàn năm danh tiếng, nhưng bên trong đệ tử tranh đấu đoạt bảo gay gắt.',
          attributes: { scale: 'Nhị phẩm Tông Môn' },
          relationships: [
            { targetName: mainName, relation: 'Môn phái tu luyện', type: 'ally' }
          ]
        }
      ],
      wuxia: [
        {
          id: 'lore_' + Date.now() + '_1',
          name: mainName,
          aliases: ['Nhất Kiếm Tuyệt Trần'],
          category: 'character',
          role: 'Nhân vật chính',
          description: 'Lãng khách phiêu bạt chốn giang hồ, trọng tình trọng nghĩa, kiếm thuật xuất quỷ nhập thần.',
          attributes: { weapon: 'Thanh Phong Tàn Kiếm', faction: 'Tán nhân' },
          relationships: [
            { targetName: 'Dạ Nguyệt Nương', relation: 'Hồng nhan tri kỷ', type: 'romance' },
            { targetName: 'Thiết Lãnh Huyết', relation: 'Kẻ thù diệt môn', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_2',
          name: 'Dạ Nguyệt Nương',
          aliases: ['Nguyệt Ảnh Sát Thủ'],
          category: 'character',
          role: 'Nữ chính / Hiệp nữ',
          description: 'Mỹ nhân sát thủ của U Minh Các, sau vì cảm mến sự trượng nghĩa của nhân vật chính mà đồng hành.',
          attributes: { weapon: 'Đoản Đao Nguyệt Nha', skill: 'Bạch Hạc Khinh Công' },
          relationships: [
            { targetName: mainName, relation: 'Sinh tử tương tùy', type: 'romance' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_3',
          name: 'Thiết Lãnh Huyết',
          aliases: ['Diêm La Thiết Thủ'],
          category: 'character',
          role: 'Phản diện',
          description: 'Minh chủ tà đạo, thủ đoạn tàn độc, thèm khát bí kíp võ học thượng thừa.',
          attributes: { realm: 'Hóa Cảnh Đỉnh Phong' },
          relationships: [
            { targetName: mainName, relation: 'Truy sát đoạt bảo', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_loc',
          name: 'U Minh Cốc',
          aliases: ['Hắc Nhai Phong'],
          category: 'location',
          role: 'Hiểm địa giang hồ',
          description: 'Thung lũng u ám giáp ranh chánh tà, chướng khí mịt mù và mai phục trùng trùng.',
          attributes: { type: 'Hiểm địa' },
          relationships: [
            { targetName: mainName, relation: 'Chiến địa huyết chiến', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_fac',
          name: 'Thiết Kiếm Môn',
          aliases: ['Bắc Kiếm Phái'],
          category: 'faction',
          role: 'Đại phái võ lâm',
          description: 'Môn phái kiếm thuật danh tiếng phương Bắc, tranh giành ngôi vị minh chủ võ lâm.',
          attributes: { tier: 'Đại môn phái' },
          relationships: [
            { targetName: mainName, relation: 'Mối thù giang hồ', type: 'rival' }
          ]
        }
      ],
      urban: [
        {
          id: 'lore_' + Date.now() + '_1',
          name: mainName,
          aliases: ['Lâm đại sư', 'Bắc Huyền Tiên Tôn'],
          category: 'character',
          role: 'Nhân vật chính',
          description: 'Độ Kiếp Tiên Tôn trùng sinh trở về thời trẻ ở đô thị, tài y thuật xuất thần nhập hóa, coi thường quyền quý.',
          attributes: { power: 'Cửu Thiên Huyền Công', realm: 'Trùng sinh sơ kỳ' },
          relationships: [
            { targetName: 'Sở Tuyết Kỳ', relation: 'Vị hôn thê / Tương ái tương sát', type: 'romance' },
            { targetName: 'Triệu Thế Hạo', relation: 'Thiếu gia đối đầu', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_2',
          name: 'Sở Tuyết Kỳ',
          aliases: ['Băng Sơn Tổng Tài'],
          category: 'character',
          role: 'Nữ chính',
          description: 'Nữ chủ tịch tập đoàn Sở Thị, thông minh kiêu kỳ, ban đầu lạnh nhạt nhưng dần kinh ngạc trước bản lĩnh của nam chính.',
          attributes: { status: 'Tổng giám đốc Sở Thị' },
          relationships: [
            { targetName: mainName, relation: 'Vị hôn phu', type: 'romance' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_3',
          name: 'Triệu Thế Hạo',
          aliases: ['Triệu thiếu gia'],
          category: 'character',
          role: 'Phản diện',
          description: 'Đại thiếu gia Triệu gia giàu có, kênh kiệu, nhiều lần thuê sát thủ và dùng tiền bạc chèn ép nhân vật chính.',
          attributes: { status: 'Người thừa kế Triệu Gia' },
          relationships: [
            { targetName: mainName, relation: 'Ganh ghét / Đối địch', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_loc',
          name: 'Giang Châu Thị',
          aliases: ['Đô thị Giang Châu'],
          category: 'location',
          role: 'Ngoại cảnh chính',
          description: 'Trung tâm kinh tế tài chính phồn hoa bậc nhất, ẩn chứa sự tranh đấu ngầm của tứ đại gia tộc.',
          attributes: { type: 'Đô thị sầm uất' },
          relationships: [
            { targetName: mainName, relation: 'Nơi quật khởi danh tiếng', type: 'origin' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_fac',
          name: 'Sở Thị Tập Đoàn',
          aliases: ['Sở Gia'],
          category: 'faction',
          role: 'Hào môn tài phiệt',
          description: 'Gia tộc thương nghiệp hàng đầu Giang Châu đang đứng trước các đợt thôn tính ngầm.',
          attributes: { scale: 'Tài phiệt tỷ đô' },
          relationships: [
            { targetName: mainName, relation: 'Đồng minh liên minh', type: 'ally' }
          ]
        }
      ],
      romance: [
        {
          id: 'lore_' + Date.now() + '_1',
          name: mainName,
          aliases: ['Tri Niệm', 'Tam tiểu thư'],
          category: 'character',
          role: 'Nhân vật chính',
          description: 'Khuê tú đích nữ thông tuệ, dũng cảm, biết quyền biến trong hậu viện và triều đình.',
          attributes: { skill: 'Cầm kỳ thi họa, trù mưu' },
          relationships: [
            { targetName: 'Tạ Cảnh Hoài', relation: 'Định mệnh kết duyên', type: 'romance' },
            { targetName: 'Tô Ngọc Nhi', relation: 'Thứ muội hãm hại', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_2',
          name: 'Tạ Cảnh Hoài',
          aliases: ['Nhiếp Chính Vương', 'Cửu Gia'],
          category: 'character',
          role: 'Nam chính',
          description: 'Quyền khuynh triều dã, sát phạt quyết đoán, lạnh lùng tàn nhẫn nhưng dành trọn sự cưng chiều cho nữ chính.',
          attributes: { title: 'Nhiếp Chính Vương' },
          relationships: [
            { targetName: mainName, relation: 'Chân ái độc sủng', type: 'romance' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_3',
          name: 'Tô Ngọc Nhi',
          aliases: ['Ngọc Nhi'],
          category: 'character',
          role: 'Phản diện',
          description: 'Thứ muội bề ngoài yếu đuối đáng thương nhưng tâm địa độc ác, luôn tìm cách hãm hại đích tỷ.',
          attributes: { identity: 'Thứ nữ' },
          relationships: [
            { targetName: mainName, relation: 'Đố kỵ ganh ghét', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_loc',
          name: 'Thịnh Kinh Thành',
          aliases: ['Kinh Đô Hoàng Triều'],
          category: 'location',
          role: 'Kinh đô quyền quý',
          description: 'Kinh đô phồn hoa tráng lệ, nơi diễn ra những âm mưu hậu viện và cung đình tranh đoạt.',
          attributes: { type: 'Hoàng thành' },
          relationships: [
            { targetName: mainName, relation: 'Nơi chuyển mình tranh đấu', type: 'origin' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_fac',
          name: 'Nhiếp Chính Vương Phủ',
          aliases: ['Vương Phủ'],
          category: 'faction',
          role: 'Quyền lực tối thượng',
          description: 'Phủ đệ của Nhiếp Chính Vương Tạ Cảnh Hoài, nắm giữ quyền hành quân chính quốc gia.',
          attributes: { status: 'Vương quyền đỉnh phong' },
          relationships: [
            { targetName: mainName, relation: 'Hậu thuẫn vững chãi', type: 'ally' }
          ]
        }
      ],
      mystery: [
        {
          id: 'lore_' + Date.now() + '_1',
          name: mainName,
          aliases: ['Học Giả Thần Bí', 'Kẻ Ngốc'],
          category: 'character',
          role: 'Nhân vật chính',
          description: 'Người xuyên không sở hữu màn sương mù xám, nắm giữ con đường Chiêm Bặc Gia huyền bí.',
          attributes: { pathway: 'Chiêm Bặc Gia', sequence: 'Danh sách 9' },
          relationships: [
            { targetName: 'Audrey Hall', relation: 'Thành viên Tarot Club', type: 'ally' },
            { targetName: 'Amon', relation: 'Kẻ thao túng bí ẩn', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_2',
          name: 'Audrey Hall',
          aliases: ['Tiểu Thư Chính Nghĩa'],
          category: 'character',
          role: 'Đồng minh',
          description: 'Tiểu thư quý tộc giàu lòng trắc ẩn, theo đuổi con đường Khán Thủ Nhân (Tâm Lý Học Gia).',
          attributes: { pathway: 'Khán Thủ Nhân' },
          relationships: [
            { targetName: mainName, relation: 'Tín đồ trung thành', type: 'ally' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_3',
          name: 'Amon',
          aliases: ['Kẻ Đeo Kính Một Mắt', 'Thiên Sứ Thời Gian'],
          category: 'character',
          role: 'Phản diện',
          description: 'Hiện thân của sự dối trá và thời gian, luôn mỉm cười mang lại nỗi kinh hoàng tột độ.',
          attributes: { pathway: 'Thời Gian / Đạo Tặc' },
          relationships: [
            { targetName: mainName, relation: 'Kẻ thù số một', type: 'enemy' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_loc',
          name: 'Backlund Thành',
          aliases: ['Thành Phố Sương Mù'],
          category: 'location',
          role: 'Đô thị hơi nước',
          description: 'Thủ phủ công nghiệp hơi nước mờ mịt khói sương, tràn ngập các vụ án siêu nhiên và tà giáo.',
          attributes: { type: 'Thành thị kỳ bí' },
          relationships: [
            { targetName: mainName, relation: 'Nơi khám phá bí ẩn', type: 'origin' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_fac',
          name: 'Tarot Club (Tháp La Hội)',
          aliases: ['Hội Tháp La'],
          category: 'faction',
          role: 'Hội kín siêu phàm',
          description: 'Tổ chức thần bí tối cao do nhân vật chính bí mật triệu tập bên trên làn sương mù xám.',
          attributes: { tier: 'Hội kín siêu nhiên' },
          relationships: [
            { targetName: mainName, relation: 'Thủ lĩnh sáng lập', type: 'master' }
          ]
        }
      ],
      scifi: [
        {
          id: 'lore_' + Date.now() + '_1',
          name: mainName,
          aliases: ['Chiến thần Trái Đất', 'La Nghị Viên'],
          category: 'character',
          role: 'Nhân vật chính',
          description: 'Chiến binh tinh thần niệm sư thiên tài, mang theo ý chí bất khuất vươn ra vũ trụ mênh mông.',
          attributes: { class: 'Tinh Thần Niệm Sư', tier: 'Hằng Tinh cấp' },
          relationships: [
            { targetName: 'Từ Hân', relation: 'Người yêu / Bạn đời', type: 'romance' },
            { targetName: 'Ba Ba Tháp', relation: 'AI Hướng dẫn viên', type: 'ally' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_2',
          name: 'Từ Hân',
          aliases: ['Hân Nhi'],
          category: 'character',
          role: 'Nữ chính',
          description: 'Hậu phương vững chắc, thông minh dịu dàng, luôn tin tưởng và ủng hộ mọi quyết định của nam chính.',
          attributes: { status: 'Tập đoàn Từ Thị' },
          relationships: [
            { targetName: mainName, relation: 'Tình cảm sắt son', type: 'romance' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_3',
          name: 'Ba Ba Tháp',
          aliases: ['Ác Ma Trợ Lý'],
          category: 'character',
          role: 'Trợ lý AI / Tiền bối',
          description: 'Trí tuệ nhân tạo của vẫn lạc Bất Hủ cường giả, truyền thừa tuyệt kỹ Vẫn Mặc Tinh cho nam chính.',
          attributes: { type: 'AI Sinh Mệnh Tối Cao' },
          relationships: [
            { targetName: mainName, relation: 'Truyền nhân môn phái', type: 'ally' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_loc',
          name: 'Cơ Sở Giang Nam',
          aliases: ['Căn Cứ Thị Giang Nam'],
          category: 'location',
          role: 'Căn cứ thành thị',
          description: 'Pháo đài bảo vệ loài người kiên cố trước làn sóng quái thú thời đại Đại Niết Bàn.',
          attributes: { type: 'Căn cứ phòng ngự' },
          relationships: [
            { targetName: mainName, relation: 'Quê nhà bảo vệ', type: 'origin' }
          ]
        },
        {
          id: 'lore_' + Date.now() + '_fac',
          name: 'Cực Hạn Võ Quán',
          aliases: ['Võ Quán Đệ Nhất'],
          category: 'faction',
          role: 'Tổ chức võ giả số 1',
          description: 'Tổ chức võ giả mạnh nhất Trái Đất do Đệ Nhất Cường Giả Hồng sáng lập.',
          attributes: { scale: 'Toàn cầu' },
          relationships: [
            { targetName: mainName, relation: 'Thành viên tinh anh', type: 'ally' }
          ]
        }
      ]
    };

    let loreList = presets[genre] || presets.xianxia;

    // Nếu người dùng có nhập bối cảnh thế giới/ngoại cảnh riêng, bổ sung các thẻ Lorebook tương ứng
    if (worldContext && worldContext.trim()) {
      const trimmedContext = worldContext.trim();
      const customWorldEntry = {
        id: 'lore_' + Date.now() + '_world_ctx',
        name: 'Bối Cảnh Thế Giới',
        aliases: ['Thế giới quan', 'Thiết lập tác phẩm'],
        category: 'world',
        role: 'Bối cảnh thế giới',
        description: trimmedContext,
        attributes: { importance: 'Cốt lõi' },
        relationships: [
          { targetName: mainName, relation: 'Bối cảnh sinh tồn và phát triển của nhân vật chính', type: 'origin' }
        ]
      };

      const customLocationEntry = {
        id: 'lore_' + (Date.now() + 1) + '_custom_loc',
        name: 'Ngoại Cảnh Khởi Đầu',
        aliases: ['Địa bàn khởi đầu'],
        category: 'location',
        role: 'Ngoại cảnh chính',
        description: `Khu vực bối cảnh chính của tác phẩm: ${trimmedContext.slice(0, 200)}`,
        attributes: { type: 'Địa bàn xuất phát' },
        relationships: [
          { targetName: mainName, relation: 'Nơi bắt đầu cốt truyện', type: 'origin' }
        ]
      };

      loreList = [customWorldEntry, customLocationEntry, ...loreList];
    }

    return loreList;
  }

  createDefaultDemoProject() {
    return {
      id: 'proj_demo_xianxia',
      title: 'Đạo Quân Truyền Kỳ: Nghịch Thiên Cải Mệnh',
      genre: 'xianxia',
      authorName: 'Thiên Đạo Giả',
      premise: 'Một thiếu niên bình phàm sở hữu Cửu Chuyển Thần Ma Lệnh, từng bước từ phế vật quật khởi, đạp nát cửu thiên, chém rách thần đạo.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      worldSettings: {
        background: 'Cửu Châu Đại Lục, nơi người phàm và tiên nhân cách biệt như trời với đất.',
        powerSystem: 'Luyện Khí (1-9) -> Trúc Cơ (Sơ/Trung/Hậu/Viên Mãn) -> Kim Đan -> Nguyên Anh -> Hóa Thần',
        factions: ['Thanh Vân Tông (Bắc Châu)', 'Vạn Độc Môn (Nam Hoang)', 'Cửu U Ma Tông'],
        locations: ['Thanh Vân Phong', 'Hắc Lôi Nhai', 'Vạn Yêu Cổ Lâm']
      },
      lorebook: this.generateGenreStarterLore('xianxia', 'Diệp Trần'),
      rollingOutlines: [
        {
          arcId: 'arc_1',
          title: 'Quyển 1: Phong Khởi Thanh Vân (Chương 1 - 10)',
          summary: 'Hành trình phục thù và đột phá ngoạn mục tại Thanh Vân Tông.',
          chapters: [
            {
              chapterIndex: 1,
              title: 'Chương 1: Đan Điền Bị Phế, Thần Lệnh Thức Tỉnh',
              beats: 'Diệp Trần bị hãm hại tước đan điền -> Bị đày đến Hắc Lôi Nhai -> Kích hoạt Cửu Chuyển Thần Ma Lệnh.'
            }
          ]
        }
      ],
      chapters: [
        {
          id: 'chap_demo_1',
          chapterIndex: 1,
          title: 'Chương 1: Đan Điền Bị Phế, Thần Lệnh Thức Tỉnh',
          summary: 'Diệp Trần thức tỉnh Thần Ma Lệnh tại Hắc Lôi Nhai.',
          content: `Chương 1: Đan Điền Bị Phế, Thần Lệnh Thức Tỉnh\n\nTiếng sét xé toạc màn đêm Hắc Lôi Nhai.\n\nDiệp Trần nằm trên phiến đá lạnh lẽo, máu tươi từ khóe miệng không ngừng trào ra, nhuộm đỏ cả vạt áo rách nát. Đan điền của hắn – nơi tích tụ linh khí mười năm khổ tu – đã bị một chưởng tàn nhẫn của Mặc Vô Nhai đánh nát vụn.\n\n"Phế vật, ngươi nghĩ Liễu sư tỷ thật sự để mắt đến ngươi sao?" Tiếng cười khinh miệt của Mặc Vô Nhai dường như vẫn còn văng vẳng bên tai.\n\nNhưng ngay khi lôi đình thứ chín giáng xuống, khối hắc thiết lệnh bài cổ xưa đeo trước ngực Diệp Trần bỗng bộc phát huyết quang ngút trời. Một giọng nói viễn cổ trầm đục vang vọng thẳng vào linh hồn hắn:\n\n"Cửu Chuyển Thần Ma, nghịch thiên cải mệnh! Kẻ được chọn... ngươi có dám cùng Chư Thần tranh phong?"\n\nDiệp Trần cắn chặt răng đến bật máu, ánh mắt lóe lên ngọn lửa điên cuồng:\n\n"Có gì mà không dám!"`,
          wordCount: 172,
          updatedAt: new Date().toISOString()
        }
      ]
    };
  }

  addLorebookEntry(projectId, entry) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return null;

    if (!Array.isArray(proj.lorebook)) proj.lorebook = [];
    const newEntry = {
      id: entry.id || ('lore_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      name: entry.name || 'Nhân vật mới',
      aliases: Array.isArray(entry.aliases) ? entry.aliases : (entry.aliases ? entry.aliases.split(',').map(s => s.trim()) : []),
      category: entry.category || 'character',
      role: entry.role || 'Nhân vật phụ',
      description: entry.description || '',
      attributes: entry.attributes || {},
      relationships: entry.relationships || []
    };

    proj.lorebook.push(newEntry);
    this.saveProject(proj);
    return newEntry;
  }

  updateLorebookEntry(projectId, entryId, updatedData) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj || !Array.isArray(proj.lorebook)) return null;

    const idx = proj.lorebook.findIndex(l => l.id === entryId);
    if (idx === -1) return null;

    proj.lorebook[idx] = {
      ...proj.lorebook[idx],
      ...updatedData
    };

    this.saveProject(proj);
    return proj.lorebook[idx];
  }

  deleteLorebookEntry(projectId, entryId) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj || !Array.isArray(proj.lorebook)) return false;

    proj.lorebook = proj.lorebook.filter(l => l.id !== entryId);
    this.saveProject(proj);
    return true;
  }

  populateStarterLoreIfEmpty(projectId) {
    const projects = this.getProjects();
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return [];

    if (!Array.isArray(proj.lorebook) || proj.lorebook.length === 0) {
      proj.lorebook = this.generateGenreStarterLore(proj.genre || 'xianxia');
      this.saveProject(proj);
    }
    return proj.lorebook;
  }
}

export const storage = new StorageEngine();
