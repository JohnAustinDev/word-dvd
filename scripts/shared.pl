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

# SCRIPT shared.pl holds common utilities and initialization routines used by
# many other scripts.

use Encode;
use POSIX;
require "$scriptdir/init.pl";

sub readDataFiles() {

  # INITIALIZE GLOBAL DATA STRUCTURES
  undef(%books);
  undef(%chapters);
  undef(%pages);
  undef(%lastChapter);
  undef(%lastPage);
  undef(%pageRelLen);
  undef(%haveAudio);
  undef(%mpgIsMultiPage);
  undef(%totalTitles);
  undef(%pageTitles);
  undef(%correctPageChap);
  undef(%pageTimingEntry); 

  undef(%Chapterlist);
  undef(%Chapterlength);
  undef(%ChapterReadlength);
  
  undef(%correctPageChap);
  undef(%correctChapStartTime);
  undef(%correctChapEndTime);
  
  undef(%PrevButtonNum);
  undef(%NextButtonNum);
  undef(%AllMenus);
  undef(%AllButtons);
  
  #COLLECT PAGE AND RELATIVE TIMING INFORMATION
  if (-e "$listdir") {
    opendir(LSD, "$listdir");
    @entries = readdir(LSD);
    closedir(LSD);
  
    foreach $entry (@entries) {
      if ($entry !~ /\.csv$/) {next;}
      elsif($entry =~ /-trans\.csv/) {next;}
      elsif ($entry =~ /^\s*$MENUSFILE\s*$/) {&readMenuInformation("$listdir/$entry");}
      else {&readPageInformation;}
    }
  
    $maxbooknum=0;
    foreach $book (keys %books) {
      $maxbooknum++;
      $books{$book} = $localeFile{"FileOrder:".$book};
    }
  }
  
  # READ CHAPTER INFORMATION FROM FILE
  if (-e "$outaudiodir/chapters.csv") {&readChaptersCSV();}
    
  
  
  # READ ACTUAL PAGE TIMING INFO FROM FILE
  # The value is either the time at which the given page BEGINS (relative to
  # the beginning of the chapter), or a delta if "+=" is used.
  #
  # Matt-1-2 = 00:41.29
  #  OR
  # Matt-1-2 == 2758
  #  OR
  # Matt-1-2 += 3.4
  #
  # Matt-1-0 is baseline (subtracted from all values)
  if (open (INF, "<$indir/pageTiming.txt")) {
    $order=50000;
    $baseline=0;
    while(<INF>) {
      $order++;
      $bk = "";
      if    ($_ =~ /^\s*$/) {next;}
      elsif ($_ =~ /^\s*\#/) {next;}
      elsif ($_ =~ /([^-]+)-(\d+)-([se])\s*=\s*(.*?)\s*$/) {
        $bk = $1;
        $ch = $2;
        $ty = $3;
        $t = &unformatTime($4, "noFrameCheck");
        $f = $framesPS*$t;
        $framesRND = sprintf("%i", $f);
        if ($ty eq "s") {$correctChapStartTime{$bk."-".$ch} = ($framesRND/$framesPS);}
        if ($ty eq "e") {$correctChapEndTime{$bk."-".$ch} = ($framesRND/$framesPS);}
      }
      elsif ($_ =~ /([^-]+)-(\d+)-chs\s*=\s*(.*?)\s*$/) {
        $bk = $1;
        $ch = $2;
        $t = &unformatTime($3, "noFrameCheck");
        $multiChapTiming{$bk."-".$ch} = $t;
      }
      elsif ($_ =~ /([^-]+)-(\d+)-i(\d+)\s*=\s*(.*?)$/) {
        # Ignore these lines now. These lines should have already been processed 
        # by word-dvd.js during the page image capture phase, and a corresponding 
        # entry should have been recorded in the listing/<book>.csv file
      }
      elsif ($_ =~ /([^-]+)-(\d+)-(\d+)\s*\+=\s*(.*?)$/) {
        $bk = $1;
        $ch = $2;
        $pg = $3;
        $t = $4;
        $type = "deltaPageTime";
        $f = $framesPS*$t;
        $framesRND = sprintf("%i", $f);
        $correctPageChap{$order."-".$bk."-".$ch."-".$pg."-".$type} = ($framesRND/$framesPS);    
      }
      elsif ($_ =~ /([^-]+)-(\d+)-(\d+)\s*==\s*(.*?)$/) {
        $bk = $1;
        $ch = $2;
        $pg = $3;
        $t = $4;
        $type = "absPageTime";
        if ($pg == 0) {$baseline = $4; next;}
        $t = ($t-$baseline);
        $f = $framesPS*$t;
        $framesRND = sprintf("%i", $f);
        $correctPageChap{$order."-".$bk."-".$ch."-".$pg."-".$type} = ($framesRND/$framesPS);    
      }
      
      # Produced by transitions.sh
      elsif ($_ =~ /([^-]+)-(\d+)-(\d+)\s*=\s*(.*?)$/) {
        $bk = $1;
        $ch = $2;
        $pg = $3;
        $t = &unformatTime($4, "noFrameCheck");
        $f = $framesPS*$t;
        $type = "absPageTime";
        $framesRND = sprintf("%i", $f);
        $correctPageChap{$order."-".$bk."-".$ch."-".$pg."-".$type} = ($framesRND/$framesPS);
      }
      elsif ($_ =~ /^\s*([^-\s]+)\s*=\s*(.*?)\s*$/) {
        my $k = $1;
        my $v = $2;
        $v =~ s/\s*\#.*$//;
        $pageTimingFile{$k} = $v;
      }
      else {print "Bad entry: $_"; die;}
      $_ =~ /^\s*((.*?)\s*=\s*.*?)\s*$/;
      $pageTimingEntry{$2} = $1;
      #if ($bk ne "" && !exists($books{$bk})) {print "WARNING: No book $bk\n";}
    }
    close(INF);
  }
  
  # READ PROJECT MENU FILE
  if (-e "$projmenusdir/menus.txt") {&readMenuInformation("$projmenusdir/menus.txt");}
  else {print "ERROR: Could not find \"$projmenusdir/menus.txt\".\n";}
  
}

sub menuSort($$) {
  my $a = shift;
  my $b = shift;
  
  if ($a =~ /-m(\d+)$/) {$a = $1;}
  if ($b =~ /-m(\d+)$/) {$b = $1;}
  
  return $a <=> $b;
}

# READ PAGE INFORMATION FROM FILE
sub readPageInformation {
  if (!open (INF, "<$listdir/$entry")) {print "Could not open $listdir/$entry"; die;}
  
  $order=20000;
  while (<INF>) {
    if ($_ =~ /error/i) {print $_; die;}
    if ($_ =~ /^\s*\#/) {next;}
    $order++;
    
    #Titus-1-4a, default, loop, 0.211183, en-Titus-01.ac3, 1, 457, 1:07
    if ($_ =~ /^\s*(.*)-(\d+)-(\d+)[ab]\s*,\s*(\S+)\s*,\s*\S+\s*,\s*([\-\d\.]+)\s*,\s*(\S+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(.*?)\s*$/) {
      my $bkt = $1;
      my $cht = $2;
      my $pgt = $3;
      $res = $5;
      my $audiot = $6;
      $numtitles = $7;
      $abstime = &unformatTime($9, "noFrameCheck");
      
      # save everything
      $type = "absVerseTime";      
      $f = $framesPS*$abstime;
      $f = sprintf("%i", $f);
      $abstime = ($f/$framesPS);
      if ($res) { # res=0 is an error condition
        $correctPageChap{$order."-".$bkt."-".$cht."-".$pgt."-".$type} = "$res,$numtitles,$abstime";
      }
    }
    
    #Ruth-1-4, default, loop, 0.1545505, still, 1, 3845
    elsif ($_ =~ /^\s*(.*)-(\d+)-(\d+)\s*,\s*(\S+)\s*,\s*(\S+)\s*,\s*([\d\.]+)\s*,\s*(\S+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/) {
      $book = $1;
      $ch = $2;
      $pg = $3;
      my $atPageEnd = $4;
      my $atChapterEnd = $5;
      $res = $6;
      $audio = $7;
      $numtitles = $8;
      $rellen = $9;
      
      if ($pg == 1 && $numtitles >=1 && $pageTimingEntry{"TitlesAreRead"} ne "true") {$numtitles--;}
  
      if (!(exists $books{$book})) {$books{$book} = 1;}
      $chapters{"$book-$ch"}++;
      $pageRelLen{"$book-$ch-$pg"} = $rellen;
      if (!$lastChapter{$book} || $ch>$lastChapter{$book}) {$lastChapter{$book}=$ch;}
      if (!$lastPage{$book."-".$ch} || $pg>$lastPage{$book."-".$ch}) {$lastPage{$book."-".$ch}=$pg;}
      if (!(exists $haveAudio{$book."-".$ch})) {
        $haveAudio{$book."-".$ch} = $audio;

        # assign "mpgIsMultiPage" value...
        if (!$separatePages && $haveAudio{$book."-".$ch} ne "still") {
          $mpgIsMultiPage{$book."-".$ch} = "true";
        }
        else {
          $mpgIsMultiPage{$book."-".$ch} = "false";
        }
      }
      $totalTitles{$book."-".$ch} = ($totalTitles{$book."-".$ch} + $numtitles);
      $pageTitles{"$book-$ch-$pg"} = $numtitles;
      $pages{"$book-$ch-$pg"} = $res;
      
      # atPageEnd (default, loop, pause, or continue)
      if ($atPageEnd eq "default") {
        $atPageEnd = $haveAudio{$book."-".$ch} eq "still" ? "pause":"continue"; # default
      }
      my $delay = $haveAudio{$book."-".$ch} eq "still" ? "inf":"0"; # default
      if ($atPageEnd =~ s/\(([\d\.]+)\)$//) {
        $delay = $1;
      }
      $AtPageEnd{"$book-$ch-$pg"} = $atPageEnd;
      $AtPageEndDelay{"$book-$ch-$pg"} = $delay;
      
      # atChapterEnd (default, loop, pause, or continue)
      if ($atChapterEnd eq "default") {
        $atChapterEnd = $haveAudio{$book."-".$ch} eq "still" ? "pause":"continue"; # default
      }
      my $delay = $haveAudio{$book."-".$ch} eq "still" ? "inf":"0"; # default
      if ($atChapterEnd =~ s/\(([\d\.]+)\)$//) {
        $delay = $1;
      }
      $AtChapterEnd{"$book-$ch-$pg"} = $atChapterEnd;
      $AtChapterEndDelay{"$book-$ch-$pg"} = $delay;

      #print "Read:$_";
    }
    elsif ($_ =~ /^\s*(.*?)-maxChapter=(\d+)\s*$/) {
      # This entry is only used for shorter than single page, final chapters,
      # without audio. Such chapters will not otherwise be recorded. If this entry
      # reveals such a chapter (because it has not yet been recorded), 
      # it must represent a still page.
      if (!(exists($chapters{"$1-$2"}))) {
        $book = $1;
        $ch = $2;
        if (!(exists $books{$book})) {$books{$book} = 1;}
        $chapters{"$book-$ch"}++;
        if (!$lastChapter{$book} || $ch>$lastChapter{$book}) {$lastChapter{$book}=$ch;}
        if (!(exists $haveAudio{$book."-".$ch})) {
          $haveAudio{$book."-".$ch} = "still";
          $mpgIsMultiPage{$book."-".$ch} = "false";
        }
        $totalTitles{$book."-".$ch} = ($totalTitles{$book."-".$ch} + 0);
      }        
    }
    else {print "Could not parse timingstat: $_"; die;}
  }
  close(INF);
  
  # If we're pausing or looping any page within a chapter, we cannot use multi-page mpgs!
  foreach my $book (sort {$books{$a}<=>$books{$b}} keys %books) {
    for (my $ch=0; $ch<=$lastChapter{$book}; $ch++) {
      for (my $pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
        if ($mpgIsMultiPage{$book."-".$ch} eq "true" && ($AtPageEnd{"$book-$ch-$pg"} ne "continue" || $AtChapterEnd{"$book-$ch-$pg"} ne "continue")) {
          $mpgIsMultiPage{$book."-".$ch} = "false";
        }
      }
    }
  }
  
}

sub addTitles($$$$) {
  my $f = shift;
  my $n = shift;
  my $b = shift;
  my $c = shift;
  
  my $t0 = &readPageTimingFile("TitleAudioGap", $b, $c);
  if ($t0 ne "") {$t0 = (1*$t0);}
  else {$t0 = 1;}  # default is 1 second per title
  my $F = $f + (($t0 / $audioreadlen{"$b-$c"}) * ($n - ($f * $totalTitles{"$b-$c"})));
#print sprintf("%s: f=%0.3f, F=%0.3f, t0=%i, T=%2.2f, n=%i, N=%i\n", "$b-$c", $f, $F, $t0, $audioreadlen{"$b-$c"}, $n, $totalTitles{"$b-$c"});   
  return $F;
}

sub readPageTimingFile($$$) {
  my $w = shift;
  my $b = shift;
  my $c = shift;
  if ($b ne "" && $c ne "" && exists($pageTimingFile{$w."_".$b."_".$c})) {return $pageTimingFile{$w."_".$b."_".$c};}
  elsif ($b ne "" && exists($pageTimingFile{$w."_".$b})) {return $pageTimingFile{$w."_".$b};}
  elsif (exists($pageTimingFile{$w})) {return $pageTimingFile{$w};}
  else  {return $pageTimingFile{"Default".$w};}
}

# READ MENU INFORMATION FROM FILE
sub readMenuInformation($) {
  my $menucsv = shift;
  
  if (!open(INF, "<$menucsv")) {print "Could not open infile $menucsv\n"; die;}
  $line = 0;
  $bnum = 0;
  while (<INF>) {
    $line++;
    
    if ($_ =~ /^\s*\#/) {next;}
    elsif ($_ =~ /^\s*$/) {next;}
    
    #toc-m1.images, default, ../images/toc-m1.jpg, ../images/transparent.png, ../images/masks/toc-m1-HIGH.png, ../images/masks/toc-m1-SEL.png
    elsif ($_ =~ /^\s*([^,]+)\.images\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+?)\s*$/) {
      my $menuName = $1;
      my $atMenuEnd = $2;
      my $image = $3;
      my $maskNORM = $4;
      my $maskHIGH = $5;
      my $maskSEL = $6;
      
      my $csvdir = $menucsv;
      $csvdir =~ s/[\/\\][^\/\\]*$//;
      
      $AllMenus{$menuName}{"image"}     = "$csvdir/$image";
      $AllMenus{$menuName}{"maskNORM"}  = "$csvdir/$maskNORM";
      $AllMenus{$menuName}{"maskHIGH"}  = "$csvdir/$maskHIGH";
      $AllMenus{$menuName}{"maskSEL"}   = "$csvdir/$maskSEL";
      
      if ($atMenuEnd ne "default") {
        my $delay = 1;
        if ($atMenuEnd =~ s/\(([\d\.]+)\)$//) {
          $delay = $1;
        }
        $AllMenus{$menuName}{"atMenuEnd"} = $atMenuEnd;
        $AllMenus{$menuName}{"atMenuEndDelay"} = $delay;
      }
    }
    
    #toc-m1.audio, en-toc-m1.ac3
    elsif ($_ =~ /^\s*([^,]+)\.audio\s*,\s*([^,]+?)\s*$/) {
      my $menuName = $1;
      my $audioFile = $2;
      
      $AllMenus{$menuName}{"audio"} = "$audiodir/$audioFile";
    }
    
    #toc-m1.button-9, more-m1, 84, 470, 342, 486
    elsif ($_ =~ /^\s*([^,]+)\.button-(\d+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+?)\s*$/) {
      my $menuName = $1;
      my $buttonNum = $2;
      my $target = $3;
      my $x0 = $4;
      my $y0 = $5;
      my $x1 = $6;
      my $y1 = $7;
      
      $AllMenus{$menuName}{"button-".$buttonNum}{"target"} = $target;
      $AllMenus{$menuName}{"button-".$buttonNum}{"x0"} = &ceil($x0/2)*2;
      $AllMenus{$menuName}{"button-".$buttonNum}{"y0"} = &ceil($y0/2)*2;
      $AllMenus{$menuName}{"button-".$buttonNum}{"x1"} = &ceil($x1/2)*2;
      $AllMenus{$menuName}{"button-".$buttonNum}{"y1"} = &ceil($y1/2)*2;
      
      $AllButtons{$menuName."-".$buttonNum} = $target;
      
      if ($menuName =~ /^(cm-|textoverlay)/) {next;}
      
      if ($buttonNum eq "9" && $target) {
        $PrevButtonNum{$menuName} = ($buttonNum*1024);
      }
      
      if ($buttonNum eq "18" && $target) {
        $NextButtonNum{$menuName} = ($buttonNum*1024);
      }
      
    }
    else {print "ERROR: Skipping bad menu listing entry: \"$_\"";}

  }
  close(INF);
}

sub readChaptersCSV() {
  # READ CHAPTER INFORMATION FROM FILE
  $maxchaplength = 0;
  if (-e "$outaudiodir/chapters.csv") {
    if (!open(INF, "<$outaudiodir/chapters.csv")) {print "Could not open infile $outaudiodir/chapters.csv.\n"; die;}
    while (<INF>) {
      if ($_ =~ /^\s*\#/) {next;}
      if ($_ =~ /^\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(.*?)\s*$/) {
        $chap = $1;        
        $len = $2;
        $readlen = $3;
        $list = $4;
        $list =~ s/\s+//g;
        $Chapterlist{$chap} = &listToFormatted($list);
        $Chapterlength{$chap} = $len;
        $ChapterReadlength{$chap} = $readlen;
        if ($Chapterlength{$chap} > $maxchaplength) {$maxchaplength = $Chapterlength{$chap};}                   
      }
    }
    close(INF);
  }
}

sub listToFormatted($) {
  my $l = shift;
  my @n = split(/,/, $l);
  for (my $i=0; $i<@n; $i++) {$n[$i] = &formatTime($n[$i]);}
  $l = join(",", @n);
  return $l;
}

#CHECK FOR ALL NECESSARY IMAGE FILES
sub checkImageFiles() {
  foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
    for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
      if (!(exists $chapters{"$book-$ch"})) {
        if ($ch>0) {print "Will skip MPG generation for chapter $book-$ch\n";}
        next;
      }
  
      for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
        if (!(exists $pages{"$book-$ch-$pg"})) {
          if ($haveAudio{$book."-".$ch} ne "still" || $pg!=1) {print "Will skip MPG generation for chapter $book-$ch-$pg\n";}
          next;
        }
        #don't check first page of non-audio pages because it likely isn't there...
        if ($haveAudio{$book."-".$ch} eq "still" && $pg==1) {next;}
        if (!(-e "$imagedir/$book/$book-$ch-$pg.jpg")) {print "ERROR: MISSING REQUIRED IMAGE FILE: $imagedir/$book-$ch-$pg.jpg\n"; die;}
      }
    }
  }
}

#CONCATENATE PAGE MPGs INTO CHAPTER MPGs
sub mpgPages2Chapter($$$$) {
  my $dir = shift;
  my $prefix = shift;
  my $postFlag = shift;
  my $debug = shift;
  foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
    for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
      if (!$chapters{"$book-$ch"}) {next;}
      
      if ($mpgIsMultiPage{"$book-$ch"} eq "false") {next;}
      
      for ($pg=0; $pg<=$lastPage{$book."-".$ch}; $pg++) {
        my $thispage = "$dir/$book/$prefix$book-$ch-$pg.mpg";
        if (!-e $thispage) {next;}
        if (!(-e "$dir/videotmp/chapter.mpg")) {`cp \"$thispage\" \"$dir/videotmp/chapter.mpg\"`;}
        else {
          `cat \"$dir/videotmp/chapter.mpg\" \"$thispage\" > \"$dir/videotmp/tmp.mpg\"`;
          `mv \"$dir/videotmp/tmp.mpg\" \"$dir/videotmp/chapter.mpg\"`;
        }
        if (!$debug) {`rm \"$thispage\"`;}
      }
      
      if (-e "$dir/videotmp/chapter.mpg") {
        if ($postFlag == 1) {
          `ffmpeg -i \"$dir/videotmp/chapter.mpg\" -vcodec copy -acodec libmp3lame -y \"$dir/$book/fin-$book-$ch.mpg\"`;
          if (!$debug) {`rm "$dir/videotmp/chapter.mpg"`;}
          else {`mv \"$dir/videotmp/chapter.mpg\" \"$dir/$book/tmp-$book-$ch.mpg\"`;}
        }
        else {`mv \"$dir/videotmp/chapter.mpg\" \"$dir/$book/fin-$book-$ch.mpg\"`;}
      }
      print "Concatenating pages for fin-$book-$ch.mpg\n";
    }
  }
}

