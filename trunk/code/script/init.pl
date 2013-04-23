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

#$JPEG2YUV = "-n 1 -I p -f 25";
#$MPLEX = "-V -f 8 "; # original
#$MPEG2ENC = "-f 8 -g 1 -G 1"; # original

#$MPEG2ENC = "--no-constraints -V 2000 -b 20000 -f 3 -g 1 -G 1";
#$MPEG2ENC = "-b 11500 -f 8 -g 1 -G 1"; # best possible with DVD constraints
#$MPEG2ENC = "--no-constraints -cbr -V 2000 -b 20000 -f 3 -g 1 -G 1";

$JPEG2YUV = "-I p -f 25 -n 4";
$MPEG2ENC = "-f 8 -g 4 -G 4 -q 4";
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
