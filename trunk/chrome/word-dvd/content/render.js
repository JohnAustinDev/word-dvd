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
const ISMENUIMAGE = 0, ISTEXTIMAGE = 1, ISFOOTNOTEIMAGE = 2;

var RenderFrame, MainWin;
var ILastPage;
var ContinueFunc;
var MenusFile;
var StartingBindex;
var Book, Bindex, Chapter, SubChap, SubChapters, Page;

function loadedRender() {
  MainWin = window.opener;
  Book = MainWin.Book;
  StartingBindex = MainWin.StartingBindex;
  RenderFrame = document.getElementById("render");
  
  RenderFrame.style.width = MainWin.PAL.W + "px";
  RenderFrame.style.height = String(MainWin.PAL.H + 16) + "px";
  window.setTimeout("postLoad1();", 1);
} function postLoad1() {
  initWaitRenderDone(false);
  
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
        if (getAudioFile(Book[b].shortName, ch)) {hasAudio = true; break;}
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
  initWaitRenderDone(true);
  
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
    
    // check for UI locale entries corresponding to chapter menu entries
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
    
    // prepare next menu's button list
    var pagedone = false;
    for (var r=1; r<=16; r++) {
      if (r == 9) pagedone=false;
      if (r <= 8 && doneLeft || r > 8 && doneRight) continue;
      if (haveart && r <= 8 || pagedone || !MenuEntries[MenuEntryIndex]) continue;
      
      // save next menu entry to menu
      if (r <= 8) arrayL.push(MenuEntries[MenuEntryIndex]);
      else arrayR.push(MenuEntries[MenuEntryIndex]);
      if (MenuEntries[MenuEntryIndex] && MainWin.getLocaleString(MenuType + String(MenuNumber) + (r <= 8 ? "left":"right") + "last")==MenuEntries[MenuEntryIndex].label) pagedone = true;
      MenuEntryIndex++;
    }
    
    // create a new menu
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
        
        var scs = getSubChapterInfo(Book[Bindex], c);
        
        // get sub-chapter presentation settings
        var subChapShowAll = MainWin.getLocaleString("SubChapShowAll");
        var subChapNoHeading = MainWin.getLocaleString("SubChapNoHeading");
        var subChapNoHeadingButton = MainWin.getLocaleString("SubChapNoHeadingButton");
        
        subChapShowAll = (subChapShowAll && subChapShowAll.toLowerCase() == "true");
        subChapNoHeading = (subChapNoHeading && subChapNoHeading.toLowerCase() == "true");
        subChapNoHeadingButton = (subChapNoHeadingButton && subChapNoHeadingButton.toLowerCase() == "true");
        
        if (scs.length == 1 || !subChapNoHeading) {
          var entry = new Object();
          if (c>0) entry.label = MainWin.getLocaleString("Chaptext", [Book[Bindex].shortName, c]);
          else entry.label = MainWin.getLocaleString("IntroLink");
          
          if (scs.length > 1 && subChapNoHeadingButton) {
            entry.target = null;
            entry.className = "";
          }
          else {
            entry.target = Book[Bindex].shortName + "-" + Number(c + SubChapters);
            var hasAudio = (scs.length > 1 ? scs[1].hasAudio:getAudioFile(Book[Bindex].shortName, c, 0));
            entry.className = (hasAudio ? "hasAudio":"");
          }
          
          MenuEntries.push(entry);
        }
        
        // by default, subchapters are shown as follows:
        // - normal chapter item is first (allready done above)
        // - followed by any other audio subchapters (using the subchapter UI)      
        if (scs.length > 1) {
          for (var sc=(subChapNoHeading || subChapNoHeadingButton ? 1:2); sc<scs.length; sc++) {
            if (sc > 1) SubChapters++;
            if (!subChapShowAll && !scs[sc].hasAudio) continue;
            entry = new Object();
            var ve = scs[sc].ve;
            if (ve == -1) ve = Book[Bindex]["ch" + c + "MaxVerse"];
            entry.label = MainWin.getLocaleString("SubChaptext", [Book[Bindex].shortName, c, scs[sc].vs, ve]);
            entry.target = Book[Bindex].shortName + "-" + Number(c + SubChapters);
            entry.className = (scs[sc].hasAudio ? "hasAudio":"");
            MenuEntries.push(entry);
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
    for (var i=0; i<8; i++) {
      mdoc.getElementById("p1b" + String(i+1)).innerHTML = "";
      mdoc.getElementById("p1b" + String(i+1)).className = "button"; // not hasAudio!
    }
    var artwork = getSubFilePath(MainWin.UIfile[MainWin.INDIR], MainWin.ARTWORK + "/" + menubase + "-m" + menunumber + ".png");
    if (artwork) {
      mdoc.getElementById("menu-image-left").style.visibility = "visible";
      setImgSrc(mdoc.getElementById("menu-image-left"), "File://" + artwork);
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

  initWaitRenderDone(false);

  if (MainWin.Aborted) return;
  else if (!MainWin.Paused) waitRenderDoneThenDo("captureImage('" + menuname + "', " + ISMENUIMAGE + ", '" + returnFun + "');");
  else ContinueFunc = "captureImage('" + menuname + "', " + ISMENUIMAGE + ", '" + returnFun + "');";
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
    
    if (aTarget) MainWin.write2File(MenusFile, formatMenuString(menuname, i, isLeft, aTarget), true);
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

function initBookGlobals(skipExistingIntroduction) {
  Page = {passage:"", beg:0, end:0, complete:false, pagenumber:1, isNotes:false, topSplitTag:null, bottomSplitTag:null, matchTransition:null};
  ILastPage = 0;
  
  SubChapters = 0;
  SubChap = 0;
  var intro = getPassage(Book[Bindex].shortName, true);
  if (!intro || skipExistingIntroduction) {
    Chapter = 1;
    Page.passage = getPassage(Book[Bindex].shortName);
  }
  else {
    Chapter = 0;
    Page.passage = intro;
  }
  if (!skipExistingIntroduction) Book[Bindex].overwriteStats = true;
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
    mdoc.getElementById("text-image-left").style.visibility = "visible";
    setImgSrc(mdoc.getElementById("text-image-left"), "File://" + artwork);
  }
  var tstyle = mdoc.defaultView.getComputedStyle(mdoc.getElementById("text-page2"), null);
  var skipPage2 = (tstyle.visibility == "hidden"); // this allows single column display by setting text-page2 visibility=hidden
  
  initWaitRenderDone(true);
  
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, SubChapters, Page, skipPage1, skipPage2);
    
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
// Each non-empty text block saves image and data UNLESS the previous 
//   text block is non-audio, in which case, the new text block may be 
//   skipped entirely.
// Footnotes for an entire screen need to be saved only once.
var ReportedAudioFiles = {};
var ChapterStats = [];
function saveScreenImage(bkobj, chapter, subchap, pagenumber, subchapters, screentext, pagecomplete) {
  var book = bkobj.shortName;
  var renderImages = !MainWin.document.getElementById("images").checked;
  var isAudio = false;
  
  // process this screen as a series of "text-blocks", each of which 
  // have different data but an identical image associated with it
  var tblock = {passage:screentext, beg:-1, end:0, inc:0, endtype:-1, hasAudio:null, chapter:chapter, subchap:subchap, subchapters:subchapters, pagenumber:pagenumber};
  
  var tblocks = [];
  while (tblock.endtype != "screen-end") {
		tblock.beg = tblock.end+tblock.inc;
		setTextBlock(tblock, tblock.chapter, tblock.subchap, bkobj, (ILastPage == 0 && tblock.beg == 0));
 
    // copy and save this tblock for another loop (so we can know the future there)
    var copy = {};
    for (var m in tblock) {copy[m] = tblock[m];}
    tblocks.push(copy);
    
    isAudio |= (tblock.hasAudio ? true:false);
      
    // prepare for next use of this image...
    tblock.inc = 1; // insure we don't  catch the same text-block twice
		tblock.pagenumber = 1;	  
	  if (tblock.endtype == "chapter") {tblock.chapter++; tblock.subchap = 0;}
		if (tblock.endtype == "subchap") {
      if (!tblock.subchap) tblock.subchap = 1;
      tblock.subchap++; 
      tblock.subchapters++; 
    }
  }

  // now re-loop, process and save image and data for tblock(s)
  var imgfile, footNotesSaved;
  var keepold = MainWin.getLocaleLiteral("NonAudioEndStop"); 
  for (var i=0; i<tblocks.length; i++) {
    var pagename = book + "-" + Number(tblocks[i].chapter + tblocks[i].subchapters) + "-" + tblocks[i].pagenumber;
  
    var keep1 = (tblocks[i].hasAudio ||  
                (i > 0 && tblocks[i-1].hasAudio) || 
                !imgfile); // OLD way
                
    var keep2 = (tblocks[i].hasAudio || 
                (i > 0 && tblocks[i-1].hasAudio) || 
                (!imgfile && !isAudio) ||
                tblocks[i].pagenumber == 1); // NEW way
                
		if (keepold ? keep1:keep2) {
      // report audio file usage
      if (tblocks[i].hasAudio && !ReportedAudioFiles[tblocks[i].hasAudio]) {
        MainWin.logmsg("Utilizing audio file: " + tblocks[i].hasAudio);
        ReportedAudioFiles[tblocks[i].hasAudio] = true;
        for (var k in CheckAudioFiles) {
          if (CheckAudioFiles[k] == tblocks[i].hasAudio) CheckAudioFiles[k] = "";
        }
      }
      
      // save the page's info and image for this text block
      var info = getStats(pagename, screentext.substring(tblocks[i].beg-1, tblocks[i].end), tblocks[i].hasAudio);
//var t = "info\n"; for (var m in info) {t += m + "=" + info[m] + "\n";} MainWin.logmsg(t);

      if (info) {
        ChapterStats.push(info);
        if (renderImages) {
          if (!imgfile) imgfile = captureImage(pagename, ISTEXTIMAGE);
          else imgfile.copyTo(null, pagename + "." + imgfile.leafName.match(/\.(.*)$/)[1]);
        }
        if (!footNotesSaved) saveFootnotes(book, pagename, screentext);
        footNotesSaved = true;
      }
		}
    
    // save previous chapter info anytime a chapter is finished
		if (tblocks[i].endtype == "chapter" || tblocks[i].endtype == "subchap"  || (tblocks[i].endtype == "screen-end" && pagecomplete)) {
			writeStats(book, ChapterStats, bkobj.overwriteStats);
      ChapterStats = [];
      bkobj.overwriteStats = false;
    }
  }
	  
  return {chapter:tblock.chapter, subchap:tblock.subchap, subchapters:tblock.subchapters};
}

function setTextBlock(tblock, ch, subch, bkobj, skipFirstChtag) {
  // does a new chapter start on this page?
  var nch = tblock.passage.substr(tblock.beg).indexOf(MainWin.NEWCHAPTER);
  if (nch != -1) nch += tblock.beg;

  // chapter 0 and 1 chapter tags should get skipped
  if (skipFirstChtag) {
    var nch2 = tblock.passage.substr(nch+1).indexOf(MainWin.NEWCHAPTER);
    if (nch2 != -1) nch2 += nch+1;
    nch = nch2;
  }

  var scs = getSubChapterInfo(bkobj, ch);
    
  // if this is a new chapter, check if subchapters exist
  if (subch == 0 && scs.length > 1) subch = 1;

  // does a subchapter start or end on this page?
  var nsc = null;
  if (subch) {
    if (scs[subch]) {
      if (scs[subch].ve == -1) nsc = nch; 
      else if (!scs[subch+1]) 
          MainWin.logmsg("ERROR: Missing last subchapter after: bk=" + bkobj.shortName + ", ch=" + Number(ch+SubChapters) + ", subch=" + subch);
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
            pve = tblock.passage.substr(tblock.beg-tblock.inc).search(pve); // -tblock.inc allows back-search all the way to text-block's beginning
            if (pve != -1) nsc = pve;
            nsc += (tblock.beg-tblock.inc);
          }
        }
        
        // check for missing subchapters
        if (nch != -1 && (nch <= nsc || nsc===null || nsc == -1)) {
          MainWin.logmsg("ERROR: Could not find start of subchapter in text: bk=" + bkobj.shortName + ", ch=" + Number(ch+SubChapters) + ", subch=" + Number(subch+1) + ", start-verse=" + scs[subch+1].vs);
          nsc = null;
        }
      }
    }
    else MainWin.logmsg("ERROR: Subchapter requested, but it does not exist: bk=" + bkobj.shortName + ", ch=" + Number(ch+SubChapters) + ", subch=" + subch);
  }
  
  // set return values...
  tblock.hasAudio = (scs.length > 1 ? scs[subch].hasAudio:getAudioFile(bkobj.shortName, ch, 0));
  tblock.end = null;
  tblock.end = (nsc !== null && nsc != -1 ? nsc:nch);
  if (tblock.end == -1) {
    tblock.end = tblock.passage.length;
    tblock.endtype = "screen-end";
  }
  else tblock.endtype = (nsc !== null && nsc != -1 && nsc != nch ? "subchap":"chapter");
//var p = "tblock:\n"; for (var m in tblock) {p += "\t\t" + m + " = " + tblock[m] + "\n";} MainWin.logmsg(p);
}

