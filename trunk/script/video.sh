#!/bin/sh
# This file is part of Word-DVD.
#
#   Copyright 2010 Dale Potter (gpl.programs.info@gmail.com)
#
#   Word-DVD is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 2 of the License, or
#   (at your option) any later version.
#
#   Word-DVD is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with Word-DVD.  If not, see <http://www.gnu.org/licenses/>.

if [ -n "$1" ]
then cd $1
fi

./xtimeAnalysis.sh  2>../err.txt | tee -a ../logfile.txt  
./xaudio.sh 2>>../err.txt | tee -a ../logfile.txt
./ximgs2web.sh 2>>../err.txt | tee -a ../logfile.txt

if cat ../logfile.txt ../err.txt | grep -q -i "err" 
then
  echo Summary logfile.txt follows: | tee -a ../logfile.txt
  grep -i "err" ../logfile.txt | tee -a ../logfile.txt
  echo >>../logfile.txt
  echo Summary err.txt follows: | tee -a ../logfile.txt
  grep -i "err" ../err.txt | tee -a ../logfile.txt
else
  echo CONGRATULATIONS! _N-O__E-R-R-O-R-S_ | tee -a ../logfile.txt
fi

echo
cd ..
wdir=$(pwd)
echo "Your logfile is in $wdir/logfile.txt"
echo "Press Enter to exit"
read noneed