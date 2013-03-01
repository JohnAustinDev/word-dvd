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

# SCRIPT mpeg2vob.pl writes a dvdauthor XML file and then runs it using dvdauthor
# to create all necessary DVD files from existing mpeg files.

# DVDAUTHOR NOTES:
# Menu entry=root can only be used within titles (???)
# Menu entry=title can only be used in VMGM (???)
# All jumps to a title must only specify the title number (not chapter, cell, etc.)
# All jumps to a chapter must only specify the chapter number (not the title, etc.)

#usage mpeg2vob.pl scriptDir inputDir outputDir audioDir controlFlag(1 = skip dvdauthor.xml creation, 2 = don't run dvdauthor)

print "\nRUNNING mpeg2vob.pl\n";

$scriptdir = @ARGV[0];
$control = @ARGV[4];
require "$scriptdir/shared.pl";
&readDataFiles();

$lang=$localeFile{"LangCode"};
$DONTBREAKBOOKS = $localeFile{"DontBreakBooks"};
$MATTHEW_STARTS_VTS = $localeFile{"MattewStartsVTS"};
$ALLBOOKS_START_VTS = $localeFile{"AllBooksStartVTS"};
$FOOTNOTES_IN_OWN_VTS = $localeFile{"FootnotesInOwnVTS"};
if (!$DONTBREAKBOOKS) {$DONTBREAKBOOKS = "true";}
if (!$MATTHEW_STARTS_VTS) {$MATTHEW_STARTS_VTS = "true";}
if (!$ALLBOOKS_START_VTS) {$ALLBOOKS_START_VTS = "false";}
if (!$FOOTNOTES_IN_OWN_VTS) {$FOOTNOTES_IN_OWN_VTS = "false";}

print "LANGUAGE=$lang\nDONTBREAKBOOKS=$DONTBREAKBOOKS\nMATTHEW_STARTS_VTS=$MATTHEW_STARTS_VTS\nALLBOOKS_START_VTS=$ALLBOOKS_START_VTS\nFOOTNOTES_IN_OWN_VTS=$FOOTNOTES_IN_OWN_VTS\n";

$cMaxProgram = 99; # DVDA&D pp 176
$cMaxTitleVTS = 5;
$cMaxMenuPre = 32;
$cMaxFNMenuPre = 32;

#dvd general registers
$gHILB = "g0";  #next highlighted menu button (n*1024)
$gJSTI = "g1";  #jump to stitle number
$gJCHP = "g2";  #jump to chapter number
$gRSTI = "g3";  #resume to stitle number
$gRCHP = "g4";  #resume to chapter number
$gTYPE = "g5";  #type (used by root & title menus)
$gMTNM = "g6";  #return register for title menu
$gMTHI = "g7";  #return register for title highlight
$gMRNM = "g8";  #return register for root menu
$gMRHI = "g9";  #return register for root highlight
$gTMP1 = "g10"; #temporary variable

$defType = 5; #default type action for root or title menus

# $gTYPE == 0: jump to text or footnote dummy menu.
# $gTYPE == 1: jump to footnote with mapping dummy menu.
# $gTYPE == 2: jump to applicable chapter sub-menu.
# $gTYPE == 3: jump to help page.
# $gTYPE == 4: jump to title menu.
# $gTYPE == 5; take default action.
# otherwise, reset and go to main-menu.
  
#button numbering
$btext{"bhelp"}       = (1*1024);
$btext{"bmainmenu"}   = (2*1024);
$btext{"bsubmenu"}    = (3*1024);
$btext{"bprevious"}   = (4*1024);
$btext{"bfootnotes"}  = (5*1024);
$btext{"bnext"}       = (6*1024);

$bfoot{"bhelp"}       = (1*1024);
$bfoot{"bmainmenu"}   = (2*1024);
$bfoot{"bsubmenu"}    = (3*1024);
$bfoot{"bprevious"}   = (4*1024);
$bfoot{"bfootnotes"}  = (5*1024);
$bfoot{"bnext"}       = (6*1024);

$nbhelp = 1024; # this single value is used for more than one page type!

$vFORMAT = "PAL";
$vASPECT = "4:3";
$vRESLTN = "720x576";
$aFORMAT = "ac3";
$aSAMPLE = "48khz";

# First, read through all pages, and fill all data structures needed to build
# the dvd. The XML build process does not begin until after this read-through 
# is complete.
$VTS = 1;
$TITLE = 1;
$PROGRAM = 1;
$VOB = 1;
$FNVTS = 1;
$FNTITLE = 0; # is 0 because there may be no footnotes
$FNPROGRAM = 1;

foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {

  if (!($TITLE == 1 && $PROGRAM == 1)) {
    if (  $ALLBOOKS_START_VTS eq "true" || 
          ($book eq "Matt" && $MATTHEW_STARTS_VTS eq "true") ||
          ($DONTBREAKBOOKS eq "true" && !&bookfits($book, $TITLE, $FNTITLE, $PROGRAM, $FNPROGRAM))  ) {
      $VTS++;
      $TITLE = 1;
      $PROGRAM = 1;
      $VOB = 1;
      if ($FOOTNOTES_IN_OWN_VTS ne "true") {
        $FNVTS++;
        $FNTITLE = 0; # is 0 because there may be no footnotes
        $FNPROGRAM = 1;
      }
    }
  }
  
  for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {   
    # test fit of this chapter and all its pages into current TITLE (PGC) and VTS
    undef @pages;
    if ($mpgIsMultiPage{$book."-".$ch} eq "true") {
      @pages = split(/,/, $Chapterlist{$book."-".$ch});
      $newprograms = @pages;
    }
    # It is possible that a short non-audio chapter (like Ps 117) may not have a last or first page!
    elsif ($lastPage{$book."-".$ch} eq "") {
      if ($ch == 0) {next;} # Missing introductions need no special handling
      if (!exists($PROGRAMofCHAP{$book."-".$ch})) {
        if ($PROGRAM == 1) {
          $aVTS = $VTS;
          $aTITLE = $TITLE;
          if ($aTITLE == 1) {
            $aVTS--;
            if ($aVTS == 0) {die "Missing page 1 of first VTS and title. ($book-$ch)"}
            $aTITLE = $MAXTITLE{$aVTS};
          }
          else {$aTITLE--;}
          $PROGRAMofCHAP{$book."-".$ch} = $MAXPROGRAM{$aVTS."-".$aTITLE};
          $VTSofCHAP{$book."-".$ch} = $aVTS;
          $TITLEofCHAP{$book."-".$ch} = $aTITLE;
        }
        else {
          $PROGRAMofCHAP{$book."-".$ch} = $PROGRAM-1;
          $VTSofCHAP{$book."-".$ch} = $VTS;
          $TITLEofCHAP{$book."-".$ch} = $TITLE;
        }
      }
      next;
    }
    else {$newprograms = $lastPage{$book."-".$ch}};
    
    if (($PROGRAM+$newprograms-1) > $cMaxProgram) {
      $TITLE++;
      $PROGRAM = 1;
      $VOB = 1;
      if ($FOOTNOTES_IN_OWN_VTS ne "true") {
        if (($TITLE + $FNTITLE) > $cMaxTitleVTS) {
          $VTS++;
          $TITLE = 1;
          $FNVTS++;
          $FNTITLE = 0; # is 0 because there may be no footnotes
          $FNPROGRAM = 1;
        }
      }
      elsif ($TITLE > $cMaxTitleVTS) {
        $VTS++;
        $TITLE = 1;  
      }
    }

    # test fit these footnotes into current footnote TITLE and VTS
    $pgfn = 0;
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      $pgn=1;
      while (-e "$outdir/video/$book/fin-fn-$book-$ch-$pg-$pgn.mpg") {$pgn++; $pgfn++;}
      if ($pgfn > 0 && $FNTITLE==0) {$FNTITLE=1;}
      if (($FNPROGRAM + $pgfn) > $cMaxProgram) {
        $FNTITLE++;
        $FNPROGRAM = 1;
      }
      if ($FOOTNOTES_IN_OWN_VTS ne "true") {
        if (($TITLE + $FNTITLE) > $cMaxTitleVTS) {
          $VTS++;
          $TITLE = 1;
          $PROGRAM = 1;
          $VOB = 1;
          $FNVTS++;
          $FNTITLE = 1;
          $FNPROGRAM = 1;
        }
      }
      elsif ($FNTITLE > $cMaxTitleVTS) {
        $FNVTS++;
        $FNTITLE = 1;
        $FNPROGRAM = 1;
        $FirstVTSinFNVTS{$FNVTS} = $VTS;
        $FirstTITLEinFNVTS{$FNVTS} = $TITLE;
        $FirstPROGRAMinFNVTS{$FNVTS} = $PROGRAM;
      }
    }
    
    # now all parameters are ready and able to receive the new chapter's worth of pages
    $MAXVTS = $VTS;
    $MAXTITLE{$VTS} = $TITLE;
    $MAXFNVTS = $FNVTS;
    $MAXFNTITLE{$FNVTS} = $FNTITLE;
    
    # record all books which start in this VTS
    if ($booklist !~ /(^|;)$book;/) {
      $bks = $BOOKSTARTS{$VTS};
      if ($bks eq "" || $bks !~ /(^|;)$book;/) {
        $BOOKSTARTS{$VTS} = $bks.$book.";";
        $booklist = $booklist.$book.";";
      }
    }
    
    # these are needed in addition to $VTSofCHAP{$book."-1"} etc. because first chap could be 0 or 1!
    if (!exists($FirstVTSof{$book})) {$FirstVTSof{$book} = $VTS;}
    if (!exists($FirstTITLEof{$book})) {$FirstTITLEof{$book} = $TITLE;}
    if (!exists($FirstPROGRAMof{$book})) {$FirstPROGRAMof{$book} = $PROGRAM;}
    
    # record footnotes
    $pgfn = 0;
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!(exists $pages{"$book-$ch-$pg"})) {next;}
      $pgn=1;
      while (-e "$outdir/video/$book/fin-fn-$book-$ch-$pg-$pgn.mpg") {
        $TITLEHASFN{$VTS."-".$TITLE} = "true";
        $FNFILE{$FNVTS."-".$FNTITLE."-".$FNPROGRAM} = "$outdir/video/$book/fin-fn-$book-$ch-$pg-$pgn.mpg";
        $MAXFNPROGRAM{$FNVTS."-".$FNTITLE} = $FNPROGRAM;
        $FNVTSFOR{$VTS."-".$TITLE."-".($PROGRAM+$pgfn)} = $FNVTS;
        $FNTITLEFOR{$VTS."-".$TITLE."-".($PROGRAM+$pgfn)} = $FNTITLE;
        $FNCHAPTERFOR{$VTS."-".$TITLE."-".($PROGRAM+$pgfn)} = $FNPROGRAM;
        $FNPROGRAM++;
        $pgn++;
      }
      $pgfn++;
    }
    
    # record pages for this chapter
    if ($mpgIsMultiPage{$book."-".$ch} eq "true") {
      $PROGRAMofCHAP{$book."-".$ch} = $PROGRAM;
      $VTSofCHAP{$book."-".$ch} = $VTS;
      $TITLEofCHAP{$book."-".$ch} = $TITLE;
      $FILE{$VTS."-".$TITLE."-".$VOB} = "$outdir/video/$book/fin-$book-$ch.mpg";
      $CHAPTERS{$VTS."-".$TITLE."-".$VOB} = $Chapterlist{$book."-".$ch};
      $PAUSE{$VTS."-".$TITLE."-".$VOB} = "";
      $PROGRAM = $PROGRAM+@pages;
      $MAXPROGRAM{$VTS."-".$TITLE} = $PROGRAM-1;
      $VOB++;
    }
    else {
      for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
        if (!(exists $pages{"$book-$ch-$pg"})) {next;}
        $FILE{$VTS."-".$TITLE."-".$VOB} = "$outdir/video/$book/fin-$book-$ch-$pg.mpg";
        $CHAPTERS{$VTS."-".$TITLE."-".$VOB} = "00:00:00.00";
        $PAUSE{$VTS."-".$TITLE."-".$VOB} = "pause=\"inf\" ";
        #if page "1" is missing, the previous page should be referenced as the first page of this chapter
        if (!exists($PROGRAMofCHAP{$book."-".$ch})) {
          if (($PROGRAM-$pg+1) == 0) {
            $aVTS = $VTS;
            $aTITLE = $TITLE;
            if ($aTITLE == 1) {
              $aVTS--;
              if ($aVTS == 0) {die "Missing page 1 of first VTS and title."}
              $aTITLE = $MAXTITLE{$aVTS};
            }
            else {$aTITLE--;}
            $PROGRAMofCHAP{$book."-".$ch} = $MAXPROGRAM{$aVTS."-".$aTITLE};
            $VTSofCHAP{$book."-".$ch} = $aVTS;
            $TITLEofCHAP{$book."-".$ch} = $aTITLE;
          }
          else {
            $PROGRAMofCHAP{$book."-".$ch} = $PROGRAM-$pg+1;
            $VTSofCHAP{$book."-".$ch} = $VTS;
            $TITLEofCHAP{$book."-".$ch} = $TITLE;
          }
        }
        $MAXPROGRAM{$VTS."-".$TITLE} = $PROGRAM;
        $PROGRAM++;
        $VOB++;
      }
    }
  }
}

# we now have all relative vts numbers, so next place them in absolute positions
if ($FOOTNOTES_IN_OWN_VTS ne "true") {
  for ($vts=1; $vts<=$MAXVTS; $vts++) {
    $ABStextVTS{$vts} = $vts;
    $RELtextVTS{$vts} = $vts;
    if ($MAXFNTITLE{$vts} > 0) {
      $ABSfnVTS{$vts} = $vts;
      $RELfnVTS{$vts} = $vts;    
    }
  }
  $LASTVTS = $MAXVTS;
}
else {
  if (!$MAXFNTITLE{$MAXFNVTS}) {$MAXFNVTS--;}
  if (!$MAXFNVTS) {
    $step = $MAXVTS;
    $tstep = $MAXVTS;
  }
  else {
    $step = int($MAXVTS/($MAXFNVTS));
    $tstep = int($step/2);
    if ( $tstep > $step-($MAXVTS%$MAXFNVTS) ) {$tstep = $step;}
  }
  $nrvts = 1;
  $nfvts = 1;
  for ($vts=1; $vts<=($MAXVTS + $MAXFNVTS); $vts++) {
    if ($tstep) {
      $ABStextVTS{$nrvts} = $vts;
      $RELtextVTS{$vts} = $nrvts;
      $nrvts++;
      $tstep--;    
    }
    else {
      $ABSfnVTS{$nfvts} = $vts;
      $RELfnVTS{$vts} = $nfvts;
      $nfvts++;
      $tstep = $step;   
    }
  }
  if ($nrvts-1 != $MAXVTS) {print "ERROR: Text VTS mapping problem.\n"; die;}
  if ($nfvts-1 != $MAXFNVTS) {print "ERROR: Footnote VTS mapping problem.\n"; die;}
  $LASTVTS = ($MAXVTS + $MAXFNVTS);    
}

$stit=1;
for ($vts=1; $vts<=$LASTVTS; $vts++) {
  $STITLE{$vts} = $stit;
  if (exists($RELfnVTS{$vts})) {
    $stit = ($stit+$MAXFNTITLE{$RELfnVTS{$vts}});
  }
  if (exists($RELtextVTS{$vts})) {
    $stit = ($stit+$MAXTITLE{$RELtextVTS{$vts}});
  }
}

if ($control && $control==1) {goto AUTHOR;}

# BEGIN WRITING THE DVDAUTHOR.XML FILE.

# VMGM SECTION...
$CurrentPGCnumber = 0;
if (!open(XML, ">$outdir/dvdauthor.xml")) {print "ERROR: Could not open dvdauthor.xml $outdir/dvdauthor.xml\n"; die;}
print XML "<dvdauthor dest=\"$dvddir\">\n";
print XML "\t<vmgm>\n";
print XML "\t\t<fpc>{".&jumpTo("default", "noregs", "noresume", "nohilt", "jumptitle")."}</fpc>\n";

#VMGM menus....
$numVMGMmenus = 0;
print XML "\t\t<menus lang=\"$lang\" >\n";
writeVideoInfo();

#build accessory menus
$tocmenu = "toc-m1";
foreach $menu (sort keys %pmenuIMG) {$menuVMGM{$menu} = ++$numVMGMmenus;}
foreach $menu (sort keys %pmenuIMG) {
  PGCstartTag("\t\t\t<pgc>", "Accessory menu $menu.");
  foreach $but (sort keys %pbuttonTARG) {
    if ($but !~ /^$menu-(\d+)$/) {next;}
    $b = $1;
    if ($pbuttonTARG{$menu."-".$b} eq $tocmenu) {$command = "jump menu entry title;";}
    else {
      if (!exists($menuVMGM{$pbuttonTARG{$menu."-".$b}})) {print "ERROR: Target \"".$pbuttonTARG{$menu."-".$b}."\" from menu $menu does not exist.\n"; next;}
      $command = "jump menu ".$menuVMGM{$pbuttonTARG{$menu."-".$b}}.";"
    }
    print XML "\t\t\t\t<button name=\"b".$b."\">".$command."</button>\n";
  }
  print XML "\t\t\t\t<vob file=\"$outdir/video/fin-".$menu.".mpg\" pause=\"inf\" />\n";  
  print XML "\t\t\t</pgc>\n";
}

