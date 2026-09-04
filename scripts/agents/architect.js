/**
 * AI Novel Studio - Architect Agent
 * Generates Premise, World Building, Lorebook Characters, and Rolling Chapter Outlines
 */

import { AGENT_PROMPTS, VOICE_RULES } from '../config.js';

export class ArchitectAgent {
  constructor(apiClient, model = 'glm-5.3-flash') {
    this.apiClient = apiClient;
    this.model = model;
  }

  setModel(model) {
    this.model = model;
  }

  async generateWorldBible({ idea, genre = 'xianxia', onChunk = null, signal = null }) {
    const genreConfig = VOICE_RULES.GENRE_PRESETS[genre] || VOICE_RULES.GENRE_PRESETS.xianxia;
    
    const prompt = `Ý tưởng ban đầu của tác giả: "${idea}"
Thể loại: ${genreConfig.name} (${genreConfig.tone})

Hãy đóng vai Architect Agent và thiết kế bản WORLD BIBLE chi tiết gồm:
1. TIÊU ĐỀ TRUYỆN GỢI Ý (3 lựa chọn ấn tượng).
2. TIỀN ĐỀ CỐT TRUYỆN (Premise 150-200 từ: Nhân vật chính là ai, mục tiêu tối thượng, xung đột cốt lõi).
3. HỆ THỐNG SỨC MẠNH / CẢNH GIỚI (Phân cấp rõ ràng từng bậc).
4. BỐI CẢNH THẾ GIỚI & MÔN PHÁI (3-4 thế lực lớn đối đầu).
5. 3 NHÂN VẬT CỐT LÕI (Nhân vật chính, Đối thủ/Kẻ thù, Đồng minh/Nữ chính).
6. DÀN Ý 5 CHƯƠNG ĐẦU TIÊN (Mỗi chương ghi rõ: Tiêu đề + 3 nhịp cảnh Scene Beats).

Hãy trình bày với phong cách văn chương gãy gọn, chuyên nghiệp, truyền cảm hứng.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.ARCHITECT },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.8,
      stream: Boolean(onChunk),
      onChunk,
      signal
    });
  }

  async generateCharacterCard({ name, role, context, onChunk = null }) {
    const prompt = `Hãy tạo hồ sơ nhân vật chi tiết (Character Card) cho:
- Tên: ${name}
- Vai trò: ${role}
- Bối cảnh liên quan: ${context || 'Tiểu thuyết tu chân huyền ảo'}

Yêu cầu xuất ra:
1. Danh xưng / Biệt hiệu
2. Ngoại hình & Khí chất
3. Tính cách & Điểm yếu tâm lý
4. Năng lực / Cảnh giới / Vũ khí
5. Động cơ bí mật & Quan hệ với các nhân vật khác`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.ARCHITECT },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.7,
      stream: Boolean(onChunk),
      onChunk
    });
  }

  /**
   * Phân tích nhịp cảnh tiếp theo (Scene Beats) dựa trên diễn biến hiện tại
   */
  async planNextSceneBeats({ project, chapterTitle = '', currentText = '', onChunk = null, signal = null }) {
    const genreConfig = VOICE_RULES.GENRE_PRESETS[project?.genre] || VOICE_RULES.GENRE_PRESETS.xianxia;
    const recent = (currentText || '').slice(-1200);

    const prompt = `Bạn là Architect Agent (Kiến Trúc Sư Cốt Truyện) cho tác phẩm [${project?.title || 'Tiểu thuyết'}].
Thể loại: ${genreConfig.name}
Tiền đề: ${project?.premise || 'Hành trình vượt khó vươn lên.'}
Chương hiện tại: ${chapterTitle || 'Chương truyện'}

NỘI DUNG VĂN BẢN VỪA VIẾT:
"""
${recent || 'Bắt đầu chương mới...'}
"""

YÊU CẦU:
Hãy phân tích logic mạch truyện và vạch ra 3 NHỊP CẢNH (SCENE BEATS) tiếp theo để Writer Agent viết tiếp:
1. Nhịp 1 (Mồi lửa / Biến cố tức thời)
2. Nhịp 2 (Xung đột dâng cao / Hành động kịch tính)
3. Nhịp 3 (Bẻ ngoặt hoặc Móc câu kết mở)

Trình bày ngắn gọn, gãy gọn, mỗi nhịp từ 1-2 câu.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.ARCHITECT },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.75,
      stream: Boolean(onChunk),
      onChunk,
      signal
    });
  }

  /**
   * Tự động quét tiền đề & nội dung chương để trích xuất hoặc đề xuất nhân vật mới
   */
  async extractCharactersFromNovel({ project, currentText = '', onChunk = null, signal = null }) {
    const existingLoreNames = (project?.lorebook || []).map(l => l.name).join(', ');

    const prompt = `Bạn là Architect Agent. Hãy quét tiền đề cốt truyện và đoạn văn dưới đây để tìm ra hoặc đề xuất 2-3 nhân vật quan trọng chưa có trong danh sách.
Tác phẩm: ${project?.title} (${project?.genre})
Tiền đề: ${project?.premise}
Nhân vật đã có: ${existingLoreNames || 'Chưa có'}

Nội dung trích đoạn:
"""
${(currentText || '').slice(0, 2000)}
"""

Hãy xuất ra định dạng JSON chuẩn (trong khối \`\`\`json ... \`\`\`):
[
  {
    "name": "Tên nhân vật",
    "aliases": ["Biệt hiệu 1", "Biệt hiệu 2"],
    "category": "character",
    "role": "Nhân vật chính / Nữ chính / Phản diện / Sư phụ / Đồng minh",
    "description": "Mô tả ngắn gọn 1-2 câu về ngoại hình và tính cách",
    "attributes": { "realm": "Cảnh giới hoặc vũ khí" },
    "relationships": [
      { "targetName": "Tên nhân vật khác", "relation": "Quan hệ cụ thể", "type": "ally / enemy / romance / master" }
    ]
  }
]`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.ARCHITECT },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.6,
      stream: Boolean(onChunk),
      onChunk,
      signal
    });
  }
}
