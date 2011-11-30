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

# SCRIPT audio.pl creates the chapters.txt file which is used to time all audio pages.

# If an audio file covers more than a single chapter, indir/pageTiming.txt 
# should provide the actual chapter lengths. Initial calculated values will not be 
# accurate, but are useful as an aid to find the actual timing numbers.

# This routine can be run once without indir/timingAdjustments.csv to create 
# a baseline chapters.csv. Then timingAdjustments.txt can be created from
# a list of actual timing values by timeAnalysis.pl. Then audio.pl
# is run a second time to generate timings which match the measured 
# timing values.

#usage audio.pl scriptDir inputDir outputDir audioDir

print "\nRUNNING audio.pl\n";

$scriptdir = @ARGV[0];
require "$scriptdir/shared.pl";
&readDataFiles();

$MINIMUML=3;

################################################################################

# PREPARE OUTPUT DIRECTORY
if (!(-e $outaudiodir)) {`mkdir $outaudiodir`;}

# LOG SETTINGS
foreach $k (sort keys %pageTimingFile) {
  print "pageTiming.txt: $k = ".$pageTimingFile{$k}."\n";
}

# FIND LENGTH OF CHAPTERS IN MULTI-CHAPTER FILES
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  my $lastAudioFile = "";
  my $chos = 0;
  for ($ch=1; $ch<=$lastChapter{$book}; $ch++) {
    if ($haveAudio{"$book-$ch"} eq "still") {next;}
    elsif ($haveAudio{"$book-$ch"} =~ /^[^-]+-[^-]+-(\d+)-(\d+)\.ac3$/i || 
           $haveAudio{"$book-$ch"} =~ /^[^-]+-[^-]+-(\d+):\d+-(\d+):\d+\.ac3$/i) {
      $cs = (1*$1);
      $ce = (1*$2);
      # get offset from audio file's chapter to real chapter
      if ($lastAudioFile ne $haveAudio{"$book-$ch"}) {
        $chos = ($ch-$cs);
        $lastAudioFile = $haveAudio{"$book-$ch"};
      }
      $cs = ($cs+$chos);
      $ce = ($ce+$chos);   
    }
    else {next;}
    $totalfile = 0;
    $totalchapter = 0;      
    if (!(-e "$audiodir/".$haveAudio{$book."-".$ch})) {print "ERROR: No audio file found for $book-$ch\n"; die;}
    if ($haveAudio{$book."-".$ch} eq "") {print $book."-".$ch."\n";}
    $audiolen = &getAudioFileLength($haveAudio{$book."-".$ch});
    for ($c=$cs; $c<=$ce; $c++) {
      for ($p=1; $p<=$lastPage{$book."-".$c}; $p++) {
        $totalfile = ($totalfile + $pageRelLen{"$book-$c-$p"});
        if ($c == $ch) {$totalchapter = ($totalchapter + $pageRelLen{"$book-$c-$p"})};
      }
    }
    $calcaudiolen = ($audiolen * ($totalchapter/$totalfile));
    # see if there is an actual chapter position available
    $actualaudiolen = "";
    if ($ch==$cs && $multiChapTiming{$book."-".($cs+1)}) {$actualaudiolen = $multiChapTiming{$book."-".($ch+1)};}
    elsif ($ch<$ce  && $multiChapTiming{$book."-".$ch} ne "" && $multiChapTiming{$book."-".($ch+1)} ne "") {$actualaudiolen = ($multiChapTiming{$book."-".($ch+1)} - $multiChapTiming{$book."-".$ch});}
    elsif ($ch==$ce && $multiChapTiming{$book."-".$ch} ne "") {$actualaudiolen = ($audiolen-$multiChapTiming{$book."-".$ch});}
    if ($actualaudiolen ne "") {
      $audiofilelen{$book."-".$ch} = sprintf("%.2f", $actualaudiolen);
      print "Multi-chapter audio $book-$ch (".$haveAudio{$book."-".$ch}.")- Actual length is ".$audiofilelen{$book."-".$ch}."s.\n";
    }
    else {
      $audiofilelen{$book."-".$ch} = sprintf("%.2f", $calcaudiolen);
      print "WARNING: Multi-chapter audio $book-$ch (".$haveAudio{$book."-".$ch}.")- Using calculated length ".$audiofilelen{$book."-".$ch}."s.\n";
    }
  }
}

