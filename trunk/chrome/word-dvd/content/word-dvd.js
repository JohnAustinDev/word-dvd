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
const NUMINPUTS=3; 
const MYGUID="{f597ab2a-3a14-11de-a792-e68e56d89593}";
const NEWCHAPTER = "<span name=\"chapter.";
const NEWVERSERE = "<sup>[\\d\\s-]+<\/sup>";
const VERSENUMBER = ">\\s*(\\d+)(\\s*-\\s*(\\d+))?\\s*<";
const WAIT=500;
// Output directory
const OUTDIRNAME="OUTPUTS";
const SCRIPT="script";
const LISTING="listing";
const OUTAUDIODIR="audio";
const IMGDIR="images";
const BACKUP="backup";
const OSISPL="osis2html.pl";
const FIXEDTRANSITIONS="fixedTransitions.pl";
const WORDDVD="word-dvd.sh";
const VIDEOFILES="word-video.sh";
const DBLOGFILE="logfile.txt";
const MENUSFILE="MENU_BUTTONS.csv";
const IMAGEEXT="jpg";
const CONVERSIONDONE="conversion-finished";
const OSISPROGRESS="osis2html-progress";
// Input directory
const DEFAULTS = "defaults";
const HTMLDIR="html";
const MENUSDIR="menus";
const INAUDIODIR="audio";
const ARTWORK="artwork";
const STYLESHEET=DEFAULTS + "/CSS/pal.css";
const CODE=DEFAULTS + "/script";
const RESOURCE=DEFAULTS + "/resource";
const OSISFILE = "osis.xml";
const PAGETIMING="pageTiming.txt";
const LOCALEFILE="config.txt";
const CAPTURE="import.sh";

/************************************************************************
 * Exception Handling
 ***********************************************************************/ 
var aConsoleListener =
{
  haveException:false,
  observe:function( aMessage ) {
    if (this.haveException) return;
    try {aMessage = aMessage.QueryInterface(Components.interfaces.nsIScriptError);}
    catch(er) {aMessage=null;}
    if (aMessage) {
      var isException = aMessage.flags & aMessage.exceptionFlag;
      if (isException && aMessage.message.match("/word-dvd/content/")) {
        this.haveException = true;
        window.alert("Unhandled " + aMessage.category + " Exception:\n" + aMessage.message);
      }
    }
  },
  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
            !iid.equals(Components.interfaces.nsISupports)) {
                  throw Components.results.NS_ERROR_NO_INTERFACE;
          }
    return this;
  }
};

function setConsoleService(addListener) {
  if (addListener) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);
        consoleService.registerListener(aConsoleListener);
  }
  else {
    try {
      var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
          .getService(Components.interfaces.nsIConsoleService);
          consoleService.unregisterListener(aConsoleListener);
    }
    catch(er) {}
  }
}

setConsoleService(aConsoleListener);

var StartDate = new Date();
var BackupPrefix = StartDate.getTime();

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

function getLocaleString(name, params) {
  var v0 = (params && params[0] ? params[0]:null); // book
  var v1 = (params && params[1] ? params[1]:null); // chapter
  var v2 = (params && params[2] ? params[2]:null); // verse
  var v3 = (params && params[3] ? params[3]:null); // verse2
  
  // handle chapter menu strings
  if (name=="Chaptext" || name=="PsalmTerm") return getChaptext(name, v1, v0);
  else if (name=="SubChaptext") return getChaptextVariant("SubChaptext", v1, v2, v3);
  
  // handle other strings
  return getLocaleLiteral(name);
}
  
function getChaptext(name, chapnum, book) {
  var loctext = null;
  if (name=="PsalmTerm" || (book && book=="Ps")) loctext = getChaptextVariant("PsalmTerm", chapnum);
  if (!loctext) loctext = getChaptextVariant("Chaptext", chapnum);
  return loctext;
}

function getChaptextVariant(name, chapnum, verse, verse2) {
  if (!verse) verse = 1;
  chapnum = String(chapnum);
  var loctext = getLocaleLiteral(name + "-" + chapnum);
  if (!loctext) loctext = getLocaleLiteral(name + "-" + chapnum.substr(chapnum.length-1,1));
  if (!loctext) loctext = getLocaleLiteral(name);
  if (loctext) loctext = loctext.replace("%1$S", chapnum);
  if (loctext) loctext = loctext.replace("%2$S", verse);
  if (loctext) loctext = loctext.replace("%3$S", verse2);
  return loctext;
}

