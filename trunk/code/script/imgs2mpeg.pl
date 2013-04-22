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

# SCRIPT imgs2mpeg.pl creates an mpeg video clip from jpg images in page length chunks.
# Either audio or silence is included in the mpg clip. So each jpg image results
# in a separate mpeg file.

#usage imgs2mpeg.pl scriptDir inputDir outputDir audioDir debugOn

print "\nRUNNING imgs2mpeg.pl\n";

$scriptdir = @ARGV[0];
$debug = @ARGV[4];
require "$scriptdir/shared.pl";
&readDataFiles();

################################################################################

# CHECK FOR ALL NECESSARY IMAGE FILES
&checkImageFiles();

#PREPARE OUTPUT DIRECTORY
if (!(-e $videodir)) {`mkdir $videodir`;}
if (!(-e "$videodir/videotmp")) {`mkdir $videodir/videotmp`;}
unlink("$outaudiodir/multiChapterTiming.txt");

#GET FFMPEG VERSION
`ffmpeg -version` =~ /^FFmpeg[^\:]+\:([^-,]+)/;
$ffmpgVersion = $1;

#CREATE MPG FILES
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  `mkdir $videodir/$book`;

  for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
    if (!$chapters{"$book-$ch"}) {next;}
    print "Creating mpg for $book-$ch (".$haveAudio{"$book-$ch"}.")";
    $nextPTS = 0;

    if ($haveAudio{"$book-$ch"} ne "still") {
      $multChapFileOFS = 0;
      @chaps = split(/,/, $Chapterlist{$book."-".$ch});
      $tlastchap = 0;
      $lastAudioPTS = 0;
      $gap = 0;
      
      # set up for multi-chapter audio files if necesssary
      if (&isMultiChapter($book, $ch)) {
        $multChapFileOFS = &multiChapTimeOffset($book, $ch);
        print " start=".$multChapFileOFS."s, finish=".($multChapFileOFS+$Chapterlength{$book."-".$ch})."s, length=".sprintf("%.2f", ($Chapterlength{$book."-".$ch}))."s\n";
      }
      else {print " start=0s, finish=".$Chapterlength{$book."-".$ch}."s, length=".$Chapterlength{$book."-".$ch}."s\n";}
    }
    else {undef(@chaps); undef($tlastchap); print "\n";}

    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}

      #make single silent page...
      if ($haveAudio{"$book-$ch"} eq "still") {&makeSilentSlide("$book-$ch-$pg", "$imagedir/$book/$book-$ch-$pg.jpg");}

      #make single audio page, suitable for later concatenation...
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
        $audiofile = "$audiodir/".$haveAudio{$book."-".$ch};
        if (!$tlen) {print "ERROR: tlen was null!!!\n"; die;}
        `jpeg2yuv -v 0 -n 1 -I p -f 25 -j $imagedir/$book/$book-$ch-$pg.jpg | mpeg2enc --no-constraints -V 2000 -b 20000 -v 0 -f 3 -g 1 -G 1 -o $videodir/videotmp/$book-$ch-$pg.m2v`;
        $fseekto = ($seekto + $multChapFileOFS);
        
        # NOTE about ffmpeg 0.5: -t is NOT duration as the man page says, it is the time code at which encoding stops.
        if ($ffmpgVersion=~/^0\.5\./) {$ffmpegt = ($tlen+$fseekto);}
        else {$ffmpegt = $tlen;}
        `ffmpeg -v $Verbosity -t $ffmpegt -i $audiofile -ss $fseekto -acodec copy -y $videodir/videotmp/$book-$ch-$pg.m2a`;
        #mux audio and video clips...
        if ($mpgIsMultiPage{"$book-$ch"} eq "true") {
          $seqend = "-E 0";
          if ($pg == $lastPage{$book."-".$ch}) {$seqend = "-E 1";}
          $startPTS = ($seekto+$gap);
          $gap = ($gap+0.040); #this gap insures there is at least 1 frame between last audio and first video packets even after rounding (for dvdauthor)
          `mplex -v $Verbosity -V $seqend -T $startPTS -f 8 $videodir/videotmp/$book-$ch-$pg.m2v $videodir/videotmp/$book-$ch-$pg.m2a -o $videodir/$book/$book-$ch-$pg.mpg`;
          #$nextPTS = &readPTS("$videodir/$book/$book-$ch-$pg.mpg") + 0.04;
        }
        else {
          `mplex -v $Verbosity -V -f 8 $videodir/videotmp/$book-$ch-$pg.m2v $videodir/videotmp/$book-$ch-$pg.m2a -o $videodir/$book/$book-$ch-$pg.mpg`;
        }
      }

      #create silent slides for all footnotes...
      $pgn=1;
      while (-e "$imagedir/$book/fn-$book-$ch-$pg-$pgn.jpg") {
        &makeSilentSlide("fn-$book-$ch-$pg-$pgn", "$imagedir/$book/fn-$book-$ch-$pg-$pgn.jpg");
        $pgn++;
      }
    }

  }
  
  if ($multChapListing ne "") {
    open(OUTF, ">>$outaudiodir/multiChapterTiming.txt") || die "Could not open $outaudiodir/multiChapterTiming.txt\n";
    print OUTF $multChapListing;
    close(OUTF);
    $multChapListing = "";
  }
}

if (!$debug) {`rm -f -r $videodir/videotmp`;}