# FIND LENGTH OF REGULAR CHAPTERS
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  for ($ch=1; $ch<=$lastChapter{$book}; $ch++) {
    if ($haveAudio{"$book-$ch"} eq "still") {next;}
    if ($haveAudio{"$book-$ch"} =~ /^[^-]+-[^-]+-(\d+)-(\d+)\.ac3$/i || 
        $haveAudio{"$book-$ch"} =~ /^[^-]+-[^-]+-(\d+):\d+-(\d+):\d+\.ac3$/i) {next;}
    if ($haveAudio{"$book-$ch"} eq "") {print "WARNING: \"haveAudio\" is undefined for $book-$ch. This may be a short non-audio chapter, or it may be a problem.\n"; next;}

    if (!(-e "$audiodir/".$haveAudio{$book."-".$ch})) {print "ERROR: No audio file found for $book-$ch\n"; die;}
    $audiofilelen{$book."-".$ch} = sprintf("%.2f", &getAudioFileLength($haveAudio{$book."-".$ch}));
  }
}

# READ ANY MANUAL TIMING NUMBERS
if (-e "$outaudiodir/timingAdjustments.csv") {
  if (!open(AFL, "<$outaudiodir/timingAdjustments.csv")) {print "ERROR: Couldn't open $outaudiodir/timingAdjustments.csv\n"; die;}
  while (<AFL>) {
    if    ($_ =~ /^\s*$/) {next;}
    elsif ($_ =~ /^\s*#/) {next;}
    elsif ($_ =~ /^([^-]+)-(\d+)-(\d+)\s*,\s*([-\.\d]+)/) {
      $bk = $1;
      $ch = $2;
      $pg = $3;
      $tos = $4;
      print "Applying transition offset $bk-$ch-$pg = $tos.\n";
      $manualOffset{$bk."-".$ch."-".$pg} = $tos;
    }
    else {print "Could not parse manual timing entry\n\t$_\n";}
  }
  close(AFL);
}

# INITIALIZE ALL TIMING PARAMETERS
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  for ($ch=1; $ch<=$lastChapter{$book}; $ch++) {
    if ($haveAudio{"$book-$ch"} eq "still") {next;}
    
    # save audio reading length;
    $bookStartGap    = &readPageTimingFile("BookStartGap", $book, $ch);
    $bookEndGap      = &readPageTimingFile("BookEndGap", $book, $ch);
    $chapterStartGap = &readPageTimingFile("ChapterStartGap", $book, $ch);
    $chapterEndGap   = &readPageTimingFile("ChapterEndGap", $book, $ch);
    if (exists($correctChapStartTime{$book."-".$ch})) {$chapterStartGap = $correctChapStartTime{$book."-".$ch}; $bookStartGap = 0;}
    if (exists($correctChapEndTime{$book."-".$ch})) {$chapterEndGap = ($audiofilelen{$book."-".$ch} - $correctChapEndTime{$book."-".$ch}); $bookEndGap = 0;}
    $readingLength = ($audiofilelen{$book."-".$ch} - $chapterStartGap - $chapterEndGap);
    if ($ch == 1) {$readingLength = ($readingLength - $bookStartGap);}
    if ($ch == $lastChapter{$book}) {$readingLength = ($readingLength - $bookEndGap);}  
    $audioreadlen{"$book-$ch"} = $readingLength;
    
    # save first page start gap      
    if ($ch == 1) {$firstPageGap{"$book-$ch"} = ($bookStartGap + $chapterStartGap);}
    else {$firstPageGap{"$book-$ch"} = $chapterStartGap;}
#print "$book-$ch: ". $audioreadlen{"$book-$ch"}.", ".$firstPageGap{"$book-$ch"}."\n";      
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      # get page's fraction of $audioreadlen, now including titles...       
      $pages{"$book-$ch-$pg"} = &addTitles($pages{"$book-$ch-$pg"}, $pageTitles{"$book-$ch-$pg"}, $book, $ch); 
    }
  }
}
  
