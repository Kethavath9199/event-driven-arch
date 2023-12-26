import { InboundModel } from 'core';


export class CreateInboundCommand {
  constructor(
    public readonly inboundData: [InboundModel],
  ) {}
}
