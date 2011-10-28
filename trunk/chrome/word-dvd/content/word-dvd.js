/*  This file is part of word-dvd.

    Copyright 2010 Dale Potter (ortoasia@gmail.com)

    Muqaddas Kitob is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    Muqaddas Kitob is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Muqaddas Kitob.  If not, see <http://www.gnu.org/licenses/>.
*/

/************************************************************************
 * GLOBAL PROGRAM CONSTANTS
 ***********************************************************************/ 
const PAL = {W:720, H:576, PW:58, PH:72};
const NTSC = {W:720, H:480};
const INDIR=0, AUDIO=1, OUTDIR=2;
const INPUTLABELS=["Input Directory", "Audio Directory", "Output Directory"];
const NUMINPUTS=3; 
const MYGUID="{f597ab2a-3a14-11de-a792-e68e56d89593}";
const NEWCHAPTER = "<span name=\"chapter.";
// Output directory
const OUTDIRNAME="OUTPUTS";
const SCRIPT="script";
const LISTING="listing";
const OUTAUDIODIR="audio";
const IMGDIR="images";
const OSISPL="osis2html.pl";
const WORDDVD="word-dvd.sh";
const VIDEOFILES="word-video.sh";
const DBLOGFILE="logfile.txt";
const CAPTURE="import.sh";
const MENUSFILE="MENU_BUTTONS.csv";
const AUDIOICON="audio-icon.png";
const IMAGEEXT="jpg";
// Input directory
const DEFAULTS = "defaults";
const HTMLDIR="html";
const INAUDIODIR="audio";
const ARTWORK="artwork";
const STYLESHEET=DEFAULTS + "/CSS/pal.css";
const CODE=DEFAULTS + "/script";
const RESOURCE=DEFAULTS + "/resource";
const OSISFILE = "osis.xml";
const PAGETIMING="pageTiming.txt";
const LOCALEFILE="config.txt";

/************************************************************************
 * Global Utility Functions
 ***********************************************************************/ 
 
function jsdump(str)
{
  Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);
}

function logmsg(text, showBCP) {
  if (showBCP && RenderWin) text += " [" + RenderWin.Book[RenderWin.Bindex].shortName + ", Chapter=" + RenderWin.Chapter + ", Page=" + RenderWin.Page.pagenumber + "]";
  jsdump(text);
  if (DBLogFile) write2File(DBLogFile, text + "\n", true);
}

//returns data from file. Does NO checking!
function readFile(nsIFile) {
jsdump("Reading file:" + nsIFile.path);
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
	try {fstream.init(nsIFile, -1, 0, 0);}
	catch (er) {window.alert("Could not read file:" + nsIFile.path); return "";}
	var charset = "UTF-8";
  const replacementChar = Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
  var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
  is.init(fstream, charset, 1024, replacementChar);
  var filedata = "";
  var str = {};
  while (is.readString(4096, str) != 0) {filedata = filedata + str.value;}
  fstream.close();
  is.close();
  return filedata;
}

function write2File(aFile, string, append) {
  aFile = aFile.QueryInterface(Components.interfaces.nsILocalFile);
  //if (!aFile.exists() && append) append=false;
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(aFile, 0x02 | 0x08 | (append ? 0x10:0x20), 0777, 0);
  
  var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
  converter.init(foStream, "UTF-8", 0, 0);
  converter.writeString(string);
  converter.close(); // this closes foStream
}

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);  
prefs = prefs.getBranch("wordDVD.");

function getLocaleString(name, chapnum, book) {
  if (name=="Chaptext" || name=="PsalmTerm") return getChaptext(name, chapnum, book);
  return getLocaleLiteral(name);
}
  
function getChaptext(name, chapnum, book) {
  var loctext = null;
  if (name=="PsalmTerm" || (book && book=="Ps")) loctext = getChaptextVariant("PsalmTerm", chapnum);
  if (!loctext) loctext = getChaptextVariant("Chaptext", chapnum);
  return loctext;
}

function getChaptextVariant(name, chapnum) {
  chapnum = String(chapnum);
  var loctext = getLocaleLiteral(name + "-" + chapnum);
  if (!loctext) loctext = getLocaleLiteral(name + "-" + chapnum.substr(chapnum.length-1,1));
  if (!loctext) loctext = getLocaleLiteral(name);
  if (loctext) loctext = loctext.replace("%1$S", chapnum);
  return loctext;
}