// Recognizable audio file name patterns are as follows:
//  audioCode-book-ch.ac3
//  audioCode-book-ch-ch.ac3
//  audioCode-book-ch:v-v.ac3
//  audioCode-book-ch1:v1-ch2:v2.ac3
//
//  index = 0 corresponds to a full chapter audio file. If there are 
//  any partial chapter audio files, they will be indexed sequentially, 
//  starting with 1 and ordered by the starting verse of their audio file.
//
// If index == NULL or undefined, hasAudio returns the first, or only, audio file for the chapter.
//  or else NULL if there is no audio for any part of the chapter.
// If index = 0, hasAudio returns the full-chapter audio file or else
//  NULL if there isn't one, even if there are partial audio files for the chapter.
// If index > 0, hasAudio returns the audio file for the specified
//  index, or NULL if there is no audio file with that index. 
//
var AudioFiles;
var CheckAudioFiles = {};
function getAudioFile(book, chapter, index) {
  if (MainWin.document.getElementById("noaudio").checked) return null;
  
  // do one time read and cache all audio file names...
  if (!AudioFiles) {
    AudioFiles = {};
    var audiodir = MainWin.UIfile[MainWin.AUDIO].clone();
    if (!audiodir.exists()) return null;
    var files = audiodir.directoryEntries;
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
      
      var audiofile = getAudioFileCoverage(file.leafName);
      
      if (!audiofile) {
        MainWin.logmsg("WARNING: Skipping file in audio directory: \"" + file.leafName + "\"");
        continue;
      }
      
      var ap = MainWin.getLocaleString("AudioPrefix");
      if (ap && audiofile.ap!=ap) {
        MainWin.logmsg("WARNING: Skipping audio file. Audio code is other than specified in config.txt (AudioPrefix = " + ap + "): \"" + file.leafName + "\"");
        continue;      
      }
      
      var bkobj = Book[getBindexFromBook(audiofile.bk)];
      for (var ch = audiofile.chs; ch <= audiofile.che; ch++) {
        if (audiofile.type == "chapter" || audiofile.type == "multi-chapter") 
            recordFileAs(audiofile.bk, ch, 0, file.leafName);
            
        else if (audiofile.type == "sub-chapter") 
            insertAudioSubInCh(audiofile.bk, ch, file.leafName);
            
        else if (audiofile.type == "multi-chapter-incomplete") {
          if (ch == audiofile.chs) {
            if (audiofile.vs == bkobj["ch" + audiofile.chs + "MinVerse"])
                recordFileAs(audiofile.bk, ch, 0, file.leafName);
            else insertAudioSubInCh(audiofile.bk, ch, file.leafName);
          }
          else if (ch == audiofile.che) {
            if (audiofile.ve == bkobj["ch" + audiofile.che + "MaxVerse"]) recordFileAs(audiofile.bk, ch, 0, file.leafName);
            else insertAudioSubInCh(audiofile.bk, ch, file.leafName);          
          }
          else recordFileAs(audiofile.bk, ch, 0, file.leafName);
        }
      }
    }
  }
  
  // return the corresponding audio file name...
  if (index === null || index === undefined) {
    if (AudioFiles[book + "-" + chapter + "-1"]) {
      if (AudioFiles[book + "-" + chapter + "-0"]) {
        MainWin.logmsg("ERROR: Audio file collision: \"" + AudioFiles[book + "-" + chapter + "-0"] + "\", \"" + AudioFiles[book + "-" + chapter + "-1"] + "\"");
        return AudioFiles[book + "-" + chapter + "-0"];
      }
      return AudioFiles[book + "-" + chapter + "-1"];
    }
    else index = 0;
  }

	return (AudioFiles[book + "-" + chapter + "-" + index] ? AudioFiles[book + "-" + chapter + "-" + index]:null);  
}

