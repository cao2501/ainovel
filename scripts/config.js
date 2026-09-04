/**
 * AI Novel Studio - Configuration & Knowledge Hub
 * Adapted from kentjuno/ainovel-cli & voocel/ainovel-cli for Vietnamese Novel SaaS
 */

export const KIRA_CONFIG = {
  DEFAULT_BASE_URL: 'https://kiraai.vn/api/v1/chat/completions',
  // API Key do chủ trang web cung cấp sẵn cho toàn bộ hệ thống (User chỉ cần dùng Xu)
  SYSTEM_API_KEY: 'kira_5ce16c4ec25b8613d9aedeb2eff2f578',
  MODELS: [
    {
      id: 'qwen3.8-flash',
      name: 'Qwen 3.8 Flash (Miễn Phí)',
      tag: 'Văn Học & Tiếng Việt Xuất Sắc',
      contextWindow: 131072,
      desc: 'Mô hình miễn phí chất lượng cao, tối ưu sâu cho văn hóa Á Đông, hành văn Tiên hiệp, Kiếm hiệp, Đô thị tiếng Việt tự nhiên và truyền cảm.',
      recommendedFor: ['writer', 'coordinator', 'autocomplete']
    },
    {
      id: 'glm-5.3-flash',
      name: 'GLM 5.3 Flash (Miễn Phí)',
      tag: 'Tư Duy Logic & Thẩm Định 7D',
      contextWindow: 131072,
      desc: 'Mô hình miễn phí với lý luận sắc bén, lập đại cương 3 hồi, phát hiện mâu thuẫn cốt truyện và thẩm định chất lượng 7 chiều.',
      recommendedFor: ['editor', 'arbiter', 'architect']
    },
    {
      id: 'minimax-m3-free',
      name: 'MiniMax M3 Free (Miễn Phí)',
      tag: 'Cảm Xúc & Đối Thoại Sâu Sắc',
      contextWindow: 65536,
      desc: 'Văn phong tiểu thuyết giàu xúc cảm, miêu tả tâm lý nhân vật tinh tế và tạo đối thoại chân thực.',
      recommendedFor: ['writer']
    },
    {
      id: 'kira-auto',
      name: 'Kira Auto (Miễn Phí)',
      tag: 'Điều Phối Tự Động & Siêu Tốc',
      contextWindow: 65536,
      desc: 'Hệ thống tự động lựa chọn đường truyền nhanh nhất để phản hồi gợi ý câu từ Ghost-text tức thì.',
      recommendedFor: ['coordinator', 'autocomplete', 'summarizer']
    },
    {
      id: 'kira-2.0',
      name: 'Kira Mini 2.0 (Miễn Phí)',
      tag: 'Phản Hồi Siêu Nhẹ',
      contextWindow: 32768,
      desc: 'Mô hình siêu nhẹ và phản hồi nhanh tức thì cho các tác vụ tóm tắt và gợi ý nhịp nhanh.',
      recommendedFor: ['autocomplete']
    }
  ],
  DEFAULT_ROLES: {
    coordinator: 'qwen3.8-flash',
    architect: 'glm-5.3-flash',
    writer: 'qwen3.8-flash',
    editor: 'glm-5.3-flash',
    arbiter: 'glm-5.3-flash',
    autocomplete: 'qwen3.8-flash'
  }
};

export const SUPABASE_CONFIG = {
  // Cấu hình kết nối Supabase Cloud do Quản trị viên (Chủ trang web) cung cấp sẵn
  URL: 'https://dvshqrgisreepbwrexdl.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2c2hxcmdpc3JlZXBid3JleGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MDAxMDMsImV4cCI6MjEwNDA3NjEwM30.I-SAjZtNrQJ0rSeMZnOsqBkZBFV9v3zvERZAZYHFML0',
  AUTO_SYNC: true
};

