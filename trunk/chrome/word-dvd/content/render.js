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
 * Main Program Functions
 ***********************************************************************/ 
const APPROXLINE = 24;
const APPNUMLINE = 12;
const PARSTART = "<br><span class=\"paragraph-start\"></span>";
const NOTESTART = "<div class=\"footnote\">";
const NOTEREF  = "<span class=\"verseref\"";
const NOTESYMBOL = "<span class=\"fnsymbol\"";
const PAGEBREAK = "<span class=\"pagebreak\"></span>";
const NEWVERSE = "<sup>[\\d\\s-]+<\/sup>";
const SPLITABLEDIVS = "majorquote|list1|list2|list3|footnote|canonical|x-list-1|x-list-2|x-enumlist-1|x-enumlist-2|x-enumlist-3";
const TITLES = "title-1|title-2|book-title|chapter-title|text-header|menu-header";

var RenderFrame, MainWin;
var ILastPage;
var ContinueFunc;
var MenusFile;
var StartingBindex;
var Book, Bindex, Chapter, Page;

function loadedRender() {
  MainWin = window.opener;
  Book = MainWin.Book;
  StartingBindex = MainWin.StartingBindex;
  RenderFrame = document.getElementById("render");
  
  RenderFrame.style.width = MainWin.PAL.W + "px";
  RenderFrame.style.height = String(MainWin.PAL.H + 16) + "px";
  window.setTimeout("postLoad1();", 0);
} function postLoad1() {
  window.resizeTo(RenderFrame.boxObject.width, document.getElementById("body").boxObject.height);
  window.setTimeout("startMenuGeneration();", 0);
}

