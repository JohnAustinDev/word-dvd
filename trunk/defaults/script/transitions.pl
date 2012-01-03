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

#usage transitions.pl scriptDir inputDir outputDir audioDir book [args...]
$debug = 0;

$prepage = 10;
$rewind = 15;
$forward = 10;
$firstChapter = 1;

$scriptdir = @ARGV[0];
$IDR = @ARGV[1];
$ODR = @ARGV[2];
$ADR = @ARGV[3];
$MBK = @ARGV[4];

# capture arguments
$i=5;
while($a = @ARGV[$i++]) {
  if    ($a =~ /^\s*margin=(\d+)\s*$/i) {$prepage = $1;}
  elsif ($a =~ /^\s*numpts=(\d+)\s*$/i) {$numpts = $1;}
  elsif ($a =~ /^\s*chapter=(\d+)\s*$/i) {$firstChapter = $1;}
  else {print "Bad Argument $a\n"; die;}
}

if ($MBK eq "") {
  print "usage: ./xtransitions.pl book [chapter=??] [margin=??] [numpts=??]\n";
  print "\n";
  print "Press the space bar when the reading begins. Playback will jump to\n";
  print "the end of the chapter, then press the spacebar when the chapter read-\n";
  print "ing ends. Playback will jump to before the 1st calculated page tran-\n";
  print "sition. Then press spacebar at the exact transition. Continue until\n";
  print "all pages are recorded. Use navigation keys below as needed:\n";
  print "\n";      
  print "save transition, goto \"margin\" s before next---- space-bar\n";
  print "log time 0 as reading start -------------------- s \n";
  print "save transition but continue without skipping--- u \n";
  print "\n";
  print "go to start of current page--------------------- up | t \n";
  print "go back to last page --------------------------- b \n";
  print "go to next page -------------------------------- n \n";
  print "goto page n ------------------------------------ [0-9]+ g\n";
  print "goto chapter n --------------------------------- [0-9]+ ctrl+g\n";
  print "rewind $rewind seconds ------------------------------ left | r \n";
  print "rewind 4 seconds ------------------------------- ctrl+left | ctrl+r \n";
  print "forward $forward seconds ----------------------------- right | f \n";
  print "forward 4 seconds ------------------------------ ctrl+right | ctrl+f \n"; 
  print "\n";  
  print "go back to last chapter ------------------------ ctrl+b \n";
  print "go to next chapter ----------------------------- ctrl+n \n";      
  print "\n";
  print "quit ------------------------------------------- x | q | ctrl+c \n";  
  print "pause ------------------------------------------ p \n";
  print "status ----------------------------------------- z \n";
  exit;
}

require "$scriptdir/shared.pl";
if (!-e "$outaudiodir") {&sys("mkdir \"$outaudiodir\"");}
&readDataFiles();
&readTransitionInformation();

if (!exists($books{$MBK})) {
  print "Unknown book: \"$MBK\", exiting...\n";
  exit;
}

print "\nRUNNING transitions.pl $MBK $firstChapter\n";

# backup our pageTiming.txt file
&sys("cp -f \"$indir/pageTiming.txt\" \"$backupdir/pageTiming.txt\"");

# remove ffmpeg time file so it doesn't mess initial time up
if (-e "$outaudiodir/audiotmp") {&sys("rm \"$outaudiodir/audiotmp\"");}

use Term::ReadKey;
ReadMode 4;

