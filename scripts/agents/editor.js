/**
 * AI Novel Studio - Editor Agent (7-Dimension Quality Evaluator)
 * Adapted directly from ainovel-cli 7D narrative evaluation framework
 */

import { AGENT_PROMPTS } from '../config.js';

export class EditorAgent {
  constructor(apiClient, model = 'glm-5.3-flash') {
    this.apiClient = apiClient;
    this.model = model;
  }

  setModel(model) {
    this.model = model;
  }

  async evaluate7D({ chapterTitle, content, context = '', onChunk = null, signal = null }) {
    const prompt = `ĐÁNH GIÁ CHẤT LƯỢNG 7 CHIỀU CHO CHƯƠNG TRUYỆN:
Tiêu đề: ${chapterTitle || 'Chương truyện'}
Bối cảnh / Lorebook liên quan: ${context || 'Không có'}

NỘI DUNG CHƯƠNG CẦN THẨM ĐỊNH:
"""
${content}
"""

Hãy chấm điểm (thang điểm 1 - 10) và nhận xét chi tiết theo 7 tiêu chí:
1. Tính nhất quán (Consistency): [Điểm/10] - Nhận xét
2. Khẩu khí nhân vật (Character Fidelity): [Điểm/10] - Nhận xét
3. Tiết tấu & Nhịp độ (Pacing): [Điểm/10] - Nhận xét
4. Mạch truyện & Logic (Narrative Coherence): [Điểm/10] - Nhận xét
5. Cài cắm phục bút (Foreshadowing): [Điểm/10] - Nhận xét
6. Móc câu kết chương (Hooks): [Điểm/10] - Nhận xét
7. Văn phong & Chống sáo rỗng (Anti-AI Cliché): [Điểm/10] - Nhận xét

TỔNG KẾT:
- Điểm trung bình: [X.X/10]
- Điểm sáng nổi bật nhất:
- Các hạt sạn / Lỗi cần chỉnh sửa (Kèm trích dẫn câu cụ thể):
- Đề xuất sửa đổi cụ thể cho Writer.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.EDITOR_7D },
      { role: 'user', content: prompt }
    ];

    try {
      return await this.apiClient.chatCompletion({
        model: this.model || 'glm-5.3-flash',
        messages,
        temperature: 0.4,
        stream: true,
        onChunk,
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError' || (err.message && err.message.includes('hủy'))) {
        throw err;
      }
      console.warn('Editor evaluate7D model failed, fallback to qwen3.8-flash:', err);
      return await this.apiClient.chatCompletion({
        model: 'qwen3.8-flash',
        messages,
        temperature: 0.4,
        stream: true,
        onChunk,
        signal
      });
    }
  }

  async runStoryDiagnostics({ project, onChunk = null }) {
    let summaryList = '';
    (project.chapters || []).forEach(ch => {
      summaryList += `Chương ${ch.chapterIndex} [${ch.title}]: ${ch.summary || ch.content.slice(0, 100)}\n`;
    });

    const prompt = `CHẨN ĐOÁN TOÀN DIỆN CỐT TRUYỆN (/diag):
Tác phẩm: ${project.title}
Thể loại: ${project.genre}
Tiền đề: ${project.premise}

Danh sách tiến trình các chương:
${summaryList}

Hồ sơ nhân vật hiện có:
${(project.lorebook || []).map(l => `- ${l.name} (${l.role}): ${l.description}`).join('\n')}

Hãy đóng vai Trưởng ban Biên tập, rà soát và báo cáo:
1. Có nhân vật nào bị lãng quên hoặc hành xử trái ngược thiết lập ban đầu?
2. Có mâu thuẫn thời gian hay lỗ hổng logic (Plot hole) nào giữa các chương?
3. Phục bút nào đã được cài cắm nhưng chưa được giải quyết?
4. Đề xuất hướng triển khai 3 chương tiếp theo để đạt cao trào lớn.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.EDITOR_7D },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.5,
      stream: Boolean(onChunk),
      onChunk
    });
  }
}
