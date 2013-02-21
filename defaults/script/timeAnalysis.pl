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

# SCRIPT timeAnalysis.pl reads manually generated timing values from the
# pageTiming.txt file and saves this information so that it can be used to
# force page timing to the manually measured values.

#usage timeAnalysis.pl scriptDir inputDir outputDir audioDir

print "\nRUNNING timeAnalysis.pl\n";

# Remove timingAdjustments.csv, then run audio.pl to create clean chapters.csv file
unlink("$ARGV[2]/audio/timingAdjustments.csv");
$scriptdir = $ARGV[0];
require "$scriptdir/audio.pl";

# Save our chapters_base.csv
`cp "$outaudiodir/chapters.csv" "$outaudiodir/chapters_base.csv"`; 

if (-e "$indir/pageTiming.txt") {
  # READ CHAPTER INFORMATION FROM FILE
  if (-e "$outaudiodir/chapters.csv") {&readChaptersCSV();}
  else {print "ERROR: $outaudiodir/chapters.csv is missing!\n"; die;}

  # CALCULATE ADJUSTMENTS AS SPECIFIED IN pageTiming.txt, THEN SAVE THEM TO timingAdjustments.csv
  foreach $page (sort keys %correctPageChap) {
#print "$page\n";
    if ($page !~ /^(\d+)-(.*?)-(\d+)-(\d+)-(\w+)$/) {print "ERROR: Could not parse page $page\n"; die;}
    $order = $1;
    $bk = $2;
    $ch = $3;
    $pg = $4;
    $type = $5;
    
    if ($order >= 50000 && !defined($ranVerseAdj)) {&calcVerseAdjustments(); $ranVerseAdj = "true";}

    @pagesTCalc = split(/,/, $Chapterlist{$bk."-".$ch});
    if (!@pagesTCalc || !$pagesTCalc[($pg-1)]) {next;}

    if ($type eq "absPageTime") {
      if ($pg == 1) {print "ERROR: Cannot apply absolute page start time to page 1 \"$page\"\n"; next;}
      $tc = &unformatTime($pagesTCalc[($pg-1)]);
      $error = ($correctPageChap{$page} - $tc);
    }
    elsif ($type eq "deltaPageTime") {
      if ($pg == 1) {print "ERROR: Cannot apply delta page start time to page 1 \"$page\"\n"; next;}
      $error = $correctPageChap{$page};
    }
    elsif ($type eq "absVerseTime") {
      if ($correctPageChap{$page} !~ /([\d\.]+),(\d+),([\d\.]+)/) {print "ERROR: Could not parse verse timing information for \"$page\".\n"; next;}
      $res = (1*$1);
      $numtitles = (1*$2);
      $abstime = (1*$3);
      
      if ($pg == 1 && $numtitles >=1 && $pageTimingEntry{"TitlesAreRead"} ne "true") {$numtitles--;}
      $res = &addTitles($res, $numtitles, $bk, $ch);
           
      $tverseCalc = (&unformatTime($pagesTCalc[($pg-1)]) + ($res * $ChapterReadlength{$bk."-".$ch}));
      if ($pg == 1) {$tverseCalc = ($tverseCalc + $firstPageGap{$bk."-".$ch});}
      $error = ($abstime - $tverseCalc);
      
#print "$bk-$ch-$pg: ".sprintf("%2.2f, %2.2f, %2.2f\n", $abstime, $tverseCalc, $error);      

      # ALG 4
      $pos = $res/$pages{"$bk-$ch-$pg"}*100;
      $suf = "";
      if (exists($vaPos{"$bk-$ch-$pg"})) {
        if ($pos < $vaPos{"$bk-$ch-$pg"}) {$suf="-l";}
        else {$suf="-r";}
      }

      $vaPos{"$bk-$ch-$pg".$suf} = $pos;
      $vaErr{"$bk-$ch-$pg".$suf} = $error;
      $error = 0;      
    }
    else {$error = 0;}
    
    if ($error != 0) {$adjustment{"$bk-$ch-$pg"} = sprintf("%s,%2.2f\n", "$bk-$ch-$pg", $error);}
  }
  if (!defined($ranVerseAdj)) {&calcVerseAdjustments(); $ranVerseAdj = "true";}
  
  open(OUTF, ">$outaudiodir/timingAdjustments.csv") || die "Could not open timingAdjustments.csv";
  print OUTF "#Page,Delta\n";
  foreach $k (sort keys %adjustment) {print OUTF $adjustment{$k};}
  close(OUTF);
}
else {print "WARNING: No manual timing file found; To create $outaudiodir/timingAdjustments.csv, supply:\n\t$indir/pageTiming.txt\n";}