$quit = "false";
$firstChapter = &realChapter2Internal($MBK, $firstChapter);
if ($firstChapter == -1) {$firstChapter = 1;}
$wchapter = $firstChapter;
for ($MCH=$firstChapter; $quit ne "true" && $MCH <= $lastChapter{$MBK}; $MCH++) {

  # skip over any chapters which don't have audio
  $gotAudio = 1;
  if ($haveAudio{$MBK."-".$MCH} eq "still") {print "\n\nSKIPPING non audio chapter $MCH\n\n";}
  $done = 0;
  while ($haveAudio{$MBK."-".$MCH} eq "still") {    
    if ($wchapter <= $MCH) {
      $MCH = ($MCH + 1);
      if ($MCH == $lastChapter{$MBK}) {
        if ($done) {$gotAudio = 0; last;}
        $done++;
        $MCH--; 
        $wchapter = $MCH;
      }
    }
    else {
      $MCH = ($MCH - 1);
      if ($MCH == 0) {
        if ($done) {$gotAudio = 0; last;}
        $done++;
        $MCH++; 
        $wchapter = $MCH;
      }
    }
  }
  if (!$gotAudio) {last;}
  $wchapter = $MCH;

  $gotoNextChapter = "false";
  $MPG=0;
  
  &audioPlayPage("start", $MPG);
  
  while($quit ne "true" && $gotoNextChapter ne "true") {
    &doTimingAdjustment();
    &readDataFiles();

    if ($MPG == $lastPage{$MBK."-".$MCH}) {
      print "\n\n\n";
      print "************* LAST PAGE **************\n";
      print "* PRESS SPACEBAR WHERE READING ENDS. *\n";
      print "************* LAST PAGE **************\n\n";
    }
     
    if (!$AudioPlaying) {&audioPlayPage("end", $MPG);}
    else {&updateStatus();}
    &showPageImage($MBK, $MCH, $MPG);
    $gotoNextPage = "false";
    while ($gotoNextPage ne "true") {
      $res = ReadKey(-1); if (ord($res) == 0) {&updateTime(); next;}
      $res = getKeyCode($res);     
#print "\n\n\n\nKEY \"$res\"\n\n\n\n"; ReadMode 0; &DIE();
      $newEntry = "false";
            
      # quit ( Enter | q | ^c )      
      if ($res eq "120" || $res eq "113" || $res eq "3")  {print "\nquit\n"; $gotoNextPage = "true"; $quit = "true";}
      
      # save transition (space bar)
      elsif ($res eq "32")  {
        if ($debug) {print "\nKEYBOARD=$res (Save Transition)\n";}
        $newEntry = "true";
        $gotoNextPage = "true";
        &audioStop();
        if ($MPG == 0) {&saveTime("start");}
        elsif ($MPG == $lastPage{$MBK."-".$MCH}) {
          &saveTime("end");
          if (&isMultiChapter($MBK, $MCH) && $MCH < &audioFileInternalLastChapter($haveAudio{$MBK."-".$MCH})) {
            &saveTime("multi-chap-end");
          }
        }
        else {
          &saveTime("trans");
          if ($MPG>0 && $numpts) {
            $MPG += int($lastPage{"$MBK-$MCH"}/$numpts)-1;
            if ($MPG > $lastPage{"$MBK-$MCH"}-1) {$MPG = $lastPage{"$MBK-$MCH"}-1;}
          }  
        }   
      }

      # save transition but continue reading unbroken ( down-arrow )
      elsif ($res eq "117")  {
        if ($debug) {print "\nKEYBOARD=$res (Save transition and continue)\n";}
        $newEntry = "true";
        $gotoNextPage = "true";  
        if ($MPG == 0) {&saveTime("start");}
        elsif ($MPG == $lastPage{$MBK."-".$MCH}) {
          &saveTime("end");
          if (&isMultiChapter($MBK, $MCH) && $MCH < &audioFileInternalLastChapter($haveAudio{$MBK."-".$MCH})) {
            &saveTime("multi-chap-end");
          }
        }
        else {&saveTime("trans");}            
      }
            
      # log time 0 as reading start ( s )
      elsif ($res eq "115") {
        if ($debug) {print "\nKEYBOARD=$res (Save 0s as reading start)\n";}
        $newEntry = "true";
        &audioStop();
        $gotoNextPage = "true";
        &saveTime("start", 1);
      }
      
      # go to top of current page- image and audio ( up-arrow | t )
      elsif ($res eq "27.91.65" || $res eq "116") {
        if ($debug) {print "\nKEYBOARD=$res (Go to start of current page)\n";}
        print "\ntop of page\n";
        &audioStop();
        &doTimingAdjustment();
        &audioPlayPage("start", $MPG);
        &showPageImage($MBK, $MCH, $MPG);
        &updateStatus(); 
      } 

      # go back to last page ( b )
      elsif ($res eq "98") {
        if ($debug) {print "\nKEYBOARD=$res (Go to previous page)\n";}
        print "\nback one page.\n";
        $gotoNextPage = "true";
        $MPG = $MPG-2;
      } 
      
      # go to next page ( n )
      elsif ($res eq "110") {
        if ($debug) {print "\nKEYBOARD=$res (Go to page next page)\n";}
        print "\nnext page.\n";
        $gotoNextPage = "true";
      }
      
      # goto a particular page
      elsif ($res eq "103" && $gtnum ne "") {
        if ($debug) {print "\nKEYBOARD=$res (Go to page $gtnum)\n";}
        print "\ngoto page $gtnum.\n";
        $gotoNextPage = "true";
        $MPG = $gtnum-1;
      }

      # goto a particular chapter
      elsif ($res eq "7" && $gtnum ne "") {
        if ($debug) {print "\nKEYBOARD=$res (Go to chapter $gtnum)\n";}
        print "\ngoto chapter $gtnum.\n";
        $MCH = &realChapter2Internal($MBK, $gtnum);
        if ($MCH < 1) {$MCH = 1;}
        if ($MCH > $lastChapter{$MBK}) {$MCH = $lastChapter{$MBK};}
        $gotoNextPage = "true"; 
        $gotoNextChapter = "true"; 
        $MCH--;
      }
      
      # go back a chapter ( ^b )
      elsif ($res eq "2") {
        if ($debug) {print "\nKEYBOARD=$res (Go to previous chapter)\n";}
        print "\nback chapter.\n";
        $MCH--;
        if ($MCH < 1) {$MCH = 1;} 
        $gotoNextPage = "true"; 
        $gotoNextChapter = "true"; 
        $MCH--;
      }      
      
      # go to next chapter ( ^n )
      elsif ($res eq "14") {
        if ($debug) {print "\nKEYBOARD=$res (Go to next chapter)\n";}
        print "\nnext chapter.\n"; 
        $MCH++; 
        if ($MCH > $lastChapter{$MBK}) {$MCH = $lastChapter{$MBK};}  
        $gotoNextPage = "true"; 
        $gotoNextChapter = "true"; 
        $MCH--;
      }
      
      # rewind ( left-arrow | r )
      elsif ($res eq "27.91.68" || $res eq "114") {
        if ($debug) {print "\nKEYBOARD=$res (Rewind $rewind seconds)\n";}
        print "\nrewind $rewind s.\n";
        &audioRewind($rewind);
        &updateStatus();
      }
      
      # forward ( right-arrow | f )
      elsif ($res eq "27.91.67" || $res eq "102") {
        if ($debug) {print "\nKEYBOARD=$res (Forward $forward seconds)\n";}
        print "\nforward $forward s.\n";
        &audioForward($forward);
        &updateStatus();
      }

      # rewind 4 s ( ctrl+left-arrow | ctrl+r )
      elsif ($res eq "27.91.49.59.53.68" || $res eq "18") {
        if ($debug) {print "\nKEYBOARD=$res (Rewind 4 seconds)\n";}
        print "\nrewind 4 s.\n"; 
        &audioRewind(4);
        &updateStatus();
      }
      
      # forward 4 s ( ctrl+right-arrow | ctrl+f )
      elsif ($res eq "27.91.49.59.53.67" || $res eq "6") {
        if ($debug) {print "\nKEYBOARD=$res (Forward 4 seconds)\n";}
        print "\nforward 4 s.\n";
        &audioForward(4);
        &updateStatus();
      }
            
      # pause ( p )
      elsif ($res eq "112") {
        if ($debug) {print "\nKEYBOARD=$res (Pause/Continue)\n";}
        if (!$PauseTime) {
          print "\nPaused!\n";
          $PauseTime = &audioGetTime();
          &audioStop();
        }
        else {
          print "\nResumed.\n";
          &audioPlay($PauseTime);
          $PauseTime=0;
        }
        &updateStatus();
      }
      
      # status ( z )
      elsif ($res eq "122") {
        if ($debug) {print "\nKEYBOARD=$res (Show status)\n";}
        &updateStatus();
      }
      
      elsif ($debug) {print "\nKEYBOARD=$res (Unknown command)\n";}
      
      # collect numbers for goto command (0-9)
      if($res >= 48 && $res <= 57) {$gtnum = $gtnum.chr($res);}
      else {$gtnum = "";}
      
    }
    $MPG++;
    &audioStop();
    
    # new entries follow a different flow than navigation commands
    my $gotoNextCH = 0;
    if ($newEntry eq "true") {
      if ($MPG == 1) {$MPG = $lastPage{"$MBK-$MCH"};}
      elsif ($MPG > $lastPage{"$MBK-$MCH"}) {
        if ($lastPage{"$MBK-$MCH"} == 1) {$gotoNextCH = 1;}
        else {$MPG = 1;}
      }
      elsif ($MPG == $lastPage{"$MBK-$MCH"}) {$gotoNextCH = 1;}
      
      if ($gotoNextCH) {
        print "\n\nMove on to the next chapter? (y/n):";
        while (!defined($res = ReadKey(-1))) {}
        getKeyCode($res); # insure key is completely read
        print "\n";
        if ($res !~ /^y$/i) {$MPG--;}
        else {$gotoNextChapter = "true";}
      }
    }
    else {
      if ($MPG < 0) {$MPG = 0;}
      if ($MPG > $lastPage{"$MBK-$MCH"}) {$MPG = $lastPage{"$MBK-$MCH"};}
    }
  }
  
  if ($MPG == $lastPage{$MBK."-".$MCH}) {print "\n\nCHAPTER COMPLETED...\n";}
}
$MCH--;
if ($MPG == ($lastPage{$MBK."-".$MCH}) && $MCH == $lastChapter{$MBK}) {print "\n\n$MBK COMPLETED!!\n";}
print "\n\nexiting...\n";