sub roundToNearestFrame($) {
  my $s = shift;
  $s = $framesPS*$s;
  $s = sprintf("%i", $s);
  return ($s/$framesPS);
}

#CONVERT SECONDS INTO (-)HR:MN:SC.SS FORMAT
sub formatTime($$) {
  my $t = shift;
  my $format = shift;
  
  my $sign = "";
  if ($t < 0) {$t = (-1*$t); $sign = "-";}
  
  if (($t*$framesPS) =~ /\./) {print "formatTime $t is not a frame multiple."; die;}
  my $tsave = $t;
  my $hr = sprintf("%i", ($t/3600));
  $t = $t-3600*$hr;
  my $min = sprintf("%i", ($t/60));
  $t = $t-60*$min;
  my $timef = "";
  if ($format eq "short") {$timef = sprintf("%02d:%02d", $min, $t);}
  else {
    if ($t < 10) {$timef = sprintf("%02d:%02d:0%02.2f", $hr, $min, $t);}
    else {$timef = sprintf("%02d:%02d:%02.2f", $hr, $min, $t);}
  }
  if ($timef eq "") {print "Could not format time $tsave"; die;}
  return $sign.$timef;
}

sub unformatTime($$$) {
  my $timef = shift;
  my $type = shift;
  my $noerror = shift;

  my $tsave = $timef;
  if ($timef =~ /(-?)((\d+):)?(\d+):([\d\.]+)/) {
    my $sign = $1;
    my $hr = (1*$3);
    my $min = (1*$4);
    my $ts = (1*$5);

    my $sec = 0;
    if ($hr > 0)  {$sec = ($hr*3600);}
    if ($min > 0) {$sec = ($sec + ($min*60));}
    $sec = ($sec + $ts);
    if ($type ne "noFrameCheck" && ($sec*$framesPS) =~ /\./) {print "unformatTime $timef=$sec is not a frame multiple."; die;}
    return ($sign eq "-" ? (-1*$sec):$sec);
  }
  elsif (!$noerror) {print "ERROR(unformatTime) $bk-$ch-$pg: Could not convert \"$timef\" to seconds!"; die;}
  
  # do nothing but return input
  else {
    print "WARNING(unformatTime) $bk-$ch-$pg: Unexpected input \"$timef\", conversion to seconds was not attempted.\n";
    return $timef;
  } 
}

