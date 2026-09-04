/**
 * AI Novel Studio - Arbiter Agent
 * Makes the final decision: Accept, Patch, or Rewrite based on Editor 7D review
 */

import { AGENT_PROMPTS } from '../config.js';

export class ArbiterAgent {
  constructor(apiClient, model = 'glm-5.3-flash') {
    this.apiClient = apiClient;
    this.model = model;
  }

  setModel(model) {
    this.model = model;
  }

  async arbitrateAndPolish({ chapterTitle, draftText, evaluationText, onChunk = null }) {
    const prompt = `PHÁN QUYẾT & HOÀN THIỆN CHƯƠNG (${chapterTitle}):

BẢN THẢO HIỆN TẠI:
"""
${draftText}
"""

BẢN ĐÁNH GIÁ 7 CHIỀU CỦA EDITOR:
"""
${evaluationText}
"""

HÃY ĐÓNG VAI ARBITER AGENT:
1. Đưa ra phán quyết chính thức: [PHÊ DUYỆT HOÀN HẢO] hoặc [CHỈNH SỬA TỐI ƯU].
2. Tiến hành trau chuốt, tinh chỉnh trực tiếp các câu từ bị Editor chỉ ra lỗi sáo rỗng hoặc mạch ngắt quãng.
3. Xuất ra TOÀN VĂN BẢN THẢO ĐÃ ĐƯỢC CHUẨN HÓA HOÀN HẢO nhất để đưa vào sách.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.ARBITER },
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
}
