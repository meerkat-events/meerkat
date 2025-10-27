FROM denoland/deno:2.5.4

WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY ./api/deno.json ./api/deno.lock ./api/package.json /app/

RUN deno install

COPY ./api/ /app/

ENV NODE_ENV=production

RUN	deno task typecheck && \
 		deno task build

CMD ["task", "start"]