#CREATE A SILENT MPG FROM A SINGLE JPG IMAGE
sub makeSilentSlide($$) {
  my $pagename = shift;
  my $imagefile = shift;
  
  if (!-e $imagefile) {print "ERROR: Missing image: \"$pagename\"\n"; die;}
  if ($imagefile !~ /\.jpg$/) {print "ERROR: Image must be jpg: \"$pagename\"\n"; die;}
  if (!-e $videodir) {`mkdir \"$videodir\"`;}
  
  # is this a chapter image?
  my $subdir = "";
  if    ($pagename =~ /^fn-(.*?)-(\d+)-(\d+)-(\d+)/) {$subdir = $1;}
  elsif ($pagename =~ /^(.*?)-(\d+)-(\d+)/) {$subdir = $1;}
  
  if ($subdir) {
    if (!-e "$videodir/$subdir") {`mkdir \"$videodir/$subdir\"`;}
    $subdir .= "/";
  }
  
  `jpeg2yuv -v 0 $JPEG2YUV -j \"$imagefile\" | mpeg2enc $MPEG2ENC -v 0 -o \"$videodir/videotmp/$pagename.m2v\"`;
  
  `mplex -v $Verbosity $MPLEX \"$videodir/videotmp/$pagename.m2v\" \"$audiodir/blankaudio.ac3\" -o \"$videodir/$subdir$pagename.mpg\"`;
  
}

