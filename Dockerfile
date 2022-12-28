FROM node:18-alpine

WORKDIR /app

COPY index.js package.json ./

CMD [ "node", "index.js" ]
