import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Inbound,
  Outbound,
  InboundLine
} from '@prisma/client';
import { DatabaseService } from './database.service';


@Injectable()
export class CommonService {
  constructor(private prisma: DatabaseService) { }

  async createInbound(data: Inbound): Promise<Inbound> {
    console.log("enteredd.....intoo.prismaa.... create inbound",data);
    return await this.prisma.inbound.create({
      data,
    });
  }

  async createInboundLine(data: InboundLine): Promise<InboundLine> {
    console.log("enteredd.....intoo.prismaa.... create inbound Lines",data);
    return await this.prisma.inboundLine.create({
      data,
    });
  }

  async createOutbound(data: Outbound): Promise<Outbound> {
    return await this.prisma.outbound.create({
      data,
    });
  }
}

