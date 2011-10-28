#!/usr/bin/perl

use Encode;

$indir = @ARGV[1];
$outdir = @ARGV[2];
$audiodir = @ARGV[3];

$projmenusdir = "$indir/menus";
$resourcedir = "$indir/resource";
$locale = "$indir/config.txt";
$htmldir = "$indir/html";
$outaudiodir = "$outdir/audio";
$videodir = "$outdir/video";
$webdir = "$outdir/web";
$imagedir = "$outdir/images";
$listdir = "$outdir/listing";
$dvddir = "$outdir/dvd";

$MENUSFILE = "MENU_BUTTONS.csv";

#$deltmps = "true";
$framesPS = 25;
$TSTILL = 2; # KRK was compiled with 1.8

# LOCALIZATION
if (-e $locale) {
  open (LOC, "<$locale");
  while (<LOC>) {
    $_ = decode("utf8", $_);
    utf8::upgrade($_);
    if ($_ =~ /^\s*(.*?)\s*=\s*(.*?)\s*$/) {$localeFile{$1} = $2;}
  }
  close(LOC);
}

$Verbosity = 0;
if (exists($localeFile{"LogFileVerbosity"})) {$Verbosity = $localeFile{"LogFileVerbosity"};}

1;
