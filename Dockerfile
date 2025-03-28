FROM node:22 AS builder

ARG VITE_API_URL

WORKDIR /usr/src/app

COPY ./ui/package*.json /usr/src/app/

RUN npm install

COPY ./ui/ /usr/src/app

RUN npm run build

FROM denoland/deno:2.2.4 AS runner

WORKDIR /app

COPY ./api/deno.json ./api/deno.lock /app/

RUN deno install

COPY ./api/ /app/
COPY --from=builder /usr/src/app/build/client /app/public

CMD ["task", "start"]
