import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { CommonService } from 'database/common.service';
import { CreateInboundCommand } from '../impl/create-inbound';
import { Inbound, InboundLine } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { AnyPtrRecord } from 'dns';
@CommandHandler(CreateInboundCommand)
export class CreateInboundHandler implements ICommandHandler<CreateInboundCommand> {
    private logger = new Logger(this.constructor.name);
    constructor(
        private commonService: CommonService,
    ) { }

    async execute(command: CreateInboundCommand): Promise<any> {
        this.logger.log("entred into command handler............");
        const { inboundData } = command;
        this.logger.debug("data in command handler", JSON.stringify(inboundData));

        for (let elem of inboundData) {
            //inbound line insertion
            for (let i = 0; i < elem.line_items!.length; i++) {
                await this.persistInboundLine({
                    "id": uuid(),
                    "line_id": elem.line_items[i].line_id!,
                    "declaration_no": elem.line_items[i].declaration_no!,
                    "declaration_date": elem.line_items[i].declaration_date!,
                    "duty_amt": elem.line_items[i].duty_amt! * 100 / 100,
                    "tax_amt": elem.line_items[i].tax_amt! * 100 / 100,
                    "duty_currency": elem.line_items[i].duty_currency!,
                    "mop1": elem.line_items[i].mop1!,
                    "mop1_value": elem.line_items[i].mop1_value!,
                    "mop2": elem.line_items[i].mop2!,
                    "mop2_value": elem.line_items[i].mop2_value!,
                    "hawb_no": elem.hawb_no,
                    "order_id": elem.order_id
                })
            }

            //inbound header insertion
            await this.persistInbound({
                "shipper_acc_no": "dummy",
                "hawb_no": elem.hawb_no,
                "order_id": elem.order_id,
                "declaration_status": elem.declaration_status ?? "",
                "declaration_no": elem.declaration_no ?? "",
                "declaration_date": elem.declaration_date ?? "",
                "createdAt": elem.createdAt ?? new Date(),
                "incoterm": elem.incoterm ?? "",
            })

            console.log("inbound data pesrsted successfully", elem);
        }
        return "Inbound persisted successfully";
    }

    async persistInbound(inboundData: Inbound) {
        return await this.commonService.createInbound(inboundData);
    }

    async persistInboundLine(inboundData: InboundLine) {
        return await this.commonService.createInboundLine(inboundData);
    }
}

