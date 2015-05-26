/*  This file is part of word-dvd.

    Copyright 2015 John Austin (gpl.programs.info@gmail.com)

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
const PAGEBREAKBOTH = "<span class=\"pagebreak-both\"></span>";
const SPLITABLEDIVS = "majorquote|list1|list2|list3|footnote|canonical|x-list-1|x-list-2|x-enumlist-1|x-enumlist-2|x-enumlist-3|p|x-lg|line indent1";
const TITLES = "title-1|title-2|book-title|chapter-title|text-header|menu-header";
const ISMENUIMAGE = 0, ISTEXTIMAGE = 1, ISFOOTNOTEIMAGE = 2;
const REPAIRLEN = 64; // length of TransitionTiming repair string should be longer than pagebreak tags
const BEGINCONTENT = "<!-- BEGIN-CONTENT !-->";
const ENDCONTENT = "<!-- END-CONTENT !-->";
const COMPACT_FOOTNOTES = false;

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

  loadHTML(MainWin.ScreenHTML.path, "startMenuGeneration();", { pagetype:"TOC", masktype:"none", className:"menu" })
  // Trying to get Firefox inspector to run for debugging
  /*Components.utils.import('resource://gre/modules/devtools/dbg-server.jsm');
if (!DebuggerServer.initialized) {
  DebuggerServer.init();
  // Don't specify a window type parameter below if "navigator:browser"
  // is suitable for your app.
  //window.getAttribute("windowtype")
  //document.documentElement.getAttribute
  MainWin.jsdump("Debug Here!!!"+document.documentElement.getAttribute("windowtype"));
  DebuggerServer.addBrowserActors();
  MainWin.jsdump("Debug Here After!!!"+document.documentElement.getAttribute("windowtype"));
  //DebuggerServer.addBrowserActors("render-win");
}
  DebuggerServer.openListener(6000);*/
  
}

function loadHTML(path, runWhenDone, body) {

  // This is the user's copy of screen.html and therefore has lower
  // security priviledges for Javascript. But it's important to give 
  // the user access to this file so that project CSS can be more
  // easily developed and tested.
  //MainWin.alert("before");
  RenderFrame.contentDocument.defaultView.location.assign("file://" + path);
  //MainWin.alert("after");
  // The extra width/height should be anything large enough to prevent
  // scrollbars from appearing in the xul iframe. Captured images are
  // not effected by the extra width/height.
  RenderFrame.style.width = Number(MainWin.PAL.W + 32) + "px";
  RenderFrame.style.height = Number(MainWin.PAL.H + 32) + "px";
  
  window.setTimeout("postLoad1('" + runWhenDone + "', '" + uneval(body) + "');", 1000);
  
} function postLoad1(runWhenDone, bodyobj) {
  var bodyobj = eval(bodyobj);
  //MainWin.alert("before init");
  init(); // in screen.js
  //MainWin.alert("after init");
  var body = RenderFrame.contentDocument.getElementById("body");
  body.setAttribute("pagetype", bodyobj.pagetype);
  body.setAttribute("masktype", bodyobj.masktype);
  body.className = bodyobj.className;
  
  window.sizeToContent();
  
  //window.resizeTo(RenderFrame.boxObject.width, document.getElementById("body").boxObject.height);

  waitRenderDoneThenDo(runWhenDone);
}

function startMenuGeneration() {
  if (!MainWin.document.getElementById("skipmenus").checked) {
    MainWin.logmsg("Generating Menus...");
  
    // REMOVE MENU INFO FILE
    MenusFile = MainWin.UIfile[MainWin.OUTDIR].clone();
    MenusFile.append(MainWin.LISTING);
    MenusFile.append(MainWin.MENUSFILE);
    if (MenusFile.exists()) MenusFile.remove(false);
    MainWin.write2File(MenusFile, "#menu-name.images, atMenuEnd, image-file, image-NORM.png, image-HIGH.png, image-SEL.png\n#menu-name.button-n, target, x0, y0, x1, y1\n"); 
    
    // CREATE TABLE OF CONTENTS
    MenuEntries = [];
    for (var b=0; b<Book.length; b++) {
    
      // does book have any audio?
      var hasAudio = false;
      for (var ch=1; ch<=Book[b].maxChapter; ch++) {
        if (getAudioFile(Book[b].shortName, ch)) {hasAudio = true; break;}
      }
      
      // save new menu entry
      var entry = { target:"", label:"", className:"" }; 
      
      entry.label = MainWin.getLocaleString("FileName:" + Book[b].shortName, [Book[b].shortName]);
      if (entry.label === null) entry.label = "";
      
      entry.className = (hasAudio ? "hasAudio":"");
      if (Book[b].maxChapter > 1 || getPassage(Book[b].shortName, true)) {
        entry.target = Book[b].shortName + "-m1";
      }
      else entry.target = Book[b].shortName + "-1";
      
      MenuEntries.push(entry);

    }
    
    MenuEntryIndex = 0;
    SectionMenuNumber = 0;
    Bindex = 0;
    MenuType="TOC";
    Basename = "toc"; // is toc here, but is Book[x].shortName for submenus
    
    var body = RenderFrame.contentDocument.getElementById("body");
    body.setAttribute("pagetype", "TOC");
    body.setAttribute("masktype", "none");
    body.className = "menu";
    
    MainWin.logmsg("Rendering TOC Menu(s)...");
    window.setTimeout("renderMenuSection();", 0);
  }
  else {
    MainWin.logmsg("Skipped menu generation.");
    startTextGeneration();
  }
}

