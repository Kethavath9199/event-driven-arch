import { ICommandHandler } from '@nestjs/cqrs';
import { CreateInboundCommand } from '../impl/create-inbound';
export declare class CreateInboundHandler implements ICommandHandler<CreateInboundCommand> {
    constructor();
    execute(command: CreateInboundCommand): Promise<void>;
}
