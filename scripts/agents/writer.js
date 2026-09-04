/**
 * AI Novel Studio - Writer Agent
 * Master novelist drafting engine adapted from ainovel-cli
 */

import { AGENT_PROMPTS, VOICE_RULES } from '../config.js';
import { MemoryEngine } from '../core/memory.js';

export class WriterAgent {
  constructor(apiClient, model = 'qwen3.8-flash') {
    this.apiClient = apiClient;
    this.model = model;
  }

  setModel(model) {
    this.model = model;
  }

  async writeScene({
    project,
    chapterIndex = 1,
    currentText = '',
    sceneBeats = '',
    instruction = 'Viết tiếp phân cảnh này',
    onChunk = null,
    onThinking = null,
    signal = null
  }) {
    const context = MemoryEngine.assembleWriterContext({
      project,
      currentChapterIndex: chapterIndex,
      currentText,
      sceneBeats,
      genre: project.genre || 'xianxia',
      instruction
    });

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages: context.messages,
      temperature: 0.85,
      maxTokens: 3500,
      stream: Boolean(onChunk),
      onChunk,
      onThinking,
      signal
    });
  }

  async autocompleteGhostText({ project, currentText = '', onChunk = null, signal = null }) {
    const messages = MemoryEngine.assembleAutocompleteContext({
      project,
      currentText,
      genre: project?.genre || 'xianxia'
    });

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.7,
      maxTokens: 150,
      stream: false,
      signal
    });
  }

  async expandScene({ text, genre = 'xianxia', onChunk = null }) {
    const genreConfig = VOICE_RULES.GENRE_PRESETS[genre] || VOICE_RULES.GENRE_PRESETS.xianxia;
    const prompt = `Đoạn văn gốc của tác giả:\n"${text}"\n\nYÊU CẦU BIÊN TẬP:\nHãy mở rộng đoạn văn trên thành một trường đoạn sinh động 150-250 từ. Áp dụng triệt để nguyên tắc Show, Don't Tell: miêu tả chi tiết ngũ quan, cử chỉ, biểu cảm, âm thanh và không khí xung quanh theo thể loại ${genreConfig.name}.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.WRITER },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.8,
      stream: Boolean(onChunk),
      onChunk
    });
  }

  async dialogizeScene({ text, onChunk = null }) {
    const prompt = `Đoạn văn tự sự gốc:\n"${text}"\n\nHãy chuyển đổi đoạn tự sự trên thành một màn đối thoại kịch tính giữa các nhân vật. Khắc họa rõ khẩu khí, ngữ điệu, xen kẽ động tác hình thể và nét mặt sắc nét.`;

    const messages = [
      { role: 'system', content: AGENT_PROMPTS.WRITER },
      { role: 'user', content: prompt }
    ];

    return await this.apiClient.chatCompletion({
      model: this.model,
      messages,
      temperature: 0.8,
      stream: Boolean(onChunk),
      onChunk
    });
  }
}
