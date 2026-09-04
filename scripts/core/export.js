/**
 * AI Novel Studio - Export Engine
 * Exports stories to TXT, Markdown, HTML, and EPUB-ready structures
 */

export class ExportEngine {
  static exportToTxt(project) {
    if (!project) return;
    let content = `TÁC PHẨM: ${project.title || 'Tiểu Thuyết'}\n`;
    content += `TÁC GIẢ: ${project.authorName || 'Tác giả'}\n`;
    content += `THỂ LOẠI: ${project.genre || 'Tiên Hiệp'}\n`;
    content += `TIỀN ĐỀ: ${project.premise || ''}\n`;
    content += `===================================================\n\n`;

    const sortedChapters = (project.chapters || []).sort((a, b) => a.chapterIndex - b.chapterIndex);
    sortedChapters.forEach(chap => {
      content += `\n\n---------------------------------------------------\n`;
      content += `${chap.title || `Chương ${chap.chapterIndex}`}\n`;
      content += `---------------------------------------------------\n\n`;
      content += `${chap.content || ''}\n`;
    });

    this.downloadFile(`${this.sanitizeFilename(project.title)}.txt`, content, 'text/plain;charset=utf-8');
  }

  static exportToMarkdown(project) {
    if (!project) return;
    let md = `# ${project.title || 'Tiểu Thuyết'}\n\n`;
    md += `**Tác giả:** ${project.authorName || 'Tác giả'}  \n`;
    md += `**Thể loại:** ${project.genre || 'Tiên Hiệp'}  \n`;
    md += `**Tiền đề:** ${project.premise || ''}\n\n`;
    md += `---\n\n`;

    const sortedChapters = (project.chapters || []).sort((a, b) => a.chapterIndex - b.chapterIndex);
    sortedChapters.forEach(chap => {
      md += `## ${chap.title || `Chương ${chap.chapterIndex}`}\n\n`;
      md += `${chap.content || ''}\n\n`;
      md += `---\n\n`;
    });

    this.downloadFile(`${this.sanitizeFilename(project.title)}.md`, md, 'text/markdown;charset=utf-8');
  }

  static exportToHtml(project) {
    if (!project) return;
    const sortedChapters = (project.chapters || []).sort((a, b) => a.chapterIndex - b.chapterIndex);
    
    let chaptersHtml = '';
    sortedChapters.forEach(chap => {
      const paragraphs = (chap.content || '')
        .split('\n\n')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('\n');

      chaptersHtml += `
        <article class="chapter">
          <h2>${chap.title || `Chương ${chap.chapterIndex}`}</h2>
          <div class="chapter-content">
            ${paragraphs}
          </div>
        </article>
      `;
    });

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${project.title || 'Tiểu Thuyết'}</title>
  <style>
    body {
      font-family: 'Merriweather', Georgia, serif;
      line-height: 1.8;
      background: #0f172a;
      color: #e2e8f0;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    header { text-align: center; margin-bottom: 60px; border-bottom: 1px solid #334155; padding-bottom: 30px; }
    h1 { font-size: 2.4rem; color: #f8fafc; margin-bottom: 10px; }
    .meta { color: #94a3b8; font-size: 0.95rem; }
    .chapter { margin-bottom: 60px; }
    h2 { font-size: 1.6rem; color: #38bdf8; margin-bottom: 20px; border-left: 4px solid #38bdf8; padding-left: 12px; }
    p { margin-bottom: 1.2rem; text-indent: 1.5em; text-align: justify; }
  </style>
</head>
<body>
  <header>
    <h1>${project.title || 'Tiểu Thuyết'}</h1>
    <div class="meta">Tác giả: ${project.authorName || 'Tác giả'} | Thể loại: ${project.genre || 'Tiên Hiệp'}</div>
  </header>
  <main>
    ${chaptersHtml}
  </main>
</body>
</html>`;

    this.downloadFile(`${this.sanitizeFilename(project.title)}.html`, html, 'text/html;charset=utf-8');
  }

  static sanitizeFilename(name = 'novel') {
    return (name || 'novel').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 50);
  }

  static downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
