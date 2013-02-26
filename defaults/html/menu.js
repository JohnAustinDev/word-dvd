// JavaScript Document

var MainWin = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher).getWindowByName("word-dvd", window);
var RenderWin = window.frameElement.ownerDocument.defaultView;
var RenderDone;
