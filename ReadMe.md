#DVD-Book authoring tool:
* Create illustrated DVD audio books for playback using standard DVD 
players.
* A powerful and flexible menu system allows for easy navigation and 
use.
* Put many books on a single DVD.
* Supports footnotes and introductions.
* Books need not include audio or illustrations, text alone is 
sufficient. 

##Basic requirements:
* A computer running Linux, MS-Windows, or MAC (untested)
* Text in HTML or OSIS format.
* (optional) Audio files in AC3 format.
* (optional) Images and illustrations.
* (optional) Custom designed backgrounds and buttons.
* (optional) Custom designed menu system and/or video clips. 

-----

# Before running Word-DVD:
These Open Source programs are required:

* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](https://www.vagrantup.com/downloads.html)

### MS-Windows only
Requires a Windows X11 server also be installed. This gives the virtual 
Linux machine ability to display its windows in MS-Windows. Cywgin is  
the only tested solution:

* Install [Cygwin](https://cygwin.com/install.html) (windows only) and 
during the install select these packages:

    * xorg-server
    * xinit
    * openssh
    
* Install [Git](http://git-scm.com/downloads) for Windows
    
* Start the XWIN Server (via the startup menu or run `startxwin`). A 
white console window should appear, and this is where `start-word-dvd.sh` 
should be run.

# Running Word-DVD:
Get the source code from GitHub, then change into the word-dvd directory 
and run:

`start-word-dvd.sh`

Wait until Firefox opens (this could take a half hour or more the first
time because a virtual Linux operating system is being downloaded and 
configured from scratch).

When Firefox opens (you may need to click: "Allow this installation") 
click the DVD icon in the upper right of Firefox's toolbar.

Click "Go!" in the Word-DVD window to build a test DVD.

After Firefox renders images, the console will show: "Shall I try to 
create an ISO file...?" Type "y" and hit Enter, then the completed 
`dvd.iso` file will appear in `word-dvd/PROJECT/OUTPUTS`.

When finished with word-dvd, run 'vagrant halt' to halt the virtual 
machine. Running `start-word-dvd.sh` will restart it.

## Mount, Burn and verify a DVD
To mount the DVD in Linux, run:

    cd word-dvd/PROJECT/OUTPUTS/script
    sudo xcreateiso.sh

To burn and verify a DVD in Linux, run:

`./xburnverify.sh`

-----

#Input Files

## OSIS
A file called `osis.xml` can be used as the input file. It will be 
converted to specially formatted HTML files.

## HTML
HTML is the source input for Word-DVD. All HTML input files are in the 
`html` subdirectory. Multiple books can be included in one DVD and each 
book has an HTML file.

##HTML files names:

| File Name | content |
|--------------------|-----------------|
| Book.html | the book itself |
| Book.intr.html | introduction (optional) |
| Book.fn.html | footnotes (optional) |

##HTML must follow special rules:
The following are necessary for proper rendering of pages to DVD:

* The content must be immediately proceeded by `<!-- BEGIN-CONTENT !-->` 
and followed by `<!-- END-CONTENT !-->`. This is how the parser knows 
what content to render. If you want to preview your html files, use the 
example html files as a template and view in a web browser.
* Content HTML elements cannot span lines. For instance, a `<div>` or 
`<p>` cannot start on one line and end on another, its open and closing 
tags must be on the same line.
* Only one level of nesting is allowed in content html. For instance, 
a `<div>` may contain a stylised `<span>`, but the span cannot then 
contain child tags. However, such content may be added using CSS.
* Page breaks during rendering occur ONLY on spaces (ASCII 32). This 
means **every content line must end with a space** and HTML tags should 
have a space between them, otherwise page-breaks CANNOT occur there.
* Manual pagebreaks can be added with "`<milestone type="x-pagebreak"/> 
`" in OSIS files or "`<span class="pagebreak"></span> `" in HTML files. 
The space after the HTML end tag is REQUIRED. Appending "`-both`" to the 
above type/class attributes will break both left and right pages 
together.
* There are various other tags with predefined CSS classes for creating 
chapters, titles, verses, images, etc. See example html and CSS files.

## Previewing DVD Text and Images
Simply open one of the HTML files in a browser to see what will be 
rendered to DVD. All text will appear in a single column because it is 
not broken into pages until Word-DVD renders pages. Forced page breaks 
will show up as dashed lines.

## Previewing DVD Menus
Menus are not rendered until Word-DVD is run. At that time, the 
information in `config.txt` and `menus.txt` is used to render the menus, 
and they are previewed as they are rendered. However, the menu template 
can be viewed and edited by opening the `screen.html` file in a browser. 
To view the "highlight" and "select" DVD button masks (which appear as 
users select the various DVD menu options) change the `maskType` 
attribute, found in `screen.html`, from "none" to either "highlight" or 
"select". Reload the page in the browser, and the highlight or select 
masks will then be visible.

-----

#Audio files for Word-DVD

* Audio files must be AC3 encoded at 48000Hz sample rate.
* Not all chapters need to have an audio file.
* Audio can be mono or stereo.
* Audio files need to be placed in the "Audio Directory" listed on the 
word-dvd control window (and make sure the "none" checkbox to the right 
of the directory box is unchecked).
* Audio files need one of the following naming conventions: 

|Convention|Example|
|----------|-------|
|Prefix-Book-Chapter.ac3|en-Mark-1.ac3|
|Prefix-Book-Chapter1-Chapter2.ac3|en-Mark-1-5.ac3|
|Prefix-Book-Chapter:Verse1-Verse2.ac3|en-Mark-1:12-22.ac3|
|Prefix-Book-Chapter1:Verse1-Chapter2:Verse2.ac3|en-Mark-3:6-5:4.ac3|

Prefix and Book must appear in the appropriate place in the config.txt 
file which is located in the Word-DVD inputs directory.

##Converting to AC3

Included with Word-DVD is a perl script which converts mp3 into 48000Hz 
sampled wav files using sox (sox may need to be compiled locally with 
mp3 enabled for this script to work). To convert 48000hz sample rate wav 
files to ac3 you can use ffmpeg. Type "man ffmpeg" to see what all it 
can do. Here is the simplest case:

ffmpeg -i audioFile.wav -acodec ac3 -ar 48000 audioFile.ac3

Depending on the content size of your final DVD, you may need to adjust 
the bitrate of AC3 files to reduce their size. The sum total of audio 
files should not exceed roughly 3.5GB to be able to fit onto a standard 
DVD.
Audio Page Timing

Transition timings for DVD chapters which have audio are calculated 
automatically. But sometimes inaccuracies in the calculated page timings 
are noticeable and need manual correction. The pageTiming.txt file is 
used to provide exact transition timing values. A tool is provided to 
fairly quickly add exact timing values to this file. Run xtransitions.sh 
in the OUTPUTS/script directory without arguments to see usage info.

-----

#Adding Images to the DVD

Images can be placed anywhere, on any DVD menu or text page. All images 
are placed using HTML and CSS. See the example project html and CSS files. 

-----

#Debugging Tips

* Error messages, warnings and other information are reported during run 
time.
* During the initial image rendering phase, a live stream of this 
information is available in Firefox's Javascript error Console.
* During the DVD building phase, a console window will open showing the 
progress of the build scripts.


There are two log files which save all this information, and both are 
located under the Word-DVD OUTPUTS directory:

`logfile.txt`

`err.txt` (holds error messages from the DVD building phase) 

The logfile.txt file should be checked after each run. If there are 
errors, these need to be fixed. Warnings are okay. If rendering for DVD, 
check for valid new DVD files in `OUTPUTS/dvd/VIDEO_TS` after a 
successful run. 
