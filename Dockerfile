FROM superiortech/opencv4nodejs

# install dependencies
RUN apt-get update 
RUN apt-get install -y --no-install-recommends dumb-init curl git

# install pnpm
RUN npm i -g pnpm

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./

ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1
ENV OPENCV_INCLUDE_DIR=/usr/local/include/opencv4
ENV OPENCV_LIB_DIR=/usr/local/lib
ENV OPENCV_BIN_DIR=/usr/local/bin

RUN pnpm install --prod
RUN pnpm add -D @swc/cli @swc-node/core
RUN rm -rf node_modules/@u4 && ln -s /usr/lib/node_modules/@u4 ./node_modules/

# install Signify CA certificate
ENV NODE_EXTRA_CA_CERTS=node_modules/hue-sync/signify.pem

# Copy the rest of the application code
COPY . .

# create a production build
ENV NODE_ENV=production
RUN pnpm run build

EXPOSE 443
EXPOSE 8080
EXPOSE 2100/udp

ENTRYPOINT ["dumb-init", "node", "build/index.js"]

