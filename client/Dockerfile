# base image
FROM node:22.15.0-alpine

# set working directory
WORKDIR /usr/src/app

# add `/usr/src/app/node_modules/.bin` to $PATH
ENV PATH /usr/src/app/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package*.json /usr/src/app/
# COPY package-lock.json /usr/src/app/package-lock.json
RUN npm install

# start app
CMD ["npm", "run", "dev"]
