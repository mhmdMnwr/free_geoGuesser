import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { NetworkInterfacesService } from './network-interfaces.service';

@Controller('api')
export class InfoController {
  constructor(private readonly networkService: NetworkInterfacesService) {}

  @Get('info')
  getInfo(@Req() req: Request) {
    const hostHeader = (req.headers['x-forwarded-host'] || req.headers['host']) as string;
    const lanIps = this.networkService.getLanAddresses();
    const primaryIp = this.networkService.getPrimaryIp(hostHeader);
    const port = parseInt(process.env.PORT || '5000', 10);
    const frontendPort = parseInt(process.env.FRONTEND_PORT || '3000', 10);

    return {
      primaryIp,
      lanIps,
      port,
      backendPort: port,
      frontendPort,
      joinUrl: `http://${primaryIp}:${frontendPort}`,
    };
  }

  @Get('status')
  getStatus() {
    return {
      status: 'LOBBY',
      currentRound: 0,
      timestamp: Date.now(),
      cluster: 'active',
    };
  }
}
