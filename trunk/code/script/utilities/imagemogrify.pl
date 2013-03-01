#!/usr/bin/perl

&transformDir("./");

sub transformDir($) {
  my $dname = shift;
  print `pwd`;
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
    elsif ($file =~ /\.(jpg|png)$/) {&transformImage($file);}
  }
  closedir(DIR);
}

sub transformImage($) {
  my $image = shift;
  print "Modifying $image...\n";
  print `mogrify -crop 704x576+8+0 $image`;
  #print "mogrify -map ../map.png $image\n";
  #print `mogrify -map ../map.png $image`;
}