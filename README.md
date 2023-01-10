# generate-subtitles

Generate transcripts for audio and video content with a user friendly UI, powered by Open AI's Whisper with automatic translations powered by LibreTranslate. Live for free public use at https://freesubtitles.ai

## Installation:
Under the hood, `generate-subtitles` uses Whisper AI for creating transcripts and Libretranslate for generating the translations. Libretranslate is optional and not required to run the service.

You can find the installation instructions for Whisper here: https://github.com/openai/whisper#setup

Once Whisper is installed and working properly, you can start the web server.

Make sure you are running Node.js 14+

`nvm use 14`

You can install Node 14 with `nvm`:

```shell
# install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash

# setup nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install 14
nvm use 14
```

Currently the app uses `yt-dlp` as well, you can install it with:

```shell
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp #download yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp  # Make executable
```

Then:

```shell
git clone https://github.com/mayeaux/generate-subtitles
cd generate-subtitles
npm install
npm start
```

This should start the server at localhost:3000, at which point if you navigate to there with a browser you should be able to see and use the app.

## Using a GPU Cloud Provider
Note: Unless you have a GPU that can use CUDA, you will likely have to use your CPU to transcribe which is significantly less performant, hence why you may have to rent a GPU server from a cloud provider. The only GPU cloud provider that I've had a good experience with is VastAI which is what I use to run https://freesubtitles.ai , if you use this link I should receive a 2.5% of your purchase for the referral: http://vast.ai/?ref=52232

To setup the Vast server to run Whisper, you can use the following script: 
https://github.com/mayeaux/generate-subtitles/blob/master/docs/install.sh (Note, this script isn't perfect yet but has all the ingredients you need).

While creating the Vast server, you will have to open some ports, this is the configuration I use to achieve that:

Hit `EDIT IMAGE & CONFIG..`

<img src="https://user-images.githubusercontent.com/7200471/207619301-5cdbf85e-8b6e-479a-8562-0d7d01bea715.JPG" width="500" alt="Screen Shot 2022-12-14 at 3 15 48 PM" />


I select CUDA though it's not 100% necessary

<img src="https://user-images.githubusercontent.com/7200471/207619367-ce4779fc-8d21-4120-8f21-22bb179eb601.JPG" alt="Screen Shot 2022-12-14 at 3 15 58 PM" width="600" />

Then hit the `SELECT` button (the one that's to the right of the CUDA description and not the one next to cancel) and you can add this line to open the ports:
`-p 8081:8081 -p 8080:8080 -p 80:80 -p 443:443 -p 3000:3000 -p 5000:5000`

<img src="https://user-images.githubusercontent.com/7200471/207619664-4baeae12-9139-40bd-b4a3-2ac9bf4dffc3.JPG" alt="Screen Shot 2022-12-14 at 3 16 22 PM" width="600" />

Hit `SELECT & SAVE` and when you create an instance it should have the proper ports opened to be able to access the web app. Vast uses port forwarding so when your port 3000 is opened it will be accessed through another port but you should be able to figure that out from their interface.
