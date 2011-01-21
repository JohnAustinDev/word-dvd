#!/usr/bin/perl

#usage mp3toMK.pl audioDirFullPath outDirFullPath

# Copies audio files and converts file paths from long-name to MK paths.

use Encode;

$indir = shift;
$outdir = shift;

$indir =~ s/\/$//;
$outdir =~ s/\/$//;

opendir(IND, "$indir");
@files = readdir(IND);
closedir(IND);

foreach $file (@files) {
  if ($file =~ /^\.+$/) {next;}
  if ($file =~ /^([^-]+)-([^-]+)-(\d+)\.mp3/) {
    $lang = $1;
    $book = $2;
    $ch = 1*$3;
    
    $chf = $ch;
    if ($ch < 100) {$chf = "0".$chf;}
    if ($ch < 10) {$chf = "0".$chf;}
    $inpath = "$indir/$file";
    $inpath =~ s/ /\\ /g;
    $outpath = "$outdir/$lang/$book/$chf.mp3";
    $outpath =~ s/ /\\ /g;
    
    $ddir = $outpath;
    $ddir =~ s/\/[^\/]+$//;
    if (!(-e $ddir)) {`mkdir -p $ddir`;}

    $com = "cp -T $inpath $outpath";
    print "$com\n";
    `$com`;
  }
  else {print "Could not parse filename $file.\n";}
}