#!/usr/bin/perl

use Encode;

$indir = @ARGV[1];
$outdir = @ARGV[2];
$audiodir = @ARGV[3];

$indir =~ s/\/\s*$//; # remove any trailing slash
$outdir =~ s/\/\s*$//; # remove any trailing slash
$audiodir =~ s/\/\s*$//; # remove any trailing slash

$projmenusdir = "$indir/menus";
$resourcedir = "$indir/code/resource";
$locale = "$indir/config.txt";
$htmldir = "$indir/html";
$outaudiodir = "$outdir/audio";
$videodir = "$outdir/video";
$webdir = "$outdir/web";
$imagedir = "$outdir/images";
$listdir = "$outdir/listing";
$dvddir = "$outdir/dvd";
$backupdir = "$outdir/backup";

$MENUSFILE = "MENU_BUTTONS.csv";

#$deltmps = "true";
$framesPS = 25;
$TSTILL = 2; # KRK was compiled with 1.8

# original: progressive with default 7500 kbit/s video
#$JPEG2YUV = "-I p -f 25 -n 1";
#$MPEG2ENC = "-f 8 -g 1 -G 1"; 

# looks great on computers and TVs, but seems to cause audio clicks,
# which may mean incorrectly advancing video on some players.
#$JPEG2YUV = "-I p -f 25 -n 4";
#$MPEG2ENC = "-f 8 -H -q 1 -g 4 -G 4";

# looks quite good on computers and TVs, but not interlaced as PAL should be
$JPEG2YUV = "-I p -f 25 -n 1";
$MPEG2ENC = "-f 3 -b 8000 -H -q 1 -g 1 -G 1";

# looks blah on computers and good on TVs, and is interlaced as PAL should be
#$JPEG2YUV = "-I p -f 25 -n 1 I b -L 1";
#$MPEG2ENC = "-f 3 -b 9600 -H -q 1 -g 1 -G 1 -I 1";

# MULTI FRAME IMAGES CAUSE CLICKS DURING TRANSITIONS ON MPLAYER
# looks excellent on computer and on TV, but PAL is not interlaced
#$JPEG2YUV = "-f 25 -n 4 -I p";
#$MPEG2ENC = "-f 3 -b 9000 -H -q 1 -g 4 -G 4";

# looks excellent on TV, and ok on computer
#$JPEG2YUV = "-f 25 -n 4 -I b -L 1";
#$MPEG2ENC = "-f 3 -b 9000 -H -q 1 -g 4 -G 4 -I 1";

$MPLEX = "-f 8";

# LOCALIZATION
if (-e $locale) {
  open (LOC, "<$locale");
  while (<LOC>) {
    $_ = decode("utf8", $_);
    utf8::upgrade($_);
    if ($_ =~ /^\s*\#/) {next;}
    elsif ($_ =~ /^\s*(.*?)\s*=\s*(.*?)\s*$/) {
      my $k = $1;
      my $v = $2;
      $v =~ s/\s*\#.*$//;
      $localeFile{$k} = $v;
    }
  }
  close(LOC);
}

# Looks for a string labeled by $name in config.txt file. If $name is
# not there, a less specific version is sought. Runtime values can be 
# inserted into any string, when &getLocaleString is called with params, 
# by using %1$S codes in config.txt strings. This function has a 
# Javascript implementation in word-dvd.js
sub getLocaleString($\@) {
  my $name = shift;
  my $paramsP = shift;
  
  # search for the most specific match
  my $done = 0;
  my $result = $localeFile{$name};
  while (!defined($localeFile{$name})) {
    my $lessSpecific = $name;
    $name =~ s/\-[^\-]*$//;
    
    # if we can't get more specific, then remove any trailing ":" and stop looping
    if ($lessSpecific eq $name) {
      $done = 1;
      $lessSpecific =~ s/\:.*$//;
    }
    
    $name = $lessSpecific;
    $result = $localeFile{$name};
    
    if ($done) {last;}
  }
  
  # replace any runtime params in the string
  if ($paramsP && length(@{$paramsP}) && $result) {
    for (my $i=0; $i < length(@{$paramsP}); $i++) {
      my $thisp = @{$paramsP}[$i];
      if ($thisp eq "") {next;}
      $result =~ s/\%$i\$S/$thisp/ig;
    }
  }
  
  return $result;
}

$Verbosity = 0;
if (exists($localeFile{"LogFileVerbosity"})) {$Verbosity = $localeFile{"LogFileVerbosity"};}

1;
