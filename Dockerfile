FROM node:10.15-alpine as build

WORKDIR /usr/src/app

COPY ./package*.json ./
COPY ./preact.config.js ./
RUN npm i --only=production

COPY ./src .

#RUN sed -i '26i\if(typeof window !== "undefined")\' /usr/src/app/src/node_modules/socket.io/lib/index.js
RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /usr/src/app/build ./
EXPOSE 80