function getLocaleLiteral(name) {
  var re = new RegExp("^\\s*" + name + "\\s*=[\t ]*([^\\n\\r]*)[\t ]*[\\n\\r]", "m");
  var loctext = LocaleFile.match(re);
  if (loctext) {
    loctext = loctext[1];
    loctext = loctext.replace(/\s*\#.*$/, "");  
  }
  return (loctext ? loctext:0);
}

function getLocaleLiterals() {
  var re = new RegExp("^\\s*(.*?)\\s*=[\t ]*([^\\n\\r]*)[\t ]*[\\n\\r]", "gm");
  var loctext = LocaleFile.match(re);
  for (var i=0; i<loctext.length; i++) {
    loctext[i] = loctext[i].replace(/[\n\r]/g, "");
    loctext[i] = loctext[i].replace(/\s*\#.*$/, "");
    if (loctext[i].match(/^\s*$/)) {
      var el = loctext.splice(i, 1);
      if (el) i--;
    }
  }
  return loctext;
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
var Paused, Aborted, Running;
var LocaleFile;
var RenderWin;
var DBLogFile;
var CssFile;
var BackupDir;
var OUTFILERE = new RegExp("(" + OUTDIRNAME + ")(\\/|$)");
var Book;
var StartingBindex;

function loadedXUL() {
  window.setTimeout("window.focus();", 0);

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
}function loadedXUL2() {

  document.title = "Word-DVD-" + ExtVersion;
  for (var i=0; i<NUMINPUTS; i++) {
    InputTextbox[i] = document.getElementById("input-" + i);
    try {
      UIfile[i] = prefs.getComplexValue("File-" + i, Components.interfaces.nsILocalFile);
      if (!UIfile[i]) {throw true;}
      InputTextbox[i].value = UIfile[i].path;
    }
    catch(er) {InputTextbox[i].value = "";}
  }
  if (!InputTextbox[INDIR].value) {
    document.getElementById("browse-1").disabled = true;
    document.getElementById("browse-2").disabled = true;
  }
  checkAudioDir();	
  updateControlPanel();
  sizeToContent();
}

function handle(e) {
  updateAction(e.target);
  updateControlPanel();
}

var RenderWinTO;
function updateAction(elem) {
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
      kFilePicker.init(window, elem.previousSibling.previousSibling.value, kFilePickerIID.modeGetFolder);
      break;
    default:
    return;
    }
    if (kFilePicker.show() != kFilePickerIID.returnCancel) {
      if (!kFilePicker.file) return false;
    }
    else return;
    document.getElementById("browse-1").disabled = false;
    document.getElementById("browse-2").disabled = false;
    if (input == OUTDIR) {
      if (!kFilePicker.file.path.match(OUTFILERE)) {
        window.alert("Output directory must be have \"" + OUTDIRNAME + "\" somewhere in its path.");
        return;
      }
    }  
    UIfile[input] = kFilePicker.file;
    InputTextbox[input].value = kFilePicker.file.path;
    if (input == INDIR) setInputDirsToDefault();
    checkAudioDir();
    break;

  case "runword-dvd":
  case "renderonly":
  case "runvideo":
    document.getElementById("skipmenus").checked = false;
    document.getElementById("skipfootnotes").checked = false;
    document.getElementById("skiptext").checked = false;
    break;

  case "restoreDefaults":
    if (elem.checked)
      window.alert("WARNING!: This will permanently delete any changes you have made to any files in the defaults directory.");
    break;
    
  case "installPrompt":
      window.alert("Your installation directory is:\n" + ExtFile.path);
   break;
   
  case "readme":
    viewReadMe();
    break; 

  case "noaudio":
    if (!elem.checked && checkAudioDir(true)) 
      updateAction(document.getElementById("browse-1"));
    break;
    
  case "go":
    elem.setAttribute("hidden", "true");
    document.getElementById("pause").removeAttribute("hidden");
    document.getElementById("rendernext").disabled = true;
    Paused = false;
    Aborted = false;
    Running = true;
    wordDVD();
    break;
    
  case "pause":
    elem.setAttribute("hidden", "true");
    document.getElementById("resume").removeAttribute("hidden");
    document.getElementById("rendernext").disabled = false;
    Paused = true;
    // clear ContinueFunc immediately, it will be set properly when Paused is detected 
    if (RenderWin) RenderWin.ContinueFunc = null;
    break;
    
  case "resume":
    elem.setAttribute("hidden", "true");
    document.getElementById("pause").removeAttribute("hidden");
    document.getElementById("rendernext").disabled = true;
    Paused = false;
    if (RenderWin && RenderWin.ContinueFunc) {
      if (RenderWinTO) window.clearTimeout(RenderWinTO);
      RenderWinTO = RenderWin.setTimeout(RenderWin.ContinueFunc, 0);
    }
    break;
    
  case "rendernext":
    document.getElementById("resume").removeAttribute("hidden");
    document.getElementById("pause").setAttribute("hidden", "true");
    Paused = true;
    if (RenderWin && RenderWin.ContinueFunc) {
      if (RenderWinTO) window.clearTimeout(RenderWinTO);
      RenderWinTO = RenderWin.setTimeout(RenderWin.ContinueFunc, 0);
    }
    break;
  }
}

function updateControlPanel() {
  // no audio checkbox
  var noaudio = document.getElementById("noaudio");
  if (!UIfile[AUDIO] || 
      !UIfile[AUDIO].exists() || 
      !UIfile[AUDIO].isDirectory()) {
    noaudio.checked = true;
  } 
  if (noaudio.checked) {
    InputTextbox[AUDIO].value = "";
    var runvideo = document.getElementById("runvideo");    
    if (runvideo.selected) 
      runvideo.parentNode.selectedItem = document.getElementById("runword-dvd");  
  }
  else InputTextbox[AUDIO].value = UIfile[AUDIO].path;
  document.getElementById("browse-1").disabled = noaudio.checked;
  document.getElementById("runvideo").disabled = noaudio.checked;
  
  // clean output directory checkbox
  if (document.getElementById("cleanOutDir").checked) {
    document.getElementById("skiptext").checked = false;
    document.getElementById("skiptext").disabled = true;
  }
  else document.getElementById("skiptext").disabled = false;  

  // run video radio
  var runvideo = document.getElementById("runvideo");    
  if (runvideo.parentNode.selectedItem == runvideo) {
    document.getElementById("skipmenus").checked = true;
    document.getElementById("skipfootnotes").checked = true;
    document.getElementById("skipmenus").disabled = true;
    document.getElementById("skipfootnotes").disabled = true;
  }
  else {
    document.getElementById("skipmenus").disabled = false;
    document.getElementById("skipfootnotes").disabled = false;
  }

  // show installation directory button
  document.getElementById("installPrompt").disabled = !ExtFile.exists();
  
  // osis to html conversion checkbox
  var osis2html = document.getElementById("osis2html");
  if (UIfile[INDIR]) {
    var osis = UIfile[INDIR].clone();
    osis.append(OSISFILE);
    osis2html.disabled = !osis.exists();
    
    var htmlFiles = UIfile[INDIR].clone();
    htmlFiles.append(HTMLDIR);
    if (!osis2html.disabled && !htmlFiles.exists()) osis2html.checked = true;
  }
/*
  // Render Nothing (can't "render only" and "render nothing"!)
  if (document.getElementById("rendernothing").selected) {
    document.getElementById("renderonly").disabled = true;
    var renderonly = document.getElementById("renderonly");
    if (renderonly.selected) {
      renderonly.parentNode.selectedItem = document.getElementById("runword-dvd");  
    }
  }
  else document.getElementById("renderonly").disabled = false;
*/
  // GO! button
  for (var i=0; i<NUMINPUTS; i++) {
    if (i==AUDIO && document.getElementById("noaudio").checked) continue;
    if (!UIfile[i]) break;
  }
  document.getElementById("go").disabled = (i!=NUMINPUTS);

  // shorten path names where possible
  if (UIfile[INDIR]) {
    if (InputTextbox[AUDIO].value)
      InputTextbox[AUDIO].value = UIfile[AUDIO].path.replace(UIfile[INDIR].path, "<Project Directory>");
    InputTextbox[OUTDIR].value = UIfile[OUTDIR].path.replace(UIfile[INDIR].path, "<Project Directory>");
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
    UIfile[OUTDIR] = UIfile[INDIR].clone();
    UIfile[OUTDIR].append(OUTDIRNAME);
  } 
}

// If audio directory is missing or empty, disable audio
// otherwise enable
function checkAudioDir(checkOnly) {
  var noaudio = document.getElementById("noaudio");
  if (!UIfile[AUDIO] || 
      !UIfile[AUDIO].exists() || 
      !UIfile[AUDIO].isDirectory()) {
    if (!checkOnly) noaudio.checked = true;
    return true;
  }
  
  var have = false;
  var afls = UIfile[AUDIO].directoryEntries;
  while (afls.hasMoreElements()) {
    var file = afls.getNext().QueryInterface(Components.interfaces.nsIFile);
    if (file.leafName.match(/\.ac3$/i)) have = true;
  }  
  if (!have) {
    if (!checkOnly) noaudio.checked = true;
    return true; 
  }
  
  if (!checkOnly) noaudio.checked = false;
  return false;
}

var MessageWin;
var Osis2HtmlInterval;
function wordDVD() {
  // Create LocaleFile var
  LocaleFile = UIfile[INDIR].clone();
  LocaleFile.append(LOCALEFILE);
  LocaleFile = readFile(LocaleFile);
  
  // Check output directory and clean if needed
  if (!UIfile[OUTDIR].path.match(OUTFILERE)) {
    window.alert("STOPPING!: Output directory must be have \"" + OUTDIRNAME + "\" somewhere in its path.");
    quit(true);
    return;
  }
  if (!UIfile[OUTDIR].exists()) UIfile[OUTDIR].create(UIfile[OUTDIR].DIRECTORY_TYPE, 0777);
  else if (document.getElementById("cleanOutDir").checked) {
    try {
      UIfile[OUTDIR].remove(true);
      UIfile[OUTDIR].create(UIfile[OUTDIR].DIRECTORY_TYPE, 0777);
    } catch (er) {}
  }
  document.getElementById("cleanOutDir").checked = false;

  // COPY RESOURCES AND BUILD-CODE TO INDIR
  exportDir(RESOURCE, UIfile[INDIR].path, document.getElementById("restoreDefaults").checked);
  exportDir(CODE, UIfile[INDIR].path, document.getElementById("restoreDefaults").checked);
  exportDir(MENUSDIR, UIfile[INDIR].path, false);
  exportDir(HTMLDIR, UIfile[INDIR].path, false);
  exportFile(LOCALEFILE, UIfile[INDIR].path, false);
  exportFile(PAGETIMING, UIfile[INDIR].path, false);
  CssFile = exportFile(STYLESHEET, UIfile[INDIR].path, document.getElementById("restoreDefaults").checked);
  document.getElementById("restoreDefaults").checked = false; // clear only after final time restoreDefaults is referenced!!
  
  // START OSIS CONVERTER SCRIPT
  if (document.getElementById("osis2html").checked) {
    var cf = UIfile[OUTDIR].clone();
    cf.append(CONVERSIONDONE);
    if (cf.exists()) cf.remove(false);
    MessageWin = window.open("chrome://word-dvd/content/message.xul", "message", "chrome=yes,alwaysRaised=yes,centerscreen=yes");
    logmsg("Generating HTML from OSIS...");
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);                        
    var tmpscript = getTempRunScript(OSISPL);
    process.init(tmpscript);
    var args = [];
    process.run(false, args, args.length);
    Osis2HtmlInterval = window.setInterval("checkOSISConverion();", 500);
  }
  else {
    logmsg("Skipped HTML generation.");
    readHtmlFiles();
  }
}