function getLocaleLiteral(name) {
  var re = new RegExp("^\\s*" + name + "\\s*=[\t ]*([^\\n\\r]*)[\t ]*[\\n\\r]", "m");
  var loctext = LocaleFile.match(re);  
  return (loctext ? loctext[1]:0);
}

function escapeRE(text) {
  const ESCAPE_RE= new RegExp(/([^\\]|^)([\[\]\(\)\{\}\-\+\*\.\^\$\?\|\\])/g);
  return text.replace(ESCAPE_RE, "$1\\$2");
}


/************************************************************************
 * Main Program
 ***********************************************************************/ 
var UIfile = new Array(NUMINPUTS);
var StatsFile, TransFile, ExtFile;
var ExtVersion;
var InputTextbox = new Array(NUMINPUTS);
var RenderNext;
var RunPause;
var Paused;
var LocaleFile;
var ButtonId;
var RenderWin;
var DBLogFile;
var CssFile;
var OUTFILERE = new RegExp("(" + OUTDIRNAME + ")(\\/|$)");

function loadedXUL() {
  window.setTimeout("window.focus();", 500);

  // get extension info
  try {
    // works for Firefox 4+
    Components.utils.import("resource://gre/modules/AddonManager.jsm");
    AddonManager.getAddonByID(MYGUID, function(addon) {
      var win = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
      .getService(Components.interfaces.nsIWindowWatcher).getWindowByName("word-dvd", window);
      win.ExtVersion = addon.version;
      win.ExtFile = addon.getResourceURI("").QueryInterface(Components.interfaces.nsIFileURL).file;
      win.loadedXUL2();
    });
  }
  catch(er) {
    // works for Firefox < 4, where extension is unzipped
    ExtFile =  Components.classes["@mozilla.org/file/directory_service;1"].
			    getService(Components.interfaces.nsIProperties).
			    get("ProfD", Components.interfaces.nsIFile);
    ExtFile.append("extensions");
    ExtFile.append(MYGUID);
    if (!ExtFile.exists()) ExtFile.append(".xpi");

    var insrdf = ExtFile.clone();
    insrdf.append("install.rdf");
    ExtVersion = readFile(insrdf).match(/<em\:version>(.*?)<\/em\:version>/im)[1];
    loadedXUL2();
  }
		
  RenderNext = document.getElementById("rendernext");
  RunPause = document.getElementById("runpause");

  for (var i=0; i<NUMINPUTS; i++) {
    InputTextbox[i] = document.getElementById("input-" + i);
    InputTextbox[i].previousSibling.value = INPUTLABELS[i] + ":";
    try {
      UIfile[i] = prefs.getComplexValue("File-" + i, Components.interfaces.nsILocalFile);
      if (!UIfile[i]) {throw true;}
      InputTextbox[i].value = UIfile[i].path;
    }
    catch(er) {
      InputTextbox[i].value = "";
      document.getElementById("runpause").disabled = true;
    }
  }
  
  if (UIfile[INDIR]) {
    var htmlFiles = UIfile[INDIR].clone();
    htmlFiles.append(HTMLDIR);
    if (!htmlFiles.exists()) document.getElementById("osis2html").checked = true;
  }
  
  var noaudio = true;
  var noaudioelem = document.getElementById("noaudio");
  try {noaudio = prefs.getBoolPref("noaudio");}
  catch (er) {}
  if (noaudio) noaudioelem.checked=true;
  else noaudioelem.checked=false;
  handleInput(noaudioelem);
  
  var elem = document.getElementById("delete1st");
  if (!UIfile[OUTDIR]) {
    elem.checked = true;
    handleInput(elem)  
  }
  else {
    var logfile = UIfile[OUTDIR].clone();
    logfile.append(DBLOGFILE);
    if (!logfile.exists()) {
      elem.checked = true;
      handleInput(elem)
    }
  }
}

function loadedXUL2() {
  enableGO();
  if (ExtFile.exists()) document.getElementById("installPrompt").disabled = false;
    
  // open render window, which itself runs startRenderer()
  RenderWin = window.open("chrome://word-dvd/content/render.xul", "render-win", "chrome=yes,alwaysRaised=yes");
}