#build TITLE and TOC menus
if (!exists($allMenus{$tocmenu})) {
  PGCstartTag("\t\t\t<pgc entry=\"title\" >", "BEGIN MAIN VMGM TITLE MENU. NO TOC MENU!");
  $numVMGMmenus++;
  $menuVMGM{$tocmenu} = $numVMGMmenus;
  print XML "\t\t\t\t<pre>{".&jumpTo("text", "stitle1-1", "noresume", $btext{"bnext"}, "1")."}</pre>\n";
  print XML "\t\t\t</pgc>\n";
}
else {
  PGCstartTag("\t\t\t<pgc>", "Dummy titleset forwarding menu.");
  $numVMGMmenus++;
  $VMGMforwardnum = $numVMGMmenus;
  print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
  $menuentry = 0;
  for ($pre=$LASTVTS; $pre>=1; $pre--) {
    if ($menuentry>$cMaxMenuPre) {
      print XML "\t\t\t\t\t\tjump menu ".($numVMGMmenus+1).";\n";
      print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
      print XML "\t\t\t</pgc>\n";
      PGCstartTag("\t\t\t<pgc>", "Dummy titleset forwarding menu. (OVERFLOW)");
      $numVMGMmenus++;
      print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
      $menuentry = 0;
    }
    print XML "\t\t\t\t\t\tif ( ".$gJSTI." ge ".$STITLE{$pre}." ) jump titleset ".$pre." menu entry root;\n";
    $menuentry++;
  }
  print XML "\t\t\t\t\t\t".$gTYPE."=5; jump menu entry title;\n";
  print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
  print XML "\t\t\t</pgc>\n";

  #build TOC menus
  foreach $menu (sort {$allMenus{$a} <=> $allMenus{$b}} keys %allMenus) {
    if ($menu !~ /^toc-m(\d+)/) {next;}
    
    if ($menu eq "toc-m1") {
      PGCstartTag("\t\t\t<pgc entry=\"title\" pause=\"inf\" >", "BEGIN MAIN VMGM TITLE MENU $menu");
      $numVMGMmenus++;
      $menuVMGM{$tocmenu} = $numVMGMmenus;
      print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
      if ($FOOTNOTES_IN_OWN_VTS eq "true" && $MAXFNVTS) {
        print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq 1 ) {\n";
        $fmcalc = "\t\t\t\t\t\t\t".$gTMP1." = ".$cMaxProgram."*".$gJSTI."+".$gJCHP.";\n";
        for ($fnvts=$MAXFNVTS; $fnvts>1; $fnvts--) {
          print XML $fmcalc."\t\t\t\t\t\t\tif ( ".$gTMP1." ge ".($cMaxProgram*($STITLE{$ABStextVTS{$FirstVTSinFNVTS{$fnvts}}}+$FirstTITLEinFNVTS{$fnvts}-1)+$FirstPROGRAMinFNVTS{$fnvts})." ) jump titleset ".$ABSfnVTS{$fnvts}." menu entry root;\n";
          $fmcalc = "";
        }
        print XML "\t\t\t\t\t\t\tjump titleset ".$ABSfnVTS{$fnvts}." menu entry root;\n";
        print XML "\t\t\t\t\t\t}\n";
      }
      print XML "\t\t\t\t\t\tif ( ".$gTYPE." le 3 ) jump menu ".$VMGMforwardnum.";\n"; 
      print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq 4 ) {\n";
      print XML &menuSelector(($menuVMGM{$tocmenu}+1), "^toc-m(\\d+)", "^(.+)-", "", "\t\t\t\t\t\t\t");
      print XML "\t\t\t\t\t\t}\n";
      if (exists $nextbuttonnum{$menu}) {$hbutton=$nextbuttonnum{$menu};}
      else {$hbutton=1024;}
      print XML "\t\t\t\t\t\telse ".$gHILB."=".$hbutton.";\n";
      print XML "\t\t\t\t\t\tjump menu ".($numVMGMmenus+1).";\n";
      print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
      print XML "\t\t\t</pgc>\n";      
    }

    PGCstartTag("\t\t\t<pgc>", "TOC menu $menu");
    $numVMGMmenus++;
    print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
    print XML "\t\t\t\t\t\ts8=".$gHILB."; ".$gTYPE."=".$defType."; ".$gMTNM."=".$numVMGMmenus."; ".$gMRNM."=0; ".$gMRHI."=1024;".&resetdest()."\n";
    print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
    &writeMenuButtonsVMGM($menu, ($menuVMGM{$tocmenu}+1));    
    print XML "\t\t\t\t<vob file=\"$outdir/video/fin-$menu.mpg\" pause=\"inf\" />\n";
    print XML "\t\t\t</pgc>\n";
  }
}

print XML "\t\t</menus>\n";
print XML "\t</vmgm>\n";

