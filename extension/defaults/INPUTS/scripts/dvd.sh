#!/bin/sh

if [ -n "$1" ]
then cd $1
fi

./xtimeAnalysis.sh 2>../err.txt | tee -a ../logfile.txt 
./xaudio.sh 2>>../err.txt | tee -a ../logfile.txt
./xmenus.sh 2>>../err.txt | tee -a ../logfile.txt
./ximgs2mpeg.sh 2>>../err.txt | tee -a ../logfile.txt
./xnavbuttons.sh 2>>../err.txt | tee -a ../logfile.txt
./xmpeg2vob.sh 2>>../err.txt | tee -a ../logfile.txt

if cat ../logfile.txt ../err.txt | grep -q -i "err" 
then
  cd ..
  wdir=$(pwd)
  echo Summary logfile.txt follows:
  grep -i "err" logfile.txt
  echo 
  echo Summary err.txt follows: 
  grep -i "err" err.txt 
else
  ./xcreateiso.sh
  cd ..
  wdir=$(pwd)
  echo
  echo "Your DVD is in $wdir/dvd.iso"
fi

echo
echo "Your logfile is in $wdir/logfile.txt"
echo

hash gnome-terminal 2>/dev/null || { exit 0; }

echo "Press Enter to exit"
read noneed
