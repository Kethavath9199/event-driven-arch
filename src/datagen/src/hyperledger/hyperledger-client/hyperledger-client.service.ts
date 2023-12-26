import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ApplicationErrorOptions,
  HyperledgerQueryResponse,
  HyperledgerResponse,
  StatusResponse,
  SubscribeResponse,
  SubscriptionCountResponse,
} from 'core';
import { catchError, lastValueFrom, map } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { BaseHyperledgerClient } from './base-hyperledger-client';
import { ApplicationException } from './application-exception';
import { ApplicationError } from './error.models';
import { HyperledgerClient } from './hyperledger-client.interface';
import {
  HyperledgerQueryResponseClass,
  HyperledgerResponseClass,
  StatusResponseClass,
  SubscribeResponseClass,
  SubscriptionCountResponseClass,
} from './response-classes';
const Redis = require("ioredis");
const rltValue = process.env.RLT_VALUE  //ratelimiter value (x Transactions per rltTime)
const rltTime = process.env.RLT_TIME    //ratelimiter time value (rltValue Transactions per x millisecond) in milli sec
const ratelimiterActive = process.env.RATELIMTER_ACTIVE  //true / false


@Injectable()
export class HyperledgerClientService
  extends BaseHyperledgerClient
  implements HyperledgerClient {
  private readonly logger = new Logger(this.constructor.name);
  private readonly redisClient: any

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super();
    this.redisClient = new Redis({
      host: this.configService.get<string>('QUEUE_HOST'),
      port: this.configService.get<number>('QUEUE_PORT'),
    })
    if (ratelimiterActive) {
      this.logger.log(`ratelimter is activated...with rate at ${rltValue} transactions per ${rltTime} milliseconds`)
      this.startReset();
    }
  }

  private channelName =
    this.configService.get('HYPERLEDGER_CHANNEL_NAME') ?? '';
  private chaincodeName =
    this.configService.get('HYPERLEDGER_CHAINCODE_NAME') ?? '';
  private submitOrderMethodParams: string[] = [
    this.configService.get('HYPERLEDGER_USER_ID') ?? 'DHL',
    this.configService.get('HYPERLEDGER_ORGANIZATION_TYPE') ?? 'COURIER',
    this.configService.get('HYPERLEDGER_ORGANIZATION_CODE') ?? 'DHL',
    uuidv4(),
  ];

  //mutations
  public invokeSubmitOrder(req: string): Promise<HyperledgerResponse> {
    const methodParams = this.submitOrderMethodParams;

    return this.invokeHyperledger('submitOrder', methodParams, req);
  }
  public invokeUpdateTransportInfo(req: string): Promise<HyperledgerResponse> {
    const methodParams = this.submitOrderMethodParams;
    return this.invokeHyperledger('updateTransportInfo', methodParams, req);
  }
  public invokeInitiateDeclaration(req: string): Promise<HyperledgerResponse> {
    const methodParams = this.submitOrderMethodParams;
    return this.invokeHyperledger('initiateDeclaration', methodParams, req);
  }
  public invokeDeliverOrder(req: string): Promise<HyperledgerResponse> {
    const methodParams = this.submitOrderMethodParams;
    return this.invokeHyperledger('deliverOrder', methodParams, req);
  }
  public invokeConfirmReturnDelivery(
    req: string,
  ): Promise<HyperledgerResponse> {
    const methodParams = this.submitOrderMethodParams;
    return this.invokeHyperledger('confirmReturnDelivery', methodParams, req);
  }

  public invokeUpdateExitConfirmation(
    req: string,
  ): Promise<HyperledgerResponse> {
    const methodParams = this.submitOrderMethodParams;
    return this.invokeHyperledger('updateExitConfirmation', methodParams, req);
  }

  public async ping(): Promise<StatusResponse> {
    const path = 'ping';
    const response = plainToInstance(
      StatusResponseClass,
      await this.getFromHyperledger<StatusResponse>(path),
    );
    this.checkForBadResponse(response, path);
    return response;
  }
  //Subscription stuff
  public async subscribeToEvents(
    callbackUrl: string,
    startBlock: number,
    eventCategory: string,
    eventName: string,
  ): Promise<SubscribeResponse> {
    this.logger.log('subscribeToEvents');
    const formBody = this.createSubscribeEventFormBody(
      this.channelName,
      this.chaincodeName,
      eventCategory,
      eventName,
      'full',
      startBlock,
      callbackUrl,
    );
    const path = 'event/subscribe';
    const response = plainToInstance(
      SubscribeResponseClass,
      await this.postToHyperledger<SubscribeResponse>(formBody, path),
    );
    this.checkForBadResponse(response, path);
    this.checkForErrorInSuccessfulResponse(response, path);
    return Promise.resolve(response);
  }

  public async unsubscribeToEvents(id: string): Promise<SubscribeResponse> {
    this.logger.log('unsubscribeFromEvent with id: ' + id);
    const formBody = this.createUnsubscribeEventFormBody(id);
    const path = 'event/unsubscribe';
    const response = plainToInstance(
      SubscribeResponseClass,
      await this.postToHyperledger<SubscribeResponse>(formBody, path),
    );
    this.checkForBadResponse(response, path);
    this.checkForErrorInSuccessfulResponse(response, path);
    return Promise.resolve(response);
  }

  public async getCurrentSubscriptions(): Promise<SubscriptionCountResponse> {
    this.logger.log('getCurrentSubscriptions');
    const path = 'event/subscribe/count';
    const response = plainToInstance(
      SubscriptionCountResponseClass,
      await this.getFromHyperledger<SubscriptionCountResponse>(path),
    );
    this.checkForBadResponse(response, path);
    this.checkForErrorInSuccessfulResponse(response, path);
    return Promise.resolve(response);
  }

  public async queryOrderData(
    methodName: string,
    key: string,
    collection: string,
  ): Promise<HyperledgerQueryResponse> {
    this.logger.log('queryOrderData');
    const methodParams = this.submitOrderMethodParams;
    methodParams[3] = uuidv4();

    const formBody = this.createSubmitOrQueryFormBody(
      this.channelName,
      this.chaincodeName,
      methodName,
      methodParams,
      `${key}|${collection}`,
    );
    this.logger.debug(`request: ${JSON.stringify(formBody)}`);
    const path = 'transaction/query';
    const response = plainToInstance(
      HyperledgerQueryResponseClass,
      await this.postToHyperledger<HyperledgerQueryResponse>(formBody, path),
    );

    this.checkForBadResponse(response, path);
    this.checkForErrorInSuccessfulResponse(response, path);
    return Promise.resolve(response);
  }

  private async invokeHyperledger(
    methodName: string,
    methodParams: string[],
    transientValue: string,
  ): Promise<HyperledgerResponse> {
    this.logger.log(`invokeHyperledger for method: ${methodName}`);
    const formBody = this.createSubmitOrQueryFormBody(
      this.channelName,
      this.chaincodeName,
      methodName,
      methodParams,
      transientValue,
    );

    this.logger.debug(`request: ${JSON.stringify(formBody)}`);
    const path = 'transaction/submit';
    const response = plainToInstance(
      HyperledgerResponseClass,
      await this.postToHyperledger<HyperledgerResponse>(formBody, path),
    );

    this.checkForBadResponse(response, path);
    this.checkForErrorInSuccessfulResponse(response, path);
    return Promise.resolve(response);
  }

  private async getFromHyperledger<T>(route: string): Promise<T> {
    // const request = this.httpService.get<T>(`/${route}`).pipe(
    //   map((response) => response.data),
    //   catchError(this.handleError()),
    // );
    // return lastValueFrom(request);
    return await this.performHyperledgerOperation('QUERY', null, route);
  }

  private async postToHyperledger<T>(
    formBody: string,
    path: string,
  ): Promise<T> {
    // const request = this.httpService.post<T>(`/${path}`, formBody).pipe(
    //   map((response) => response.data),
    //   catchError(this.handleError()),
    // );
    // return lastValueFrom(request);
    return await this.performHyperledgerOperation('INVOKE', formBody, path);
  }

  private async performHyperledgerOperation<T>(operationType, formBody, pathOrRoute) {
    await this.redisClient.watch(['bucketTokens']);
    let result = await this.redisClient.decr('bucketTokens');
    // this.logger.debug(`bucketTokens after deducting is : ${result}`)
    // let result = await this.redisClient.get('bucketTokens').then(async (res) => {
    //   this.logger.log(`Values are bucketTokens: ${res}`);
    //   return res;
    // })
    if (result && Number(result) >= 0) {
      let request;
      if (operationType == 'INVOKE') {
        // this.logger.debug(`HyperLedger Request Called... bucketTokens : ${result}, type : ${operationType} timestamp: ${Date.now()}`);
        request = await this.httpService.post<T>(`/${pathOrRoute}`, formBody).pipe(
          map((response) => {
            return response.data;
          }),
          catchError(this.handleError()),
        );

      } else if (operationType == 'QUERY') {
        // this.logger.debug(`HyperLedger Request Called... bucketTokens : ${result}, type : ${operationType} timestamp: ${Date.now()}`);
        request = this.httpService.get<T>(`/${pathOrRoute}`).pipe(
          map((response) => {
            return response.data;
          }),
          catchError(this.handleError()),
        );
      }
      return lastValueFrom(request);
    }
    else {
      await this.wait(1000);
      return this.performHyperledgerOperation(operationType, formBody, pathOrRoute);
    }
  }

  private startReset() {
    setInterval(async () => {
      await this.reset();
    }, Number(rltTime));
  }

  private async reset() {
    await this.redisClient.set('bucketTokens', Number(rltValue) ?? 3);
  }

  private wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private checkForBadResponse(
    response:
      | HyperledgerResponse
      | HyperledgerQueryResponse
      | SubscribeResponse
      | SubscriptionCountResponse
      | StatusResponse,
    path: string,
  ): never | void {
    const validationErrors = validateSync(response);
    if (validationErrors.length) {
      this.logger.error(
        `Validation error in bad response of path ${path}: ${validationErrors.toString()}`,
      );
      this.throwApplicationError(response, path, HttpStatus.NOT_ACCEPTABLE);
    }
  }
  private checkForErrorInSuccessfulResponse(
    response:
      | HyperledgerResponse
      | HyperledgerQueryResponse
      | SubscribeResponse
      | SubscriptionCountResponse,
    path: string,
  ): never | void {
    if (response.error && response.error.length) {
      this.logger.error(
        `Error in successful response of path ${path}: ${response.error}`,
      );
      this.throwApplicationError(response.error, path, HttpStatus.BAD_REQUEST);
    }
  }

  private throwApplicationError(
    error,
    path: string,
    status: HttpStatus,
  ): never {
    const errorOptions: ApplicationErrorOptions = {};
    errorOptions.path = `${this.configService.get('HYPERLEDGER_URL')}/${path}`;
    errorOptions.errorMessage = error;
    const applicationError = new ApplicationError(errorOptions);
    applicationError.addStatusRelatedErrors(status, 'HL');
    throw new ApplicationException(applicationError, status);
  }

  private handleError() {
    return (error: AxiosError): never => {
      let status = 0;
      const err = new ApplicationError();

      err.addBaseErrors(error);

      if (error.response) {
        //Validate response
        status = error.response.status;
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        status = HttpStatus.SERVICE_UNAVAILABLE;
      } else {
        // Something happened in setting up the request that triggered an Error
        this.logger.error('Error', error.message);
      }
      err.addStatusRelatedErrors(status, 'HL');
      throw new ApplicationException(err, status);
    };
  }
}
