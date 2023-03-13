#FROM debian
FROM docker.io/nvidia/cuda:11.4.1-cudnn8-devel-ubuntu20.04

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y install git ffmpeg python3-pip python3 curl

WORKDIR /workdir

# install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash

# setup nvm
RUN export NVM_DIR="$HOME/.nvm"; \
	[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"; \
	[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"; \
	nvm install 14; \
	nvm use 14; \
	curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
	chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /workdir/generate-subtitles

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

RUN export NVM_DIR="$HOME/.nvm"; \
	[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"; \
	[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"; \
	npm install

ENTRYPOINT export NVM_DIR="$HOME/.nvm"; \
	[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"; \
	[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"; \
	export CONCURRENT_AMOUNT=1; npm start