// parses all audio file names and returns an object with complete coverage information
// does sanity checking and reporting as well
function getAudioFileCoverage(filename) {
  var AudioFileRE1 = new RegExp(/^([^-]+)-([^-]+)-(\d+):(\d+)-(\d+):(\d+)\.ac3$/);
  var AudioFileRE2 = new RegExp(/^([^-]+)-([^-]+)-(\d+)(-(\d+)|:(\d+)-(\d+))?\.ac3$/);

  var parts = filename.match(AudioFileRE2);
  if (parts) parts[0] = 2;
  else {
    parts = filename.match(AudioFileRE1);
    if (parts) parts[0] = 1;
  }
  
  if (!parts) return null;
  
  var bkobj = Book[getBindexFromBook(parts[2])];
  
  if (!bkobj) return null; // skip this audio file if its book is not being run

  var type, ret;
  if (parts[0] == 2) { // AudioFileRE2
    parts[3] = Number(parts[3]); // starting chapter
    parts[5] = Number(parts[5]); // ending chapter (?)
    parts[6] = Number(parts[6]); // starting verse (?)
    parts[7] = Number(parts[7]); // ending verse (?)
    if (!ret && !parts[4]) 
      ret = {
        type:"chapter", 
        ap:parts[1], 
        bk:parts[2], 
        chs:parts[3], 
        che:parts[3], 
        vs:bkobj["ch" + parts[3] + "MinVerse"], 
        ve:bkobj["ch" + parts[3] + "MaxVerse"]
      };
      
    if (!ret && parts[5])  
      ret = {
        type:"multi-chapter", 
        ap:parts[1], 
        bk:parts[2], 
        chs:parts[3], 
        che:parts[5], 
        vs:bkobj["ch" + parts[3] + "MinVerse"], 
        ve:bkobj["ch" + parts[5] + "MaxVerse"]
      };
    
    if (!ret) {
      type = "sub-chapter";
      if (parts[6] == bkobj["ch" + parts[3] + "MinVerse"] && parts[7] == bkobj["ch" + parts[3] + "MaxVerse"]) type = "chapter";
      ret = {
        type:type, 
        ap:parts[1], 
        bk:parts[2], 
        chs:parts[3], 
        che:parts[3], 
        vs:parts[6], 
        ve:parts[7]
      };
    }
  }
 
  if (parts[0] == 1) {
    parts[3] = Number(parts[3]);
    parts[4] = Number(parts[4]);
    parts[5] = Number(parts[5]);
    parts[6] = Number(parts[6]);
    type = "multi-chapter-incomplete";
    if (parts[3] == parts[5]) {
      if (parts[4] == bkobj["ch" + parts[3] + "MinVerse"] && parts[6] == bkobj["ch" + parts[3] + "MaxVerse"]) type = "chapter";
      else type = "sub-chapter";
    }
    else if (parts[4] == bkobj["ch" + parts[3] + "MinVerse"] && parts[6] == bkobj["ch" + parts[5] + "MaxVerse"]) type = "multi-chapter";
    ret = {type:type, ap:parts[1], bk:parts[2], chs:parts[3], che:parts[5], vs:parts[4], ve:parts[6]};
  }
     
  // now sanity check file coverage and report
  if (!ret.type || !ret.bk || (!ret.chs && ret.chs!=0) || (!ret.che && ret.che!=0) || !ret.vs || !ret.ve)
      MainWin.logmsg("ERROR: Problem interpereting audio file name: \"" + filename + "\".");
  else {
    if (ret.chs > ret.che || (ret.chs == ret.che && ret.vs > ret.ve))
        MainWin.logmsg("ERROR: Audio file chapter or verse goes in reverse: \"" + filename + "\".");
    if (ret.chs > bkobj.maxChapter || ret.che > bkobj.maxChapter)
        MainWin.logmsg("ERROR: Audio file chapter is not in book: \"" + bkobj.shortName + "\", maxChapter=\"" + bkobj.maxChapter + "\".");
    if (ret.vs > bkobj["ch" + ret.chs + "MaxVerse"])
        MainWin.logmsg("ERROR: Audio file start verse is not in: \"" + bkobj.shortName + " " + ret.chs + "\", maxVerse=\"" + bkobj["ch" + ret.chs + "MaxVerse"] + "\".");
    if (ret.ve > bkobj["ch" + ret.che + "MaxVerse"])
        MainWin.logmsg("ERROR: Audio file end verse is not in: \"" + bkobj.shortName + " " + ret.che + "\", maxVerse=\"" + bkobj["ch" + ret.che + "MaxVerse"] + "\".");
  }

//for (var m in ret) {MainWin.logmsg("ret." + m + " = " + ret[m]);} 
  
  return ret;
}

