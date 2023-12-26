import { StorableEvent } from 'event-sourcing';

export class UpdateTransportInfoMethodInvokedForAmendmentEvent extends StorableEvent {
  aggregateEvent = 'order';
  constructor(
    public readonly aggregateId: string,
    public readonly invoiceNumber: string,
    public readonly orderNumber: string,
    public readonly txnId: string,
    public readonly ecomCode: string,
    public readonly message: string,
    public readonly error: string,
    public readonly retriedBy: string | null,
    public readonly remark: string | null
  ) {
    super();
  }
}
