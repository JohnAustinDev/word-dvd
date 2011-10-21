// JavaScript Document

var MainWin = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher).getWindowByName("word-dvd", window);
if (MainWin.CssFile) {
	var csslink=document.createElement("link");
	csslink.setAttribute("rel", "stylesheet");
	csslink.setAttribute("type", "text/css");
	csslink.setAttribute("href", "file://" + MainWin.CssFile.path);
	document.getElementsByTagName("head")[0].appendChild(csslink);
}
function init() {
	var path = MainWin.UIfile[MainWin.INDIR].path + "/" + MainWin.RESOURCE;
	document.getElementById("p1footimg").setAttribute("src", "File://" + path + "/prev.png");
	document.getElementById("p2footimg").setAttribute("src", "File://" + path + "/next.png");
}