function insertAudioSubInCh(bk, ch, filename) {
  ch = Number(ch);
  var fsv = getStartVerseIfChapter(filename, ch);
  var sc = 1;
  if (!AudioFiles[bk + "-" + ch + "-" + sc]) recordFileAs(bk, ch, sc, filename);
  else {
    var inserted = false;
    var savef, lastsavef;
    // insure audio file indexes are ordered by starting verse number
    while(AudioFiles[bk + "-" + ch + "-" + sc]) {
      savef = AudioFiles[bk + "-" + ch + "-" + sc];
      var sv = getStartVerseIfChapter(savef, ch);
      if (inserted) recordFileAs(bk, ch, sc, lastsavef);
      else if (fsv <= sv) {
        if (fsv == sv) {
          MainWin.logmsg("ERROR: Two different audio files begin at the same verse: \"" + filename + "\", \"" + savef + "\"");
        }
        recordFileAs(bk, ch, sc, filename);
        inserted = true;
      }
      lastsavef = savef;
      
      sc++;
    }
    if (!inserted) recordFileAs(bk, ch, sc, filename);
    else recordFileAs(bk, ch, sc, lastsavef);
  }
}

function getStartVerseIfChapter(filename, ch) {
  var info = getAudioFileCoverage(filename);
  if (!info) return null;
  
  if (info.chs == ch) return info.vs;
  if (info.chs > ch || info.che < ch) {
    MainWin.logmsg("ERROR: Audio file \"" + filename + "\" is not a part of chapter \"" + ch + "\".");
    return null;
  }
  return 1;
}

