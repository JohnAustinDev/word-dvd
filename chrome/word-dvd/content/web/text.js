// JavaScript Document
const SPACE = " ";
var MainWin = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher).getWindowByName("word-dvd", window);
var RenderWin = window.frameElement.ownerDocument.defaultView;
var PageElem1, PageElem2,Body;
var DebugChapter=0;
var DebugPage=0;
var RenderDone;

var CSSHeading1Color, CSSHeading2Color;

if (MainWin.CssFile) {
	var csslink=document.createElement("link");
	csslink.setAttribute("rel", "stylesheet");
	csslink.setAttribute("type", "text/css");
	csslink.setAttribute("href", "file://" + MainWin.CssFile.path);
	document.getElementsByTagName("head")[0].appendChild(csslink);
}
  
function init() {
  PageElem1 = document.getElementById("text-page1");
  PageElem2 = document.getElementById("text-page2");
  Body = document.getElementById("body");
  if (!MainWin.document.getElementById("runvideo").selected) 
    RenderWin.setImgSrc(document.getElementById("text-controls"), "file://" + MainWin.UIfile[MainWin.INDIR].path + "/" + MainWin.RESOURCE + "/control-buttons.png");
  
  // firefox 3- needs a fallback waitRender method (simple delay) so test and do if needed
  try {
    if ((RenderWin && RenderWin.UseRenderDoneFallback) || window.mozPaintCount===undefined) throw true;
    var test = RenderWin.mozPaintCount;
  }
  catch (er) {window.setTimeout("window.setTimeout('RenderDone = true;',0);", MainWin.WAIT);}
}

function fitScreen(book, chapter, subchapters, aPage, skipPage1, skipPage2) {
MainWin.jsdump("Chapter=" + Number(chapter+subchapters) + ", Pagenumber=" + aPage.pagenumber);
  DisplayBook = book;
  DisplayChapter = chapter;
  
  // The config.txt file's "MatchChapterTransitions" flag set to "1" tells the paginator to try and match the first transition of a 
  // chapter to that of a previous run (if it has been recorded in the pageTiming.txt file's text locative transition information). 
  // The reason this may be helpful is that it may help the following page transitions to fall near their previous locations as well. 
  // This improves transition accuracy when using text locative timing values. This may also add undesireable white-space before 
  // some chapter headings. For this reason, setting "MatchChapterTransitions" flag to "2" will limit pagination to three possibiities,
  // and choose the one that closest matches the first transition. These are 1) normal pagination. 2) start the new chapter at
  // the top of the left page. 3) start the new chapter at the start of the right page. These options leave more desirable white-space 
  // when trying to match the transition.
  var matchTransition;
  var chmatch = MainWin.getLocaleLiteral("MatchChapterTransitions");
  if (chmatch) {
		if (aPage.matchTransition && aPage.matchTransition.secondTry) {matchTransition = {}; copyPropsA2B(aPage.matchTransition, matchTransition);}
		else matchTransition = {foundTransition:false, preservingTransition:false, preserved:false, chapter_beg:-1, transition:-1, secondTry:false, flag:chmatch};
		aPage.matchTransition = null;
	}
  
  // render page Left   
  if (skipPage1) formatPage(PageElem1, null, false);
  else fitPage(PageElem1, book, chapter, aPage, SPACE, matchTransition);
  
  // save page 1 for verse timing preservation
  var page1 = {};
  copyPropsA2B(aPage, page1);
 
 // render page Right
  if (aPage.complete) PageElem2.innerHTML="";
  else if (matchTransition && matchTransition.preservingTransition && matchTransition.preserved) {
		// we already matched the text-locative transition, so just move the left page to right and move on
    MainWin.logmsg("WARNING " + book + "-" + chapter + "-" + aPage.pagenumber + ": Preserving transition by skipping left page.");
    PageElem2.innerHTML = PageElem1.innerHTML;
    formatPage(PageElem1, null, false);
  }
  else if (skipPage2) formatPage(PageElem2, null, false);
  else {
    fitPage(PageElem2, book, chapter, aPage, SPACE, matchTransition);
    // page.end < page.beg may occur if a text-locative transition could not be matched on this page, so
    // the left page is backtracked in this case to the chapter transition. So the new chapter is begun on 
    // the next page instead, where the transition should then be matched.
    if (matchTransition && aPage.end < aPage.beg) {
      MainWin.logmsg("WARNING " + book + "-" + chapter + "-" + aPage.pagenumber + ": Preserving transition by skipping right page.");
      page1.end = matchTransition.chapter_beg;
      page1.bottomSplitTag = "";
      copyPropsA2B(page1, aPage); 
      formatPage(PageElem1, aPage, false);      
    }
  }

	// If our text-locative transition was matched, then report it, otherwise look for it on the next page.
	// But if it cannot be matched on the next page, then skip...
  if (matchTransition && matchTransition.preservingTransition) {
    if (matchTransition.preserved) 
      MainWin.logmsg("NOTE: " + book + "-" + chapter + "-" + aPage.pagenumber + ": First chapter transition was preserved according to text timing info.");
    else if (!matchTransition.secondTry) {
      matchTransition.secondTry = true;
      aPage.matchTransition = matchTransition;
    }
    else MainWin.logmsg("ERRIR " + book + "-" + chapter + "-" + aPage.pagenumber + ": Failed to preserve verse text timing.");
  }
  
//MainWin.jsdump("PageElem1:" + PageElem1.innerHTML + "\nPageElem2:" + PageElem2.innerHTML);

  // firefox 3- needs a fallback waitRender method (simple delay) so test and do if needed
  try {
    if ((RenderWin && RenderWin.UseRenderDoneFallback) || window.mozPaintCount===undefined) throw true;
    var test = RenderWin.mozPaintCount;
  }
  catch (er) {window.setTimeout("window.setTimeout('RenderDone = true;',0);", MainWin.WAIT);}
  return true;
}