function startTextGeneration() {
  
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

var TransitionTiming = {};
var PageTiming;
function readPageTiming() {
  var ptf = MainWin.UIfile[MainWin.INDIR].clone();
  ptf.append(MainWin.PAGETIMING);
  if (ptf.exists()) {
    PageTiming = MainWin.readFile(ptf);
    if (!PageTiming) return;
    //chapter2-3-i2279 = 00:00:55.88 {tand? </p><n><p>The students say, “Yes, Ms}
    var res  = new RegExp("^\\s*[^\\-\\#]+-\\d+-i\\d+\\s*=.*\\s*$", "gm");
    var res2 = new RegExp("^\\s*(([^\\-\\#]+)-(\\d+)-i(\\d+)\\s*=\\s*([\\:\\.\\d]+)\\s*(\\{(.*)\\})?)\\s*$");
    res = PageTiming.match(res);

    if (!res) return;
    for (var i=0; i<res.length; i++) {
      var p = res[i].match(res2);
      var trans = { 
        entry:p[1], 
        book:p[2], 
        chapter:p[3], 
        index:p[4], 
        realtime:p[5],
        repair:(p[7] ? p[7].replace(/<n>/g, "\n"):"")
      };
      
      var prop = "vt_" + trans.book + "_" + trans.chapter;
      if (!TransitionTiming[prop]) TransitionTiming[prop] = [];
      TransitionTiming[prop].push(trans);
    }
  }
}

var MenuEntries, MenuEntryIndex, SectionMenuNumber, MenuType, Basename, ButtonArrayL, ButtonArrayR;
function renderMenuSection() {
  
  if (MenuEntryIndex < MenuEntries.length) {
    SectionMenuNumber++; // first menu is number 1 (not zero)
    var pagename = Basename + "-m" + SectionMenuNumber;
    
    RenderFrame.contentDocument.getElementById("body").setAttribute("pagename", pagename);
    
    // initialize button arrays (includes all dvd menu buttons)
    ButtonArrayL = [null]; // button array indexes correspond to their HTML id number, which starts at 1, so index 0 is null and unused
    ButtonArrayR = [null];
  
    for (var i=1; i<=9; i++) {
    
      var id = "p1b" + String(i);
      var objL = { isLeft:true,  target:"", label:"", className:"button", id:id, row:i, pagename:pagename, x0:0, y0:0, x1:0, y1:0 };
      
      var id = "p2b" + String(i);
      var objR = { isLeft:false, target:"", label:"", className:"button", id:id, row:i, pagename:pagename, x0:0, y0:0, x1:0, y1:0 };
      
      ButtonArrayL.push(objL);
      ButtonArrayR.push(objR);
      
    }
    
    // Handle left page...
    // using RenderFrameWindow.getComputedStyle waits for the pagename update (unlike window.getComputedStyle)
    var mdoc = RenderFrame.contentDocument;
    var skipPage = mdoc.defaultView.getComputedStyle(mdoc.getElementById("writing-left"));
    if (skipPage.display != "none") populateButtonColumn(ButtonArrayL, true);
    
    // Handle right page...
    skipPage = mdoc.defaultView.getComputedStyle(mdoc.getElementById("writing-right"));
    if (skipPage.display != "none") populateButtonColumn(ButtonArrayR, false);
    
    // create a new menu
    renderMenu((SectionMenuNumber==1), (MenuEntryIndex>=MenuEntries.length), "renderMenuSection();");
  }
  else window.setTimeout("renderChapterMenus();", 0);
  
}

function populateButtonColumn(buttonArray, isLeft) {

  var buttonCount = MainWin.getLocaleString((isLeft ? "MenuLeftButtons":"MenuRightButtons") + ":" + (MenuType == "TOC" ? "toc":Basename) + "-m" + SectionMenuNumber);
  if (buttonCount === null) buttonCount = 8;

  for (var i=1; i<=buttonCount && MenuEntryIndex < MenuEntries.length; i++) {
    
    buttonArray[i].target = MenuEntries[MenuEntryIndex].target;
    
    buttonArray[i].label  = MenuEntries[MenuEntryIndex].label;
    
    if (MenuEntries[MenuEntryIndex].className)  {
      buttonArray[i].className += " " + MenuEntries[MenuEntryIndex].className;
    }
        
    MenuEntryIndex++;
  }
  
}

function renderChapterMenus() {

  if (Bindex < Book.length) {
  
    SubChapters = 0;
    var intro = getPassage(Book[Bindex].shortName, true);
    if (Book[Bindex].maxChapter > 1 || intro) {
    
      MenuEntries = [];
      for (var c=0; c<=Book[Bindex].maxChapter; c++) {
        if (c==0 && !intro) continue;
        
        var scs = getSubChapterInfo(Book[Bindex], c);
        
//for (var m=0; m<scs.length; m++) {MainWin.logmsg("scs[" + m + "] = " + (scs[m] ? uneval(scs[m]):"null"));}
        
        // get sub-chapter presentation settings
        var subChapShowAll = MainWin.getLocaleString("SubChapShowAll");
        var subChapNoHeading = MainWin.getLocaleString("SubChapNoHeading");
        var subChapNoHeadingButton = MainWin.getLocaleString("SubChapNoHeadingButton");
        
        subChapShowAll = (subChapShowAll && subChapShowAll.toLowerCase() == "true");
        subChapNoHeading = (subChapNoHeading && subChapNoHeading.toLowerCase() == "true");
        subChapNoHeadingButton = (subChapNoHeadingButton && subChapNoHeadingButton.toLowerCase() == "true");
        
        // If there are no subchapters, or there are subchapters and we want a group heading...
        if (scs.length == 1 || !subChapNoHeading) {
        
          var entry = { label:"", target:"", className:"" };
          
          if (c == 0) entry.label = MainWin.getLocaleString("IntroText:" + Book[Bindex].shortName);
          else entry.label = MainWin.getLocaleString("ChapName:" + Book[Bindex].shortName + "-" + c, [Book[Bindex].shortName, c]);
          
          // We have subchapters and want a heading, but the heading should not be selectable
          if (scs.length > 1 && subChapNoHeadingButton) {
            entry.target = "notarget"; // notarget means it doesn't get entered into the menu.csv file as a button
            entry.className = "not-selectable";
          }
          
          // Then this button is selectable (as normal)
          else {
            entry.target = Book[Bindex].shortName + "-" + Number(c + SubChapters);
            
            var hasAudio = (scs.length > 1 ? scs[1].hasAudio:getAudioFile(Book[Bindex].shortName, c, 0));
            if (hasAudio) entry.className = "hasAudio";
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
            
            entry = { label:"", target:"", className:"" }
            
            var ve = scs[sc].ve;
            if (ve == -1) ve = Book[Bindex]["ch" + c + "MaxVerse"];
            
            entry.label = MainWin.getLocaleString("SubChaptext:" + Book[Bindex].shortName + "-" + c, [Book[Bindex].shortName, c, scs[sc].vs, ve]);
            entry.target = Book[Bindex].shortName + "-" + Number(c + SubChapters);
            if (scs[sc].hasAudio) entry.className = "hasAudio";
            
            MenuEntries.push(entry);
          }
        }
        
      }
      
//for (var m=0; m<MenuEntries.length; m++) {MainWin.logmsg("MenuEntries[" + m + "] = " + uneval(MenuEntries[m]));}

      MenuEntryIndex = 0;
      SectionMenuNumber = 0;
      MenuType = "CHP";
      Basename = Book[Bindex].shortName;
      
      var body = RenderFrame.contentDocument.getElementById("body");
      body.setAttribute("pagetype", "CHP");
      body.setAttribute("masktype", "none");
      body.className = "menu";
      
      MainWin.logmsg("Rendering Chapter Menu(s):" + Basename + "...");
      window.setTimeout("renderMenuSection();", 0);
      Bindex++;
      
    }
    else {
      Bindex++;
      window.setTimeout("renderChapterMenus();", 0);
    }
    
  }
  else window.setTimeout("startTextGeneration();", 0);
  
}

function renderMenu(isFirstMenu, isLastMenu, returnFun) {

  var menubase   = ButtonArrayL[1].pagename.match(/^(.*?)-m(\d+)$/)[1];
  var menunumber = Number(ButtonArrayL[1].pagename.match(/^(.*?)-m(\d+)$/)[2]);
  
  var menuname = menubase + "-m" + menunumber;
  var prevmenu = menubase + "-m" + String(menunumber-1);
  var nextmenu = menubase + "-m" + String(menunumber+1);
  
  var headerLeft = "";
  var headerRight = "";
  ButtonArrayL[9].target = (isFirstMenu ? (menubase=="toc" ? "":"toc-m1"):prevmenu);
  ButtonArrayR[9].target = (isLastMenu ? "":nextmenu);
  
  const locnames  = ["MenuTopLeft", "MenuTopRight", "MenuBottomRight", "MenuBottomLeft"];
  for (var i=0; i<locnames.length; i++) {
  
    var bk = (MenuType == "CHP" ? MainWin.getLocaleString("FileName:" + Book[Bindex-1].shortName, [Book[Bindex-1].shortName]):null);

    var label = MainWin.getLocaleString(
      locnames[i] + ":" + menuname, 
      (MenuType == "CHP" ? [MainWin.getLocaleString("FileName:" + Book[Bindex-1].shortName)]:null)
    );
    var target = MainWin.getLocaleString(locnames[i] + "Target:" + menuname);
    
    switch(locnames[i]) {
    case "MenuTopLeft":
      headerLeft = label;
      break;
    case "MenuTopRight":
      headerRight = label;
      break;
    case "MenuBottomRight":
      if (label) ButtonArrayR[9].label = label;
      if (target) ButtonArrayR[9].target = target;
      break;
    case "MenuBottomLeft":
      if (label) ButtonArrayL[9].label = label;
      if (target) ButtonArrayL[9].target = target;
      break;
    }

  }
  
  // page 1
  var mdoc = RenderFrame.contentDocument;
  applyHeader(headerLeft, mdoc.getElementById("menu-header-left"));
  applyButtonList(ButtonArrayL, true);
  
  // page 2
  applyHeader(headerRight, mdoc.getElementById("menu-header-right"));
  applyButtonList(ButtonArrayR, false);
  
  if (MainWin.Aborted) return;

  MenuRenderReturnFunc = returnFun;
  var func = "captureImage('" + ButtonArrayL[1].pagename + "', " + ISMENUIMAGE + ", 'captureMenuMask();');";
  if (!MainWin.Paused) waitRenderDoneThenDo(func);
  else ContinueFunc = func;

}

var MenuRenderReturnFunc;
function captureMenuMask() {
  
  var body = RenderFrame.contentDocument.getElementById("body");
  
  var isHighlight = (body.getAttribute("masktype") == "highlight");
    
  body.setAttribute("masktype", (!isHighlight ? "highlight":"select"));
  
  waitRenderDoneThenDo("captureMask();");
}

function captureMask() {
  
  var body = RenderFrame.contentDocument.getElementById("body");
  var isHighlight = (body.getAttribute("masktype") == "highlight");
  
  // capture and save the mask
  var capture = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  capture.initWithPath(MainWin.UIfile[MainWin.OUTDIR].path + "/" + MainWin.SCRIPT + "/" + MainWin.SCRIPTDIR + "/" + MainWin.CAPTUREMASK);
  
  var imageName = ButtonArrayL[1].pagename + (isHighlight ? "-HIGH":"-SEL") + ".png";
      
  var imgfile = MainWin.UIfile[MainWin.OUTDIR].clone();
  imgfile.append(MainWin.IMGDIR);
  imgfile.append(MainWin.MASKDIR);
  if (!imgfile.exists()) {imgfile.create(imgfile.DIRECTORY_TYPE, 511);}
  imgfile.append(imageName);
  
  // get color which will be converted to transparent
  var color = RenderFrame.contentDocument.defaultView.getComputedStyle(RenderFrame.contentDocument.getElementById("body"));
  color = color.backgroundColor;
  
  var process = Components.classes["@mozilla.org/process/util;1"]
                    .createInstance(Components.interfaces.nsIProcess);

  process.init(capture);
  var args = ["-window render-win", "-crop " + MainWin.PAL.W + "x" + MainWin.PAL.H + "+0+0", imgfile.path, color, MainWin.DBLogFile.path];
  process.run(true, args, args.length);
  
  // save the mask button data
  if (isHighlight) {
    getMaskButtonData(ButtonArrayL);
    getMaskButtonData(ButtonArrayR);
  }
  /* DEBUG CODE
  else {
    var elems = RenderFrame.contentDocument.getElementsByClassName("removeme");
    while(elems.length) {elems[0].parentNode.removeChild(elems[0]);}
  } */

  // call next function
  if (isHighlight) captureMenuMask();
  else {
    body.setAttribute("masktype", "none");
    writeMenuData();
    window.setTimeout(MenuRenderReturnFunc, 1);
  }
  
}

function getMaskButtonData(buttonArray) {
  
  for (var i=1; i<=9; i++) {
  
    var b = buttonArray[i];
    var buttonMask = RenderFrame.contentDocument.getElementById(b.id).getElementsByClassName("button-mask")[0];
    
    var os = findPos(buttonMask);
    
    b.x0 = os.left;
    b.y0 = os.top;
    b.x1 = os.left + buttonMask.offsetWidth;
    b.y1 = os.top + buttonMask.offsetHeight;
    
/* DEBUG CODE
    var elem = document.createElement("div");
    elem.className = "removeme";
    elem.style.border = "1px solid red";
    elem.style.position = "absolute";
    elem.style.top = b.y0 + "px";
    elem.style.left = b.x0 + "px";
    elem.style.width = Number(b.x1 - b.x0) + "px";
    elem.style.height = Number(b.y1 - b.y0) + "px";
    RenderFrame.contentDocument.getElementById("body").appendChild(elem);
*/    
  } 
}

function findPos(obj) {
	var curleft, curtop;
	curleft = curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
			obj = obj.offsetParent
		} while (obj);
	}
	return {left:curleft, top:curtop};
}

