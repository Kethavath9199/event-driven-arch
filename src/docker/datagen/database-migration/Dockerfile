FROM node:16-alpine AS node

FROM node AS migration

ARG DATABASE_URL
ENV DATABASE_URL $DATABASE_URL

RUN npm install -g prisma

WORKDIR /usr/src/datagen

COPY ./datagen/prisma ./prisma

CMD prisma migrate deploy