# TITLESET SECTION...
$CurrentTitlesetNumber = 1;
for ($vts=1; $vts<=$LASTVTS; $vts++) {
  $CurrentPGCnumber = 0;
  print XML "\n";
  comment("(titleset ".$CurrentTitlesetNumber++.") BEGIN NEW TITLESET");
  print XML "\n\t<titleset>\n";
  
  # TITLESET MENUS: dummies, help, chapter sub-menus, and root
  $nummenus = 0;
  $CurrentPGCnumber = 0;
  print XML "\t\t<menus lang=\"$lang\" >\n";
  writeVideoInfo();
  
  #write dummy menus for use by all navigation commands
  if (exists($RELtextVTS{$vts})) {
    &writeDummyMenusVTS(\%MAXTITLE, \%MAXPROGRAM, "false");
    if ($FOOTNOTES_IN_OWN_VTS ne "true" && $MAXFNTITLE{$RELfnVTS{$vts}} > 0) {
      &writeDummyMenusVTS(\%MAXFNTITLE, \%MAXFNPROGRAM, "textvts");
    }
  }
  else {&writeDummyMenusVTS(\%MAXFNTITLE, \%MAXFNPROGRAM, "ownvts");}
  
  #write dummy menus for jumping to footnotes
  if (exists($RELtextVTS{$vts}) && $FOOTNOTES_IN_OWN_VTS ne "true") {
    # is a text VTS which also has footnotes
    $rvts = $RELtextVTS{$vts};
    &writeMapperFNMenusVTS($rvts, 1, 1, ($rvts+1), 1, 1);
  }
  elsif (exists($RELfnVTS{$vts}) && $FOOTNOTES_IN_OWN_VTS eq "true") {
    # is a footnote VTS which has no text
    $rvts = $RELfnVTS{$vts};
    $fv = $FirstVTSinFNVTS{$rvts+1};
    $ft = $FirstTITLEinFNVTS{$rvts+1};
    $fp = $FirstPROGRAMinFNVTS{$rvts+1};
    if (!exists($FirstVTSinFNVTS{$rvts+1})) {
      $fv = $MAXVTS;
      $ft = $MAXTITLE{$fv};
      $fp = $MAXPROGRAM{$fv."-".$ft}+1; # plus one because last chapter is never included
    }
    &writeMapperFNMenusVTS($FirstVTSinFNVTS{$rvts}, $FirstTITLEinFNVTS{$rvts}, $FirstPROGRAMinFNVTS{$rvts}, $fv, $ft, $fp);
  }

  #build help menu
  $help = "help-m1";
  if (exists($pmenuIMG{$help})) {
    PGCstartTag("\t\t\t<pgc>", "HELP menu.");
    $nummenus++;
    $HELPMENU{$vts} = $nummenus;
    print XML "\t\t\t\t<button name=\"b1\">{".&jumpTo("text", "rregs", "noresume", $nbhelp, "jumproot")."}</button>\n";
    print XML "\t\t\t\t<vob file=\"$outdir/video/fin-".$help.".mpg\" pause=\"inf\" />\n";  
    print XML "\t\t\t</pgc>\n";
  }
  else {print "ERROR: No help menu was found.\n";}
  
  #write chapter selection sub-menus for each book included in the VTS
  if (exists($RELtextVTS{$vts})) {
    @allbooks = split(";", $BOOKSTARTS{$RELtextVTS{$vts}});
    foreach $book (@allbooks) {
      $nomenu="true";
      foreach $menu (sort {$allMenus{$a} <=> $allMenus{$b}} keys %allMenus) {
        if ($menu !~ /^$book-m(\d+)/) {next;}
        $n = $1;
        PGCstartTag("\t\t\t<pgc>", "Chapter selection menu  for \"$book\".");
        $nummenus++;
        if ($n == 1) {$VTSSUBMENU{$book} = $nummenus;}
        $nomenu="false";
        print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
        if ($n == 1) {
          $mnus = &menuSelector($nummenus, "^".$book."-m(\\d+)", "^".$book."-(\\d+)", $book, "\t\t\t\t\t\t\t");
          if ($mnus ne "") {
            print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq 2 ) {\n";
            print XML $mnus;
            print XML "\t\t\t\t\t\t}\n";
            print XML "\t\t\t\t\t\telse ".$gHILB."=1024;\n";
          }
          else {print XML "\t\t\t\t\t\tif ( ".$gTYPE." ne 2 ) ".$gHILB."=1024;\n";}
        }
        print XML "\t\t\t\t\t\ts8=".$gHILB."; ".$gTYPE."=".$defType."; ".$gMRNM."=".$nummenus.";".&resetdest()."\n";
        print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
        &writeMenuButtonsVTS($menu);
        print XML "\t\t\t\t<vob file=\"$outdir/video/fin-$menu.mpg\" pause=\"inf\" />\n";
        print XML "\t\t\t</pgc>\n";
      }
      if ($nomenu eq "true") {
        PGCstartTag("\t\t\t<pgc>", "Chapter selection menu \"$book\". NO CHAPTER MENU");
        $nummenus++;
        $VTSSUBMENU{$book} = $nummenus;
        print XML "\t\t\t\t<pre>{".&jumpTo("text", "topof$book", "noresume", $btext{"bnext"}, "jumproot")."}</pre>\n";
        print XML "\t\t\t</pgc>\n";
      }
    }
  }
  
  #write footnote VTS's stitle menu 
  if ($FOOTNOTES_IN_OWN_VTS eq "true" && exists($RELfnVTS{$vts})) {
    print XML PGCstartTag("\t\t\t<pgc>", "Footnote VTS's STITLE menu.");
    $nummenus++;
    $menuentry = 0;
    $FNVTSentryMenu = $nummenus;
    print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
    print XML "\t\t\t\t\t\t".$gTMP1." = ".$cMaxProgram."*".$gJSTI."+".$gJCHP.";\n";
    $lastmenu = "";
    for ($xvts=1; $xvts<=$MAXVTS; $xvts++) {
      for ($xtit=1; $xtit<=$MAXTITLE{$xvts}; $xtit++) {
        $avts = $ABStextVTS{$xvts};
        if (!exists($FNMENU{$avts."-".$xtit})) {next;}
        if ($menuentry > $cMaxFNMenuPre) {
          print XML "\t\t\t\t\t\tjump menu ".($nummenus+1).";\n";
          print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
          print XML "\t\t\t</pgc>\n";
          print XML PGCstartTag("\t\t\t<pgc>", "Footnote VTS's STITLE menu. (OVERFLOW)");
          print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
          $nummenus++;
          $menuentry = 0;
        }
        if ($lastmenu ne "") {
          print XML "\t\t\t\t\t\tif ( ".$gTMP1." lt ".($cMaxProgram*($STITLE{$avts}+$xtit-1) + 1)." ) jump menu ".$lastmenu.";\n";
          $menuentry++;
        }
        $lastmenu = $FNMENU{$avts."-".$xtit};
      }
    }
    print XML "\t\t\t\t\t\tjump menu ".$lastmenu.";\n";
    print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
    print XML "\t\t\t</pgc>\n";
  }
   
  #write the root menu...
  PGCstartTag("\t\t\t<pgc entry=\"root\" >", "ROOT MENU.");
  $nummenus++;
  $rootmenunum = $nummenus;
  print XML "\t\t\t\t<pre>\n";
  print XML "\t\t\t\t\t{\n";
  if ($FOOTNOTES_IN_OWN_VTS eq "true") {
    if (!$MAXFNVTS) {print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq 1 ) { ".$gTYPE."=0; jump vmgm menu entry title; }\n";}
    elsif (exists($RELtextVTS{$vts})) {print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq 1 ) jump vmgm menu entry title;\n";}
    else {print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq 1 ) jump menu ".$FNVTSentryMenu.";\n";}
  }
  print XML "\t\t\t\t\t\tif ( ".$gJSTI." lt ".$STITLE{$vts}." ) jump vmgm menu entry title;\n";
  print XML "\t\t\t\t\t\tif ( ".$gJSTI." ge ".($STITLE{$vts}+$MAXTITLE{$RELtextVTS{$vts}}+$MAXFNTITLE{$RELfnVTS{$vts}})." ) jump vmgm menu entry title;\n";
  print XML "\t\t\t\t\t\tif ( ".$gTYPE." eq ".$defType." ) ".$gTMP1."=2;\n";
  print XML "\t\t\t\t\t\telse ".$gTMP1."=".$gTYPE.";\n";
  
  # $gTYPE == 2: jump to applicable sub-menu.
  print XML "\t\t\t\t\t\tif ( ".$gTMP1." eq 2 ) {\n";
    if (exists($RELtextVTS{$vts})) {
    $lastbook="";
    $fvts = $RELtextVTS{$vts}-1;
    while ($fvts >= 1) {
      @prevbooks = split(";", $BOOKSTARTS{$fvts});
      if (@prevbooks>0) {
        $lastbook=@prevbooks[@prevbooks-1];
        last;
      }
      $fvts--;
    }
    @allbooks = split(";", $BOOKSTARTS{$RELtextVTS{$vts}});
    if (@allbooks) {print XML "\t\t\t\t\t\t\t".$gTMP1."=".$cMaxProgram."*".$gJSTI."+".$gJCHP.";\n";}
    for ($x=@allbooks-1; $x>=0; $x--) {
      $book = $allbooks[$x];
      $fbn = $cMaxProgram*($STITLE{$ABStextVTS{$FirstVTSof{$book}}}+$FirstTITLEof{$book}-1) + $FirstPROGRAMof{$book};
      print XML "\t\t\t\t\t\t\tif ( ".$gTMP1." ge ".$fbn." ) jump menu ".$VTSSUBMENU{$book}.";\n";
    }
    if ($lastbook eq "") {print XML "\t\t\t\t\t\t\t".$gTMP1."=2;\n";}
    else {print XML "\t\t\t\t\t\t\t".&jumpTo("menu", "topof$lastbook", "noresume", "memhilt", "jumptitle")."\n";}
  }
  else {print XML "\t\t\t\t\t\t\t".&jumpTo("menu", "rregs", "noresume", "memhilt", "jumptitle")."\n";}
  print XML "\t\t\t\t\t\t}\n";
  
  print XML "\t\t\t\t\t\t".$gTYPE."=".$defType.";\n";
  
  # $gTYPE == 0: jump to text or footnote dummy menu.
  print XML "\t\t\t\t\t\tif ( ".$gTMP1." eq 0 ) {\n";  
  
  if (exists($RELtextVTS{$vts})) {
    for ($pgc=1; $pgc<=$MAXTITLE{$RELtextVTS{$vts}}; $pgc++) {
      print XML "\t\t\t\t\t\t\tif ( ".$gJSTI." eq ".($STITLE{$vts}+$pgc-1)." ) jump menu ".$MENU{$vts."-".$pgc."-false"}.";\n";
    }
    if ($FOOTNOTES_IN_OWN_VTS ne "true" && $MAXFNTITLE{$RELfnVTS{$vts}} > 0) {
      $ofs = $MAXTITLE{$RELtextVTS{$vts}};
      for ($pgc=1; $pgc<=$MAXFNTITLE{$RELfnVTS{$vts}}; $pgc++) {
        print XML "\t\t\t\t\t\t\tif ( ".$gJSTI." eq ".($STITLE{$vts}+$ofs+$pgc-1)." ) jump menu ".$MENU{$vts."-".$pgc."-textvts"}.";\n";
      }
    }
  }
  else {
    for ($pgc=1; $pgc<=$MAXFNTITLE{$RELfnVTS{$vts}}; $pgc++) {
      print XML "\t\t\t\t\t\t\tif ( ".$gJSTI." eq ".($STITLE{$vts}+$pgc-1)." ) jump menu ".$MENU{$vts."-".$pgc."-ownvts"}.";\n";
    }
  }
  print XML "\t\t\t\t\t\t}\n";
  
  # $gTYPE == 1: jump to footnote with mapping dummy menu.
  if ($FOOTNOTES_IN_OWN_VTS ne "true") {
    print XML "\t\t\t\t\t\tif ( ".$gTMP1." eq 1 ) {\n";
    for ($pgc=1; $pgc<=$MAXTITLE{$RELtextVTS{$vts}}; $pgc++) {
      if (!exists($FNMENU{$vts."-".$pgc})) {next;}
      print XML "\t\t\t\t\t\t\tif ( ".$gJSTI." eq ".($STITLE{$vts}+$pgc-1)." ) jump menu ".$FNMENU{$vts."-".$pgc}.";\n";
    }
    print XML "\t\t\t\t\t\t\t".&jumpTo("text", "rregs", "noresume", $btext{"bfootnotes"}, "jumptitle")."\n";
    print XML "\t\t\t\t\t\t}\n";
  }
  
  # $gTYPE == 3: jump to help page.
  if (exists($HELPMENU{$vts})) {
    print XML "\t\t\t\t\t\tif ( ".$gTMP1." eq 3 ) jump menu ".$HELPMENU{$vts}.";\n";
  }
  print XML "\t\t\t\t\t\tjump vmgm menu entry title;\n";
  print XML "\t\t\t\t\t}\n";
  print XML "\t\t\t\t</pre>\n";
  print XML "\t\t\t</pgc>\n";
  
  print XML "\t\t</menus>\n";
  
  # MAIN TITLESET TITLES
  $CurrentPGCnumber = 0;
  print XML "\t\t<titles>\n";
  writeVideoInfo();
  
  if (exists($RELtextVTS{$vts})) {
    #text titles first...
    for ($pgc=1; $pgc<=$MAXTITLE{$RELtextVTS{$vts}}; $pgc++) {
      &writeTitlePGC;
    }
    
    if ($FOOTNOTES_IN_OWN_VTS ne "true") {
      #then footnote titles...
      for ($pgc=1; $pgc<=$MAXFNTITLE{$RELfnVTS{$vts}}; $pgc++) {
        &writeFNTitlePGC;
      }
    }
  }
  else {
    #footnote titles
    for ($pgc=1; $pgc<=$MAXFNTITLE{$RELfnVTS{$vts}}; $pgc++) {
      &writeFNTitlePGC;
    }  
  }
  
  print XML "\t\t</titles>\n";
  print XML "\t</titleset>\n";
}
print XML "</dvdauthor>";
close(XML);