&sys("pkill -9 eog");

# Clean and sort the pageTiming.txt file
&sortPageTimingFile("$indir/pageTiming.txt");

if (!$debug && -e "$outaudiodir/audiotmp") {&sys("rm -r -f \"$outaudiodir/audiotmp\"");}

ReadMode 0;                          
################################################################################
################################################################################
sub doTimingAdjustment() {
  &sys("\"$scriptdir/timeAnalysis.pl\" \"$scriptdir\" \"$IDR\" \"$ODR\" \"$ADR\"");
  &sys("\"$scriptdir/audio.pl\" \"$scriptdir\" \"$IDR\" \"$ODR\" \"$ADR\"");
}

sub updateStatus() {
  my $cp = &audioGetTime(1);

  my $targr = "$MBK ".&internalChapter2Real($MBK, $MCH).": ";
  my $targi = "$MBK-$MCH-";
    
  my $v;
  if ($MPG < 1) {
    $targr .= "READING START";
    $targi .= "s"; 
    $v = $firstPageGap{$MBK."-".$MCH};
  }
  elsif ($MPG >= $lastPage{$MBK."-".$MCH}) {
    $targr .= "READING END";
    $targi .= "e"; 
    $v = $Chapterlength{$MBK."-".$MCH} - $firstPageGap{$MBK."-".$MCH};
  }
  else {
    $targr .= "PAGE END";
    $targi .= ($MPG+1);
    $v = &getCalcTime($MBK, $MCH, ($MPG+1));
  }
    
  $v  = &formatTime(&roundToNearestFrame($v), "short");
  $cp = &formatTime(&roundToNearestFrame($cp), "short");

  print "\n";
  print sprintf("%-30s%19s%s\n", $targr, "CALCULATED TARGET: ", $v);
  print sprintf("%-30s%19s%s", "SPACEBAR==> ".$targi, "REAL TIME: ", $cp, "short");
}

