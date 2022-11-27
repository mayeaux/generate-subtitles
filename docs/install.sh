wget -qO - http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1804/x86_64/3bf863cc.pub | sudo apt-key add -
sudo apt-get update
sudo apt-get upgrade -y
sudo apt install ffmpeg -y
sudo apt install software-properties-common -y
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt-get upgrade -7
sudo apt-get install python3
alias python=python3
alias pip=pip3
apt-get install python3-pip -y
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install python3.9 -y
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.9 1000
pip3 install setuptools-rust
curl https://sh.rustup.rs -sSf | sh
sudo apt install python3.9-distutils
alias python=python3.9
python -m pip install --upgrade pip
pip install git+https://github.com/openai/whisper.git
whisper
sudo apt-get install nodejs npm -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install 16
nvm use 16
npm install -g http-server

pip3 install --upgrade setuptools

sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp  # Make executable