function writeMenuData() {
  
  // write data for images and button mask positions
  var b = ButtonArrayL[1];
  
  var atMenuEnd = MainWin.getLocaleString("AtMenuEnd:" + b.pagename);
  if (!atMenuEnd) atMenuEnd = "default";
  if (atMenuEnd == "continue") {
    MainWin.logmsg("ERROR: atMenuEnd value:\"" + atMenuEnd + "\" not supported.\n");
    atMenuEnd = "default";    
  }
  if (!(/^(loop|pause|default)(\([\d\.]+\))?$/).test(atMenuEnd)) {
    MainWin.logmsg("ERROR: Bad atMenuEnd value:\"" + atMenuEnd + "\"\n");
    atMenuEnd = "default";
  }
  
  // image paths are relative to the MenusFile itself
  var data;
  data  = b.pagename + ".images, ";
  data += atMenuEnd + ", ";
  data += "../" + MainWin.IMGDIR + "/" + b.pagename + ".jpg, ";
  data += "../" + MainWin.IMGDIR + "/" + MainWin.TRANSIMAGE + ", ";
  data += "../" + MainWin.IMGDIR + "/" + MainWin.MASKDIR + "/" + b.pagename + "-HIGH.png, ";
  data += "../" + MainWin.IMGDIR + "/" + MainWin.MASKDIR + "/" + b.pagename + "-SEL.png\n";
  MainWin.write2File(MenusFile, data, true);
  
  var audiofileName = MainWin.getLocaleString("AudioPrefix");
  if (audiofileName) audiofileName += "-";
  audiofileName += b.pagename + ".ac3";
  
  var audiofile = MainWin.UIfile[MainWin.AUDIO].clone();
  audiofile.append(audiofileName);
  if (audiofile.exists()) {
    MainWin.write2File(MenusFile, b.pagename + ".audio, " + audiofileName + "\n", true);
  }
  
  for (var i=1; i<=9; i++) {
    if (ButtonArrayL[i].target && ButtonArrayL[i].target != "notarget") {
      MainWin.write2File(MenusFile, formatMenuString(ButtonArrayL[i]), true);
    }
  }
  
  for (var i=1; i<=9; i++) {
    if (ButtonArrayR[i].target && ButtonArrayR[i].target != "notarget") {
      MainWin.write2File(MenusFile, formatMenuString(ButtonArrayR[i]), true);
    }
  }
  
}

