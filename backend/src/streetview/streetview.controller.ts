import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { GameService } from '../game/game.service';
import { getReqClientIp } from '../game/game.helpers';

@Controller('api/streetview')
export class StreetViewController {
  constructor(private readonly gameService: GameService) {}

  @Get('uplink')
  getUplink(@Req() req: Request, @Res() res: Response) {
    const gameState = this.gameService.state;
    if (
      gameState.status !== 'ROUND_ACTIVE' &&
      gameState.status !== 'ROUND_COUNTDOWN'
    ) {
      return res.status(403).send('No active expedition round.');
    }

    const target = gameState.roundTarget;
    if (!target) {
      return res.status(404).send('No target location.');
    }

    const clientIp = getReqClientIp(req);
    const isLoopback = clientIp === '127.0.0.1' || clientIp === 'localhost';
    const isHost =
      clientIp === gameState.hostIp || (isLoopback && !gameState.hostIp);

    if (!isHost && !isLoopback) {
      return res
        .status(403)
        .send(
          'Access Denied: Only the expedition Host is authorized to fetch Street View data.',
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
    // Allow framing from frontend origins over LAN
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
    #sv-mount { width: 100%; height: 100%; position: absolute; inset: 0; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <div id="sv-mount"></div>
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
