import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { StreetviewCipherService } from './streetview-cipher.service';
import { StreetviewTemplateService } from './streetview-template.service';
import { RedisService } from '../redis/redis.service';

@Controller('api/streetview')
export class StreetViewController {
  private readonly logger = new Logger(StreetViewController.name);

  constructor(
    private readonly cipherService: StreetviewCipherService,
    private readonly templateService: StreetviewTemplateService,
    private readonly redis: RedisService,
  ) {}

  @Get('uplink')
  async getUplink(
    @Query('roomId') roomId: string,
    @Query('token') token: string,
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
    @Res() res: Response,
  ) {
    let lat = 35.6895;
    let lng = 139.6917;

    const lookupKey = token || roomId;
    if (lookupKey) {
      const cached = await this.redis.getTargetCoords(lookupKey);
      if (cached && typeof cached.lat === 'number' && typeof cached.lng === 'number') {
        lat = cached.lat;
        lng = cached.lng;
      } else if (latStr && lngStr) {
        lat = parseFloat(latStr);
        lng = parseFloat(lngStr);
      }
    } else if (latStr && lngStr) {
      lat = parseFloat(latStr);
      lng = parseFloat(lngStr);
    }

    const embedUrl = `https://www.google.com/maps/embed?origin=mfe&pb=!6m6!1m5!2m2!1d${lat}!2d${lng}!4f-0!5f1`;
    const { payload, key } = this.cipherService.obfuscateUrl(embedUrl);
    const html = this.templateService.renderUplinkHtml(payload, key);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.removeHeader('X-Frame-Options');
    res.send(html);
  }
}
