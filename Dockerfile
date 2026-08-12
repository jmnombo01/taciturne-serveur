FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY *.mjs ./
ENV PORT=7860
EXPOSE 7860
CMD ["node", "server.mjs"]
