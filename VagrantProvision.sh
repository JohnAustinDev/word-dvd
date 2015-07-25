#!/bin/bash

# This script builds word-dvd in Vagrant, with Firefox auto-start on login
apt-get update

apt-get install -y build-essential
apt-get install -y libtool

apt-get install -y dvdauthor
apt-get install -y imagemagick
apt-get install -y genisoimage
apt-get install -y growisofs
apt-get install -y wmctrl
apt-get install -y dvbsnoop
apt-get install -y eyed3
apt-get install -y sox

cd /home/vagrant
mkdir src

# Install a specific ffmpeg version (for stability)
ffmpeg_version=ffmpeg-2.7
sudo apt-get -y --force-yes install autoconf automake build-essential libass-dev libfreetype6-dev \
  libsdl1.2-dev libtheora-dev libtool libva-dev libvdpau-dev libvorbis-dev libxcb1-dev libxcb-shm0-dev \
  libxcb-xfixes0-dev pkg-config texi2html zlib1g-dev
sudo apt-get install -y yasm libx264-dev libmp3lame-dev
cd /home/vagrant/src
wget http://ffmpeg.org/releases/$ffmpeg_version.tar.bz2
tar xjvf $ffmpeg_version.tar.bz2
rm $ffmpeg_version.tar.bz2
cd $ffmpeg_version
PATH="/home/vagrant/bin:$PATH" PKG_CONFIG_PATH="/home/vagrant/ffmpeg_build/lib/pkgconfig" ./configure \
  --prefix="/home/vagrant/ffmpeg_build" \
  --pkg-config-flags="--static" \
  --extra-cflags="-I/home/vagrant/ffmpeg_build/include" \
  --extra-ldflags="-L/home/vagrant/ffmpeg_build/lib" \
  --bindir="/home/vagrant/bin" \
  --enable-gpl \
  --enable-libass \
  --enable-libfreetype \
  --enable-libmp3lame \
  --enable-libtheora \
  --enable-libvorbis \
  --enable-libx264 \
  --enable-nonfree
PATH="/home/vagrant/bin:$PATH" make
make install
make distclean
ln -s /home/vagrant/bin/ffmpeg /usr/bin/ffmpeg
ln -s /home/vagrant/bin/ffplay /usr/bin/ffplay
ln -s /home/vagrant/bin/ffprobe /usr/bin/ffprobe
ln -s /home/vagrant/bin/ffserver /usr/bin/ffserver
su - vagrant -c 'echo "MANPATH_MAP /home/vagrant/bin /home/vagrant/ffmpeg_build/share/man" >> ~/.manpath'

# Compile and install the modified-mjpegtools
apt-get install -y libjpeg-dev
ln -s /vagrant/Cpp/include/videodev.h /usr/include/linux/videodev.h
cd /home/vagrant/src
cp /vagrant/Cpp/modified-mjpegtools-2.0.0_2.tar.gz .
tar -xzvf modified-mjpegtools-2.0.0_2.tar.gz
rm modified-mjpegtools-2.0.0_2.tar.gz
cd modified-mjpegtools-2.0.0
./configure
make install
ldconfig

# Install a specific Firefox version (for stability)
firefox_version=38.1.0esr
apt-get install -y libasound2 libatk1.0-0 libc6 libcairo2 libdbus-1-3 libdbus-glib-1-2 libfontconfig1 \
  libfreetype6 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk2.0-0 libpango1.0-0 libstartup-notification0 \
  libstdc++6 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrender1 libxt6 ttf-lyx libcanberra0 \
  libdbusmenu-glib4 libdbusmenu-gtk4 gcu-plugin abrowser abrowser-branding firefox-branding
cd /home/vagrant
wget http://ftp.mozilla.org/pub/mozilla.org/firefox/releases/$firefox_version/linux-i686/en-US/firefox-$firefox_version.tar.bz2
tar -xf firefox-$firefox_version.tar.bz2
rm firefox-$firefox_version.tar.bz2

# Install Firefox Profile
mkdir -p /home/vagrant/.mozilla/firefox
cd /home/vagrant/.mozilla/firefox
echo [General] > profiles.ini
echo StartWithLastProfile=1 >> profiles.ini
echo [Profile0] >> profiles.ini
echo Name=Word-DVD >> profiles.ini
echo IsRelative=1 >> profiles.ini
echo Path=Word-DVD >> profiles.ini
echo Default=1 >> profiles.ini

# Install word-dvd Firefox extension
mkdir -p ./Word-DVD/extensions
echo /vagrant/extension > ./Word-DVD/extensions/\{f597ab2a-3a14-11de-a792-e68e56d89593\}

# Install word-dvd Firefox prefs
cp /vagrant/prefs.js ./Word-DVD

# Create automatic Firefox-word-dvd startup script
echo /home/vagrant/firefox/firefox -p Word-DVD -jsconsole -purgecaches -no-remote > /home/vagrant/firefox.sh
chmod ug+x /home/vagrant/firefox.sh
echo /home/vagrant/firefox.sh \& >> /home/vagrant/.bashrc

# Create default project directories if they don't already exist
if [ ! -e /vagrant/PROJECT/INPUTS ]; then
  mkdir -p /vagrant/PROJECT/INPUTS
fi
if [ ! -e /vagrant/PROJECT/OUTPUTS ]; then
  mkdir /vagrant/PROJECT/OUTPUTS
fi

# Fix permissions
chown -R vagrant:vagrant /home/vagrant