function handleInput(elem) {
  switch (elem.id) {
  case "browse-0":
  case "browse-1":
  case "browse-2":
    const kFilePickerContractID = "@mozilla.org/filepicker;1";
    const kFilePickerIID = Components.interfaces.nsIFilePicker;
    const INPUTEXT=[kFilePickerIID.filterXML, ""];
    var kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    var input = Number(elem.id.substr(elem.id.length-1,1));
    switch(input) {
    case INDIR:
    case AUDIO:
    case OUTDIR:
      kFilePicker.init(window, INPUTLABELS[input], kFilePickerIID.modeGetFolder);
      break;
    default:
      return;
    }
    if (kFilePicker.show() != kFilePickerIID.returnCancel) {
        if (!kFilePicker.file) return false;
    }
    else return;
    if (input == OUTDIR) {
      if (!kFilePicker.file.path.match(OUTFILERE)) {
	window.alert("Output directory \"" +  kFilePicker.file.path + "\" must be have \"" + OUTDIRNAME + "\" somewhere in its path.");
	return;
      }
    }  
    UIfile[input] = kFilePicker.file;
    InputTextbox[input].value = kFilePicker.file.path;
    if (input == INDIR) setInputDirsToDefault();
    break;
    
  case "noaudio":
    if (elem.checked) {
      InputTextbox[AUDIO].value = "";
      document.getElementById("input-1").disabled = true;
      document.getElementById("browse-1").disabled = true;
      document.getElementById("runvideo").disabled = true;
      var selnow = document.getElementById("runword-dvd");
      selnow.parentNode.selectedItem = selnow;
      document.getElementById("skipmenus").checked = false;
      document.getElementById("skipfootnotes").checked = false;
    }
    else {
      document.getElementById("runvideo").disabled = false;
      document.getElementById("browse-1").disabled = false;
      try {
        UIfile[AUDIO] = prefs.getComplexValue("File-1", Components.interfaces.nsILocalFile);
        InputTextbox[AUDIO].value = UIfile[AUDIO].path;
      }
      catch(er) {InputTextbox[AUDIO].value = "";}
    }
    break;
    
  case "delete1st":
    if (elem.checked) {
      document.getElementById("skiptext").checked = false;
      document.getElementById("skiptext").disabled = true;
    }
    else {
      document.getElementById("skiptext").disabled = false;  
    }
    break;
    
  case "runvideo":
      document.getElementById("skipmenus").checked = true;
      document.getElementById("skipfootnotes").checked = true;
    break;
    
  case "runword-dvd":
      document.getElementById("skipmenus").checked = false;
      document.getElementById("skipfootnotes").checked = false;
    break;
    
  case "restoreDefaults":
      if (elem.checked)
	window.alert("WARNING!: This will permanently delete any changes you have made to all files in the defaults directory.");
    break;
    
  }
  
  enableGO();
  if (UIfile[INDIR]) {
	  var osis = UIfile[INDIR].clone();
	  osis.append(OSISFILE);
	  document.getElementById("osis2html").disabled = !osis.exists();
  }
}

function setInputDirsToDefault() {
  if (!UIfile[INDIR] || !UIfile[INDIR].exists()) {
    for (var i=0; i<NUMINPUTS; i++) {
      UIfile[i] = "";
      InputTextbox[i].value = "";
    }
  }
  else {
    UIfile[AUDIO] = UIfile[INDIR].clone();
    UIfile[AUDIO].append(INAUDIODIR);
    InputTextbox[AUDIO].value = UIfile[AUDIO].path;
    UIfile[OUTDIR] = UIfile[INDIR].clone();
    UIfile[OUTDIR].append(OUTDIRNAME);
    InputTextbox[OUTDIR].value = UIfile[OUTDIR].path;
  } 
}

function enableGO() {
  for (var i=0; i<NUMINPUTS; i++) {
    if (i==AUDIO && document.getElementById("noaudio").checked) continue;
    if (!UIfile[i]) break;
  }
  document.getElementById("runpause").disabled = (i!=NUMINPUTS);
}


