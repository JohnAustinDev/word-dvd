#!/usr/bin/perl
# This file is part of Word-DVD.
#
#   Copyright 2010 Dale Potter (ortoasia@gmail.com)
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

# SCRIPT imgs2web.pl creates an mpeg video clip from jpg images in page length chunks.
# The resulting video clips are intended for viewing on the internet.
# Either audio or silence is included in the mpg clip. So each jpg image results
# in a separate mpeg file.

#usage imgs2web.pl scriptDir inputDir outputDir audioDir separatePages debugOn

print "\nRUNNING imgs2web.pl\n";

$scriptdir = @ARGV[0];
$separatePages = @ARGV[4];
$debug = @ARGV[5];
require "$scriptdir/shared.pl";
&readDataFiles();

################################################################################

# CHECK FOR ALL NECESSARY IMAGE FILES
&checkImageFiles();

#PREPARE OUTPUT DIRECTORY
if (!(-e $webdir)) {`mkdir $webdir`;}
if (!(-e "$webdir/videotmp")) {`mkdir $webdir/videotmp`;}


#CREATE MPG FILES
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
    if (!$chapters{"$book-$ch"}) {next;}
    if ($haveAudio{"$book-$ch"} eq "still") {next;}
    if (!-e "$webdir/$book") {`mkdir $webdir/$book`;}
    print "Creating mpg for $book-$ch (".$haveAudio{"$book-$ch"}.")";
    $nextPTS = 0;
      
    $multChapFileOFS = 0;
    $multChapEnd = 0;
    @chaps = split(/,/, $Chapterlist{$book."-".$ch});
    $tlastchap = 0;
    $lastAudioPTS = 0;
    if ($haveAudio{"$book-$ch"} =~ /^[^-]+-[^-]+-(\d+)-(\d+)\.ac3$/i) {
      $cs = (1*$1);
      $ce = (1*$2);
      for ($c=$cs; $c<=$ce; $c++) {
        if ($c<$ch) {$multChapFileOFS = ($multChapFileOFS + $Chapterlength{$book."-".$c});}
        if ($c<=$ch) {$multChapEnd = ($multChapEnd + $Chapterlength{$book."-".$c});}
      }
      $f = $framesPS*$multChapFileOFS;
      $framesRND = sprintf("%i", $f);
      $multChapFileOFS = ($framesRND/$framesPS);
      print " start=".$multChapFileOFS."s, finish=".$multChapEnd."s, length=".sprintf("%.2f", ($multChapEnd-$multChapFileOFS))."s\n";
    }
    else {print " start=0s, finish=".$Chapterlength{$book."-".$ch}."s, length=".$Chapterlength{$book."-".$ch}."s\n";}
  
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      
      #make single audio page, suitable for later concatenation...
      $seekto = $tlastchap;
      if ($pg == $lastPage{$book."-".$ch}) {
        $totl = sprintf("%i", $Chapterlength{$book."-".$ch}*$framesPS)/$framesPS;
        $tlen = ($totl-$tlastchap);
      }
      else {
        $timef = $chaps[$pg];
        $ts = &unformatTime($timef);
        $tlen = ($ts-$tlastchap);
        $tlastchap = $ts;
      }
      $audiofile = "$audiodir/".$haveAudio{$book."-".$ch};
      if (!$tlen) {print "ERROR: tlen was null!!!\n"; die;}
      $fseekto = ($seekto + $multChapFileOFS);
      $numf = ($tlen*$framesPS);
      $gop = (2*$numf);
      
      # NOTE about ffmpeg 0.5: -t is NOT duration as the man page says, it is the time code at which encoding stops.
      if ($ffmpgVersion=~/^0\.5\./) {$ffmpegt = ($tlen+$fseekto);}
      else {$ffmpegt = $tlen;}     
      
      $cmd = "jpeg2yuv -v 0 -n ".$numf." -I p -f $framesPS -j $imagedir/$book/$book-$ch-$pg.jpg | mpeg2enc -v 0 -f 3 -g 1 -G ".(2*$framesPS)." -b 5000 -o $webdir/videotmp/$book-$ch-$pg.m2v";     
      print "$cmd\n\n";
      `$cmd`;
      $cmd = "ffmpeg -v $Verbosity -t $ffmpegt -i $audiofile -ss $fseekto -acodec copy -y $webdir/videotmp/$book-$ch-$pg.m2a";
      print "$cmd\n\n";
      `$cmd`;

      #mux audio and video clips...
      if ($mpgIsMultiPage{"$book-$ch"} eq "true") {
        $seqend = "-E 0";
        if ($pg == $lastPage{$book."-".$ch}) {$seqend = "-E 1";}
        $startPTS = $seekto;
        
        $cmd = "mplex -v $Verbosity -V $seqend -T $startPTS -f 3 $webdir/videotmp/$book-$ch-$pg.m2v $webdir/videotmp/$book-$ch-$pg.m2a -o $webdir/$book/$book-$ch-$pg.mpg";
        print "$cmd\n\n";
        `$cmd`; 
        #$nextPTS = &readPTS("$webdir/$book/$book-$ch-$pg.mpg") + 0.04;         
      }
      else {
        $cmd = "mplex -v $Verbosity -V -f 3 $webdir/videotmp/$book-$ch-$pg.m2v $webdir/videotmp/$book-$ch-$pg.m2a -o $webdir/$book/$book-$ch-$pg.mpg";
        print "\n\n$cmd\n\n";
        `$cmd`;
        $cmd = "ffmpeg -i $webdir/$book/$book-$ch-$pg.mpg -vcodec copy -acodec libmp3lame -y $webdir/$book/fin-$book-$ch-$pg.mpg";
        print "\n\n$cmd\n\n";
        `$cmd`;
        if (!$debug) {`rm $webdir/$book/$book-$ch-$pg.mpg`;}
      }
    }
    if (!$debug) {`rm -r $webdir/videotmp/*.*`;}
  }
}

CONCAT:
#CONCATENATE PAGE MPGs INTO CHAPTER MPGs
&mpgPages2Chapter($webdir, "", 1, $debug);


        
