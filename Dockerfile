FROM node:14

WORKDIR /

COPY . .

CMD [ "node", "main.js" ]