function readHtmlFiles() {
  document.getElementById("osis2html").checked = false;
    
  // Read HTML books, maxchapters, and maxverses
  var htmlFiles = UIfile[INDIR].clone();
  htmlFiles.append(HTMLDIR);
  if (!htmlFiles.exists() || !htmlFiles.isDirectory()) {
    window.alert("Stopping!: HTML directory not found \"" + htmlFiles.path + "\"\n");
    quit(true);
    return;
  }
  htmlFiles = htmlFiles.directoryEntries;
  if (!htmlFiles) {
    window.alert("Stopping!: No HTML files not found in \"" + UIfile[INDIR].path + "/" + HTMLDIR + "\"\n");
    quit(true);
    return;  
  }
  Book = [];
  while (htmlFiles.hasMoreElements()) {
    var file = htmlFiles.getNext().QueryInterface(Components.interfaces.nsIFile);
    var fileName = file.leafName.match(/^([^\.]+)\.(.*)$/); // process only book text files
    if (!fileName || fileName[2]!="html") continue;
    var data = readFile(file);
    if (!data) {
      logmsg("ERROR: Empty HTML file, or could not read \"" + file.path + "\"");
      continue;
    }
    Book.push(null);
    Book[Book.length-1] = new Object();
    Book[Book.length-1].shortName = fileName[1];
    var re = new RegExp("(" + escapeRE(NEWCHAPTER) + ")", "gim");
    var res = data.match(re);
    if (!res) {
      logmsg("ERROR: HTML file has no chapters \"" + file.path + "\"");
      continue;
    }
    Book[Book.length-1].maxChapter = res.length;
    
    // save minVerse and maxVerse for each chapter now
    re = new RegExp("(" + escapeRE(NEWCHAPTER) + ")", "im");
    var re2 = new RegExp("(" + NEWVERSERE + ")", "gim");
    var chstart = data.search(re);
    var more = true;
    var chn = 0;
    while(more) {
      chn++;
      var chend = data.substr(chstart+1).search(re);
      if (chend == -1) {chend = data.length; more = false;}
      else chend += chstart+1; // relative to data now
      res = data.substring(chstart, chend).match(re2);
      if (res) {
				var re3 = new RegExp(VERSENUMBER, "i");
				
				// save maxVerse
        var maxv = res[res.length-1];
        maxv = maxv.match(re3);
        if (!maxv) {
          logmsg("ERROR: Illegal max-verse number \"" + res[res.length-1] + "\" in \"" + file.path + "\"");
          quit(); return; 
        }
        maxv = (maxv[2] ? maxv[3]:maxv[1]);
        Book[Book.length-1]["ch" + chn + "MaxVerse"] = Number(maxv);
        
        // save minVerse
        var minv = res[0];
        minv = minv.match(re3);
        if (!minv) {
          logmsg("ERROR: Illegal min-verse number \"" + res[0] + "\" in \"" + file.path + "\"");
          quit(); return; 
        }
        minv = minv[1];
        Book[Book.length-1]["ch" + chn + "MinVerse"] = Number(minv);       
      }
      else {
        Book[Book.length-1]["ch" + chn + "MinVerse"] = 1;
        Book[Book.length-1]["ch" + chn + "MaxVerse"] = 1;
      }
      
      chstart = chend;
    }
  }
  Book = Book.sort(booksort);
  
  wordDVD2();
}

