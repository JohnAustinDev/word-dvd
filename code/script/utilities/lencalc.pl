#!/usr/bin/perl

#usage lencalc.pl scriptDir inputDir outputDir audioDir

$scriptdir = @ARGV[0];
require "$scriptdir/shared.pl" || die "Can't require shared.pl";
&readDataFiles();

$VIDEOKBPS = 73; #kbps
$STILLKBPS = 720; #kb/slide
$MENUKBPS = 720; #kb/slide

#$VIDEOKBPS = 289; #kbps
#$STILLKBPS = 1500; #kbps
#$MENUKBPS = 870; #kbps

################################################################################

$bytes = 0;
$audiopages = 0;
$quietpages = 0;
$footnotepages = 0;
$menupages = 0;
foreach $book (sort {$books{$a}<=>$books{$b}} keys %books) {
  
  for ($ch=0; $ch<=$lastChapter{$book}; $ch++) {
    if (!$chapters{"$book-$ch"}) {next;}
    
    @chaps = split(/,/, $Chapterlist{$book."-".$ch});
    $last = 0;
    for ($pg=1; $pg<=$lastPage{$book."-".$ch}; $pg++) {
      if (!$pages{"$book-$ch-$pg"}) {next;}
      
      if ($haveAudio{$book."-".$ch} ne "still") {
        if ($pg == $lastPage{$book."-".$ch}) {$pglen = ($Chapterlength{$book."-".$ch}-$last);}
        else {
          $timef = $chaps[$pg];
          $ts = &unformatTime($timef);
          $pglen = ($ts-$last);
          $last = $ts;
        }
        $bytes = ($bytes + ($pglen*$VIDEOKBPS*1000/8));
        $audiopages++;
      }
      else {
        $bytes = ($bytes + ($STILLKBPS*1000/8));
        $quietpages++;

      }
      
      $pgn=1;
      while (-e "$imagedir/$book/fn-$book-$ch-$pg-$pgn.jpg") {
        $bytes = ($bytes + ($STILLKBPS*1000/8));
        $footnotepages++;
        $pgn++;
      }
        
    }
  }
}

foreach $menu (sort {&menuSort($a, $b);} keys %AllMenus) {
  $bytes = ($bytes + ($STILLKBPS*1000/8));
  $menupages++;
}

$megabytes = ($bytes/(1024*1024));
$gigabytes = ($megabytes/1000);

print "Total menu pages:$menupages\n";
print "Total audio pages:$audiopages\n";
print "Total quiet pages:$quietpages\n";
print "Total footnote pages:$footnotepages\n";
print "Total content size:$gigabytes gB ($megabytes MB)\n";
