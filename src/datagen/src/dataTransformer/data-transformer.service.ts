
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Address,
  businessCodeAccountNoMapping,
  CheckPointFile,
  ConfirmReturnDelivery,
  ConfirmReturnDeliveryParameters,
  ConsigneeAddress,
  DateConverterSlashesToDashes,
  DateTimeOffsetToDubaiTime,
  DeliveredView,
  DeliverOrderParameters,
  DeliverySignature,
  Direction,
  EcomBusinessCodeLookup,
  ErrorMessagePayloadModel,
  findCountryCode,
  findPaymentModeAndAccountNo,
  InitiateDeclarationParameters,
  InvoiceForSubmitOrderParametersForReturn,
  ModeType,
  Movement,
  Order,
  ReturnOrder,
  ReturnRequest,
  SubmitOrder,
  SubmitOrderParameters,
  SubmitOrderParametersForReturn,
  UpdateExitConfirmationParameters,
  UpdateTransportInfoParameters,
  YesNo,
  DateStrFormat
} from 'core';
import { v4 as uuidv4 } from 'uuid';
import { BlessClientService } from '../bless/bless-client/bless-client.service';
import { SecretsService } from '../secrets/secrets.service';
const crypto = require('crypto');

@Injectable()
export class DataTransformerService {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    private configService: ConfigService,
    private secretsService: SecretsService,
    private blessClientService: BlessClientService,
  ) { }

  async transformSubmitOrder(
    submitOrder: SubmitOrder,
  ): Promise<SubmitOrderParameters> {
    const orderDateDubaiTime = this.convertISO8061ToDubaiTime(
      submitOrder.orderDate,
      true,
    );
    const actionDateDubaiTime = this.convertISO8061ToDubaiTime(
      submitOrder.actionDate,
      true,
    );

    const dhlBusinessCode = process.env.DHL_BUSINESS_CODE ?? 'AE-9105338';

    const newInvoices = submitOrder.invoices.map((inv) => {
      return {
        ...inv,
        invoiceDate: this.convertISO8061ToDubaiTime(inv.invoiceDate, false),
        invoiceType: inv.invoiceType.toString(),
        paymentInstrumentType: inv.paymentInstrumentType.toString(),
        lineItems: inv.lineItems,
      };
    });

    const payload = {
      orderNumber: submitOrder.orderNumber,
      orderDate: orderDateDubaiTime,
      actionDate: actionDateDubaiTime,
      ecomBusinessCode: submitOrder.ecomBusinessCode ?? '',
      mode: submitOrder.mode,
      billTo: submitOrder.billTo ?? '',
      shipTo: submitOrder.shipTo ?? '',
      consigneeAddress:
        submitOrder.consigneeAddress ?? ({} as ConsigneeAddress),
      billToAddress: submitOrder.billToAddress ?? ({} as Address),
      shipToAddress: submitOrder.shipToAddress ?? ({} as Address),
      documents: submitOrder.documents ?? [],
      invoices: newInvoices,
      referenceID: submitOrder.referenceId ?? '',
      uuid: uuidv4(),
      consigneeName: submitOrder.consigneeName ?? '',
      consigneeCode: '',
      jwt: this.getJwtOrOrgCode(submitOrder),
      eCommBusinessName: '',
      kvps: submitOrder.__kvp ? submitOrder.__kvp : [],
      uuid20: this.generateUUID20(),
    };

    const { jwt, uuid20, uuid, ...rest } = payload
      , _logisticsSPBusinessCode = submitOrder.invoices[0]?.logisticsSPBusinessCode ?? ''
      // conditionally set the vaultKey
      , _vaultKey = submitOrder.mode === "F" && _logisticsSPBusinessCode && _logisticsSPBusinessCode === dhlBusinessCode ?
        (this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '') :
        submitOrder.ecomBusinessCode
      , footer = await this.generateFooter(
        rest,
        this.getJwtOrOrgCode(submitOrder),
        _vaultKey,
        submitOrder.orderNumber,
        submitOrder.ecomBusinessCode,
      );

    this.logger.debug(`transformSubmitOrder payload - ${JSON.stringify(payload)}`);
    this.logger.debug(`generateFooter vaultKey - ${_vaultKey}`);

    return {
      ...payload,
      ...footer,
    };
  }

  async transformSubmitOrderForReturn(
    submitOrder: ReturnOrder,
  ): Promise<SubmitOrderParametersForReturn> {
    const actionDateDubaiTime = this.convertISO8061ToDubaiTime(
      submitOrder.actionDate,
      true,
    );

    const newInvoices: InvoiceForSubmitOrderParametersForReturn[] =
      submitOrder.invoices.map((inv) => {
        const { returnDetail, ...restOfInvoice } = inv;

        return {
          ...restOfInvoice,
          returnDetail: inv.returnDetail,
        };
      });

    const payload = {
      orderNumber: submitOrder.orderNumber,
      orderDate: '',
      actionDate: actionDateDubaiTime,
      ecomBusinessCode: submitOrder.ecomBusinessCode ?? '',
      mode: submitOrder.mode,
      billTo: '',
      shipTo: '',
      consigneeAddress: {},
      billToAddress: {},
      shipToAddress: {},
      documents: [],
      invoices: newInvoices,
      referenceID: '',
      uuid: uuidv4(),
      consigneeName: '',
      consigneeCode: '',
      jwt: submitOrder.invoices[0]?.exporterCode ?? '',
      eCommBusinessName: '',
      kvps: [],
      uuid20: this.generateUUID20(),
    };

    const { jwt, uuid20, uuid, orderDate, ...rest } = payload;
    const footer = await this.generateFooter(
      rest,
      jwt,
      submitOrder.ecomBusinessCode,
      submitOrder.orderNumber,
      submitOrder.ecomBusinessCode,
    );
    return {
      ...payload,
      ...footer,
    };
  }

  async transformUpdateTransportInfo(orderAggregate: {
    order: Order;
    pickupFile: CheckPointFile;
    direction: Direction;
    movementData: Movement;
  }): Promise<UpdateTransportInfoParameters> {
    const movement = orderAggregate.movementData;
    const returnDetail = orderAggregate.order.invoices[0]?.returnDetail;
    const newInvoices = orderAggregate.order.invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
    }));
    const jwtAndOrgCodeValue =
      orderAggregate.order.invoices[0]?.deliveryProviderBusinessCode ?? '';
    const businessAccount =
      EcomBusinessCodeLookup[orderAggregate.order.ecomBusinessCode];

    const dateOfDeparture = movement.shippingDetails.dateOfDeparture
      , _dateOfDeparture = DateStrFormat(dateOfDeparture);
    this.logger.debug(`Today - ${new Date()}`);
    this.logger.debug(`DateOfDeparture modified, pre - ${dateOfDeparture}, post - ${_dateOfDeparture}`);

    const payload = {
      orderNumber: orderAggregate.order.orderNumber,
      shippingParameterId: '',
      ecomOrgCode: orderAggregate.order.ecomBusinessCode ?? '',
      invoices: newInvoices,
      direction: orderAggregate.direction,
      returnRequestNo: returnDetail?.returnRequestNo ?? '',
      oldTransportDocNo: '',
      mode: orderAggregate.order.mode,
      autoInitiateDeclaration:
        orderAggregate.order.mode === ModeType.Update ? YesNo.No : YesNo.Yes, //TBD
      shippingDetail: {
        shippingAgentBusinessCode: jwtAndOrgCodeValue,
        modeOfTransport: '8',
        carrierNumber: movement.movementNumber, //movement number
        carrierRegistrationNo: movement.movementNumber, //movement number
        dateOfDeparture:
          DateConverterSlashesToDashes(
            _dateOfDeparture,
          ) ?? '', //outbound
        portOfLoad: this.checkWhichShipmentValueToUse(
          movement.shippingDetails.portOfLoad,
        ),
        portOfDischarge: movement.shippingDetails.portOfDischarge,
        originalLoadPort: this.checkWhichShipmentValueToUse(
          movement.shippingDetails.originalLoadPort,
        ),
        destinationCountry: findCountryCode(
          movement.shippingDetails.destinationCountry,
        ),
        pointOfExit: 'AFZ',
        cargoHandlerCode: businessAccount?.cargoHandlerPremiseCode ?? '',
        LMDBusinessCode: jwtAndOrgCodeValue,
      },
      transportDocumentDetails: {
        masterTransportDocNo: movement.mawb,
        transportDocNo: movement.airwayBillNumber,
        cargoType: '1',
        grossWeight:
          Math.floor(movement.packageDetails.grossWeight * 10000) / 10000, //floor down to 4 Decimal places
        grossWeightUOM: movement.packageDetails.grossWeightUOM,
        netWeight:
          Math.floor(movement.packageDetails.netWeight * 10000) / 10000, //floor down to 4 Decimal places
        netWeightUOM: movement.packageDetails.netWeightUOM,
      },
      packageDetails: [
        {
          packageType: movement.packageDetails.packageType || 'BOX',
          numberOfPackages: Number(movement.packageDetails.numberOfPackages),
          marksAndNumber: '', //Where to retrieve from
          container: [],
        },
      ],
      documents: orderAggregate.order.documents ?? [],
      uuid: uuidv4(),
      jwt: jwtAndOrgCodeValue,
      transportProviderCode: jwtAndOrgCodeValue,
      uuid20: this.generateUUID20(),
      referenceID: movement.referenceID,
      kvp: [],
    };

    const { uuid20, uuid, jwt, ...rest } = payload;

    const footer = await this.generateFooter(
      rest,
      jwtAndOrgCodeValue,
      this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '',
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );

    return {
      ...payload,
      ...footer,
    };
  }

  async transformUpdateTransportInfoReturn(
    orderAggregate: {
      order: Order;
      pickupFile: CheckPointFile;
      direction: Direction;
      movementData: Movement;
    },
    returnRequest: ReturnRequest,
  ): Promise<UpdateTransportInfoParameters> {
    const newInvoices = returnRequest.request.invoices.map((inv) => {
      return {
        invoiceNumber: inv.invoiceNumber,
        //        invoiceDate: new Date(),
        //        shippingParameterID: '',
      };
    });

    if (!returnRequest.movementData)
      throw new Error('Movementdata not defined');

    const jwtAndOrgCodeValue =
      orderAggregate.order.invoices[0]?.deliveryProviderBusinessCode ?? '';
    const businessAccount =
      EcomBusinessCodeLookup[returnRequest.request.ecomBusinessCode];


    const dateOfArrival = returnRequest.movementData.shippingDetails.dateOfArrival
      , _dateOfArrival = DateStrFormat(dateOfArrival);
    this.logger.debug(`Today - ${new Date()}`);
    this.logger.debug(`DateOfArrival modified, pre - ${dateOfArrival}, post - ${_dateOfArrival}`);

    const payload = {
      orderNumber: returnRequest.request.orderNumber,
      shippingParameterId: '',
      ecomOrgCode: returnRequest.request.ecomBusinessCode,
      //      referenceID: '',
      invoices: newInvoices,
      direction: Direction.Return,
      returnRequestNo: returnRequest.returns[0]?.returnRequestNo,
      oldTransportDocNo: returnRequest.returns[0]?.returnRequestNo ? "" : orderAggregate.pickupFile.hawb,
      mode: 'F',
      autoInitiateDeclaration: YesNo.Yes, //TBD
      shippingDetail: {
        shippingAgentBusinessCode: jwtAndOrgCodeValue, //JWT token from business
        modeOfTransport: '8',
        dateOfArrival: DateConverterSlashesToDashes(
          _dateOfArrival
        ),
        portOfLoad: returnRequest.movementData.shippingDetails.portOfLoad,
        portOfDischarge: this.checkWhichShipmentValueToUse(
          returnRequest.movementData.shippingDetails.portOfDischarge,
        ),
        portOfExit: 'AFZ',
        originalLoadPort:
          returnRequest.movementData.shippingDetails.originalLoadPort,
        cargoHandlerCode: businessAccount?.cargoHandlerPremiseCode ?? '',
        carrierNumber: returnRequest.movementData.movementNumber,
        carrierRegistrationNo: returnRequest.movementData.movementNumber,
        destinationCountry: findCountryCode(
          returnRequest.movementData.shippingDetails.destinationCountry,
        ),
        LMDBusinessCode: jwtAndOrgCodeValue,
      },
      transportDocumentDetails: {
        masterTransportDocNo: returnRequest.movementData.mawb,
        transportDocNo: returnRequest.movementData.airwayBillNumber,
        cargoType: '1',
        grossWeight:
          Math.floor(
            returnRequest.movementData.packageDetails.grossWeight * 10000,
          ) / 10000, //floor down to 4 Decimal places
        grossWeightUOM:
          returnRequest.movementData.packageDetails.grossWeightUOM,
        netWeight:
          Math.floor(
            returnRequest.movementData.packageDetails.netWeight * 10000,
          ) / 10000, //floor down to 4 Decimal places
        netWeightUOM: returnRequest.movementData.packageDetails.netWeightUOM,
      },
      packageDetails: [
        {
          packageType: returnRequest.movementData.packageDetails.packageType || 'BOX',
          numberOfPackages: Number(
            returnRequest.movementData.packageDetails.numberOfPackages,
          ),
          marksAndNumber: '',
          container: [],
        },
      ],
      documents: [],
      uuid: uuidv4(),
      transportProviderCode: jwtAndOrgCodeValue,
      jwt: jwtAndOrgCodeValue,
      uuid20: this.generateUUID20(),
      referenceID: returnRequest.movementData.referenceID,
      kvp: [],
    };
    const { jwt, uuid20, uuid, ...rest } = payload;
    const footer = await this.generateFooter(
      rest,
      jwtAndOrgCodeValue,
      this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '',
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );

    return {
      ...payload,
      ...footer,
    };
  }

  async transformInitiateDeclaration(
    orderAggregate: {
      order: Order;
      direction: Direction;
    },
    invoiceId: string,
  ): Promise<any> {   //InitiateDeclarationParameters
    const invoice = orderAggregate.order?.invoices?.find(
      (i) => i.invoiceNumber === invoiceId,
    );
    if (!invoice) {
      throw Error(`Invoice with id: ${invoiceId} not found`);
    }

    const returnDetail = invoice?.returnDetail;
    const exporterCd = invoice?.exporterCode ?? '';
    const lookUpData = findPaymentModeAndAccountNo(exporterCd);
    const businessAccount =
      EcomBusinessCodeLookup[orderAggregate.order.ecomBusinessCode];

    const payload = {
      uuid: uuidv4(),
      orderNumber: orderAggregate.order.orderNumber,
      ecomOrgCode: orderAggregate.order.ecomBusinessCode ?? '',
      invoiceNumber: invoice.invoiceNumber,
      shippingParameterID: '',
      direction: orderAggregate.direction,
      returnRequestNo: returnDetail?.returnRequestNo ?? '',
      paymentDetails: [
        {
          paymentMode: lookUpData?.paymentMode ?? '',
          declarationChargesAccount: lookUpData?.accountNo ?? '',
        },
      ],
      tradeType: '1',
      declarationType: 0,
      brokerCustomerCode: businessAccount?.brokerCustomerCode ?? 0,
      prevDeclarationReference: 0,
      prevDeclarationInvoiceNo: '',
      prevDeclarationItemLineNo: '',
      declarationDocuments: [
        {
          documentCode: '',
          availabilityStatus: '',
          nonAvailabilityReason: '',
          isDepositCollected: '',
        },
      ],
      invoiceItemLineNo: 0,
      declarantReferenceNo: '',
      kvp: [],
      jwt: invoice.brokerBusinessCode ?? '',
      uuid20: this.generateUUID20(),
    };

    const { uuid20, jwt, uuid, ...rest } = payload;

    const footer = await this.generateFooter(
      rest,
      invoice.brokerBusinessCode ?? '',
      this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '',
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );

    return {
      ...payload,
      ...footer,
    };
  }

  async transformReturnDeliverOrder(
    orderAggregate: { order: Order },
    returnRequest: ReturnRequest,
  ): Promise<DeliverOrderParameters> {
    if (
      !returnRequest.pickupFile ||
      !returnRequest.deliveredDate ||
      !returnRequest.deliveredTime
    )
      throw Error(`pickup not defined`);

    const businessAccount =
      EcomBusinessCodeLookup[orderAggregate.order.ecomBusinessCode];

    const jwtAndOrgCodeValue =
      orderAggregate.order.invoices[0]?.deliveryProviderBusinessCode ?? '';
    const payload = {
      orderNumber: returnRequest.request.orderNumber,
      invoiceNumber: returnRequest.request.invoices[0]?.invoiceNumber ?? '',
      transportDocNo: returnRequest.pickupFile.hawb,
      direction: Direction.Return,
      deliveryDate: this.convertISO8061ToDubaiTime(
        returnRequest.deliveredDate,
        false,
      ),
      deliverToPersonName: businessAccount?.businessName ?? '',
      deliveryStatus: returnRequest.deliveredDate ? '1' : '2',
      deliveryType: '1',
      ecomOrgCode: orderAggregate.order.ecomBusinessCode,
      jwt: jwtAndOrgCodeValue,
      signature: {} as DeliverySignature,
      returnToFZorCW: '',
      documents: orderAggregate.order.documents ?? [],
      uuid: uuidv4(),
      signaturePODFilePath: '',
      signaturePODHash: '',
      transportProviderCode: jwtAndOrgCodeValue,
    };

    const { uuid, jwt, ...rest } = payload;
    const footer = await this.generateFooter(
      rest,
      jwtAndOrgCodeValue,
      orderAggregate.order.ecomBusinessCode,
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );

    return {
      ...payload,
      epochTimeStamp: footer.epochTimeStamp,
      footerSignature: footer.signature,
      stringifiedPayload: footer.stringifiedPayload,
      orgCode: footer.orgCode,
    };
  }

  async transformDeliverOrder(orderAggregate: {
    order: Order;
    delivered: DeliveredView[];
    direction: Direction;
    pickupFile: CheckPointFile;
  }): Promise<DeliverOrderParameters> {
    const delivered = orderAggregate.delivered.find(
      (x) => x.airwayBillNumber === orderAggregate.pickupFile.hawb,
    );
    const jwtAndOrgCodeValue =
      orderAggregate.order.invoices[0]?.deliveryProviderBusinessCode ?? '';
    const payload = {
      orderNumber: orderAggregate.order.orderNumber,
      invoiceNumber: orderAggregate.order.invoices[0]?.invoiceNumber ?? '',
      transportDocNo: orderAggregate.pickupFile.hawb ?? '',
      direction: orderAggregate.direction,
      deliveryDate: delivered?.deliveryDate
        ? this.convertISO8061ToDubaiTime(
          delivered.deliveryDate.toString(),
          false,
        )
        : '2023-06-27',
      deliverToPersonName: orderAggregate.order.shipTo ?? '',
      deliveryStatus: delivered?.deliveryCode
        ? delivered.deliveryCode === 'OK'
          ? '1'
          : '2'
        : '2',
      deliveryType: '1',
      ecomOrgCode: orderAggregate.order.ecomBusinessCode,
      jwt: jwtAndOrgCodeValue,
      signature: {} as DeliverySignature,
      returnToFZorCW: orderAggregate.direction === '2' ? 'Y' : 'N',
      documents: orderAggregate.order.documents ?? [],
      signaturePODFilePath: '',
      signaturePODHash: '',
      uuid: uuidv4(),
      transportProviderCode: jwtAndOrgCodeValue,
      returnRequestNo: '',
      kvp: []
    };

    const { uuid, jwt, ...rest } = payload;

    const footer = await this.generateFooter(
      rest,
      jwtAndOrgCodeValue,
      this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '',
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );
    return {
      ...payload,
      epochTimeStamp: footer.epochTimeStamp,
      footerSignature: footer.signature,
      stringifiedPayload: footer.stringifiedPayload,
      orgCode: footer.orgCode,
    };
  }

  async transformConfirmReturnDelivery(
    orderAggregate: {
      order: Order;
    },
    confirmReturnDelivery: ConfirmReturnDelivery,
  ): Promise<ConfirmReturnDeliveryParameters> {
    const jwtAndOrgCodeValue =
      orderAggregate.order.invoices[0]?.logisticsSPBusinessCode ?? '';

    let result;

    if (confirmReturnDelivery.gatePasses) {
      result = confirmReturnDelivery.gatePasses?.map((data) => {
        return {
          gatePassNumber: data.gatePassNumber,
          gatePassDirection: data.gatePassDirection,
          actualMovingInDate: data.ActualMovingInDate,
        };
      });
    }

    const payload = {
      orderNumber: orderAggregate.order.orderNumber,
      invoiceNumber: confirmReturnDelivery.invoiceNumber,
      transportDocNo: confirmReturnDelivery.transportDocNo ?? '',
      returnRequestNo: confirmReturnDelivery.returnRequestNo,
      gatePasses: result,
      dateOfReceivingBackGoods: confirmReturnDelivery.dateOfReceivingBackGoods,
      lineItems: confirmReturnDelivery.lineItems,
      ecomOrgCode: orderAggregate.order.ecomBusinessCode,
      uuid: uuidv4(),
      jwt: jwtAndOrgCodeValue,
      uuid20: this.generateUUID20(),
      kvp: confirmReturnDelivery.kvp ? confirmReturnDelivery.kvp : [],
      transportProviderCode: confirmReturnDelivery.transportProviderCode ?? '',
    };
    const { kvp, uuid20, uuid, jwt, ...rest } = payload;
    const footer = await this.generateFooter(
      rest,
      jwtAndOrgCodeValue,
      this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '',
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );
    return {
      ...payload,
      ...footer,
    };
  }

  async transformUpdateExitConfirmation(
    orderAggregate: {
      order: Order;
      movementData: Movement;
      pickupFile: CheckPointFile;
    },
    declarationNumber: string,
  ): Promise<UpdateExitConfirmationParameters> {
    const order = orderAggregate.order;
    const orderInvoice = order.invoices[0];
    const jwtAndOrgCodeValue = orderInvoice?.deliveryProviderBusinessCode ?? '';
    const movement = orderAggregate.movementData.shippingDetails;
    const exporterCd = orderInvoice?.exporterCode ?? '';

    // Options 3 is applicable based on given logic
    const mapping = businessCodeAccountNoMapping[3];
    this.logger.debug(`exit confirmation data transformer`);
    this.logger.debug(
      `date: ${movement.dateOfDeparture}, time: ${movement.timeOfDeparture}, offset: ${movement.movementGMT}`,
    );
    const actualDepartureDate = DateTimeOffsetToDubaiTime(
      movement.dateOfDeparture,
      movement.timeOfDeparture,
      movement.movementGMT,
    );
    this.logger.debug(`stringified: ${actualDepartureDate}`);

    const payload = {
      uuid: uuidv4(),
      transportDocNo: orderAggregate.pickupFile.hawb,
      referenceID: uuidv4(),
      transportProviderCode: jwtAndOrgCodeValue,
      exitData: [
        {
          declarationNo: declarationNumber,
          actualDepartureDate:
            actualDepartureDate && actualDepartureDate !== 'Invalid Date'
              ? actualDepartureDate
              : '10/10/2021 06:16:14',
          carrierNumber: movement.carrierNumber || orderAggregate.movementData.movementNumber,
          claimSubmissionParty: "1",
          claimSubmissionPartyBusinessCode: orderAggregate.movementData.broker,
          pointOfExit: "AFZ",
          debitCreditAccountNo:
            exporterCd == mapping.businessCode ? mapping.accountNo : '',
        },
      ],
      kvp: order.__kvp ?? [],
      actualMasterTransportDocNo: orderAggregate.movementData.mawb,
      actualTransportDocNo: orderAggregate.pickupFile.hawb,
      jwt: jwtAndOrgCodeValue,
      uuid16: uuidv4(),
    };

    const { jwt, uuid16, uuid, ...rest } = payload;
    const footer = await this.generateFooter(
      rest,
      jwtAndOrgCodeValue,
      this.configService.get('HASHICORP_DHL_CODE_LOOKUP') ?? '',
      orderAggregate.order.orderNumber,
      orderAggregate.order.ecomBusinessCode,
    );
    return {
      ...payload,
      ...footer,
    };
  }

  private checkWhichShipmentValueToUse(shipmentValue: string): string {
    const DO4Values = ['ZJF', 'AUH', 'DXH', 'DXB', 'SHJ', 'RAK', 'D04'];
    if (DO4Values.includes(shipmentValue)) {
      return 'D04';
    } else {
      return findCountryCode(shipmentValue);
    }
  }

  private convertISO8061ToDubaiTime(
    date: string | undefined,
    includeTime: boolean,
  ): string {
    if (!date) return '';
    const dateTime = new Date(date)
      .toLocaleString('en-US', { timeZone: 'Asia/Dubai', hour12: false })
      .split(', ');

    if (!dateTime || !dateTime[0] || !dateTime[1]) return '';

    const monthDayYear = dateTime[0].split('/');
    const hourMinSec = dateTime[1]?.split(':');

    if (includeTime)
      return `${monthDayYear[1].padStart(2, '0')}/${monthDayYear[0].padStart(
        2,
        '0',
      )}/${monthDayYear[2].padStart(2, '0')} ${hourMinSec[0].padStart(
        2,
        '0',
      )}:${hourMinSec[1].padStart(2, '0')}:${hourMinSec[2].padStart(2, '0')}`;
    // MM-DD-YYYY HH:MM:SS
    else
      return `${monthDayYear[2].padStart(2, '0')}-${monthDayYear[0].padStart(
        2,
        '0',
      )}-${monthDayYear[1].padStart(2, '0')}`; // YYYY-MM-DD
  }

  public getUtcTimeStamp(inputDate?: string): string {
    let date = new Date();
    if (inputDate) date = new Date(inputDate);
    return date.getTime().toString();
  }

  private async generateFooter(
    payload: any,
    orgCode: string,
    vaultKey: string,
    orderNumber: string,
    ecomBusinessCode: string,
  ) {
    const signature = await this.getSignature(
      JSON.stringify(payload),
      vaultKey,
      orderNumber,
      ecomBusinessCode,
    );
    return {
      epochTimeStamp: this.getUtcTimeStamp(),
      signature,
      stringifiedPayload: {
        ...payload,
      },
      orgCode,
    };
  }

  private async getSignature(
    payload: string,
    vaultCode: string,
    orderNumber: string,
    ecomBusinessCode: string,
  ): Promise<string> {
    const sharedKeyLookup =
      this.configService.get('HASHICORP_SHARED_KEY_LOOKUP') ?? 'shared';
    await this.secretsService.fetchSecretsFromHashiCorpVault();
    let secrets = this.secretsService.getSecretsFromMemory();
    // this.logger.log(
    //   `Vault secrets...: ${JSON.stringify(secrets)}`
    // );

    let sharedSecret = secrets[sharedKeyLookup];
    let privateKey = secrets[vaultCode];
    //    let privateKey:any;
    //
    //   if (vaultCode == 'dhl') {
    //  privateKey = `-----BEGIN RSA PRIVATE KEY-----
    //MIIEpAIBAAKCAQEAydFSliAjb99A6AE5DjIiZaZu9AuRYvS3L37Boznr6ryt/Au5
    //Nal7eTtF8TEnQHg14M2pggTqs/SKjkF7KEdvO35uKo0VafpAhdXQgcF2rAKUy/SD
    //HGahxUWRicMUxO3z3TF2ZpHvxGzIHQp1fxFbULvAEWIkCmpldGfyrsIbV0gv3Cty
    //UUn+ANygMtvevZNAl8XJ2I3DcmiAnoopZFfmq2DbUXC5r8DUkodGPJx5gQQ00sb8
    //in8OThS0Xo6ikL7HuUKarzlZf7FzNbULQQV6jBro8K7PNWfZ3ZhY8t/tAMFm7GR7
    //uMydRAGkcDqxFo7TYty0Bk/3f7tLSpP9unDcBQIDAQABAoIBAEo/n4Gp2z+6RBfW
    //81W8rhj1rVZNtzRP0eFAYh8aHShkOCJFceNDMjD81JOSwN0gHLpTD6zNAEgqjJsf
    //jh7YgRzDO+adtyYhMoHKkwZZ1b4cyP9sOpxFSfjYyl2Dju2QmapkGypLQInkd47v
    //nSCdkxnVqSj8EURftmmoIImY0hQ+zE5p2DArDV8WjPaGqevChVza9uJlVGL8kcsL
    //VD0T8LBUSdkcXIXtI/PvueDPi3AYOM/iJmy5hAqUcLLSkYjPKdivALiL2Sf/6Vip
    //E+lufgtO3noaYJ+t6juRrKqnaLPXWG/zZtScaZx6k3+cSHSiI3sNPDWcjfn03rcS
    //WmQdwvUCgYEA31xYM3kTF0AOCyeUuv5JN1IoDAPC+ZDtQhiFXDGq9vGffg5cseML
    //3sanQDtP/ic6QZGDHZlAGTG/zbtC4xaNYFdbSeEQIMkpkRRGTD1WBO5LDq8eJQFa
    //VKLtmcH1yAKKtfzYJRF6qjKEPhpXHKRixmhKcxMPaK3BdOKGhlKZEY8CgYEA508U
    //Dy6mQ2PO/ukzEVT107k86YIOzpd0zTz9aKJ8tsUoqSGA19ZJmL5HBAj986QSq76b
    //F0JdXl9FLxmVUuij2qtmYd9dtRFHQtxyIIgB/BRQwIT6P6/28swYwLzdJ8scXgUi
    //qgs1IY2bbSvVzC2uuEUWnrybKXLt3UmJeYDABysCgYEAqPkoNJB0s9MejKu95ZS3
    //eOVrLGOwHbLY+naodO2SI8z41pkw4NYdxcPNBVeZlXDBrpbRdRPZnPW433+6Ayet
    //fmO3yPU9iUAFdR68a7K/H23SVGKAUIhseLjlPLuyH0RlAXYtYiWOAbHDv2OX4TAv
    //FWASamnR72P7hVxVXsqfx9sCgYBtSDQu9BhDUH10e9LPxncaH7NCk1rRikb5zG3h
    //KJuJcl7CgXyw/KHq00MUCfeJS6QyliwJ8iXQt2wlU430DMuVPVNyvCg2qsIjOamF
    //6xwc77AzNOBShJ1Emt66+L/31AND/GMjOYZRouiizIoHHDInByUnu+4GyDDPUrXr
    //vMN83wKBgQDSsP0aiH/wyJpOK3dsxvGiW5Ib2C0Uo74/dtsW7PIg7+3+BT2JsiK9
    //e7mAR8RXlyg7iuqaVXj76fuNMgFyaLnHW4EVTQBEOiDpt7yGXL4gp06VOmu1GIWq
    //mxD5UNR18ILw3r1GkOhlzc2MOXAdAQgW4yYnZcpnhCd5aKX3vkTgsQ==
    //-----END RSA PRIVATE KEY-----`
    //} else if (vaultCode == 'AE-9105341') {
    //  privateKey = `-----BEGIN RSA PRIVATE KEY-----
    //MIIEpAIBAAKCAQEAuG/YDtz1MSP3DzUGRJ2SLijopbBSgfibv+fI1wn4lzPDiH1n
    //OtV7Hqa8OFvv3ywCdJQKWFZYn5BWhaGz72xqnHZGOa4iQPfjIs2CRxSTJsyd9sDF
    //96j5d2NlWvlQCI7AXGf4MxMiWVgOsymJIKKuB76S/z9X4QKoJLhaN7yompcIKGFg
    //degJG2KG6TQkxDh5Aw8BG0xY37SYPyxSdfnuufORvnVKSbkAjSWy5D3b4LNUNzBU
    //vfJYxEav4J3nFUAPEYi/Z0hZWxkC8pEPY8Rn7ZNNDpWoEGLUVNFBb79C0gdbNbis
    //vc7Vy7ZbvD6hty4dbHZoPyue/o0BrAR9+Lx44QIDAQABAoIBABFTECx1POLcyfw3
    //stsHIhAL766AnX9v5tFj6E2qthsd1aQgg23XV7VNXCi/Gg0QiTqCHWam1bRHTplG
    //0ywONwVzZq1MWhNYNZGzVCVxHVFrrvraqL3WtXgtcfvVp1rmbdNAQOQrS/KwftD9
    //edAC9+3qTMyFGrAcG8c3OeI6amv60uS/VZVx/OZEDAN7IptaWApcvzWGXeO6fQ1N
    //CyPpGvb6MXKb48oZa9IW7cEFFtxz9nI2iZxxBbLTOs9BR44adhg0mnefYX4a59mC
    //6x/9AAC4slUG6KpiBJ65c4hbpAluVKJxcCpELvQoQ8Wgs/sBb8TPV5L2VX526TvD
    //8TrhWTECgYEAx30nrc9J16fdpzHLoUj/pSynS05V/qt8745NNwZcs3/0gDqCluvw
    //cmMe+ZEkCbf6vwKW3kemnc9k0LtpA9WLDp09GNgQdfgcMKsQyg0S09Hys73y6/5K
    //y01UkhSbgXd5MTRUoSdwc06Z6dGJsZXAoZr8w9H3K1ja3YnTM0fXcG8CgYEA7K8f
    //+/mj6ulqf0IBoKdt6m4+DzKyrPR+J8jnZ+ndfG3YyslsXPPF+vjXUrGhj47nXuM3
    //qT0hjoy2uJ33jptHCqgU+rgPwORiipGTCn/GXyO/voD9Ug6ny8jbPVYvDNQNfvlR
    //+M2UZSLR7UODd7YUCvHy47T8NZGNOdAjHH83s68CgYEAn4Qnl2d6/5Q+vLQnxVdu
    ///PBg8em5AAS2yYP7oHVY6Tv3EhY3WGFgCsfR+/QgYhkYy2ZRp3qZ8/TkA7jod2Vp
    //ZY08TsJvHzX/rLcNnNOpa3GlZi8MscLMoha6+ni6BGO5qCvVRGwaEkoW7w5b0YIS
    //3+bkGd2qjKHnmWDdXlMjJccCgYEAxS2oUb1J5/yJcndE79hMY89v+C1eWWRebTqc
    //Ph/BG1ZQE7D2jAGyYEFK8WN2myiMbKqSxnVdLWrhFrDTeoS2DJS21aDdzu71gUeB
    //3m9QjhY0ObswT1pSRB2TOGhCTkei7rM6rTJnfFIj3awvLF4OGIg0t6shqmcV5qIV
    //fjol55UCgYAD1hBy6KUaO9Kk+pz5awczeSaNX/u9L0egdjkPltbT9KIoAXmjlEBR
    //kQZrR+txf3ToAUaOBDiLWSW+LVvS+hWRr/iofgEPB2gCMwidb3GpYyO17HDahN38
    //tA0RvOjK4fIYeC6KFxuNSWhZ8wX04dKAUWfBMs8NSWlsvOpHlQXhmw==
    //-----END RSA PRIVATE KEY-----`
    //} else if (vaultCode == 'AE-9105340') {
    //  privateKey = `-----BEGIN RSA PRIVATE KEY-----
    //MIIEowIBAAKCAQEAwwY6H4/9D8z2o1bQwWwPieDKncfsLbVnvAiwY9N8Cc/QjLs7
    //figGSQzehiTrDuFj9mmqojH+hH2Q8y/FFRYtZSBd4a53Zi4clNTueR0D+zqF9z8W
    //0IH4ak8WBYoa0v9+OqsqAm2S+2Z+ewtqPDgQglE13vvF4CmQ127y7vshJNM304zL
    //a0aNY3UTaAczGxIO6O0WyF4qhe0IGo2d3YhD/N7GqkW10BGGPCb1qFa42rQ0I4Q/
    //1lbbM3yncW0wkKzIpbD8Tw7Cs9RF2uivnt+ohLq0JyXPi3c/vWqUp9iWedfoRYkZ
    //5IEla3Ij13upYY70vNJyV+QfbrbVTcC8HsyMmQIDAQABAoIBACKNSODspr4U5yF7
    //MRMDrSEVZXBcyjgy6oUC2RVmk5Q9cEpupZStTKfGkuobQlXpksdGY0fHKbuZb4PW
    //U8lvm21ONbPVMCw3QTMRIorsnBb3gGKUl9srG7Lh/hnPJP966odEafXyKddGimQM
    //Wq7+k9YywyOVYbJcSuAQNRQoA/A8+HGHE0GKV5pBriw9xyw1Ib6iFpZChtf5H1R3
    //ttFz99CDyrDO/nSDsbu0SSRbQbhWBi6TfLs/fpvHjYMER5oJ9bxcR5fT1uo18AHa
    //I3th2lEhoYV8gNkozBpcG8mavt1M4bEok4z658km8I/W8IxHLfusDrrLI6AJFy2i
    //sSvHpf0CgYEA5orwPHV5IAR4by434FrGVCumo3nPYGWXuoYxNjJaofHLes5cLU4T
    //Amq0BSyJBJLFvKDUchZCDT1O9dZy92bhbTCx15X8LmanK7AYzgDnaqsfTZPRxp5K
    //RDMIw719Je8FKSkLT+GRZKOSl2lwLeb3N5H68IhbIKit9I1yi6pGhC8CgYEA2I89
    //+h9IoO2hrw2axgpvzRapZbIO4vD/LTjWp7bvQMz5hIJhzLD0CWBi2QKkAnjtjSul
    //9qfB3Od4CIzksNVFkxlon1RviiLehKRWdI5O5ah8MDPQxoDLlyyhC/HGj5AZKw7F
    //hJHi1op5twJwdDK+fmC0TzxYXrkN/QXZDV3GIbcCgYBV+jDXy1Otzh0AEbOC9zeJ
    //wnG1+8KMB7dLN6p4tNS6GouxM+6KctiCCTszxsUesIIP88bm+UgO2fNtmVlszLB7
    //YTKh3OycfWoQz+6gPRQQ4tqcuuj78qJtxr6ZCTz3/ajmDcmLM+teJeaQkyDj7YP6
    //9HUqaR/bES02y92RGqKLvwKBgBF67nvEDq6+v7BLntShfwjE7YOB7eWvoklaLyl2
    //gLVwViu2AoLtPaWMHC58IhT5AePFRC42uFVGcc/u337OmEEZafKCdEZoLiHyye+6
    //lO/Au9WAOTfsqYJYXd+C8o4gCYgKNzNOO0sp/k0ha0ZV2j6FO8ixjEiJE3H7CNwl
    //V5rdAoGBAK8J6GyQFbYZvPS5er/YyAjLnT8KDu4R1u62gSlx83IJ74DQGkVdeXlo
    //MSbiJV6c/iaxnFmuXlUqa+77ZfYR79GLE0UEjMTqVO03JWYtIRITWYFrf5nE0M91
    //ZQOQI0LxqYEBfO0vV5FJ5li6B6m8J15kegV4eImHG4Q8ENzhgL8q
    //-----END RSA PRIVATE KEY-----`
    //}



    //   let privateKey = `-----BEGIN PRIVATE KEY-----
    //MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDBjofj/0PzPaj
    //VtDBbA+J4Mqdx+wttWe8CLBj03wJz9CMuzt+KAZJDN6GJOsO4WP2aaqiMf6EfZDz
    //L8UVFi1lIF3hrndmLhyU1O55HQP7OoX3PxbQgfhqTxYFihrS/346qyoCbZL7Zn57
    //C2o8OBCCUTXe+8XgKZDXbvLu+yEk0zfTjMtrRo1jdRNoBzMbEg7o7RbIXiqF7Qga
    //jZ3diEP83saqRbXQEYY8JvWoVrjatDQjhD/WVtszfKdxbTCQrMilsPxPDsKz1EXa
    //6K+e36iEurQnJc+Ldz+9apSn2JZ51+hFiRnkgSVrciPXe6lhjvS80nJX5B9uttVN
    //wLwezIyZAgMBAAECggEAIo1I4OymvhTnIXsxEwOtIRVlcFzKODLqhQLZFWaTlD1w
    //Sm6llK1Mp8aS6htCVemSx0ZjR8cpu5lvg9ZTyW+bbU41s9UwLDdBMxEiiuycFveA
    //YpSX2ysbsuH+Gc8k/3rqh0Rp9fIp10aKZAxarv6T1jLDI5VhslxK4BA1FCgD8Dz4
    //cYcTQYpXmkGuLD3HLDUhvqIWlkKG1/kfVHe20XP30IPKsM7+dIOxu7RJJFtBuFYG
    //LpN8uz9+m8eNgwRHmgn1vFxHl9PW6jXwAdoje2HaUSGhhXyA2SjMGlwbyZq+3Uzh
    //sSiTjPrnySbwj9bwjEct+6wOussjoAkXLaKxK8el/QKBgQDmivA8dXkgBHhvLjfg
    //WsZUK6ajec9gZZe6hjE2Mlqh8ct6zlwtThMCarQFLIkEksW8oNRyFkINPU711nL3
    //ZuFtMLHXlfwuZqcrsBjOAOdqqx9Nk9HGnkpEMwjDvX0l7wUpKQtP4ZFko5KXaXAt
    //5vc3kfrwiFsgqK30jXKLqkaELwKBgQDYjz36H0ig7aGvDZrGCm/NFqllsg7i8P8t
    //ONantu9AzPmEgmHMsPQJYGLZAqQCeO2NK6X2p8Hc53gIjOSw1UWTGWifVG+KIt6E
    //pFZ0jk7lqHwwM9DGgMuXLKEL8caPkBkrDsWEkeLWinm3AnB0Mr5+YLRPPFheuQ39
    //BdkNXcYhtwKBgFX6MNfLU63OHQARs4L3N4nCcbX7wowHt0s3qni01Loai7Ez7opy
    //2IIJOzPGxR6wgg/zxub5SA7Z822ZWWzMsHthMqHc7Jx9ahDP7qA9FBDi2py66Pvy
    //om3GvpkJPPf9qOYNyYsz614l5pCTIOPtg/r0dSppH9sRLTbL3ZEaoou/AoGAEXru
    //e8QOrr6/sEue1KF/CMTtg4Ht5a+iSVovKXaAtXBWK7YCgu09pYwcLnwiFPkB48VE
    //Lja4VUZxz+7ffs6YQRlp8oJ0RmguIfLJ77qU78C71YA5N+ypglhd34LyjiAJiAo3
    //M047Syn+TSFrRlXaPoU7yLGMSIkTcfsI3CVXmt0CgYEArwnobJAVthm89Ll6v9jI
    //CMudPwoO7hHW7raBKXHzcgnvgNAaRV15eWgxJuIlXpz+JrGcWa5eVSpr7vtl9hHv
    //0YsTRQSMxOpU7TclZi0hEhNZgWt/mcTQz3VlA5AjQvGpgQF87S9XkUnmWLoHqbwn
    //XmR6BXh4iYcbhDwQ3OGAvyo=
    //-----END PRIVATE KEY-----`
    if (!privateKey)
      this.logger.error(`Private key not found for ${vaultCode}`);
    if (!sharedSecret) this.logger.error(`Shared secret not found`);

    if (!privateKey || !sharedSecret) {
      this.logger.warn(
        `Vault private key(s) not found. Refetching all private keys from HashiCorp Vault.`,
      );
      await this.secretsService.fetchSecretsFromHashiCorpVault();
      secrets = this.secretsService.getSecretsFromMemory();

      // this.logger.log(
      //   `Vault secrets: ${JSON.stringify(secrets)}`
      // )
      privateKey = secrets[vaultCode];
      sharedSecret = secrets[sharedKeyLookup];
      if (!privateKey || !sharedSecret) {
        this.logger.error(
          `Vault private key(s) still not found after refetch. Sending error to Bless.`,
        );
        await this.postErrorToBless(
          404,
          `Private key not found in HashiCorp Vault for private key identifier ${vaultCode}`,
          orderNumber,
          ecomBusinessCode,
        );
      } else {
        this.logger.log(
          `Missing private key(s) successfully refetched from HashiCorp Vault`,
        );
      }
    }

    // this.logger.log(`Entity's key: ${sharedKeyLookup}`);
    // this.logger.log(`Vault code: ${vaultCode}`);
    // console.log(`Vault privateKey:  ${JSON.stringify(privateKey,)} sharedSecret:  ${JSON.stringify(sharedSecret)}`)
    // console.log(`Vault payload : ${JSON.stringify(payload)}`)
    return this.generateSignature(privateKey, payload, sharedSecret);
  }

  private getJwtOrOrgCode(submitOrder: SubmitOrder): string {
    // returns 'exporterCode' in case the either/ or contion satisfies, default is 'logisticsSPBusinessCode'
    const _logisticsSPBusinessCode = submitOrder.invoices[0]?.logisticsSPBusinessCode ?? '';
    const customerBusinessCodes = process.env.CUSTOMER_BUSINESS_CODES ? process.env.CUSTOMER_BUSINESS_CODES.split(',') : ["AE-9105340", "AE-9105341"];
    const dhlBusinessCode = process.env.DHL_BUSINESS_CODE ?? 'AE-9105338';

    if (
      _logisticsSPBusinessCode &&
      (
        (customerBusinessCodes.includes(_logisticsSPBusinessCode)) ||
        (submitOrder.mode === ModeType.Basic && _logisticsSPBusinessCode === dhlBusinessCode)
      )
    ) {
      return submitOrder.invoices[0]?.exporterCode ?? '';
    }
    return _logisticsSPBusinessCode;
  }

  private generateUUID20(): string {
    return uuidv4().replace('-', '').slice(0, 20);
  }

  private generateSignature(
    privateKey: string,
    payload: string,
    sharedSecret: string,
  ): string {
    try {
      const hash = crypto
        .createHmac('sha512', sharedSecret)
        .update(payload)
        .digest();
      // console.log("hash created", JSON.stringify(hash));
      const signer = crypto.createSign('RSA-SHA512');
      // console.log("signer created", JSON.stringify(signer));
      signer.write(hash);
      // console.log("hash wirte", JSON.stringify(hash));
      signer.end();
      // console.log("signature started", JSON.stringify(privateKey));
      return signer.sign(
        {
          key: privateKey,
        },
        'hex',
      );
    } catch (error) {
      this.logger.error(
        'Creation of signature went wrong, defaulting to empty string. Error: ' +
        error,
      );
      return '';
    }
  }

  private async postErrorToBless(
    errorCode: number,
    errorMessage: string,
    orderNumber: string,
    ecomBusinessCode: string,
  ): Promise<void> {
    const errorMessagePayload: ErrorMessagePayloadModel = {
      id: uuidv4(),
      errorCode: errorCode.toString(),
      dateTime: Date.now().toString(),
      errorDesc: errorMessage,
      msgIdentifier: {
        orderNumber: orderNumber,
        ecomBusinessCode: ecomBusinessCode,
      },
    };
    await this.blessClientService.post(
      errorMessagePayload,
      'EXCEPTION',
      'BUSINESS',
    );
  }
}
