FROM superiortech/opencv4nodejs

# add opencv installation
ENV NODE_PATH=/usr/lib/node_modules

# install dependencies
RUN apt-get update 
RUN apt-get install -y --no-install-recommends dumb-init curl git

# setup pnpm
RUN mkdir /opt/pnpm
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PATH:$PNPM_HOME 
RUN npm install --global pnpm

# Set the working directory
WORKDIR /usr/src

# expose ports
EXPOSE 443
EXPOSE 8080
EXPOSE 3000
EXPOSE 2100/udp

# install all dependencies
COPY package.json .
COPY pnpm-lock.yaml .

RUN pnpm install --ignore-scripts --reporter=silent
RUN rm -rf /usr/src/node_modules/@u4

# link source code
ADD . .

# pipe target argument to environment
ARG target
ENV target=${target}

# bless scripts
RUN chmod +x ./$target.sh

ENTRYPOINT ./$target.sh