sub calcVerseAdjustments() {
  my $bk;
  my $ch;
  my $pg;
  foreach $bk (sort {$books{$a}<=>$books{$b}} keys %books) {
    for ($ch=1; $ch<=$lastChapter{$bk}; $ch++) {
      for ($pg=1; $pg<=$lastPage{$bk."-".$ch}; $pg++) {
        if (!exists($vaErr{"$bk-$ch-$pg"})) {next;}

        my %data;
        &getData(\%data, $bk, $ch, ($pg-1), "r"); my $pos0 = $data{"p"}; my $err0 = $data{"e"};
        &getData(\%data, $bk, $ch,  $pg,    "l"); my $POSL = $data{"p"}; my $ERRL = $data{"e"};
        &getData(\%data, $bk, $ch,  $pg,    "r"); my $POSR = $data{"p"}; my $ERRR = $data{"e"};
        &getData(\%data, $bk, $ch, ($pg+1), "l"); my $pos2 = $data{"p"}; my $err2 = $data{"e"};      
        
        my $errorR = 0; my $errorL = 0;      
        # left side transition
        my $d = (100-$POSL) + $pos0;
        if ($d == 0) {$errorL = $ERRL;}
        else {$errorL = $err0*($pos0/$d) + $ERRL*((100-$POSL)/$d);}
        if ($pg <= 1) {$errorL = 0;}
        
        # right side transition
        $d = $POSR + (100-$pos2);
        if ($d == 0) {$errorR = $err2;}
        else {$errorR = $ERRR*($POSR/$d) + $err2*((100-$pos2)/$d);}
        if ($pg >= $lastPage{$bk."-".$ch}) {$errorR = 0;}
        
#print sprintf("%s: %2.2f, %2.2f\n%s: %2.2f, %2.2f\n%s %2.2f, %2.2f\n%s %2.2f, %2.2f\n%s: %2.2f / %2.2f\n\n", "$bk-$ch-".($pg-1)."  RIGHT:", $pos0, $err0, "$bk-$ch-$pg  LEFT:", $POSL, $ERRL, "$bk-$ch-$pg RIGHT:", $POSR, $ERRR, "$bk-$ch-".($pg+1)."  LEFT:", $pos2, $err2, "$bk-$ch-$pg ERROR L/R:", $errorL, $errorR);
        
        my $newL = sprintf("%s,%2.2f\n", "$bk-$ch-$pg",      $errorL);
        my $newR = sprintf("%s,%2.2f\n", "$bk-$ch-".($pg+1), $errorR);
        
        if ($errorL != 0) {
          if (exists($adjustment{"$bk-$ch-$pg"}) && $adjustment{"$bk-$ch-$pg"} ne $newL) {print "ERROR: Verse transition calculation problem $bk-$ch-$pg (L)\n";}
          $adjustment{"$bk-$ch-$pg"} = $newL;
        }
        if ($errorR != 0) {
          if (exists($adjustment{"$bk-$ch-".($pg+1)}) && $adjustment{"$bk-$ch-".($pg+1)} ne $newR) {print "ERROR: Verse transition calculation problem $bk-$ch-".($pg+1)." (R)\n";}
          $adjustment{"$bk-$ch-".($pg+1)} = $newR;
        }
      }
    }
  }
}

sub getData(%$$$$) {
  my $r = shift;
  my $b = shift;
  my $c = shift;
  my $p = shift;
  my $rl = shift;

  if (exists($vaPos{"$b-$c-$p-$rl"})) {
    $r->{"p"} = $vaPos{"$b-$c-$p-$rl"};
    $r->{"e"} = $vaErr{"$b-$c-$p-$rl"};
  }
  else {
    $r->{"p"} = $vaPos{"$b-$c-$p"};
    $r->{"e"} = $vaErr{"$b-$c-$p"};    
  }
 
  if ($r->{"e"} eq "" || $r->{"e"} == 0) {
    # no value - so it should fall out of error calculation
    $r->{"e"} = 0;
    if ($rl eq "l") {$r->{"p"} = 100;} # so left value has no weight
    if ($rl eq "r") {$r->{"p"} = 0;}   # so right value has no weight
    # first and last pages are special cases
    if ($p == 1 && $rl eq "r")                  {$r->{"p"} = 85;}
    if ($p == $lastPage{"$b-$c"} && $rl eq "l") {$r->{"p"} = 15;}
  }
  
  if ($p == 1 && $rl eq "l") {$r->{"e"} = 0; $r->{"p"} = 0;}
  if ($p == $lastPage{"$b-$c"} && $rl eq "r") {$r->{"e"} = 0; $r->{"p"} = 100;}
}

1;