export const BILLING_CONFIG = {
  COIN_RATE_VND: 100, // 1 Xu = 100đ
  TOKENS_PER_COIN: 1000, // 1 Xu = 1000 tokens
  INITIAL_FREE_COINS: 50, // Tặng 50 Xu cho tài khoản mới
  DAILY_CHECKIN_COINS: 5,
  COSTS: {
    TAB_AUTOCOMPLETE: 0.5, // 0.5 Xu cho 1 lần nhận gợi ý
    EXPAND_SCENE: 1.0,     // 1 Xu cho mở rộng phân cảnh
    DRAFT_CHAPTER: 3.0,    // 3 Xu cho 1 chương tiêu chuẩn
    VIP_LONG_CHAPTER: 5.0, // 5 Xu cho chương dài
    EVALUATE_7D: 1.5,      // 1.5 Xu cho thẩm định chất lượng 7 chiều
    GENERATE_OUTLINE: 2.0, // 2 Xu cho tạo đại cương/dàn ý
    DIAGNOSTICS: 2.0       // 2 Xu cho chẩn đoán mâu thuẫn cốt truyện
  },
  PACKAGES: [
    {
      id: 'starter',
      name: 'Tập Sự',
      price: 20000,
      coins: 180,
      bonus: '0%',
      badge: 'Cơ Bản',
      desc: 'Phù hợp viết thử nghiệm ~ 60 chương truyện ngắn'
    },
    {
      id: 'author',
      name: 'Tác Giả',
      price: 50000,
      coins: 500,
      bonus: '+10%',
      badge: 'Phổ Biến Nhất',
      popular: true,
      desc: 'Dành cho tác giả sáng tác đều tay ~ 165 chương'
    },
    {
      id: 'master',
      name: 'Đại Thần',
      price: 100000,
      coins: 1150,
      bonus: '+15%',
      badge: 'Tiết Kiệm',
      desc: 'Mở khóa toàn bộ tính năng cao cấp ~ 380 chương'
    },
    {
      id: 'celestial',
      name: 'Thần Cấp VIP',
      price: 200000,
      coins: 2500,
      bonus: '+25%',
      badge: 'Đặc Quyền VIP',
      desc: 'Sáng tác không giới hạn, ưu tiên tốc độ AI tối đa'
    }
  ]
};

/**
 * Vietnamese Voice Rules & Anti-AI Cliché Guidelines (voice.md adapted from ainovel-cli)
 */