function fitPage(elem, book, chapter, page, sep, matchTransition) {
  var widowCheck = true;
  var isFirstPass = true;
  page.beg = page.end;
  page.topSplitTag = page.bottomSplitTag;
  page.bottomSplitTag = "";
  formatPage(elem, page, widowCheck);
  var goodpage={};
  while (elem.scrollHeight <= elem.clientHeight) {
    copyPropsA2B(page, goodpage);
    if (matchTransition && matchTransition.preservingTransition && page.end > matchTransition.transition) {
      matchTransition.preserved = true;
      MainWin.logmsg("WARNING " + book + "-" + chapter + "-" + page.pagenumber + ": Preserving transition by truncating page.");
      break;
    }
    if (page.passage.substring(page.beg, page.end).search(RenderWin.PAGEBREAK)!=-1) break;
    if (!shiftup(elem, page, sep, widowCheck, isFirstPass)) {
      // either end of passage, or impossible to shift up
      page.end = page.passage.length;
      formatPage(elem, page, false);
      copyPropsA2B(page, goodpage);
      if (!goodpage.isNotes) {
        goodpage.complete = true;
        if (elem.scrollHeight > elem.clientHeight) MainWin.logmsg("ERROR(fitPage): PAGE OVERFLOW! TEXT IS NOT VISIBLE!\n" + elem.innerHTML + "\n", true);
      }
      // Notes need goodpage.complete ONLY if the text really fits!
      else goodpage.complete = (elem.scrollHeight <= elem.clientHeight);
      break;
    }
jsdump2(page, "Shifted up to:" + page.passage.substr(page.end,16) + ", isFirstPass=" + isFirstPass);
    
    if (widowCheck && elem.scrollHeight > elem.clientHeight) {
      // When the page has overflowed with widowCheck, there is still another 
      // line available to use. But only try to use it if there are more than two 
      // lines left in that paragraph (to guarantee there is no widow at the 
      // top of the next page).
      
      widowCheck=false;
      
      // First find the index which will start the last line (the widowCheck line)
      var startFinalLine = findFinalLine(elem, page);

      // Next count chars from start of last line until end of paragraph...
      var parEnd = (page.isNotes ? findNoteEnd(page.passage, startFinalLine+2):findParEnd(page.passage, startFinalLine+2));
      var charsLeft = countPrintChars(startFinalLine, parEnd, page.passage); //+2 skips the space and the possible first "<"

jsdump2(page, "WidowCheck:charsLeft=" + charsLeft + ", startFinalLine=" + page.passage.substr(startFinalLine, 16) + ", findParEnd=" + page.passage.substr(parEnd, 16));
      if (!isFirstPass && charsLeft < 2*RenderWin.APPROXLINE) {
        // In this case a widow might result. So stretch to the end of the 
        // paragraph and if it all fits on the last line, then good. 
        // Otherwise, the last line will not be utilized.
        var startingIndex = page.end;
        page.end = page.passage.lastIndexOf(SPACE, parEnd);
        if (page.end < startingIndex) page.end = startingIndex;
        if (!checkTags(elem, page, sep, widowCheck, false)) page.end = page.passage.length;
      }
      formatPage(elem, page, widowCheck);
    }
    if (matchTransition && !matchTransition.foundTransition) findTransition(book, page, matchTransition);
    
    isFirstPass = false;
  }

jsdump2(page, "Finished " + elem.id + ", page break before:" + page.passage.substr(goodpage.end, 16));
  
  if (matchTransition && matchTransition.preservingTransition) {
    if (!matchTransition.preserved) matchTransition.preserved = (Math.abs(goodpage.end-matchTransition.transition) < 48);
    // if this is the second page, and we did not match our transistion on the first try, 
    // then end the current page at the chapter boundary, and try again on the next page.
    if (elem.id=="text-page2" && !matchTransition.preserved && !matchTransition.secondTry) {
      MainWin.logmsg("WARNING " + book + "-" + chapter + "-" + page.pagenumber + ": Preserving transition by pushing chapter to next page.");
      goodpage.end = matchTransition.chapter_beg;
      goodpage.bottomSplitTag = ""; 
    }
  }
  copyPropsA2B(goodpage, page);
  formatPage(elem, page, false);
//MainWin.jsdump(elem.innerHTML);
}