function formatMenuString(b) {
  
    // The renderer uses two rows of 9 buttons each, but dvdauthor uses
    // buttons numbered 1 through 18.
    var data;
    data  = b.pagename + ".button-" + String(b.row + (b.isLeft ? 0:9)) + ", ";
    data += b.target + ", " + b.x0 + ", " + b.y0 + ", " + b.x1 + ", " + b.y1 + "\n";
  
  return data;
}

function applyButtonList(buttonArray, isLeft) {
  
  for (var i=1; i<=9; i++) {
    
    var domButton = RenderFrame.contentDocument.getElementById(buttonArray[i].id);
    
    // add special button classes where appropriate
    if (!buttonArray[i].target) buttonArray[i].className += " notarget";
    
    if (i == 9 && !buttonArray[i].label) buttonArray[i].className += " arrow";
    
    // apply label and class to DOM button element
    domButton.className = buttonArray[i].className;
    domButton.getElementsByTagName("div")[0].innerHTML = buttonArray[i].label;

  }

}

// Adjust page header to fit inside max-width.
var MenuHeaders = {};
function applyHeader(text, elem) {
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
        if (MenuHeaders[text]) elem.innerHTML = MenuHeaders[text];
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
            MenuHeaders[text] = elem.innerHTML;
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
}

function initBookGlobals(finishedIntro) {
  finishedIntro = (finishedIntro ? true:false);

  Page = {passage:"", beg:0, end:0, complete:false, pagenumber:1, isNotes:false, topSplitTag:null, bottomSplitTag:null, matchTransition:null};
  ILastPage = 0;
  
  var bookfile = MainWin.UIfile[MainWin.INDIR].clone();
  bookfile.append(MainWin.HTMLDIR);
  bookfile.append(Book[Bindex].shortName + ".html");
  if (!finishedIntro) {
    loadHTML(bookfile.path, "initBookGlobals2(" + finishedIntro + ");", { pagetype:"TEXT", masktype:"none", className:"text" });
  }
  else initBookGlobals2(finishedIntro);
  
} function initBookGlobals2(finishedIntro) {

  SubChapters = 0;
  SubChap = 0;
  var intro = getPassage(Book[Bindex].shortName, true);
  if (!intro || finishedIntro) {
    Chapter = 1;
    Page.passage = getPassage(Book[Bindex].shortName);
  }
  else {
    Chapter = 0;
    Page.passage = intro;
  }
  if (!finishedIntro) Book[Bindex].overwriteStats = true;
  MainWin.logmsg("Rendering Pages for Book:" + Book[Bindex].shortName + "...");
  
  if (MainWin.Aborted) return;
  else if (!MainWin.Paused) renderNewScreen();
  else ContinueFunc = "renderNewScreen();";
  
}

