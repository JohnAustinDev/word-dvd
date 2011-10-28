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

# SCRIPT osis2html.pl reads an OSIS file (an OSIS file which follows the stricter 
# conventions required by MK modules) and creates html which is suitable
# for display on the DVD.

use Encode;

$scriptdir = @ARGV[0];
require "$scriptdir/init.pl" || die "Can't require init.pl";

$infile = "$indir/osis.xml";

$AddChapterNumbers = $localeFile{"AddChNums2Text"};

$INDENT = "<span class=\"paragraph-start\"></span>";
$PARAGRAPH = "<br>$INDENT";
$NEWCHAPTER = "<span name=\"chapter.";
$TITLES = "title-1|title-2|book-title|chapter-title|text-header|menu-header"; 

open (LOGF, ">>$outdir/logfile.txt");
$log = "Starting osis2html.pl\n"; &Log;
open (INF, "<$infile") || finish("Could not open infile $infile.\n");
$notenum=1;
$line=0;
$inMajorQuote = 0;
$lastbkch = "none";
$alltext{$lastbkch} = "";
while(<INF>) {
  $line++;
  $_ = decode("utf8", $_);
  utf8::upgrade($_);
  
  # Preverse Titles
  $preVerseTitle = $preVerseTitle . title2HTML(\$_, "preverse", "(<title [^>]*subType=\"x-preverse\"[^>]*>)(.*?)<\/title>");
  
  # Process input line...
  if ($_ =~ /<chapter osisID=\"([^\"]+)\">/) {$inintro = "false"; $inMajorQuote = 0; next;}
  elsif ($_ =~ /<div type=\"book\" osisID=\"([^\"]+)\">/) {$inintro = "true"; $introbook = "$1"; next;}
  # Verses
  elsif ($_ =~ /<verse[^>]* osisID="(([^\.]+)\.(\d+)\.[^\"]+)"[^>]*>(.*?)(<verse[^\/]*\/>|<\/verse)/) {
    $id = $1;
    $bk = $2;
    $ch = $3;
    $txt= $4;
    
    $vs = "";
    $lv = "";
    if ($id =~ /^\s*$bk\.$ch\.(\d+\s*-\s*\d+)\s*$/) {$vs = $1;} # illegal osisID, but here for backward compatibility
    else {
      while ($id =~ s/^\s*$bk\.$ch\.(\d+)(\s|$)//) {
        if ($vs eq "") {$vs = $1;}
        elsif ($lv eq "" || $lv < $1) {$lv = $1;}
      }
      if ($lv ne "") {$vs = "$vs-$lv";}    
      if ($id !~ /^\s*$/) {$log = "ERROR Line $line: Could not parse osisID \"$vs\"\n"; &Log;}
    }
    
    # remove cross references now since they complicate convertMajorQuotes subroutine
    $txt =~ s/<note type="crossReference"[^>]*>.*?<\/note>//g; 
    # replace major quotes before converting to HTML because regular expressions refer to OSIS markup    
    if (exists($localeFile{"MajorQuoteS"}) && exists($localeFile{"MajorQuoteE"})) {
      convertMajorQuotes(\$txt, \$inMajorQuote, $localeFile{"MajorQuoteS"}, $localeFile{"MajorQuoteE"}, \$alltext{$lastbkch}); 
    }

    convert2HTML(\$txt);
        
    $newhtml = $preVerseTitle . "<sup>$vs</sup>" . $txt . " "; #space ensures possibility of page break before following title or ?.
    $preVerseTitle = "";
    
    #Remove indents/blank-lines before divs (important for page formatting and breaking!)
    if ($newhtml =~ /^(<div[^>]+>.*?<\/div>)/) {$alltext{$lastbkch} =~ s/(<br>|$INDENT|\s)*$/ \n/i;}
    $newhtml =~ s/(<br>|$INDENT|\s)*(<div[^>]+>.*?<\/div>)/ $2/ig; #also insure all divs have space before
  }
  # Introductions
  elsif ($inintro eq "true" && $_ !~ /^\s*$/) {
    $bk = $introbook;
    $ch = 0;
    
    chop;
    convert2HTML(\$_);
  
    $newhtml = $_;
  }
  else {next;}
  
  # Add soft hyphens
  if ($localeFile{"Hyphen"}) {addSoftHyphens(\$newhtml);}
  
  # Save converted text
  $alltext{"$bk.$ch"} = $alltext{"$bk.$ch"} . $newhtml . "\n";
  $lastbkch = "$bk.$ch";
}
close(INF);

# Find books, max chapters, and max verses...
foreach $key (keys %alltext) {
  if ($key !~ /^(\w+)\.(\d+)$/ && $alltext{$key} !~ /^\s*$/) {$log="Error: Bad key found! key=\"$key\" text=\"".$alltext{$key}."\"\n"; &Log;}
  $bk = $1;
  $ch = $2;
  if (!$bk || !$ch) {next;}
  
  if ($ch > $maxchap{$bk}) {$maxchap{$bk} = $ch;}
  $book{$bk}++;
}

# Prepare output directory
if (!(-e $htmldir)) {`mkdir $htmldir`;}

# Write the html files...
$htmlheader = "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\"><html><head><meta http-equiv=\"content-type\" content=\"text/html; charset=utf-8\"><link rel=\"stylesheet\" type=\"text/css\" href=\"pal.css\" /></head>";
$htmlheader .= "<body class=\"text\">";
$htmlheader .= "<div class=\"usable\">";
$htmlheader .= "<div id=\"text-page1\" class=\"page\" style=\"overflow:visible\">";
# NOTE everything up to first \n is stripped off by Word-DVD!
$htmlheader .= "<div id=\"text-header-left\" class=\"text-header\" style=\"max-width:999px; width:100%;\">THISBK</div>\n";

$htmlfooter = "</div></div></body>";
$htmlfooter = $htmlfooter."</html>";

foreach $bk (sort keys %book) {
  open (OUTF, ">$htmldir/$bk.html") || finish("Could not open outfile $htmldir/$bk.html\n");
  $booklocal = decode("utf8", $bk);
  utf8::upgrade($booklocal);
  $booklocal = $localeFile{$booklocal};

  my $hdr = $htmlheader;
  $hdr =~ s/THISBOOK/$booklocal/;
  &Write($hdr);
  $introduction = "";
  for ($ch=0; $ch<=$maxchap{$bk}; $ch++) {
    if ($alltext{"$bk.$ch"} =~ /^\s*$/) {next;}
    
    # Show book name at top of chapter 1
    if ($ch == -5) {$print = $NEWCHAPTER."1\"><\/span><div class=\"book-title\">$booklocal</div>";}
    else {$print = $NEWCHAPTER.$ch."\"><\/span>";}
    
    if ($ch > 0) {
      if ($AddChapterNumbers eq "true") {
        $chaplocal = "";
        if ($bk eq "Ps") {
          $chaplocal = decode("utf8", "PsalmTerm");
          utf8::upgrade($chaplocal);
          $chaplocal = $localeFile{$chaplocal};
        }
        if (!$chaplocal) {
          $chaplocal = decode("utf8", "Chaptext");
          utf8::upgrade($chaplocal);
          $chaplocal = $localeFile{$chaplocal};
        }
        $chaplocal =~ s/\%1\$S/$ch/;
        $print =  $print . "<div class=\"chapter-title\">$chaplocal</div>";
      }
    }
    
    $print =  $print . $alltext{"$bk.$ch"};

    #Eliminate consecutive spaces
    $print =~ s/  +/ /g;

    # TEMPORARY FIX: PERMANENT ONE SHOULD BE IN SFM TO OSIS CONVERTER
    $print =~ s/(<sup>[^>]+<\/sup>)($INDENT|<br>|\s)+/$1$INDENT/i;
            
    #Move verse numbers after any indents
    if ($ch > 0) {$print =~ s/(<sup>[^>]+<\/sup>)($INDENT)/$2$1/g;}
    
    #Put Majorquotes on a single line with verse markers inside the div
    while ($print =~ /(<div class="majorquote">.*?)<\/div>\s*(<sup>[^<]*<\/sup>)\s*<div class="majorquote">/gim) {
      $print =~ s/(<div class="majorquote">.*?)<\/div>\s*(<sup>[^<]*<\/sup>)\s*<div class="majorquote">/$1$2/gim
    }
    
    #Move leading/finishig white space in non-splitable tags outside the tag
    $print =~ s/(<(span|sup|i|b)[^>]*>)(\s)/$3$1/gi;
    $print =~ s/(\s)(<\/(span|sup|i|b)[^>]*>)/$2$1/gi;
    
    if ($ch == 0) {$introduction = $introduction.$print;}
    else {&Write($print, "true"); $print = "";}
  }
  &Write($htmlfooter);
  close (OUTF);
  
  # Save introduction to separate file
  if ($introduction ne "") {
    open (OUTF, ">$htmldir/$bk.intr.html") || finish("Could not open outfile $htmldir/$bk.intr.html\n");
    &Write($hdr);
    &Write($introduction, "true");
    &Write($htmlfooter);
    close (OUTF);
  }
}

# Write the footnote files...
foreach $bk (sort keys %book) {
  open (OUTF, ">$htmldir/$bk.fn.html") || finish("Could not open outfile $htmldir/$bk.fn.html\n");
  my $bkl = decode("utf8", $bk);
  utf8::upgrade($bkl);
  $bkl = $localeFile{$bkl};
  my $fhdr = $htmlheader;
  $fhdr =~ s/THISBOOK/$bkl/;
  &Write($fhdr);
  for ($ch=1; $ch<=$maxchap{$bk}; $ch++) {
    &Write($allnotes{"$bk.$ch"}, "true");
  }
  &Write($htmlfooter);
  close (OUTF);
}

# Log all tags in the output file
foreach $tag (sort keys %tags) {$log = "$log$tag\n";}
$log = "Following is a list of tags:\n$log\n"; &Log;


# Log all div classes in the output file
foreach $dclass (sort keys %divClasses) {$log = "$log$dclass\n";}
$log = "Following is a list of div classes:\n$log\n"; &Log;

$log = "\Finishing osis2html.pl\n"; &Log;
close(LOGF);

finish("");

################################################################################
sub convert2HTML(\$) {
  my $xin = shift;
  
  # Any remaining (non-preverse) titles
  title2HTML($xin, "inline", "(<title[^>]*>)(.*?)<\/title>");
  
  # Convert all references
  $$xin =~ s/<reference[^>]*>(.*?)<\/reference>/$1/ig;
  
  # Convert all lists
  $$xin =~ s/<(list|item)[^>]*type\s*=\s*"(.*?)"[^>]*>/<div class="$2">/ig;
  $$xin =~ s/<(list|item)([^>]*)>/<div$2>/ig;
  $$xin =~ s/<\/(list|item)>/<\/div> /ig; # add space after tag so that page break is possible
  
  # Convert indents
  $$xin =~ s/<milestone type="x-p-indent"[^>]*\/>/$INDENT/ig;
  $$xin =~ s/<lb type="x-begin-paragraph"[^>]*\/>/<br>$INDENT/ig; # ESV
    
  # Convert line breaks
  $$xin =~ s/<lb[^\/]*\/>/<br>/ig;
  $$xin =~ s/<lg [^>]*\/>/<br>&nbsp;<br>/gi; # ESV this type of double break will not be removed.
  
  # Convert font hilights
  $$xin =~ s/<hi [^>]*type="(b|bold)"[^>]*>(.*?)<\/hi>/<b>$2<\/b>/ig;
  $$xin =~ s/<hi [^>]*type="(i|italic)"[^>]*>(.*?)<\/hi>/<i>$2<\/i>/ig;
  $$xin =~ s/<foreign[^>]*>(.*?)<\/foreign>/<i>$1<\/i>/ig; # ESV
  
  # Special Quotes
  $$xin =~ s/<milestone[^>]*marker="([^"]*)"[^>]*\/>/$1/gi; #" ESV
  $$xin =~ s/<q[^>]*marker="([^"]*)"[^>]*\/>/$1/gi; #" ESV
  
  &removeTags($xin);
  
  # Remove and save all notes
  while ($$xin =~ /(<note([^>]*)>\s*(.*?)\s*<\/note>)/i) {
    my $whole = $1;
    my $type = $2;
    my $note = $3;
    my $rep = "";
    
    if ($type !~ /type="crossReference"/) {
      my $note = "<div class=\"footnote\"><span class=\"verseref\" id=\"note.$notenum\">$ch:$vs</span> - $note </div>\n";
      if ($localeFile{"Hyphen"}) {addSoftHyphens(\$note);}
      $allnotes{"$bk.$ch"} = $allnotes{"$bk.$ch"} . $note;
      $rep = "<span class=\"fnsymbol\" id=\"note.$notenum\"><\/span>";
      $notenum++;
    }
    $$xin =~ s/\Q$whole/$rep/i;
  }

  # Don't allow multiple <br> in a row... it looks bad on small pages
  # Insure all <br> have " " before to allow splitting before the break
  $$xin =~ s/(<br>\s*)+/ <br>/g;

  # Page break
  $$xin =~ s/<milestone type="x-pagebreak" \/>/<span class="pagebreak"><\/span>/ig;
}

