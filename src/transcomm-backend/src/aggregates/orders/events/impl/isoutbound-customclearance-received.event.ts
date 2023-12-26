import { StorableEvent } from 'event-sourcing';

export class IsOutboundCustomClearanceRecievedEvent extends StorableEvent {
  aggregateEvent = 'order';
  constructor(
    public readonly aggregateId: string,
    public readonly ecomCode: string,
    public readonly orderNumber: string
  ) {
    super();
  }
}
