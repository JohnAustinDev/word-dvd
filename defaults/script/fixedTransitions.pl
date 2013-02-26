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

# SCRIPT fixedTransitions.pl disables fixed transition timings in the
# pageTiming.txt file which correspond to text-locative timings in the
# listing files. This is necessary because after re-rendering, fixed
# timing values are wrong, but text-locative timings will always be correct.

use Encode;

$scriptdir = @ARGV[0];
require "$scriptdir/shared.pl";
&readDataFiles();

# NEVER EVER EVER LOSE THE ORIGINAL!!!!!
$pageTimingFile = "$indir/pageTiming.txt";
my $save = $pageTimingFile;
my $n = 1;
my $fn = sprintf("%02i", $n);
$save =~ s/(-bak\d+)?(\.txt)/-bak$fn$2/;
while (-e $save) {
  $n++;
  my $fn = sprintf("%02i", $n);
  $save =~ s/(-bak\d+)?(\.txt)/-bak$fn$2/;
}
`cp $pageTimingFile $save`;

# collect text-locative data which we now have...
foreach my $k (keys %correctPageChap) {
  $k =~ /^[^-#]+-([^-]+)-([^-]+)-([^-]+)-([^-]+)$/;
  my $bk = $1;
  my $ch = $2;
  my $pg = $3;
  my $type = $4;
  
  if ($type ne "absVerseTime") {next;}
  
  if ($correctPageChap{$k} !~ /^[^,]+,[^,]+,([^,]+)$/) {next;}  # "$res,$numtitles,$abstime"
  
  my $val = $1;
  
#print "DEBUG1: $bk-$ch-$val\n";
  $verseTimings{"$bk-$ch-$val"}++;
}

# now comment out fixed timing values which correspond to text-locative ones...

$tmp = "$pageTimingFile.tmp";

open(INF, "<$pageTimingFile") || die;
open(OUTF, ">$tmp") || die;
while(<INF>) {
  
  # print every single line, but add "#" before select lines...
  if ($_ =~ /^([^-#]+)-(\d+)-(\d+)\s*=\s*([\-\:\d\.]+)\s*$/) {
    my $bk = $1;
    my $ch = $2;
    my $pg = $3;
    my $val = $4;
    
    # mimic the way time value was handled when saving correctPageChap...
    $val = &unformatTime($val, "noFrameCheck");
    my $f = $framesPS*$val;
    $f = sprintf("%i", $f);
    $val = ($f/$framesPS);
      
    if ($verseTimings{"$bk-$ch-$val"}) {
      $_ = "#$_";
    }
    
  }
  
  print OUTF $_;
}

close(INF);
close(OUTF);

# overwrite pageTimingFile
&sys("mv -f \"$tmp\" \"$pageTimingFile\"");

sub sys($) {
  my $cmd = shift;
  my $ret = `$cmd`;
  if ($debug) {
    print "$cmd\n";
    print "$ret\n";
  }
  return $ret;
}