sub updateTime() {
    my $t = time;
    if ($LastTimeCheck && $LastTimeCheck != $t) {
      my $cp = &audioGetTime(1);
      print "\b\b\b\b\b";
      print &formatTime(&roundToNearestFrame($cp), "short");  
    }
    $LastTimeCheck = $t;
}

sub saveTime($$) {
  my $type = shift;
  my $savezero = shift;
  
  my $posuf = $savezero ? 0:&audioGetTime($type ne "multi-chap-end");
    
  my $pos = &formatTime(&roundToNearestFrame($posuf));
  
  my $en = "";
  if    ($type eq "trans") {$en = "$MBK-$MCH-".($MPG+1);}
  elsif ($type eq "start") {$en = "$MBK-$MCH-s";}
  elsif ($type eq "end")   {$en = "$MBK-$MCH-e";}
  elsif ($type eq "multi-chap-end")   {$en = "$MBK-".($MCH+1)."-chs";}
  my $entry = "$en = $pos";

  print "\n\n";
  if (exists($pageTimingEntry{$en})) {
    &audioStop();
    print sprintf("IN PAGETIMING.TXT FILE: %s\n", $pageTimingEntry{$en});
    print sprintf("EXISTS! SAVE NEW ENTRY: %s ?(y/n):",$entry);
    my $res;
    while (!defined($res = ReadKey(-1))) {} # playback starts during ReadKey (???)
    getKeyCode($res); # insure key is completely read
    print "\n";
    if ($res =~ /^n$/i) {
      print "Entry \"$en\" was not saved!\n";
      return;
    }
  }
  
  # if this is "multi-chap-end", all chapter values must be checked and possibly updated
  if ($type eq "multi-chap-end") {
    my %entries;
    my $needed = 0;
    my $delta = &roundToNearestFrame(&multiChapTimeOffset($MBK, ($MCH+1)) - $posuf); # to be added to original time
    my $m = quotemeta($MBK."-".($MCH+1));
    for my $fen (sort keys %pageTimingEntry) {
      if ($fen !~ /^$m[\-:]/) {next;}
      if ($fen =~ /^$m\-chs/) {next;}
      $needed = 1;
      $entries{$fen} = $delta;
    }
    for my $fen (keys %entries) {
      print "UPDATE NEEDED: $fen ".($entries{$fen} > 0 ? "+":"").$entries{$fen}." s.\n";
    }
    if ($needed) {
      &audioStop();
      print "\nMAKE THESE UPDATES? (y/n):";
      my $res;
      while (!defined($res = ReadKey(-1))) {} # playback starts during ReadKey (???)
      getKeyCode($res); # insure key is completely read
      print "\n$res";
      if ($res =~ /^y$/i) {
        print "\nUpdating entries...\n";
        &updateEntriesBy("$indir/pageTiming.txt", \%entries);
        print "Finished updating entries.\n\n";    
      }
      else {
        print "\nNOT UPDATING! The values above may now be incorrect!\nPress any key to continue...\n\n";
        my $res;
        while (!defined($res = ReadKey(-1))) {} # playback starts during ReadKey (???)
        getKeyCode($res); # insure key is completely read
      }
    }
  }

  open(INF, ">>$indir/pageTiming.txt") || &DIE("Could not open $indir/pageTiming.txt\n");
  if (!defined($hasRT)) {print INF "\n"; $hasRT = "true";}     
  if (exists($transitionVerse{"$MBK-$MCH-$MPG"})) {
    my $trans = $transitionVerse{"$MBK-$MCH-$MPG"};
    $trans =~ s/ValuE/$pos/;
    print INF "$trans\n";
    print sprintf(">> %.64s...\n", $trans);
  }
  elsif ($MPG > 0 && $MPG < $lastPage{"$MBK-$MCH"}) {print "\nWARNING!! No verse data available for \"$MBK-$MCH-$MPG\"\n\n";}
  print INF "$entry\n";
  print ">> $entry\n";
  if ($type eq "trans") {
    my $tdel = $posuf - &getCalcTime($MBK, $MCH, ($MPG+1));
    print "\nTRANSITION DELTA:".sprintf("%2.2f\n", $tdel);
  }
  print "*************************************************************\n";
  close(INF);
}

