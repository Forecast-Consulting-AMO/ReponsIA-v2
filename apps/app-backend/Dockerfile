FROM node:lts-alpine

RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

COPY dist/apps/app-backend/package*.json ./
RUN npm install --omit=dev

COPY dist/apps/app-backend/ .

RUN chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "main.js"]
