#!/usr/bin/perl
# usage: getStartEndTimes.pl inFile outFile

$inf = shift;
$outf = shift;
open(INF, "<$inf") || die "Could not open input file $inf\n";
open(OUTF, ">>$outf") || die "Could not open output file $outf\n";
while(<INF>) {if ($_ =~ /^\s*[\w\d]+-\d+-[se]\s*=/) {print OUTF $_;}}
close(INF);
close(OUTF);