#CREATE A SLIDE WITH AUDIO FROM A SINGLE JPG IMAGE AND AUDIO FILE
sub makeAudioSlide($$$$$) {
  my $pagename = shift;
  my $imagefile = shift;
  my $audiofile = shift;
  my $tlen = shift;
  my $seekto = shift;
  my $mplex = shift; # used to create special mpg files which can be concatenated
  
  if (!-e $videodir) {`mkdir \"$videodir\"`;}
    
  # get subdirectory for this page
  my $subdir = "";
  if    ($pagename =~ /^fn-(.*?)-(\d+)-(\d+)-(\d+)/) {$subdir = $1;}
  elsif ($pagename =~ /^(.*?)-(\d+)-(\d+)/) {$subdir = $1;}
  
  if ($subdir) {
    if (!-e "$videodir/$subdir") {`mkdir \"$videodir/$subdir\"`;}
    $subdir .= "/";
  }
  
  if (!-e $imagefile) {print "ERROR: Missing image: \"$imagefile\"\n"; die;}
  if ($imagefile !~ /\.jpg$/) {print "ERROR: Image must be jpg: \"$imagefile\"\n"; die;}
  if (!-e $audiofile) {print "ERROR: Missing audio file: \"$audiofile\"\n"; die;}
  if ($audiofile !~ /\.ac3$/i) {print "ERROR: Audio must be AC3: \"$audiofile\"\n"; die;}
  
  # MAKE VIDEO FOR SLIDE
  `jpeg2yuv -v 0 $JPEG2YUV -j \"$imagefile\" | mpeg2enc $MPEG2ENC -v 0 -o \"$videodir/videotmp/$pagename.m2v\"`;
  
  # MAKE AUDIO FOR SLIDE
  if (defined($tlen)) {$tlen = "-t $tlen";}
  if (defined($seekto)) {$seekto = "-ss $seekto";}
  `ffmpeg -v $Verbosity $tlen -i \"$audiofile\" $seekto -acodec copy -y \"$videodir/videotmp/$pagename.m2a\"`;
  
  # MUX AUDIO AND VIDEO TOGETHER
  `mplex -v $Verbosity $mplex $MPLEX \"$videodir/videotmp/$pagename.m2v\" \"$videodir/videotmp/$pagename.m2a\" -o \"$videodir/$subdir$pagename.mpg\"`;
  
}

