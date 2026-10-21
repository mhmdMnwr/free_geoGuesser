import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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

  @UseGuards(InternalAuthGuard)
  @Post('internal/cache-road')
  async cacheRoad(@Body() target: { lat: number; lng: number; label: string }) {
    const roadToken = await this.roadProxyService.cacheRoadForTarget(target);
    return { success: true, roadToken };
  }

  @Get('api/media/road/:roadToken')
  async getRoadImage(
    @Param('roadToken') roadToken: string,
    @Res() res: Response,
  ) {
    const imageBuffer = await this.roadProxyService.getRoadImage(roadToken);
    if (!imageBuffer) {
      throw new NotFoundException('Road imagery expired or not found.');
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=7200');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(imageBuffer);
  }
}
