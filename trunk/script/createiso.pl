#!/usr/bin/perl
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

# SCRIPT createiso.pl copies Label and MK files to the dvd directory and then
# creates a DVD ISO file suitable for burning to DVD

print "\nRUNNING createiso.pl\n";

$scriptdir = shift(@ARGV);
require "$scriptdir/shared.pl";
&readDataFiles();

# unmount and delete any existing ISO
`sudo umount /media/dvd`;
if (-e "../dvd.iso") {`rm -f ../dvd.iso`;}
if (-e "../md5sum-iso.txt") {`rm -f ../md5sum-iso.txt`;}



# must use >= genisoimage 1.1.9. Earlier versions could not be read in Windows!
`sudo genisoimage -f -dvd-video -o ../dvd.iso ../dvd`;
if (!-e "/media/dvd") {`sudo mkdir /media/dvd`;}
`sudo mount -o loop ../dvd.iso /media/dvd`;

#growisofs -dvd-compat -Z /dev/dvd=../dvd.iso