# converts internal chapter to real chapter number
# if internal chapter is still (non-audio), -1 is returned (indeterminate)
sub internalChapter2Real($$$) {
  my $bk = shift;
  my $ic = shift;
  my $quiet = shift;

  my $res = -1;
  if ($haveAudio{"$bk-$ic"} =~ /\-(\d+)/i) {
    $res = (1*$1);
    my $i = ($ic-1);
    while ($i >= 1 && $haveAudio{"$bk-$i"} eq $haveAudio{"$bk-$ic"}) {
      $i--; 
      $res++; 
    }
  }
  if (!$quiet && $res == -1) {print "ERROR: internalChapter2Real, indeterminate chapter for $bk $ic.\n";}

  return $res;
}

sub realChapter2Internal($$) {
  my $bk = shift;
  my $rc = shift;

  my $ret = -1;
  my $ic;
  for ($ic=1; $ic<=$lastChapter{$bk}; $ic++) {
    if (&internalChapter2Real($bk, $ic, 1) == $rc) {$ret = $ic; last;}
  }

  return $ret;
}

# returns 1 only if book and chapter has a multi-chapter audio file
sub isMultiChapter($$) {
  my $bk = shift;
  my $ch = shift;
 
  if ($haveAudio{"$bk-$ch"} =~ /^[^-]+-[^-]+-(\d+)-(\d+)\.ac3$/i ||
      $haveAudio{"$bk-$ch"} =~ /^[^-]+-[^-]+-(\d+):\d+-(\d+):\d+\.ac3$/i) {
    return 1;
  }
  
  return 0;
}

