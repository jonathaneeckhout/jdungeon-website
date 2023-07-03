FROM node:14

WORKDIR /app

COPY package.json .

RUN npm install --quiet

COPY . .

CMD [ "node", "main.js" ]