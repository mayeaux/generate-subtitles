wget -qO - http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1804/x86_64/3bf863cc.pub | sudo apt-key add -
sudo apt-get update
sudo apt-get upgrade -y
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt install nodejs npm nginx ffmpeg software-properties-common python3 python3.9 python3-pip python3.9-distutils python3.9-dev pkg-config libicu-dev lsof nano -y
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.9 1000
pip3 install setuptools-rust
pip3 install --upgrade setuptools
curl https://sh.rustup.rs -sSf | sh -s -- -y
# setting alias this way doesn't work
alias pip=pip3
alias python=python3.9
python -m pip install --upgrade pip
pip3 install --upgrade setuptools
pip install git+https://github.com/openai/whisper.git

whisper
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash

# this is broken I believe
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install 16
nvm use 16
npm install -g http-server pm2


sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp  # Make executable
git clone https://github.com/mayeaux/generate-subtitles

export LIBRETRANSLATE='http://127.0.0.1:5000'
export CONCURRENT_AMOUNT='2'
export NODE_ENV='production'

pm2 start npm -- start

# for libretranslate
#sudo apt-get install python3.9-dev -y
#pip3 install --upgrade distlib
#apt-get install pkg-config libicu-dev
#pip3 install libretranslate