# returns time offset of an internal chapter within its audio file
# returns 0 unless a multi-chapter audio file is associated with the chapter
sub multiChapTimeOffset($$) {
  my $bk = shift;
  my $ch = shift;
  
  my $os = 0;
  
  if ($haveAudio{"$bk-$ch"} =~ /^[^-]+-[^-]+-(\d+)-(\d+)\.ac3$/i ||
      $haveAudio{"$bk-$ch"} =~ /^[^-]+-[^-]+-(\d+):\d+-(\d+):\d+\.ac3$/i) {
    my $cs = (1*$1);
    my $ce = (1*$2);
    
    # convert audio file name chapters to internal chapters
    my $chos = (&audioFileInternalFirstChapter($haveAudio{"$bk-$ch"}) - $cs);

    $cs = ($cs+$chos);
    $ce = ($ce+$chos);
  
    # calculate requested offset
    for (my $c=$cs+1; $c<=$ce; $c++) {
      if ($c<=$ch) {$os = ($os + $Chapterlength{$bk."-".($c-1)});}
    }
  
    # round offset to nearest frame
    my $f = $framesPS*$os;
    my $framesRND = sprintf("%i", $f);
    $os = ($framesRND/$framesPS);
  }
  else {return 0;}

  return $os;
}

# returns the first internal chapter of an audio file
# returns -1 if the passed "filename" is not a valid audio file name
sub audioFileInternalFirstChapter($$) {
  my $f = shift;
  my $quiet = shift;
  
  my $ret = -1;
  if ($f =~ /^[^-]+-([^-]+)-(\d+)[-:].*?\.ac3$/i) {
    my $bk = $1;
    my $cs = (1*$2);

    my $c;
    for ($c=1; $c<=$lastChapter{$bk}; $c++) {
      if ($haveAudio{"$bk-$c"} && $haveAudio{"$bk-$c"} eq $f) {$ret = $c; last;}
    }
  }
  
  if (!$quiet && $f eq "still") {print "NOTE: Asking chapter offset of non-audio chapter.\n";}
  if (!$quiet && $ret == -1) {print "ERROR: Indeterminate chapter offset \"$f\".\n";}
  
  return $ret;
}