function wordDVD2() {
  if (document.getElementById("rendernothing").selected) {stop(); return;}
    
  jsdump("Checking Inputs...");
  for (var i=0; i<NUMINPUTS; i++) {
    if (!UIfile[i]) {
      window.alert("STOPPING!: Not all input directories are set.");
      quit(true);
      return;
    }
  }
  if (!UIfile[INDIR].exists()) {
    window.alert("STOPPING!: Project directory does not exist.");
    quit(true);
    return;
  }
  if (!document.getElementById("noaudio").checked && checkAudioDir(true)) {
    window.alert("STOPPING!: Audio not found. Check \"no audio\", or change the audio path.");
    quit(true);
    return;
  }

  // Create backup directory
  BackupDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  BackupDir.initWithPath(UIfile[OUTDIR].path + "/" + BACKUP);
  if (!BackupDir.exists()) BackupDir.create(BackupDir.DIRECTORY_TYPE, 0777);
  
  // Log File
  DBLogFile = UIfile[OUTDIR].clone();
  DBLogFile.append(DBLOGFILE);
  if (DBLogFile.exists()) DBLogFile = moveToBackup(DBLogFile);

  logmsg("Starting Word-DVD imager at " + StartDate.toTimeString() + " " + StartDate.toDateString());
  logmsg("Word-DVD Version: " + (ExtVersion ? ExtVersion:"undreadable"));
  
  // BACKUP XPI AND VERSION NUMBERS
  var test = BackupDir.clone();
  test.append("extension");
  if (test.exists()) test.remove(true);
  test.create(test.DIRECTORY_TYPE, 0777);
  test.append(ExtFile.leafName);
  ExtFile.copyTo(test.parent, null);
  var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                    .getService(Components.interfaces.nsIXULAppInfo);
  
  var vscript = "#!/bin/sh\n";
  vscript += "echo >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo ========= FIREFOX VERSION INFO ============== >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo firefox version " + appInfo.version + " >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo firefox extension backup: " + getPathOrRelativePath(test, UIfile[OUTDIR], UIfile[OUTDIR]) + " >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo ========= MPLEX VERSION INFO ============== >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo \\$mplex -E >> \"" + DBLogFile.path + "\"\n";
  vscript += "mplex -E" + " 2>> \"" + DBLogFile.path + "\"\n";
  vscript += "echo >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo ========= FFMPEG VERSION INFO ============== >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo \\$ffmpeg -version >> \"" + DBLogFile.path + "\"\n";
  vscript += "ffmpeg -version " + " >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo ========= DVDAUTHOR VERSION INFO ============== >> \"" + DBLogFile.path + "\"\n";
  vscript += "echo \\$dvdauthor >> \"" + DBLogFile.path + "\"\n";
  vscript += "dvdauthor " + " 2>> \"" + DBLogFile.path + "\"\n";
  vscript += "exit\n";
  var tmpscript = Components.classes["@mozilla.org/file/directory_service;1"].
			    getService(Components.interfaces.nsIProperties).
			    get("TmpD", Components.interfaces.nsIFile);	
  tmpscript.append("tmpscript.sh");
  if (tmpscript.exists()) tmpscript.remove(false);
  write2File(tmpscript, vscript, false);
  process.init(tmpscript);
  var args = [];
  process.run(true, args, args.length);

  logmsg("\nInitializing run environment");
  if (document.getElementById("cleanOutDir").checked) logmsg("Cleaned OUTPUT directory:" + UIfile[OUTDIR].path + "...");
  
  // LOG LOCALE FILE
  logmsg("\nconfig.txt entries:");
  var entries = getLocaleLiterals();
  for (var i=0; i<entries.length; i++) {logmsg(entries[i]);}
  
  logmsg("\nChecking/Creating directories...");  
  // IMAGE DIRECTORY
  var imgdir = UIfile[OUTDIR].clone();
  imgdir.append(IMGDIR);
  if (!imgdir.exists()) imgdir.create(imgdir.DIRECTORY_TYPE, 0777);

  // LISTING DIRECTORY
  var listdir = UIfile[OUTDIR].clone();
  listdir.append(LISTING);
  if (listdir.exists()) {    
    if (!document.getElementById("startbk").selected) {
      listdir = moveToBackup(listdir);
      listdir.create(listdir.DIRECTORY_TYPE, 0777);
    }
  }
  else listdir.create(listdir.DIRECTORY_TYPE, 0777);
  
  // TIMING STATISTICS FILES
  StatsFile = UIfile[OUTDIR].clone();
  StatsFile.append(LISTING);
  
  // TRANSITION LISTING FILE
  TransFile = UIfile[OUTDIR].clone();
  TransFile.append(LISTING);

  // AUTOGENERATE ALL RUN SCRIPTS
  writeRunScripts();
  
  StartingBindex = 0;
  if (document.getElementById("singlebk").selected) 
      if (!prompForSingleBook()) {quit(); return;}
  if (document.getElementById("startbk").selected) 
      if (!prompForStartBook()) {quit(); return;}
  
  RenderWin = window.open("chrome://word-dvd/content/render.xul", "render-win", "chrome=yes,alwaysRaised=yes");
  RenderWin.focus();
}  

