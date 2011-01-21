#!/usr/bin/perl
# This file is part of Word-DVD.
#
#   Copyright 2010 Dale Potter (gpl.programs.info@gmail.com)
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

print "\nRUNNING navbuttons.pl\n";

$scriptdir = shift(@ARGV);
require "$scriptdir/shared.pl";
&readDataFiles();
if (!(-e "$videodir/videotmp")) {`mkdir $videodir/videotmp`;}

#goto CONCAT;

#assign location variables for text pages' spumux XML...
$by0 = 476;
$by1 = 516;

$bxhw = 30;

$bxa = 75;
$bxb = 170;
$bxc = 238;
$bxd = 455;
$bxe = 520;
$bxf = 585;

$bxa0 = $bxa-$bxhw;
$bxa1 = $bxa+$bxhw;
$bxb0 = $bxb-$bxhw;
$bxb1 = $bxb+$bxhw;
$bxc0 = $bxc-$bxhw;
$bxc1 = $bxc+$bxhw;
$bxd0 = $bxd-$bxhw;
$bxd1 = $bxd+$bxhw;
$bxe0 = $bxe-$bxhw;
$bxe1 = $bxe+$bxhw;
$bxf0 = $bxf-$bxhw;
$bxf1 = $bxf+$bxhw;

# spumux file for text and footnotes pages...
$xml =        "<subpictures>\n";
$xml = $xml . "\t<stream>\n";
$xml = $xml . "\t\t<spu force=\"yes\" start=\"00:00:00.00\" end=\"00:00:00.00\" image=\"$imagedir/transparent.png\" highlight=\"$imagedir/textbuttonsHIGH.png\" select=\"$imagedir/textbuttonsSEL.png\" >\n";
$xml = $xml . "\t\t\t<button name=\"bhelp\"       left=\"bnext\"      right=\"bmainmenu\"   x0=\"".$bxa0."\" y0=\"".$by0."\" x1=\"".$bxa1."\" y1=\"".$by1."\" />\n";
$xml = $xml . "\t\t\t<button name=\"bmainmenu\"   left=\"bhelp\"      right=\"bsubmenu\"    x0=\"".$bxb0."\" y0=\"".$by0."\" x1=\"".$bxb1."\" y1=\"".$by1."\" />\n";
$xml = $xml . "\t\t\t<button name=\"bsubmenu\"    left=\"bmainmenu\"  right=\"bprevious\"   x0=\"".$bxc0."\" y0=\"".$by0."\" x1=\"".$bxc1."\" y1=\"".$by1."\" />\n";
$xml = $xml . "\t\t\t<button name=\"bprevious\"   left=\"bsubmenu\"   right=\"bfootnotes\"  x0=\"".$bxd0."\" y0=\"".$by0."\" x1=\"".$bxd1."\" y1=\"".$by1."\" />\n";
$xml = $xml . "\t\t\t<button name=\"bfootnotes\"  left=\"bprevious\"  right=\"bnext\"       x0=\"".$bxe0."\" y0=\"".$by0."\" x1=\"".$bxe1."\" y1=\"".$by1."\" />\n";
$xml = $xml . "\t\t\t<button name=\"bnext\"       left=\"bfootnotes\" right=\"bhelp\"       x0=\"".$bxf0."\" y0=\"".$by0."\" x1=\"".$bxf1."\" y1=\"".$by1."\" />\n";
$xml = $xml . "\t\t</spu>\n";
$xml = $xml . "\t</stream>\n";
$xml = $xml . "</subpictures>\n";

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
        `rm -r $outdir/video/$book/$book-$ch-$pg.mpg`;
      }
      else {print "ERROR: Missing file: $videodir/$book/$book-$ch-$pg.mpg\n"; die;}
    }
    
    #add buttons to each footnote mpg...
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      $pgn=1;
      while (-e "$videodir/$book/fn-$book-$ch-$pg-$pgn.mpg") {
        `spumux -v $Verbosity -m dvd $outdir/spumux.xml < $videodir/$book/fn-$book-$ch-$pg-$pgn.mpg > $videodir/$book/fin-fn-$book-$ch-$pg-$pgn.mpg`;
        `rm -r $videodir/$book/fn-$book-$ch-$pg.mpg`;
        $pgn++;
      }
    }  
  }
}

CONCAT:
#CONCATENATE PAGE MPGs INTO CHAPTER MPGs
&mpgPages2Chapter($videodir, "fin-");


