import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RoadProxyService {
  private readonly logger = new Logger(RoadProxyService.name);

  constructor(private readonly redis: RedisService) {}

  generateRoadToken(): string {
    return `road_${crypto.randomBytes(12).toString('hex')}`;
  }

  generateFallbackRoadSvg(lat: number, lng: number, label: string): Buffer {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="800" height="260" fill="url(#sky)"/>
        <polygon points="0,260 800,260 800,450 0,450" fill="#047857" opacity="0.3"/>
        <polygon points="250,260 550,260 750,450 50,450" fill="url(#road)"/>
        <line x1="400" y1="260" x2="400" y2="450" stroke="#f59e0b" stroke-width="4" stroke-dasharray="20,15"/>
        <circle cx="680" cy="80" r="30" fill="#fbbf24" opacity="0.8"/>
        <rect x="20" y="20" width="300" height="46" rx="8" fill="#000000" opacity="0.6"/>
        <text x="36" y="50" font-family="monospace" font-size="16" fill="#10b981" font-weight="bold">
          TERRAIN SECTOR INTEL
        </text>
      </svg>
    `.trim();
    return Buffer.from(svg, 'utf-8');
  }

  async cacheRoadForTarget(target: { lat: number; lng: number; label: string }): Promise<string> {
    const roadToken = this.generateRoadToken();
    const svgBuffer = this.generateFallbackRoadSvg(target.lat, target.lng, target.label);
    await this.redis.setRoadImage(roadToken, svgBuffer, 7200);
    this.logger.log(`Cached sanitized road imagery for token ${roadToken}`);
    return roadToken;
  }

  async getRoadImage(roadToken: string): Promise<Buffer | null> {
    const cached = await this.redis.getRoadImage(roadToken);
    if (cached) return cached;
    if (roadToken && roadToken.startsWith('road_')) {
      const fallback = this.generateFallbackRoadSvg(0, 0, 'ROAD INTEL');
      await this.redis.setRoadImage(roadToken, fallback, 7200);
      return fallback;
    }
    return null;
  }
}
