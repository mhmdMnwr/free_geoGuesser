import { Controller, All, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import * as http from 'http';
import * as https from 'https';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All(['api/lobbies', 'api/lobbies/*'])
  proxyLobbies(@Req() req: Request, @Res() res: Response) {
    this.forwardRequest(req, res, this.proxyService.getLobbyServiceUrl());
  }

  @All(['api/media/*', 'api/streetview/*'])
  proxyMedia(@Req() req: Request, @Res() res: Response) {
    this.forwardRequest(req, res, this.proxyService.getRoadProxyUrl(), true);
  }

  private forwardRequest(
    req: Request,
    res: Response,
    targetBaseUrl: string,
    signInternal = false,
  ) {
    const url = new URL(req.originalUrl, targetBaseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: Record<string, any> = { ...req.headers };
    delete headers.host;

    if (signInternal) {
      headers['x-internal-service-auth'] = this.proxyService.getInternalAuthHeader(url.pathname);
    }

    const proxyReq = client.request(
      url,
      {
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'Bad Gateway: Microservice unreachable', message: err.message });
    });

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.setHeader('content-length', Buffer.byteLength(bodyData));
      if (!headers['content-type']) {
        proxyReq.setHeader('content-type', 'application/json');
      }
      proxyReq.write(bodyData);
      proxyReq.end();
      return;
    }

    req.pipe(proxyReq);
  }
}