function wordDVD() {
  jsdump("Checking Inputs...");
  for (var i=0; i<NUMINPUTS; i++) {
    if (!UIfile[i]) {
      window.alert("STOPPING!: Not all input directories are set.");
      return;
    }
  }
  if (!UIfile[INDIR].exists()) {
    window.alert("STOPPING!: Input directory does not exist.");
    return;
  }
  if (!document.getElementById("noaudio").checked && !UIfile[AUDIO].exists()) {
    window.alert("STOPPING!: Audio directory does not exist.");
    return;
  }
  
  // Check output directory and clean if needed
  if (!UIfile[OUTDIR].path.match(OUTFILERE)) {
    window.alert("STOPPING!: Output directory \"" + UIfile[OUTDIR].leafName + "\" must be under a directory called \"" + OUTDIRNAME + "\"!");
    return;
  }
  if (!UIfile[OUTDIR].exists()) UIfile[OUTDIR].create(UIfile[OUTDIR].DIRECTORY_TYPE, 0777);
  else if (document.getElementById("delete1st").checked) {
    try {
      UIfile[OUTDIR].remove(true);
      UIfile[OUTDIR].create(UIfile[OUTDIR].DIRECTORY_TYPE, 0777);
    } catch (er) {}
  }
  
  // Log File
  DBLogFile = UIfile[OUTDIR].clone();
  DBLogFile.append(DBLOGFILE);
  var date = new Date();
  logmsg("Starting Word-DVD imager at " + date.toTimeString() + " " + date.toDateString());
  logmsg("Word-DVD Version: " + (ExtVersion ? ExtVersion:"undreadable"));
  
  if (document.getElementById("delete1st").checked) logmsg("Cleaned OUTPUT directory:" + UIfile[OUTDIR].path + "...");

  // READ LOCALE FILE
  LocaleFile = UIfile[INDIR].clone();
  LocaleFile.append(LOCALEFILE);
  LocaleFile = readFile(LocaleFile);
  
  // IMAGE DIRECTORY
  var imgdir = UIfile[OUTDIR].clone();
  imgdir.append(IMGDIR);
  if (!imgdir.exists()) imgdir.create(imgdir.DIRECTORY_TYPE, 0777);

  // LISTING DIRECTORY
  var listdir = UIfile[OUTDIR].clone();
  listdir.append(LISTING);
  if (!listdir.exists()) listdir.create(listdir.DIRECTORY_TYPE, 0777);
  
  // TIMING STATISTICS FILES
  StatsFile = UIfile[OUTDIR].clone();
  StatsFile.append(LISTING);
  
  // TRANSITION LISTING FILE
  TransFile = UIfile[OUTDIR].clone();
  TransFile.append(LISTING);
  
  // COPY RESOURCES AND BUILD-CODE TO INDIR
  exportDir(RESOURCE, UIfile[INDIR].path + "/" + RESOURCE, document.getElementById("restoreDefaults").checked);
  exportDir(CODE, UIfile[INDIR].path + "/" + CODE, document.getElementById("restoreDefaults").checked);

  // AUTOGENERATE ALL RUN SCRIPTS
  writeRunScripts();
  
  // RUN OSIS CONVERTER SCRIPT
  var data = UIfile[INDIR].clone();
  data.append(HTMLDIR);
  if (document.getElementById("osis2html").checked) {
    logmsg("Generating HTML from OSIS...");
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);                        
    var tmpscript = getTempRunScript(OSISPL); 
    process.init(tmpscript);
    var args = [];
    process.run(true, args, args.length);
  }
  else logmsg("Skipped HTML generation.");
  
  // COPY CSS to HTML DIRECTORY AND RELOAD CAPTURE WINDOW
  CssFile = exportFile(STYLESHEET, UIfile[INDIR].path + "/" + STYLESHEET, document.getElementById("restoreDefaults").checked);
  RenderWin.document.getElementById("render").contentDocument.defaultView.location.assign("chrome://word-dvd/content/web/menu.html");
  
  // Read HTML books and maxchapters
  var htmlFiles = UIfile[INDIR].clone();
  htmlFiles.append(HTMLDIR);
  if (!htmlFiles.exists() || !htmlFiles.isDirectory()) {
    window.alert("Stopping!: HTML directory not found \"" + htmlFiles.path + "\"\n");
    return;
  }
  htmlFiles = htmlFiles.directoryEntries;
  if (!htmlFiles) {
    window.alert("Stopping!: No HTML files not found in \"" + UIfile[INDIR].path + "/" + HTMLDIR + "\"\n");
    return;  
  }
  RenderWin.Book = [];
  while (htmlFiles.hasMoreElements()) {
    var file = htmlFiles.getNext().QueryInterface(Components.interfaces.nsIFile);
    var fileName = file.leafName.match(/^([^\.]+)\.(.*)$/);
    if (!fileName || fileName[2]!="html") continue;
    var data = readFile(file);
    if (!data) {
      logmsg("ERROR: Empty HTML file, or could not read \"" + file.path + "\"");
      continue;
    }
    RenderWin.Book.push(null);
    RenderWin.Book[RenderWin.Book.length-1] = new Object();
    RenderWin.Book[RenderWin.Book.length-1].shortName = fileName[1];
    var re = new RegExp("(" + NEWCHAPTER + ")", "gim");
    data = data.match(re);
    if (!data) {
      logmsg("ERROR: HTML file has no chapters \"" + file.path + "\"");
      continue;
    }
    RenderWin.Book[RenderWin.Book.length-1].maxChapter = data.length;
  }
  RenderWin.Book = RenderWin.Book.sort(booksort);

  if (document.getElementById("singlebk").selected) prompForSingleBook();
  if (document.getElementById("startbk").selected) prompForStartBook();
  
  RenderWin.focus();
  window.setTimeout("RenderWin.startMenuGeneration();", 2000);
}

