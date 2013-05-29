#!/usr/bin/perl

#usage src2xpi.pl outdir nozipFlag
#	nozipFlag = 0 ? zip xpi files and content jar (creates zip file)
#	nozipFlag = 1 ? zip content jar but NOT xpi files (creates dir)
#	nozipFlag = 2 ? don't zip anything (creates dir)
#	nozipFlag = 3 ? use proxy extension for debugging

use File::Spec;
$dir = shift;
$nozipflag = shift;

$totrunk = "../../.."; # relative path from this script to word-dvd trunk
$tohere = "word-dvd/script/utilities"; # reverse path to here
$tocontent = "chrome/word-dvd"; # content of word-dvd.jar

if (!$dir) {$dir = ".";}
$dir = File::Spec->rel2abs($dir);
if (!-e $dir) {
  
  # Firefox does not create the extensions profile dir when the profile is created
  my $parent = $dir;
  $parent =~ s/\/extensions(\/)?$//;
  
  if (-e $parent) {`mkdir $dir`;}
  
  if (!-e $dir) {print $dir."\n"; die;}
}

if (`pwd` !~ /\Q$tohere\E\s*$/) {die;} # insure we're run from util dir
if (!chdir($totrunk)) {die;}
$trunk = `pwd`; chomp($trunk);

# get word-dvd version
if (!open(INST, "<install.rdf")) {die;}
while(<INST>) {
	if ($_ =~ /<em\:version>(.*?)<\/em\:version>/) {$version=$1;}
}
close(INST);
if (!$version) {die;}
print "Version is $version\n";

$eid = "{f597ab2a-3a14-11de-a792-e68e56d89593}";
$isext = ($dir =~ /\/extensions\\?$/);
$dest = $isext ? "$dir/$eid":"$dir/word-dvd-$version";

if ($isext && $nozipflag == 3) {
	if (-e "$dest.xpi") {`rm $dest.xpi`;}
	if (-e "$dest") {`rm -r -f $dest`;}
	$code = `pwd`;
	chomp($code);
	if (!chdir("$dir")) {die;}
	`echo $code> $eid`;
	exit;	
}

# copy files to tmp dir
$tmp = "tmp-src2xpi";
`svn export . $tmp`;

# create chrome contents jar if requested
if (!chdir("$trunk/$tmp/$tocontent")) {die;}
if (!$nozipflag || $nozipflag == 1) {
	# set manifest to point to jar contents
	`echo content word-dvd jar:chrome/word-dvd.jar!/content/ > "$trunk/$tmp/chrome.manifest"`;
	`echo overlay chrome://browser/content/browser.xul chrome://word-dvd/content/word-dvd-overlay.xul >> "$trunk/$tmp/chrome.manifest"`;
	
	`zip -r ../word-dvd.jar content`;
	if (!chdir("../")) {die;}
	`rm -r -f word-dvd`;
}
else {
	# set manifest to point to file NOT jar contents
	`echo content word-dvd file:chrome/word-dvd/content/ > "$trunk/$tmp/chrome.manifest"`;
	`echo overlay chrome://browser/content/browser.xul chrome://word-dvd/content/word-dvd-overlay.xul >> "$trunk/$tmp/chrome.manifest"`;	
}

# create xpi file/dir
if (!chdir("$trunk/$tmp")) {die;}
if (-e "$dest.xpi") {`rm $dest.xpi`;}
if (($nozipflag || $isext) && -e "$dest") {`rm -r -f $dest`;}
if ($nozipflag) {
	`mkdir $dest`;
	`cp -r * $dest`;
}
else {`zip -r $dest.xpi .`;}

# cleanup
if (!chdir("$trunk")) {die;}
`rm -r -f $tmp`;
