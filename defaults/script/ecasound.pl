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

#usage ecasound.pl scriptDir inputDir outputDir audioDir book [args...]

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
  print "usage: ./xecasound book [chapter=??] [margin=??] [numpts=??]\n";
  print "\n";
  print "Press the space bar when the reading begins. Playback will jump to\n";
  print "the end of the audio file then press the spacebar when the reading\n";
  print "stops. Playback will jump to before the 1st calculated page tran-\n";
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

&initBookOrder();
if (!exists($bkorder{$MBK})) {
  print "Unknown book: \"$MBK\", exiting...\n";
  exit;
}

use Audio::Ecasound qw(:simple);
use Term::ReadKey;
ReadMode 4;

print "\nRUNNING ecasound.pl $MBK $MCH $MPG\n";
require "$scriptdir/shared.pl";
&readDataFiles();
&readTransitionInformation();

$quit = "false";
eci("ao-add /dev/dsp");
for ($MCH=$firstChapter; $quit ne "true" && $MCH <= $lastChapter{$MBK}; $MCH++) {
  #print "\nPress <SPACE BAR> at transition\n";
  #print "Press <Enter> to quit\n";
  #print "Press left/right arrows for ff/rw\n\n";
  
  # Convert audio file to wav and play it
  if (!-e "$outaudiodir/audiotmp") {`mkdir "$outaudiodir/audiotmp"`;}
  $f = "$audiodir/".$haveAudio{$MBK."-".$MCH};
  $t = "$outaudiodir/audiotmp/$MBK-$MCH.wav";
  if (!-e $t) {
    $com = "ffmpeg -acodec ac3 -i $f -y $t";
    print $com;
    `$com`;
  }
  eci("ai-add $t");

  $gotoNextChapter = "false";
  $MPG=0;
  while($quit ne "true" && $gotoNextChapter ne "true") {
    &doTimingAdjustment();
    &readDataFiles();

    if ($MPG == $lastPage{$MBK."-".$MCH}) {
      print "\n\n";
      print "************* LAST PAGE **************\n";
      print "* PRESS SPACEBAR WHERE READING ENDS. *\n";
      print "************* LAST PAGE **************\n\n";
    }
     
    if (eci("engine-status") ne "running") {&startEcasound($MBK, $MCH, $MPG);}
    else {&updateStatus();}
    &showPageImage($MBK, $MCH, $MPG);
    $gotoNextPage = "false";
    while ($gotoNextPage ne "true") {
      $res = ReadKey(-1); if (ord($res) == 0) {next;}
      $res = getKeyCode($res);     
#print "\n\n\n\nKEY \"$res\"\n\n\n\n"; ReadMode 0; die;
      $newEntry = "false";
            
      # quit ( Enter | q | ^c )      
      if ($res eq "120" || $res eq "113" || $res eq "3")  {print "quit\n"; $gotoNextPage = "true"; $quit = "true";}
      
      # save transition (space bar)
      elsif ($res eq "32")  {
        $newEntry = "true";
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        $gotoNextPage = "true";  
        if ($MPG == 0) {&saveTime("start");}
        elsif ($MPG == $lastPage{$MBK."-".$MCH}) {&saveTime("end");}
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
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        $newEntry = "true";
        $gotoNextPage = "true";  
        if ($MPG == 0) {&saveTime("start");}
        elsif ($MPG == $lastPage{$MBK."-".$MCH}) {&saveTime("end");}
        else {&saveTime("trans");}            
      }
            
      # log time 0 as reading start ( s )
      elsif ($res eq "115") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        $newEntry = "true";
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        eci("ai-setpos 0"); 
        $gotoNextPage = "true";
        &saveTime("start");
      }
      
      # go to top of current page- image and audio ( up-arrow | t )
      elsif ($res eq "27.91.65" || $res eq "116") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        print "top of page\n";
        &doTimingAdjustment();
        $tt = getCalcTime($MBK, $MCH, $MPG);
        eci("ai-setpos $tt");
        &showPageImage($MBK, $MCH, $MPG);
        &updateStatus("true"); 
      } 

      # go back to last page ( b )
      elsif ($res eq "98") {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "back one page.\n";
        $gotoNextPage = "true";
        $MPG = $MPG-2;
      } 
      
      # go to next page ( n )
      elsif ($res eq "110") {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "next page.\n";
        $gotoNextPage = "true";
      }
      
      # goto a particular page
      elsif ($res eq "103" && $gtnum ne "") {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "goto page $gtnum.\n";
        $gotoNextPage = "true";
        $MPG = $gtnum-1;
      }

      # goto a particular chapter
      elsif ($res eq "7" && $gtnum ne "") {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "goto chapter $gtnum.\n";
        $MCH = $gtnum;
        if ($MCH < 1) {$MCH = 1;}
        if ($MCH > $lastChapter{$MBK}) {$MCH = $lastChapter{$MBK};}
        $gotoNextPage = "true"; 
        $gotoNextChapter = "true"; 
        $MCH--;
      }
      
      # go back a chapter ( ^b )
      elsif ($res eq "2") {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "back chapter.\n";
        $MCH--;
        if ($MCH < 1) {$MCH = 1;} 
        $gotoNextPage = "true"; 
        $gotoNextChapter = "true"; 
        $MCH--;
      }      
      
      # go to next chapter ( ^n )
      elsif ($res eq "14") {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "next chapter.\n"; 
        $MCH++; 
        if ($MCH > $lastChapter{$MBK}) {$MCH = $lastChapter{$MBK};}  
        $gotoNextPage = "true"; 
        $gotoNextChapter = "true"; 
        $MCH--;
      }
      
      # rewind ( left-arrow | r )
      elsif ($res eq "27.91.68" || $res eq "114") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        print "rewind $rewind s.\n"; 
        if (eci("ai-getpos") < $rewind) {eci("ai-setpos 0");}
        else {eci("ai-rewind $rewind");}
        &updateStatus("true");
      }
      
      # forward ( right-arrow | f )
      elsif ($res eq "27.91.67" || $res eq "102") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        print "forward $forward s.\n";
        eci("ai-forward $forward");
        &updateStatus("true");
      }

      # rewind 4 s ( ctrl+left-arrow | ctrl+r )
      elsif ($res eq "27.91.49.59.53.68" || $res eq "18") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        print "rewind 4 s.\n"; 
        if (eci("ai-getpos") < 4) {eci("ai-setpos 0");}
        else {eci("ai-rewind 4");}
        &updateStatus("true");
      }
      
      # forward 4 s ( ctrl+right-arrow | ctrl+f )
      elsif ($res eq "27.91.49.59.53.67" || $res eq "6") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start");}
        print "forward 4 s.\n";
        eci("ai-forward 4");
        &updateStatus("true");
      }
            
      # pause ( p )
      elsif ($res eq "112") {
        if (eci("engine-status") ne "running") {eci("engine-launch"); eci("start"); print "Resumed.\n";}
        else {eci("engine-halt"); print "Paused!\n";}
        &updateStatus("true");
      }
      
      # status ( z )
      elsif ($res eq "122") {
        print eci("cop-status")."\n";
        &updateStatus("true");
      }
      
      # collect numbers for goto command (0-9)
      if($res >= 48 && $res <= 57) {$gtnum = $gtnum.chr($res);}
      else {$gtnum = "";}
      
    }
    $MPG++;
    
    # new entries follow a different flow than navigation commands
    if ($newEntry eq "true") {
      if    ($MPG == 1) {$MPG = $lastPage{"$MBK-$MCH"};}
      elsif ($MPG > $lastPage{"$MBK-$MCH"}) {$MPG = 1;}
      elsif ($MPG == $lastPage{"$MBK-$MCH"}) {
        if (eci("engine-status") eq "running") {eci("engine-halt");}
        print "\nMove on to the next chapter? (y/n):";
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
  if ($MPG == $lastPage{$MBK."-".$MCH}) {print "\nCHAPTER COMPLETED...\n";}
  if (eci("engine-status") ne "not started") {eci("engine-halt");}
}
$MCH--;
if ($MPG == ($lastPage{$MBK."-".$MCH}) && $MCH == $lastChapter{$MBK}) {print "\n$MBK COMPLETED!!\n";}
print "\nexiting...\n";

system("pkill -9 eog");
eci("quit");

# Clean and sort the pageTiming.txt file
`mv -f $indir/pageTiming.txt $outaudiodir/pageTiming.tmp`;
if (!-e "$indir/pageTiming.txt") {
  open(INF, "<$outaudiodir/pageTiming.tmp") || die "Could not open $outaudiodir/pageTiming.tmp\n";
  open(OUTF, ">$indir/pageTiming.txt") || die "Could not open $indir/pageTiming.txt\n";
  while(<INF>) {
    if    ($_ =~ /^\s*([^-#]+-[^-]+-[\dse]+)\s*=/)
    { 
      chomp;
      if (exists($allAT{$1})) {print sprintf("\n REMOVED:%.64s\nRETAINED:%.64s\n", $allAT{$1}, $_);} 
      $allAT{$1} = $_;
      next;
    }
    elsif ($_ =~ /^\s*([^-#]+-[^:]+:\d+)\s*=/) 
    {
      chomp;
      if (exists($allAV{$1})) {print sprintf("\n REMOVED:%.64s\nRETAINED:%.64s\n", $allAV{$1}, $_);} 
      $allAV{$1} = $_;
      next;
    }
    
    if ($_ =~ /^\s*$/ && $lastLineWasBlank eq "true") {next;}
    elsif ($_ =~ /^\s*$/) {$lastLineWasBlank = "true";}
    else {$lastLineWasBlank = "false";}
    print OUTF $_;
  }
  close(INF);
  close(OUTF);
  
  open(OUTF, ">>$indir/pageTiming.txt");
  foreach $k (sort sortAT keys %allAT) {
    $allAT{$k} =~ /^\s*[^-]+-(\d+)[-:]/; $ch = $1;
    if ($ch != $lch) {print OUTF "\n";}
    $lch = $ch;
    print OUTF "$allAT{$k}\n";
  }
  foreach $k (sort sortAV keys %allAV) {
    $allAV{$k} =~ /^\s*[^-]+-(\d+)[-:]/; $ch = $1;
    if ($ch != $lch) {print OUTF "\n";}
    $lch = $ch;
    print OUTF "$allAV{$k}\n";
  }
  close(OUTF);
}
else {print "WARNING: Could not sort pageTiming.txt\n";}


ReadMode 0;                          
################################################################################
################################################################################
sub doTimingAdjustment() {
  `$scriptdir/timeAnalysis.pl $scriptdir $IDR $ODR $ADR`;
  `$scriptdir/audio.pl $scriptdir $IDR $ODR $ADR`;
}

sub updateStatus($) {
  my $noret = shift;
  my $cp = eci("ai-getpos");
  my $v;
  my $p = $MPG;
  if ($p < 1) {$p = "s"; $v = &formatTime(&roundToNearestFrame($firstPageGap{$MBK."-".$MCH}), "short");}
  elsif ($p >= $lastPage{$MBK."-".$MCH}) {$p = "e"; $v = &formatTime(&roundToNearestFrame($Chapterlength{$MBK."-".$MCH} - $firstPageGap{$MBK."-".$MCH} - $ChapterReadlength{$MBK."-".$MCH}), "short");} #;}
  else {$v = &formatTime(&getCalcTime($MBK, $MCH, ($MPG+1)), "short");}
  if ($noret ne "true") {print "\n";}
  print "                                       TARGET: $v\n";
  print "                                       TIME: ".&formatTime(&roundToNearestFrame($cp), "short")."\n";
  print "SPACEBAR==> $MBK-$MCH-$p ";
}

sub saveTime($) {
  my $type = shift;
  my $posuf = eci("ai-getpos");  
  my $pos = &formatTime(&roundToNearestFrame($posuf));
  print "= $pos\n\n\n";
  
  my $en = "";
  if    ($type eq "trans") {$en = "$MBK-$MCH-".($MPG+1);}
  elsif ($type eq "start") {$en = "$MBK-$MCH-s";}
  elsif ($type eq "end")   {$en = "$MBK-$MCH-e";}
  my $entry = "$en = $pos";

  if (exists($pageTimingEntry{$en})) {
    if (eci("engine-status") eq "running") {eci("engine-halt");}
    print "PAGETIMING FILE:   \"".$pageTimingEntry{$en}."\"\n";
    print "SAVE ENTRY?        \"$entry\"  ?(y/n):";
    my $res;
    while (!defined($res = ReadKey(-1))) {} # playback starts during ReadKey (???)
    getKeyCode($res); # insure key is completely read
    print "\n";
    if ($res =~ /^n$/i) {
      print "Entry \"$en\" was not saved!\n";
      return;
    }
  }

  open(INF, ">>$indir/pageTiming.txt") || die "Could not open $indir/pageTiming.txt\n";
  if (!defined($hasRT)) {print INF "\n"; $hasRT = "true";}     
  if (exists($transitionVerse{"$MBK-$MCH-$MPG"})) {
    my $trans = $transitionVerse{"$MBK-$MCH-$MPG"};
    $trans =~ s/ValuE/$pos/;
    print INF "$trans\n";
    print ">>".sprintf("%.64s...\n", $trans);
  }
  elsif ($MPG > 0 && $MPG < $lastPage{"$MBK-$MCH"}) {print "\nWARNING!! No verse data available for \"$MBK-$MCH-$MPG\"\n\n";}
  print INF "$entry\n";
  print ">>$entry\n";
  if ($type eq "trans") {
    my $tdel = $posuf - &getCalcTime($MBK, $MCH, ($MPG+1));
    print "\nTRANSITION DELTA:".sprintf("%2.2f\n", $tdel);
  }
  print "*************************************************************\n";
  close(INF);
}

sub startEcasound($$$) {
  my $b = shift;
  my $c = shift;
  my $p = shift;
  
  my $pos = 0;
  if ($p > 0 && $p < $lastPage{$b."-".$c}) {  
    $pos = &getCalcTime($b, $c, ($p+1)) - $prepage;
    if ($pos < 0) {$pos = 0;}
  }
  elsif ($p == $lastPage{$b."-".$c}) {$pos = $Chapterlength{$b."-".$c} - 10;}
  
  my $dt = $pos - eci("ai-getpos");
  eci("ai-setpos $pos");
  eci("engine-launch"); eci("start");
  print "\n";
  if ($dt > 5) {print sprintf("                                       SKIPPING: %i s", $dt);}
  &updateStatus();
  #print "Started $b-$c at $pos seconds in $p (".$lastPage{$b."-".$c}.")\n";  
}

sub showPageImage($$$) {
  my $b = shift;
  my $c = shift;
  my $p = shift;
  system("pkill -9 eog");
  if ($p < 1) {$p = 1;}
  if ($p > $lastPage{"$b-$c"}) {$p = $lastPage{"$b-$c"};}
  system ("eog $imagedir/$b/$b-$c-$p.jpg &");
  $waiting = 15;
  while ($waiting > 0) {
    system("sleep 0.5s");
    my $w = `wmctrl -l`;
    if ($w =~ /\s*$b-$c-$p.jpg\s*$/) {$waiting = 0;}
    $waiting--;
  }
  my $t = "$outdir/script";
  $t =~ s/\/home\/[^\/]+/\~/;
  system("wmctrl -a \"$t\"");
  #print "Showing $b-$c page $p.\n";
}

sub readTransitionInformation() {
  if (-e "$listdir") {
    opendir(LSD, "$listdir");
    @entries = readdir(LSD);
    closedir(LSD);
  
    foreach $entry (@entries) {
      if ($entry !~ /-trans\.csv$/) {next;}
      open (INF, "<$listdir/$entry") || die "Could not open $listdir/$entry";
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

sub sortAT {
  my $bka = $allAT{$a};
  $bka =~ /^([^-]+)-(\d+).*=\s*(\S+)/;
  $bka = $bkorder{$1};
  my $cha = $2;
  my $ta = $3;
  
  my $bkb = $allAT{$b};
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

sub initBookOrder() {
  $bkorder{"Gen"} = 0;
  $bkorder{"Exod"} = 1;
  $bkorder{"Lev"} = 2;
  $bkorder{"Num"} = 3;
  $bkorder{"Deut"} = 4;
  $bkorder{"Josh"} = 5;
  $bkorder{"Judg"} = 6;
  $bkorder{"Ruth"} = 7;
  $bkorder{"1Sam"} = 8;
  $bkorder{"2Sam"} = 9;
  $bkorder{"1Kgs"} = 10;
  $bkorder{"2Kgs"} = 11;
  $bkorder{"1Chr"} = 12;
  $bkorder{"2Chr"} = 13;
  $bkorder{"Ezra"} = 14;
  $bkorder{"Neh"} = 15;
  $bkorder{"Esth"} = 16;
  $bkorder{"Job"} = 17;
  $bkorder{"Ps"} = 18;
  $bkorder{"Prov"} = 19;
  $bkorder{"Eccl"} = 20;
  $bkorder{"Song"} = 21;
  $bkorder{"Isa"} = 22;
  $bkorder{"Jer"} = 23;
  $bkorder{"Lam"} = 24;
  $bkorder{"Ezek"} = 25;
  $bkorder{"Dan"} = 26;
  $bkorder{"Hos"} = 27;
  $bkorder{"Joel"} = 28;
  $bkorder{"Amos"} = 29;
  $bkorder{"Obad"} = 30;
  $bkorder{"Jonah"} = 31;
  $bkorder{"Mic"} = 32;
  $bkorder{"Nah"} = 33;
  $bkorder{"Hab"} = 34;
  $bkorder{"Zeph"} = 35;
  $bkorder{"Hag"} = 36;
  $bkorder{"Zech"} = 37;
  $bkorder{"Mal"} = 38;
  $bkorder{"Matt"} = 39;
  $bkorder{"Mark"} = 40;
  $bkorder{"Luke"} = 41;
  $bkorder{"John"} = 42;
  $bkorder{"Acts"} = 43;
  $bkorder{"Jas"} = 44;
  $bkorder{"1Pet"} = 45;
  $bkorder{"2Pet"} = 46;
  $bkorder{"1John"} = 47;
  $bkorder{"2John"} = 48;
  $bkorder{"3John"} = 49;
  $bkorder{"Jude"} = 50;
  $bkorder{"Rom"} = 51;
  $bkorder{"1Cor"} = 52;
  $bkorder{"2Cor"} = 53;
  $bkorder{"Gal"} = 54;
  $bkorder{"Eph"} = 55;
  $bkorder{"Phil"} = 56;
  $bkorder{"Col"} = 57;
  $bkorder{"1Thess"} = 58;
  $bkorder{"2Thess"} = 59;
  $bkorder{"1Tim"} = 60;
  $bkorder{"2Tim"} = 61;
  $bkorder{"Titus"} = 62;
  $bkorder{"Phlm"} = 63;
  $bkorder{"Heb"} = 64;
  $bkorder{"Rev"} = 65;
}