#!/usr/bin/perl

#usage src2xpi.pl outdir nozipFlag
#	nozipFlag = 0 ? zip xpi files and content jar (creates zip file)
#	nozipFlag = 1 ? zip content jar but NOT xpi files (creates dir)
#	nozipFlag = 2 ? don't zip anything (creates dir)
#	nozipFlag = 3 ? use proxy extension for debugging

use File::Spec;
$dir = shift;
$nozip = shift;

if (`pwd` !~ /\/script\/utilities\s*$/) {die;} # insure we're run from util dir
if (!$dir) {$dir = ".";}
$dir = File::Spec->rel2abs($dir);
if (!-e $dir) {die;}

$eid = "{f597ab2a-3a14-11de-a792-e68e56d89593}";
$isext = ($dir =~ /\/extensions\\?$/);
$dest = $isext ? "$dir/$eid":"$dir/word-dvd-$version";

if ($isext && $nozip == 3) {
	if (-e "$dest.xpi") {`rm $dest.xpi`;}
	if (-e "$dest") {`rm -r -f $dest`;}
	if (!chdir("../../")) {die;}
	$code = `pwd`;
	chomp($code);
	if (!chdir("$dir")) {die;}
	`echo $code> $eid`;
	exit;	
}

# get word-dvd version
if (!open(INST, "<../../install.rdf")) {die;}
while(<INST>) {
	if ($_ =~ /<em\:version>(.*?)<\/em\:version>/) {$version=$1;}
}
close(INST);
if (!$version) {die;}

# copy files to tmp dir
$tmp = "tmp-src2xpi";
`svn export ../../. $tmp`;

# create chrome contents jar if requested
if (!chdir("$tmp/chrome/word-dvd")) {die;}
if (!$nozip || $nozip < 2) {
	# set manifest to point to jar contents
	`echo content word-dvd jar:chrome/word-dvd.jar!/content/ > ../../chrome.manifest`;
	`echo overlay chrome://browser/content/browser.xul chrome://word-dvd/content/word-dvd-overlay.xul >> ../../chrome.manifest`;
	
	`zip -r ../word-dvd.jar content`;
	if (!chdir("../")) {die;}
	`rm -r -f word-dvd`;
}
else {
	# set manifest to point to file NOT jar contents
	`echo content word-dvd file:chrome/word-dvd/content/ > ../../chrome.manifest`;
	`echo overlay chrome://browser/content/browser.xul chrome://word-dvd/content/word-dvd-overlay.xul >> ../../chrome.manifest`;	
	if (!chdir("../")) {die;}
}

# create xpi file/dir
if (!chdir("../")) {die;}
if ($nozip) {
	if (-e "$dest") {`rm -f -r $dest`;}
	if ($isext && -e "$dest.xpi") {`rm $dest.xpi`;}
	`mkdir $dest`;
	`cp -r * $dest`;
}
else {
	if ($isext && -e "$dest") {`rm -r -f $dest`;}
	`zip -r $dest.xpi .`;
}

# cleanup
if (!chdir("../")) {die;}
`rm -r -f $tmp`;