function recordFileAs(bk, ch, subch, filename) {
  AudioFiles[bk + "-" + ch + "-" + subch] = filename;
  CheckAudioFiles[bk + "-" + ch + "-" + subch] = filename;
}


// Creates and returns information about any and all subchapters for a given chapter.
// audio subchapters will be created for each subchapter audio file
// non-audio subchapters are additionally created as follows:
// - at verse 1 if first audio subchapter doesn't start at chapter's start
// - between audio subchapters IF there is a gap between them
// - after the last audio subchapter if the final audio verse is not the last verse in the chapter
//
// ve (verse end) of -1 means "last verse in chapter"
// subchapinfo[0] is always null, so [1] represents the first subchapter
function getSubChapterInfo(bkobj, ch) {
  var subchapinfo = [null];
  var tsc;
  var sc = 1;
  var file = getAudioFile(bkobj.shortName, ch, sc);
  while (file) {
    var file = getAudioFile(bkobj.shortName, ch, sc);
    tsc = {hasAudio:file};
    var info = getAudioFileCoverage(file);
    if (info.type == "sub-chapter") {tsc.vs = info.vs; tsc.ve = info.ve;}
    else if (info.type == "multi-chapter-incomplete") {
      if (ch == info.chs) {tsc.vs = info.vs; tsc.ve = -1;}
      else if (ch == info.che) {tsc.vs = 1; tsc.ve = info.ve;}
      else MainWin.logmsg("ERROR: Illegal use of multi chapter audio file as subchapter: \"" + file + "\".");
    }
    else MainWin.logmsg("ERROR: Illegal file type for a subchapter: \"" + file + "\".");
   
    // insert a non-audio subchapter before this audio subchapter, if needed
    var prevend = (subchapinfo[subchapinfo.length-1] ? subchapinfo[subchapinfo.length-1].ve:0);
    var minv = 1;
    if (!bkobj["ch" + ch + "MinVerse"]) {
      MainWin.logmsg("Warning: Unknown min-verse for \"" + bkobj.shortName + " " + ch + "\". Assuming verse 1.");
    }			
    else minv = bkobj["ch" + ch + "MinVerse"];
    if (tsc.vs > minv && tsc.vs > (prevend+1)) {
      var tscna = {vs:prevend+1, ve:tsc.vs-1, hasAudio:null};
      subchapinfo.push(tscna);
    }
   
    subchapinfo.push(tsc);
    
    sc++;
    file = getAudioFile(bkobj.shortName, ch, sc);
  }

//for (var i=1; i<subchapinfo.length; i++) {for (var m in subchapinfo[i]) {MainWin.logmsg("1: subchapinfo[" + i + "]." + m + " = " + subchapinfo[i][m]);}} 
  
  // if audio subchapters exist, create a non-audio subchapter after the last one, if necessary
  if (tsc) {
    if (!bkobj["ch" + ch + "MaxVerse"]) {
      MainWin.logmsg("Error: Unknown max-verse for \"" + bkobj.shortName + " " + ch + "\".");
      subchapinfo[subchapinfo.length-1].ve = -1; 
    }
    if (tsc.ve == bkobj["ch" + ch + "MaxVerse"]) subchapinfo[subchapinfo.length-1].ve = -1;
    if (tsc.ve > bkobj["ch" + ch + "MaxVerse"]) {
      MainWin.logmsg("WARNING: Audio last verse is greater than max-verse for \"" + bkobj.shortName + " " + ch + "\".");
      subchapinfo[subchapinfo.length-1].ve = -1; 
    }
    
    if (subchapinfo[subchapinfo.length-1].ve != -1) subchapinfo.push({vs:(tsc.ve+1), ve:-1, hasAudio:null});
  }

//for (var i=1; i<subchapinfo.length; i++) {for (var m in subchapinfo[i]) {MainWin.logmsg("1: subchapinfo[" + i + "]." + m + " = " + subchapinfo[i][m]);}} 
 
  return subchapinfo;
}

