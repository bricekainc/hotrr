FROM node:20-slim

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# IMPORTANT: Create empty json files so the script doesn't crash 
# if they are missing from your GitHub
RUN echo "{}" > catalog.json

EXPOSE 8000

# Start the bot
CMD [ "node", "api/index.js" ]
