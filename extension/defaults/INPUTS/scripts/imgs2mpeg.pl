#!/usr/bin/perl
# This file is part of Word-DVD.
#
#   Copyright 2015 John Austin (gpl.programs.info@gmail.com)
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
  if (!-e "$videodir/$book") {`mkdir $videodir/$book`;}

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
        if (!$tlen) {print "ERROR: tlen was null!!!\n"; die;}

        $fseekto = ($seekto + $multChapFileOFS);
        
        $mplex = '';
        if ($mpgIsMultiPage{"$book-$ch"} eq "true") {
          my $gapFrames = ($localeFile{"MpegGapFrames"} ? $localeFile{"MpegGapFrames"}:1);
          $seqend = "-E 0";
          if ($pg == $lastPage{$book."-".$ch}) {$seqend = "-E 1";}
          $startPTS = ($seekto+$gap);
          $gap = ($gap+(0.040*$gapFrames)); #this gap insures there is at least 1 frame between last audio and first video packets even after rounding (for dvdauthor)          
          $mplex = "$seqend -T $startPTS";
        }
        
        &makeAudioSlide("$book-$ch-$pg", "$imagedir/$book/$book-$ch-$pg.jpg", "$audiodir/".$haveAudio{$book."-".$ch}, $tlen, $fseekto, $mplex);
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

