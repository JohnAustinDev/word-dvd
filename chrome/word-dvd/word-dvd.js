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
const OSISPL="osis2html.pl", RUNOSISPL="xosis2html.sh";
const AUDIOGEN="audio.pl", RUNAUDIOGEN="xaudio.sh";
const IMAGEPL="imgs2mpeg.pl", RUNIMAGEPL="ximgs2mpeg.sh";
const IMG2WEB="imgs2web.pl", RUNIMG2WEB="ximgs2web.sh";
const NAVBUT="navbuttons.pl", RUNNAVBUT="xnavbuttons.sh";
const MENUS="menus.pl", RUNMENUS="xmenus.sh";
const MPEGPL="mpeg2vob.pl", RUNMPEGPL="xmpeg2vob.sh";
const LENCALC="lencalc.pl", RUNLENCALC="xlencalc.sh";
const TIMEANAL="timeAnalysis.pl", RUNTIMEANAL="xtimeAnalysis.sh";
const AUDACITY="audacity.pl", RUNAUDACITY="xaudacity.sh";
const ECASOUND="ecasound.pl", RUNECASOUND="xecasound.sh";
const BURNVERIFY="burnverifydvd.sh", RUNBURNVERIFY="xburnverify.sh";
const WORDDVD="word-dvd.sh", RUNWORDDVD="xword-dvd.sh";
const VIDEOFILES="word-video.sh", RUNVIDEOFILES="xword-video.sh";
const CREATEISO="createiso.pl", RUNCREATEISO="xcreateiso.sh";
const DBLOGFILE="logfile.txt";
const OSISFILE = "osis.xml";
const STYLESHEET="chrome/word-dvd/web/pal.css";
const CAPTURE="import.sh";
const HTMLDIR="html";
const IMGDIR="images";
const SCRIPT="script";
const LISTING="listing";
const OUTAUDIODIR="audio";
const MENUSFILE="MENU_BUTTONS.csv";
const PAGETIMING="pageTiming.txt";
const AUDIOICON="chrome/word-dvd/web/audio-icon.png";
const LOCALEFILE="config.txt";
const IMAGEEXT="jpg";
const NEWCHAPTER = "<span name=\"chapter.";

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
var StatsFile, TransFile, ExtDir;
var InputTextbox = new Array(NUMINPUTS);
var RenderNext;
var RunPause;
var Paused;
var LocaleFile;
var ButtonId;
var RenderWin;
var DBLogFile;

