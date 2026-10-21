# Stage 1: Build React App
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve ด้วย Nginx
FROM nginx:alpine

# คัดลอกไฟล์ Nginx Config สำหรับ Proxy API
COPY nginx.conf /etc/nginx/conf.d/default.conf

# คัดลอกไฟล์ Build จาก Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]