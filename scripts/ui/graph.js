/**
 * AI Novel Studio - Character Relationship Graph Visualizer 2.0
 * Interactive SVG-based network graph for novel characters, factions, and relationships
 */

import { storage } from '../core/storage.js';

export class RelationshipGraph {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.selectedNodeId = null;
    this.activeProject = null;
  }

  render(project) {
    if (!this.container) return;
    this.activeProject = project;
    this.container.innerHTML = '';

    const lorebook = project?.lorebook || [];
    const characters = lorebook.filter(l => l.category === 'character' || !l.category);

    // 1. Trạng thái chưa có nhân vật
    if (characters.length === 0) {
      this.container.innerHTML = `
        <div style="padding: 28px 16px; text-align: center; color: var(--text-dim);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🕸️</div>
          <p style="font-size: 0.88rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Chưa có nhân vật nào trong bộ truyện</p>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 14px;">Tạo nhân vật để AI tự động vẽ sơ đồ quan hệ và giữ vững mạch truyện.</p>
          <div style="display: flex; flex-direction: column; gap: 8px; max-width: 220px; margin: 0 auto;">
            <button class="btn btn-sm btn-primary" id="btnGraphGenerateStarter" style="width: 100%;">
              ✨ Tạo Nhân Vật Mẫu (${(project?.genre || 'Tiên Hiệp').toUpperCase()})
            </button>
            <button class="btn btn-sm btn-outline" id="btnGraphAddChar" style="width: 100%;">
              + Thêm Nhân Vật Mới
            </button>
          </div>
        </div>
      `;

      document.getElementById('btnGraphGenerateStarter')?.addEventListener('click', () => {
        storage.populateStarterLoreIfEmpty(project.id);
        const updated = storage.getActiveProject();
        window.StudioApp?.studio?.loadActiveProject();
        this.render(updated);
        window.StudioApp?.showToast('Đã khởi tạo bộ nhân vật mẫu thành công!', 'success');
      });

      document.getElementById('btnGraphAddChar')?.addEventListener('click', () => {
        window.StudioApp?.openLorebookModal();
      });
      return;
    }

    // 2. Tính toán layout tọa độ
    const width = 320;
    const height = 280;
    const centerX = width / 2;
    const centerY = height / 2 - 10;
    const radius = Math.min(width, height) * 0.36;

    // Tìm nhân vật chính
    const mainChar = characters.find(c => (c.role || '').toLowerCase().includes('chính')) || characters[0];

    // Tạo danh sách nodes
    const nodes = characters.map((char, i) => {
      const isMain = char.id === mainChar.id;
      let x, y;

      if (characters.length === 1) {
        x = centerX;
        y = centerY;
      } else if (isMain) {
        // Đặt nhân vật chính ở tâm hoặc trên đỉnh
        x = centerX;
        y = centerY;
      } else {
        // Các nhân vật phụ xếp vòng tròn xung quanh
        const others = characters.filter(c => c.id !== mainChar.id);
        const otherIdx = others.findIndex(c => c.id === char.id);
        const angle = (otherIdx / others.length) * 2 * Math.PI - Math.PI / 2;
        x = centerX + radius * Math.cos(angle);
        y = centerY + radius * Math.sin(angle);
      }

      return {
        ...char,
        x,
        y,
        isMain
      };
    });

    // 3. Xây dựng danh sách liên kết (Edges / Relationships)
    const links = [];
    const charMap = new Map(nodes.map(n => [n.name.toLowerCase().trim(), n]));
    const idMap = new Map(nodes.map(n => [n.id, n]));

    nodes.forEach(sourceNode => {
      if (Array.isArray(sourceNode.relationships) && sourceNode.relationships.length > 0) {
        sourceNode.relationships.forEach(rel => {
          const targetNode = charMap.get((rel.targetName || '').toLowerCase().trim());
          if (targetNode && targetNode.id !== sourceNode.id) {
            // Tránh vẽ trùng 2 chiều
            const exists = links.some(l => 
              (l.source.id === sourceNode.id && l.target.id === targetNode.id) ||
              (l.source.id === targetNode.id && l.target.id === sourceNode.id)
            );
            if (!exists) {
              links.push({
                source: sourceNode,
                target: targetNode,
                relation: rel.relation || 'Liên hệ',
                type: rel.type || 'ally'
              });
            }
          }
        });
      }
    });

    // Nếu chưa có quan hệ tường minh, nối các nhân vật phụ với nhân vật chính
    if (links.length === 0 && characters.length > 1) {
      nodes.forEach(node => {
        if (!node.isMain) {
          const roleLower = (node.role || '').toLowerCase();
          let type = 'ally';
          if (roleLower.includes('phản') || roleLower.includes('địch') || roleLower.includes('thù')) type = 'enemy';
          else if (roleLower.includes('nữ') || roleLower.includes('tình')) type = 'romance';
          else if (roleLower.includes('sư') || roleLower.includes('tiền')) type = 'master';

          links.push({
            source: mainChar,
            target: node,
            relation: node.role || 'Đồng hành',
            type
          });
        }
      });
    }

    // 4. Render SVG Links
    let linksSvg = '';
    links.forEach((link, idx) => {
      const isSelected = this.selectedNodeId && (link.source.id === this.selectedNodeId || link.target.id === this.selectedNodeId);
      let strokeColor = '#475569';
      let strokeDash = 'none';

      if (link.type === 'enemy') {
        strokeColor = '#f43f5e';
        strokeDash = '4,3';
      } else if (link.type === 'romance') {
        strokeColor = '#f472b6';
      } else if (link.type === 'master') {
        strokeColor = '#eab308';
        strokeDash = '6,2';
      } else {
        strokeColor = '#38bdf8';
      }

      if (isSelected) {
        strokeColor = '#fbbf24';
      }

      const midX = (link.source.x + link.target.x) / 2;
      const midY = (link.source.y + link.target.y) / 2;

      linksSvg += `
        <g class="graph-link" data-link-idx="${idx}">
          <line x1="${link.source.x}" y1="${link.source.y}" x2="${link.target.x}" y2="${link.target.y}" 
                stroke="${strokeColor}" stroke-width="${isSelected ? 2.5 : 1.5}" stroke-dasharray="${strokeDash}" opacity="${isSelected ? 1 : 0.75}" />
          <rect x="${midX - 32}" y="${midY - 8}" width="64" height="14" rx="4" fill="#0f172a" fill-opacity="0.85" />
          <text x="${midX}" y="${midY + 2}" fill="${isSelected ? '#fbbf24' : '#cbd5e1'}" font-size="8" text-anchor="middle" font-weight="500">
            ${link.relation.slice(0, 14)}
          </text>
        </g>
      `;
    });

    // 5. Render SVG Nodes
    let nodesSvg = '';
    nodes.forEach(node => {
      const isSelected = this.selectedNodeId === node.id;
      const roleLower = (node.role || '').toLowerCase();
      let nodeColor = '#38bdf8';
      let icon = '👤';

      if (node.isMain) {
        nodeColor = '#eab308';
        icon = '👑';
      } else if (roleLower.includes('phản') || roleLower.includes('địch') || roleLower.includes('thù')) {
        nodeColor = '#f43f5e';
        icon = '⚔️';
      } else if (roleLower.includes('nữ') || roleLower.includes('tình')) {
        nodeColor = '#f472b6';
        icon = '🌸';
      } else if (roleLower.includes('sư') || roleLower.includes('tiền')) {
        nodeColor = '#f59e0b';
        icon = '📜';
      }

      const r = node.isMain ? 20 : 16;

      nodesSvg += `
        <g class="graph-node ${isSelected ? 'active-node' : ''}" data-id="${node.id}" style="cursor: pointer;">
          <circle cx="${node.x}" cy="${node.y}" r="${r + 4}" fill="${nodeColor}" fill-opacity="${isSelected ? 0.35 : 0.1}" />
          <circle cx="${node.x}" cy="${node.y}" r="${r}" fill="#1e293b" stroke="${nodeColor}" stroke-width="${isSelected ? 3 : 2}" />
          <text x="${node.x}" y="${node.y + 4}" font-size="${node.isMain ? 12 : 10}" text-anchor="middle">
            ${icon}
          </text>
          <rect x="${node.x - 38}" y="${node.y + r + 4}" width="76" height="14" rx="3" fill="#090d16" fill-opacity="0.9" />
          <text x="${node.x}" y="${node.y + r + 14}" fill="${node.isMain ? '#fef08a' : '#f8fafc'}" font-size="9" font-weight="600" text-anchor="middle">
            ${node.name.length > 9 ? node.name.slice(0, 8) + '…' : node.name}
          </text>
        </g>
      `;
    });

    // 6. Ghép toàn bộ SVG
    const svgHtml = `
      <div style="position: relative; width: 100%;">
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="display: block; border-radius: var(--radius-md);">
          <defs>
            <radialGradient id="graphBgGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#090d16" stop-opacity="0.95"/>
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#graphBgGrad)" />
          ${linksSvg}
          ${nodesSvg}
        </svg>

        <!-- Thanh công cụ nhỏ phía trên sơ đồ -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(15,23,42,0.6); border-top: 1px solid var(--border-subtle); border-radius: 0 0 var(--radius-md) var(--radius-md);">
          <span style="font-size: 0.72rem; color: var(--text-dim);">💡 Bấm vào nhân vật để xem chi tiết</span>
          <button class="btn btn-sm btn-outline" id="btnGraphQuickAdd" style="padding: 2px 6px; font-size: 0.72rem;">+ Thêm</button>
        </div>

        <!-- Khung chi tiết nhân vật khi được chọn -->
        <div id="graphDossierContainer" style="margin-top: 8px;"></div>
      </div>
    `;

    this.container.innerHTML = svgHtml;

    // 7. Gắn sự kiện tương tác
    this.container.querySelectorAll('.graph-node').forEach(nodeEl => {
      nodeEl.addEventListener('click', (e) => {
        const charId = nodeEl.getAttribute('data-id');
        this.selectNode(charId, characters, links);
      });
    });

    document.getElementById('btnGraphQuickAdd')?.addEventListener('click', () => {
      window.StudioApp?.openLorebookModal();
    });

    // Nếu đã có nhân vật được chọn trước đó, hiển thị lại hồ sơ
    if (this.selectedNodeId) {
      this.showDossier(this.selectedNodeId, characters, links);
    } else if (mainChar) {
      this.selectNode(mainChar.id, characters, links);
    }
  }

  selectNode(charId, characters, links) {
    this.selectedNodeId = charId;
    this.showDossier(charId, characters, links);

    // Cập nhật giao diện SVG node active
    this.container.querySelectorAll('.graph-node').forEach(el => {
      const id = el.getAttribute('data-id');
      if (id === charId) {
        el.classList.add('active-node');
        el.querySelector('circle:first-child')?.setAttribute('fill-opacity', '0.45');
      } else {
        el.classList.remove('active-node');
        el.querySelector('circle:first-child')?.setAttribute('fill-opacity', '0.1');
      }
    });
  }

  showDossier(charId, characters, links) {
    const dossierEl = document.getElementById('graphDossierContainer');
    if (!dossierEl) return;

    const char = characters.find(c => c.id === charId);
    if (!char) {
      dossierEl.innerHTML = '';
      return;
    }

    // Lọc quan hệ liên quan đến nhân vật này
    const directLinks = links.filter(l => l.source.id === char.id || l.target.id === char.id);
    let relsHtml = '';
    if (directLinks.length > 0) {
      relsHtml = '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">';
      directLinks.forEach(l => {
        const other = l.source.id === char.id ? l.target : l.source;
        let badgeColor = 'var(--accent-cyan)';
        if (l.type === 'enemy') badgeColor = 'var(--accent-rose)';
        else if (l.type === 'romance') badgeColor = '#f472b6';
        else if (l.type === 'master') badgeColor = 'var(--accent-gold)';

        relsHtml += `
          <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(30,41,59,0.8); border: 1px solid var(--border-subtle); color: ${badgeColor};">
            <strong>${other.name}</strong>: ${l.relation}
          </span>
        `;
      });
      relsHtml += '</div>';
    }

    let attrsHtml = '';
    if (char.attributes && typeof char.attributes === 'object') {
      const items = Object.entries(char.attributes).map(([k, v]) => `${k}: ${v}`).join(' • ');
      if (items) {
        attrsHtml = `<div style="font-size: 0.72rem; color: var(--accent-gold); margin-top: 4px;">⚡ ${items}</div>`;
      }
    }

    dossierEl.innerHTML = `
      <div style="background: rgba(15,23,42,0.85); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px; font-size: 0.8rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong style="color: var(--accent-gold); font-size: 0.92rem;">${char.name}</strong>
            <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 6px;">(${char.role || 'Nhân vật'})</span>
            ${char.aliases?.length ? `<div style="font-size: 0.72rem; color: var(--text-dim);">Biệt hiệu: ${char.aliases.join(', ')}</div>` : ''}
          </div>
          <button class="btn btn-sm btn-outline" id="btnEditCharFromGraph" data-id="${char.id}" style="padding: 2px 6px; font-size: 0.72rem;" title="Chỉnh sửa nhân vật">
            ✏️ Sửa
          </button>
        </div>
        <p style="color: var(--text-secondary); margin: 6px 0 0 0; line-height: 1.4; font-size: 0.76rem;">
          ${char.description || 'Chưa có miêu tả chi tiết.'}
        </p>
        ${attrsHtml}
        ${relsHtml}
      </div>
    `;

    document.getElementById('btnEditCharFromGraph')?.addEventListener('click', () => {
      window.StudioApp?.openLorebookModal(char);
    });
  }
}
