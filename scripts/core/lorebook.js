/**
 * AI Novel Studio - Lorebook Engine
 * Manages World Codex, Entities, Characters & Smart Keyword Triggers
 */

export class LorebookEngine {
  /**
   * Find matching lorebook entries based on text content
   * Keeps context slim and focused on relevant characters/locations
   */
  static extractRelevantLore(text = '', lorebook = [], maxEntries = 5) {
    if (!lorebook || lorebook.length === 0) return [];

    const lowerText = (text || '').toLowerCase();
    const scoredEntries = [];

    for (const item of lorebook) {
      let matchScore = 0;

      if (item.name && lowerText.includes(item.name.toLowerCase())) {
        matchScore += 10;
      }

      if (Array.isArray(item.aliases)) {
        for (const alias of item.aliases) {
          if (alias && lowerText.includes(alias.toLowerCase())) {
            matchScore += 8;
          }
        }
      }

      const roleLower = (item.role || '').toLowerCase();
      if (roleLower.includes('chính')) {
        matchScore += 3;
      }

      if (matchScore > 0) {
        scoredEntries.push({ item, score: matchScore });
      }
    }

    scoredEntries.sort((a, b) => b.score - a.score);

    // Nếu không khớp từ khóa nào, lấy 2 nhân vật đầu tiên (hoặc nhân vật chính) để luôn có ngữ cảnh
    if (scoredEntries.length === 0) {
      const fallback = lorebook.filter(l => l.category === 'character' || !l.category).slice(0, 2);
      return fallback.length > 0 ? fallback : lorebook.slice(0, 2);
    }

    return scoredEntries.slice(0, maxEntries).map(s => s.item);
  }

  /**
   * Formats relevant lorebook entries into a crisp, token-efficient prompt string
   */
  static formatLorePrompt(relevantEntries = []) {
    if (!relevantEntries || relevantEntries.length === 0) return '';

    let prompt = '### THIẾT LẬP NHÂN VẬT & THẾ GIỚI XUẤT HIỆN TRONG PHÂN CẢNH:\n';
    relevantEntries.forEach((entry, idx) => {
      prompt += `${idx + 1}. [${entry.category?.toUpperCase() || 'ENTITY'}] ${entry.name} (${entry.role || 'Nhân vật'}):\n`;
      if (entry.description) prompt += `   - Miêu tả: ${entry.description}\n`;
      if (entry.attributes && typeof entry.attributes === 'object') {
        const attrs = Object.entries(entry.attributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        if (attrs) prompt += `   - Đặc điểm: ${attrs}\n`;
      }
      if (Array.isArray(entry.relationships) && entry.relationships.length > 0) {
        const rels = entry.relationships
          .map(r => `${r.targetName} (${r.relation || 'Liên hệ'})`)
          .join(' | ');
        prompt += `   - Mối quan hệ: ${rels}\n`;
      }
    });

    return prompt + '\n';
  }
}
