/**
 * AI Novel Studio - Coordinator Agent
 * Central pipeline orchestrator adapted from ainovel-cli
 */

import { AGENT_PROMPTS } from '../config.js';
import { storage } from '../core/storage.js';

export class CoordinatorAgent {
  constructor(apiClient, eventBus) {
    this.apiClient = apiClient;
    this.eventBus = eventBus;
  }

  emit(type, data) {
    if (this.eventBus) {
      this.eventBus(type, data);
    }
  }

  logActivity(agent, action, details = {}, status = 'running') {
    const logItem = {
      id: 'log_' + Date.now() + Math.random().toString(36).substr(2, 4),
      agent,
      action,
      details,
      status,
      timestamp: new Date().toLocaleTimeString('vi-VN')
    };
    this.emit('activity', logItem);
    return logItem;
  }
}