function checkOSISConverion() {
  MessageWin.focus();
  var cf = UIfile[OUTDIR].clone();
  cf.append(CONVERSIONDONE);
  if (cf.exists()) {
    window.clearInterval(Osis2HtmlInterval);
    MessageWin.close();
    cf.remove(false);
    readHtmlFiles();
  }
  else {
    var pf = UIfile[OUTDIR].clone();
    pf.append(OSISPROGRESS);
    if (pf.exists() && MessageWin) {
      var percent = readFile(pf);
      if (percent && percent > 3) MessageWin.setProgress(percent);
    }
  }
}

// extdir the partial path of a directory within the extension
// outDirPath is the full destination base path
// if overwrite is set, the entire destination directory is deleted before copy
// if overwrite is not set, the function will exit with null if the destination directory exists
function exportDir(extdir, outDirPath, overwrite) {
  if (!ExtFile.exists()) {logmsg("ERROR (exportDir): Can't open firefox extension"); return null;}
  var to = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  to.initWithPath(outDirPath + "/" + extdir);
  if (to.exists()) {
    if (overwrite) to.remove(true);
    else return to;
  }
  var toP = to.parent;
  if (!toP.exists()) toP.create(toP.DIRECTORY_TYPE, 0777);
  if (ExtFile.isDirectory()) {
    var from = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    from.initWithPath(ExtFile.path + "/" + extdir);
    if (!from.exists() || !from.isDirectory()) {logmsg("ERROR (exportDir): From directory does not exist \"" + from.path + "\""); return null;}
    from.copyTo(toP, to.leafName);
  }
  else {
    var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
    try {zReader.open(ExtFile);}
    catch (er) {logmsg(er + "\nERROR (exportDir): cannot open \"" + ExtFile.path + "\""); return null;}	
/*    
    // test code	
    var entries = zReader.findEntries(null);
    while (entries.hasMore()) {
      var entry = entries.getNext();
      var eobj = zReader.getEntry(entry);
      logmsg(entry + ", isDirectory=" + eobj.isDirectory);
    }
*/    
    try {
      var isdir = zReader.getEntry(extdir + "/");
      if (!isdir || !isdir.isDirectory) {logmsg("ERROR (exportDir): From zip directory does not exist \"" + extdir + "\""); return null;}
    }
    catch(er) {logmsg(er + "\nERROR (exportDir): reading zip entry \"" + extdir + "\""); return null;}
    // create output directories	
    var entries = zReader.findEntries(null);
    while (entries.hasMore()) {
      var entry = entries.getNext();
      if (entry.indexOf(extdir) != 0) {continue;}
      try {var entryObj = zReader.getEntry(entry);}
      catch (er) {logmsg(er + "\nError (exportDir): Getting zip directory entry " + entry + ". " + er); continue;}
      var newfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      newfile.initWithPath(outDirPath + "/" + entry);
      if (entryObj && entryObj.isDirectory && !newfile.exists()) newfile.create(newfile.DIRECTORY_TYPE, 0777);
    }
    // create output files	
    var entries = zReader.findEntries(null);
    while (entries.hasMore()) {
      var entry = entries.getNext();
      if (entry.indexOf(extdir) != 0) {continue;}
      try {var entryObj = zReader.getEntry(entry);}
      catch (er) {logmsg(er + "\nError (exportDir): Getting zip file entry " + entry + ". " + er); continue;}
      var newfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      newfile.initWithPath(outDirPath + "/" + entry);
      if (entryObj && !entryObj.isDirectory) {
	zReader.extract(entry, newfile);
	if (!newfile.exists()) logmsg("ERROR (exportDir): filed to extract \"" + entry + "\"");
      }
    }
  }
  if (!to.exists()) logmsg("ERROR (exportDir): failed to export to \"" + to.path + "\"");
  return to;	
}