function renderNewScreen() {
//MainWin.jsdump("Starting fit:" + Book[Bindex].shortName + " " + Chapter + ", s=" + Page.beg + ", e=" + Page.end);

  ContinueFunc = null;
  var mdoc = RenderFrame.contentDocument;

  // add class rendering; class=rendering will be used in css to switch overflow to 'scroll' while rendering
  var b = RenderFrame.contentDocument.getElementsByTagName("body")[0];
  var bodyclasses= b.classList;
  bodyclasses.add('rendering');
  Page.pagebreakboth = false;
  var pageName = Book[Bindex].shortName + (Chapter==0 ? ".intr":"") + "-" + Number(Chapter+SubChapters) + "-" + Page.pagenumber;
  RenderFrame.contentDocument.getElementById("body").setAttribute("pagename", pageName);
  MainWin.jsdump("Pagename :"+pageName);

  var tstyle = mdoc.defaultView.getComputedStyle(mdoc.getElementById("writing-left"), null);
  var skipPage1 = (tstyle.display == "none"); // this allows single column display
  
  tstyle = mdoc.defaultView.getComputedStyle(mdoc.getElementById("writing-right"), null);
  var skipPage2 = (tstyle.display == "none");

  fitScreen(Book[Bindex].shortName, Chapter, SubChapters, Page, skipPage1, skipPage2);
   
  // remove class 'rendering'
  bodyclasses.remove('rendering');
  
  waitRenderDoneThenDo("screenDrawComplete()");
  MainWin.jsdump("LEFT:" + RenderFrame.contentDocument.getElementsByTagName("body")[0].innerHTML);
  
//MainWin.jsdump("LEFT:" + RenderFrame.contentDocument.getElementById("left-page").innerHTML);
//MainWin.jsdump("RIGHT:" + RenderFrame.contentDocument.getElementById("right-page").innerHTML);
}

