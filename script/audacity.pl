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

$SCRIPTDIR = shift(@ARGV);
$MBK = @ARGV[3];
$MCH = @ARGV[4];
$STARTAUD = @ARGV[5];

print "\nRUNNING audacity.pl $MBK $MCH $STARTAUD\n";
&doTimingAdjustment();
                          
# Create labels.txt file from chapters.csv
require "$SCRIPTDIR/shared.pl";
&readDataFiles();
@chaps = split(/\s*,\s*/, $Chapterlist{$MBK."-".$MCH});
open(OUTF, ">$outaudiodir/labels.txt");
for ($i=0; $i<@chaps; $i++) {$t = &unformatTime($chaps[$i]); print OUTF "$t\t$t\tC".(1+$i)."\n";}
close(OUTF);

if ($STARTAUD eq "true") {
  # Convert audio file to wav
  $f = "$audiodir/".$haveAudio{$MBK."-".$MCH};
  $t = "$outaudiodir/labels.wav";
  $com = "ffmpeg -acodec ac3 -i $f -y $t";
  print $com;
  `$com`;
  
  # open Audacity with new wav file
  system("audacity $t &");
}

sub doTimingAdjustment() {
  print "\t\t...timeAnalysis.pl\n";
  `$SCRIPTDIR/timeAnalysis.pl $SCRIPTDIR @ARGV[0] @ARGV[1] @ARGV[2]`;
  print "\t\t...audio.pl\n";
  `$SCRIPTDIR/audio.pl $SCRIPTDIR @ARGV[0] @ARGV[1] @ARGV[2]`;
}