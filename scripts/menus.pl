#!/usr/bin/perl
# This file is part of Word-DVD.
#
#   Copyright 2015 John Austin (gpl.programs.info@gmail.com)
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

# SCRIPT menus.pl creates mpg slides for VMGM and Titleset menus, plus the help menu
# It also muxes in the appropriate buttons for each menu.

#usage menus.pl scriptDir inputDir outputDir audioDir debugOn

print "\nRUNNING menus.pl\n";

$scriptdir = @ARGV[0];
$debug = @ARGV[4];
require "$scriptdir/shared.pl" || die "Can't require shared.pl";
&readDataFiles();

# PREPARE OUTPUT DIRECTORYS
if (!(-e $videodir)) {`mkdir $videodir`;}
if (!(-e "$videodir/videotmp")) {`mkdir $videodir/videotmp`;}
if (!(-e "$videodir/menutmp")) {`mkdir $videodir/menutmp`;}

foreach my $menu (sort {&menuSort($a, $b);} keys %AllMenus) {
  if ($menu eq "textoverlay") {next;}
  
  print "Creating menu $menu\n";
  
  # RENDER THE MENU
  if ($AllMenus{$menu}{"audio"}) {
    &makeAudioSlide($menu, $AllMenus{$menu}{"image"}, $AllMenus{$menu}{"audio"});
  }
  else {
    &makeSilentSlide($menu, $AllMenus{$menu}{"image"});
  }

  # GET SPUMUX XML TO MUX BUTTONS INTO MENU
  my $xml;
  $xml  = "<subpictures>\n";
  $xml .= "\t<stream>\n";
  $xml .= "\t\t<spu force=\"yes\" start=\"00:00:00.00\" end=\"00:00:00.00\" \n";
  $xml .= "\t\timage=\"".$AllMenus{$menu}{"maskNORM"}."\" \n";
  $xml .= "\t\thighlight=\"".$AllMenus{$menu}{"maskHIGH"}."\" \n";
  $xml .= "\t\tselect=\"".$AllMenus{$menu}{"maskSEL"}."\">\n";
  
  foreach my $key (sort keys %{$AllMenus{$menu}}) {
    if ($key !~ /^button-(\d+)$/) {next;}
    my $b = $1;
    
    $xml .= "\t\t\t<button name=\"b".$b."\" ";
    $xml .= "x0=\"".$AllMenus{$menu}{$key}{"x0"}."\" ";
    $xml .= "y0=\"".$AllMenus{$menu}{$key}{"y0"}."\" ";
    $xml .= "x1=\"".$AllMenus{$menu}{$key}{"x1"}."\" ";
    $xml .= "y1=\"".$AllMenus{$menu}{$key}{"y1"}."\" ";

    # apply smart select only to TOC and CHP menus
    if ($menu !~ /^(cm-|textoverlay)/) {
      
      # up, down, left, right instructions
      my $up = ($b-1);
      while (!$AllButtons{$menu."-".$up}) {
        if ($up <= 0) {$up = 18; next;}
        $up = ($up-1);
      }
      
      my $down = ($b+1);
      while (!$AllButtons{$menu."-".$down}) {
        if ($down >= 18) {$down = 0; next;}
        $down = ($down+1);
      }
      
      my $leftright, $minb;
      my $right = $b;
      my $left = $b;
      if ($b <= 9) {
        $leftright = ($b+9); 
        $minb = 10;
      }
      else {
        $leftright = ($b-9); 
        $minb = 1;
      }
      for (my $cnt=0; $cnt<9; $cnt++) {
        if ($AllButtons{$menu."-".$leftright}) {
          $right = $leftright;
          $left = $leftright;
          last;
        }
        $leftright--;
        if ($leftright < $minb) {$leftright = ($leftright + 9);}
      }
    
      $xml .= "up=\"b".$up."\" ";
      $xml .= "right=\"b".$right."\" ";
      $xml .= "down=\"b".$down."\" ";
      $xml .= "left=\"b".$left."\" ";
    }
    
    $xml .= "/>\n";
  }

  $xml .= "\t\t</spu>\n";
  $xml .= "\t</stream>\n";
  $xml .= "</subpictures>\n";

  open(TMP, ">$outdir/spumux.xml") || die "Could not open spumux xml $outdir/spumux.xml\n";
  print TMP $xml;
  close(TMP);

TOCSPUMUX:
  `spumux -v $Verbosity -m dvd $outdir/spumux.xml < $videodir/$menu.mpg > $videodir/fin-$menu.mpg`;
  #print "Rerun spumux? "; $pause = <>; if ($pause =~ /^\s*y\s*$/i) {goto TOCSPUMUX;}
  if (!$debug) {`rm -r $videodir/$menu.mpg`;}
  if (!$debug) {`rm -r $outdir/spumux.xml`;}
}

if (!$debug) {`rm -f -r $videodir/menutmp`;}
if (!$debug) {`rm -f -r $videodir/videotmp`;}