function screenDrawComplete() {
  var imginfo = saveScreenImages(Book[Bindex], Chapter, SubChap, SubChapters, Page, ILastPage);
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
  if (imginfo.skippedLastPage) Page.pagenumber--; // adjust because this page was skipped!
  if (Page.complete) {
    if (Chapter == 0) {
      initBookGlobals(true);
      return;
    }
    else {
      writeBookEnd(Bindex);
      writeFootnotesToFile(Book[Bindex].shortName);
      Bindex++;
      if (Bindex == Book.length || !Book[Bindex]) {
        startFootnoteGeneration();
        return;
      }
      initBookGlobals();
      return;
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

  var beg = html.indexOf(BEGINCONTENT);
  if (beg > -1) beg += BEGINCONTENT.length;
  else beg = 0;
 
  var end = html.lastIndexOf(ENDCONTENT);
  if (end < beg) end = beg;

  return html.substring(beg, end);
}

// If a text block is empty then don't save an image for it, only data.
// Each non-empty text block saves image and data UNLESS the previous 
//   text block is non-audio, in which case, the new text block may be 
//   skipped entirely.
// Footnotes for an entire screen need to be saved only once.
var ReportedAudioFiles = {};
var ChapterStats = [];
function saveScreenImages(bkobj, chapter, subchap, subchapters, page, ilastPage) {
  var book = bkobj.shortName;
  var renderImages = !MainWin.document.getElementById("images").checked;
  var isAudio = false;
  
  // process this screen as a series of "text-blocks", each of which 
  // has different data but an identical image associated with it
  var tblock = {
    passage:page.passage.substring(ilastPage, page.end), 
    beg:-1, // for all but the first tblock, beg is the-actual-beg+1, to prevent duplication
    end:0, 
    inc:0, 
    endtype:-1, 
    hasAudio:null, 
    chapter:chapter, 
    subchap:subchap, 
    subchapters:subchapters, 
    pagenumber:page.pagenumber
  };
  
  var tblocks = [];
  while (tblock.endtype != "screen-end") {
		tblock.beg = tblock.end+tblock.inc;
		setTextBlock(tblock, bkobj, (ilastPage == 0 && tblock.beg == 0));
 
    // copy and save this tblock for a later loop (so we can know the future there)
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
  var skippedLastTblock = false;
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
      
      // report any audio file usage
      if (tblocks[i].hasAudio && !ReportedAudioFiles[tblocks[i].hasAudio]) {
        MainWin.logmsg("Utilizing audio file: " + tblocks[i].hasAudio);
        ReportedAudioFiles[tblocks[i].hasAudio] = true;
        for (var k in CheckAudioFiles) {
          if (CheckAudioFiles[k] == tblocks[i].hasAudio) CheckAudioFiles[k] = "";
        }
      }
      
      // save the page's info and image for this text block
      var tbbeg = (ilastPage+tblocks[i].beg);
      if (tblocks[i].beg > 0) tbbeg--; // all tblocks but the first need this to get to the actual beginning
      var tbend = (ilastPage+tblocks[i].end);
      var info = getStats(pagename, page, tbbeg, tbend, tblocks[i].hasAudio);
//var t = "info\n"; for (var m in info) {t += m + "=" + info[m] + "\n";} MainWin.logmsg(t);

      if (info) {
        ChapterStats.push(info);
        if (renderImages) {
          if (!imgfile) imgfile = captureImage(pagename, ISTEXTIMAGE);
          else imgfile.copyTo(null, pagename + "." + imgfile.leafName.match(/\.(.*)$/)[1]);
        }
        if (!footNotesSaved) saveFootnotes(book, pagename, page.passage.substring(ilastPage, page.end));
        footNotesSaved = true;
      }
      // if we just skipped the last tblock, then our return values should be those of the last good one!
      else if (i == tblocks.length-1) skippedLastTblock = true;
      
		}
    
    // save previous chapter info anytime a chapter is finished
		if (tblocks[i].endtype == "chapter" || tblocks[i].endtype == "subchap"  || (tblocks[i].endtype == "screen-end" && page.complete)) {
			writeStats(book, ChapterStats, bkobj.overwriteStats);
      ChapterStats = [];
      bkobj.overwriteStats = false;
    }
  }
  
  return {chapter:tblock.chapter, subchap:tblock.subchap, subchapters:tblock.subchapters, skippedLastPage:skippedLastTblock};
}

// Sets the .hasAudio, .end, and .endType parameters of the passed tblock.
function setTextBlock(tblock, bkobj, skipFirstChtag) {
  var ch = tblock.chapter;
  var subch = tblock.subchap;
  
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
    recordDirectoryAudioFiles(audiodir, audiodir.path);
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

function recordDirectoryAudioFiles(audiodir, root) {
	var files = audiodir.directoryEntries;
	while (files.hasMoreElements()) {
		var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
		if (file.isDirectory()) {
			recordDirectoryAudioFiles(file, root);
			continue;
		}
		
		var audiofile = getAudioFileCoverage(file.leafName);
		var audioSubPath = file.path.replace(root + "/", "");
		
		if (!audiofile) {
			MainWin.logmsg("WARNING: Skipping file in audio directory: \"" + audioSubPath + "\"");
			continue;
		}
		
		var ap = MainWin.getLocaleString("AudioPrefix");
		if (ap && audiofile.ap!=ap) {
			MainWin.logmsg("WARNING: Skipping audio file. Audio code is other than specified in config.txt (AudioPrefix = " + ap + "): \"" + audioSubPath + "\"");
			continue;      
		}
		
		var bkobj = Book[getBindexFromBook(audiofile.bk)];
		for (var ch = audiofile.chs; ch <= audiofile.che; ch++) {
			if (audiofile.type == "chapter" || audiofile.type == "multi-chapter") 
					recordFileAs(audiofile.bk, ch, 0, audioSubPath);
					
			else if (audiofile.type == "sub-chapter") 
					insertAudioSubInCh(audiofile.bk, ch, audioSubPath);
					
			else if (audiofile.type == "multi-chapter-incomplete") {
				if (ch == audiofile.chs) {
					if (audiofile.vs == bkobj["ch" + audiofile.chs + "MinVerse"])
							recordFileAs(audiofile.bk, ch, 0, audioSubPath);
					else insertAudioSubInCh(audiofile.bk, ch, audioSubPath);
				}
				else if (ch == audiofile.che) {
					if (audiofile.ve == bkobj["ch" + audiofile.che + "MaxVerse"]) recordFileAs(audiofile.bk, ch, 0, audioSubPath);
					else insertAudioSubInCh(audiofile.bk, ch, audioSubPath);          
				}
				else recordFileAs(audiofile.bk, ch, 0, audioSubPath);
			}
		}
	}
}

// parses all audio file names and returns an object with complete coverage information
// does sanity checking and reporting as well
function getAudioFileCoverage(filename) {
  var AudioFileRE1 = new RegExp(/^(([^-]+)-)?([^-]+)-(\d+):(\d+)-(\d+):(\d+)\.ac3$/);
  var AudioFileRE2 = new RegExp(/^(([^-]+)-)?([^-]+)-(\d+):(\d+)-(\d+)\.ac3$/);
  var AudioFileRE3 = new RegExp(/^(([^-]+)-)?([^-]+)-(\d+)-(\d+)\.ac3$/);
  var AudioFileRE4 = new RegExp(/^(([^-]+)-)?([^-]+)-(\d+)\.ac3$/);
  
  var f = filename.match(AudioFileRE1);
  if (f) f[0] = 1;
  else {
		f = filename.match(AudioFileRE2);
		if (f) f[0] = 2;
		else {
			f = filename.match(AudioFileRE3);
			if (f) f[0] = 3;
			else {
				f = filename.match(AudioFileRE4);
				if (f) f[0] = 4;
			}
		}
	}
  if (!f) return null;
  
  var bkobj = Book[getBindexFromBook(f[3])];
  
  if (!bkobj) return null; // skip this audio file if its book is not being run
  
  for (i=4; i<f.length; i++) {f[i] = Number(f[i]);}
  
  var type, ret;
	switch (f[0]) {
	case 1:
    type = "multi-chapter-incomplete";
    if (f[4] == f[6]) {
      if (f[5] == bkobj["ch" + f[4] + "MinVerse"] && f[7] == bkobj["ch" + f[4] + "MaxVerse"]) type = "chapter";
      else type = "sub-chapter";
    }
    else if (f[5] == bkobj["ch" + f[4] + "MinVerse"] && f[7] == bkobj["ch" + f[6] + "MaxVerse"]) type = "multi-chapter";
    ret = {
			type:type, 
			ap:f[2], 
			bk:f[3], 
			chs:f[4], 
			che:f[6], 
			vs:f[5], 
			ve:f[7]
		};
		break;
		
	case 2:
		type = "sub-chapter";
		if (f[5] == bkobj["ch" + f[4] + "MinVerse"] && f[6] == bkobj["ch" + f[4] + "MaxVerse"]) type = "chapter";
		ret = {
			type:type, 
			ap:f[2], 
			bk:f[3], 
			chs:f[4], 
			che:f[4], 
			vs:f[5], 
			ve:f[6]
		};
		break;
		
	case 3:
		ret = {
			type:"multi-chapter",
			ap:f[2], 
			bk:f[3], 
			chs:f[4], 
			che:f[5], 
			vs:(bkobj["ch" + f[4] + "MinVerse"] ? bkobj["ch" + f[4] + "MinVerse"]:1), 
			ve:(bkobj["ch" + f[5] + "MaxVerse"] ? bkobj["ch" + f[5] + "MaxVerse"]:1)
		};
		break;
		
	case 4:
		ret = {
			type:"chapter", 
			ap:f[2], 
			bk:f[3], 
			chs:f[4], 
			che:f[4], 
			vs:(bkobj["ch" + f[4] + "MinVerse"] ? bkobj["ch" + f[4] + "MinVerse"]:1), 
			ve:(bkobj["ch" + f[4] + "MaxVerse"] ? bkobj["ch" + f[4] + "MaxVerse"]:1)
		};
		break	;
	}
   
  // now sanity check file coverage and report
  if (!ret.type || !ret.bk || (!ret.chs && ret.chs!=0) || (!ret.che && ret.che!=0) || !ret.vs || !ret.ve)
      MainWin.logmsg("ERROR: Problem interpereting audio file name: \"" + filename + "\": " + uneval(ret));
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

function insertAudioSubInCh(bk, ch, fileSubPath) {
  ch = Number(ch);
  
  var fsv = getStartVerseIfChapter(fileSubPath, ch);
  var sc = 1;
  if (!AudioFiles[bk + "-" + ch + "-" + sc]) recordFileAs(bk, ch, sc, fileSubPath);
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
          MainWin.logmsg("ERROR: Two different audio files begin at the same verse: \"" + fileSubPath + "\", \"" + savef + "\"");
        }
        recordFileAs(bk, ch, sc, fileSubPath);
        inserted = true;
      }
      lastsavef = savef;
      
      sc++;
    }
    if (!inserted) recordFileAs(bk, ch, sc, fileSubPath);
    else recordFileAs(bk, ch, sc, lastsavef);
  }
}