// extdir the partial path of a file within the extension
// outDirPath is the full destination base path
// if overwrite is set, the target file in outPath is deleted before copy
// if overwrite is not set, the function will exit with null if target exists
function exportFile(extfile, outDirPath, overwrite) {
  if (!ExtFile.exists()) {logmsg("ERROR (exportFile): Can't open firefox extension"); return null;}
  var to = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  to.initWithPath(outDirPath + "/" + extfile);
  if (to.exists()) {
    if (overwrite) to.remove(false);
    else return to;
  }
  var toP = to.parent;
  if (!toP.exists()) toP.create(toP.DIRECTORY_TYPE, 0777);
  if (ExtFile.isDirectory()) {
    var from = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    from.initWithPath(ExtFile.path + "/" + extfile);
    if (!from.exists() || from.isDirectory()) {logmsg("ERROR (exportFile): From file does not exist \"" + from.path + "\""); return null;}
    from.copyTo(toP, to.leafName);
  }
  else {
    var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
    try {zReader.open(ExtFile);}
    catch (er) {logmsg("ERROR (exportFile): cannot open-" + ExtFile.path); return null;}	
    try {
      var isdir = zReader.getEntry(extfile);
      if (!isdir || isdir.isDirectory) {logmsg("ERROR (exportFile): From zip file does not exist \"" + extfile +"\""); return null;}
    }
    catch(er) {logmsg("ERROR (exportFile): reading zip entry \"" + extfile + "\""); return null;}
    zReader.extract(extfile, to);
  }
  if (!to.exists()) logmsg("ERROR (exportFile): failed to export to \"" + to.path + "\"");
  return to;	
}

