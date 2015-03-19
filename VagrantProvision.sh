#!/bin/bash
sudo su

echo deb http://ppa.launchpad.net/jon-severinsson/ffmpeg/ubuntu precise main >> /etc/apt/sources.list
echo deb-src http://ppa.launchpad.net/jon-severinsson/ffmpeg/ubuntu precise main  >> /etc/apt/sources.list

apt-get update

apt-get install -y build-essential
apt-get install -y libtool
#apt-get install -y libv4l-dev

apt-get install -y --force-yes ffmpeg
apt-get install -y firefox
apt-get install -y dvdauthor
apt-get install -y imagemagick
apt-get install -y genisoimage
apt-get install -y growisofs
apt-get install -y wmctrl
apt-get install -y dvbsnoop
apt-get install -y eyed3
apt-get install -y sox

apt-get install -y gnome-terminal

# Allow remote x-server through ssh
echo X11Forwarding yes >> /home/vagrant/.ssh/config
echo X11UseLocalhost yes >> /home/vagrant/.ssh/config
#echo X11DisplayOffset 10  >> /home/vagrant/.ssh/config

# Compile modified-mjpegtools
apt-get install -y libjpeg-dev
ln -s /vagrant/Cpp/include/videodev.h /usr/include/linux/videodev.h
cd /home/vagrant
mkdir src
cd src
cp /vagrant/Cpp/modified-mjpegtools-2.0.0_2.tar.gz .
tar -xzvf modified-mjpegtools-2.0.0_2.tar.gz
cd modified-mjpegtools-2.0.0
./configure
make install
ldconfig

# Set up Firefox Add-On
mkdir -p /home/vagrant/.mozilla/firefox
cd /home/vagrant/.mozilla/firefox
echo [General] > profiles.ini
echo StartWithLastProfile=1 >> profiles.ini
echo [Profile0] >> profiles.ini
echo Name=Word-DVD >> profiles.ini
echo IsRelative=1 >> profiles.ini
echo Path=Word-DVD >> profiles.ini
echo Default=1 >> profiles.ini
mkdir -p ./Word-DVD/extensions
echo /vagrant > ./Word-DVD/extensions/\{f597ab2a-3a14-11de-a792-e68e56d89593\}
echo firefox -P Word-DVD -jsconsole -purgecaches -no-remote > /home/vagrant/word-dvd.sh
chmod ug+x /home/vagrant/word-dvd.sh

# vagrant -X ssh
# word-dvd.sh