# returns the last internal chapter of an audio file
# returns -1 if the passed "filename" is not a valid audio file name
sub audioFileInternalLastChapter($$) {
  my $f = shift;
  my $quiet = shift;
  
  my $ret = &audioFileInternalFirstChapter($f, $quiet);
  if ($ret == -1) {return $ret;}
   
  if ($f =~ /^[^-]+-[^-]+-(\d+)-(\d+)\.ac3$/i ||
      $f =~ /^[^-]+-[^-]+-(\d+):\d+-(\d+):\d+\.ac3$/i) {
    my $cs = (1*$1);
    my $ce = (1*$2);
    $ret = $ret + ($ce-$cs);
  }

  return $ret;
}

sub readPTS($) {
	my $f = shift;
	my $lastPTS = -1;
	my $firstPTS = -1;
	if (open(PTS, ">$videodir/videotmp/pts.txt")) {
		print PTS `dvbsnoop -s ps -if \"$f\"`;
		close(PTS);
		open(PTS, "<$videodir/videotmp/pts.txt");
		while (<PTS>) {
			chomp;
			if ($_ =~ /^Stream_id:/) {$streamid = $_;}
			if ($_ =~ /\s+(\d+)\s+\(.*?\)\s+\[= 90 kHz-Timestamp:\s*(.*?)\]/) {
				my $t = $1;
				my $ts = $2;
				if ($streamid =~ /MPEG_pack_start/) {
					$lastPTS = $t*(1/90000);
					if ($firstPTS == -1) {$firstPTS = $t*(1/90000);}
				}
			}
		}
		close(PTS);
	}
	#print "FIRST PTS=$firstPTS\n";
	return $lastPTS;
}

1;
