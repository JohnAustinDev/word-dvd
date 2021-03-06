#!/bin/bash
sleep 0.25s

cd ./extension/defaults/INPUTS/scripts/utilities
echo 0 = create word-dvd-xx xpi file
echo 1 = use word-dvd.jar
echo 2 = copy flat files
echo 3 = use proxy extension
echo Choose [0-3]:
read fb

if [ "$fb" != "0" ]; then
  echo Path of Firefox profile directory:
  echo \(default=~/.mozilla/firefox/Word-DVD\)
  read fpath
fi

if [ -z "$fpath" ]
	then fpath="~/.mozilla/firefox/Word-DVD"
fi

eval fpath=$fpath

./src2xpi.pl "$fpath/extensions" "$fb"
