#!/usr/bin/perl

#usage mp3tags.pl indir outdir audiodir removeAllTags

# Read the locale file and add mp3 tags to audio files

use Encode;
require "$scriptdir/init.pl";
$removeall = @ARGV[3];

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
    $album = "\"".encode("utf8", $localeFile{"BookName:".$book})."\"";
    $artist = "\"".encode("utf8", $localeFile{"BookName:".$book})."\"";
    my @params = ($book, $ch);
    $track = "\"".encode("utf8", $localeFile{"BookName:".$book}.", ".&getLocaleString("ChapName", \@params)."\"";
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
