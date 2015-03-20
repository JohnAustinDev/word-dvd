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
  echo Summary logfile.txt follows:
  grep -i "err" ../logfile.txt
  echo 
  echo Summary err.txt follows: 
  grep -i "err" ../err.txt 
else
  echo
  echo Shall I try to create an ISO file and mount it to /dev/dvd? [y/n]
  read wantiso
  if [ $wantiso = "y" ]
  then
    ./xcreateiso.sh
  fi
fi

echo
cd ..
wdir=$(pwd)
echo "Your logfile is in $wdir/logfile.txt"
echo "Press Enter to exit"
read noneed
