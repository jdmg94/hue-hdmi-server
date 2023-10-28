FROM superiortech/opencv4nodejs

# install dependencies
RUN apt-get update 
RUN apt-get install -y --no-install-recommends dumb-init avahi-utils curl

# install pnpm
RUN npm i -g pnpm

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1
ENV OPENCV_INCLUDE_DIR=/usr/local/include/opencv4
ENV OPENCV_LIB_DIR=/usr/local/lib
ENV OPENCV_BIN_DIR=/usr/local/bin

COPY package*.json ./

RUN pnpm install
RUN rm -rf node_modules/@u4 && ln -s /usr/lib/node_modules/@u4 ./node_modules/

# install Signify CA certificate
ENV NODE_EXTRA_CA_CERTS=node_modules/hue-sync/signify.pem

# create unprivileged user
RUN useradd -r hue-hdmi-server

# Copy the rest of the application code
COPY --chown=hue-hdmi-server . .

# create a production build
ENV NODE_ENV=production
RUN pnpm run build

# switch to unprivileged user
USER hue-hdmi-server

EXPOSE 8080

ENTRYPOINT ["dumb-init", "node", "build/index.js"]

