import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { GameService } from '../game/game.service';
import { getReqClientIp } from '../game/game.helpers';

@Controller('api/streetview')
export class StreetViewController {
  constructor(private readonly gameService: GameService) {}

  @Get('uplink')
  getUplink(
    @Query('roomId') roomId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const room = this.gameService.getRoom(roomId);
    if (!room) {
      return res.status(404).send('Expedition room not found.');
    }

    if (
      room.status !== 'ROUND_ACTIVE' &&
      room.status !== 'ROUND_COUNTDOWN'
    ) {
      return res.status(403).send('No active expedition round.');
    }

    const target = room.roundTarget;
    if (!target) {
      return res.status(404).send('No target location.');
    }

    const clientIp = getReqClientIp(req);
    const isLoopback = clientIp === '127.0.0.1' || clientIp === 'localhost';
    const isPlayerInRoom =
      Boolean(room.players[clientIp]) ||
      clientIp === room.hostIp ||
      isLoopback;

    if (!isPlayerInRoom) {
      return res
        .status(403)
        .send(
          'Access Denied: You must be an active operative in this expedition room.',
        );
    }

    // Generate obfuscated payload to prevent any plain text coordinate leakage
    const targetUrl = `https://maps.google.com/maps?layer=c&cbll=${target.lat},${target.lng}&cbp=11,0,,0,0&output=svembed`;
    const key = crypto.randomBytes(16).toString('hex');
    const buf = Buffer.from(targetUrl, 'utf8');
    const xored: number[] = [];
    for (let i = 0; i < buf.length; i++) {
      xored.push(buf[i] ^ key.charCodeAt(i % key.length));
    }
    const payload = Buffer.from(xored).toString('base64');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private, max-age=0',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.removeHeader('X-Frame-Options');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Street View Uplink</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #020617; }
    #sv-mount { width: 100%; height: 100%; position: absolute; inset: 0; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
    
    /* 100% Solid Opaque Anti-Spoiler Top Shield (Blocks Google Address & State Card) */
    .sv-shield-top-left {
      position: absolute;
      top: 0;
      left: 0;
      width: 490px;
      max-width: 88vw;
      height: 145px;
      background: #020617;
      border-bottom-right-radius: 12px;
      border-bottom: 2px solid #1e293b;
      border-right: 2px solid #1e293b;
      z-index: 999999;
      pointer-events: auto;
      display: flex;
      align-items: center;
      padding: 0 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85);
    }
    .sv-shield-brand {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sv-shield-title {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #38bdf8;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sv-shield-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: sv-pulse 1.8s infinite alternate;
    }
    @keyframes sv-pulse {
      from { opacity: 0.4; }
      to { opacity: 1; }
    }
    .sv-shield-sub {
      font-family: monospace;
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }

    /* Solid Bottom-Left Shield (Blocks Google Logo & State Copyright) */
    .sv-shield-bottom-left {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 320px;
      max-width: 70vw;
      height: 48px;
      background: #020617;
      border-top-right-radius: 10px;
      border-top: 2px solid #1e293b;
      border-right: 2px solid #1e293b;
      z-index: 999999;
      pointer-events: auto;
    }

    /* Solid Bottom-Right Shield (Blocks Terms of Service / Bottom Edge Watermarks) */
    .sv-shield-bottom-right {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 280px;
      max-width: 65vw;
      height: 38px;
      background: #020617;
      border-top-left-radius: 10px;
      border-top: 2px solid #1e293b;
      border-left: 2px solid #1e293b;
      z-index: 999999;
      pointer-events: auto;
    }
  </style>
</head>
<body>
  <div id="sv-mount">
    <div class="sv-shield-top-left">
      <div class="sv-shield-brand">
        <div class="sv-shield-title">
          <span class="sv-shield-dot"></span>
          <span>Tactical Recon Uplink</span>
        </div>
        <div class="sv-shield-sub">
          SIGNAL ENCRYPTED // ANTI-SPOILER ACTIVE
        </div>
      </div>
    </div>
    <div class="sv-shield-bottom-left"></div>
    <div class="sv-shield-bottom-right"></div>
  </div>
  <script>
    (function() {
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
      document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'u')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);

      try {
        const _p = "${payload}";
        const _k = "${key}";
        const _raw = atob(_p);
        let _url = "";
        for (let i = 0; i < _raw.length; i++) {
          _url += String.fromCharCode(_raw.charCodeAt(i) ^ _k.charCodeAt(i % _k.length));
        }

        const _f = document.createElement('iframe');
        _f.src = _url;
        _f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        _f.allowFullscreen = true;
        _f.setAttribute('referrerpolicy', 'no-referrer');
        _f.style.width = "100%";
        _f.style.height = "100%";
        _f.style.border = "none";
        document.getElementById('sv-mount').appendChild(_f);
      } catch(e) {
        console.error("Uplink mount error");
      }
    })();
  </script>
</body>
</html>`;

    res.send(html);
  }
}
