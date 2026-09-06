/**
 * KiraAI API Client
 * Optimized for https://kiraai.vn/api/v1/chat/completions
 * Supports 100% Free Models: qwen3.8-flash, glm-5.3-flash, minimax-m3-free, kira-auto, kira-2.0
 */

import { KIRA_CONFIG } from '../config.js';
import { appLogger } from '../core/logger.js';

export class KiraAPIClient {
  constructor(apiKey = '', baseUrl = KIRA_CONFIG.DEFAULT_BASE_URL) {
    this.apiKey = apiKey ? apiKey.trim() : '';
    this.baseUrl = baseUrl || KIRA_CONFIG.DEFAULT_BASE_URL;
  }

  setApiKey(key) {
    this.apiKey = key ? key.trim() : '';
  }

  setBaseUrl(url) {
    this.baseUrl = url ? url.trim() : KIRA_CONFIG.DEFAULT_BASE_URL;
  }

  /**
   * Send Chat Completion request to KiraAI (qua Proxy bảo mật hoặc BYOK)
   * Supports both real-time streaming and batch completion
   */
  async chatCompletion({
    model = 'qwen3.8-flash',
    messages = [],
    temperature = 0.7,
    maxTokens = 4096,
    stream = true,
    onChunk = null,
    onThinking = null,
    signal = null
  }) {
    const startTime = performance.now();

    // Check if proxy or custom BYOK key is available
    if (!this.apiKey && !KIRA_CONFIG.PROXY_URL) {
      throw new Error('Chưa thiết lập Cổng bảo mật Proxy hoặc API Key! Vui lòng cấu hình PROXY_URL.');
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: Boolean(stream)
    };

    // Khi không có custom key, tự động gọi qua Edge Function Proxy bảo mật
    const isUsingProxy = !this.apiKey && Boolean(KIRA_CONFIG.PROXY_URL);
    const targetUrl = isUsingProxy ? KIRA_CONFIG.PROXY_URL : this.baseUrl;

    const requestHeaders = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      requestHeaders['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      let response;
      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(payload),
          signal
        });
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError' || (signal && signal.aborted)) {
          throw fetchErr;
        }
        console.warn('AI fetch encountered network hitch, retrying once...', fetchErr);
        await new Promise(res => setTimeout(res, 1200));
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(payload),
          signal
        });
      }

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.error?.message) {
            errorDetails = errJson.error.message;
          }
        } catch (_) {}

        if (response.status === 402) {
          errorDetails = 'Ví tài khoản trên KiraAI của bạn hiện có số dư = 0đ (Wallet balance must be > 0 VND). Vui lòng đăng nhập https://kiraai.vn nạp tiền vào ví để kích hoạt gọi các model!';
        }
        throw new Error(errorDetails);
      }

      // Handle Streaming
      if (stream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let reasoningText = '';
        let buffer = '';

        // Timeout watchdog: if no chunk received for 50 seconds, abort reading
        const readWithTimeout = (timeoutMs = 50000) => {
          let timer;
          const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('Mất kết nối với máy chủ AI (Timeout sau 50 giây không nhận được dữ liệu). Vui lòng thử lại!'));
            }, timeoutMs);
          });
          return Promise.race([
            reader.read().then(res => {
              clearTimeout(timer);
              return res;
            }),
            timeoutPromise
          ]);
        };

        while (true) {
          const { done, value } = await readWithTimeout();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed === 'data: [DONE]') {
              break;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                const delta = data.choices?.[0]?.delta || {};
                const deltaContent = delta.content || '';
                const deltaReasoning = delta.reasoning_content || '';

                if (deltaReasoning) {
                  reasoningText += deltaReasoning;
                  if (onThinking) {
                    onThinking(deltaReasoning, reasoningText);
                  }
                }

                if (deltaContent) {
                  fullText += deltaContent;
                  if (onChunk) {
                    onChunk(deltaContent, fullText);
                  }
                }
              } catch (e) {
                // Ignore partial JSON parse errors
              }
            }
          }
        }

        const duration = Math.round(performance.now() - startTime);
        const estimatedTokens = Math.ceil(fullText.length / 3.5);
        appLogger.log('INFO', `KiraAI [${model}] hoàn thành trong ${duration}ms (~${estimatedTokens} tokens)`);

        return {
          content: fullText,
          reasoningContent: reasoningText,
          durationMs: duration,
          estimatedTokens,
          model
        };
      } else {
        // Non-streaming JSON response
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const duration = Math.round(performance.now() - startTime);
        const totalTokens = data.usage?.total_tokens || Math.ceil(content.length / 3.5);
        appLogger.log('INFO', `KiraAI [${model}] hoàn thành trong ${duration}ms (~${totalTokens} tokens)`);

        return {
          content,
          durationMs: duration,
          estimatedTokens: totalTokens,
          model
        };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        appLogger.log('INFO', `Yêu cầu gọi model [${model}] đã bị hủy.`);
        throw new Error('Yêu cầu đã bị hủy bởi tác giả.');
      }
      appLogger.log('ERROR', `KiraAI [${model}] gặp sự cố: ${err.message}`);
      throw err;
    }
  }

  /**
   * Test connection to KiraAI API with a lightweight ping
   */
  async testConnection(model = 'qwen3.8-flash') {
    if (!this.apiKey && !KIRA_CONFIG.PROXY_URL) {
      return { success: false, message: 'Chưa cấu hình Cổng proxy bảo mật hoặc API Key.' };
    }

    try {
      const res = await this.chatCompletion({
        model,
        messages: [
          { role: 'system', content: 'You are a test ping agent. Answer in one short sentence.' },
          { role: 'user', content: 'Test connection.' }
        ],
        maxTokens: 50,
        stream: false
      });

      return {
        success: true,
        message: 'Kết nối KiraAI API thành công!',
        latency: `${res.durationMs}ms`,
        model
      };
    } catch (err) {
      return {
        success: false,
        message: err.message
      };
    }
  }
}