sub showPageImage($$$) {
  my $b = shift;
  my $c = shift;
  my $p = shift;
  &sys("pkill -9 eog");
  if ($p < 1) {$p = 1;}
  if ($p > $lastPage{"$b-$c"}) {$p = $lastPage{"$b-$c"};}
  &sys("eog \"$imagedir/$b/$b-$c-$p.jpg\" 1> /dev/null 2> /dev/null &");
  &waitAndRefocus(quotemeta("$b-$c-$p.jpg"));
  #print "Showing $b-$c page $p.\n";
}

sub readTransitionInformation() {
  if (-e "$listdir") {
    opendir(LSD, "$listdir");
    @entries = readdir(LSD);
    closedir(LSD);
  
    foreach $entry (@entries) {
      if ($entry !~ /-trans\.csv$/) {next;}
      open (INF, "<$listdir/$entry") || die &DIE("Could not open $listdir/$entry");
      my $line = 0;
      while (<INF>) {
        $line++;
        if    ($_ =~ /^unknown$/) {next;}
        elsif ($_ =~ /^\s*\#/) {next;}
        elsif ($_ =~ /^last_page$/) {next;}
        elsif ($_ !~ /^\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\{.*?\})/) {print "WARNING: Bad translation listing line $line, $listdir/$entry, \"$_\"\n"; next;}
        my $page = $1;
        my $verse = $2;
        my $trans = $3;
        $transitionVerse{$page} = $verse." = ValuE ".$trans;
      }
      close(INF);
    }
  }
}

