#!/usr/bin/perl

#usage mp3tags.pl config.txt audioDirFullPath removeAllTags

# Reads the locale file and add mp3 tags to audio files

use Encode;

$locfile = shift;
$indir = shift;
$removeall = shift;

# LOCALIZATION
if (-e $locfile) {
  open (LOC, "<$locfile");
  while (<LOC>) {
    $_ = decode("utf8", $_);
    utf8::upgrade($_);
    if ($_ =~ /^\s*(.*?)\s*=\s*(.*?)\s*$/) {$localeFile{$1} = $2;}
  }
  close(LOC);
}
else {die "Could not open locale file $locfile.\n";}

opendir(IND, "$indir");
@files = readdir(IND);
closedir(IND);

foreach $file (@files) {
  if ($file =~ /^\.+$/) {next;}
  if ($file =~ /^([^-]+)-([^-]+)-(\d+)\.mp3/) {
    $lang = $1;
    $book = $2;
    $ch = 1*$3;
    
    $filename = "$indir/$file";
    $filename =~ s/ /\\ /g;
    $album = "\"".encode("utf8", $localeFile{$book})."\"";
    $artist = "\"".encode("utf8", $localeFile{$book})."\"";
    $track = "\"".encode("utf8", $localeFile{$book}.", ".&getChapterLocale("Chaptext", $ch))."\"";
    $num = $ch;
    $genre = "Speech";
    $pub = "\"Институт перевода Библии\"";
    $year = "2010";
    
    # UTF8 publisher gives error about non-ASCII
    # "-1" does not always deal properly with UTF8 tracks
    # "-2" year does not work...
    if ($removeall eq "true") {$com = "eyeD3 --remove-all $filename";}
    else {$com = "eyeD3 -1 -A $album -a $artist -t $track -n $num -G $genre $filename";}
    
    print "$com\n";
    `$com`;
  }
  else {print "Could not parse filename $file.\n";}
}

sub getChapterLocale($$) {
  my $name = shift;
  my $chf = shift;
  
  $chd = ($chf%10);
  if (exists($localeFile{$name."-".$chf})) {$res = $localeFile{$name."-".$chf};}
  elsif (exists($localeFile{$name."-".$chd})) {$res = $localeFile{$name."-".$chd};}
  else {$res = $localeFile{$name};}
  $res =~ s/%1\$S/$chf/;
  return $res;
}