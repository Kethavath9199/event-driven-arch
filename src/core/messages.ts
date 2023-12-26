export interface BusinessMessageModel {
  id: string;
  msgType: string;
  sender: string;
  receivers: Map<string, string[]>;
  issueTime: number;
  trailKey: string;
  trailCreatedOn: number;
  checkpointStatus: string;
  checkpointAttributes: Map<string, string>;
  attachments: any;
  transformedMessage: string;
  sequenceNumber: string;
  f1: string;
  f2: string;
  postProcessingRequired: boolean;
  token: string;
  payloadCreatedOn: number;
}

export interface PickupMovementsMessageModel {
  msgType: string;
  sender: string;
  uuid: string;
  msgFilePath: string;
  messages: string;
}

export interface NotificationMessageModel {
  id: string;
  type: NotificationType;
  content: string;
}

export enum NotificationType {
  delete = 'DELETE',
  forwardonly = 'FORWARDONLY',
  processed = 'PROCESSED',
}

export interface OutputMessageModel {
  id: string;
  msgType: string;
  payloads: string[];
  audience: string;
  receivers: {
    primary: string[];
    secondary: string[];
  };
  primary: boolean;
  applicationId: string;
  sender: string;
  issueTimeFLag: boolean;
}

export interface ErrorMessagePayloadModel {
  id: string;
  errorCode: string;
  dateTime: string;
  errorDesc: string;
  msgIdentifier: {
    orderNumber: string;
    invoiceId?: string;
    txnId?: string;
    ecomBusinessCode: string;
  };
}


//Outbound model

export interface OutboundModel{
  hawb_no:string,
  order_id:string
}

// Inbound model
export interface InboundLineModel {
  line_id ? : string,
  declaration_no ? : string,
  declaration_date ? : string,
  duty_amt ? : number,
  tax_amt ? : number,
  duty_currency ? : string,
  mop1 ? : string,
  mop1_value ? : string,
  mop2 ? : string,
  mop2_value ? : string,
  hawb_no : string,
  order_id : string
}

interface InboundLineArrayModel extends Array<InboundLineModel>{}

export interface InboundModel {
  shipper_acc_no: string,
  hawb_no: string,
  order_id: string,
  declaration_status ? : string,
  declaration_no ? : string,
  declaration_date ? : string,
  incoterm ? : string,
  createdAt ? :Date,
  line_items  : InboundLineArrayModel,
}