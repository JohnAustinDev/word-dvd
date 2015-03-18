#!/bin/sh

echo "\nRUNNING burnandverify.sh\n";


# Inputs
DEVICE="/dev/dvd"
IMAGE_FILE="${3}/dvd.iso"

# temp files
MD5SUM_ISO="${3}/md5sum-iso.txt"
MD5SUM_CD="${3}/md5sum-cdrom.txt"

# Remove last CD's saved checksum
if [-e $MD5SUM_CD]; then 
  rm -f $MD5SUM_CD                        
fi

if ! growisofs -dvd-compat -Z $DEVICE=$IMAGE_FILE
then exit
fi

eject $DEVICE
read -p "Please close the DVD door, then hit return..." yn

# Checking cd's blocksize and count
echo "Checking CD's block size, and count..."
blocksize=`isoinfo -d -i $IMAGE_FILE | grep "^Logical block size is:" | cut -d " " -f 5`
if test "$blocksize" = ""; then
	echo catdevice FATAL ERROR: Blank blocksize >&2
	exit
fi

blockcount=`isoinfo -d -i $IMAGE_FILE | grep "^Volume size is:" | cut -d " " -f 4`
if test "$blockcount" = ""; then
	echo catdevice FATAL ERROR: Blank blockcount >&2
	exit
fi

echo "block size: $blocksize"
echo "block count: $blockcount"

#Command for reading disk
raw_read_command="dd if=$DEVICE bs=$blocksize count=$blockcount conv=notrunc,noerror"

#Getting checksums
echo "Reading ISO and creating check sum..."
if [ ! -e $MD5SUM_ISO ]; then
  md5sum $IMAGE_FILE > $MD5SUM_ISO
fi
echo "Reading CD and creating check sum..."
$raw_read_command | md5sum > $MD5SUM_CD

# Comparing md5 checksums
echo "Comparing check sums..."
cat $MD5SUM_ISO | while read CODE NAME; do
     if [ -n "`cat $MD5SUM_CD | grep $CODE`" ]; then
          echo "Success: $NAME"
     else
          echo "Failure: $NAME"
     fi
done

read -p "Press return to quit..." yn
