FROM node:20.18-alpine
WORKDIR /app
COPY . . 
RUN npm install
CMD ["npm", "run", "dev"]