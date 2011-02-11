/*  This file is part of word-dvd.

    Copyright 2010 Dale Potter (gpl.programs.info@gmail.com)

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
 * Utility Functions
 ***********************************************************************/ 
 
function jsdump(str)
{
  Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);
}

function logmsg(text, showBCP) {
  if (showBCP) text += " [" + Book[Bindex].shortName + ", Chapter=" + Chapter + ", Page=" + Page.pagenumber + "]";
  jsdump(text);
  write2File(DBLogFile, text + "\n", true);
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


/************************************************************************
 * Main Program Functions
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
const NAVBUT="navbuttons.pl", RUNNAVBUT="xnavbuttons.sh";
const MENUS="menus.pl", RUNMENUS="xmenus.sh";
const MPEGPL="mpeg2vob.pl", RUNMPEGPL="xmpeg2vob.sh";
const LENCALC="lencalc.pl", RUNLENCALC="xlencalc.sh";
const TIMEANAL="timeAnalysis.pl", RUNTIMEANAL="xtimeAnalysis.sh";
const WORDDVD="word-dvd.pl", RUNWORDDVD="xword-dvd.sh";
const CREATEISO="createiso.pl", RUNCREATEISO="xcreateiso.sh";
const AUDACITY="audacity.pl", RUNAUDACITY="xaudacity.sh";
const ECASOUND="ecasound.pl", RUNECASOUND="xecasound.sh";
const BURNVERIFY="burnverifydvd.sh", RUNBURNVERIFY="xburnverify.sh";
const DBLOGFILE="logfile.txt";
const STYLESHEET="chrome/word-dvd/web/pal.css";
const CAPTURE="import.sh";
const HTMLDIR="html";
const IMGDIR="images";
const SCRIPT="script";
const LISTING="listing";
const OUTAUDIODIR="audio";
const MENUSFILE="MENU_BUTTONS.csv";
const PAGETIMING="pageTiming.txt";
const BLANKPAGE="blankpage.png";
const AUDIOICON="chrome/word-dvd/web/audio-icon.png";
const LOCALEFILE="config.txt";
const IMAGEEXT="jpg";
const APPROXLINE = 24;
const APPNUMLINE = 12;
const PARSTART = "<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
const NOTESTART = "<div class=\"footnote\">";
const NOTEREF  = "<span class=\"verseref\"";
const NOTESYMBOL = "<span class=\"fnsymbol\"";
const PAGEBREAK = "<span class=\"pagebreak\"></span>";
const NEWCHAPTER = "<span name=\"chapter.";
const NEWVERSE = "<sup>[\\d\\s-]+<\/sup>";
const SPLITABLEDIVS = "majorquote|list1|list2|list3|footnote|canonical|x-list-1|x-list-2|x-enumlist-1|x-enumlist-2|x-enumlist-3";
const TITLES = "title-1|title-2|booktext|chapter-title|header";

var UIfile = new Array(NUMINPUTS);
var InfoFile, DBLogFile, StatsFile, MenusFile, TransFile, BlankPageImage;
var ExtDir;
var InputTextbox = new Array(NUMINPUTS);
var RenderFrame;
var RenderNext;
var RunPause;
var Book, Bindex, Chapter, Page;
var Paused;
var ILastPage;
var LocaleFile;
var ButtonId;
var ContinueFunc;

function writeRunScripts() {
  // MAKE OUTPUT SCRIPT DIR
  var file = UIfile[OUTDIR].clone();
  file.append(SCRIPT);
  if (!file.exists()) file.create(file.DIRECTORY_TYPE, 0777);
  
  var scriptdir = ExtDir.clone();
  scriptdir.append(SCRIPT);

  const st="\"", md="\" \"", en="\"";
  var commandline = scriptdir.path + md + UIfile[INDIR].path + md + UIfile[OUTDIR].path + md + UIfile[AUDIO].path + en + " $1 $2 $3";
  var slist = [OSISPL, AUDIOGEN, IMAGEPL, NAVBUT, MENUS, MPEGPL, LENCALC, TIMEANAL, CREATEISO, AUDACITY, ECASOUND, BURNVERIFY];
  var rlist = [RUNOSISPL, RUNAUDIOGEN, RUNIMAGEPL, RUNNAVBUT, RUNMENUS, RUNMPEGPL, RUNLENCALC, RUNTIMEANAL, RUNCREATEISO, RUNAUDACITY, RUNECASOUND, RUNBURNVERIFY];
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

function loadedXUL() {
  ExtDir =  Components.classes["@mozilla.org/file/directory_service;1"].
                     getService(Components.interfaces.nsIProperties).
                     get("ProfD", Components.interfaces.nsIFile);
  ExtDir.append("extensions");
  ExtDir.append(MYGUID);
  RenderNext = document.getElementById("rendernext");
  RunPause = document.getElementById("runpause");
  RenderFrame = document.getElementById("render");
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
  
  RenderFrame.style.width = PAL.W + "px";
  RenderFrame.style.height = String(PAL.H + 16) + "px";
  window.setTimeout("window.resizeTo(RenderFrame.boxObject.width, document.getElementById('body').boxObject.height);", 0);
  if (ExtDir.exists()) document.getElementById("installPrompt").disabled = false;
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
  
  BlankPageImage = getSubFilePath(UIfile[INDIR], BLANKPAGE); 
  
  // COPY MISC BITS TO OUTPUT DIR
  const CFILE=[
  "chrome/word-dvd/web/blankaudio.ac3",
  "script/xword-dvd.sh",
  "script/xcreateiso.sh",
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
  SCRIPT,
  SCRIPT,
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
    
  // READ LOCALE FILE
  LocaleFile = UIfile[INDIR].clone();
  LocaleFile.append(LOCALEFILE);
  LocaleFile = readFile(LocaleFile);
  if (!LocaleFile) return;
  
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
  Book = [];
  while (htmlFiles.hasMoreElements()) {
    var file = htmlFiles.getNext().QueryInterface(Components.interfaces.nsIFile);
    var fileName = file.leafName.match(/^([^\.]+)\.(.*)$/);
    if (!fileName || fileName[2]!="html") continue;
    var data = readFile(file);
    if (!data) {
      logmsg("ERROR: Empty HTML file, or could not read \"" + file.path() + "\"");
      continue;
    }
    Book.push(null);
    Book[Book.length-1] = new Object();
    Book[Book.length-1].shortName = fileName[1];
    var re = new RegExp("(" + NEWCHAPTER + ")", "gim");
    data = data.match(re);
    if (!data) {
      logmsg("ERROR: HTML file has no chapters \"" + file.path() + "\"");
      continue;
    }
    Book[Book.length-1].maxChapter = data.length;
  }
  Book = Book.sort(booksort);

  if (document.getElementById("singlebk").selected) prompForSingleBook();
  if (document.getElementById("startbk").selected) prompForStartBook();
    
  startMenuGeneration();
}

function booksort(a, b) {
  var ai = Number(getLocaleString(a.shortName + "i"));
  var bi = Number(getLocaleString(b.shortName + "i"));
  if (ai > bi) return 1;
  if (ai < bi) return -1;
  return 0;
}

function startMenuGeneration() {
  if (!document.getElementById("skipmenus").checked) {
    logmsg("Generating Menus...");
  
    // REMOVE MENU INFO FILE
    MenusFile = UIfile[OUTDIR].clone();
    MenusFile.append(LISTING);
    MenusFile.append(MENUSFILE);
    if (MenusFile.exists()) MenusFile.remove(false);
    write2File(MenusFile, "#Button,Target,Type\n"); 
    
    // CREATE TABLE OF CONTENTS
    MenuEntries = [];
    for (var b=0; b<Book.length; b++) {
      MenuEntries.push(new Object());
      MenuEntries[MenuEntries.length-1].label = getLocaleString(Book[b].shortName);
      MenuEntries[MenuEntries.length-1].className = (hasAudio(Book[b].shortName, 1) ? "hasAudio":"");
      if (Book[b].maxChapter>1 || getPassage(Book[b].shortName, true)) {
        MenuEntries[MenuEntries.length-1].target = Book[b].shortName + "-m1";
      }
      else {
        MenuEntries[MenuEntries.length-1].target = Book[b].shortName + "-1";
      }
    }
    MenuEntryIndex = 0;
    MenuNumber = 0;
    MenuType="TOC";
    Basename = "toc";
    logmsg("Rendering TOC Menu(s)...");
    window.setTimeout("renderMenuSection();", 0);
      
    Bindex = 0;
  }
  else {
    logmsg("Skipped menu generation.");
    startTextGeneration();
  }
}

function startTextGeneration() {
  document.getElementById("rendernext").disabled = false;
  RenderFrame.contentDocument.defaultView.location.assign("chrome://word-dvd/content/web/render-page.html");
  if (!document.getElementById("skiptext").checked) {
    readPageTiming();
    logmsg("Generating Text Pages...");
    window.setTimeout("renderAllPages();", 2000);
  }
  else {
    logmsg("Skipped Text generation.");
    window.setTimeout("startFootnoteGeneration();", 2000);  
  }
}

function startFootnoteGeneration() {
  if (!document.getElementById("skipfootnotes").checked) {
    logmsg("Generating Footnote Pages...");
    window.setTimeout("startFootnotes();", 2000);
  }
  else {
    logmsg("Skipped Footnote generation.");
    stop();
  }
}

var VerseTiming = {};
var PageTiming;
function readPageTiming() {
  var ptf = UIfile[INDIR].clone();
  ptf.append(PAGETIMING);
  if (ptf.exists()) {
    PageTiming = readFile(ptf);
    if (!PageTiming) return;
    var res  = new RegExp("(^\\s*[^-#]+-\\d+:\\d+\\s*=\\s*[^\{]+?( \{.*?\})?\\s*$)", "gm");
    var res2 = new RegExp("^\\s*([^-#]+)-(\\d+):(\\d+)\\s*=\\s*([^\{]+?)(\\s\{(.*?)\})?\\s*$");
    res = PageTiming.match(res);
    if (!res) return;
    for (var i=0; i<res.length; i++) {
      var parts = res[i].match(res2);
      var en = parts[0]; var bk = parts[1]; var ch = parts[2]; var vs = parts[3]; var tm = parts[4]; var trans = parts[6];
      var prop = "vt_" + bk + "_" + ch;
      if (!VerseTiming[prop]) VerseTiming[prop] = [];
      en = en.replace(/(^\s*|\s*$)/g, "");
      var thobj = {entry:en, book:bk, chapter:ch, verse:vs, realtime:tm, trans:trans};
      VerseTiming[prop].push(thobj);
    }
  }  
}

function prompForSingleBook() {
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  var selected = {};
  var items = [];
  for (var i=0; i<Book.length; i++) {items.push(Book[i].shortName);}
  var result = prompts.select(null, "Select Book", "Create a DVD for which book?", items.length, items, selected);
  if (!result) return;
  for (var i=0; i<Book.length; i++) {
    if (Book[i].shortName == items[selected.value]) continue;
    Book.splice(i, 1);
    i--;
  }
}

function prompForStartBook() {
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
  var selected = {};
  var items = [];
  for (var i=0; i<Book.length; i++) {items.push(Book[i].shortName);}
  var result = prompts.select(null, "Select Book", "Which book do you want to start from?", items.length, items, selected);
  if (!result) return;
  for (var i=0; i<Book.length; i++) {
    if (Book[i].shortName != items[selected.value]) continue;
    StartingBindex = i;
    break;
  }
}

var MenuEntries, MenuEntryIndex, MenuNumber, MenuType, Basename;

function renderChapterMenus() {
  if (Bindex < Book.length) {
    var intro = getPassage(Book[Bindex].shortName, true);
    if (Book[Bindex].maxChapter>1 || intro) {
      MenuEntries = [];
      for (var c=0; c<=Book[Bindex].maxChapter; c++) {
        if (c==0 && !intro) continue;
        MenuEntries.push(new Object());
        if (c>0) MenuEntries[MenuEntries.length-1].label = getLocaleString("Chaptext", c, Book[Bindex].shortName);
        else MenuEntries[MenuEntries.length-1].label = getLocaleString("IntroLink");
        MenuEntries[MenuEntries.length-1].target = Book[Bindex].shortName + "-" + c;
        MenuEntries[MenuEntries.length-1].className = "";
      }
      MenuEntryIndex = 0;
      MenuNumber = 0;
      MenuType = "CHP";
      Basename = Book[Bindex].shortName;
      logmsg("Rendering Chapter Menu(s):" + Basename + "...");
      window.setTimeout("renderMenuSection();", 0);
      Bindex++;
    }
    else {
      Bindex++;
      window.setTimeout("renderMenuSection();", 0);
    }
  }
  else window.setTimeout("startTextGeneration();", 2000);
}

function renderMenuSection() {
  if (MenuEntryIndex<MenuEntries.length) {
    MenuNumber++;
    var arrayL = [];
    var arrayR = [];
    var haveart = getSubFilePath(UIfile[INDIR], Basename + "-m" + MenuNumber + ".png");
    var doneLeft = false;
    var doneRight = false;
    for (var r=1; r<=16; r++) {
      if (!getLocaleString(MenuType + String(MenuNumber) + "button" + r)) continue;
      if (r <= 8) doneLeft = true;
      else doneRight = true;
    }
    for (var r=1; r<=16; r++) {
      var label = getLocaleString(MenuType + String(MenuNumber) + "button" + r); 
      var target = getLocaleString(MenuType + String(MenuNumber) + "button" + r + "T");
      if (label && !target || !label && target) {
        logmsg("ERROR: Skipping button " + label + ", no label or target found!");
        label = "";
        target = "";
      } 
      var nobj = {label:label, target:target, className:"custombutton"};
      if (r <= 8 && doneLeft) arrayL.push(nobj);
      else if (r > 8 && doneRight) arrayR.push(nobj);
    }
    if (doneLeft && haveart) logmsg("Error: artwork/button conflict on " + Basename + "-m" + MenuNumber);
    var pagedone = false;
    for (var r=1; r<=16; r++) {
      if (r == 9) pagedone=false;
      if (r <= 8 && doneLeft || r > 8 && doneRight) continue;
      if (haveart && r <= 8 || pagedone || !MenuEntries[MenuEntryIndex]) continue;
      if (r <= 8) arrayL.push(MenuEntries[MenuEntryIndex]);
      else arrayR.push(MenuEntries[MenuEntryIndex]);
      if (MenuEntries[MenuEntryIndex] && getLocaleString(MenuType + String(MenuNumber) + (r <= 8 ? "left":"right") + "last")==MenuEntries[MenuEntryIndex].label) pagedone = true;
      MenuEntryIndex++;
    }
    renderMenu(Basename, MenuNumber, arrayL, arrayR, (MenuNumber==1), (MenuEntryIndex>=MenuEntries.length), "renderMenuSection();");
  }
  else window.setTimeout("renderChapterMenus();", 0);
}

function getSubFilePath(parent, subpath) {
  var infile = parent.clone();
  var pth = subpath.split("/");
  for (var i=0; i<pth.length; i++) {infile.append(pth[i]);}
  if (infile.exists()) return infile.path;
  else return "";
}

function renderMenu(menubase, menunumber, listArrayL, listArrayR, isFirstMenu, isLastMenu, returnFun) {
  if (listArrayL.length>8 || listArrayR.length>8) {
    jsdump("ERROR: Too many headings for menu page: " + menuname);
    return;
  }
  
  var menuname = menubase + "-m" + menunumber;
  var prevmenu = menubase + "-m" + String(menunumber-1);
  var nextmenu = menubase + "-m" + String(menunumber+1);
  
  const TL=0, TR=1, BR=2, BL=3;
  const locnames = ["topleft", "topright", "bottomright", "bottomleft"];
  const locnamesT = ["topleftT", "toprightT", "bottomrightT", "bottomleftT"];
  var names = [null, null, null, null];
  var targets = [null, null, (isLastMenu ? "":nextmenu), (isFirstMenu ? (menubase=="toc" ? "":"toc-1"):prevmenu)];
  for (var i=0; i<locnames.length; i++) {
    var val;
    val = getLocaleString(MenuType + locnames[i]);
    if (val!==0) names[i] = val;
    val = getLocaleString(MenuType + String(menunumber) + locnames[i]);
    if (val!==0) names[i] = val;
    val = getLocaleString(MenuType + locnamesT[i]);
    if (val!==0) targets[i] = val;
    val = getLocaleString(MenuType + String(menunumber) + locnamesT[i]);
    if (val!==0) targets[i] = val;
    
    var bk = getLocaleString(menubase);
    if (bk && names[i]) names[i] = names[i].replace("%BOOK%", bk, "g");
  }
  
  // page 1 & 2 headers
  var mdoc = RenderFrame.contentDocument;
  writeHeader(names[TL], "p1head");
  writeHeader(names[TR], "p2head");
  
  // page 1 button list
  mdoc.getElementById("artwork").style.visibility = "hidden";
  if (listArrayL.length) writeButtonList(listArrayL, menuname, true, mdoc);
  else {
    for (var i=0; i<8; i++) {mdoc.getElementById("p1b" + String(i+1)).innerHTML = "";}
    var artwork = getSubFilePath(UIfile[INDIR], menubase + "-m" + menunumber + ".png");
    if (artwork) {
      mdoc.getElementById("artwork").src = "File://" + artwork;
      mdoc.getElementById("artwork").style.visibility = "visible";
    }
  }
  
  // page 1 footers
  mdoc.getElementById("p1foot").innerHTML = names[BL];
  var btype = (names[BL] && targets[BL] ? "underline":"normal");
  mdoc.getElementById("p1footimg").style.visibility = (btype=="normal" && targets[BL] ? "visible":"hidden");  
  write2File(MenusFile, formatMenuString(menuname, 8, true, targets[BL], btype), true);  
  
  // page 2 button list
  writeButtonList(listArrayR, menuname, false, mdoc);
  
  // page 2 footers
  mdoc.getElementById("p2foot").innerHTML = names[BR];
  btype = (names[BR] && targets[BR] ? "underline":"normal");
  mdoc.getElementById("p2footimg").style.visibility = (btype=="normal" && targets[BR] ? "visible":"hidden");
  
  write2File(MenusFile, formatMenuString(menuname, 8, false, targets[BR], btype), true); 

  window.setTimeout("captureImage('', '" + menuname + "', '" + returnFun + "');", 500);
}

function writeButtonList(listArray, menuname, isLeft, doc) {
  var offset = (MenuType=="TOC" ? Math.floor(0.5*(8-listArray.length)):0);
  for (var i=0; i<8; i++) {
    var aClass = "button";
    var aLabel = "";
    var aTarget = "";
    var ia = i-offset;
    if (ia>=0 && listArray[ia]) {
      if (listArray[ia].className) aClass += " " + listArray[ia].className;
      if (listArray[ia].label) aLabel = listArray[ia].label;
      if (listArray[ia].target) aTarget = listArray[ia].target;
    }
    var id = (isLeft ? "p1b":"p2b");
    doc.getElementById(id + String(i+1)).className = aClass;
    doc.getElementById(id + String(i+1)).innerHTML = aLabel;
    if (doc.getElementById(id + String(i+1)).className.search(/(^|\s)hasAudio(\s|$)/)!=-1)
          doc.getElementById(id + String(i+1)).innerHTML += "<img src=\"File://" + getSubFilePath(ExtDir, AUDIOICON) + "\" style=\"-moz-margin-start:12px;\" >";
    write2File(MenusFile, formatMenuString(menuname, i, isLeft, aTarget), true);
  }
}

function formatMenuString(name, row, isLeft, target, type) {
  return name + ".button-" + String(row+(isLeft ? 1:10)) + (target ? ", " + target + (type ? ", " + type:""):"") + "\n"
}

// Adjust page header to fit inside HEADMAX width.
var Headers = {};
function writeHeader(text, elemid) {
  const HEADWMAX = 220;
  const DEFFONTSIZE = 24;
  
  var elem = RenderFrame.contentDocument.getElementById(elemid);
  var fs = DEFFONTSIZE;
  var b = (elem.id=="p1head" ? -2:-0);
  elem.innerHTML = "<span style=\"position:relative; bottom:" + b + "px; font-size:" + fs + "px;\" >" + text + "</span>";
  var wt = elem.firstChild;
  if (wt.offsetWidth > HEADWMAX) {
    fs -= 2;
    b -= 2;
  }
  while (wt.offsetWidth > HEADWMAX) {
    fs--;
    b--;
    elem.innerHTML = "<span style=\"position:relative; bottom:" + b + "px; font-size:" + fs + "px;\" >" + text + "</span>";
    Headers[text] = elem.innerHTML;
    wt = elem.firstChild;
  }
  //elem.innerHTML = text;
}

var StartingBindex = 0;
function renderAllPages() {
  RenderNext.removeAttribute("oncommand");
  RenderNext.setAttribute("oncommand", "rendernext()");
  if (ButtonId == "rendernext") {
    RunPause.label = "Continue";
    RunPause.removeAttribute("oncommand");
    RunPause.setAttribute("oncommand", "resume();");
    Paused = true;
  }
  else {
    RunPause.label = "Pause";
    RunPause.removeAttribute("oncommand");
    RunPause.setAttribute("oncommand", "pause();");
    RenderNext.disabled = true;
    Paused = false;
  }

  jsdump("Fitting pages...");
  // Open a window to render to
  ContinueFunc = "renderNewScreen();";
  Bindex = StartingBindex;
  initBookGlobals();
  if (!Paused) renderNewScreen();
}

function initBookGlobals(skipIntroduction) {
  Page = {passage:"", beg:0, end:0, complete:false, pagenumber:1, isNotes:false, topSplitTag:null, bottomSplitTag:null, newChapterVTinfo:null};
  ILastPage = 0;
  
  var intro = getPassage(Book[Bindex].shortName, true);
  if (!intro || skipIntroduction) {
    Chapter = 1;
    Page.passage = getPassage(Book[Bindex].shortName);
  }
  else {
    Chapter = 0;
    Page.passage = intro;
  }
  logmsg("Rendering Pages for Book:" + Book[Bindex].shortName + "...");
}

var AfterDrawCompleteFunc;
var DoneDrawing;
function renderNewScreen() {
//jsdump("Starting fit:" + Book[Bindex].shortName + " " + Chapter + ", s=" + Page.beg + ", e=" + Page.end);
  
  var mdoc = RenderFrame.contentDocument;
  mdoc.getElementById("imagePageLeft").style.visibility = "hidden";
  mdoc.getElementById("imagePageRight").style.visibility = "hidden";
  var skipPage1 = false;
  var skipPage2 = false;
  var artwork;
  if (Page.pagenumber==1 && Chapter==1) artwork = getSubFilePath(UIfile[INDIR], Book[Bindex].shortName + "-1" + ".png");
  if (artwork) {
    skipPage1 = true;
    mdoc.getElementById("imagePageLeft").src = "File://" + artwork;
    mdoc.getElementById("imagePageLeft").style.visibility = "visible";
  }
  
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, Page, false, skipPage1, skipPage2);
//window.alert("STOPPING");
//window.close(); 
  AfterDrawCompleteFunc = screenDrawComplete;
  window.setTimeout("afterDrawComplete();", 200);
//jsdump("Finished fit left:" + RenderFrame.contentDocument.defaultView.Page1.innerHTML);
//jsdump("Finished fit right:" + RenderFrame.contentDocument.defaultView.Page2.innerHTML);
}

function afterDrawComplete() {
  if (DoneDrawing) window.setTimeout(AfterDrawCompleteFunc, 200);
  else {
    //window.alert("Waiting");
    window.setTimeout("afterDrawComplete()", 200);
  }
}


function screenDrawComplete() {
  var newchap = saveScreenImage(Book[Bindex].shortName, Chapter, Page.pagenumber, Page.passage.substring(ILastPage, Page.end));
  ILastPage = Page.end;
  if (newchap != Chapter) { 
    Chapter = newchap;
    Page.pagenumber = 1; // needs increment below!
  }
  if (Page.complete) {
    if (Chapter == 0) {
      initBookGlobals(true);
    }
    else {
      writeFootnotesToFile(Book[Bindex].shortName);
      Bindex++;
      if (Bindex == Book.length || !Book[Bindex]) {
        startFootnoteGeneration();
        return;
      }
      initBookGlobals()
    }
  }
  else {Page.pagenumber++;}
  
  if (!Paused) renderNewScreen();
}

function getPassage(book, getIntro, getFootnotes) {
  var abook = UIfile[INDIR].clone();
  abook.append(HTMLDIR);
  if (getIntro) abook.append(book + ".intr.html");
  else if (getFootnotes) abook.append(book + ".fn.html");
  else abook.append(book + ".html");
  if (!abook.exists()) return null;
  var fc = readFile(abook);
  return (fc ? stripHeaderFooter(fc):"");
}

function stripHeaderFooter(html) {
  html = html.replace(/^<!DOCTYPE HTML PUBLIC.*?\n/, "");
  html = html.replace(/\n<\/div><\/div><\/body><\/html>\s*$/, "", "m") + "\n";
  return html;
}

function saveScreenImage(book, chapter, pagenumber, screentext) {
//jsdump("Processing:" + book + " to " + Page.beg + " of " + Page.passage.length);
//logmsg(book + "-" + chapter + "-" + pagenumber + " = " + screentext);

  var footNotesSaved = false;
  var imgfile = null;
  var renderImages = !document.getElementById("images").checked;
  var basename = book + "-" + chapter + "-" + pagenumber;
  var hasAudio1 = hasAudio(book, chapter);
  var hasChapterText = saveStats(basename, book, chapter, pagenumber, screentext, hasAudio1);
  if (hasChapterText) {
    if (renderImages) imgfile = captureImage(book, basename);
    saveFootnotes(book, basename, screentext);
    footNotesSaved = true;
  }
  
  var newchaps = screentext.match(/(<span name="chapter\.\d+"><\/span>)/ig);
  if (newchaps) {
    // Not sure why this shouldn't be i=1 since normally i=0 is the whole thing and i=1+ are matches... ?
    for (var i=0; i<newchaps.length; i++) {
      chapter = Number(newchaps[i].match(/<span name="chapter\.(\d+)"><\/span>/)[1]);
      if (chapter < 2) continue; // Would have already been written
      basename = book + "-" + chapter + "-1";
      var hasAudio2 = hasAudio(book, chapter);
      // if hasChapterText && !hasAudio2 then this page has already been captured and does not need to be captured again.
      if ((hasChapterText && !hasAudio2) || !saveStats(basename, book, chapter, 1, screentext, hasAudio2)) continue;
      if (!footNotesSaved) {
        saveFootnotes(book, basename, screentext);
        footNotesSaved = true;
      }
      if (!renderImages) continue;
      hasAudio1 = (hasAudio1 ? true:false);
      hasAudio2 = (hasAudio2 ? true:false);
      if (!imgfile || hasAudio1 != hasAudio2) imgfile = captureImage(book, basename);
      else imgfile.copyTo(null, basename + "." + imgfile.leafName.match(/\.(.*)$/)[1]);
    }
  }
  
  return chapter;
}

var AudioChapters;
var CheckAudioChapters = {};
function hasAudio(book, chapter) {
  if (document.getElementById("noaudio").checked) return null;
  if (!AudioChapters) {
    AudioChapters = {};
    var audiodir = UIfile[AUDIO].clone();
    var files = audiodir.directoryEntries;
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
      var parts = file.leafName.match(/^([^-]+)-([^-]+)-(\d+)(-(\d+))?\.ac3$/);
      if (!parts || parts[1]!=getLocaleString("AudioPrefix")) {
        logmsg("WARNING: Could not parse audio file name \"" + file.leafName + "\"");
        continue;
      }
      var endc = (parts[4] ? Number(parts[5]):Number(parts[3]));
      for (var c=Number(parts[3]); c<=endc; c++) {
        AudioChapters[parts[2] + "-" + c] = file.leafName;
        CheckAudioChapters[parts[2] + "-" + c] = file.leafName;
      }
    }
  }
  
  return (AudioChapters[book + "-" + chapter] ? AudioChapters[book + "-" + chapter]:null);
}

function captureImage(subfolder, imageName, returnFun) {
  var capture = ExtDir.clone();
  capture.append(SCRIPT);
  
  var imgman = capture.clone();
  imageName += ".jpg";
  capture.append(CAPTURE);
      
  var imgfile = UIfile[OUTDIR].clone();
  imgfile.append(IMGDIR);
  if (subfolder) {
   imgfile.append(subfolder);
   if (!imgfile.exists()) imgfile.create(imgfile.DIRECTORY_TYPE, 0777);
  }
  imgfile.append(imageName);
  
  var process = Components.classes["@mozilla.org/process/util;1"]
                    .createInstance(Components.interfaces.nsIProcess);
  // Capture image...
  process.init(capture);
  var args = [imgfile.path, "-window word-dvd", "-crop " + PAL.W + "x" + PAL.H + "+0+0"];
  process.run(true, args, args.length);
  
  if (returnFun) window.setTimeout(returnFun, 0);
  return imgfile;
}

var ChapterStats = [];
function saveStats(imgname, book, chapter, pagenumber, screentext, hasAudio) {
  var hasChapterText = false;
  var beg = screentext.indexOf("<span name=\"chapter." + chapter + "\"></span>");
  if (beg==-1) beg=0;
  var end = screentext.indexOf("<span name=\"chapter." + Number(chapter+1) + "\"></span>");
  if (end==-1) end=screentext.length;
  var info = new Object();
  calculateReadingLength(info, screentext.substring(beg, end), getLocaleString("LangCode"), book, chapter);
  if (info.len>=1) {
    if (screentext.substring(beg, end).search("class=\"majorquote\"") != -1) logmsg("Found class=\"majorquote\" on " + imgname);
    hasChapterText = true;
    info["name"] = imgname;
    var lastVerse = screentext.substring(beg, end);
    var lvi = lastVerse.lastIndexOf("<sup>");
    if (lvi != -1) {
    lastVerse = lastVerse.substr(lvi);
      var re = new RegExp("<sup>\\s*(\\d+)([\\s-]+\\d+)?\\s*<\/sup>(.*)");
      if (lastVerse) lastVerse = lastVerse.match(re);
      if (!lastVerse) {
        logmsg("WARNING: Could not add transition to listing \"" + imgname + "\"");
        info["trans"] = "unknown\n";
      }
      else info["trans"] = imgname + "," + book + "-" + chapter + ":" + lastVerse[1] + ",{" + lastVerse[3] + "}\n";
    }
    else info["trans"] = "last_page\n";
    
    var prop = "vt_" + book + "_" + chapter;
    if (VerseTiming[prop]) {
      for (var i=0; i<VerseTiming[prop].length; i++) {
        if (VerseTiming[prop][i]) appendVerseTimingInfo(i, screentext, beg, end, info, VerseTiming[prop]);        
      }
    }
    ChapterStats.push(info);
  }
  if (Page.complete || end!=screentext.length) {
    var total = 0;
    var statstring = "";
    var transtring = "";
    for (var i=0; i<ChapterStats.length; i++) {total += ChapterStats[i].len;}
    for (i=0; i<ChapterStats.length; i++) {
      statstring += formatStatString(ChapterStats[i], total, hasAudio);
      if (hasAudio && ChapterStats[i].a) statstring += formatStatString(ChapterStats[i].a, total, hasAudio);
      if (hasAudio && ChapterStats[i].b) statstring += formatStatString(ChapterStats[i].b, total, hasAudio);
      transtring += ChapterStats[i].trans;
    }
    var file = StatsFile.clone();
    file.append(book + ".csv");
    if (!file.exists()) write2File(file, "#Page,Chapter Fraction,Audio File,Number of Titles,Chapter Length,Absolute Time\n", true);
    else if (file.exists() && (chapter == 0 || (chapter == 1 && !getPassage(book, true)))) {
      file.remove(false);
      write2File(file, "#Page,Chapter Fraction,Audio File,Number of Titles,Chapter Length,Absolute Time\n", true);
    }
    write2File(file, statstring, true);
    
    file = TransFile.clone();
    file.append(book + "-trans.csv");
    if (!file.exists()) write2File(file, "#Page,Verse,Transition\n", true);
    if (file.exists() && (chapter == 0 || (chapter == 1 && !getPassage(book, true)))) {
      file.remove(false);
      write2File(file, "#Page,Verse,Transition Location\n", true);
    }
    write2File(file, transtring, true);
    
    ChapterStats = [];
    CheckAudioChapters[book + "-" + chapter] = "";
  }
  return hasChapterText;
}

function formatStatString(s, total, hasAudio) {
  var rellen = Number(Math.round(10000000*s.len/total)/10000000);
  return s.name + ", " + rellen + ", " + (hasAudio ? hasAudio:"still") + ", " + s.numtitles + ", " + s.len + (s.realtime ? ", " + s.realtime:"") + "\n"; 
}

function appendVerseTimingInfo(inst, stxt, beg, end, info, vt) {
  var se = "</sup>";
  var re = new RegExp("<sup>\\s*" + vt[inst].verse + "\\s*[-<]", "im");
  var iverse = stxt.substring(beg, end).search(re);
  if (iverse != -1 && vt[inst].trans) {
    stxt = stxt.substring(0, stxt.indexOf(se, beg+iverse) + se.length) + vt[inst].trans;
    iverse = stxt.length;
    end = stxt.length; 
  }

  if (iverse != -1 && iverse >= beg && iverse <= end) {
    var ni = {};
    calculateReadingLength(ni, stxt.substring(beg, iverse), getLocaleString("LangCode"), vt[inst].book, vt[inst].chapter);
    var subo = "a";                                              
    if (info[subo]) subo = "b";                                 
    info[subo] = {};                                           
    info[subo].name = vt[inst].book + "-" + vt[inst].chapter + ":" + vt[inst].verse;     
    info[subo].realtime = vt[inst].realtime;          
    info[subo].numtitles = ni.numtitles;                  
    info[subo].len = ni.len;                            
    vt[inst] = null;                                                                                                   
  }                           
}

function calculateReadingLength(info, html, lang, book, chapter) {
  
  //Count number of titles in page- used to add natural pause times between sections.
  var numtitles = countDivsClass(html, "title-");
  var incAutoCh = getTimingParam("CountChapterNumbersAsTitle", book, chapter);
  if (incAutoCh && incAutoCh == "true") numtitles += countDivsClass(html, "chapter-title");

  //Remove verse numbers
  var nv = new RegExp(NEWVERSE, "ig");
  html = html.replace(nv, "");

  //Remove titles if they are not read
  var param = getTimingParam("TitlesAreRead", book, chapter);
  if (!param || param != "true") {
    // THIS ASSUMES TITLES DON'T CONTAIN OTHER DIVS!
    var re = new RegExp("<div [^>]*class=\"(" + TITLES + ")\"[^>]*>(.*?)<\/div>", "gi");
    html = html.replace(re, "");
  }

  //Remove chapter titles if they are not read
  if (!incAutoCh || incAutoCh != "true") {
    var re = new RegExp("<div [^>]*class=\"chapter-title\"[^>]*>(.*?)<\/div>", "gi");
    html = html.replace(re, "");
  }

  //Remove remaining tags
  html = html.replace(/<.*?>/gi, "");
  
  //Remove soft hyphens
  html = html.replace(/&shy;/gi, "");
  html = html.replace(/­/g, "");
  
  //Convert &xx; This gives a paragraph a length of 10 chars.
  html = html.replace(/&\S*?;/g, "xx");
  
  //If it's only white space, be sure we always return nothing!
  if (html.match(/^\s*$/)) {html=""; numtitles=0;}
  
  info.len = html.length;
  info.numtitles = numtitles;
//jsdump("READTEXT" + Book[Bindex].shortName + "-" + Chapter + "-" + Page.pagenumber + "(titles=" + info.numtitles + "):>" + html + "<");
}

function countDivsClass(html, aClass) {
  const dstart = "<div class=\"" + aClass;
  const dend = "</div>";
  var i=0;
  var e=0;
  var numdivs = 0;
  while (html.indexOf(dstart, i) > 0) {
    i = html.indexOf(dstart, i) + dstart.length;        
    if (e==0 || i-e > 64) numdivs++; // sequential titles are counted as 1
    e = html.indexOf(dend, i) + dend.length;
  }
  return numdivs;
}

function getTimingParam(name, book, chapter) {
  var loc = getPageTimingString(name + "_" + book + "_" + chapter);
  if (loc) return loc;
  loc = getPageTimingString(name + "_" + book);
  if (loc) return loc;
  var t = getTestament(book);
  if (t && t == "NT") loc = getPageTimingString(name + "_NT");
  if (t && t == "OT") loc = getPageTimingString(name + "_OT");
  if (loc) return loc;
  loc = getPageTimingString(name);
  if (loc) return loc;
  return getPageTimingString("Default" + name);
}

var PageWithFootnotes = [];
var FootnoteIndex;
function saveFootnotes(book, basename, screentext) {
  const NOTETXT = NOTESYMBOL + " id=\"note.";
  const NOTELST = NOTESTART + NOTEREF  + " id=\"note.";
  var html = "";
  var i = screentext.indexOf(NOTETXT);
  while (i != -1) {
    i = i + NOTETXT.length;
    var fnum = Number(screentext.substring(i).match(/^(\d+)(\D|$)/)[1]);
    var fn = new  RegExp("(" + NOTELST + fnum + "\".*)\n", "im");
    html += getPassage(book, false, true).match(fn)[1];
    i = screentext.indexOf(NOTETXT, i);
  }
  if (html) {
    PageWithFootnotes.push(new Object());
    PageWithFootnotes[PageWithFootnotes.length-1].name = basename;
    PageWithFootnotes[PageWithFootnotes.length-1].shortName = Book[Bindex].shortName;
    PageWithFootnotes[PageWithFootnotes.length-1].chapter = Chapter;
    PageWithFootnotes[PageWithFootnotes.length-1].html = html;
  }
}

const Ffsep = "]-[";
function writeFootnotesToFile(book) {
  var fffile = UIfile[OUTDIR].clone();
  fffile.append(LISTING);
  fffile.append("tmp");
  if (!fffile.exists()) fffile.create(fffile.DIRECTORY_TYPE, 0777);
  fffile.append(book + ".fn.txt");
  if (fffile.exists()) fffile.remove(false);
  for (var i=0; i<PageWithFootnotes.length; i++) {
    write2File(fffile, Ffsep+ PageWithFootnotes[i].name +Ffsep+ PageWithFootnotes[i].shortName +Ffsep+ PageWithFootnotes[i].chapter +Ffsep+ PageWithFootnotes[i].html + Ffsep + "\n", true);
  }
  PageWithFootnotes = [];
}

function startFootnotes() {
  initFootnotes();
  if (!Paused && PageWithFootnotes[FootnoteIndex]) window.setTimeout("renderNewFNScreen();", 1);
  else stop();
}

function initFootnotes() {
  PageWithFootnotes = [];
  for (var b=0; b<Book.length; b++) {
    var fffile = UIfile[OUTDIR].clone();
    fffile.append(LISTING);
    fffile.append("tmp");
    fffile.append(Book[b].shortName + ".fn.txt");
    if (fffile.exists()) {
      fffile = readFile(fffile);
      fffile = (fffile ? stripHeaderFooter(fffile):"");
      var data = fffile.split(Ffsep);
      for (var i=1; i<data.length; i=i+5) {
        PageWithFootnotes.push(new Object());
        PageWithFootnotes[PageWithFootnotes.length-1].name = data[i];
        PageWithFootnotes[PageWithFootnotes.length-1].shortName = data[i+1];
        PageWithFootnotes[PageWithFootnotes.length-1].chapter = data[i+2];
        PageWithFootnotes[PageWithFootnotes.length-1].html = data[i+3];
      }
    }
  }
  
  FootnoteIndex = 0;
  IsFirstFN = true;
  Prepender = "";
  ContinueFunc = "renderNewFNScreen();";
  LastBindex=0;
  if (PageWithFootnotes[FootnoteIndex])
      logmsg("Rendering Footnotes for Book:" + PageWithFootnotes[FootnoteIndex].shortName + "...");
}

function getBindexFromBook(shortName) {
  for (var b=0; b<Book.length; b++) {
    if (shortName == Book[b].shortName) return b;
  }
  return -1;
}

var FNPageName;
var ContinuePage;
var IsFirstFN;
var Prepender;
var Norender;
var LastBindex;
// To start with, the passage consists of a single note. If it fits 
// (Page.complete), then another note is added to the passage until
// the passage no longer fits. The second to last try is saved. 
function renderNewFNScreen() {
  Bindex = getBindexFromBook(PageWithFootnotes[FootnoteIndex].shortName);
  Chapter = PageWithFootnotes[FootnoteIndex].chapter;
  if (LastBindex != Bindex) {
    logmsg("Rendering Footnotes for Book:" + Book[Bindex].shortName + "...");
    IsFirstFN=true;
  }
  LastBindex = Bindex;
  
  if (IsFirstFN) {
    Page = {passage:"", beg:0, end:0, complete:false, pagenumber:1, isNotes:false, topSplitTag:null, bottomSplitTag:null, newChapterVTinfo:null};
    IsFirstFN = false;
    FNPageName = PageWithFootnotes[FootnoteIndex].name;
    Page.passage = Prepender + PageWithFootnotes[FootnoteIndex].html;
    Prepender = "";
    ContinuePage = true;
    Norender = false;
  }
  if (!ContinuePage) {
    Page.beg = 0;
    Page.end = 0;
    Page.complete = false;
    Page.topSplitTag = "";
    Page.bottomSplitTag = "";
    Page.passage += PageWithFootnotes[FootnoteIndex].html;
  }

  var tstart = Page.end;
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, Page, false, false, false);

  // couldn't fit this last page, so start new page with it...
  if (!ContinuePage && !Page.complete) {
    IsFirstFN = true;
    renderNewFNScreen();
    return;
  }
  
  // page fits...
  else if (Page.complete) {
    ContinuePage = false;
    // if this was a continued page, delete last image and attach it's text to next...
    if (Page.pagenumber > 1 && (FootnoteIndex+1) < PageWithFootnotes.length && PageWithFootnotes[FootnoteIndex+1].shortName==Book[Bindex].shortName) {
      IsFirstFN = true;
      Norender = true;
      Prepender = Page.passage.substring(tstart);
    }
  }
  
  // continuing page but not complete = do nothing
  AfterDrawCompleteFunc = saveFNImage;
  window.setTimeout("afterDrawComplete();", 0);
}

function saveFNImage() {
  var renderImages = !document.getElementById("images").checked;
  var basename = "fn-" + FNPageName + "-" + Page.pagenumber;
  
  if (renderImages && !Norender) captureImage(PageWithFootnotes[FootnoteIndex].shortName, basename);
  Norender = false;
  
  if (ContinuePage) Page.pagenumber++;
  else FootnoteIndex++;

  if (FootnoteIndex < PageWithFootnotes.length) {
    if (!Paused) renderNewFNScreen();
  }
  else stop();
}

function pad(num, book) {
  var digs=2;
  if (book && book=="Ps") digs=3;
  var str = String(num);
  var padding = "0000000000";
  padding = padding.substr(0,digs);
  str = padding.substr(0, padding.length-str.length) + str;
  return str;
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
  window.setTimeout(ContinueFunc, 0);
}

function rendernext() {
  Paused = true;
  renderNewScreen();
}

function stop() {
  var date = new Date();
  var unUtilizedAudio = "";
  for each (files in CheckAudioChapters) {
    if (files.match(/^\s*$/)) {continue;}
    unUtilizedAudio += files + "\n";
  }
  if (unUtilizedAudio) logmsg("Unutilized audio file(s):\n" + unUtilizedAudio);
  for (var vt in VerseTiming) {
    for (var i=0; i<VerseTiming[vt].length; i++) {
      if (VerseTiming[vt][i]) logmsg("WARNING: Did not calculate " + PAGETIMING + " data: " + VerseTiming[vt][i].entry);
    }
  }
  logmsg("Finishing Word-DVD imager at " + date.toTimeString() + " " + date.toDateString());
  if (document.getElementById("runword-dvd").checked) {
    var process = Components.classes["@mozilla.org/process/util;1"]
                      .createInstance(Components.interfaces.nsIProcess);                        
    var file = UIfile[OUTDIR].clone();
    file.append(SCRIPT);
    var rundir = file.path;
    file.append(RUNWORDDVD);
    process.init(file);
    var args = [rundir];
    process.run(true, args, args.length);
    window.alert("Finished Creating DVD!");
  }
  else window.alert("Finished!");

  window.close();
  //RenderNext.disabled = true;
  //RunPause.disabled = true;
}

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

function getPageTimingString(name) {
  var re = new RegExp("^\\s*" + name + "\\s*=[\t ]*([^\\n\\r]*)[\t ]*[\\n\\r]", "m");
  var res = PageTiming.match(re);  
  return (res ? res[1]:0);
}

function getTestament(book) {
  var OTBKS = "Gen;Exod;Lev;Num;Deut;Josh;Judg;Ruth;1Sam;2Sam;1Kgs;2Kgs;1Chr;2Chr;Ezra;Neh;Esth;Job;Ps;Prov;Eccl;Song;Isa;Jer;Lam;Ezek;Dan;Hos;Joel;Amos;Obad;Jonah;Mic;Nah;Hab;Zeph;Hag;Zech;Mal;";
  var NTBKS = "Matt;Mark;Luke;John;Acts;Jas;1Pet;2Pet;1John;2John;3John;Jude;Rom;1Cor;2Cor;Gal;Eph;Phil;Col;1Thess;2Thess;1Tim;2Tim;Titus;Phlm;Heb;Rev;";
  var re = new RegExp("(^|;)" + book + ";", "i");
  if (OTBKS.search(re)!=-1) return "OT";
  if (NTBKS.search(re)!=-1) return "NT";
  logmsg("WARNING: Unknown testament for " + book);
  return "";
}

function unloadXUL() {
  for (var i=0; i<NUMINPUTS; i++) {
    if (!UIfile[i]) continue;
    prefs.setComplexValue("File-" + i, Components.interfaces.nsILocalFile, UIfile[i]);
  }
  
  prefs.setBoolPref("noaudio", document.getElementById("noaudio").checked);
}