AUTHOR:
# Calculate important statistics
$totaltitles = 0;
$maxprograms = 0;
$maxprogsinvts = 0;
$maxvtstitles = 0;
$bki = "";
for ($vts=1; $vts<=$LASTVTS; $vts++) {
  $allVTSTITLES = 0;
  if (exists($RELtextVTS{$vts})) {
    $bki = $bki."VTS:".$vts." has ".$MAXTITLE{$RELtextVTS{$vts}}." PGCs. ";
    $allVTSTITLES = ($allVTSTITLES+$MAXTITLE{$RELtextVTS{$vts}});  
  }
  if (exists($RELfnVTS{$vts})) {
    $bki = $bki."VTS:".$vts." has ".$MAXFNTITLE{$RELfnVTS{$vts}}." Footnote PGCs. ";
    $allVTSTITLES = ($allVTSTITLES+$MAXFNTITLE{$RELfnVTS{$vts}});
  }
  $bki = $bki."\n";
  if ($allVTSTITLES > $maxvtstitles) {$maxvtstitles = $allVTSTITLES;}
  $totaltitles = ($totaltitles + $allVTSTITLES);
  $progsinvts=0;
  if (exists($RELtextVTS{$vts})) {
    for ($pgc=1; $pgc<=$MAXTITLE{$RELtextVTS{$vts}}; $pgc++) {
      if ($MAXPROGRAM{$RELtextVTS{$vts}."-".$pgc} > $maxprograms) {$maxprograms = $MAXPROGRAM{$RELtextVTS{$vts}."-".$pgc};}
      $progsinvts = ($progsinvts + $MAXPROGRAM{$RELtextVTS{$vts}."-".$pgc});
    }
  }
  if (exists($RELfnVTS{$vts})) {
    for ($pgc=1; $pgc<=$MAXFNTITLE{$RELfnVTS{$vts}}; $pgc++) {
      if ($MAXFNPROGRAM{$RELfnVTS{$vts}."-".$pgc} > $maxprograms) {$maxprograms = $MAXFNPROGRAM{$RELfnVTS{$vts}."-".$pgc};}
      $progsinvts = ($progsinvts + $MAXFNPROGRAM{$RELfnVTS{$vts}."-".$pgc});
    }
  }
  if ($progsinvts > $maxprogsinvts) {$maxprogsinvts = $progsinvts;}
}

foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  $bki = $bki."Book ".$book." ";
  if ($FirstTITLEof{$book} == 1 && $FirstPROGRAMof{$book} == 1) {$bki = $bki." leads VTS ".$ABStextVTS{$FirstVTSof{$book}};}
  else {$bki = $bki." follows in VTS ".$ABStextVTS{$FirstVTSof{$book}};}
  if ($FirstVTSof{$book} != $VTSofCHAP{$book."-".$lastChapter{$book}}) {$bki = $bki." AND IS SPLIT ACROSS VTS";}
  $bki = $bki.".\n";
}

if ($control && $control==2) {goto NOAUTHOR;}
#Prepare output directory
if ($LASTVTS <= 99) {
  if ($totaltitles <= 99) {
    if (-e "$dvddir") {`rm -r "$dvddir/AUDIO_TS"`; `rm -r "$dvddir/VIDEO_TS"`;}
    else {`mkdir $dvddir`;}
    `dvdauthor -x $outdir/dvdauthor.xml`;
  }
  else {$structError = "TOTAL TITLES";} 
}
else {$structError = "TOTAL VTS";}

NOAUTHOR:

print $bki;
if ($structError ne "") {print "\nERROR: $structError must be less than 100! Adjust DontBreakBooks, MattewStartsVTS, AllBooksStartVTS, FootnotesInOwnVTS in config.txt file.\n\n";}
print "TOTAL VTS = $LASTVTS\n";
print "TOTAL TITLES = $totaltitles\n";
print "MAX TITLES FOR ANY VTS = $maxvtstitles\n";
print "MAX PAGES (CHAPTERS) FOR ANY TITLE = $maxprograms\n";
print "MAX PAGES (CHAPTERS) FOR ANY VTS = $maxprogsinvts\n";
print "\nFinished WORD-DVD on ".`date`."\n";

################################################################################
################################################################################
################################################################################
################################################################################

sub writeDummyMenusVTS(%%$) {
  my $maxtitlePTR = shift;
  my $maxprogramPTR = shift;
  my $isFN = shift; # false, textvts or ownvts
  
  my $ptrvts = 0;
  my $mrnm = "";
  
  if ($isFN eq "textvts") {
    $ofs = $MAXTITLE{$vts};
    $return = &jumpTo("text", "rregs", "noresume", "nohilt", "jumproot");
    $ptrvts = $RELfnVTS{$vts}; 
  }
  elsif ($isFN eq "ownvts") {
    $ofs = 0;
    $return = &jumpTo("text", "rregs", "noresume", "nohilt", "jumproot");
    $ptrvts = $RELfnVTS{$vts};
  }
  else {
    $ofs = 0;
    $return = &jumpTo("default", "noregs", "noresume", "nohilt", "jumptitle");
    $ptrvts = $RELtextVTS{$vts}; 
  }

  for ($pgc=1; $pgc <= $maxtitlePTR->{$ptrvts}; $pgc++) {
    PGCstartTag("\t\t\t<pgc>", "Dummy menu for title chapters.");
    $nummenus++;
    $MENU{$vts."-".$pgc."-".$isFN} = $nummenus;
    print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
    $menuentry = 0;
    
    if ($pgc == 1) {
      my $mvts = findPreviousVTS($vts, $isFN);
      if ($mvts == 0) {print XML "\t\t\t\t\t\tif ( ".$gJCHP." lt 1 ) {".$return."}\n";}
      else {
        my $mofs = 0;
        $mrnm = "";
        if ($isFN eq "false") {$mrnm = $gMRNM."=0;"; $mvts = $RELtextVTS{$mvts};} # reset sub-menu memory when VTS bounds are crossed.
        elsif ($isFN eq "textvts") {$mofs = $MAXTITLE{$mvts}; $mvts = $RELfnVTS{$mvts};}
        else {$mvts = $RELfnVTS{$mvts};}
        $lastpgc = $maxtitlePTR->{$mvts};
        $lastchp = $maxprogramPTR->{$mvts."-".$lastpgc};
        if ($isFN eq "false") {$mvts = $ABStextVTS{$mvts};}
        else {$mvts = $ABSfnVTS{$mvts};}
        print XML "\t\t\t\t\t\tif ( ".$gJCHP." lt 1 ) {".$mrnm.&jumpTo("text", "stitle".($STITLE{$mvts}+$mofs+$lastpgc-1)."-".$lastchp, "noresume", "nohilt", "jumptitle")."}\n";
      }
    }
    else {
      print XML "\t\t\t\t\t\tif ( ".$gJCHP." lt 1 ) {".&jumpTo("text", "stitle".($STITLE{$vts}+$ofs+$pgc-2)."-".$maxprogramPTR->{$ptrvts."-".($pgc-1)}, "noresume", $btext{"bprevious"}, "jumproot")."}\n";    
    }

    for ($chap=1; $chap <= $maxprogramPTR->{$ptrvts."-".$pgc}; $chap++) {
      if ($menuentry>$cMaxMenuPre) {
        print XML "\t\t\t\t\t\tjump menu ".($nummenus+1).";\n";
        print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
        print XML "\t\t\t</pgc>\n";
        PGCstartTag("\t\t\t<pgc>", "Dummy menu for title chapters. (OVERFLOW)");
        $nummenus++;
        print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
        $menuentry = 0;
      }
      print XML "\t\t\t\t\t\tif ( ".$gJCHP." eq $chap ) jump title ".($ofs+$pgc)." chapter ".$chap.";\n";
      $menuentry++;
    }
    if ($pgc == $maxtitlePTR->{$ptrvts}) {
      $mvts = findNextVTS($vts, $isFN);
      if ($mvts == 0) {print XML "\t\t\t\t\t\t{".$return."}\n";}
      elsif ($isFN eq "textvts") {print XML "\t\t\t\t\t\t{".&jumpTo("text", "stitle".($STITLE{$mvts}+$MAXTITLE{$mvts})."-1", "noresume", $btext{"bnext"}, "jumptitle")."}\n";}
      else {
        $mrnm = "";
        if ($isFN eq "false") {$mrnm = $gMRNM."=0;";} # reset sub-menu memory when VTS bounds are crossed.
        print XML "\t\t\t\t\t\t{".$mrnm.&jumpTo("text", "stitle".($STITLE{$mvts})."-1", "noresume", $btext{"bnext"}, "jumptitle")."}\n";
      }
    }
    else {
      print XML "\t\t\t\t\t\t{".&jumpTo("text", "stitle".($STITLE{$vts}+$ofs+$pgc)."-1", "noresume", $btext{"bnext"}, "jumproot")."}\n";
    }

    print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
    print XML "\t\t\t</pgc>\n";
  }
}

