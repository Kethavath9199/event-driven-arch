import { ICommandHandler } from '@nestjs/cqrs';
import { CreateOutboundCommand } from '../impl/create-outbound';
export declare class CreateOutboundHandler implements ICommandHandler<CreateOutboundCommand> {
    constructor();
    execute(command: CreateOutboundCommand): Promise<void>;
}