export const VOICE_RULES = {
  ANTI_CLICHE_RULES: [
    'TUYỆT ĐỐI KHÔNG dùng các cụm từ sáo rỗng dịch máy: "không khỏi", "dường như", "trong lòng dâng lên một cỗ", "ánh mắt lóe lên tia sáng", "hít vào một ngụm khí lạnh", "nói thì chậm mà xảy ra thì nhanh", "khóe miệng cong lên một nụ cười tà mị".',
    'TUYỆT ĐỐI KHÔNG giải thích tâm lý nhân vật một cách thô thiển theo kiểu "hắn cảm thấy vô cùng tức giận". Hãy áp dụng nguyên tắc Show, Don\'t Tell: miêu tả nắm đấm siết chặt kêu rắc rắc, gân xanh nổi cộm trên thái dương, hơi thở dồn dập.',
    'Đối thoại phải mang khẩu khí tự nhiên, giàu cá tính, phù hợp thân phận (kẻ kiêu ngạo dùng ngữ điệu châm biếm, kẻ thâm sâu nói ít hiểu nhiều, tiểu thư khuê các nhỏ nhẹ nhưng sắc sảo).',
    'Tránh câu văn quá dài lê thê chứa 4-5 mệnh đề phụ. Ngắt nhịp linh hoạt giữa câu ngắn dồn dập khi giao chiến và câu dài giàu hình tượng khi miêu tả cảnh quan/nội tâm.',
    'Sử dụng vốn từ Hán-Việt chuẩn xác, thanh thoát cho thể loại Tiên Hiệp/Kiếm Hiệp/Huyền Huyễn; dùng ngôn từ hiện đại, sắc sảo cho Đô Thị/Trinh Thám.'
  ],
  GENRE_PRESETS: {
    xianxia: {
      name: 'Tiên Hiệp / Tu Chân',
      icon: 'sparkles',
      tone: 'Hùng tráng, phiêu dật, cổ phong kỳ ảo, đề cao đại đạo và ý chí nghịch thiên.',
      keywords: ['đan điền', 'ngự kiếm', 'linh khí', 'độ kiếp', 'pháp bảo', 'tông môn', 'chân nguyên'],
      pov: 'Ngôi thứ ba giới hạn (Hắn / Nàng / Y / Lão giả)'
    },
    wuxia: {
      name: 'Kiếm Hiệp / Võ Hiệp',
      icon: 'swords',
      tone: 'Đậm chất giang hồ, trọng ân oán tình thù, hiệp nghĩa, đao quang kiếm ảnh.',
      keywords: ['giang hồ', 'chưởng môn', 'nội lực', 'chiêu thức', 'tửu quán', 'tuyệt học', 'yên hà'],
      pov: 'Ngôi thứ ba'
    },
    urban: {
      name: 'Đô Thị / Dị Năng',
      icon: 'building',
      tone: 'Hiện đại, nhịp điệu dồn dập, hài hước châm biếm đan xen tranh đấu thương trường và năng lực ngầm.',
      keywords: ['tổng tài', 'thế gia', 'dị năng', 'hệ thống', 'bóng tối', 'ngầm', 'siêu xe'],
      pov: 'Ngôi thứ nhất hoặc ngôi thứ ba'
    },
    romance: {
      name: 'Ngôn Tình / Trọng Sinh',
      icon: 'heart',
      tone: 'Sâu lắng, ngọt ngào, giằng xé cảm xúc, chi tiết nội tâm tỉ mỉ, đối thoại tinh tế.',
      keywords: ['ánh mắt', 'ấm áp', 'day dứt', 'nhịp tim', 'lời thì thầm', 'duyên phận', 'cố chấp'],
      pov: 'Ngôi thứ ba hoặc ngôi thứ nhất'
    },
    mystery: {
      name: 'Linh Dị / Trinh Thám',
      icon: 'ghost',
      tone: 'U ám, nghẹt thở, hồi hộp, cài cắm manh mối logic, không khí rùng rợn sắc lạnh.',
      keywords: ['manh mối', 'bóng tối', 'hơi thở lạnh', 'sát nhân', 'dấu vết', 'tiếng bước chân'],
      pov: 'Ngôi thứ nhất hoặc ngôi thứ ba giới hạn'
    },
    scifi: {
      name: 'Khoa Huyễn / Mạt Thế',
      icon: 'rocket',
      tone: 'Căng thẳng sinh tồn, công nghệ tương lai, máy móc lạnh lùng, khám phá vũ trụ.',
      keywords: ['chiến hạm', 'gen đột biến', 'AI', 'tinh cầu', 'năng lượng hạt nhân', 'máy móc'],
      pov: 'Ngôi thứ ba'
    }
  }
};

/**
 * Multi-Agent System Prompts (Adapted from ainovel-cli)
 */
