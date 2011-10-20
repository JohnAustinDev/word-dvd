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

# SCRIPT menus.pl creates mpg slides for VMGM and Titleset menus, plus the help menu
# It also muxes in the appropriate buttons for each menu.

#usage menus.pl scriptDir inputDir outputDir audioDir debugOn

print "\nRUNNING menus.pl\n";

$scriptdir = @ARGV[0];
$debug = @ARGV[4];
require "$scriptdir/shared.pl" || die "Can't require shared.pl";
&readDataFiles();

foreach $menu (keys %allMenus) {
  if (!(-e "$imagedir/$menu.jpg")) {die "Missing menu image $imagedir/$menu.jpg";}
}

#PREPARE OUTPUT DIRECTORYS
if (!(-e $videodir)) {`mkdir $videodir`;}
if (!(-e "$videodir/videotmp")) {`mkdir $videodir/videotmp`;}
if (!(-e "$videodir/menutmp")) {`mkdir $videodir/menutmp`;}

#goto PROJMENUS;

foreach $menu (keys %allMenus) {
  print "Creating menu $menu\n";
  # RENDER THE MENU
  makeSilentSlide("", $imagedir."/".$menu);

  # ADD BUTTONS TO THE MENU
  if ($allBTypes{$menu."-9"} ne "underline" && $allBTypes{$menu."-18"} ne "underline") {$btype = "menuNorm";}
  elsif ($allBTypes{$menu."-9"} ne "underline") {$btype = "menuLeft";}
  elsif ($allBTypes{$menu."-18"} ne "underline") {$btype = "menuRight";}
  else {$btype = "menuBoth";}
  if (!(-e "$resourcedir/".$btype."HIGH.png")) {print "ERROR: Must add or create button type \"".$btype."HIGH.png\" to use text buttons.\n"; $btype = "menuNorm";}
  if (!(-e "$resourcedir/".$btype."SEL.png"))  {print "ERROR: Must add or create button type \"".$btype."SEL.png\" to use text buttons.\n"; $btype = "menuNorm";}
  $xml =        "<subpictures>\n";
  $xml = $xml . "\t<stream>\n";
  $xml = $xml . "\t\t<spu force=\"yes\" start=\"00:00:00.00\" image=\"$resourcedir/transparent.png\" highlight=\"$resourcedir/".$btype."HIGH.png\" select=\"$resourcedir/".$btype."SEL.png\" >\n";

  # button rows  
  for ($b=1; $b<=18; $b++) {
    if (!$allButtons{$menu."-".$b}) {next;}

    # up, down, left, right instructions
    $up = ($b-1);
    while (!$allButtons{$menu."-".$up}) {
      if ($up <= 0) {$up = 18; next;}
      $up = ($up-1);
    }
    $down = ($b+1);
    while (!$allButtons{$menu."-".$down}) {
      if ($down >= 18) {$down = 0; next;}
      $down = ($down+1);
    }
    $right = $b;
    $left = $b;
    if ($b <= 9) {$leftright = ($b+9); $minb = 10;}
    else {$leftright = ($b-9); $minb = 1;}
    for ($cnt=0; $cnt<9; $cnt++) {
      if ($allButtons{$menu."-".$leftright}) {
        $right = $leftright;
        $left = $leftright;
        last;
      }
      $leftright--;
      if ($leftright < $minb) {$leftright = ($leftright + 9);}
    }

    # button locations
    if ($b <= 9) {$yni=($b-1); $x0 = 124;}
    else {$yni=($b-10); $x0 = 432;}
    $w = 164;
    $h = 20;
    $yn = 34;
    if ($b==9 || $b==18) {$y0 = 440; $h = 52;} #472
    else {$y0 = 160 + ($yn*$yni);}
    $xml = $xml . "\t\t\t<button name=\"b".$b."\" x0=\"".$x0."\" y0=\"".$y0."\" x1=\"".($x0+$w)."\" y1=\"".($y0+$h)."\" up=\"b$up\" right=\"b$right\" down=\"b$down\" left=\"b$left\" />\n";
  }

  $xml = $xml . "\t\t</spu>\n";
  $xml = $xml . "\t</stream>\n";
  $xml = $xml . "</subpictures>\n";

  open(TMP, ">$outdir/spumux.xml") || die "Could not open spumux xml $outdir/spumux.xml\n";
  print TMP $xml;
  close(TMP);

TOCSPUMUX:
  `spumux -v $Verbosity -m dvd $outdir/spumux.xml < $videodir/$menu.mpg > $videodir/fin-$menu.mpg`;
  #print "Rerun spumux? "; $pause = <>; if ($pause =~ /^\s*y\s*$/i) {goto TOCSPUMUX;}
  if (!$debug)  {`rm -r $videodir/$menu.mpg`;}
  `rm -r $outdir/spumux.xml`;
}

PROJMENUS:
foreach $menu (sort keys %pmenuIMG) {
  if (-e $projmenusdir."/".$pmenuIMG{$menu}) {print "ERROR: Could not find menu image ".$projmenusdir."/".$pmenuIMG{$menu}."\n"; next;}
  if (-e $projmenusdir."/".$pmenuHIGH{$menu}) {print "ERROR: Could not find menu highlight image ".$projmenusdir."/".$pmenuHIGH{$menu}."\n"; next;}
  if (-e $projmenusdir."/".$pmenuSEL{$menu}) {print "ERROR: Could not find menu selection image ".$projmenusdir."/".$pmenuSEL{$menu}."\n"; next;}

  print "Creating menu $menu\n";
  # RENDER THE HELP MENU
  makeSilentSlide("", $projmenusdir."/".$menu);

  # ADD BUTTONS TO THE MENU
  if (!open(TMP, ">$outdir/spumux.xml")) {print "ERROR: Could not open spumux xml $outdir/spumux.xml\n"; die;}
  print TMP "<subpictures>\n";
  print TMP "\t<stream>\n";
  print TMP "\t\t<spu force=\"yes\" start=\"00:00:00.00\" end=\"00:00:00.00\" image=\"".$pmenuIMG{$menu}."\" highlight=\"".$pmenuHIGH{$menu}."\" select=\"".$pmenuSEL{$menu}."\" >\n";
  foreach $b (sort keys %pbuttonTARG) {
    if ($b !~ /^$menu-(\d+)$/) {next;}
    $b = $1;
    print TMP "\t\t\t<button name=\"b".$b."\" x0=\"".$pbuttonX0{$menu."-".$b}."\" y0=\"".$pbuttonY0{$menu."-".$b}."\" x1=\"".$pbuttonX1{$menu."-".$b}."\" y1=\"".$pbuttonY1{$menu."-".$b}."\" />\n";
  }
  print TMP "\t\t</spu>\n";
  print TMP "\t</stream>\n";
  print TMP "</subpictures>\n";
  close(TMP);

PROJSPUMUX:
  `spumux -v $Verbosity -m dvd $outdir/spumux.xml < $videodir/$menu.mpg > $videodir/fin-$menu.mpg`;
  #print "Rerun spumux? "; $pause = <>; if ($pause =~ /^\s*y\s*$/i) {goto PROJSPUMUX;}

  if (!$debug) {`rm -r $videodir/$menu.mpg`;}
  `rm -r $outdir/spumux.xml`;
}


if (!$debug) {`rm -r $videodir/menutmp`;}
