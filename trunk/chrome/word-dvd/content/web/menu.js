// JavaScript Document

var MainWin = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher).getWindowByName("word-dvd", window);
var RenderWin = window.frameElement.ownerDocument.defaultView;
var RenderDone;
if (MainWin.CssFile) {
	var csslink=document.createElement("link");
	csslink.setAttribute("rel", "stylesheet");
	csslink.setAttribute("type", "text/css");
	csslink.setAttribute("href", "file://" + MainWin.CssFile.path);
	document.getElementsByTagName("head")[0].appendChild(csslink);
}
function init() {
	var path = MainWin.UIfile[MainWin.INDIR].path + "/" + MainWin.RESOURCE;
	RenderWin.setImgSrc(document.getElementById("menu-button-left"), "File://" + path + "/menuButtonLeft.png");
	RenderWin.setImgSrc(document.getElementById("menu-button-right"), "File://" + path + "/menuButtonRight.png");
}