sub getKeyCode($) {
  my $k = ord(shift);
  my $c = $k;
  
  $k = ord(ReadKey(-1));
  while ($k != 0) {
    $c = $c.".".$k;
    $k = ord(ReadKey(-1));
  }
  return $c;
}

sub getCalcTime($$$$) {
  my $b = shift;
  my $c = shift;
  my $p = shift;
  my $t = shift;
  
  my @chaps = split(/,/, $Chapterlist{$b."-".$c});
  if ($p < 0) {$p = 0;}
  if ($p > $lastPage{"$b-$c"}) {$p = $lastPage{"$b-$c"};}
  if ($t eq "formatted") {return $chaps[($p-1)];}
  else {return &unformatTime($chaps[($p-1)]);}
}

my %allAT;
sub sortAT {
  my $bka = $allAT{$a};
  $bka =~ /^([^-]+)-(\d+)-([\d\w]+)\s*=\s*(\S+)/;
  $bka = $bkorder{$1};
  my $cha = $2;
  my $pa = $3;
  my $ta = $4;
  
  my $bkb = $allAT{$b};
  $bkb =~ /^([^-]+)-(\d+)-([\d\w]+)\s*=\s*(\S+)/;
  $bkb = $bkorder{$1};
  my $chb = $2;
  my $pb = $3;
  my $tb = $4;
  
  my $r = $bka <=> $bkb;
  if ($r != 0) {return $r;}
  $r = $cha <=> $chb;
  if ($r != 0) {return $r;}
  if ($pa eq "chs") {return -1;}
  if ($pb eq "chs") {return 1;}
  return $ta cmp $tb;
}

my %allAV;
sub sortAV {
  my $bka = $allAV{$a};
  $bka =~ /^([^-]+)-(\d+).*=\s*(\S+)/;
  $bka = $bkorder{$1};
  my $cha = $2;
  my $ta = $3;
  
  my $bkb = $allAV{$b};
  $bkb =~ /^([^-]+)-(\d+).*=\s*(\S+)/;
  $bkb = $bkorder{$1};
  my $chb = $2;
  my $tb = $3;
  
  my $r = $bka <=> $bkb;
  if ($r != 0) {return $r;}
  $r = $cha <=> $chb;
  if ($r != 0) {return $r;}
  return $ta cmp $tb;
}