// returns original (to be non-existent) file because the aFile 
// file object takes on post-move identity.
function moveToBackup(aFile) {
  var orig = aFile.path;
  var back = BackupDir.clone();
  back.append(aFile.leafName); 
  var n = 0;
  do {
    var save = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    save.initWithPath(back.path.replace(/([^\/]+)$/, (n ? n + "-":"") + BackupPrefix + "-$1"));
    n++;
  } while (save.exists());
  aFile.moveTo(save.parent, save.leafName);
  aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  aFile.initWithPath(orig);
  return aFile;
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
  for (var i=0; i<Book.length; i++) {items.push(Book[i].shortName);}
  var result = prompts.select(null, "Select Book", "Render which book?", items.length, items, selected);
  if (!result) {return false;}
  for (var i=0; i<Book.length; i++) {
    if (Book[i].shortName == items[selected.value]) continue;
    Book.splice(i, 1);
    i--;
  }
  return true;
}

function prompForStartBook() {
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  var selected = {};
  var items = [];
  for (var i=0; i<Book.length; i++) {items.push(Book[i].shortName);}
  var result = prompts.select(null, "Select Book", "Which book do you want to start from?", items.length, items, selected);
  if (!result) {return false;}
  for (var i=0; i<Book.length; i++) {
    if (Book[i].shortName != items[selected.value]) continue;
    StartingBindex = i;
    break;
  }
  return true;
}

function writeRunScripts() {
  var slist = [OSISPL, WORDDVD, VIDEOFILES,
   "audio.pl", "imgs2mpeg.pl", "navbuttons.pl", 
   "menus.pl", "mpeg2vob.pl", "lencalc.pl", 
   "timeAnalysis.pl", "createiso.pl", "audacity.pl", 
   "transitions.pl", "burnverify.sh", "imgs2web.pl",
   FIXEDTRANSITIONS];
  
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
    if (!path) path = "/";
    rpath = rpath.replace(root, "");
    if (!rpath) rpath = ".";
    else {
      rpath = rpath.replace(/[^\/]+/g, "..").substring(1);
    }
    path = rpath + path;
  }
  
  return path;
}