function loadedXUL() {
  window.setTimeout("window.focus();", 500);
  
  ExtDir =  Components.classes["@mozilla.org/file/directory_service;1"].
                     getService(Components.interfaces.nsIProperties).
                     get("ProfD", Components.interfaces.nsIFile);
  ExtDir.append("extensions");
  ExtDir.append(MYGUID);
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
  
  enableGO();
  if (ExtDir.exists()) document.getElementById("installPrompt").disabled = false;


    
  // READ LOCALE FILE
  LocaleFile = UIfile[INDIR].clone();
  LocaleFile.append(LOCALEFILE);
  LocaleFile = readFile(LocaleFile);
    
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
      InputTextbox[1].value = "";
      document.getElementById("input-1").disabled=true;
      document.getElementById("browse-1").disabled=true;
    }
    else {
      document.getElementById("input-1").disabled=false;
      document.getElementById("browse-1").disabled=false;
      try {
        UIfile[1] = prefs.getComplexValue("File-1", Components.interfaces.nsILocalFile);
        InputTextbox[1].value = UIfile[1].path;
      }
      catch(er) {InputTextbox[1].value = "";}
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
  var osis = UIfile[INDIR].clone();
  osis.append(OSISFILE);
  document.getElementById("osis2html").disabled = !osis.exists();
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
  var vers = ExtDir.clone();
  try {
    vers.append("install.rdf");
    vers = readFile(vers).match(/<em\:version>(.*?)<\/em\:version>/im)[1];
  }
  catch (er) {vers=null;}
  logmsg("Word-DVD Version: " + (vers ? vers:"(error reading version)"));
  
  // Below is for Firefox 4+
  //Components.utils.import("resource://gre/modules/AddonManager.jsm");    
  //AddonManager.getAddonByID("{ec8030f7-c20a-464f-9b0e-13a3a9e97384}", function(addon) {alert("My extension's version is " + addon.version);});

  if (document.getElementById("delete1st").checked) logmsg("Cleaned OUTPUT directory:" + UIfile[OUTDIR].path + "...");

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
  
  // COPY MISC BITS TO OUTPUT DIR
  const CFILE=[
  "chrome/word-dvd/web/blankaudio.ac3",
  "chrome/word-dvd/web/textbuttonsSEL.png",
  "chrome/word-dvd/web/textbuttonsHIGH.png",
  "chrome/word-dvd/web/menuNormHIGH.png",
  "chrome/word-dvd/web/menuLeftHIGH.png",
  "chrome/word-dvd/web/menuRightHIGH.png",
  "chrome/word-dvd/web/menuBothHIGH.png",
  "chrome/word-dvd/web/menuNormSEL.png",
  "chrome/word-dvd/web/menuLeftSEL.png",
  "chrome/word-dvd/web/menuRightSEL.png",
  "chrome/word-dvd/web/menuBothSEL.png",
  "chrome/word-dvd/web/transparent.png"];
  const DESTDIR=[
  OUTAUDIODIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,
  IMGDIR,     
  IMGDIR];
  for (var f=0; f<CFILE.length; f++) {
    var destdir = UIfile[OUTDIR].clone();
    destdir.append(DESTDIR[f]);
    if (!destdir.exists()) destdir.create(destdir.DIRECTORY_TYPE, 0777);
    var cfile = ExtDir.clone();
    var pth = CFILE[f].split("/");
    for (var i=0; i<pth.length; i++) {cfile.append(pth[i]);}
    if (cfile.exists()) cfile.copyTo(destdir, null);
  }
  
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
    file.append(RUNOSISPL);
    process.init(file);
    var args = [];
    process.run(true, args, args.length);
  }
  else logmsg("Skipped HTML generation.");
  
  // Read HTML books and maxchapters
  var htmlFiles = UIfile[INDIR].clone();
  htmlFiles.append(HTMLDIR);
  var cfile = ExtDir.clone();
  var pth = STYLESHEET.split("/");
  for (var i=0; i<pth.length; i++) {cfile.append(pth[i]);}
  var dest = htmlFiles.clone();
  dest.append(pth[pth.length-1]);
  if (dest.exists()) try{dest.remove(false);} catch (er) {logmsg("WARNING:" + er);}
  try {cfile.copyTo(htmlFiles, null);} catch (er) {logmsg("WARNING:" + er);}
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
  RenderWin.startMenuGeneration();
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
  // MAKE OUTPUT SCRIPT DIR
  var file = UIfile[OUTDIR].clone();
  file.append(SCRIPT);
  if (!file.exists()) file.create(file.DIRECTORY_TYPE, 0777);
  
  var scriptdir = ExtDir.clone();
  scriptdir.append(SCRIPT);

  const st="\"", md="\" \"", en="\"";
  var commandline = scriptdir.path + md + UIfile[INDIR].path + md + UIfile[OUTDIR].path + md + UIfile[AUDIO].path + en + " $1 $2 $3";
  var slist = [OSISPL, AUDIOGEN, IMAGEPL, NAVBUT, MENUS, MPEGPL, LENCALC, TIMEANAL, CREATEISO, AUDACITY, ECASOUND, BURNVERIFY, IMG2WEB, WORDDVD, VIDEOFILES];
  var rlist = [RUNOSISPL, RUNAUDIOGEN, RUNIMAGEPL, RUNNAVBUT, RUNMENUS, RUNMPEGPL, RUNLENCALC, RUNTIMEANAL, RUNCREATEISO, RUNAUDACITY, RUNECASOUND, RUNBURNVERIFY, RUNIMG2WEB, RUNWORDDVD, RUNVIDEOFILES];
  for (var i=0; i<slist.length; i++) {
    var script = scriptdir.clone();
    script.append(slist[i]);
    if (script.exists()) {
      file = UIfile[OUTDIR].clone();
      file.append(SCRIPT);
      file.append(rlist[i]);
      write2File(file, "#!/bin/sh\n\"" + script.path + md + commandline, false);
    }
  }
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
    file.append(RUNWORDDVD);
    process.init(file);
    var args = [rundir];
    process.run(false, args, args.length);
    logmsg("Launched RUNWORDDVD!");
  }
  else if (document.getElementById("runvideo").selected) {
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);                        
    var file = UIfile[OUTDIR].clone();
    file.append(SCRIPT);
    var rundir = file.path;
    file.append(RUNVIDEOFILES);
    process.init(file);
    var args = [rundir];
    process.run(false, args, args.length);
    logmsg("Launched RUNVIDEOFILES!");  
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
