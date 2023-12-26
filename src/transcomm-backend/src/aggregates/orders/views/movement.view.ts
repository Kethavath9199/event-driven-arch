import { Prisma } from '@prisma/client';
import { Movement } from 'core';
import { OrderAggregate } from '../order-aggregate';
import { Injectable, Logger } from '@nestjs/common';

export class MovementView {

  private logger = new Logger(this.constructor.name);

  HydrateMovements(
    aggregate: OrderAggregate,
  ): Prisma.MovementCreateWithoutOrderInput[] {
    if (!aggregate.movementData) {
      return [];
    }
    const movements: Movement[] = [
      aggregate.movementData,
      ...this.aggregateReturnMovements(aggregate),
    ];
     this.logger.log(
      `Hydrating views movements: ${JSON.stringify(movements)}`,
    );
    console.log(`Hydrating views movements console: ${JSON.stringify(movements)}`);

    return movements.map((movement) => {
      const { movementGMT, timeOfDeparture, ...shipping } =
        movement.shippingDetails;
      return {
        type: movement.type,
        mawb: movement.mawb,
        hawb: movement.hawb,
        transport: shipping?.modeOfTransport,
        flightNumber: movement.flightNumber,
        portOfLoad: shipping?.portOfLoad,
        pointOfExit: shipping?.pointOfExit,
        departureDate: shipping?.dateOfDeparture,
        broker: movement.broker,
        agent: movement.agent,
        cargoHandler: movement.cargoHandler,
        mode: movement.mode,
        airwayBillNumber: movement.airwayBillNumber,
        shippingParameterId: movement.shippingParameterId,
        referenceId: movement.referenceID,
        shippingDetails: {
          create: shipping,
        },
        packageDetails: {
          create: {
            packageType: movement.packageDetails?.packageType || 'BOX',
            numberOfPackages: movement.packageDetails?.numberOfPackages,
            containerNumber: movement.packageDetails?.containerNumber,
            cargoType: movement.packageDetails?.cargoType,
            netWeightAndUnit:
              movement.packageDetails?.netWeight +
              movement.packageDetails?.netWeightUOM,
            containerSize: movement.packageDetails?.containerSize,
            containerType: movement.packageDetails?.containerType,
            containerSealNumber: movement.packageDetails?.containerSealNumber,
            grossWeightAndUnit:
              movement.packageDetails?.grossWeight +
              movement.packageDetails?.grossWeightUOM,
            volumetricWeightAndUnit:
              movement.packageDetails?.volumetricWeight +
              movement.packageDetails?.volumetricWeightUOM,
          },
        },
      };
    });
  }

  private aggregateReturnMovements(aggregate: OrderAggregate): Movement[] {
    const movements: Movement[] = [];
    for (const returnRequest of aggregate.returns) {
      const { movementData } = returnRequest;
      if (movementData) movements.push(movementData);
    }
    return movements;
  }
}