# CALCULATE AND SAVE CHAPTER DIVISIONS
if (!open(CHP, ">$outaudiodir/chapters.csv")) {print "ERROR: Could not open chapters file $outaudiodir/chapters.csv\n"; die;}
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  for ($ch=1; $ch<=$lastChapter{$book}; $ch++) {
    undef(%TSTART); # huge speed increase!
    if ($haveAudio{"$book-$ch"} eq "still" || $haveAudio{"$book-$ch"} eq "") {next;} # short, non-audio chapters may be $haveAudio{}==""

    #STORE INITIAL CHAPTER TIMING VALUES IN $TSTART
    $TSTART{$book."-".$ch."-1"} = 0;
    for ($pg=1; $pg<$lastPage{$book."-".$ch}; $pg++) {
      if (!(exists $pages{"$book-$ch-$pg"})) {
        print "ERROR: NO TIMING INFO: ".$book."-".$ch."-".$pg."\n";
        die;
      }
      $ts = $TSTART{$book."-".$ch."-".$pg} + ($audioreadlen{$book."-".$ch} * $pages{$book."-".$ch."-".$pg});
      if ($pg == 1) {$ts = $ts + $firstPageGap{$book."-".$ch};}
      $TSTART{$book."-".$ch."-".($pg+1)} = $ts;
    }

    #APPLY MANUAL ADJUSTMENTS
    $lastFixedPg = ($lastPage{$book."-".$ch} + 1);
    $TSTART{$book."-".$ch."-".$lastFixedPg} = $audiofilelen{$book."-".$ch};
    &applyOffsets($book, $ch, \%manualOffset);

    #CHECK LENGTH OF FIRST AND LAST PAGES AND ADJUST IF NECESSARY
    if ($TSTART{$book."-".$ch."-2"} < $MINIMUML) {
      $TSTART{$book."-".$ch."-2"} = $MINIMUML;
    }
    if (($audiofilelen{$book."-".$ch} - $TSTART{$book."-".$ch."-".$lastPage{$book."-".$ch}}) < $MINIMUML) {
      $TSTART{$book."-".$ch."-".$lastPage{$book."-".$ch}} = ($audiofilelen{$book."-".$ch} - $MINIMUML - 0.040);
    }

    #ROUND ALL TIMING NUMBERS TO NEAREST FRAME
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      $f = $framesPS*$TSTART{$book."-".$ch."-".$pg};
      $framesRND = sprintf("%i", $f);
      $TSTART{$book."-".$ch."-".$pg} = ($framesRND/$framesPS);
    }
    
    #SAVE FINAL VALUES TO chapters.csv FILE
    if ($audioreadlen{$book."-".$ch} > $audiofilelen{$book."-".$ch}) {$audioreadlen{$book."-".$ch} = $audiofilelen{$book."-".$ch}}
    print CHP "$book-$ch, ".$audiofilelen{$book."-".$ch}.", ".$audioreadlen{$book."-".$ch};
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      $nextT = $TSTART{$book."-".$ch."-".($pg+1)};
      if ($nextT eq "") {$nextT = $audiofilelen{$book."-".$ch};}
      if (($nextT-$TSTART{$book."-".$ch."-".$pg}) < $MINIMUML) {print "ERROR: Page $book-$ch-$pg is less than $MINIMUML seconds!\n";}
      print CHP ", ".$TSTART{$book."-".$ch."-".$pg};
    }
    print CHP "\n";
  }
}
close(CHP);

open(OUTF, ">$outaudiodir/audiofilelengths.csv") || die "Could not open $outaudiodir/audiofilelengths.csv\n";
foreach $files (sort keys %filelens) {print OUTF $files.",".$filelens{$files}."\n";}
close(OUTF);

################################################################################

