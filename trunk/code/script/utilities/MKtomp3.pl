#!/usr/bin/perl

#usage MKtomp3.pl audioDirFullPath outDirFullPath

# Copies audio files and converts file paths from MK paths to long-names.

use Encode;

$indir = shift;
$outdir = shift;

$indir =~ s/\/$//; # any remove trailing /
$outdir =~ s/\/$//; # any remove trailing /

chdir($indir);
&transformDir($indir);

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
  #my $path = `pwd`;
  my $path = `cd`;
  chop($path);
  $path = "$path\\$aFile";
  if (!($path =~ /([^\/\\]+)(\/|\\)([^\/\\]+)(\/|\\)([^\/\\]+)\.mp3$/i)) {
    print "ERROR: Could not determine file parameters for \"$path\"\n";
  }
  else {
    my $name = $1;
    my $book = $3;
    my $chapter = $5;
    if ($chapter =~ /^\d\d\d$/ && $book !~ /ps/i) {$chapter =~ s/^\d(\d\d)$/$1/;}
    
    print "Copying \"$path\" to \"$outdir\\$name-$book-$chapter.mp3\"\n";
    `copy \"$path\" \"$outdir\\$name-$book-$chapter.mp3\"`;
  }
}
