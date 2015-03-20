#!/usr/bin/perl

#usage src2xpi.pl outdir nozipFlag
#	flag = 0 ? zip xpi files and content jar (creates zip file)
#	flag = 1 ? zip content jar but NOT xpi files (creates dir)
#	flag = 2 ? don't zip anything (creates dir)
#	flag = 3 ? use proxy extension for debugging

use File::Spec;
$dir = shift;
$flag = shift;

$totrunk = "../../../../.."; # relative path from this script to word-dvd trunk
$tohere = "extension/defaults/INPUTS/scripts/utilities"; # reverse path to here

# test/create dir
if (!$dir) {$dir = ".";}
$dir = File::Spec->rel2abs($dir);
if ($flag && !-e $dir) {
  
  # Firefox does not create the extensions profile dir when the profile is created
  my $parent = $dir;
  $parent =~ s/\/extensions(\/)?$//;
  
  if (-e $parent) {`mkdir \"$dir\"`;}
  
  if (!-e $dir) {print $dir."\n"; die;}
}

# cd to trunk
if (`pwd` !~ /\Q$tohere\E\s*$/) {die;} # insure we're run from util dir
if (!chdir($totrunk)) {die;}
$trunk = `pwd`; chomp($trunk);

# get word-dvd version
if (!open(INST, "<$trunk/extension/install.rdf")) {die;}
while(<INST>) {
	if ($_ =~ /<em\:version>(.*?)<\/em\:version>/) {$version=$1;}
}
close(INST);
if (!$version) {die;}
print "Version is $version\n";

$eid = "{f597ab2a-3a14-11de-a792-e68e56d89593}";
$dest = "$dir/$eid";

if ($flag) {
	if (-e "$dest.xpi") {`rm \"$dest.xpi\"`;}
	if (-e "$dest") {`rm -r -f \"$dest\"`;}
}

# use proxy extension
if ($flag == 3) {
	$exthome = `pwd`;
	chomp($exthome);
  $exthome .= "/extension";
	if (!chdir("$dir")) {die;}
	`echo $exthome> $eid`;
	exit;	
}

# copy files to tmp dir
if (-e "$trunk/tmp-src2xpi") {`rm -rf "$trunk/tmp-src2xpi"`;}
`cp -r "$trunk/extension" "$trunk/tmp-src2xpi"`;
$tmp = "$trunk/tmp-src2xpi";

# set word-dvd content, skin, and manifest in tmp copy
if (!chdir("$tmp/chrome/word-dvd")) {die;}
`rm "$tmp/chrome.manifest"`;
if (!$flag || $flag == 1) {
	# set manifest to point to jar contents
	`echo content word-dvd jar:chrome/word-dvd.jar!/content/ >> "$tmp/chrome.manifest"`;
  `echo skin word-dvd skin jar:chrome/word-dvd.jar!/skin/ >> "$tmp/chrome.manifest"`;
	`echo overlay chrome://browser/content/browser.xul chrome://word-dvd/content/word-dvd-overlay.xul >> "$tmp/chrome.manifest"`;
  
	`zip -r ../word-dvd.jar *`;
	if (!chdir("../")) {die;}
	`rm -r -f word-dvd`;
}
else {
	# set manifest to point to file NOT jar contents
	`echo content word-dvd file:chrome/word-dvd/content/ >> "$tmp/chrome.manifest"`;
  `echo skin word-dvd skin file:chrome/word-dvd/skin/ >> "$tmp/chrome.manifest"`;
	`echo overlay chrome://browser/content/browser.xul chrome://word-dvd/content/word-dvd-overlay.xul >> "$tmp/chrome.manifest"`;	
}

if (!chdir("$tmp")) {die;}
if (!$flag) {
  `zip -r \"$trunk/word-dvd-$version.xpi\" .`;
}
else {
  `mkdir \"$dest\"`;
  `cp -r * \"$dest\"`;
}

# cleanup
if (!chdir("$trunk")) {die;}
`rm -r -f \"$tmp\"`;
