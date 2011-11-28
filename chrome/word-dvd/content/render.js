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
const INDENT = "<span class=\"paragraph-start\"></span>";
const PARSTART = "<br>" + INDENT;
const NOTESTART = "<div class=\"footnote\">";
const NOTEREF  = "<span class=\"verseref\"";
const NOTESYMBOL = "<span class=\"fnsymbol\"";
const PAGEBREAK = "<span class=\"pagebreak\"></span>";
const SPLITABLEDIVS = "majorquote|list1|list2|list3|footnote|canonical|x-list-1|x-list-2|x-enumlist-1|x-enumlist-2|x-enumlist-3";
const TITLES = "title-1|title-2|book-title|chapter-title|text-header|menu-header";

var RenderFrame, MainWin;
var ILastPage;
var ContinueFunc;
var MenusFile;
var StartingBindex;
var Book, Bindex, Chapter, SubChap, SubChapters, Page;
var AudioFileRE = new RegExp(/^([^-]+)-([^-]+)-(\d+)(-(\d+)|:(\d+)-(\d+))?\.ac3$/);

function loadedRender() {
  MainWin = window.opener;
  Book = MainWin.Book;
  StartingBindex = MainWin.StartingBindex;
  RenderFrame = document.getElementById("render");
  
  RenderFrame.style.width = MainWin.PAL.W + "px";
  RenderFrame.style.height = String(MainWin.PAL.H + 16) + "px";
  window.setTimeout("postLoad1();", 1);
} function postLoad1() {
  initWaitRenderDone(false, false);
  
  window.resizeTo(RenderFrame.boxObject.width, document.getElementById("body").boxObject.height);

  waitRenderDoneThenDo("startMenuGeneration();");
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
      // does book have any audio?
      var hasAudio = false;
      for (var ch=1; ch<=Book[b].maxChapter; ch++) {
        if (getAudio(Book[b].shortName, ch)) {hasAudio = true; break;}
      }
      // save new menu entry
      MenuEntries.push(new Object());
      MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString(Book[b].shortName);
      MenuEntries[MenuEntries.length-1].className = (hasAudio ? "hasAudio":"");
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
MainWin.logmsg("startTextGeneration");
  // switch from menu to text background
  initWaitRenderDone(true, true);
  
  RenderFrame.contentDocument.defaultView.location.assign("chrome://word-dvd/content/web/text.html");
  
  waitRenderDoneThenDo("startTextGeneration2();");
  
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
    SubChapters = 0;
    var intro = getPassage(Book[Bindex].shortName, true);
    if (Book[Bindex].maxChapter>1 || intro) {
      MenuEntries = [];
      for (var c=0; c<=Book[Bindex].maxChapter; c++) {
        if (c==0 && !intro) continue;
        
        var scs = getSubChapters(Book[Bindex], c);
        
        MenuEntries.push(new Object());
        if (c>0) MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString("Chaptext", c, Book[Bindex].shortName);
        else MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString("IntroLink");
        MenuEntries[MenuEntries.length-1].target = Book[Bindex].shortName + "-" + Number(c + SubChapters);
        var hasAudio = (scs.length > 1 ? scs[1].hasAudio:getAudio(Book[Bindex].shortName, c, 0));
        MenuEntries[MenuEntries.length-1].className = (hasAudio ? "hasAudio":"");
 
        // subchapters are shown as follows:
        // - normal chapter item is first (allready done above)
        // - followed by any other audio subchapters (using the subchapter UI)        
        if (c > 0 && scs.length > 2) {
          for (var sc=2; sc<scs.length; sc++) {
            SubChapters++;
            if (!scs[sc].hasAudio) continue;
            MenuEntries.push(new Object());
            MenuEntries[MenuEntries.length-1].label = MainWin.getLocaleString("SubChaptext", c, Book[Bindex].shortName, scs[sc].vs);
            MenuEntries[MenuEntries.length-1].target = Book[Bindex].shortName + "-" + Number(c + SubChapters);
            MenuEntries[MenuEntries.length-1].className = (scs[sc].hasAudio ? "hasAudio":"");
          }
        }
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

  initWaitRenderDone(false, false);

  if (MainWin.Aborted) return;
  else if (!MainWin.Paused) waitRenderDoneThenDo("captureImage('', '" + menuname + "', '" + returnFun + "');");
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
    //if (doc.getElementById(id + String(i+1)).className.search(/(^|\s)hasAudio(\s|$)/)!=-1)
          //doc.getElementById(id + String(i+1)).innerHTML += "<img src=\"file://" + MainWin.UIfile[MainWin.INDIR].path + "/" + MainWin.RESOURCE + "/" + MainWin.AUDIOICON + "\" style=\"-moz-margin-start:12px;\" >";
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
  
  SubChapters = 0;
  SubChap = 0;
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
  
  initWaitRenderDone(false, true);
  
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, Page, skipPage1, skipPage2);
    
  waitRenderDoneThenDo("screenDrawComplete()");
  
//MainWin.jsdump("Finished fit left:" + RenderFrame.contentDocument.defaultView.Page1.innerHTML);
//MainWin.jsdump("Finished fit right:" + RenderFrame.contentDocument.defaultView.Page2.innerHTML);
}

function screenDrawComplete() {
  var imginfo = saveScreenImage(Book[Bindex], Chapter, SubChap, Page.pagenumber, SubChapters, Page.passage.substring(ILastPage, Page.end), Page.complete);
  ILastPage = Page.end;
  SubChapters = imginfo.subchapters;
  if (imginfo.chapter != Chapter) { 
    Chapter = imginfo.chapter;
    SubChap = 0;
    Page.pagenumber = 1; // needs increment below!
  }
  if (imginfo.subchap != SubChap) { 
    SubChap = imginfo.subchap;
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

// If a text block is empty then don't save an image for it, only data.
// Each non-empty text block saves an image and data UNLESS the previous
//   text block and the new text block are both non-audio, in which case, the new
//   text block should be skipped entirely.
// Footnotes for an entire screen need to be saved only once.
var ReportedAudioFiles = {};
function saveScreenImage(bkobj, chapter, subchap, pagenumber, subchapters, screentext, pagecomplete) {
  var book = bkobj.shortName;
  var renderImages = !MainWin.document.getElementById("images").checked;
  var imgfile, footNotesSaved;
  
  var tblock = {passage:screentext, beg:-1, end:0, endtype:-1, hasAudio:-1};
  
  while (tblock.endtype != "screen-end") {
		var lastAudio = tblock.hasAudio;
		tblock.beg = tblock.end+1;
		setTextBlock(tblock, chapter, subchap, bkobj);
  
		if (!imgfile || lastAudio || tblock.hasAudio) {
      // report audio file usage
      if (tblock.hasAudio && !ReportedAudioFiles[tblock.hasAudio]) {
        MainWin.logmsg("Utilizing audio file: " + tblock.hasAudio);
        ReportedAudioFiles[tblock.hasAudio] = true;
        for (var k in CheckAudioChapters) {
          if (CheckAudioChapters[k] == tblock.hasAudio) CheckAudioChapters[k] = "";
        }
      }
      
      // save this text block info and its image
      var basename = book + "-" + Number(chapter + subchapters) + "-" + pagenumber;
      var hasText = saveStats(basename, screentext.substring(tblock.beg-1, tblock.end));
      if (hasText) {
        if (renderImages) {
          if (!imgfile) imgfile = captureImage(book, basename);
          else imgfile.copyTo(null, basename + "." + imgfile.leafName.match(/\.(.*)$/)[1]);
        }
        if (!footNotesSaved) saveFootnotes(book, basename, screentext);
        footNotesSaved = true;
      }
		}
    
		// save chapter info when a chapter is finished
		if (tblock.endtype == "chapter" || tblock.endtype == "subchap"  || (tblock.endtype == "screen-end" && pagecomplete)) 
			writeStats(basename, tblock.hasAudio);
		
		// prepare for next use of this image...
		pagenumber = 1;	  
	  if (tblock.endtype == "chapter") {chapter++; subchap = 0;}
		if (tblock.endtype == "subchap") {
      if (!subchap) subchap = 1;
      subchap++; 
      subchapters++; 
    }
  }
	  
  return {chapter:chapter, subchap:subchap, subchapters:subchapters};
}

function setTextBlock(tblock, ch, subch, bkobj) {
  // does a new chapter start on this page?
  var nch = tblock.passage.substr(tblock.beg).indexOf(MainWin.NEWCHAPTER);
  if (nch != -1) nch += tblock.beg;
  
  var scs = getSubChapters(bkobj, ch);
    
  // if this is a new chapter, check if subchapters exist
  if (subch == 0 && scs.length > 1) subch = 1;

  // does a subchapter start or end on this page?
  var nsc = null;
  if (subch) {
    if (scs[subch]) {
      if (scs[subch].ve == -1) nsc = nch; 
      else if (!scs[subch+1]) 
          MainWin.logmsg("ERROR: Missing last subchapter after: bk=" + bkobj.shortName + ", ch=" + ch + ", subch=" + subch);
      else {
        var re1 = new RegExp("(" + MainWin.NEWVERSERE + ")", "gim");
        var re2 = new RegExp(MainWin.VERSENUMBER, "i");
        var versetags = tblock.passage.substr(tblock.beg).match(re1);
        for (var i=0; versetags && i<versetags.length; i++) {
          var verse = versetags[i].match(re2);
          if (!verse) {
            MainWin.logmsg("ERROR: Could no parse verse number from \"" + versetags[i] + "\"");
            continue;
          }
          else if ((scs[subch+1].vs == verse[1] || 
              (verse[2] && scs[subch+1].vs > verse[1] && scs[subch+1].vs <= verse[3]))) {
            nsc = versetags[i];
            break;
          }
        }
        if (nsc) {
          nsc = tblock.passage.substr(tblock.beg).indexOf(nsc);
          if (nsc != -1) {
            // shift before all interverse stuff (get to end of previous verse)
            var pve = new RegExp("(" + MainWin.escapeRE(INDENT) + "|<div[^>]*>.*?<\\/div>|<br>|\\s)+" + MainWin.escapeRE(versetags[i]), "im");
            pve = tblock.passage.substr(tblock.beg-1).search(pve); // -1 allows back-search all the way to text-block's beginning
            if (pve != -1) nsc = pve;
            nsc += (tblock.beg-1);
          }
        }
        
        // check for missing subchapters
        if (nch != -1 && (nch <= nsc || nsc===null || nsc == -1)) {
          MainWin.logmsg("ERROR: Could not find start of subchapter in text: bk=" + bkobj.shortName + ", ch=" + ch + ", subch=" + Number(subch+1) + ", start-verse=" + scs[subch+1].vs);
          nsc = null;
        }
      }
    }
    else MainWin.logmsg("ERROR: Subchapter requested, but it does not exist: bk=" + bkobj.shortName + ", ch=" + ch + ", subch=" + subch);
  }
  
  // set return values...
  tblock.hasAudio = (scs.length > 1 ? scs[subch].hasAudio:getAudio(bkobj.shortName, ch, 0));
  tblock.end = null;
  tblock.end = (nsc !== null && nsc != -1 ? nsc:nch);
  if (tblock.end == -1) {
    tblock.end = tblock.passage.length;
    tblock.endtype = "screen-end";
  }
  else tblock.endtype = (nsc !== null && nsc != -1 && nsc != nch ? "subchap":"chapter");
//MainWin.logmsg("setTextBlock: beg=" + tblock.beg + ", end=" + tblock.end + ", endtype=" + tblock.endtype + ", hasAudio=" + tblock.hasAudio);
}

/*
var ReportedAudioFiles = {};
function saveScreenImage(book, chapter, subchap, pagenumber, subchapters, screentext) {
//MainWin.jsdump("Processing:" + book + " to " + Page.beg + " of " + Page.passage.length);
//MainWin.logmsg(book + "-" + chapter + "-" + pagenumber + " = " + screentext);

  var footNotesSaved = false;
  var imgfile = null;
  var renderImages = !MainWin.document.getElementById("images").checked;
  var basename = book + "-" + Number(chapter + subchapters) + "-" + pagenumber;
  var hasAudio1 = getAudio(book, chapter, subchap);
  var hasChapterText = saveStats(basename, screentext, hasAudio1);
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
      var hasAudio2 = getAudio(book, chapter);
      // if hasChapterText && !hasAudio2 then this page has been captured once and does not need to be captured again.
      if ((hasChapterText && !hasAudio2) || !saveStats(basename, screentext, hasAudio2)) continue;
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
  
  // record and report utilized audio files
  if (hasAudio1 && !ReportedAudioFiles[hasAudio1]) {
    MainWin.logmsg("Utilizing audio file: " + hasAudio1);
    ReportedAudioFiles[hasAudio1] = true;
  }
  if (hasAudio2 && !ReportedAudioFiles[hasAudio2]) {
    MainWin.logmsg("Utilizing audio file: " + hasAudio2);
    ReportedAudioFiles[hasAudio2] = true;
  }
  
  return {chapter:chapter, subchap:subchap, subchapters:subchapters};
}
*/

// Recognizable audio file name patterns are as follows:
//  audioCode-book-ch.ac3
//  audioCode-book-ch-ch.ac3
//  audioCode-book-ch:v-v.ac3
//
// AudioChapters keys are as follows:
//  book-ch-subchap (where subchap is 0 if there are no subchapters)
//  if there are subchapters, then they will be sequential starting with 
//  1 and ordered by their starting verse.
//
// If subchap == NULL or undefined, hasAudio returns the first, or only, audio file in the chapter.
//  or else NULL if there is no audio for any part of the chapter.
// If subchap = 0, hasAudio returns the full-chapter audio file or else
//  NULL if there isn't one, even if there are partial audio files for the chapter.
// If subchap != NULL and > 0, hasAudio returns the audio file for the specified
//  subchapter, or NULL if there is no audio file for that subchapter. 
var AudioChapters;
var CheckAudioChapters = {};
function getAudio(book, chapter, subchap) {
  if (MainWin.document.getElementById("noaudio").checked) return null;
  if (!AudioChapters) {
    AudioChapters = {};
    var audiodir = MainWin.UIfile[MainWin.AUDIO].clone();
    if (!audiodir.exists()) return null;
    var files = audiodir.directoryEntries;
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
      var parts = file.leafName.match(AudioFileRE);
      if (!parts) {
        MainWin.logmsg("WARNING: Could not parse audio file name \"" + file.leafName + "\"");
        continue;
      }
      var ap = MainWin.getLocaleString("AudioPrefix");
      if (ap && parts[1]!=ap) {
        MainWin.logmsg("WARNING: Skipping audio file because audio code is different than " + ap + ": \"" + file.leafName + "\"");
        continue;      
      }
      if (!parts[6]) { // if not a subchapter
        var endc = (parts[4] ? Number(parts[5]):Number(parts[3]));
        for (var c=Number(parts[3]); c<=endc; c++) {
          recordFileAs(parts[2] + "-" + c + "-0", file.leafName);
        }
      }
      else {
        if (!AudioChapters[parts[2] + "-" + Number(parts[3]) + "-1"])
            recordFileAs(parts[2] + "-" + Number(parts[3]) + "-1", file.leafName);
        else {
          var inserted = false;
          var savef, lastsavef;
          for (var sc=1; AudioChapters[parts[2] + "-" + Number(parts[3]) + "-" + sc]; sc++) {
            savef = AudioChapters[parts[2] + "-" + Number(parts[3]) + "-" + sc];
            var sv = Number(savef.match(AudioFileRE)[5]);
            if (inserted) recordFileAs(parts[2] + "-" + Number(parts[3]) + "-" + sc, lastsavef);
            else if (Number(parts[5]) <= sv) {
              if (Number(parts[5]) == sv) {
                MainWin.logmsg("ERROR: Two different audio files begin at the same verse: \"" + file.leafName + "\", \"" + savef + "\"");
              }
              recordFileAs(parts[2] + "-" + Number(parts[3]) + "-" + sc, file.leafName);
              inserted = true;
            }
            lastsavef = savef;
          }
          if (!inserted) recordFileAs(parts[2] + "-" + Number(parts[3]) + "-" + sc, file.leafName);
          else recordFileAs(parts[2] + "-" + Number(parts[3]) + "-" + sc, lastsavef);
        }
      }
    }
  }
  
  // return a value...
  if (subchap === null || subchap === undefined) {
    if (AudioChapters[book + "-" + chapter + "-1"]) {
      if (AudioChapters[book + "-" + chapter + "-0"]) {
        MainWin.logmsg("ERROR: Audio file collision: \"" + AudioChapters[book + "-" + chapter + "-0"] + "\", \"" + AudioChapters[book + "-" + chapter + "-1"] + "\"");
        return AudioChapters[book + "-" + chapter + "-0"];
      }
      return AudioChapters[book + "-" + chapter + "-1"];
    }
    else subchap = 0;
  }

var tmp = (AudioChapters[book + "-" + chapter + "-" + subchap] ? AudioChapters[book + "-" + chapter + "-" + subchap]:null);
//MainWin.logmsg("getAudio(" + book + ", " + chapter + ", " + subchap + ")=" + tmp);
return tmp;  
  //return (AudioChapters[book + "-" + chapter + "-" + subchap] ? AudioChapters[book + "-" + chapter + "-" + subchap]:null);
}

function recordFileAs(key, name) {
  AudioChapters[key] = name;
  CheckAudioChapters[key] = name;
}


// audio subchapters are recorded for each subchapter audio file
// and non-audio subchapters are additionally recorded as follows:
// - at verse 1 if verses 1-3 are all non-audio (Psalms does not always start at verse 1!)
// - between audio subchapters IF there is a gap between them
// - after last audio subchapter if final audio verse is not the last verse in the chapter
// ve (verse end) of -1 means "last verse in chapter"
function getSubChapters(bkobj, ch) {
  var scs = [null];
  var sc = 1;
  var tsc;
  while (getAudio(bkobj.shortName, ch, sc)) {
    var file = getAudio(bkobj.shortName, ch, sc);
    var parts = file.match(AudioFileRE);
    tsc = {vs:Number(parts[6]), ve:Number(parts[7]), hasAudio:file};
    var prevend = (scs[scs.length-1] ? scs[scs.length-1].ve:0);
    if (prevend != (tsc.vs-1)) {
      var tscna = {vs:prevend+1, ve:tsc.vs-1, hasAudio:null};
      scs.push(tscna);
    }
    scs.push(tsc);
    sc++;
  }
  
  if (tsc) {
    if (!bkobj["ch" + ch + "MaxVerse"]) {
      MainWin.logmsg("Error: Unknown max-verse for \"" + bkobj.shortName + " " + ch + "\".");
      return scs;
    }
    if (tsc.ve == bkobj["ch" + ch + "MaxVerse"]) {
      scs[scs.length-1].ve = -1;
      return scs;
    }
    if (tsc.ve > bkobj["ch" + ch + "MaxVerse"]) {
      MainWin.logmsg("WARNING: Audio last verse is greater than max-verse for \"" + bkobj.shortName + " " + ch + "\".");
      scs[scs.length-1].ve = -1;
      return scs;  
    }
    scs.push({vs:(tsc.ve+1), ve:-1, hasAudio:null});
  }
  
  return scs;
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

// Records listing file and transition file information for each page.
// AFTER a chapter is completed, writeStats is called so that all information 
// for that chapter is recorded into the listing and transitions files.
var ChapterStats = [];
function saveStats(basename, blocktext) {
  var parts = basename.split("-");
  var book = parts[0];
  var chapter = Number(parts[1]);
  var pagenumber = Number(parts[2]);
  var hasChapterText = false;
  var info = new Object();
  calculateReadingLength(info, blocktext, MainWin.getLocaleString("LangCode"), book, chapter);
  if (info.len>=1) {
	  hasChapterText = true;
    if (blocktext.search("class=\"majorquote\"") != -1) MainWin.logmsg("Found class=\"majorquote\" on " + basename);
    info["name"] = basename;
    var lastVerse = blocktext;
    var lvi = lastVerse.lastIndexOf("<sup>");
    if (lvi != -1) {
	  lastVerse = lastVerse.substr(lvi);
      var re = new RegExp("<sup>\\s*(\\d+)([\\s-]+\\d+)?\\s*<\/sup>(.*)");
      if (lastVerse) lastVerse = lastVerse.match(re);
      if (!lastVerse) {
        MainWin.logmsg("WARNING: Could not add transition to listing \"" + basename + "\"");
        info["trans"] = "unknown\n";
      }
      else info["trans"] = basename + "," + book + "-" + chapter + ":" + lastVerse[1] + ",{" + lastVerse[3] + "}\n";
    }
    else info["trans"] = "last_page\n";
    
    var prop = "vt_" + book + "_" + chapter;
    if (VerseTiming[prop]) {
      for (var i=0; i<VerseTiming[prop].length; i++) {
        if (VerseTiming[prop][i]) appendVerseTimingInfo(i, blocktext, info, VerseTiming[prop]);        
      }
    }
    ChapterStats.push(info);
  }
  
  return hasChapterText;
}

function writeStats(basename, hasAudio) {
	var parts = basename.split("-");
  var book = parts[0];
  var chapter = Number(parts[1]);
  var pagenumber = Number(parts[2]);
  
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
}

function formatStatString(s, total, hasAudio) {
  var rellen = Number(Math.round(10000000*s.len/total)/10000000);
  return s.name + ", " + rellen + ", " + (hasAudio ? hasAudio:"still") + ", " + s.numtitles + ", " + s.len + (s.realtime ? ", " + s.realtime:"") + "\n"; 
}

// looks for the verse tag of instance "i" from "vt" and if it's found 
// then the reading length is calculated and saved from the
// begining of the text block to the place specified in instance "i" from "vt"
function appendVerseTimingInfo(i, stxt, info, vt) {
  var se = "</sup>";
  var re = new RegExp("<sup>\\s*" + vt[i].verse + "\\s*[-<]", "im");
  var iverse = stxt.search(re);
  if (iverse != -1 && vt[i].trans) {
    stxt = stxt.substring(0, stxt.indexOf(se, iverse) + se.length) + vt[i].trans;
    iverse = stxt.length;
  }

  if (iverse != -1) {
    var ni = {};
    calculateReadingLength(ni, stxt.substring(0, iverse), MainWin.getLocaleString("LangCode"), vt[i].book, vt[i].chapter);
    var subo = "a";                                              
    if (info[subo]) subo = "b";                                 
    info[subo] = {};                                           
    info[subo].name = vt[i].book + "-" + vt[i].chapter + ":" + vt[i].verse;     
    info[subo].realtime = vt[i].realtime;          
    info[subo].numtitles = ni.numtitles;                  
    info[subo].len = ni.len;                            
    vt[i] = null;                                                                                                   
  }                           
}

function calculateReadingLength(info, html, lang, book, chapter) {
  
  //Count number of titles in page- used to add natural pause times between sections.
  var numtitles = countDivsClass(html, "title-");
  var incAutoCh = getTimingParam("CountChapterNumbersAsTitle", book, chapter);
  if (incAutoCh && incAutoCh == "true") numtitles += countDivsClass(html, "chapter-title");

  //Remove verse numbers
  var nv = new RegExp(MainWin.NEWVERSERE, "ig");
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
  
  if (html) PageWithFootnotes.push({name:basename, shortName:Book[Bindex].shortName, chapter:Chapter, html:html});
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
  
  initWaitRenderDone(false, true);

  var tstart = Page.end;
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, Page, false, false);

  // couldn't fit this last page, so start new page with it...
  if (!ContinuePage && !Page.complete) {
    IsFirstFN = true;
    waitRenderDoneThenDo("renderNewFNScreen();");
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
  waitRenderDoneThenDo("saveFNImage()");
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

// call initWaitRenderDone, then redraw window, then call waitRenderDoneThenDo
var UseRenderDoneFallback = false;
var PaintCount;
var PaintCheckInterval;  // works with firefox 4+
var DrawInterval;
var RenderDoneTO;
// set skipFallback if fallback init is handled elsewhere
function initWaitRenderDone(dontWaitForImages, skipFallback) {
  // prepare for waitRenderDoneThenDo
  RenderFrame.contentDocument.defaultView.RenderDone = false;
  try {
    if (UseRenderDoneFallback || window.mozPaintCount===undefined) throw true;
    PaintCount = window.mozPaintCount;
    if (PaintCheckInterval) clearInterval(PaintCheckInterval);
    if (!dontWaitForImages) setLoadingImages();
    else LoadingImages = 0;
    var func  = "if (window.mozPaintCount > PaintCount) { ";
        func +=   "if (LoadingImages > 0) {PaintCount = window.mozPaintCount;} ";
        func +=   "else { ";
        func +=     "window.clearInterval(PaintCheckInterval); ";
        func +=     "RenderFrame.contentDocument.defaultView.RenderDone = true;";
        func +=   "}";
        func += "}";
    PaintCheckInterval = window.setInterval(func, 10);
  }
  catch (er) {
    // skip the firefox 3- fallback method if RenderDone is handled somewhere else
    if (!skipFallback) {
      if (RenderDoneTO) window.clearTimeout(RenderDoneTO);
      RenderDoneTO = window.setTimeout("RenderFrame.contentDocument.defaultView.setTimeout(\"window.setTimeout('RenderDone = true;', MainWin.WAIT);\", 1);", 1);
    }
  }
}

// Get all images, and wait for certain images to load before waiting for a final redraw.
// The following criteria are intended to choose images which will force the redraw:
//    src is not empty
//    image is not hidden
//    src is different than it was previously
var LoadingImages = 0;
var ImageSrc = {};
var Imgid = 0;
function setLoadingImages() {
  LoadingImages = 0;
  var imgs = RenderFrame.contentDocument.getElementsByTagName("img");
  for (var i=0; i<imgs.length; i++) {
    if (!imgs[i].src || imgs[i].src.indexOf(".html")!=-1) continue; // empty src's show page's URL (why?)
    if (imgs[i].style.visibility == "hidden") continue;
    if (!imgs[i].id || !ImageSrc[imgs[i].id] || imgs[i].src != ImageSrc[imgs[i].id]) {
      LoadingImages++;
      imgs[i].onload = new Function("LoadingImages--;");
      imgs[i].src = imgs[i].src;
    }
    if (!imgs[i].id) imgs[i].id = "img" + Imgid++;
    ImageSrc[imgs[i].id] = imgs[i].src;
  }
}

function waitRenderDoneThenDo(funcString) {
  if (DrawInterval) window.clearInterval(DrawInterval);
  DrawInterval = window.setInterval("if (RenderFrame.contentDocument.defaultView.RenderDone) {window.clearInterval(DrawInterval); " + funcString + ";}", 10);
}

function unloadedRender() {
  if (MainWin) {
    if (MainWin.Running) 
      MainWin.quit();
    else MainWin.resetGo();
  }
}