sub convertMajorQuotes(\$\$$$\$) {
  my $t = shift;
  my $inQ = shift;
  my $s = shift;
  my $e = shift;
  my $last = shift;
  
  # prepare quote search expressions
  my $p  = quotemeta("<lb /><milestone type=\"x-p-indent\" />");
  my $pl = quotemeta($PARAGRAPH);
  $s =~ s/xPAR/$p/g;
  $e =~ s/xPAR/$p/g;

  # add markers to matching quotes
  $$t =~ s/($s)/xQS$1/g;
  $$t =~ s/($e)/$1xQE/g;
  # if part of quote's start is at end of previous line, then fix this...
  if ($$last =~ /$pl\s*$/ && $s =~ s/^\Q$p//) {
    if ($$t =~ s/^\s*($s)/xQS$1/) {$$last =~ s/$pl\s*$/ /;}
  }

  # replace quote markers with balanced divs
  if ($$inQ > 0) {$$t = "<div class=\"majorquote\">".$$t;}
  while ($$t =~ /(xQS|xQE)/) {
    my $sf = length($$t);
    my $ef = length($$t);
    if ($$t =~ /(^.*?)xQS/) {$sf = length($1);}
    if ($$t =~ /(^.*?)xQE/) {$ef = length($1);}
    if ($sf < $ef) {
      my $skip = "false";
      my $copy = $$t;
      while ($copy =~ s/^(.*)(<(note|title)[^>]*>)(.*?)<\/$3[^>]*>/$1/) {
        if ($sf >= length("$1$2") && $sf < length("$1$2$4")) {$$t =~ s/xQS//; $copy = ""; $skip = "true";} # ignore quotes which aren't part of the text!
      }
      if ($skip eq "false") {
        if ($$inQ > 0) {$$t =~ s/xQS/<\/div><div class="majorquote">/;}
        else {$$t =~ s/xQS/<div class="majorquote">/;}
        $$inQ = 1;
      } 
    }
    elsif ($ef < $sf) {
      my $skip = "false";
      my $copy = $$t;
      while ($copy =~ s/^(.*)(<(note|title)[^>]*>)(.*?)<\/$3[^>]*>/$1/) {
        if ($ef >= length("$1$2") && $ef < length("$1$2$4")) {$$t =~ s/xQE//; $copy = ""; $skip = "true";} # ignore quotes which aren't part of the text!
      }
      if ($skip eq "false") {
        if ($$inQ == 0) {$$t =~ s/xQE//;}
        else {$$t =~ s/xQE/<\/div>/;}
        $$inQ = 0;
      }     
    }
  }
  if ($$inQ > 0) {$$t = $$t."<\/div>"; $$inQ++;}
  if ($$inQ == 10) {$log = "WARNING $bk $ch:$vs: a majorquote is extending more than 10 verses at this point.\n"; &Log();}
 
  # Pull ending spans, breaks, and punctuation inside the quote divs
  my $punc = "–";
  $punc = decode("utf8", $punc);
  utf8::upgrade($punc);
  $$t =~ s/(<div class=\"majorquote\">.*?)(<\/div>)((<milestone type="x-p-indent" \/>|<span.*?<\/span>|<lb[^\/]*\/>|[\s\.,-]|$punc)*)/$1$3$2/gim;
  
  # remove other formating like line breaks and indents from within the quote divs
  my $copy = $$t;
  while ($copy =~ s/((<div class="majorquote">)(.*?)(<\/div>))//) {
    my $wh = quotemeta($1);
    my $z1 = $2;
    my $z2 = $3;
    my $z3 = $4;  
    $z2 =~ s/(<milestone type=\"x-p-indent\" \/>|<lb[^\/]*\/>)//ig;
    $$t =~ s/$wh/$z1$z2$z3/;
  }
}

sub title2HTML(\$$$) {
  my $in = shift;
  my $type = shift;
  my $pat = shift;

  my $titles="";
  while ($$in =~ /($pat)/) {
    my $osistitle = $1;
    my $tag = $2;
    my $title = $3;

    my $level=1;
    if ($tag =~ /level\s*=\s*"(\d+)"/) {$level=$1;}

    my $htmltitle="";
    if ($tag =~ /canonical\s*=\s*"true"/) {$htmltitle = "$title <br>";} # space after <br> allows breaking here!
    else {
      my $class = "title-$level";
      $htmltitle = "<div class=\"".$class."\">".$title."</div>";
    }

    if ($type eq "preverse") {
      $$in =~ s/\Q$osistitle//;
      $titles = $titles . $htmltitle;
    }
    else {$$in =~ s/\Q$osistitle/$htmltitle/;}
  }
  
  $titles =~ s/<lb[^\/]*\/>//ig; # remove forced line breaks
  &removeTags(\$titles);

  return $titles;
}

sub addSoftHyphens(\$) {
  my $in = shift;

  my $shy = decode("utf8", "­");
  utf8::upgrade($shy);
  my $shyx = "XSHYX";
  
  # add hyphens to ALL text
  my @parts = split(/(<[^>]+>)/, $$in);
  foreach $part (@parts) {
    if ($part =~ /^<[^>]+>$/) {next;}
    my $hyre = $localeFile{"Hyphen"};
    $part =~ s/($hyre)/$shyx$1/ig; # use dummy which is \w
    # insure at least 2 chars after hyphens
    while ($part =~ /$shyx(\w{0,1}(\W|$))/) {$part =~ s/$shyx(\w{0,1}(\W|$))/$1/;}
    # insure at least 3 chars before hyphens
    while ($part =~ /((^|\W)\w{0,2})$shyx/) {$part =~ s/((^|\W)\w{0,2})$shyx/$1/;}
    $part =~ s/$shyx/$shy/g;
  }
  $$in = join("", @parts);
  
  # remove hyphens from all titles!
  my $test = $$in;
  while ($test =~ s/((<div[^>]+class="(.*?)"[^>]*>)(.*?)(<\/div>))//) {
    my $tag = $1;
    my $st = $2;
    my $class = $3;
    my $inner = $4;
    my $fn = $5;
   
    if ($class =~ /(^|\s)($TITLES)(\s|$)/) {
      $inner =~ s/$shy//g;
      $$in =~ s/\Q$tag/$st$inner$fn/;
    }
  }
}

sub checkLine(\$) {
  my $in = shift;
  my $copy = ${$in};
  #// Constraints for Word-DVD HTML:
  #// A) Splitable tags must only occur on the top level, not inside any tags.
  #// B) Splitable tags may contain another single level of non-splitable tags.
  #// C) Non-splitable tags must not contain any other tags.
  #// D) All tags within a single line of the HTML file must be closed.
  #// E) <sup> tags may only be used for verse numbers

  # Check that all tags are closed (except <br>)
  $copy =~ s/<br>//ig;
  $cnt = 0;
  while ($copy =~ /(<(\w+)[^>]*>)/) {
    my $wh = $1;
    my $tg = $2;
    $cnt++;
    $copy =~ s/<$tg[^>]*>(.*?)<\/$tg\s*>/$2/;
    if ($cnt > 1000) {
      $cnt = 0;
      $log = "ERROR $bk $ch: Unmatched tag- $wh in line '".${$in}."'\n"; &Log;
      $copy =~ s/<$tg[^>]*>//;
    }
  }
  
  # Collect list of all tags
  $copy = ${$in};
  while ($copy =~ s/<\/?(\w+)[^>]*>//) {$tags{$1}++;}
#  while ($check =~ s/(<\/?(\w+)[^>]*>)//) {
#    $wh = $1;
#    $tg = $2;
#    if ($tg =~ /^(div|sup|i|br)$/i) {next;}
#    $tags{$bk."-".$ch."-".$vs.":".$wh}++;
#  }

  # Collect list of all div classes
  $copy = ${$in};
  while ($copy =~ s/<div [^>]*class="([^"]+)"[^>]*>//i) {$divClasses{$1}++;} #"

}

sub removeTags(\$) {
  my $xin = shift;
  
  # Remove l tags (ESV poetry newline tags)
  $$xin =~ s/<l [^>]*\/>/ /gi; # ESV space is needed here!
  
  # Divine name tag
  $$xin =~ s/<\/?divineName[^>]*>//ig; #ESV
  
  # Other ESV stuff
  $$xin =~ s/(<q[^>]*who="Jesus"[^>]*>|<\/q>)//ig; # ESV
  $$xin =~ s/<hi [^>]*type="small-caps"[^>]*>(.*?)<\/hi>/$2/ig; # ESV
  $$xin =~ s/<\/?catchWord[^>]*>//ig; # ESV
  $$xin =~ s/<\/?seg[^>]*>//ig; #ESV
}

sub finish($) {
  $log = $_[0];
  &Log;
  exit;
}

sub Write($$) {
  my $p = shift;
  my $check = shift;
  my $top = encode("utf8", $p);
  if ($check eq "true") {&checkLine(\$p);}
  print OUTF $top; 
}

sub Log {
  my $top = encode("utf8", $log);
  print LOGF $top;
  $log = "";
}
