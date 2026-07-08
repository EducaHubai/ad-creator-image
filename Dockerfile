FROM node:22-alpine AS build
WORKDIR /app
ARG OPENAI_KEY_
ENV OPENAI_KEY_=$OPENAI_KEY_
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
