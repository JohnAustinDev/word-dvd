#!/usr/bin/perl

use Encode;

$indir = shift(@ARGV);
$outdir = shift(@ARGV);
$audiodir = shift(@ARGV);

$projmenusdir = "$indir/menus";
$locale = "$indir/config.txt";
$outaudiodir = "$outdir/audio";
$videodir = "$outdir/video";
$webdir = "$outdir/web";
$imagedir = "$outdir/images";
$htmldir = "$indir/html";
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