// if overwrite is set, the entire outDirPath is deleted before copy
// if overwrite is not set, the function will exit with null if outDirPath exists
function exportDir(extdir, outDirPath, overwrite) {
  if (!ExtFile.exists()) {logmsg("ERROR: Can't open firefox extension"); return null;}
  var to = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  to.initWithPath(outDirPath);
  if (to.exists()) {
    if (overwrite) to.remove(true);
    else return to;
  }
  var toP = to.parent;
  if (!toP.exists()) toP.create(toP.DIRECTORY_TYPE, 0777);
  if (ExtFile.isDirectory()) {
    var from = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    from.initWithPath(ExtFile.path + "/" + extdir);
    if (!from.exists() || !from.isDirectory()) {logmsg("ERROR: From directory does not exist-" + from.path); return null;}
    from.copyTo(toP, to.leafName);
  }
  else {
    var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
    try {zReader.open(ExtFile);}
    catch (er) {logmsg(er + "\nERROR: cannot open-" + ExtFile.path); return null;}	
    try {
      var isdir = zReader.getEntry(extdir + "/");
      if (!isdir.exists || !isdir.isDirectory) {logmsg("ERROR: From zip directory does not exist-" + extdir); return null;}
    }
    catch(er) {logmsg(er + "\nERROR: reading zip entry-" + extdir); return null;}
    // create output directories	
    var entries = zReader.findEntries(null);
    while (entries.hasMore()) {
      var entry = entries.getNext();
      if (entry.indexOf(extdir) != 0) {continue;}
      try {var entryObj = zReader.getEntry(entry);}
      catch (er) {logmsg(er + "\nError getting zip directory entry " + entry + ". " + er); continue;}
      var newfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      newfile.initWithPath(toP.path + "/" + entry);
      if (entryObj.isDirectory && !newfile.exists()) newfile.create(newfile.DIRECTORY_TYPE, 0777);
    }
    // create output files	
    var entries = zReader.findEntries(null);
    while (entries.hasMore()) {
      var entry = entries.getNext();
      if (entry.indexOf(extdir) != 0) {continue;}
      try {var entryObj = zReader.getEntry(entry);}
      catch (er) {logmsg(er + "\nError getting zip file entry " + entry + ". " + er); continue;}
      var newfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      newfile.initWithPath(toP.path + "/" + entry);
      if (!entryObj.isDirectory) {
	zReader.extract(entry, newfile);
	if (!newfile.exists()) logmsg("ERROR: filed to extract-" + entry);
      }
    }
  }
  if (!to.exists()) logmsg("ERROR: failed to export to-" + to.path);
  return to;	
}

// if overwrite is set, the target file in outPath is deleted before copy
// if overwrite is not set, the function will exit with null if target exists
function exportFile(extfile, outPath, overwrite) {
  if (!ExtFile.exists()) {logmsg("ERROR: Can't open firefox extension"); return null;}
  var leaf = extfile.replace(/^.*?\/([^\/]+)$/, "$1");
  var outIsFile = outPath.match(/^(.*?)\/([^\/]+\.[^\.\/]+)$/);
  if (outIsFile) {
    outPath = outIsFile[1];
    leaf = outIsFile[2];
  }
  var to = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  to.initWithPath(outPath + "/" + leaf);
  if (to.exists()) {
    if (overwrite) to.remove(false);
    else return to;
  }
  var toP = to.parent;
  if (!toP.exists()) toP.create(toP.DIRECTORY_TYPE, 0777);
  if (ExtFile.isDirectory()) {
    var from = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    from.initWithPath(ExtFile.path + "/" + extfile);
    if (!from.exists() || from.isDirectory()) {logmsg("ERROR: From file does not exist-" + from.path); return null;}
    from.copyTo(toP, to.leafName);
  }
  else {
    var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
    try {zReader.open(ExtFile);}
    catch (er) {logmsg("ERROR: cannot open-" + ExtFile.path); return null;}	
    try {
      var isdir = zReader.getEntry(extfile);
      if (!isdir.exists || isdir.isDirectory) {logmsg("ERROR: From zip file does not exist-" + extfile); return null;}
    }
    catch(er) {logmsg("ERROR: reading zip entry-" + extfile); return null;}
    zReader.extract(extfile, to);
  }
  if (!to.exists()) logmsg("ERROR: failed to export to-" + to.path);
  return to;	
}

