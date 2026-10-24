import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { FeedbackService, FeedbackData } from './feedback.service';

@Controller('api/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async handleFeedback(@Body() body: FeedbackData) {
    if (!body || !body.message || !body.message.trim()) {
      throw new BadRequestException('Feedback message is required.');
    }
    return this.feedbackService.sendFeedback(body);
  }
}