function captureImage(imageName, imageType, returnFun) {
  ContinueFunc = null;
  
  // get image subfolder based on imagetype
  var subfolder = null;
  switch (imageType) {
	case ISMENUIMAGE:
		// just stays null
		break;
	case ISTEXTIMAGE:
		subfolder = imageName.match(/^([^-]+)-/)[1];
		break;
	case ISFOOTNOTEIMAGE:
		subfolder = imageName.match(/^fn-([^-]+)-/i)[1];
		break;
	default:
		MainWin.logmsg("ERROR: unknown image type flag \"" + imagetype + "\".");
		break;
	}
	
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
  var args = ["-window render-win", "-crop " + MainWin.PAL.W + "x" + MainWin.PAL.H + "+0+0", imgfile.path, MainWin.DBLogFile.path];
  process.run(true, args, args.length);
  
  if (returnFun) window.setTimeout(returnFun, 0);
  return imgfile;
}

// Returns listing file and transition file information for each page.
// AFTER a chapter is completed, writeStats is called so that all information 
// for that chapter is recorded into the listing and transitions files.
function getStats(pagename, textblock, hasAudio) {
  var parts = pagename.split("-");
  var book = parts[0];
  var chapter = Number(parts[1]);
  var pagenumber = Number(parts[2]);
  
  // create an object to save all page's info
  var info = new Object();
  info.hasAudio = (hasAudio ? hasAudio:"still");
  info.name = pagename;
  
  calculateReadingLength(info, textblock, MainWin.getLocaleString("LangCode"), book, chapter);
  
  if (info.len>=1) {
    if (textblock.search("class=\"majorquote\"") != -1) MainWin.logmsg("Found class=\"majorquote\" on " + pagename);

    // find transition text to be added to transition file
    var lastVerse = textblock;
    var lvi = lastVerse.lastIndexOf("<sup>");
    if (lvi != -1) {
      lastVerse = lastVerse.substr(lvi);
      var re = new RegExp("<sup>\\s*(\\d+)([\\s-]+\\d+)?\\s*<\/sup>(.*)");
      if (lastVerse) lastVerse = lastVerse.match(re);
      if (!lastVerse) {
        MainWin.logmsg("WARNING: Could not add transition to listing \"" + pagename + "\"");
        info["trans"] = "unknown\n";
      }
      else info["trans"] = pagename + "," + book + "-" + chapter + ":" + lastVerse[1] + ",{" + lastVerse[3] + "}\n";
    }
    else info["trans"] = "last_page\n";
    
    // find pageTiming.txt text-locative timings assocaited with this page to be added to listing file
    var prop = "vt_" + book + "_" + chapter;
    if (hasAudio && VerseTiming[prop]) {
      for (var i=0; i<VerseTiming[prop].length; i++) {
        if (VerseTiming[prop][i]) appendVerseTimingInfo(i, textblock, info, VerseTiming[prop]);        
      }
    }
  }
  
  return (info.len ? info:null);
}

