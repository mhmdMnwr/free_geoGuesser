import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { RoadProxyService } from './road-proxy.service';
import { InternalAuthGuard } from '../security/internal-auth.guard';

@Controller()
export class RoadProxyController {
  constructor(private readonly roadProxyService: RoadProxyService) {}

  /**
   * Internal endpoint for GameEngine to request and cache road imagery in Redis.
   * Protected by cluster HMAC authorization.
   */
  @Post('internal/cache-road')
  @UseGuards(InternalAuthGuard)
  async cacheRoad(
    @Body() body: { lat: number; lng: number; label?: string },
  ) {
    const roadToken = await this.roadProxyService.cacheRoadForTarget(body);
    return { roadToken };
  }

  /**
   * Public LAN endpoint for clients to stream cached road imagery from Redis.
   * Completely eliminates client WAN queries and Google URL leaks.
   */
  @Get('api/media/road/:roadToken')
  async getRoadImage(
    @Param('roadToken') roadToken: string,
    @Res() res: Response,
  ) {
    let buffer = await this.roadProxyService.getRoadImage(roadToken);
    if (!buffer) {
      // Fallback on-demand generation
      buffer = this.roadProxyService.generateTacticalRoadSvg(0, 0, 'Recon Location');
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=7200, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }
}