function copyPropsA2B(a, b) {for (var p in a) {b[p]=a[p];}}

// Check if the current page includes a new chapter boundary, and if so, try and find the
// first text locative transition from pageTiming.txt which was recorded for this new chapter. 
// This transition information is saved to allow the present page's transition to be matched 
// to the previously recorded transition.
function findTransition(book, page, matchTransition) {
  var chsi = page.passage.substring(page.beg, page.end).indexOf(MainWin.NEWCHAPTER);
  if (chsi == -1) return; // no new chapter yet
  
  // we have a new chapter
  matchTransition.foundTransition = true;

  // now save the transition information
  matchTransition.chapter_beg = page.beg + chsi;
  var nextchn = RenderWin.Chapter;
  if (page.beg != 0) nextchn++; // get next
  nextchn += RenderWin.SubChapters; // get internal chapter number
  var vt = RenderWin.VerseTiming["vt_" + book + "_" + nextchn];
  if (!vt) return; // no verse timings for chapter
  
  // locate first text-locative transition recorded in pageTiming.txt
  var firstTrans;
  for (var i=0; i<vt.length; i++) {
    if (!vt[i]) continue;
    if (!firstTrans || Number(vt[i].verse) < Number(firstTrans.verse)) firstTrans = vt[i];    
  }
  if (!firstTrans) return;
  
  // save the text location of the first text-locative transition if it's within reach
  var transEnd = lastIndexOfTrans(firstTrans, matchTransition.chapter_beg, page.passage);
  if (transEnd == -1) return; // timing text not found on first page
  matchTransition.preservingTransition = true;
  matchTransition.transition = transEnd;
  return;
}

// search for the transition on the first (approximate) full page of the chapter
// which begins at chapter_beg. If the first transition seems to occur after the first
// page worth of text, then return -1.
function lastIndexOfTrans(vto, chapter_beg, psg) {
  var vend = "</sup>";
  var re = new RegExp("<sup>" + vto.verse + "[-\s<]", "im");
  var i = psg.substr(chapter_beg, 2*RenderWin.APPROXLINE*RenderWin.APPNUMLINE).search(re);
  if (i == -1) return -1;
  return psg.indexOf(vend, chapter_beg+i) + vend.length + vto.trans.length; 
}

