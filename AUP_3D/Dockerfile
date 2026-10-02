# # # build env
# FROM node:21.7.1-alpine
# # WORKDIR /app
# # # COPY package*.json ./
# # # RUN npm install
# # COPY . ./
# # RUN npm run build
# # CMD cp -r build result_build
# RUN mkdir -p /app 
# WORKDIR /app
# COPY . .

FROM alpine:latest

# Устанавливаем bash (в Alpine по умолчанию стоит только sh)
RUN apk add --no-cache bash
WORKDIR /app

COPY . .