sub writeMapperFNMenusVTS($$$$$$){
  # ALL VTS ARE RELATIVE!
  my $svts = shift;
  my $stit = shift;
  my $schp = shift;
  my $evts = shift;
  my $etit = shift;
  my $echp = shift;
  my $xvts, $xtit, $xchp, $lastchap, $lastpgc, $noFNyet, $ofs;
    
  undef(%FNMENU);
  for ($xvts=$svts; $xvts<=$evts; $xvts++) {
    if (!exists($MAXTITLE{$xvts})) {next;} # don't go off the end, regardless of $evts.
    $noFNyet = "true";
    $ofs = $MAXTITLE{$xvts};
    if ($FOOTNOTES_IN_OWN_VTS eq "true") {$ofs = 0;}
    $lastchap = "";
    $lastpgc = "";
    my $s1 = 1;
    my $e1 = $MAXTITLE{$xvts};

    if ($xvts == $svts) {$s1 = $stit;}
    if ($xvts == $evts) {$e1 = $etit;}
    for ($xtit=$s1; $xtit<=$e1; $xtit++) {
      if ($noFNyet eq "true" && $TITLEHASFN{$xvts."-".$xtit} ne "true") {next;}
      $noFNyet = "false";
      my $s2 = 1;
      my $e2 = $MAXPROGRAM{$xvts."-".$xtit}+1;
      if ($xvts == $svts && $xtit == $stit) {$s2 = $schp;}
      if ($xvts == $evts && $xtit == $etit) {$e2 = $echp;}
      if ($xvts == $evts && $xtit == $etit && $s2==$e2 && $e2==1) {goto DUMMYFIN;} #exit if last title empty
      print XML PGCstartTag("\t\t\t<pgc>", "Dummy mapper menu for footnote pages from vts $xvts, title $xtit.", "true");
      #print XML PGCstartTag("\t\t\t<pgc>", "Dummy mapper menu for footnote pages from title $xtit.", "true");
      print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
      $nummenus++;
      $FNMENU{$ABStextVTS{$xvts}."-".$xtit} = $nummenus;
      if ($TITLEHASFN{$xvts."-".$xtit} eq "true") {
        $menuentry=0;
        for ($xchp=$s2; $xchp<$e2; $xchp++) {
          if (!exists($FNCHAPTERFOR{$xvts."-".$xtit."-".$xchp})) {next;}
          if ($menuentry > $cMaxFNMenuPre) {
            print XML "\t\t\t\t\t\tjump menu ".($nummenus+1).";\n";
            print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
            print XML "\t\t\t</pgc>\n";
            print XML PGCstartTag("\t\t\t<pgc>", "Dummy mapper menu for footnote pages. (OVERFLOW)", "true");
            $nummenus++;
            print XML "\t\t\t\t<pre>\n\t\t\t\t\t{\n";
            $menuentry = 0;
          }
          if ($lastchap ne "") {
            print XML "\t\t\t\t\t\tif ( ".$gJCHP." lt ".$xchp." ) jump title ".($ofs+$FNTITLEFOR{$xvts."-".$lastpgc."-".$lastchap})." chapter ".$FNCHAPTERFOR{$xvts."-".$lastpgc."-".$lastchap}.";\n";
            $menuentry++;
          }
          
          $lastchap = $xchp;
          $lastpgc = $xtit;
        }
      }
      
      print XML "\t\t\t\t\t\tjump title ".($ofs+$FNTITLEFOR{$xvts."-".$lastpgc."-".$lastchap})." chapter ".$FNCHAPTERFOR{$xvts."-".$lastpgc."-".$lastchap}.";\n";
      print XML "\t\t\t\t\t}\n\t\t\t\t</pre>\n";
      print XML "\t\t\t</pgc>\n";
    }
  }
DUMMYFIN:
}

sub findNextVTS($$) {
  my $absvts = shift;
  my $isFN = shift; # false, textvts or ownvts
  if ($isFN eq "false") {$absvts = $ABStextVTS{$RELtextVTS{$absvts}+1};}
  elsif ($isFN eq "ownvts") {$absvts = $ABSfnVTS{$RELfnVTS{$absvts}+1};}
  else {
    $absvts++;
    while ($absvts <= $LASTVTS && (!exists($MAXFNTITLE{$RELfnVTS{$absvts}}) || $MAXFNTITLE{$RELfnVTS{$absvts}} == 0)) {$absvts++;}
    if ($absvts > $LASTVTS) {$absvts = 0;}
  }
  if ($absvts eq "" || !$absvts) {$absvts=0;}
  return $absvts;
}

sub findPreviousVTS($$) {
  my $absvts = shift;
  my $isFN = shift; # false, textvts or ownvts
  if ($isFN eq "false") {$absvts = $ABStextVTS{$RELtextVTS{$absvts}-1};}
  elsif ($isFN eq "ownvts") {$absvts = $ABSfnVTS{$RELfnVTS{$absvts}-1};}
  else {
    $absvts--;
    while ($absvts > 0 && (!exists($MAXFNTITLE{$RELfnVTS{$absvts}}) || $MAXFNTITLE{$RELfnVTS{$absvts}} == 0)) {$absvts--;}
  }
  if ($absvts eq "" || !$absvts) {$absvts=0;}
  return $absvts;
}

sub writeMenuButtonsVMGM($$) {
  my $amenu = shift;
  my $tocnum = shift;
  for ($b=1; $b<=18; $b++) {
    if (!$allButtons{$amenu."-".$b}) {next;}
    $target = $allButtons{$amenu."-".$b};
    $highbutnum = 1024;
    if ($b == 9 && $prevbuttonnum{$target})  {$highbutnum = $prevbuttonnum{$target};}
    if ($b == 18 && $nextbuttonnum{$target}) {$highbutnum = $nextbuttonnum{$target};}
    $m=""; $n="";
    if ($target =~ /([^-]+)-m?(\d+)/) {
      $m = $1;
      $n = $2;
    }
    $highcommand = " ".$gHILB."=".$highbutnum."; ";
    $command = "";
    
    #jump to a vmgm TOC menu
    if ($m eq "toc") {$command = $highcommand."jump menu ".($n+$tocnum-1)."; ";}
    #jump to sub-menu
    elsif (exists($books{$m})) {
      $hib = "nohilt";
      if ($n==1) {
        if ($nextbuttonnum{$m."-m1"}) {$hib = $nextbuttonnum{$m."-m1"};}
        else {
          for ($b2=1; $b2<=18; $b2++) {
            if ($b2==9) {next;} # Don't hilight "back" button
            if (!$allButtons{$m."-m1"."-".$b2}) {next;}
            $hib = (1024*$b2);
            last;
          }
        }
      }
      if ($hib == 1024) {$hib = "nohilt";} #saves instructions! Must be < 128
      $command = &jumpTo("menu", "topof$m", "noresume", $hib, $ABStextVTS{$FirstVTSof{$m}}, "jumproot");
    }
    #jump to a project menu
    elsif (exists($menuVMGM{$target})) {
      $command = "";
      # if target is extra menu with two or more buttons, highlight the second (rather than the return button)
      if ($allButtons{$target."-2"}) {$command = $command." ".$gHILB."=2048;";} 
      $command = $command." jump menu ".$menuVMGM{$target}."; ";
    }
    else {print "ERROR: Could not locate target \"".$target."\".\n";}
    print XML "\t\t\t\t<button name=\"b$b\">{ ".$gMTHI."=s8;".$command."}</button>\n";
  }
}