# plays current audio file starting at $st seconds
# does nothing if audio is already playing
sub audioPlay($) {
  my $st = shift;
  if ($st < 0) {$st = 0;}
  if ($AudioPlaying) {return;}
  $tmp = "$outaudiodir/audiotmp";
  if (!-e "$tmp") {&sys("mkdir \"$tmp\"");}
  my $f = $audiodir."/".$haveAudio{$MBK."-".$MCH};
  &sys("ffplay -x 200 -y 160 -stats -ss $st \"$f\" 1> \"$tmp/ffplay.txt\" 2> /dev/null &");
  $AudioPlaying = 1;
  &waitAndRefocus("(".quotemeta($f)."|FFplay)");
}

# plays audio starting from page $p of current audio file
# does nothing if audio is already playing
sub audioPlayPage($$) {
  my $t = shift;
  my $p = shift;
  
  if ($AudioPlaying) {return;}
  
  my $b = $MBK;
  my $c = $MCH; 
  
  my $pos = 0;
  if ($t eq "end") {
    if ($p > 0 && $p < $lastPage{$b."-".$c}) {  
      $pos = &getCalcTime($b, $c, ($p+1)) - $prepage;
      if ($pos < 0) {$pos = 0;}
    }
    elsif ($p == $lastPage{$b."-".$c}) {$pos = $Chapterlength{$b."-".$c} - 10;}
  }
  elsif ($t eq "start") {
    if ($p > 0 && $p <= $lastPage{$b."-".$c}) {  
      $pos = &getCalcTime($b, $c, $p);
      if ($pos < 0) {$pos = 0;}
    }
    elsif ($p == 0) {$pos = 0;}
  }
  
  if (&isMultiChapter($b, $c)) {$pos = &denormalizeMultiChapTime($b, $c, $pos);}
  
  my $at = &audioGetTime();
  my $dt = $pos -$at;
  &audioPlay($pos);
  print "\n";
  if ($at) {  
    if ($dt > 5) {print sprintf("%-30s%19s%i s", "", "SKIPPING: ", $dt);}
    &updateStatus();
  }
  #print "Started $b-$c at $pos seconds in $p (".$lastPage{$b."-".$c}.")\n";  
}

sub audioStop() {
  if (!$AudioPlaying) {return;}
  &sys("pkill -9 ffplay"); 
  $AudioPlaying = 0;
}

sub audioRewind($) {
  my $s = shift;
  &audioStop();
  my $t = &audioGetTime();
  $t = $t-$s; 
  if ($t < 0) {$t = 0;}
  &audioPlay($t);
}

sub audioForward($) {
  my $s = shift;
  &audioStop();
  my $t = &audioGetTime();
  my $fl = $Chapterlength{$MBK."-".$MCH};
  $s = $t+$s;
  if ($s > $fl) {$s = $fl-$s;}
  &audioPlay($s);
}

