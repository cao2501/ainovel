/**
 * AI Novel Studio - 3-Layer Narrative Memory Engine
 * Combines Lorebook Codex + Rolling Chapter Summaries + Active Working Context
 */

import { LorebookEngine } from './lorebook.js';
import { VOICE_RULES } from '../config.js';

export class MemoryEngine {
  /**
   * Assembles full contextual prompt for Writer Agent
   */
  static assembleWriterContext({
    project,
    currentChapterIndex,
    currentText = '',
    sceneBeats = '',
    genre = 'xianxia',
    instruction = 'Viết tiếp diễn biến phân cảnh'
  }) {
    if (!project) throw new Error('Không tìm thấy dự án truyện!');

    // 1. Layer 1: Lorebook (Scanned from current text + beats + premise)
    const combinedScanText = `${sceneBeats} ${currentText.slice(-1500)}`;
    const matchedLore = LorebookEngine.extractRelevantLore(combinedScanText, project.lorebook || [], 4);
    const lorePrompt = LorebookEngine.formatLorePrompt(matchedLore);

    // 2. Layer 2: Rolling Summaries of previous chapters
    let rollingSummariesPrompt = '';
    const allChapters = project.chapters || [];
    const prevChapters = allChapters
      .filter(c => c.chapterIndex < currentChapterIndex)
      .sort((a, b) => a.chapterIndex - b.chapterIndex);

    if (prevChapters.length > 0) {
      rollingSummariesPrompt = '### TÓM TẮT DIỄN BIẾN CÁC CHƯƠNG TRƯỚC (TIẾN TRÌNH TRUYỆN):\n';
      const recentPrev = prevChapters.slice(-5);
      recentPrev.forEach(ch => {
        const summary = ch.summary || (ch.content ? ch.content.slice(0, 150) + '...' : 'Không có tóm tắt.');
        rollingSummariesPrompt += `- Chương ${ch.chapterIndex} [${ch.title}]: ${summary}\n`;
      });
      rollingSummariesPrompt += '\n';
    }

    // 3. Layer 3: Active Working Canvas
    const recentWords = currentText.split(/\s+/).slice(-800).join(' ');

    // 4. Genre & Anti-Cliche Rules
    const genreConfig = VOICE_RULES.GENRE_PRESETS[genre] || VOICE_RULES.GENRE_PRESETS.xianxia;
    const antiClicheRules = VOICE_RULES.ANTI_CLICHE_RULES.slice(0, 4).map((r, i) => `${i + 1}. ${r}`).join('\n');

    const systemPrompt = `Bạn là Ngòi Bút Sáng Tác Tiểu Thuyết Hàng Đầu (Writer Agent) theo chuẩn mực ainovel-cli.
Thể loại: ${genreConfig.name}
Văn phong chủ đạo: ${genreConfig.tone}
Góc nhìn (POV): ${genreConfig.pov}

QUY TẮC VĂN PHONG BẮT BUỘC:
${antiClicheRules}

${lorePrompt}${rollingSummariesPrompt}${project.worldSettings?.background ? `### BỐI CẢNH TÁC PHẨM & THẾ GIỚI:\n${project.worldSettings.background}\n\n` : ''}### TIỀN ĐỀ TRUYỆN:
${project.premise || 'Một câu chuyện hấp dẫn về hành trình của nhân vật chính.'}

### DÀN Ý PHÂN CẢNH HIỆN TẠI (SCENE BEATS):
${sceneBeats || 'Phát triển tiếp mạch diễn biến cao trào, duy trì nhịp độ lôi cuốn.'}`;

    const userPrompt = `ĐOẠN VĂN GẦN NHẤT TRONG CHƯƠNG:\n"${recentWords || 'Bắt đầu chương mới...'}"\n\nYÊU CẦU CỦA TÁC GIẢ:\n${instruction}\n\nHãy viết tiếp phần tiếp theo một cách sống động, gãy gọn, giàu hình ảnh và giữ đúng phong thái nhân vật:`;

    return {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      matchedLore,
      systemPromptLength: systemPrompt.length
    };
  }

  /**
   * Assembles context for Ghost-Text Autocomplete
   */
  static assembleAutocompleteContext({ project, currentText = '', genre = 'xianxia' }) {
    const recentWords = currentText.split(/\s+/).slice(-300).join(' ');
    const genreConfig = VOICE_RULES.GENRE_PRESETS[genre] || VOICE_RULES.GENRE_PRESETS.xianxia;

    const systemPrompt = `Bạn là trợ lý AI Inline Autocomplete cho tiểu thuyết ${genreConfig.name}.
Nhiệm vụ: Dựa vào đoạn văn bản gần nhất của tác giả, hãy viết tiếp 1 đến 3 câu văn liền mạch tiếp theo (khoảng 30-70 từ).
Quy tắc:
- Không viết mở đầu chào hỏi, không lặp lại câu văn cũ.
- Áp dụng văn phong ${genreConfig.name}, tự nhiên, không sáo rỗng.
- Trả về DUY NHẤT đoạn văn bản viết tiếp.`;

    const userPrompt = `Đoạn văn đang viết dở:\n"${recentWords}"\n\nViết tiếp 1-2 câu ngay tại vị trí này:`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }
}
