import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as https from 'https';
import { StreetviewCipherService } from './streetview-cipher.service';
import { StreetviewTemplateService } from './streetview-template.service';
import { RedisService } from '../redis/redis.service';

const GOOGLE_API_KEY = 'AIzaSyCmL18misQw9KdwqGaw3zHkitj8vG6QF2Y';

// Guaranteed verified Algerian 360° panoramas
const GUARANTEED_ALGERIA_PANOS: Array<{ lat: number; lng: number }> = [
  { lat: 36.768293, lng: 3.053982 }, // Algiers Didouche Mourad
  { lat: 36.775295, lng: 3.059759 }, // Grande Poste d'Alger
  { lat: 36.745892, lng: 3.069648 }, // Maqam Echahid
  { lat: 36.800926, lng: 3.042637 }, // Notre-Dame d'Afrique
  { lat: 35.709468, lng: -0.663401 }, // Santa Cruz Oran
  { lat: 35.703992, lng: -0.648909 }, // Front de Mer Oran
  { lat: 36.371255, lng: 6.613816 }, // Sidi M'Cid Constantine
  { lat: 36.366653, lng: 6.614562 }, // Passerelle Mellah Slimane
  { lat: 36.882228, lng: 7.745358 }, // Basilique Saint-Augustin Annaba
  { lat: 34.881572, lng: -1.311310 }, // Palais El Mechouar Tlemcen
  { lat: 36.592817, lng: 2.441838 }, // Ruines Romaines Tipaza
  { lat: 35.484972, lng: 6.466991 }, // Ruines Romaines Timgad Batna
  { lat: 36.321243, lng: 5.736128 }, // Ruines Romaines Djemila Setif
  { lat: 32.491684, lng: 3.673809 }, // Ksar Ghardaïa M'Zab
  { lat: 29.264177, lng: 0.231575 }, // Timimoun Ksar
  { lat: 24.553909, lng: 9.485123 }, // Djanet Oasis
  { lat: 22.785412, lng: 5.522941 }, // Tamanrasset Hoggar
  { lat: 31.616667, lng: -2.216667 }, // Taghit Dunes Béchar
  { lat: 36.751310, lng: 3.016823 }, // Ben Aknoun Algiers
  { lat: 35.699961, lng: -0.646955 }, // Place d'Armes Oran
];

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

    // Snap to nearest verified real Google Street View panorama if needed
    const resolved = await this.resolveStreetViewCoords(lat, lng);
    lat = resolved.lat;
    lng = resolved.lng;

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

  private async resolveStreetViewCoords(lat: number, lng: number): Promise<{ lat: number; lng: number }> {
    const isAlgeria = lat >= 18.0 && lat <= 38.0 && lng >= -9.0 && lng <= 12.5;
    const cacheKey = `sv:snap:${lat.toFixed(5)}:${lng.toFixed(5)}`;

    const cached = await this.redis.getCached(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }

    // Check with Google's Street View metadata
    const meta = await this.fetchMetadata(lat, lng, isAlgeria ? 35000 : 2500);
    if (meta && meta.lat && meta.lng) {
      const result = { lat: meta.lat, lng: meta.lng };
      await this.redis.setCached(cacheKey, JSON.stringify(result), 86400);
      return result;
    }

    // If in Algeria and no panorama was found nearby, fall back to a guaranteed verified panorama
    if (isAlgeria) {
      const fallback = this.findClosestOrRotatingPano(lat, lng);
      this.logger.warn(`No nearby panorama at ${lat}, ${lng}. Snapped to guaranteed Algerian panorama at ${fallback.lat}, ${fallback.lng}`);
      await this.redis.setCached(cacheKey, JSON.stringify(fallback), 86400);
      return fallback;
    }

    return { lat, lng };
  }

  private fetchMetadata(lat: number, lng: number, radius: number): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=${radius}&key=${GOOGLE_API_KEY}`;
      const req = https.get(url, { timeout: 2500 }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.status === 'OK' && data.location) {
              resolve({
                lat: Number(data.location.lat.toFixed(6)),
                lng: Number(data.location.lng.toFixed(6)),
              });
              return;
            }
          } catch {}
          resolve(null);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  private findClosestOrRotatingPano(lat: number, lng: number): { lat: number; lng: number } {
    let closest = GUARANTEED_ALGERIA_PANOS[0];
    let minDist = Infinity;

    for (const p of GUARANTEED_ALGERIA_PANOS) {
      const d = Math.hypot(p.lat - lat, p.lng - lng);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    return closest;
  }
}
