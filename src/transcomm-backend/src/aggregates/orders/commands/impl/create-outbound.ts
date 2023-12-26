import { OutboundModel } from 'core';


export class CreateOutboundCommand {
  constructor(
    public readonly outboundData: [OutboundModel],
  ) {}
}