sub writeMenuButtonsVTS($) {
  my $amenu = shift;
  
  if ($amenu !~ /^([^-]+)-m/) {die "Bad VTS menu name: $amenu";}
  my $bk = $1;
  for ($b=1; $b<=18; $b++) {
    if (!$allButtons{$amenu."-".$b}) {next;}
    $target = $allButtons{$amenu."-".$b};
    if ($target !~ /([^-]+)-(m?)(\d+)/) {die "Bad target \"$target\"";}
    $m = $1;
    $t = $2;
    $n = $3;
    
    #jump back to TOC
    if ($m eq "toc") {$command = &jumpTo("title", "noregs", "noresume", "nohilt", "jumptitle");} #&jumpTo("default", "noregs", "noresume", "nohilt", "jumptitle");}
    #jump to another menu
    elsif ($t && $m eq $bk) {
      $hibutton = 1024;
      if ($b == 9 && $prevbuttonnum{$target})  {$hibutton = $prevbuttonnum{$target};}
      if ($b == 18 && $nextbuttonnum{$target}) {$hibutton = $nextbuttonnum{$target};}
      $command = "";
      if ($n == 1) {
        # insures selection doesn't get whiped out!
        $command = $gTYPE."=2; ".$gMRNM."=0; ".$gMRHI."=".$hibutton."; ";
      }
      else {
        $command = $gHILB."=".$hibutton."; ";
      }
      $command = $command."jump menu ".($VTSSUBMENU{$bk}+$n-1)."; ";
    }
    #jump to a text page
    elsif ($m eq $bk) {$command = $gMRHI."=s8;".&jumpTo("text", "bchapter$bk-$n", "noresume", $btext{"bnext"}, "jumproot");}
    else {die "Illegal target \"$target\" in menu \"$amenu\"";}
    print XML "\t\t\t\t<button name=\"b$b\">{ ".$command."}</button>\n";
  }
}


sub writeTitlePGC {
  PGCstartTag("\t\t\t<pgc>", "Text Title.");
  print XML "\t\t\t\t<pre>{ s8=".$gHILB."; ".$gJSTI."=s4; ".$gJCHP."=s7; }</pre>\n"; # So that if user presses "root menu" button, the correct menu is chosen

  #assign buttons
  print XML "\t\t\t\t<button name=\"bhelp\">{".&jumpTo("help", "noregs", "sregs", $nbhelp, "callroot")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bmainmenu\">{".&jumpTo("title", "sregs", "noresume", "nohilt", "calltitle")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bsubmenu\">{".&jumpTo("menu", "sregs", "noresume", "memhilt", "callroot")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bprevious\">{".&traverse("text", "prev")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bfootnotes\">{".&jumpTo("fn", "sregs", "sregs", $bfoot{"bfootnotes"}, "callroot")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bnext\">{".&traverse("text", "next")."}</button>\n";
  
  #generate video contents        
  for ($vob=1; exists $FILE{$RELtextVTS{$vts}."-".$pgc."-".$vob}; $vob++) {
    $file = $FILE{$RELtextVTS{$vts}."-".$pgc."-".$vob};
    #is VOB file multiple pages or a single page?
    if ($file =~ /([^-]+)-(\d+)-(\d+)\.mpg$/) {
      my $bk = $1;
      my $ch = $2;
      my $pg = $3;
      
      if ($haveAudio{$bk."-".$ch} ne "still") {
        #Using a cell with start AND end time seems to fix the problem of early switching to next page's slide image,
        #as long as end time is at least one frame before the actual end. However, this causes a noticeable audio glitch.
        my $end = "00:00:00.00";
        my $ps = 0;
        my $pe = 0;
        @chaps = split(/,/, $Chapterlist{$bk."-".$ch});
        $ps = &unformatTime($chaps[$pg-1]);
        if ($pg == $lastPage{$bk."-".$ch}) {
          $pe = $Chapterlength{$bk."-".$ch};
        }
        else {$pe = &unformatTime($chaps[$pg]);}
        $pe = ($pe - 0.04); #shorten cell by one frame to ensure cell plays to completeion before showing next video frame
        $end = &formatTime($pe-$ps);

        if ($end eq "00:00:00.00") {die "Missing chapter length for $bk-$ch";} 
        print XML "\t\t\t\t<vob file=\"".$file."\" ><cell chapter=\"1\" start=\"00:00:00.00\" end=\"".$end."\" /></vob>\n";
      }
      else {
        print XML "\t\t\t\t<vob file=\"".$file."\" chapters=\"00:00:00.00\" pause=\"inf\" ></vob>\n";
      }
    }
    else {
      #a 1 frame gap was added between each page for DVDAUTHOR, so we must add that to chapter times as well
      @chaps = split(/,/, $CHAPTERS{$RELtextVTS{$vts}."-".$pgc."-".$vob});
      my $gap = 0;
      foreach $chap (@chaps) {
        $chap = (&unformatTime($chap)+$gap);
        $gap = ($gap + 0.040);
        $chap = &formatTime($chap);
      }
      #1 second pause is necessary so that early switching to next chapter does not occur
      print XML "\t\t\t\t<vob file=\"".$file."\" chapters=\"".join(",", @chaps)."\" pause=\"1\" ></vob>\n";
    }
  }
  
  #post commands (important for audio chapters)...
  if ($pgc == $MAXTITLE{$RELtextVTS{$vts}}) {
    $mvts = findNextVTS($vts, "false");
    if ($mvts == 0) {$post = "{".&jumpTo("default", "noregs", "noresume", "nohilt", "calltitle")."}";}
    else {$post = "{".&jumpTo("text", "stitle".$STITLE{($vts+1)}."-1", "noresume", $btext{"bnext"}, "calltitle")."}";}
  }
  else {
    $post = "{".&jumpTo("text", "stitle".($STITLE{$vts}+$pgc)."-1", "noresume", $btext{"bnext"}, "callroot")."}";
  }
  print XML "\t\t\t\t<post>$post</post>\n";
  print XML "\t\t\t</pgc>\n";
}


sub writeFNTitlePGC {
  PGCstartTag("\t\t\t<pgc>", "Footnote Title");
  print XML "\t\t\t\t<pre>{ s8=".$gHILB."; }</pre>\n";

  #assign buttons
  print XML "\t\t\t\t<button name=\"bhelp\">{".&jumpTo("help", "noregs", "noresume", $nbhelp, "callroot")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bmainmenu\">{".&jumpTo("title", "rregs", "noresume", "nohilt", "calltitle")." }</button>\n";
  print XML "\t\t\t\t<button name=\"bsubmenu\">{".&jumpTo("menu", "rregs", "noresume", "memhilt", "callroot")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bprevious\">{".&traverse("fn", "prev")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bfootnotes\">{".&jumpTo("text", "rregs", "noresume", $btext{"bfootnotes"}, "callroot")."}</button>\n";
  print XML "\t\t\t\t<button name=\"bnext\">{".&traverse("fn", "next")."}</button>\n";
  
  #generate video contents
  for ($vob=1; $vob <= $MAXFNPROGRAM{$RELfnVTS{$vts}."-".$pgc}; $vob++) {
    print XML "\t\t\t\t<vob file=\"".$FNFILE{$RELfnVTS{$vts}."-".$pgc."-".$vob}."\" chapters=\"00:00:00.00\" pause=\"inf\" ></vob>\n";
  }

  print XML "\t\t\t</pgc>\n";
}


sub menuSelector($$$$$) {
  my $mstartnum = shift;
  my $mpat = shift;
  my $tpat = shift;
  my $book = shift;
  my $pref = shift;
  
  my $menu = "";
  my $bk = "";
  
  if ($book eq "") {$rn = $gMTNM; $rh = $gMTHI;}
  else {$rn = $gMRNM; $rh = $gMRHI;}
  my $ret = $pref.$gHILB."=".$rh.";\n";

  foreach $menu (sort {$allMenus{$b} <=> $allMenus{$a}} keys %allMenus) {
    if ($menu !~ /$mpat/) {next;}
    my $n = ($1+$mstartnum-1);
    if ($n == $mstartnum) {next;}

    $ret = $ret.$pref."if ( ".$rn." eq ".$n." ) jump menu ".$n.";\n";
  }
  return $ret;
}


sub menuSelectorSREGS($$$$$$) {
  my $mstartnum = shift;
  my $mpat = shift;
  my $tpat = shift;
  my $book = shift;
  my $pref = shift;
  my $type = shift;
  
  my $menu = "";
  my $bk = "";
  my $ret = "";
  
  foreach $menu (sort {$allMenus{$b} <=> $allMenus{$a}} keys %allMenus) {
    if ($menu !~ /$mpat/) {next;}
    my $n = ($1+$mstartnum-1);
    if ($n == $mstartnum) {last;}
    
    my $t = $allButtons{$menu."-1"};
    if ($allButtons{$menu."-1"} !~ /$tpat/) {next;}
    if ($book eq "") {
      $bk = $1;
      if (exists($chapters{$bk."-0"})) {$ch = 0;}
      else {$ch = 1;}
    }
    else {$bk = $book; $ch = $1;}
    
    my $jval = $cMaxProgram*($STITLE{$ABStextVTS{$VTSofCHAP{$bk."-".$ch}}}+$TITLEofCHAP{$bk."-".$ch}-1) + $PROGRAMofCHAP{$bk."-".$ch};
    if ($type eq "noprint") {
      $ret = $ret.$pref."if ( ".$gMDST." ge ".$jval." ) jump menu ".$n.";\n";
    }
    else {
      print XML $pref."if ( ".$gMDST." ge ".$jval." ) jump menu ".$n.";\n";
    }
  }
  return $ret;
}


