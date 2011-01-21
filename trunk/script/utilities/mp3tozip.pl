#!/usr/bin/perl

#usage mp3tozip.pl audioDirFullPath outDirFullPath

# Copies audio files with long names into MK book modules.

use Encode;

$indir = shift;
$outdir = shift;

$indir =~ s/\/$//; # any remove trailing /
$outdir =~ s/\/$//; # any remove trailing /


mkdir("$outdir\\audio");
chdir($indir);
&transformDir($indir);
unlink("$outdir\\audio");


sub transformDir($) {
  my $dname = shift;
  #print `pwd`;
  print `cd`;
  print "Entering Dir: $dname\n";
  opendir(DIR, "./") || die "Could not open dir";
  my @files = readdir(DIR);
  my $file = "";
  foreach $file (@files) {
    if ($file =~ /^(\.|\.\.)$/) {next;}
    if (-d $file) {
      chdir("$file");
      &transformDir($file);
      chdir("..");
    }
    elsif ($file =~ /\.mp3$/i) {&copyFile($file);}
  }
  closedir(DIR);
}

sub copyFile($) {
  my $aFile = shift;
  my $path = `cd`;
  chop($path);
  $path = "$path\\$aFile";
  if (!($path =~ /([^-\/\\]+)-([^-\/\\]+)-[^-\/\\]+\.mp3$/i)) {print "Could not get book name from $path\n"; next;}
  my $name = $1;
  my $book = $2;
  print "Zipping \"$path\" into \"$outdir\\$name-$book.zip\"\n";
  `copy \"$path\" \"$outdir\\audio\\$aFile\"`;
  `7za a -tzip \"$outdir\\$name-$book.zip\" -r \"$outdir\\audio\"`;
  `del /Q \"$outdir\\audio\\$aFile\"`;
}