function getTempRunScript(script) {
  var scriptdir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  scriptdir.initWithPath(UIfile[INDIR].path + "/" + CODE);
  var temp = Components.classes["@mozilla.org/file/directory_service;1"].
			    getService(Components.interfaces.nsIProperties).
			    get("TmpD", Components.interfaces.nsIFile);		      
  writeRunScript(script, scriptdir, temp);
  temp.append(runscript(script));
  if (!temp.exists()) logmsg("ERROR: Could not create temporary run script.");
  return temp;
}

function quit(quiet) {
  var endDate = new Date();
  Aborted = true;
  Running = false;
  if (RenderWin) RenderWin.close();
  if (!quiet) logmsg("Quitting Word-DVD imager at " + endDate.toTimeString() + " " + endDate.toDateString());  
  if (!quiet) window.alert("Quitting Word-DVD renderer.");
  resetGo();
}

function stop() {
  Running = false;
  var endDate = new Date();
  var unUtilizedAudio = "";
  if (RenderWin) {
    for each (var files in RenderWin.CheckAudioFiles) {
      if (files.match(/^\s*$/)) {continue;}
      unUtilizedAudio += files + "\n";
    }
    for (var vt in RenderWin.VerseTiming) {
      var keep = false;
      for (var i=0; i<Book.length; i++) {if (vt.indexOf("vt_" + Book[i].shortName + "_") === 0) keep = true;}
      if (!keep) continue;
      for (var i=0; i<RenderWin.VerseTiming[vt].length; i++) {
        if (RenderWin.VerseTiming[vt][i]) logmsg("WARNING: Did not calculate " + PAGETIMING + " data: " + RenderWin.VerseTiming[vt][i].entry);
      }
    }
  }
  if (unUtilizedAudio) logmsg("Unutilized audio file(s):\n" + unUtilizedAudio);
  if (RenderWin) RenderWin.close();
  
  // remove fixed timing values from pageTiming.txt if they exist
  var process = Components.classes["@mozilla.org/process/util;1"]
                    .createInstance(Components.interfaces.nsIProcess);                        
  var tmpscript = getTempRunScript(FIXEDTRANSITIONS);
  process.init(tmpscript);
  var args = [];
  process.run(true, args, args.length);
  
  var hasErrors = false;
  if (DBLogFile) {
    var logf = readFile(DBLogFile);
    if (logf) hasErrors = (logf.search(/ERR/i)!=-1);
    logmsg("Finishing Word-DVD imager at " + endDate.toTimeString() + " " + endDate.toDateString());
  }
  
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
    logmsg("Launched " + runscript(VIDEOFILES));  
  }
 
  if (!document.getElementById("rendernothing").selected) {
    if (hasErrors) window.alert("Image rendering has completed, but WITH ERRORS!");
    else window.alert("Image rendering has completed without errors.");
  }
  else window.alert("Skipping image rendering.");
  
  resetGo(); 
}

function resetGo() {
  document.getElementById("go").removeAttribute("hidden");
  document.getElementById("rendernext").removeAttribute("hidden");
  document.getElementById("rendernext").disabled = true;
  document.getElementById("pause").setAttribute("hidden", "true");
  document.getElementById("resume").setAttribute("hidden", "true");
  updateControlPanel();
}

function viewReadMe() {
  var readme = "ReadMe.txt";
  var temp = Components.classes["@mozilla.org/file/directory_service;1"].
			    getService(Components.interfaces.nsIProperties).
			    get("TmpD", Components.interfaces.nsIFile);
  exportFile(readme, temp.path, true);
  var tr = temp.path;
  temp.append(readme + ".sh");
  if (temp.exists()) temp.remove(false);
  write2File(temp, "#!/bin/sh\n\gedit --new-window \"" + tr + "/" + readme + "\" &", false);
  var process = Components.classes["@mozilla.org/process/util;1"]
                    .createInstance(Components.interfaces.nsIProcess);                        
  process.init(temp);
  var args = [];
  process.run(false, args, args.length); 
}

function unloadXUL() {
  Running = false;
  var tmp = UIfile[OUTDIR].clone();
  tmp.append(LISTING);
  tmp.append("tmp");
  if (tmp.exists()) tmp.remove(true);
  
  for (var i=0; i<NUMINPUTS; i++) {
    if (!UIfile[i]) continue;
    prefs.setComplexValue("File-" + i, Components.interfaces.nsILocalFile, UIfile[i]);
  }
  
  if (RenderWin) RenderWin.close();
}