function booksort(a, b) {
  var ai = Number(getLocaleString(a.shortName + "i"));
  var bi = Number(getLocaleString(b.shortName + "i"));
  if (ai > bi) return 1;
  if (ai < bi) return -1;
  return 0;
}

function prompForSingleBook() {
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  var selected = {};
  var items = [];
  for (var i=0; i<RenderWin.Book.length; i++) {items.push(RenderWin.Book[i].shortName);}
  var result = prompts.select(null, "Select Book", "Create a DVD for which book?", items.length, items, selected);
  if (!result) return;
  for (var i=0; i<RenderWin.Book.length; i++) {
    if (RenderWin.Book[i].shortName == items[selected.value]) continue;
    RenderWin.Book.splice(i, 1);
    i--;
  }
}

function prompForStartBook() {
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  var selected = {};
  var items = [];
  for (var i=0; i<RenderWin.Book.length; i++) {items.push(RenderWin.Book[i].shortName);}
  var result = prompts.select(null, "Select Book", "Which book do you want to start from?", items.length, items, selected);
  if (!result) return;
  for (var i=0; i<RenderWin.Book.length; i++) {
    if (RenderWin.Book[i].shortName != items[selected.value]) continue;
    RenderWin.StartingBindex = i;
    break;
  }
}

function writeRunScripts() {
  var slist = [OSISPL, WORDDVD, VIDEOFILES,
   "audio.pl", "imgs2mpeg.pl", "navbuttons.pl", 
   "menus.pl", "mpeg2vob.pl", "lencalc.pl", 
   "timeAnalysis.pl", "createiso.pl", "audacity.pl", 
   "ecasound.pl", "burnverify.sh", "imgs2web.pl"];
  
  // MAKE OUTPUT SCRIPT DIR
  var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(UIfile[OUTDIR].path + "/" + SCRIPT);
  if (!file.exists()) file.create(file.DIRECTORY_TYPE, 0777);
  
  var scriptdir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  scriptdir.initWithPath(UIfile[INDIR].path + "/" + CODE);
  
  var rundir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  rundir.initWithPath(UIfile[OUTDIR].path + "/" + SCRIPT);

  for (var i=0; i<slist.length; i++) {writeRunScript(slist[i], scriptdir, rundir);}
}

function writeRunScript(script, scriptdir, rundir) {
  // Convert paths to relative if default input dirs are being used
  var pscript, pscriptdir, pindir, poutdir, paudiodir;
  pscriptdir = getPathOrRelativePath(scriptdir, rundir, UIfile[INDIR]);
  pindir     = getPathOrRelativePath(UIfile[INDIR], rundir, UIfile[INDIR]);
  poutdir    = getPathOrRelativePath(UIfile[OUTDIR], rundir, UIfile[INDIR]);
  paudiodir  = getPathOrRelativePath(UIfile[AUDIO], rundir, UIfile[INDIR]);
  
  const st="\"", md="\" \"", en="\"";
  var commandline = pscriptdir + md + pindir + md + poutdir + md + paudiodir + en + " $1 $2 $3";
  pscript = scriptdir.clone();
  pscript.append(script);
  pscript = getPathOrRelativePath(pscript, rundir, UIfile[INDIR]);
  var file = rundir.clone();
  file.append(runscript(script));
  if (file.exists()) file.remove(false);
  write2File(file, "#!/bin/sh\n\"" + pscript + md + commandline, false);
}

function runscript(target) {
	target = "x" + target;
	target = target.replace(/\.[^\.]*$/, ".sh");
	return target;
}

