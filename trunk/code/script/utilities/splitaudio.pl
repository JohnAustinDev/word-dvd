#!/usr/bin/perl

#usage splitaudio.pl audiolog.txt inDirFullPath outDirFullPath

# Reads the audio log portion of the word-dvd log file. It then uses this
# information to copy original mp3 audio (which must mirror the ac3 audio names)
# to an output directory. But any mp3 multi-chapter files are split into
# separate chapters during the copy. Thus resulting files are ready for 
# import to MK.

$logfile = shift;
$indir = shift;
$outdir = shift;
$filter = shift;

open(INF, "<$logfile") || die "Could not open $logfile.";
while (<INF>) {
# Creating mpg for Matt-1 (tk-Matt-01-28.ac3) start=0s, finish=201.25s, length=201.25s
  if ($_ =~ /Creating mpg for ([^-]+)-(\d+) \((.*?)\.ac3\) start=([\d\.]+)s, finish=([\d\.]+)s, length=([\d\.]+)s/) {
    $book = $1;
    $ch = $2;
    $file = $3;
    $start = $4;
    $finish = $5;
    $length = $6;
    $files{$book."-".$ch} = $file;
    $starts{$book."-".$ch} = $start;
    $lengths{$book."-".$ch} = $length;
  }
}
close(INF);

opendir(IND, "$indir");
@files = readdir(IND);
closedir(IND);

chdir($indir);
foreach $file (@files) {
  if ($file =~ /^([^-]+)-([^-]+)-(\d+)-(\d+)\.mp3/) {
    $lang = $1;
    $book = $2;
    $chs = 1*$3;
    $che = 1*$4;
    for ($ch = $chs; $ch<=$che; $ch++) {
      if (exists($files{$book."-".$ch})) {
        $file = $files{$book."-".$ch};
        $start = $starts{$book."-".$ch};
        $length = $lengths{$book."-".$ch};
        if (-e "$indir/$file.mp3") {
          if ($ch<10) {$chpad = "0".$ch;}
          else {$chpad = $ch;}
          $inp = "$indir/$file.mp3";
          $inp =~ s/ /\\ /g;
          $otp = "$outdir/$lang-$book-$chpad.mp3";
          $otp =~ s/ /\\ /g;
          `sox $inp $otp trim $start $length`;
          #print "sox $inp $otp trim $start $length\n";
          $files{$book."-".$ch} = "";
          print "Created $outdir/$lang-$book-$chpad.mp3\n";
        }
        else {print "ERROR: Expected, but did not find $indir/$file.mp3.\n";}
      }
      else {print "ERROR: No log information for $book-$ch!\n";}
    }
  }
}

foreach $file (sort keys %files) {
  if ($files{$file} ne "") {
    $filename = $files{$file};
    if (-e "$indir/$filename.mp3") {
      $inp = "$indir/$filename.mp3";
      $inp =~ s/ /\\ /g;
      $otp = "$outdir";
      $otp =~ s/ /\\ /g;
      `cp $inp $otp`;
      #print "cp $inp $otp\n";
      print "Created $outdir/$filename.mp3\n";
    }
    else {print "ERROR: file $filename.mp3 was not created.\n";}
  }
}