sub audioGetTime($) {
  my $normalize = shift;
    
  my $tmp = "$outaudiodir/audiotmp";
  my $time = 0;
  open(INF, "<$tmp/ffplay.txt") || return 0;
  $f = <INF>;
  while($f =~ s/([\d\.]+) A\-V//) {$time = $1;}
  close(INF);
  
  if ($normalize && &isMultiChapter($MBK, $MCH)) {$time = &normalizeMultiChapTime($MBK, $MCH, $time);}
  
  return $time;  
}

sub waitAndRefocus($) {
  my $wait4win = shift;
  my $waiting = 15;
  while ($waiting > 0) {
    &sys("sleep 0.5s");
    my $w = &sys("wmctrl -l");
    if ($w =~ /^\S+\s+\S+\s+\S+\s+$wait4win\s*$/gm) {$waiting = 0;}
    $waiting--;
  }
  my $t = &sys("pwd"); chomp($t);
  $t =~ s/\/home\/[^\/]+/\~/;
  &sys("wmctrl -a \"$t\"");
}

sub normalizeMultiChapTime($$$) {
  my $bk = shift;
  my $ch = shift;
  my $t = shift;
  
  my $offset = &multiChapTimeOffset($bk, $ch);
  $t = ($t - $offset);
  
  return $t;
}

sub denormalizeMultiChapTime($$$) {
  my $bk = shift;
  my $ch = shift;
  my $t = shift;

  my $offset = &multiChapTimeOffset($bk, $ch);
  $t = ($t + $offset);
  
  return $t;  
}

sub sortPageTimingFile($) {
  my $f = shift;
  &sys("mv -f \"$f\" \"$f.tmp\"");
  open(INF, "<$f.tmp") || return;
  open(OUTF, ">$f") || return;
  my $lastLineWasBlank;
  while(<INF>) {
    # capture all fixed timing parameters
    if    ($_ =~ /^\s*([^-#]+-[^-]+-[\d\w]+)\s*=/) { 
      chomp;
      if (exists($allAT{$1})) {print sprintf("\n REMOVED:%.64s\nRETAINED:%.64s\n", $allAT{$1}, $_);} 
      $allAT{$1} = $_;
    }
    # capture all text-locative parameters
    elsif ($_ =~ /^\s*([^-#]+-[^:]+:\d+)\s*=/) {
      chomp;
      if (exists($allAV{$1})) {print sprintf("\n REMOVED:%.64s\nRETAINED:%.64s\n", $allAV{$1}, $_);} 
      $allAV{$1} = $_;
    }
    elsif ($_ =~ /^# INFO/) {next;}
    else {
      if ($_ =~ /^\s*$/) {
        if ($lastLineWasBlank eq "true") {next;}
        $lastLineWasBlank = "true";
      }
      else {$lastLineWasBlank = "false";}
      print OUTF $_;
    }
  }
  close(INF);
  close(OUTF);
  
  open(OUTF, ">>$f") || &DIE("ERROR: Could not open $f!\n");
  foreach $k (sort sortAT keys %allAT) {
    $allAT{$k} =~ /^\s*([^-]+)-(\d+)[-:]/; 
    my $bk = $1; 
    my $ch = (1*$2);
    if ($ch != $lch && $allAT{$k} !~ /-chs/) {print OUTF "\n# INFO: Begin Chapter ".&internalChapter2Real($bk, $ch, 1)." (".$haveAudio{"$bk-$ch"}.")\n";}
    $lch = $ch;
    print OUTF "$allAT{$k}\n";
  }
  foreach $k (sort sortAV keys %allAV) {
    $allAV{$k} =~ /^\s*([^-]+)-(\d+)[-:]/; 
    my $bk = $1; 
    my $ch = (1*$2);
    if ($ch != $lch) {print OUTF "\n# INFO: Chapter ".&internalChapter2Real($bk, $ch, 1)." (".$haveAudio{"$bk-$ch"}.")\n";}
    $lch = $ch;
    print OUTF "$allAV{$k}\n";
  }
  close(OUTF);
  unlink("$f.tmp");
}

sub updateEntriesBy($\%) {
  my $f = shift;
  my $eP = shift;

  &sys("mv -f \"$f\" \"$f.tmp\"");
  open(INF, "<$f.tmp") || return;
  open(OUTF, ">$f") || return;
  
  my $new = "";
  while(<INF>) {
    if ($_ =~ /^\s*(.*?)\s*=\s*([\d\:\-\.]+)\s*(.*?)$/) {
      my $e = $1;
      my $v = $2;
      my $t = $3;
      foreach $en (keys %$eP) {
        if ($en eq $e) {
          my $n = "$en = ".&formatTime(&roundToNearestFrame((&unformatTime($v)+$eP->{$en})))." $t";
          $new .= "$n\n";
          print sprintf("appending %.64s...\n", $n);
        }
      }
    }
    print OUTF $_;
  }
  print OUTF "\n$new\n";
  close(INF);
  close(OUTF);
  unlink("$f.tmp");
}

sub sys($) {
  my $cmd = shift;
  my $ret = `$cmd`;
  if ($debug) {
    print "$cmd\n";
    print "$ret\n";
  }
  return $ret;
}

sub DIE($) {
  my $m = shift;
  ReadMode 0;
  print $m;
  die;
}