function writeStats(book, chapterstats, overwrite) {
  // get chapter totals
  var total = 0;
	for (var i=0; i<chapterstats.length; i++) {total += chapterstats[i].len;}
  
  // create string to write to files
  var statstring = "";
	var transtring = "";
	for (i=0; i<chapterstats.length; i++) {
		statstring += formatStatString(chapterstats[i], total);
		if (chapterstats[i].a) statstring += formatStatString(chapterstats[i].a, total);
		if (chapterstats[i].b) statstring += formatStatString(chapterstats[i].b, total);
    
		transtring += chapterstats[i].trans;
	}
  
  // write the book's listing file
	var file = MainWin.StatsFile.clone();
	file.append(book + ".csv");
	if (!file.exists()) MainWin.write2File(file, "#Page,Chapter Fraction,Audio File,Number of Titles,Absolute Length,Absolute Time\n", true);
	else if (file.exists() && overwrite) { //(chapter == 0 || (chapter == 1 && !getPassage(book, true)))) {
		file.remove(false);
		MainWin.write2File(file, "#Page,Chapter Fraction,Audio File,Number of Titles,Absolute Length,Absolute Time\n", true);
	}
	MainWin.write2File(file, statstring, true);
	
  // write the book's transitions file
	file = MainWin.TransFile.clone();
	file.append(book + "-trans.csv");
	if (!file.exists()) MainWin.write2File(file, "#Page,Verse,Transition Location\n", true);
	if (file.exists() && overwrite) { //(chapter == 0 || (chapter == 1 && !getPassage(book, true)))) {
		file.remove(false);
		MainWin.write2File(file, "#Page,Verse,Transition Location\n", true);
	}
	MainWin.write2File(file, transtring, true);
}

