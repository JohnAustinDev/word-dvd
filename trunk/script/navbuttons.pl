#!/usr/bin/perl
# This file is part of Word-DVD.
#
#   Copyright 2010 Dale Potter (ortoasia@gmail.com)
#
#   Word-DVD is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 2 of the License, or
#   (at your option) any later version.
#
#   Word-DVD is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with Word-DVD.  If not, see <http://www.gnu.org/licenses/>.

# SCRIPT navbuttons.pl adds buttons to all audio-text, silent-text, and footnotes pages.
# It also concatenates "$mpgIsMultiPage" pages into a final multi chapter mpg.

#usage navbuttons.pl scriptDir inputDir outputDir audioDir debugOn

print "\nRUNNING navbuttons.pl\n";

$scriptdir = @ARGV[0];
$debug = @ARGV[4];
require "$scriptdir/shared.pl";
&readDataFiles();
if (!(-e "$videodir/videotmp")) {`mkdir $videodir/videotmp`;}

#goto CONCAT;

if (!defined($AllMenus{"textoverlay"})) {print "ERROR: textoverlay was not defined\n"; die;}

# GET SPUMUX XML TO MUX CONTROL BUTTONS INTO ALL TEXT PAGES
$xml  = "<subpictures>\n";
$xml .= "\t<stream>\n";
$xml .= "\t\t<spu force=\"yes\" start=\"00:00:00.00\" end=\"00:00:00.00\" ";
$xml .= "image=\"".$AllMenus{"textoverlay"}{"maskNORM"}."\" ";
$xml .= "highlight=\"".$AllMenus{"textoverlay"}{"maskHIGH"}."\" ";
$xml .= "select=\"".$AllMenus{"textoverlay"}{"maskSEL"}."\" >\n";

my @names = ("", "bhelp", "bmainmenu", "bsubmenu", "bprevious", "bfootnotes", "bnext");

for (my $b=1; $b<=6; $b++) {
  if (!defined($AllMenus{"textoverlay"}{"button-".$b})) {print "ERROR: textoverlay button \"button-".$b."\" was not defined.\n"; die;}
  $xml .= "\t\t\t<button name=\"".@names[$b]."\" ";
  $xml .= "x0=\"".$AllMenus{"textoverlay"}{"button-".$b}{"x0"}."\" ";
  $xml .= "y0=\"".$AllMenus{"textoverlay"}{"button-".$b}{"y0"}."\" ";
  $xml .= "x1=\"".$AllMenus{"textoverlay"}{"button-".$b}{"x1"}."\" ";
  $xml .= "y1=\"".$AllMenus{"textoverlay"}{"button-".$b}{"y1"}."\" ";
  $xml .= "/>\n";
}

$xml .= "\t\t</spu>\n";
$xml .= "\t</stream>\n";
$xml .= "</subpictures>\n";

if (!open(TMP, ">$outdir/spumux.xml")) {print "ERROR: Could not open spumux xml $outdir/spumux.xml\n"; die;}
print TMP $xml;
close(TMP);

#Add Buttons all (non-menu) mpg files...
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
    if (!$chapters{"$book-$ch"}) {next;}
    print "Adding buttons to text & footnote pages for $book-$ch\n";
    
    #add buttons to each text mpg...
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      if (-e "$videodir/$book/$book-$ch-$pg.mpg") {
        `spumux -v $Verbosity -m dvd $outdir/spumux.xml < $videodir/$book/$book-$ch-$pg.mpg > $videodir/$book/fin-$book-$ch-$pg.mpg`;
        if (!$debug)  {`rm -r $videodir/$book/$book-$ch-$pg.mpg`;}
      }
      else {print "ERROR: Missing file: $videodir/$book/$book-$ch-$pg.mpg\n"; die;}
    }
    
    #add buttons to each footnote mpg...
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      $pgn=1;
      while (-e "$videodir/$book/fn-$book-$ch-$pg-$pgn.mpg") {
        `spumux -v $Verbosity -m dvd $outdir/spumux.xml < $videodir/$book/fn-$book-$ch-$pg-$pgn.mpg > $videodir/$book/fin-fn-$book-$ch-$pg-$pgn.mpg`;
        if (!$debug)  {`rm -r $videodir/$book/fn-$book-$ch-$pg-$pgn.mpg`;}
        $pgn++;
      }
    }  
  }
}

CONCAT:
#CONCATENATE PAGE MPGs INTO CHAPTER MPGs
&mpgPages2Chapter($videodir, "fin-");

if (!$debug)  {`rm -f -r $videodir/videotmp`;}


