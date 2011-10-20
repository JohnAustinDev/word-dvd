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
const CODE="word-dvd/script";
const RESOURCE="word-dvd/resource";
const OSISPL="osis2html.pl";
const WORDDVD="word-dvd.sh";
const VIDEOFILES="word-video.sh";
const DBLOGFILE="logfile.txt";
const CAPTURE="import.sh";
const SCRIPT="script";
const LISTING="listing";
const OUTAUDIODIR="audio";
const IMGDIR="images";
const MENUSFILE="MENU_BUTTONS.csv";
const AUDIOICON="audio-icon.png";
const IMAGEEXT="jpg";
// Input directory
const OSISFILE = "osis.xml";
const HTMLDIR="html";
const PAGETIMING="pageTiming.txt";
const LOCALEFILE="config.txt";
const STYLESHEET="pal.css";

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
		logmsg("Falling back to firefox < 4 extension manager");	
		ExtFile =  Components.classes["@mozilla.org/file/directory_service;1"].
					getService(Components.interfaces.nsIProperties).
					get("ProfD", Components.interfaces.nsIFile);
		ExtFile.append("extensions");
		ExtFile.append(MYGUID);

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
      if (!UIfile[i].exists()) {throw true;}
      InputTextbox[i].value = UIfile[i].path;
    }
    catch(er) {
      InputTextbox[i].value = "";
      document.getElementById("runpause").disabled = true;
    }
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
    //case FILE:
    //  kFilePicker.init(window, INPUTLABELS[input], kFilePickerIID.modeOpen);
    //  kFilePicker.appendFilters(INPUTEXT[input]);
    //  break;
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
    UIfile[input] = kFilePicker.file;
    InputTextbox[input].value = kFilePicker.file.path;
    break;
    
  case "noaudio":
    if (elem.checked) {
      InputTextbox[AUDIO].value = "";
      document.getElementById("input-1").disabled=true;
      document.getElementById("browse-1").disabled=true;
    }
    else {
      document.getElementById("input-1").disabled=false;
      document.getElementById("browse-1").disabled=false;
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
  }
  
  enableGO();
  if (UIfile[INDIR]) {
	  var osis = UIfile[INDIR].clone();
	  osis.append(OSISFILE);
	  document.getElementById("osis2html").disabled = !osis.exists();
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
      Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      return;
    }
  }
  
  // Check output directory and clean if needed
  if (!UIfile[OUTDIR].path.match(/(OUTPUTS)(\/|$)/)) {
    window.alert("STOPPING!: Output directory \"" + UIfile[OUTDIR].leafName + "\" must be under a directory called \"OUTPUTS\"!");
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
  
  // COPY RESOURCES AND BUILD-CODE TO OUTPUT DIR
  exportDir("resource", UIfile[OUTDIR].path + "/" + RESOURCE, true);
  exportDir("script", UIfile[OUTDIR].path + "/" + CODE, true);

  // AUTOGENERATE ALL RUN SCRIPTS
  writeRunScripts();
  
  // RUN OSIS CONVERTER SCRIPT
  var data = UIfile[INDIR].clone();
  data.append(HTMLDIR);
  if (document.getElementById("osis2html").checked) {
    logmsg("Generating HTML from OSIS...");
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);                        
    var file = UIfile[OUTDIR].clone();
    file.append(SCRIPT);
    file.append(runscript(OSISPL));
    process.init(file);
    var args = [];
    process.run(true, args, args.length);
  }
  else logmsg("Skipped HTML generation.");
  
  // COPY CSS to HTML DIRECTORY AND RELOAD CAPTURE WINDOW
  CssFile = exportFile("resource/" + STYLESHEET, UIfile[INDIR].path + "/" + HTMLDIR, false);
  RenderWin.document.getElementById("render").contentDocument.defaultView.location.assign("chrome://word-dvd/content/web/menu.html");
  
  // Read HTML books and maxchapters
  var htmlFiles = UIfile[INDIR].clone();
  htmlFiles.append(HTMLDIR);
  if (!htmlFiles.exists() || !htmlFiles.isDirectory()) {
    logmsg("Error: HTML directory not found \"" + htmlFiles.path() + "\"\n");
    return;
  }
  htmlFiles = htmlFiles.directoryEntries;
  if (!htmlFiles) {
    logmsg("Error: No HTML files not found in \"" + UIfile[INDIR].path() + "/" + HTMLDIR + "\"\n");
    return;  
  }
  RenderWin.Book = [];
  while (htmlFiles.hasMoreElements()) {
    var file = htmlFiles.getNext().QueryInterface(Components.interfaces.nsIFile);
    var fileName = file.leafName.match(/^([^\.]+)\.(.*)$/);
    if (!fileName || fileName[2]!="html") continue;
    var data = readFile(file);
    if (!data) {
      logmsg("ERROR: Empty HTML file, or could not read \"" + file.path() + "\"");
      continue;
    }
    RenderWin.Book.push(null);
    RenderWin.Book[RenderWin.Book.length-1] = new Object();
    RenderWin.Book[RenderWin.Book.length-1].shortName = fileName[1];
    var re = new RegExp("(" + NEWCHAPTER + ")", "gim");
    data = data.match(re);
    if (!data) {
      logmsg("ERROR: HTML file has no chapters \"" + file.path() + "\"");
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

// if overwrite is set, the target file in outDirPath is deleted before copy
// if overwrite is not set, the function will exit with null if target exists
function exportFile(extfile, outDirPath, overwrite) {
	if (!ExtFile.exists()) {logmsg("ERROR: Can't open firefox extension"); return null;}
	var leaf = extfile.replace(/^.*?\/([^\/]+)$/, "$1");
	var to = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	to.initWithPath(outDirPath + "/" + leaf);
	if (to.exists()) {
		if (overwrite) to.remove();
		else return to;
	}
	var toP = to.parent;
	if (!toP.exists()) toP.create(toP.DIRECTORY_TYPE, 0777);
	if (ExtFile.isDirectory()) {
		var from = ExtFile.clone();
		from.append(extfile);
		if (from.isDirectory()) {logmsg("ERROR: From file does not exist-" + from.path); return null;}
		from.copyTo(toP, to.leafName);
	}
	else {
		var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
		try {zReader.open(ExtFile);}
		catch (er) {logmsg("ERROR: cannot open-" + ExtFile.path); return null;}	
		try {
			var isdir = zReader.getEntry(extfile);
			if (isdir.isDirectory) {logmsg("ERROR: From zip file does not exist-" + extfile); return null;}
		}
		catch(er) {logmsg("ERROR: reading zip entry-" + extfile); return null;}
		zReader.extract(extfile, to);
	}
	if (!to.exists()) logmsg("ERROR: failed to export to-" + to.path);
	return to;	
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
		var from = ExtFile.clone();
		from.append(extdir);
		if (!from.isDirectory()) {logmsg("ERROR: From directory does not exist-" + from.path); return null;}
		from.copyTo(toP, to.leafName);
	}
	else {
		var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
		try {zReader.open(ExtFile);}
		catch (er) {logmsg(er + "\nERROR: cannot open-" + ExtFile.path); return null;}	
		try {
			var isdir = zReader.getEntry(extdir + "/");
			if (!isdir.isDirectory) {logmsg("ERROR: From zip directory does not exist-" + extdir); return null;}
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
  scriptdir.initWithPath(UIfile[OUTDIR].path + "/" + CODE);

  const st="\"", md="\" \"", en="\"";
  var commandline = scriptdir.path + md + UIfile[INDIR].path + md + UIfile[OUTDIR].path + md + UIfile[AUDIO].path + en + " $1 $2 $3";
  for (var i=0; i<slist.length; i++) {
    var script = scriptdir.clone();
    script.append(slist[i]);
    if (script.exists()) {
      file = UIfile[OUTDIR].clone();
      file.append(SCRIPT);
      file.append(runscript(slist[i]));
      write2File(file, "#!/bin/sh\n\"" + script.path + md + commandline, false);
    }
  }
}

function runscript(target) {
	target = "x" + target;
	target = target.replace(/\.[^\.]*$/, ".sh");
	return target;
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
    var file = UIfile[OUTDIR].clone();
    file.append(SCRIPT);
    var rundir = file.path;
    file.append(runscript(WORDDVD));
    process.init(file);
    var args = [rundir];
    process.run(false, args, args.length);
    logmsg("Launched " + runscript(WORDDVD));
  }
  else if (document.getElementById("runvideo").selected) {
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);                        
    var file = UIfile[OUTDIR].clone();
    file.append(SCRIPT);
    var rundir = file.path;
    file.append(runscript(VIDEOFILES));
    process.init(file);
    var args = [rundir];
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
  for (var i=0; i<NUMINPUTS; i++) {
    if (!UIfile[i]) continue;
    prefs.setComplexValue("File-" + i, Components.interfaces.nsILocalFile, UIfile[i]);
  }
  
  prefs.setBoolPref("noaudio", document.getElementById("noaudio").checked);
  if (RenderWin) RenderWin.close();
}