function formatStatString(s, total) {
  var rellen = Number(Math.round(10000000*s.len/total)/10000000);
  return s.name + ", " + rellen + ", " + s.hasAudio + ", " + s.numtitles + ", " + s.len + (s.realtime ? ", " + s.realtime:"") + "\n"; 
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
    info[subo].hasAudio = info.hasAudio;                            
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
function saveFootnotes(book, pagename, screentext) {
  const NOTETXT = NOTESYMBOL + " id=\"note.";
  const NOTELST = NOTESTART + NOTEREF  + " id=\"note.";
  var html = "";
  var i = screentext.indexOf(NOTETXT);
  while (i != -1) {
    i = i + NOTETXT.length;
    var fnum = Number(screentext.substring(i).match(/^(\d+)(\D|$)/)[1]);
    var fn = new  RegExp("(" + NOTELST + fnum + "\".*)\n", "im");
    var passage = getPassage(book, false, true);
    html += (passage ? passage.match(fn)[1]:"");
    i = screentext.indexOf(NOTETXT, i);
  }
  
  if (html) PageWithFootnotes.push({name:pagename, chapter:Chapter, html:html});
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
    MainWin.write2File(fffile, Ffsep+ PageWithFootnotes[i].name +Ffsep+ PageWithFootnotes[i].chapter +Ffsep+ PageWithFootnotes[i].html + Ffsep + "\n", true);
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
      for (var i=1; i<data.length; i=i+4) {
        PageWithFootnotes.push(new Object());
        PageWithFootnotes[PageWithFootnotes.length-1].name = data[i];
        PageWithFootnotes[PageWithFootnotes.length-1].chapter = data[i+1];
        PageWithFootnotes[PageWithFootnotes.length-1].html = data[i+2];
      }
    }
  }
  
  FootnoteIndex = 0;
  IsFirstFN = true;
  Prepender = "";
  ContinueFunc = "renderNewFNScreen();";
  LastBindex=0;
  if (PageWithFootnotes[FootnoteIndex])
      MainWin.logmsg("Rendering Footnotes for page:" + PageWithFootnotes[FootnoteIndex].name + "...");
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
  var book = PageWithFootnotes[FootnoteIndex].name.match(/^([^-]+)-/i)[1];
  Bindex = getBindexFromBook(book);
  Chapter = PageWithFootnotes[FootnoteIndex].chapter;
  if (LastBindex != Bindex) {
    MainWin.logmsg("Rendering Footnotes for page:" + PageWithFootnotes[FootnoteIndex].name + "...");
    IsFirstFN=true;
  }
  LastBindex = Bindex;
  
  if (IsFirstFN) {
    Page = {passage:"", beg:0, end:0, complete:false, pagenumber:1, isNotes:false, topSplitTag:null, bottomSplitTag:null, matchTransition:null};
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
  
  initWaitRenderDone(true);

  var tstart = Page.end;
  RenderFrame.contentDocument.defaultView.fitScreen(Book[Bindex].shortName, Chapter, 0, Page, false, false);

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
    if (Page.pagenumber > 1 && (FootnoteIndex+1) < PageWithFootnotes.length && PageWithFootnotes[FootnoteIndex+1].name.match(/^([^-]+)-/i)[1]==Book[Bindex].shortName) {
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
  var pagename = "fn-" + FNPageName + "-" + Page.pagenumber;
  
  if (renderImages && !Norender) captureImage(pagename, ISFOOTNOTEIMAGE);
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
var Paint = {count:null, check:null, numcheck:0, interval:null, tinterval:10, tstable:50};
var DrawInterval;
var RenderDoneTO;
// set skipFallback if fallback init is handled elsewhere
function initWaitRenderDone(skipFallback) {
  // prepare for waitRenderDoneThenDo
  RenderFrame.contentDocument.defaultView.RenderDone = false;
  try {
    if (UseRenderDoneFallback || window.mozPaintCount===undefined) throw true;
    Paint.count = window.mozPaintCount;
    if (Paint.interval) clearInterval(Paint.interval);
    
    // this function waits until:
    //    mozPaintCount has incremented, 
    //    and LoadingImages is 0,
    //    then mozPaintCount must be stable for tstable milliseconds after that.
    // then it sets RenderDone = true
    var func  = "if (RenderFrame.contentDocument.defaultView.LoadingImages == 0 && window.mozPaintCount > Paint.count) { ";
        func += "  if (Paint.numcheck == 0 || window.mozPaintCount != Paint.check) {Paint.numcheck = 1; Paint.check = window.mozPaintCount;} ";
        func += "  else if (Paint.numcheck == Math.floor(Paint.tstable/Paint.tinterval)) { ";
        func += "     window.clearInterval(Paint.interval); ";
        func += "     RenderFrame.contentDocument.defaultView.RenderDone = true; ";
        func += "   } ";
        func += "  else Paint.numcheck++; ";
        func += "} ";
        func += "else Paint.numcheck = 0; ";
    Paint.interval = window.setInterval(func, Paint.tinterval);
  }
  catch (er) {
    // skip the firefox 3- fallback method if RenderDone is handled somewhere else
    if (!skipFallback) {
      if (RenderDoneTO) window.clearTimeout(RenderDoneTO);
      RenderDoneTO = window.setTimeout("RenderFrame.contentDocument.defaultView.setTimeout(\"window.setTimeout('RenderDone = true;', MainWin.WAIT);\", 1);", 1);
    }
  }
}

// set's SRC of image, but only if it is changing.
// also increments LoadingImages such that only after the new src
// has loaded will LoadingImages again be zero.
function setImgSrc(img, src) {
  var osrc = img.getAttribute("src");
  if (!osrc || osrc != src) {
    // can't use "RenderFrame" here because it may not be set yet
    document.getElementById("render").contentDocument.defaultView.LoadingImages++;
    img.setAttribute("src", src);
  }
}

function waitRenderDoneThenDo(funcString) {
  if (DrawInterval) window.clearInterval(DrawInterval);
  DrawInterval = window.setInterval("if (RenderFrame.contentDocument.defaultView.RenderDone) {window.clearInterval(DrawInterval); " + funcString + ";}", 10);
  //window.setTimeout(funcString, MainWin.WAIT);
}

function unloadedRender() {
  if (MainWin) {
    if (MainWin.Running) 
      MainWin.quit();
    else MainWin.resetGo();
  }
}