// This function must progress the page break to the next available place.
// False is returned if forward progress cannot be made for any reason.
function shiftup(elem, page, sep, widowCheck, minPossibleShift) {
  page.bottomSplitTag = "";
  var startingIndex = page.end;
  var end = page.passage.indexOf(sep, page.end+1);
jsdump2(page, "Examining break point:" + page.passage.substr(end,16));
  if (end == -1) {
    if (!page.isNotes) MainWin.logmsg("NOTE (shiftup): Could not find next sep.  May be at end of passage.", true);
    return false;
  }
  page.end = end;
  if (!adjustPageBreak(elem, page, sep, widowCheck, minPossibleShift)) return false;
  if (page.end <= startingIndex) {
    MainWin.logmsg("ERROR(shiftup): Could not progress before=\"" + startingIndex + "\" after=\"" + page.end + "\"", true);
    return false;
  }
  formatPage(elem, page, widowCheck);
  return true;
}

// This function assumes the following constraints were placed on the HTML:
// A) Splitable tags must only occur on the top level, not inside any tags.
// B) Splitable tags may contain another single level of non-splitable tags.
// C) Non-splitable tags must not contain any other tags.
// D) All tags within a single line of the HTML file must be closed.
//
//NOTE: footnotes sometimes break rule A! Could cause error message and
//wrong italics across page breaks
function adjustPageBreak(elem, page, sep, widowCheck, minPossibleShift) {
    
  // Prevent orphans by disallowing page breaks which occur on the same line that 
  // a paragraph starts on. In such cases, we should stretch forward some amount:
  // A) If the paragraph fits on a single line, stretch to just before the 
  // beginning of the next line. If the next line is also a paragraph, then 
  // stretch to the beginning of the second line of the paragraph, or if it 
  // also fits on a single line, stretch to just before the beginning of the 
  // next line (end of this paragraph).
  // B) If the paragraph is longer than one line, then shift forward to the
  // beginning of the second line.

  var startingIndex = page.end;
  var prevPar = (page.isNotes ? findNoteBeg(page.passage, page.end):findParBeg(page.passage, page.end));
  if (prevPar>0 && countPrintChars(prevPar, page.end, page.passage) < RenderWin.APPROXLINE) {
    if (!page.isNotes) {
      var ret = toSecondLine(prevPar, page);
      if (ret==0) ret = toSecondLine(page.end, page);
    }
    else {
      ret = toNoteSecondLine(prevPar, page);
      if (ret==0) ret = toNoteSecondLine(page.end, page);
    }
    
    // find last space AT or BEFORE current position...
    page.end = page.passage.lastIndexOf(SPACE, page.end);
    if (page.end < startingIndex) page.end = startingIndex;
  }
  
  return checkTags(elem, page, sep, widowCheck, minPossibleShift);
}


function checkTags(elem, page, sep, widowCheck, minPossibleShift) {
  // check if break is between tags, or inside a tag. If so shift out accordingly.
  var tag = enclosingTag(page.passage, page.end);
  if (tag.name) {
    if (!adjustIndexForTag(elem, page, sep, tag, widowCheck, minPossibleShift, false)) return false;
  }
  else page.bottomSplitTag = "";
  
  // check for splitable tag enclosure
  var tag = enclosingTag(page.passage, page.end);
  if (tag.name) return adjustIndexForTag(elem, page, sep, tag, widowCheck, minPossibleShift, true);
  else page.bottomSplitTag = "";
  
  return true;
}


