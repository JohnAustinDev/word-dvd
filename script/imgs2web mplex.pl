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

#usage imgs2web mplex.pl scriptDir inputDir outputDir audioDir debugOn

print "\nRUNNING imgs2web.pl\n";

$scriptdir = @ARGV[0];
$debug = @ARGV[4];
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
  `mkdir $webdir/$book`;
  
  for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
    if (!$chapters{"$book-$ch"}) {next;}
    print "Creating mpg for $book-$ch (".$haveAudio{"$book-$ch"}.")\n";
      
    if ($haveAudio{"$book-$ch"} ne "still") {
      $multChapFileOFS = 0;
      $multChapEnd = 0;
      @chaps = split(/,/, $Chapterlist{$book."-".$ch});
      $tlastchap = 0;
    }
    else {undef(@chaps); undef($tlastchap); print "\n";}
    
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      
      #make single silent page...
      if ($haveAudio{"$book-$ch"} eq "still") {makeSilentSlide($book, "$book-$ch-$pg");}
      
      #make single video page and concatenate...
      else {
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
        if (!$tlen) {print "ERROR: tlen was null!!!\n"; die;}
        $numf = ($tlen*$framesPS);
        $gop = (50);
print "jpeg2yuv -v 0 -n $numf -I p -f $framesPS -j $imagedir/$book/$book-$ch-$pg.jpg | mpeg2enc -v 0 -f 8 -g $gop -G $gop -o $webdir/videotmp/$book-$ch-$pg.m2v\n\n";
        `jpeg2yuv -v 0 -n $numf -I p -f $framesPS -j $imagedir/$book/$book-$ch-$pg.jpg | mpeg2enc -v 0 -f 8 -g $gop -G $gop -o $webdir/videotmp/$book-$ch-$pg.m2v`;
        if (-e "$webdir/videotmp/chapter.m2v") {
          `cat $webdir/videotmp/chapter.m2v $webdir/videotmp/$book-$ch-$pg.m2v > $webdir/videotmp/tmp.mpg`;
          `mv $webdir/videotmp/tmp.mpg $webdir/videotmp/chapter.m2v`;
          if (!$debug) {`rm $webdir/videotmp/$book-$ch-$pg.m2v`;}
        }
        else {`mv $webdir/videotmp/$book-$ch-$pg.m2v $webdir/videotmp/chapter.m2v`;}
      }
    }
    
    #make chapter's audio stream...
    $a = "$audiodir/".$haveAudio{$book."-".$ch};;
    #`ffmpeg -v $Verbosity -i $a -acodec copy -y $webdir/videotmp/chapter.m2a`;
    
    MULTIPLEX:  
    #multiplex chapter's audio and video streams into an mpeg!
    `mplex -v $Verbosity -f 8 $webdir/videotmp/chapter.m2v $a -o $webdir/$book/$book-$ch-%d.mpg`;
    #`ffmpeg -v $Verbosity -i $a -acodec copy -i $webdir/videotmp/chapter.m2v -vcodec copy -y $webdir/$book/$book-$ch.mpg`;
  }
  if (!$debug) {`rm -r $webdir/videotmp/*.*`;}
}

        