sub applyOffsets($$%) {
  my $book = shift;
  my $ch = shift;
  my $offsetPTR = shift;

  my $mrt;
  my $mlf;
  my $p;
  my $pg;
  my %tInit;
  my $ats;

  foreach $ats (keys %TSTART) {
    if ($ats !~ /^$book-/) {next;}
    $tInit{$ats} = $TSTART{$ats};
  }

  my $lfpg = ($lastPage{$book."-".$ch} + 1);
  for ($pg=$lastPage{$book."-".$ch}; $pg>=1; $pg--) {
    if (!(exists $offsetPTR->{$book."-".$ch."-".$pg})) {next;}
#&dprint($book, $ch, $pg, "Adjustment=".$offsetPTR->{$book."-".$ch."-".$pg}." init=".$tInit{$book."-".$ch."-".$pg}."\n");   
    # m*Tp = Tpi + Tmo
    $mlf = ($tInit{$book."-".$ch."-".$pg} + $offsetPTR->{$book."-".$ch."-".$pg})/$TSTART{$book."-".$ch."-".$pg};
    # m(Tlf - Tp) + Tp = Tpi + Tmo
    if ($pg+1 < $lfpg) {
      $mrt = ($tInit{$book."-".$ch."-".$pg} + $offsetPTR->{$book."-".$ch."-".$pg} - $TSTART{$book."-".$ch."-".$pg})/($TSTART{$book."-".$ch."-".$lfpg} - $TSTART{$book."-".$ch."-".$pg});
    }
    for ($p=2; $p<=$pg; $p++) {
      $TSTART{$book."-".$ch."-".$p} = ($mlf * $TSTART{$book."-".$ch."-".$p});
    }
    for ($p=$pg+1; $p<$lfpg; $p++) {
      $TSTART{$book."-".$ch."-".$p} = $TSTART{$book."-".$ch."-".$p} + ($mrt * ($TSTART{$book."-".$ch."-".$lfpg}-$TSTART{$book."-".$ch."-".$p}));
    }
    $lfpg = $pg;
#&dprint($book, $ch, $pg, "SemiFinal=".$TSTART{$book."-".$ch."-".$pg}."\n");
  }
}

sub dprint($$$$) {
  my $b = shift;
  my $c = shift;
  my $p = shift;
  if ($b eq "John" && $c eq "1" && $p eq "7") {print shift;}
}

sub getAudioFileLength($) {
  my $afile = shift;
  my $alen = 0;
  
  # read cached values from file
  if ($readcache eq "" && -e "$outaudiodir/audiofilelengths.csv") {
    if (!open(AFL, "<$outaudiodir/audiofilelengths.csv")) {print "ERROR: Couldn't open $outaudiodir/audiofilelengths.csv\n"; die;}
    while (<AFL>) {
      if ($_ !~ /^(.*),(.*)$/) {print "ERROR: Problem parsing $outaudiodir/audiofilelengths.csv contents: \"$_\"\n"; die;}
      my $fname = $1;
      my $flen = $2;
      
      $filelens{$fname} = $flen;
    }
    close(AFL);
  }
  $readcache = "true";
  
  if (!exists($filelens{$afile})) {
    my $fpath = "$audiodir/".$afile;
    `ffmpeg -i $fpath -target pal-dvd -acodec copy $outaudiodir/tmp.ac3 2> $outaudiodir/tmp.txt`;
    unlink("$outaudiodir/tmp.ac3");
    #`sox $audiofile -r 48000 $outaudiodir/$book-$ch.wav vol 0.6 resample`;
  
    if (!open(AUD, "<$outaudiodir/tmp.txt")) {print "ERROR: Could not open audio length-info file.\n"; die;}
    while (<AUD>) {
      if ($_ =~ /Duration:\s*(\d+):(\d+):([\d\.]+)/im) {
        $alen = (($1*3600) + ($2*60) + $3);
      }
    }
    close(AUD);
    unlink("$outaudiodir/tmp.txt");
    if ($alen == 0) {print "ERROR: Could not get length of audio file $afile.\n"; die;}
    $filelens{$afile} = $alen;
  }
  
  return $filelens{$afile};
}

1;