function startMenuGeneration() {
  if (!MainWin.document.getElementById("skipmenus").checked) {
    MainWin.logmsg("Generating Menus...");
  
    // REMOVE MENU INFO FILE
    MenusFile = MainWin.UIfile[MainWin.OUTDIR].clone();
    MenusFile.append(MainWin.LISTING);
    MenusFile.append(MainWin.MENUSFILE);
    if (MenusFile.exists()) MenusFile.remove(false);
    MainWin.write2File(MenusFile, "#Button,Target,Type\n"); 
    
    // CREATE TABLE OF CONTENTS
    MenuEntries = [];
    for (var b=0; b<Book.length; b++) {
      MenuEntries.push(new Object());
      MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString(Book[b].shortName);
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
    Bindex = 0;
    MenuType="TOC";
    Basename = "toc";
    MainWin.logmsg("Rendering TOC Menu(s)...");
    window.setTimeout("renderMenuSection();", 0);
  }
  else {
    MainWin.logmsg("Skipped menu generation.");
    startTextGeneration();
  }
}

function startTextGeneration() {
  // switch from menu to text background
  RenderFrame.contentDocument.defaultView.InitComplete = false;
  RenderFrame.contentDocument.defaultView.location.assign("chrome://word-dvd/content/web/text.html");
  FrameInitInterval = window.setInterval("checkFrameInitComplete();", 100);
  FrameInitFunction = startTextGeneration2;
  
} function startTextGeneration2() {
  if (!MainWin.document.getElementById("skiptext").checked) {
    readPageTiming();
    MainWin.logmsg("Generating Text Pages...");
    window.setTimeout("renderAllPages();", 0);
  }
  else {
    MainWin.logmsg("Skipped Text generation.");
    window.setTimeout("startFootnoteGeneration();", 0);  
  }
}

function startFootnoteGeneration() {
  if (!MainWin.document.getElementById("skipfootnotes").checked) {
    MainWin.logmsg("Generating Footnote Pages...");
    window.setTimeout("startFootnotes();", 0);
  }
  else {
    MainWin.logmsg("Skipped Footnote generation.");
    MainWin.stop();
  }
}

function startFootnotes() {
  initFootnotes();
  if (PageWithFootnotes[FootnoteIndex]) {
    if (MainWin.Aborted) return;
    else if (!MainWin.Paused) window.setTimeout("renderNewFNScreen();", 1);
    else ContinueFunc = "renderNewFNScreen();";
  }
  else MainWin.stop();
}

var VerseTiming = {};
var PageTiming;
function readPageTiming() {
  var ptf = MainWin.UIfile[MainWin.INDIR].clone();
  ptf.append(MainWin.PAGETIMING);
  if (ptf.exists()) {
    PageTiming = MainWin.readFile(ptf);
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

var MenuEntries, MenuEntryIndex, MenuNumber, MenuType, Basename;
function renderMenuSection() {
  if (MenuEntryIndex<MenuEntries.length) {
    MenuNumber++;
    var arrayL = [];
    var arrayR = [];
    var haveart = getSubFilePath(MainWin.UIfile[MainWin.INDIR], MainWin.ARTWORK + "/" + Basename + "-m" + MenuNumber + ".png");
    var doneLeft = false;
    var doneRight = false;
    for (var r=1; r<=16; r++) {
      if (!MainWin.getLocaleString(MenuType + String(MenuNumber) + "button" + r)) continue;
      if (r <= 8) doneLeft = true;
      else doneRight = true;
    }
    for (var r=1; r<=16; r++) {
      var label = MainWin.getLocaleString(MenuType + String(MenuNumber) + "button" + r); 
      var target = MainWin.getLocaleString(MenuType + String(MenuNumber) + "button" + r + "T");
      if (label && !target || !label && target) {
        MainWin.logmsg("ERROR: Skipping button " + label + ", no label or target found!");
        label = "";
        target = "";
      } 
      var nobj = {label:label, target:target, className:"custombutton"};
      if (r <= 8 && doneLeft) arrayL.push(nobj);
      else if (r > 8 && doneRight) arrayR.push(nobj);
    }
    if (doneLeft && haveart) MainWin.logmsg("Error: artwork/button conflict on " + Basename + "-m" + MenuNumber);
    var pagedone = false;
    for (var r=1; r<=16; r++) {
      if (r == 9) pagedone=false;
      if (r <= 8 && doneLeft || r > 8 && doneRight) continue;
      if (haveart && r <= 8 || pagedone || !MenuEntries[MenuEntryIndex]) continue;
      if (r <= 8) arrayL.push(MenuEntries[MenuEntryIndex]);
      else arrayR.push(MenuEntries[MenuEntryIndex]);
      if (MenuEntries[MenuEntryIndex] && MainWin.getLocaleString(MenuType + String(MenuNumber) + (r <= 8 ? "left":"right") + "last")==MenuEntries[MenuEntryIndex].label) pagedone = true;
      MenuEntryIndex++;
    }
    renderMenu(Basename, MenuNumber, arrayL, arrayR, (MenuNumber==1), (MenuEntryIndex>=MenuEntries.length), "renderMenuSection();");
  }
  else window.setTimeout("renderChapterMenus();", 0);
}

function renderChapterMenus() {
  if (Bindex < Book.length) {
    var intro = getPassage(Book[Bindex].shortName, true);
    if (Book[Bindex].maxChapter>1 || intro) {
      MenuEntries = [];
      for (var c=0; c<=Book[Bindex].maxChapter; c++) {
        if (c==0 && !intro) continue;
        MenuEntries.push(new Object());
        if (c>0) MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString("Chaptext", c, Book[Bindex].shortName);
        else MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString("IntroLink");
        MenuEntries[MenuEntries.length-1].target = Book[Bindex].shortName + "-" + c;
        MenuEntries[MenuEntries.length-1].className = "";
      }
      MenuEntryIndex = 0;
      MenuNumber = 0;
      MenuType = "CHP";
      Basename = Book[Bindex].shortName;
      MainWin.logmsg("Rendering Chapter Menu(s):" + Basename + "...");
      window.setTimeout("renderMenuSection();", 0);
      Bindex++;
    }
    else {
      Bindex++;
      window.setTimeout("renderMenuSection();", 0);
    }
  }
  else window.setTimeout("startTextGeneration();", 0);
}

var MenuHeaders = {};
function renderMenu(menubase, menunumber, listArrayL, listArrayR, isFirstMenu, isLastMenu, returnFun) {
  if (listArrayL.length>8 || listArrayR.length>8) {
    MainWin.jsdump("ERROR: Too many headings for menu page: " + menuname);
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
    val = MainWin.getLocaleString(MenuType + locnames[i]);
    if (val!==0) names[i] = val;
    val = MainWin.getLocaleString(MenuType + String(menunumber) + locnames[i]);
    if (val!==0) names[i] = val;
    val = MainWin.getLocaleString(MenuType + locnamesT[i]);
    if (val!==0) targets[i] = val;
    val = MainWin.getLocaleString(MenuType + String(menunumber) + locnamesT[i]);
    if (val!==0) targets[i] = val;
    
    var bk = MainWin.getLocaleString(menubase);
    if (bk && names[i]) names[i] = names[i].replace("%BOOK%", bk, "g");
  }
  
  // page 1 & 2 headers
  var mdoc = RenderFrame.contentDocument;
  applyHeader(names[TL], RenderFrame.contentDocument.getElementById("menu-header-left"), MenuHeaders);
  applyHeader(names[TR], RenderFrame.contentDocument.getElementById("menu-header-right"), MenuHeaders);
  
  // page 1 button list
  mdoc.getElementById("menu-image-left").style.visibility = "hidden";
  if (listArrayL.length) writeButtonList(listArrayL, menuname, true, mdoc);
  else {
    for (var i=0; i<8; i++) {mdoc.getElementById("p1b" + String(i+1)).innerHTML = "";}
    var artwork = getSubFilePath(MainWin.UIfile[MainWin.INDIR], MainWin.ARTWORK + "/" + menubase + "-m" + menunumber + ".png");
    if (artwork) {
      mdoc.getElementById("menu-image-left").src = "File://" + artwork;
      mdoc.getElementById("menu-image-left").style.visibility = "visible";
    }
  }
  
  // page 1 footers
  mdoc.getElementById("menu-footer-left").innerHTML = names[BL];
  var btype = (names[BL] && targets[BL] ? "underline":"normal");
  mdoc.getElementById("menu-button-left").style.visibility = (btype=="normal" && targets[BL] ? "visible":"hidden");  
  MainWin.write2File(MenusFile, formatMenuString(menuname, 8, true, targets[BL], btype), true);  
  
  // page 2 button list
  writeButtonList(listArrayR, menuname, false, mdoc);
  
  // page 2 footers
  mdoc.getElementById("menu-footer-right").innerHTML = names[BR];
  btype = (names[BR] && targets[BR] ? "underline":"normal");
  mdoc.getElementById("menu-button-right").style.visibility = (btype=="normal" && targets[BR] ? "visible":"hidden");
  
  MainWin.write2File(MenusFile, formatMenuString(menuname, 8, false, targets[BR], btype), true); 

  mdoc.defaultView.RenderDone = false;
  window.setTimeout("RenderFrame.contentDocument.defaultView.setTimeout('RenderDone = true;', " + MainWin.WAIT+ ");", 0);
  
  if (MainWin.Aborted) return;
  else if (!MainWin.Paused) waitRenderWinThenDo("captureImage('', '" + menuname + "', '" + returnFun + "');");
  else ContinueFunc = "captureImage('', '" + menuname + "', '" + returnFun + "');";
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
          doc.getElementById(id + String(i+1)).innerHTML += "<img src=\"file://" + MainWin.UIfile[MainWin.INDIR].path + "/" + MainWin.RESOURCE + "/" + MainWin.AUDIOICON + "\" style=\"-moz-margin-start:12px;\" >";
    MainWin.write2File(MenusFile, formatMenuString(menuname, i, isLeft, aTarget), true);
  }
}

function formatMenuString(name, row, isLeft, target, type) {
  return name + ".button-" + String(row+(isLeft ? 1:10)) + (target ? ", " + target + (type ? ", " + type:""):"") + "\n"
}

// Adjust page header to fit inside max-width.
function applyHeader(text, elem, cache) {
  elem.innerHTML = "<div><span>" + text + "</span></div>";
  elem.style.maxWidth = ""; // clear so we get stylesheet CSS
  elem.style.width = "";
  var save = null;
  var maxw = elem.ownerDocument;
  if (maxw) {
    maxw = maxw.defaultView.getComputedStyle(elem, null);
    maxw = maxw.maxWidth;
    if (maxw) {
      maxw = maxw.match(/^(\d+)\s*px$/);
      if (maxw && maxw[1]) {
        maxw = Number(maxw[1]);
        elem.style.maxWidth = "999px";
        elem.style.width = "100%";
        if (cache[text]) elem.innerHTML = cache[text];
        else {
          elem.innerHTML = "<div><span style=\"font-size:100%;\" >" + text + "</span></div>";
          save = elem.style.overflow;
          elem.style.overflow = "visible";                
          var fs = 100;
          var wt = elem.firstChild;
          while (wt.offsetWidth > maxw) {
            fs -= 5;
            elem.innerHTML = "<div><span style=\"font-size:" + fs + "%;\" >" + text + "</span></div>";
            wt = elem.firstChild;
            cache[text] = elem.innerHTML;
          }
        }
      }
    }
  }
  
  if (save) elem.style.overflow = save;

  //elem.innerHTML = text;
}

function renderAllPages() {
  MainWin.jsdump("Fitting pages...");
  // Open a window to render to
  Bindex = StartingBindex;
  initBookGlobals();
  if (MainWin.Aborted) return;
  else if (!MainWin.Paused) renderNewScreen();
  else ContinueFunc = "renderNewScreen();";
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
  MainWin.logmsg("Rendering Pages for Book:" + Book[Bindex].shortName + "...");
}

function renderNewScreen() {
//MainWin.jsdump("Starting fit:" + Book[Bindex].shortName + " " + Chapter + ", s=" + Page.beg + ", e=" + Page.end);

  ContinueFunc = null;
  var mdoc = RenderFrame.contentDocument;
  mdoc.getElementById("text-image-left").style.visibility = "hidden";
  mdoc.getElementById("text-image-right").style.visibility = "hidden";
  var skipPage1 = false;
  var artwork;
  if (Page.pagenumber==1 && Chapter==1) 
    artwork = getSubFilePath(MainWin.UIfile[MainWin.INDIR], MainWin.ARTWORK + "/" + Book[Bindex].shortName + "-1" + ".png");
  if (artwork) {
    skipPage1 = true;
    mdoc.getElementById("text-image-left").src = "File://" + artwork;
    mdoc.getElementById("text-image-left").style.visibility = "visible";
  }
  var tstyle = mdoc.defaultView.getComputedStyle(mdoc.getElementById("text-page2"), null);
  var skipPage2 = (tstyle.visibility == "hidden"); // this allows single column display by setting text-page2 visibility=hidden
  
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, Page, skipPage1, skipPage2);
  
  waitRenderWinThenDo("screenDrawComplete()");
  
//MainWin.jsdump("Finished fit left:" + RenderFrame.contentDocument.defaultView.Page1.innerHTML);
//MainWin.jsdump("Finished fit right:" + RenderFrame.contentDocument.defaultView.Page2.innerHTML);
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
      writeBookEnd(Bindex);
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
  
  if (MainWin.Aborted) return;
  else if (!MainWin.Paused) renderNewScreen();
  else ContinueFunc = "renderNewScreen();";
}

function getPassage(book, getIntro, getFootnotes) {
  var abook = MainWin.UIfile[MainWin.INDIR].clone();
  abook.append(MainWin.HTMLDIR);
  if (getIntro) abook.append(book + ".intr.html");
  else if (getFootnotes) abook.append(book + ".fn.html");
  else abook.append(book + ".html");
  if (!abook.exists()) return null;
  var fc = MainWin.readFile(abook);
  return (fc ? stripHeaderFooter(fc):"");
}

function stripHeaderFooter(html) {
  html = html.replace(/^<!DOCTYPE HTML PUBLIC.*?\n/, "");
  html = html.replace(/\n<\/div><\/div><\/body><\/html>\s*$/, "", "m") + "\n";
  return html;
}

var ReportedAudioFiles = {};
function saveScreenImage(book, chapter, pagenumber, screentext) {
//MainWin.jsdump("Processing:" + book + " to " + Page.beg + " of " + Page.passage.length);
//MainWin.logmsg(book + "-" + chapter + "-" + pagenumber + " = " + screentext);

  var footNotesSaved = false;
  var imgfile = null;
  var renderImages = !MainWin.document.getElementById("images").checked;
  var basename = book + "-" + chapter + "-" + pagenumber;
  var hasAudio1 = hasAudio(book, chapter);
  var hasChapterText = saveStats(basename, book, chapter, pagenumber, screentext, hasAudio1);
  if (hasChapterText) {
    if (renderImages) imgfile = captureImage(book, basename);
    saveFootnotes(book, basename, screentext);
    footNotesSaved = true;
  }
  
  var newchaps = new RegExp("(" + MainWin.escapeRE(MainWin.NEWCHAPTER) + "\\d+\"><\\/span>)", "ig");
  var newchaps = screentext.match(newchaps);
  if (newchaps) {
    for (var i=0; i<newchaps.length; i++) {
      var chapter = new RegExp(MainWin.escapeRE(MainWin.NEWCHAPTER) + "(\\d+)\"", "i");
      chapter = Number(newchaps[i].match(chapter)[1]);
      if (chapter < 2) continue; // Would have already been written
      basename = book + "-" + chapter + "-1";
      var hasAudio2 = hasAudio(book, chapter);
      // if hasChapterText && !hasAudio2 then this page has been captured once and does not need to be captured again.
      if ((hasChapterText && !hasAudio2) || !saveStats(basename, book, chapter, 1, screentext, hasAudio2)) continue;
      if (!footNotesSaved) {
        saveFootnotes(book, basename, screentext);
        footNotesSaved = true;
      }
      if (!renderImages) continue;
      var ha1 = (hasAudio1 ? true:false);
      var ha2 = (hasAudio2 ? true:false);
      if (!imgfile || ha1 != ha2) imgfile = captureImage(book, basename);
      else imgfile.copyTo(null, basename + "." + imgfile.leafName.match(/\.(.*)$/)[1]);
    }
  }
  if (hasAudio1 && !ReportedAudioFiles[hasAudio1]) {
    MainWin.logmsg("Utilizing audio file: " + hasAudio1);
    ReportedAudioFiles[hasAudio1] = true;
  }
  if (hasAudio2 && !ReportedAudioFiles[hasAudio2]) {
    MainWin.logmsg("Utilizing audio file: " + hasAudio2);
    ReportedAudioFiles[hasAudio2] = true;
  }
  
  return chapter;
}

var AudioChapters;
var CheckAudioChapters = {};
function hasAudio(book, chapter) {
  if (MainWin.document.getElementById("noaudio").checked) return null;
  if (!AudioChapters) {
    AudioChapters = {};
    var audiodir = MainWin.UIfile[MainWin.AUDIO].clone();
    if (!audiodir.exists()) return null;
    var files = audiodir.directoryEntries;
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
      var parts = file.leafName.match(/^([^-]+)-([^-]+)-(\d+)(-(\d+))?\.ac3$/);
      if (!parts || parts[1]!=MainWin.getLocaleString("AudioPrefix")) {
        MainWin.logmsg("WARNING: Could not parse audio file name \"" + file.leafName + "\"");
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
  ContinueFunc = null;
  var capture = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  capture.initWithPath(MainWin.UIfile[MainWin.INDIR].path + "/" + MainWin.CODE + "/" + MainWin.CAPTURE);
  
  imageName += ".jpg";
      
  var imgfile = MainWin.UIfile[MainWin.OUTDIR].clone();
  imgfile.append(MainWin.IMGDIR);
  if (subfolder) {
   imgfile.append(subfolder);
   if (!imgfile.exists()) imgfile.create(imgfile.DIRECTORY_TYPE, 0777);
  }
  imgfile.append(imageName);
  
  var process = Components.classes["@mozilla.org/process/util;1"]
                    .createInstance(Components.interfaces.nsIProcess);
  // Capture image...
  process.init(capture);
  var args = [imgfile.path, "-window render-win", "-crop " + MainWin.PAL.W + "x" + MainWin.PAL.H + "+0+0"];
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
  calculateReadingLength(info, screentext.substring(beg, end), MainWin.getLocaleString("LangCode"), book, chapter);
  if (info.len>=1) {
    if (screentext.substring(beg, end).search("class=\"majorquote\"") != -1) MainWin.logmsg("Found class=\"majorquote\" on " + imgname);
    hasChapterText = true;
    info["name"] = imgname;
    var lastVerse = screentext.substring(beg, end);
    var lvi = lastVerse.lastIndexOf("<sup>");
    if (lvi != -1) {
    lastVerse = lastVerse.substr(lvi);
      var re = new RegExp("<sup>\\s*(\\d+)([\\s-]+\\d+)?\\s*<\/sup>(.*)");
      if (lastVerse) lastVerse = lastVerse.match(re);
      if (!lastVerse) {
        MainWin.logmsg("WARNING: Could not add transition to listing \"" + imgname + "\"");
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
  // if we've finished a chapter, write chapter stats to file
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
    var file = MainWin.StatsFile.clone();
    file.append(book + ".csv");
    if (!file.exists()) MainWin.write2File(file, "#Page,Chapter Fraction,Audio File,Number of Titles,Chapter Length,Absolute Time\n", true);
    else if (file.exists() && (chapter == 0 || (chapter == 1 && !getPassage(book, true)))) {
      file.remove(false);
      MainWin.write2File(file, "#Page,Chapter Fraction,Audio File,Number of Titles,Chapter Length,Absolute Time\n", true);
    }
    MainWin.write2File(file, statstring, true);
    
    file = MainWin.TransFile.clone();
    file.append(book + "-trans.csv");
    if (!file.exists()) MainWin.write2File(file, "#Page,Verse,Transition\n", true);
    if (file.exists() && (chapter == 0 || (chapter == 1 && !getPassage(book, true)))) {
      file.remove(false);
      MainWin.write2File(file, "#Page,Verse,Transition Location\n", true);
    }
    MainWin.write2File(file, transtring, true);
    
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
    calculateReadingLength(ni, stxt.substring(beg, iverse), MainWin.getLocaleString("LangCode"), vt[inst].book, vt[inst].chapter);
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
//MainWin.jsdump("READTEXT" + Book[Bindex].shortName + "-" + Chapter + "-" + Page.pagenumber + "(titles=" + info.numtitles + "):>" + html + "<");
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

// This is needed because shorter than single page final chapters without 
// audio are otherwise dropped. Logging true max chapter value allows for a fix.
function writeBookEnd(bindex) {
  var file = MainWin.StatsFile.clone();
  file.append(Book[bindex].shortName + ".csv");
  var statstring = Book[bindex].shortName + "-maxChapter=" + Book[bindex].maxChapter;
  MainWin.write2File(file, statstring, true);
}

const Ffsep = "]-[";
function writeFootnotesToFile(book) {
  var fffile = MainWin.UIfile[MainWin.OUTDIR].clone();
  fffile.append(MainWin.LISTING);
  fffile.append("tmp");
  if (!fffile.exists()) fffile.create(fffile.DIRECTORY_TYPE, 0777);
  fffile.append(book + ".fn.txt");
  if (fffile.exists()) fffile.remove(false);
  for (var i=0; i<PageWithFootnotes.length; i++) {
    MainWin.write2File(fffile, Ffsep+ PageWithFootnotes[i].name +Ffsep+ PageWithFootnotes[i].shortName +Ffsep+ PageWithFootnotes[i].chapter +Ffsep+ PageWithFootnotes[i].html + Ffsep + "\n", true);
  }
  PageWithFootnotes = [];
}

function initFootnotes() {
  PageWithFootnotes = [];
  for (var b=0; b<Book.length; b++) {
    var fffile = MainWin.UIfile[MainWin.OUTDIR].clone();
    fffile.append(MainWin.LISTING);
    fffile.append("tmp");
    fffile.append(Book[b].shortName + ".fn.txt");
    if (fffile.exists()) {
      fffile = MainWin.readFile(fffile);
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
      MainWin.logmsg("Rendering Footnotes for Book:" + PageWithFootnotes[FootnoteIndex].shortName + "...");
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
  ContinueFunc = null;
  Bindex = getBindexFromBook(PageWithFootnotes[FootnoteIndex].shortName);
  Chapter = PageWithFootnotes[FootnoteIndex].chapter;
  if (LastBindex != Bindex) {
    MainWin.logmsg("Rendering Footnotes for Book:" + Book[Bindex].shortName + "...");
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
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, Page, false, false);

  // couldn't fit this last page, so start new page with it...
  if (!ContinuePage && !Page.complete) {
    IsFirstFN = true;
    waitRenderWinThenDo("renderNewFNScreen();");
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
  waitRenderWinThenDo("saveFNImage()");
}

function saveFNImage() {
  var renderImages = !MainWin.document.getElementById("images").checked;
  var basename = "fn-" + FNPageName + "-" + Page.pagenumber;
  
  if (renderImages && !Norender) captureImage(PageWithFootnotes[FootnoteIndex].shortName, basename);
  Norender = false;
  
  if (ContinuePage) Page.pagenumber++;
  else FootnoteIndex++;

  if (FootnoteIndex < PageWithFootnotes.length) {
    if (MainWin.Aborted) return;
    else if (!MainWin.Paused) renderNewFNScreen();
    else ContinueFunc = "renderNewFNScreen();";
  }
  else MainWin.stop();
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
  return "";
}

function getSubFilePath(parent, subpath) {
  var infile = parent.clone();
  var pth = subpath.split("/");
  for (var i=0; i<pth.length; i++) {infile.append(pth[i]);}
  if (infile.exists()) return infile.path;
  else return "";
}

var FrameInitInterval;
var FrameInitFunction;
function checkFrameInitComplete() {
  if (RenderFrame.contentDocument.defaultView.InitComplete) {
    window.clearTimeout(FrameInitInterval);
    FrameInitFunction();
  }
}

var DrawInterval;
function waitRenderWinThenDo(funcString) {
  DrawInterval = window.setInterval("if (RenderFrame.contentDocument.defaultView.RenderDone) {window.clearInterval(DrawInterval); " + funcString + ";}", 50);
}

function unloadedRender() {
  if (MainWin) {
    if (MainWin.Running) 
      MainWin.quit();
    else MainWin.resetGo();
  }
}
