import { Injectable, Logger } from '@nestjs/common';

export interface FeedbackData {
  username?: string;
  category?: string;
  rating?: number;
  message: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  async sendFeedback(data: FeedbackData): Promise<{ ok: boolean; delivered: boolean; warning?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

    if (!token || !chatId) {
      this.logger.warn('Feedback received, but Telegram credentials (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID) are not configured.');
      return { ok: true, delivered: false, warning: 'Telegram not configured' };
    }

    const ratingVal = Math.min(5, Math.max(1, Number(data.rating) || 5));
    const ratingStars = '★'.repeat(ratingVal) + '☆'.repeat(5 - ratingVal);
    const safeUsername = this.escapeHtml(data.username || 'Anonymous Operative');
    const safeCategory = this.escapeHtml(data.category || 'General');
    const safeMsg = this.escapeHtml(data.message.trim());
    const dateStr = new Date().toUTCString();

    const text =
      `🎮 <b>New Feedback — geussiha</b>\n\n` +
      `👤 <b>Operative:</b> <code>${safeUsername}</code>\n` +
      `🏷 <b>Category:</b> ${safeCategory}\n` +
      `⭐ <b>Rating:</b> ${ratingStars} (${ratingVal}/5)\n\n` +
      `💬 <b>Message:</b>\n${safeMsg}\n\n` +
      `🕒 <i>${dateStr}</i>`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      const resJson = (await response.json()) as any;
      if (!response.ok || !resJson.ok) {
        this.logger.error(`Failed to dispatch Telegram message: ${JSON.stringify(resJson)}`);
        return { ok: true, delivered: false, warning: resJson.description || 'Telegram API error' };
      }

      this.logger.log(`Feedback from "${safeUsername}" delivered to Telegram chat ${chatId}`);
      return { ok: true, delivered: true };
    } catch (err: any) {
      this.logger.error(`Error sending feedback to Telegram: ${err.message}`, err.stack);
      return { ok: true, delivered: false, warning: err.message };
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
