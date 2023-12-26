import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CreateOutboundCommand } from '../impl/create-outbound';
import { CommonService } from 'database/common.service';
import { Outbound } from '@prisma/client';
import { v4 as uuid } from 'uuid';
@CommandHandler(CreateOutboundCommand)
export class CreateOutboundHandler implements ICommandHandler<CreateOutboundCommand> {
    private logger = new Logger(this.constructor.name);
    constructor(
        private commonService: CommonService,
    ) { }

    async execute(command: CreateOutboundCommand): Promise<any> {
        const { outboundData } = command;
        this.logger.debug("data in outbound command handler", JSON.stringify(outboundData));
        for(let elem of outboundData){
            await this.persistOutbound({
                id: uuid(),
                hawb_no: elem.hawb_no,
                order_id: elem.order_id,
                createdAt: new Date()
            });
            console.log("data persisted succussfully ", elem);
        }
        return "Outbound data persisted successfully";
    }

    async persistOutbound(outbound: Outbound): Promise<Outbound> {
        console.log("data persisting ", outbound);
        return await this.commonService.createOutbound(outbound);
    }
}