export const AGENT_PROMPTS = {
  COORDINATOR: `Bạn là Coordinator Agent - Tổng chỉ huy hệ thống sáng tác tiểu thuyết AI đa Agent (dựa trên kiến trúc ainovel-cli).
Nhiệm vụ của bạn là:
1. Quản lý toàn bộ vòng đời sáng tác: Thiết lập đề cương -> Dựng thế giới & Nhân vật -> Lập dàn ý phân cảnh -> Điều phối Writer viết -> Kích hoạt Editor thẩm định 7D -> Trình Arbiter duyệt.
2. Kiểm soát ngân sách ngữ cảnh (Context Budget), đảm bảo chỉ đưa các thông tin cốt lõi (Lorebook, tóm tắt chương trước) vào ngữ cảnh để tránh tràn token và chống mâu thuẫn câu chuyện.
3. Xuất kết quả rõ ràng, chuyên nghiệp, phản hồi theo định dạng JSON có cấu trúc khi được yêu cầu.`,

  ARCHITECT: `Bạn là Architect Agent - Kiến trúc sư cốt truyện của hệ thống sáng tác tiểu thuyết AI.
Nhiệm vụ của bạn là:
1. Xây dựng tiền đề truyện (Premise), mục tiêu nhân vật chính, xung đột cốt lõi và cao trào lớn.
2. Thiết lập Lorebook thế giới: Địa danh, hệ thống sức mạnh/cảnh giới, môn phái, bảo vật.
3. Xây dựng hồ sơ nhân vật (Character Cards): Tên, danh xưng, ngoại hình, tính cách, động cơ thầm kín, bí mật, năng lực, mối quan hệ.
4. Lập dàn ý cuộn (Rolling Outlines) theo từng block 5-10 chương với đầy đủ các nhịp (Scene Beats): Khởi đầu, phát triển mâu thuẫn, bước ngoặt (Twist), và móc câu kết chương (Hook).`,

  WRITER: `Bạn là Writer Agent - Ngòi bút sáng tác tiểu thuyết chuyên nghiệp hàng đầu, am hiểu sâu sắc văn học mạng Tiếng Việt và các nguyên lý nghệ thuật viết từ ainovel-cli.
QUY TẮC BẮT BUỘC:
1. Áp dụng triệt để nguyên tắc SHOW, DON'T TELL và bộ quy chuẩn chống AI sáo rỗng (VOICE_RULES).
2. Viết câu từ tự nhiên, mạch lạc, đậm chất văn học, không dùng lối hành văn dịch máy khô cứng.
3. Miêu tả sống động cảm giác ngũ quan (âm thanh, ánh sáng, nhiệt độ, mùi vị, cử chỉ hình thể).
4. Khắc họa đối thoại sắc sảo, đúng tính cách và địa vị của từng nhân vật trong Lorebook.
5. Tuân thủ tuyệt đối dàn ý phân cảnh được giao và giữ vững mạch logic từ các chương trước.`,

  EDITOR_7D: `Bạn là Editor Agent - Chuyên gia biên tập và thẩm định chất lượng tiểu thuyết 7 chiều (7-Dimension Quality Evaluator từ ainovel-cli).
Bạn sẽ đánh giá văn bản chương truyện theo 7 tiêu chuẩn khắt khe sau (thang điểm 1 - 10):
1. Tính nhất quán (Consistency): Không mâu thuẫn sự kiện, địa danh, thời gian, cảnh giới.
2. Khẩu khí & Tính cách nhân vật (Character Voice Fidelity): Lời thoại và hành vi đúng với hồ sơ nhân vật.
3. Tiết tấu & Nhịp độ (Pacing): Nhịp độ hợp lý, không dông dài cũng không vội vã.
4. Mạch truyện & Logic (Narrative Coherence): Chuyển cảnh mượt mà, nhân quả chặt chẽ.
5. Cài cắm phục bút (Foreshadowing): Có chi tiết gợi mở thông minh cho tương lai.
6. Móc câu kết chương (Hooks & Climax): Đoạn kết lôi cuốn, kích thích người đọc xem tiếp chương sau.
7. Văn phong & Chống sáo rỗng (Aesthetic Quality & Anti-AI Cliché): Văn phong giàu chất văn học, không có câu từ dịch máy hay sáo ngữ AI.

Đầu ra của bạn phải cung cấp:
- Điểm số chi tiết cho từng chiều (1-10)
- Điểm trung bình tổng quan
- Danh sách các vấn đề phát hiện (kèm trích dẫn câu cụ thể)
- Gợi ý chỉnh sửa cụ thể từng phân đoạn.`,

  ARBITER: `Bạn là Arbiter Agent - Trọng tài thẩm định tối cao của hệ thống ainovel-cli.
Nhiệm vụ:
1. Đối chiếu bản thảo của Writer và bản thẩm định 7 chiều của Editor.
2. Đưa ra phán quyết:
   - PHÊ DUYỆT (ACCEPT): Chất lượng đạt chuẩn (Điểm >= 8.0/10), đưa vào bản thảo chính thức.
   - SỬA ĐỔI CỤC BỘ (PATCH): Chỉ ra chính xác 1-2 đoạn cần Writer trau chuốt lại.
   - VIẾT LẠI (REWRITE): Khi có mâu thuẫn cốt truyện nghiêm trọng hoặc OOC nặng.`
};
