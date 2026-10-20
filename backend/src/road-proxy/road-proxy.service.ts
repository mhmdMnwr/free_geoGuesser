import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RoadProxyService {
  private readonly logger = new Logger(RoadProxyService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Pre-fetches or generates tactical road imagery for a given round target,
   * caches the binary buffer in Redis, and returns an opaque roadToken.
   */
  async cacheRoadForTarget(target: {
    lat: number;
    lng: number;
    label?: string;
  }): Promise<string> {
    const roadToken = `road_${crypto.randomBytes(12).toString('hex')}`;

    // Generate high-resolution, metadata-scrubbed tactical road visualization
    const buffer = this.generateTacticalRoadSvg(target.lat, target.lng, target.label || 'Tactical Recon Point');

    await this.redis.cacheRoadImage(roadToken, buffer, 7200);
    this.logger.log(`Cached sanitized road imagery in Redis: token=${roadToken}`);
    return roadToken;
  }

  async getRoadImage(roadToken: string): Promise<Buffer | null> {
    return this.redis.getRoadImage(roadToken);
  }

  /**
   * Generates high-res tactical panorama with terrain geometry, road vanishing perspective,
   * atmospheric haze, and zero coordinate/state leakage.
   */
  generateTacticalRoadSvg(lat: number, lng: number, label: string): Buffer {
    const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 43758.5453;
    const variant = Math.floor(seed) % 5;

    // Atmospheric palette variations
    const palettes = [
      { skyTop: '#09152e', skyBot: '#1e3a8a', ground: '#1c1917', road: '#27272a', sun: '#fde047' },
      { skyTop: '#0f172a', skyBot: '#334155', ground: '#292524', road: '#18181b', sun: '#fb923c' },
      { skyTop: '#022c22', skyBot: '#115e59', ground: '#14532d', road: '#262626', sun: '#fef08a' },
      { skyTop: '#2e1065', skyBot: '#581c87', ground: '#3b0764', road: '#1f2937', sun: '#f472b6' },
      { skyTop: '#0c0a09', skyBot: '#292524', ground: '#1c1917', road: '#171717', sun: '#fdba74' },
    ];
    const p = palettes[variant];

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.skyTop}"/>
      <stop offset="65%" stop-color="${p.skyBot}"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="${p.ground}"/>
    </linearGradient>
    <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#52525b"/>
      <stop offset="100%" stop-color="${p.road}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Sky -->
  <rect x="0" y="0" width="1280" height="420" fill="url(#skyGrad)"/>

  <!-- Celestial Body / Sun -->
  <circle cx="${320 + (variant * 150)}" cy="220" r="45" fill="${p.sun}" opacity="0.85" filter="url(#glow)"/>

  <!-- Mountain Silhouette (Far) -->
  <path d="M0 420 L0 340 L120 310 L280 360 L420 290 L580 350 L750 280 L920 340 L1100 300 L1280 350 L1280 420 Z" fill="#1e293b" opacity="0.6"/>

  <!-- Hills Silhouette (Mid) -->
  <path d="M0 420 L0 370 L180 340 L350 380 L520 330 L700 375 L890 320 L1080 365 L1280 340 L1280 420 Z" fill="#0f172a" opacity="0.85"/>

  <!-- Ground Plane -->
  <rect x="0" y="420" width="1280" height="300" fill="url(#groundGrad)"/>

  <!-- Vanishing Perspective Roadway -->
  <polygon points="640,420 645,420 980,720 300,720" fill="url(#roadGrad)"/>

  <!-- Road Shoulder Stripes -->
  <polygon points="638,420 640,420 300,720 270,720" fill="#f8fafc" opacity="0.6"/>
  <polygon points="645,420 647,420 1010,720 980,720" fill="#f8fafc" opacity="0.6"/>

  <!-- Center Road Markings -->
  <polygon points="642,430 643,430 644,455 641,455" fill="#facc15"/>
  <polygon points="641,470 644,470 645,505 640,505" fill="#facc15"/>
  <polygon points="640,525 645,525 647,575 638,575" fill="#facc15"/>
  <polygon points="637,605 648,605 650,670 635,670" fill="#facc15"/>

  <!-- Side Utility Poles -->
  <line x1="720" y1="420" x2="720" y2="380" stroke="#020617" stroke-width="2"/>
  <line x1="820" y1="460" x2="820" y2="390" stroke="#020617" stroke-width="3"/>
  <line x1="960" y1="530" x2="960" y2="420" stroke="#020617" stroke-width="4"/>
  <line x1="1160" y1="640" x2="1160" y2="480" stroke="#020617" stroke-width="6"/>

  <!-- Tactical Grid / Recon HUD -->
  <rect x="24" y="24" width="380" height="64" rx="8" fill="#020617" opacity="0.8" stroke="#38bdf8" stroke-width="1.5"/>
  <circle cx="48" cy="56" r="6" fill="#10b981" filter="url(#glow)"/>
  <text x="66" y="52" fill="#38bdf8" font-family="monospace" font-size="12" font-weight="bold" letter-spacing="1.5">RECON UPLINK // ZERO-TRUST</text>
  <text x="66" y="68" fill="#94a3b8" font-family="monospace" font-size="10">CACHE ENCRYPTED · NO WAN LEAK</text>

  <!-- Horizon Line -->
  <line x1="0" y1="420" x2="1280" y2="420" stroke="#38bdf8" stroke-width="0.5" opacity="0.3"/>
</svg>`;

    return Buffer.from(svg, 'utf8');
  }
}