// returns the complete aFile.path unless aFile and rFile are both
// located within rootFile, in which case a relative path from
// rFile to aFile is returned (if rFile and rootFile are existing dirs).
function getPathOrRelativePath(aFile, rFile, rootFile) {
  var path = aFile.path;
  if (!rFile.exists || !rFile.isDirectory()) return path;
  if (!rootFile.exists || !rootFile.isDirectory()) return path;
  var rpath = rFile.path;
  var root = rootFile.path;
  if (path.indexOf(root) == 0 && rpath.indexOf(root) == 0) {
    path = path.replace(root, "");
    rpath = rpath.replace(root, "");
    if (!rpath) rpath = "./";
    else {
      rpath = rpath.replace(/[^\/]+/g, "..").substring(1);
    }
    path = rpath + path;
  }
  
  return path;
}

function getTempRunScript(script) {      
  var scriptdir = UIfile[INDIR].clone();
  scriptdir.append(SCRIPT);
  var temp = Components.classes["@mozilla.org/file/directory_service;1"].
			    getService(Components.interfaces.nsIProperties).
			    get("TmpD", Components.interfaces.nsIFile);		      
  writeRunScript(script, scriptdir, temp);
  temp.append(runscript(script));
  if (!temp.exists()) logmsg("ERROR: Could not create temporary run script.");
  return temp;
}

function pause() {
  RenderNext.disabled = false;
  RunPause.label = "Continue";
  RunPause.removeAttribute("oncommand");
  RunPause.setAttribute("oncommand", "resume();");
  Paused = true;
}

function resume() {
  RenderNext.disabled = true;
  RunPause.label = "Pause";
  RunPause.removeAttribute("oncommand");
  RunPause.setAttribute("oncommand", "pause();");
  Paused = false;
  if (!RenderWin) return;
  RenderWin.setTimeout(RenderWin.ContinueFunc, 0);
}

function rendernext() {
  Paused = true;
  RenderWin.renderNewScreen();
}

function stop() {
  var date = new Date();
  var unUtilizedAudio = "";
  if (RenderWin) {
    for each (var files in RenderWin.CheckAudioChapters) {
      if (files.match(/^\s*$/)) {continue;}
      unUtilizedAudio += files + "\n";
    }
    for (var vt in RenderWin.VerseTiming) {
      for (var i=0; i<RenderWin.VerseTiming[vt].length; i++) {
        if (RenderWin.VerseTiming[vt][i]) logmsg("WARNING: Did not calculate " + PAGETIMING + " data: " + RenderWin.VerseTiming[vt][i].entry);
      }
    }
  }
  if (unUtilizedAudio) logmsg("Unutilized audio file(s):\n" + unUtilizedAudio);
  if (RenderWin) RenderWin.close();
  var hasErrors = false;
  if (DBLogFile) {
    var logf = readFile(DBLogFile);
    if (logf) hasErrors = (logf.search(/ERR/i)!=-1);
  }
  logmsg("Finishing Word-DVD imager at " + date.toTimeString() + " " + date.toDateString());
  
  if (document.getElementById("runword-dvd").selected) {
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess); 
		      
    var tmpscript = getTempRunScript(WORDDVD); 
    process.init(tmpscript);
    var args = [];
    process.run(false, args, args.length);
    logmsg("Launched " + runscript(WORDDVD));
  }
  else if (document.getElementById("runvideo").selected) {
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);
    var tmpscript = getTempRunScript(VIDEOFILES); 
    process.init(tmpscript);
    var args = [];
    process.run(false, args, args.length);
    logmsg("Launched" + runscript(VIDEOFILES));  
  }
  
  if (hasErrors) window.alert("Image rendering has completed, but WITH ERRORS!");
  else window.alert("Image rendering has completed without errors.");
  CloseThis();
  //RenderNext.disabled = true;
  //RunPause.disabled = true;
}

function CloseThis() {
  window.setTimeout("window.close();", 0);
}

function unloadXUL() {
  var tmp = UIfile[OUTDIR].clone();
  tmp.append(LISTING);
  tmp.append("tmp");
  if (tmp.exists()) tmp.remove(true);
  
  for (var i=0; i<NUMINPUTS; i++) {
    if (!UIfile[i]) continue;
    prefs.setComplexValue("File-" + i, Components.interfaces.nsILocalFile, UIfile[i]);
  }
  
  prefs.setBoolPref("noaudio", document.getElementById("noaudio").checked);
  if (RenderWin) RenderWin.close();
}