sub menuHighlightSREGS($$) {
  my $menu = shift;
  my $pref = shift;
  
  my $bn=0;
  my %bnums;
  for ($b=1; $b<=18; $b++) {
    if (!exists($allButtons{$menu."-".$b})) {next;}
    $bn++;
    $bnums{$b} = $bn;
  }
  
  my $b=0;
  for ($b=17; $b>=1; $b--) {
    if ($b==9) {next;}
    if (!exists($allButtons{$menu."-".$b})) {next;}
    my $targ = $allButtons{$menu."-".$b};
    my $bk = "";
    my $ch = "";
    if ($targ =~ /^(.*?)-(\d+)/) {$bk=$1; $ch=$2;}
    elsif ($targ =~ /^(.*?)-m(\d+)/) {
      $bk=$1;
      if (exists($chapters{$bk."-0"})) {$ch = 0;}
      else {$ch = 1;}
    }
    else {die "Could not parse target $targ of $menu-$b";}
    my $jval = $cMaxProgram*($STITLE{$ABStextVTS{$VTSofCHAP{$bk."-".$ch}}}+$TITLEofCHAP{$bk."-".$ch}-1) + $PROGRAMofCHAP{$bk."-".$ch};
    print XML $pref."if ( ".$gMDST." ge ".$jval." ) ".$gHILB."=".($bnums{$b}*1024).";\n";
  }
}
        

sub jumpTo($$$$$) {
  my $type = shift;
  my $dest = shift;
  my $resm = shift;
  my $hilt = shift;
  my $vts  = shift;
  
#print "VARS: $type, $dest, $resm, $hilt, $vts\n";
  
  my $bk = 0;
  my $ch = 0;
  my $stit = 0;
  
  my $c = " ";
  
  # TYPE
  my $t = $defType;
  if ($type eq "text") {$t = 0;}
  elsif ($type eq "fn") {$t = 1;}
  elsif ($type eq "menu") {$t = 2;}
  elsif ($type eq "help") {$t = 3;}
  elsif ($type eq "title") {$t = 4;}
  elsif ($type eq "default") {$t = $defType;}
  else {die "BAD jumpTo type $type: $type, $dest, $resm, $hilt, $vts";}
  $c = $c.$gTYPE."=".$t."; ";
  
  # DESTINATION
  if ($dest =~ /^bchapter([^-]+)-(\d+)$/) { # book-ch
    $bk = $1;
    $ch = $2;
    $c = $c.$gJSTI."=".($STITLE{$ABStextVTS{$VTSofCHAP{$bk."-".$ch}}}+$TITLEofCHAP{$bk."-".$ch}-1)."; ".$gJCHP."=".$PROGRAMofCHAP{$bk."-".$ch}."; ";
  }
  elsif ($dest =~ /^topof(.*)$/) { # topofbook
    $bk = $1;
    $c = $c.$gJSTI."=".($STITLE{$ABStextVTS{$FirstVTSof{$bk}}}+$FirstTITLEof{$bk}-1)."; ".$gJCHP."=".$FirstPROGRAMof{$bk}."; ";
  }
  elsif ($dest =~ /^stitle(\d+)-(\d+)$/) { # stitle-program
    $sti = $1;
    $ch = $2;
    $c = $c.$gJSTI."=".$sti."; ".$gJCHP."=".$ch."; ";
  }
  elsif ($dest eq "sregs") {$c = $c.$gJSTI."=s4; ".$gJCHP."=s7; ";} # to system registers
  elsif ($dest eq "rregs") {$c = $c.$gJSTI."=".$gRSTI."; ".$gJCHP."=".$gRCHP."; ";} # to resume registers
  elsif ($dest ne "noregs") {die "BAD jumpTo dest $dest: $type, $dest, $resm, $hilt, $vts";}
  
  # RESUME
  if ($resm eq "sregs") {$c = $c.$gRSTI."=s4; ".$gRCHP."=s7; ";} # set resume to current location
  elsif ($resm ne "noresume") {die "BAD jumpTo resm $resm: $type, $dest, $resm, $hilt, $vts";}
  
  # HIGHLIGHT REGISTER
  if ($hilt =~ /^\d+$/) {
    if ($type eq "menu") {$c = $c.$gMRHI."=".$hilt."; ";} # must overwrite memory var to do hilight
    else {$c = $c.$gHILB."=".$hilt."; ";}
  }
  elsif ($hilt ne "nohilt" && $hilt ne "memhilt") {die "BAD jumpTo hilt $hilt: $type, $dest, $resm, $hilt, $vts";}
  
  if ($vts =~ /^\d+$/) {
    $c = $c."jump titleset ".$vts." menu entry root; ";
  }
  elsif ($vts eq "jumptitle") {
    $c = $c."jump vmgm menu entry title; ";
  }
  elsif ($vts eq "calltitle") {
    $c = $c."call vmgm menu entry title; ";
  }
  elsif ($vts eq "jumproot") {
    $c = $c."jump menu entry root; ";
  }
  elsif ($vts eq "callroot") {
    $c = $c."call menu entry root; ";
  }
  else {die "BAD jumpTo vts $vts: $type, $dest, $resm, $hilt, $vts";}
  
  return $c;
}


sub resetdest() {
  return " ".$gJSTI."=1; ".$gJCHP."=1; ";
}


sub traverse($$) {
  my $type = shift;
  my $dir = shift;
  my $hl = "";
  my $c = " ";
  
  #jumping to root is always ok because root menu will handle all VTS values
  if ($dir eq "prev") {
    if ($type eq "text") {$hl = $btext{"bprevious"};}
    else {$hl = $bfoot{"bprevious"};}
    $c = $c.$gJSTI."=s4; ".$gJCHP."=s7-1; ".$gTYPE."=0; ".$gHILB."=".$hl."; call menu entry root; ";
  }
  elsif ($dir eq "next") {
    if ($type eq "text") {$hl = $btext{"bnext"};}
    else {$hl = $bfoot{"bnext"};}
    $c = $c.$gJSTI."=s4; ".$gJCHP."=s7+1; ".$gTYPE."=0; ".$gHILB."=".$hl."; call menu entry root; ";
  }
  else {die "\nILLEGAL traverse TYPE\n";}
}

sub bookfits($$$$$) {
  my $book = shift;
  my $title = shift;
  my $fntitle = shift;
  my $program = shift;
  my $fnprogram = shift;
  
  my $ch = 1;
  my $pg =1;
  my $progsinbook = 0;
  my $fnprogsinbook = 0;
  for ($ch = 0; $ch <= $lastChapter{$book}; $ch++) {
    if (!$chapters{"$book-$ch"}) {next;}
    for ($pg = 1; $pg <= $lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      $progsinbook++;
      $pgn=1;
      while (-e "$outdir/video/$book/fin-fn-$book-$ch-$pg-$pgn.mpg") {$pgn++; $fnprogsinbook++;}
    }
  }
  $program = $program + $progsinbook;
  $fnprogram = $fnprogram + $fnprogsinbook;
  $title = $title + sprintf("%i", ($program/$cMaxProgram));
  $fntitle = $fntitle + sprintf("%i", ($fnprogram/$cMaxProgram));
  if (($title + $fntitle) > $cMaxTitleVTS) {return 0;}
  else {return 1;}
}

sub writeVideoInfo() {
  print XML "\t\t\t<video format=\"pal\" aspect=\"4:3\" />\n";
  print XML "\t\t\t<audio lang=\"$lang\" />\n";
  print XML "\t\t\t<subpicture lang=\"".$lang."\" />\n";
}

sub PGCstartTag($$$) {
  my $tag = shift;
  my $comm = shift;
  my $noprint = shift;
  
  $CurrentPGCnumber++;
  $comm = "(vts $vts, pgc ".$CurrentPGCnumber.") ".$comm;
  
  if ($noprint eq "true") {
    $noprint = $tag;
    $noprint = $noprint."\t";
    $noprint = $noprint.comment($comm, "true");
    $noprint = $noprint."\n";  
  }
  else {
    print XML $tag;
    print XML "\t";
    comment($comm);
    print XML "\n";
  }
  return $noprint;
}

sub comment($$) {
  my $comment = shift;
  my $noprint = shift;
  if ($noprint eq "true") {$noprint = "<!-- ".$comment." !-->";}
  else {print XML "<!-- ".$comment." !-->";}
  return $noprint;
}

################################################################################