function getStartVerseIfChapter(fileSubPath, ch) {
	var filename = fileSubPath.replace(/^.*\//, "");
  var info = getAudioFileCoverage(filename);
  if (!info) return null;
  
  if (info.chs == ch) return info.vs;
  if (info.chs > ch || info.che < ch) {
    MainWin.logmsg("ERROR: Audio file \"" + fileSubPath + "\" is not a part of chapter \"" + ch + "\".");
    return null;
  }
  return 1;
}

function recordFileAs(bk, ch, subch, fileSubPath) {
  AudioFiles[bk + "-" + ch + "-" + subch] = fileSubPath;
  CheckAudioFiles[bk + "-" + ch + "-" + subch] = fileSubPath;
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
  capture.initWithPath(MainWin.UIfile[MainWin.OUTDIR].path + "/" + MainWin.SCRIPT + "/" + MainWin.SCRIPTDIR + "/" + MainWin.CAPTURE);
 
  imageName += ".jpg";
      
  var imgfile = MainWin.UIfile[MainWin.OUTDIR].clone();
  imgfile.append(MainWin.IMGDIR);
  if (subfolder) {
   imgfile.append(subfolder);
   if (!imgfile.exists()) imgfile.create(imgfile.DIRECTORY_TYPE, 511);
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
function getStats(pagename, page, beg, end, hasAudio) {
  var textblock = page.passage.substring(beg, end);
  
  var parts = pagename.split("-");
  var book = parts[0];
  var chapter = Number(parts[1]);
  var pagenumber = Number(parts[2]);
  
  // create an object to save all page's info
  var info = new Object();
  info.hasAudio = (hasAudio ? hasAudio:"still");
  info.name = pagename;
  
  calculateReadingLength(info, textblock, MainWin.getLocaleString("LangCode"), book, chapter);
  
  if (info.len >= 1) {
    if (textblock.search("class=\"majorquote\"") != -1) MainWin.logmsg("INFO: Found class=\"majorquote\" on " + pagename);

    // Find transition text to be added to the transition file. The transition
    // file is only needed by transitions.pl so that if transitions are
    // manually recorded, a text-locative entry can be made in pageTiming.txt.
    // After text-locative entries are added to pageTiming.txt, then while the
    // project is being re-rendered, these entries are reported in the -trans 
    // file, along with the usual data. This allows correlation of real 
    // times to calculated times, thus greatly improving calculation accuracy.
    info["trans"] = pagename + "," + end + ",{" + page.passage.substring((end-REPAIRLEN < 0 ? 0:end-REPAIRLEN), end).replace(/\n/g, "<n>") + "}\n";
    
    // find pageTiming.txt text-locative timings associated with this page (later to be added to listing file)
    var prop = "vt_" + book + "_" + chapter;
    if (hasAudio && TransitionTiming[prop]) {
      for (var i=0; i<TransitionTiming[prop].length; i++) {
        var vt = TransitionTiming[prop][i];
        if (!vt || vt.failed) continue;
        
        // check and repair (if needed) this TransitionTiming index
        vt.failed = (checkAndRepairTransitionTiming(vt, page, false) === null ? true:false);

        // skip if this TransitionTiming index does not apply to the current page
        if (vt.index <= beg || vt.index > end) continue;
        
        var ni = {};
        calculateReadingLength(ni, page.passage.substring(beg, vt.index), MainWin.getLocaleString("LangCode"), vt.book, vt.chapter);
        
        // the transition calculator only allows two TransitionTiming entries per page
        var a = "a";                                              
        if (info[a]) a = "b";
        
        // save all our data for later writing to the listing file
        info[a] = {};                                           
        info[a].name = pagename + a;  
        info[a].realtime = vt.realtime;          
        info[a].numtitles = ni.numtitles;                  
        info[a].len = (vt.failed ? 0:ni.len); // 0 is error condition so entry will be ignored in calculations
        info[a].hasAudio = info.hasAudio; 
        
        TransitionTiming[prop][i] = null;    
      }
    }
  }
  
  return (info.len ? info:null);
}

// Checks the TransitionTiming entry to see if the index is correct. If not,
// it tries to correct it. The TransitionTiming index is returned, or -1 if 
// the correct TransitionTiming index is known to no longer exist or cannot   
// be reliably determined.
function checkAndRepairTransitionTiming(vt, page, nolog) {
  var fail = false;
  
  if (!vt.repair) {
    if (!nolog) MainWin.logmsg("WARNING: Unable to verify TransitionTiming index. This TransitionTiming entry may help, or may hurt, transition accuracy: \"" + vt.entry + "\"");
  }
  else if (page.passage.substring((vt.index-REPAIRLEN < 0 ? 0:vt.index-REPAIRLEN), vt.index) != vt.repair) {
    
    var repair = new RegExp("(" + MainWin.escapeRE(vt.repair) + ")", "gm");
    var m = page.passage.match(repair);

    if (!m) {
      if (!nolog) MainWin.logmsg("WARNING: TransitionTiming index has changed and could not be located and repaired. This TransitionTiming entry will be skipped: \"" + vt.entry + "\"");
      fail = true;
    }
    else if (m.length > 1) {
      if (!nolog) MainWin.logmsg("WARNING: TransitionTiming index has changed and could not be repaired. This TransitionTiming entry will be skipped: \"" + vt.entry + "\"");
      fail = true;
    }
    else {
      vt.index = page.passage.indexOf(vt.repair) + vt.repair.length;
      if (!nolog) MainWin.logmsg("INFO: TransitionTiming index needed repairing but it was repaired: \"" + vt.entry + "\"");
    }
  }
  //else {MainWin.logmsg("INFO: TransitionTiming was found at original index: \"" + vt.entry + "\"");}
  
  return (!fail ? vt.index:null);
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
  if (file.exists() && overwrite) file.remove(false);
  if (!file.exists()) MainWin.write2File(file, "#Page,AtPageEnd,AtChapterEnd,Calculated_Chapter_Fraction,Audio_File,Number_of_Titles,Calculated_Total_Length,Absolute_Time\n", false);
  MainWin.write2File(file, statstring, true);
	
  // write the book's transitions file
	file = MainWin.TransFile.clone();
	file.append(book + "-trans.csv");
  if (file.exists() && overwrite) file.remove(false);
  if (!file.exists()) MainWin.write2File(file, "#Page,Transition_Index,{Repair_String}\n", false);
	MainWin.write2File(file, transtring, true);
}

function formatStatString(s, total) {
	
  var atPageEnd = MainWin.getLocaleString("AtPageEnd:" + s.name);
  if (!atPageEnd) atPageEnd = "default";
  if (!(/^(loop|continue|pause|default)(\([\d\.]+\))?$/).test(atPageEnd)) {
    MainWin.logmsg("ERROR: Bad atPageEnd value:\"" + atPageEnd + "\"\n");
    atPageEnd = "default";
  }
  
  var atChapterEnd = MainWin.getLocaleString("AtChapterEnd:" + s.name);
  if (!atChapterEnd) atChapterEnd = "default";
  if (!(/^(loop|continue|pause|default)(\([\d\.]+\))?$/).test(atChapterEnd)) {
    MainWin.logmsg("ERROR: Bad atChapterEnd value:\"" + atChapterEnd + "\"\n");
    atChapterEnd = "default";
  }
  
  var rellen = Number(Math.round(10000000*s.len/total)/10000000);
  return s.name + ", " + atPageEnd + ", " + atChapterEnd + ", " + rellen + ", " + s.hasAudio + ", " + s.numtitles + ", " + s.len + (s.realtime ? ", " + s.realtime:"") + "\n"; 
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
  if (!fffile.exists()) fffile.create(fffile.DIRECTORY_TYPE, 511);
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
  FNLast.bindex = 0;
  FNLast.chapter = 0;
  FNLast.page = 0;
  
  var body = RenderFrame.contentDocument.getElementById("body");
  body.setAttribute("pagetype", "FOOTNOTE");
  body.setAttribute("masktype", "none");
  body.className = "text";
  
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
var FNLast = {bindex:0, chapter:0, page:0};
// To start with, the passage consists of a single note. If it fits 
// (Page.complete), then another note is added to the passage until
// the passage no longer fits. The second to last try is saved. 
function renderNewFNScreen() {
  ContinueFunc = null;
  var book = PageWithFootnotes[FootnoteIndex].name.match(/^([^-]+)-/i)[1];
  //alert("Book : "+book+":"+PageWithFootnotes[FootnoteIndex].name+" : "+FootnoteIndex);
  Bindex = getBindexFromBook(book);
  //alert("Bindex : "+Bindex);
  Chapter = PageWithFootnotes[FootnoteIndex].chapter;
  var rpage = PageWithFootnotes[FootnoteIndex].name.match(/-([^-]+)$/i)[1];
  if (FNLast.bindex != Bindex || 
			(!COMPACT_FOOTNOTES && FNLast.chapter != Chapter) ||
			(!COMPACT_FOOTNOTES && FNLast.page != rpage)) {
    MainWin.logmsg("Rendering Footnotes for page:" + PageWithFootnotes[FootnoteIndex].name + "...");
    IsFirstFN=true;
  }
  FNLast.bindex = Bindex;
  FNLast.chapter = Chapter;
  FNLast.page = rpage;
  
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

  var tstart = Page.end;
  Page.pagebreakboth = false;
  RenderFrame.contentDocument.getElementById("body").setAttribute("pagename", Book[Bindex].shortName + ".fn-" + Chapter + "-" + Page.pagenumber);
  fitScreen(Book[Bindex].shortName, Chapter, 0, Page, false, false);

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
    if (Page.pagenumber > 1 && (FootnoteIndex+1) < PageWithFootnotes.length && 
				PageWithFootnotes[FootnoteIndex+1].name.match(/^([^-]+)-/i)[1]==Book[Bindex].shortName &&
				(COMPACT_FOOTNOTES || PageWithFootnotes[FootnoteIndex+1].chapter==Chapter) &&
				(COMPACT_FOOTNOTES || PageWithFootnotes[FootnoteIndex+1].name.match(/-([^-]+)$/i)[1]==rpage)) {
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

var PaintCount;
var PaintCheck;
var PaintExit;
function waitRenderDoneThenDo(funcString) {
  
  PaintCount = RenderFrame.contentDocument.defaultView.window.mozPaintCount;
  PaintExit = funcString;
  
  if (PaintCheck) window.clearInterval(PaintCheck);
  
  // Keep looping until there are 0 paint events within the chosen loop delay.
  // No paint events within such time is the indicator that painting has
  // finished, and the loop ends by calling the exit function.
  PaintCheck = window.setInterval(function() {
    
      if (RenderFrame.contentDocument.defaultView.window.mozPaintCount == PaintCount) {
        window.clearInterval(PaintCheck);
        window.setTimeout(PaintExit, 1);
      }
      else PaintCount = RenderFrame.contentDocument.defaultView.window.mozPaintCount;
      
    }, 100);

}

function unloadedRender() {
  if (MainWin) {
    if (MainWin.Running) 
      MainWin.quit();
    else MainWin.resetGo();
  }
}

function dumpComputedStyles(elem,name,prop) {

  var cs = window.getComputedStyle(elem,null);
  if (prop) {
    MainWin.jsdump("    "+prop+" : "+cs.getPropertyValue(prop)+"\n");
    return;
  }
  var len = cs.length;
  for (var i=0;i<len;i++) {
 
    var style = cs[i];
    MainWin.jsdump(name+"    "+style+" : "+cs.getPropertyValue(style)+"\n");
  }

}
