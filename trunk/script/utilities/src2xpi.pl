#!/usr/bin/perl

#usage src2xpi.pl outdir

$dir = shift;
if (!-e $dir) {die;}

# get word-dvd version
if (!open(INST, "<../../install.rdf")) {die;}
while(<INST>) {if ($_ =~ /<em\:version>(.*?)<\/em\:version>/) {$version=$1;}}
close(INST);

# copy files to tmp dir
$tmp = "~/TMP_src2xpi";
`mkdir $tmp`;

