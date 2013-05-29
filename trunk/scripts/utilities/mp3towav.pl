#!/usr/bin/perl

#usage mp3towav.pl inDirFullPath outDirFullPath filter

$indir = @ARGV[0];
$outdir = @ARGV[1];
$filter = @ARGV[2];
if ($filter eq "") {$filter = "^.*\\.mp3\$";}
print "\"".$filter."\"";

opendir(IND, "$indir");
@files = readdir(IND);
closedir(IND);

chdir($indir);
foreach $file (@files) {
  if ($file !~ /$filter/) {next;}
  if ($file =~ /John/) {next;}
  if ($file =~ /^(.*)\.mp3$/i) {
    $name = $1;
    #`sox $file -r 48000 $name.wav vol 0.7 resample`;
    `sox $file -r 48000 $outdir/$name.wav vol 0.7 resample`;
  }
}