function enclosingTag(passage, index) {
  var tags = [];
  var tag = {name:"", beg:-1};
  // if in end tag, shift out
  var prevET = passage.lastIndexOf("</", index);
  if (prevET!=-1 && passage.lastIndexOf(">", index-1)<prevET) index = prevET-1; //index-1 is for case when char at index is ">"!
  // for a necessary speedup, don't go beyond current line...
  var prevCR = passage.lastIndexOf("\n", index);
  while (true) {
    tag.beg = passage.lastIndexOf("<", index);
    if (tag.beg==-1) break;
    
    var parts = passage.substring(tag.beg).match(/^<(\/)?([^\s>]+)/);
    if (parts && parts[1] == "/") tags.push(parts[2]);
    else if (parts && parts[2]!="br") {
      if (tags.length == 0) {
        tag.name = parts[2];
        break;
      }
      else tags.pop();
    }
    
    index = tag.beg-1;
    if (index<0 || index<prevCR) break;
  }
  
  return tag;
}

function adjustIndexForTag(elem, page, sep, tag, widowCheck, minPossibleShift, onlySplitTags) {
  page.bottomSplitTag = "";
  
  var itagE = page.passage.indexOf("</" + tag.name, tag.beg);
  if (itagE==-1) {
    MainWin.logmsg("ERROR(adjustIndexForTag): Could not find closing tag \"</" + tag.name + ">\"", true);
    return false;    
  }
  itagE = page.passage.indexOf(">", itagE);
  if (itagE==-1) {
    MainWin.logmsg("ERROR(adjustIndexForTag): Could not find \">\" of closing tag \"</" + tag.name + ">\"", true);
    return false;    
  }    
  var tagClass = page.passage.substr(tag.beg).match(/^<[^>]+class=\"(.*?)\"/);
  if (tagClass) tagClass = tagClass[1];

  var titles = new RegExp("(" + RenderWin.TITLES + ")", "i");
  var splitdivs = new RegExp("(" + RenderWin.SPLITABLEDIVS + ")", "i");
  var action = "split";
  if (tag.name=="span" || tag.name=="sup" || tag.name == "i" || tag.name == "b") action="exitTag";
  else if (tag.name=="div" && tagClass && tagClass.match(titles)) action="exitTitles";
  else if (tag.name=="div" && (!tagClass || !tagClass.match(splitdivs))) action="exitTag"; //don't split divs that aren't on splitable div list
 
  if (onlySplitTags && action!="split") MainWin.logmsg("ERROR(adjustIndexForTag): May have failed to split a containing tag! Check this, and the following, output images!", true);
  
  // either shift out of tag, shift out of the tag + n lines, or split the tag in two
  switch(action) {
  case "exitTitles":
    // shift out of the tag and any consecutive title divs
    page.end = itagE;
    var consecTitleDiv = indexOfTitleDiv(page.passage, page.end, iAfterNPrintChars(page.passage, page.end, 1, true));
    while (consecTitleDiv != -1) {
      page.end = page.passage.indexOf("</div>", consecTitleDiv) + 5;
      if (page.end==4) {
        MainWin.logmsg("ERROR(exitTitles): <div> encountered with no closing tag!!", true);
        return false;
      }
      consecTitleDiv = indexOfTitleDiv(page.passage, page.end, iAfterNPrintChars(page.passage, page.end, 1, true));
    }
    // unless this is the first pass, move forward n lines
    if (!minPossibleShift) page.end = iAfterNPrintChars(page.passage, page.end, 2*RenderWin.APPROXLINE);
    if (!shiftup(elem, page, sep, widowCheck, minPossibleShift)) {
      MainWin.logmsg("NOTE (exitTitles): Could not shift up n lines after title. May be at end of passage.", true);
      return false;
    }
    break;
  case "exitTag":
    // shift out of the whole tag 
    page.end = itagE;
    if (!shiftup(elem, page, sep, widowCheck, minPossibleShift)) {
      MainWin.logmsg("NOTE (exitTag): Could not shift up after \"" + tag.name + "\" tag. May be at end of passage.", true);
      return false;
    }
    break;
  default:
    // split tag into two
    var fstgt = page.passage.indexOf(">", tag.beg);
    if (fstgt > page.end) {
      // We're in the starting tag itself...
      page.end = fstgt+1;
      if (!shiftup(elem, page, sep, widowCheck, minPossibleShift)) {
        MainWin.logmsg("NOTE (split): Could not shift up after exiting starting tag \"" + tag.name + "\" tag. May be at end of passage.", true);
        return false
      }
    }
    else page.bottomSplitTag = page.passage.substring(tag.beg, fstgt+1);
  }
  
  return true;
}

// Finds first line-break at or before page.end which allows complete
// fit with widowCheck. If no line-break is found before page.end 
// and widow doesn't fit, returns -1.
function findFinalLine(elem, page) {
  var saveEnd = page.end;
  var saveHTML = elem.innerHTML;
  formatPage(elem, page, true);
  while (elem.scrollHeight > elem.clientHeight) {
    var t1 = page.passage.lastIndexOf(SPACE, page.end-1);
    var t2 = page.passage.lastIndexOf(String.fromCharCode(173), page.end-1); // soft hyphen
    var t3 = page.passage.lastIndexOf("-", page.end-1); // regular hyphen
    page.end = (t1 > t2 ? t1:t2);
    page.end = (page.end > t3 ? page.end:t3);
    if (page.end == -1) break;
    formatPage(elem, page, true);
  }
  var ret = page.end;
  elem.innerHTML = saveHTML;
  page.end = saveEnd;
  return ret;
}

// Returns index of next non-span/sup start tag etc. or passage.length
// if none is found. Catches <div, <br, NEWCHAPTER, PAGEBREAK etc...
function findParEnd(passage, starting) {
  var end = passage.indexOf("<", starting);
  while (end != -1) {
    if (passage.substr(end, MainWin.NEWCHAPTER.length) == MainWin.NEWCHAPTER) break;
    if (passage.substr(end, RenderWin.PAGEBREAK.length) == RenderWin.PAGEBREAK) break;
    if (passage.substr(end,2)=="</" || passage.substr(end,6).search(/^<(span|sup)/i)!=-1) {
      end = passage.indexOf("<", end+1);
      continue;
    }
    break;
  }
  if (end==-1) end = passage.length;
  return end;
}


// Returns index to start tag of previous paragraph start, or -1 if not found.
// Unbreakable divs (including titles) are NOT paragraphs!
function findParBeg(passage, starting) {
  var par = passage.lastIndexOf("<br>", starting);
  
  // Count certain div classes as a paragraph also...
  var par2 = passage.lastIndexOf("<div", starting);
  var re = new RegExp("^<div[^>]+class=\"(" + RenderWin.SPLITABLEDIVS + ")\""); // ^<div[^>]+class="majorquote"
  if (passage.substr(par2) && !passage.substr(par2).match(re)) par2=-1;
  
  if (par >= par2) return par;
  else return par2;
}

// Returns index of next NOTESTART or passage.length if none is found.
function findNoteEnd(passage, starting) {
  var end = passage.indexOf(RenderWin.NOTESTART, starting);
  if (end==-1) end = passage.length;
  return end;
}

// Returns index to start tag of previous note start, or -1 if not found.
function findNoteBeg(passage, starting) {
  var note = passage.lastIndexOf(RenderWin.NOTESTART, starting);
  return note;
}

// Returns the index of the start tag of the next title div that starts 
// between beg and end, inclusive. If none is found -1 is returned.
function indexOfTitleDiv(passage, beg, end) {
  if (beg>end) return -1;
  var sTag = passage.indexOf("<", beg);
  var titles = new RegExp("(" + RenderWin.TITLES + ")");
  while (sTag!=-1 && sTag<=end) {
    if (passage.substr(sTag,4) == "<div") {
      var tag = passage.substr(sTag).match(/^<[^>]+class=\"(.*?)\"/);
      if (tag && tag[1] && tag[1].match(titles)) break;
    }
    sTag = passage.indexOf("<", sTag+1);
  }
  if (sTag>end) return -1;
  return sTag;
}

// Counts the printable (visible) chars between indexes beg and end.
var PCRES;
function countPrintChars(beg, end, string, dontCountWhiteSpace) {
  if (end<=beg) return 0;
  if (PCRES===undefined) {
    PCRES = new Object();
    PCRES.parSRE = new RegExp("\\s*" + MainWin.escapeRE(RenderWin.PARSTART) + "\\s*", "gi");
    
    PCRES.tag1RE = new RegExp("^[^<]*>");
    PCRES.tag2RE = new RegExp("<[^>]*$");
    PCRES.tag3RE = new RegExp("<.*?>", "g");
    
    PCRES.hyp1RE = new RegExp("&shy;", "gi");
    PCRES.hyp2RE = new RegExp("­", "g");
    
    PCRES.idn1RE = new RegExp("&nbsp;", "gi");
    PCRES.idn2RE = new RegExp("&\\S*?;", "g");
    
    PCRES.wht1RE = new RegExp("([\\n\\r\\l]|\\s*$)", "g");
    PCRES.wht2RE = new RegExp("\\s", "g");
  }

  var str = string.substring(beg, end);

  //Replace paragraph indents
  str = str.replace(PCRES.parSRE, (dontCountWhiteSpace ? "":"xxxx"));

  //Remove tags
  str = str.replace(PCRES.tag1RE, "");
  str = str.replace(PCRES.tag2RE, "");
  str = str.replace(PCRES.tag3RE, "");

  //Remove soft hyphens
  str = str.replace(PCRES.hyp1RE, "");
  str = str.replace(PCRES.hyp2RE, "");

  //Convert &xx;
  if (dontCountWhiteSpace) str = str.replace(PCRES.idn1RE, "");
  str = str.replace(PCRES.idn2RE, "x");

  //Remove special whitespace chars, or white-space at end
  str = str.replace(PCRES.wht1RE, "");
  
  //Remove all other white space if requested
  if (dontCountWhiteSpace) str = str.replace(PCRES.wht2RE, "");
  
  return str.length;
}

// Returns index of the printable character located numpchars after beg.
// Returns page.passage.length if not found.
function iAfterNPrintChars(passage, beg, numpchars, dontCountWhiteSpace) {
  var end = beg + numpchars;
  while (end < passage.length && countPrintChars(beg, end, passage, dontCountWhiteSpace) < numpchars) {end++;}
  if (end > passage.length) end = passage.length;
  return end;
}


// Return values: 0=at_new_line-continue, 1=at_new_line-stop, 2=at_space-stop
function toSecondLine(lineStart, page) {
  var lineEnd = findParEnd(page.passage, lineStart+2); //2 for possible space plus 1
  if (countPrintChars(lineStart, lineEnd, page.passage)<=RenderWin.APPROXLINE+4) { //+4 insures break is actually on next line
    page.end = lineEnd;
    //Only allow second pass if lineEnd is a paragraph!
    if (page.passage.substr(page.end, RenderWin.PARSTART.length)==RenderWin.PARSTART) return 0;
    else return 1;
  }
  
  var retval = 2;
  page.end = iAfterNPrintChars(page.passage, lineStart, RenderWin.APPROXLINE)+4; //+4 insures break is actually on next line
  page.end = page.passage.indexOf(SPACE, page.end);
  if (page.end==-1 || page.end>lineEnd) {
    retval = 1;
    page.end = lineEnd; //In case new par begins very near start of second line
  }
  if (page.end==-1) page.end = page.passage.length;
  return retval;
}

// Return values: 0=noteEnd-continue, 1=noteEnd-stop, 2=space-stop
function toNoteSecondLine(noteStart, page) {
  var noteEnd = page.passage.indexOf(RenderWin.NOTESTART, noteStart+2);
  if (noteEnd==-1) noteEnd = page.passage.length;
  if (countPrintChars(noteStart, noteEnd, page.passage)<=RenderWin.APPROXLINE) {
    page.end = noteEnd;
    return 0;
  }
  
  var retval = 2;
  page.end = iAfterNPrintChars(page.passage, noteStart, RenderWin.APPROXLINE)+4; //+4 insures break is actually on next line
  page.end = page.passage.indexOf(SPACE, page.end);
  if (page.end==-1 || page.end>noteEnd) {
    retval = 1;
    page.end = noteEnd; //In case new par begins very near start of second line
  }
  if (page.end==-1) page.end = page.passage.length;
  return retval;
}

function resetHTML(elem) {
  // This is needed to get rid of scroll bars before loading text, because
  // when showing, they reduce the amount of text that will fit. This can
  // cause scrollbars to remain when they are not needed, allowing for less
  // text on a page (space at bottom).
  elem.innerHTML = "";
  var dummy = elem.scrollHeight;
}

var DisplayBook;
var DisplayChapter;
var TextHeaders = {};
function formatPage(elem, page, widowCheck) {
  resetHTML(elem);
  var html = (page && page.beg < page.end ? page.passage.substring(page.beg, page.end):"");
  var isNotes = (page ? page.isNotes:false);
  var topSplitTag = (page ? page.topSplitTag:"");
  var bottomSplitTag = (page ? page.bottomSplitTag:"");

  //look for special case new chapter
  var isLeftPage = elem.id=="text-page1";
  if (isLeftPage) {
    var re = new RegExp("^((<[^>]+>)|\\s)*" + escapeRE(MainWin.NEWCHAPTER) + "(\\d+)\">", "i");
    var special = html.match(re);
    if (special && special[3]) DisplayChapter = special[3];
  }
  
  //build page header
  var ch = (DisplayChapter==0 ?  
      MainWin.getLocaleString("IntroLink"):
      MainWin.getLocaleString("Chaptext", [DisplayBook, DisplayChapter]));
  if (ch==0) ch = "";
  var bklocale = MainWin.getLocaleString(DisplayBook);
  var myid = "text-header-" + (isLeftPage ? "left":"right");
  elem.innerHTML = "<div id=\"" + myid + "\" class=\"text-header\"></div>";
  var header;
  if (!isNotes) header = isLeftPage ? bklocale:ch;
  else header = bklocale;
  RenderWin.applyHeader(header, document.getElementById(myid), TextHeaders); 
  
  // Remove any leading <br> or paragraphs on page
  var firstBR = html.indexOf("<br>");
  while (firstBR!=-1 && countPrintChars(0, firstBR, html, true)==0) {
    if (html.substr(firstBR, RenderWin.PARSTART.length)==RenderWin.PARSTART) {
      if (countPrintChars(firstBR, findParEnd(html, firstBR+2), html, true)>0) html=html.replace("<br>", "");
      else html=html.replace(RenderWin.PARSTART, "");
    }
    else html=html.replace("<br>", "");
    firstBR = html.indexOf("<br>");
  }
  
  // If widowCheck, include approx. next line worth of chars, 
  // so that line height is accurate.
  if (page && widowCheck) {
    var nextLine = iAfterNPrintChars(page.passage, page.end, Math.floor(0.75*RenderWin.APPROXLINE), false);
    var endPar = (page.isNotes ? findNoteEnd(page.passage, page.end):findParEnd(page.passage, page.end));
    if (nextLine > endPar) nextLine = endPar;
    html += "<br>" + page.passage.substring(page.end, nextLine);
  }
  
  //add any split tags back in
  if (topSplitTag) html = topSplitTag + html;
  if (bottomSplitTag) {
    var tag = bottomSplitTag.match(/<(.*?)[\s>]/);
    if (tag) html += "</" + tag[1] + ">";
  }
  
  elem.innerHTML += html;

//MainWin.jsdump(html);
}

function jsdump2(page, str) {
  if (DisplayChapter!=DebugChapter || page.pagenumber!=DebugPage) return;
  MainWin.logmsg(str, true);
}

function getCSS(searchText, styleSheetNumber) {
  if (!styleSheetNumber) styleSheetNumber=0;
  searchText = new RegExp("^" + escapeRE(searchText));
  for (var z=0; z!=document.styleSheets[styleSheetNumber].cssRules.length; z++) {
    var myRule = document.styleSheets[styleSheetNumber].cssRules[z];
    if (myRule.cssText.search(searchText) != -1) return myRule;
  }
  return null;
}

function escapeRE(text) {
  const ESCAPE_RE= new RegExp(/([^\\]|^)([\[\]\(\)\{\}\-\+\*\.\^\$\?\|\\])/g);
  return text.replace(ESCAPE_RE, "$1\\$2");
}
