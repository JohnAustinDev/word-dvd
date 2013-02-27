In this ReadMe:
DESCRIPTION OF FILES AND FOLDERS
REVISION HISTORY


DESCRIPTION OF FILES AND FOLDERS

config.txt
----------
The main configuration file for a Word-DVD project. Update this file with
book names, user interface phrases, menu layout scheme, and more. Details
can be found within the file itself.


pageTiming.txt
--------------
Contains all transition timing information. This file is only needed
if audio is included in the project. General settings to aid in the
calculation of page transitions are required. More specific (per book
or chapter) settings can also be used to further improve calculation
accuracy. Exact transition timings, as well as text-locative timing
information can also be entered here. A tool called "xtransitions.sh"
can be used to generate these entries. More details can be found within
pageTiming.txt itself. After modifying pageTiming.txt, xword-dvd.sh (for
DVD) or xvideo-sh (for video files) can be rerun to apply the transitions.


osis.xml
--------
Optional: Word-DVD will optionally convert an OSIS file into HTML. It
should be named osis.xml. There are certain constraints placed on the
OSIS markup. See the osis2html.pl script.


html directory
--------------
Contains the text to be rendered to DVD. These files are either generated
by hand or created by Word-DVD's OSIS to HTML converter. All html files
can use pre-defined CSS classes and must conform to the following rules:

- The first and last lines of each html file are dropped by the rendering
engine, so the entire html header, and other non-renderable code, should
be on line 1, or else the last line.

- Text, introductions, and footnotes are each contained in separate
files, so each book can have up to three html files associated with it
(named <book>.html, <book>.intr.html, and <book>.fn.html respectively).

- The following tags/classes should be used where applicable:
Paragraph-start          = <br><span class="paragraph-start"></span>
Verse-start              = <sup>verse-number</sup>
Chapter-start            = <span name="chapter.n"></span>
Footnote-symbol          = <span class="fnsymbol" id="note.n"></span>
Pagebreak                = <span class="pagebreak"></span>
Footnote-start           = <div class="footnote">footnote-text</div>
Footnote-verse-reference =
           <span class="verseref" id="note.n">verse-reference</span>

- These title classes: title-1 and title-2, are available for titles
and should be applied to a <div> containing a title.

- The following classes (referred to as "splitable") are also available
and should be appled to a <div> containing the corresponding material:
majorquote, x-list-1, x-list-2, x-enumlist-1, x-enumlist-2, x-enumlist-3

- All tags within each line of an html file must be closed. No tag can
be opened on one line of the file and closed on another.

- <sup> tags may only be used for verse-start, and nowhere else.

- "Splitable" tags (see above) must not occur within any other tags. These
tags are special in that they can be properly split across rendered
pages. For instance, a majorquote can begin on one rendered page and
end many pages later, and each page will render that style correctly.

- "Splitable" tags may contain another single level of other
(non-splitable) tags. But non-splitable tags cannot be split across page
boundaries. For instance, a long bold section of text cannot be properly
rendered across page boundaries.

- Non-splitable tags should not contain any other tags.


audio directory
---------------
Audio files for the project should be put in the audio directory. Audio
is optional and can be disabled by checking the "no-audio" checkbox
on the word-dvd control window. They are ideally one chapter per file,
but can contain more than one chapter (even a whole book).

-Audio files must be AC3 encoded at 48000Hz sample rate.

-Not all chapters need to have an audio file.

-Audio can be mono or stereo.

-Audio files need one of these naming patterns:

 1) AudioPrefix-FileName-chapter.ac3
 
 2) AudioPrefix-FileName-chapter1-chapter2.ac3
 
 3) AudioPrefix-FileName-chapter:verse1-verse2.ac3
 
 4) AudioPrefix-FileName-chapter1:verse1-chapter2:verse2.ac3
 
 A single chapter may have multiple audio files for it. But audio
 recordings must never overlap one another.

- AudioPrefix and FileName must appear in the appropriate place in
the config.txt.

menus directory
---------------
Book and chapter menus are created automatically by Word-DVD, but custom
menus can also be added if desired. Each menu page can have up to four
images associated with it (1 image for the menu, and up to 3 images for
the button modes: normal, hilighted, and selected). All these images and
their inter-relations need to be described in the menus.txt file. The
menus.txt file defines each menu's buttons (their x-y location in their
image file, and the images associated with each button state), as well
as the target of each button.

These menus can reference one another and can also be referenced in the
config.txt file. The help-m1 menu is a special case which is referenced
automatically by each text page in the DVD (currently this menu is 
required, not optional like the others).


defaults directory
------------------
This directory holds the CSS, background images, button images, and 
more, needed to render the DVD. Anything in this directory can be 
changed as desired. For instance, new background images, button images, 
and CSS styling could be applied. Then during the next rendering 
session these modified files will be used.



REVISION HISTORY

1.5.1
-----
- Added ability to handle audio files of the form:
  code-bk-ch1:v2-ch2:v2.ac3 
- Improved the xtransitions.sh tool to handle all kinds of audio files
- After rendering, absolute fixed timings in the pageTiming.txt file 
  which correspond to text-locative timings are commented out.
- Regarding pages within a book which transition from non-audio to 
  audio: by default the non-audio page is dropped unless NonAudioEndStop
  is set in config.txt. This causes the audio to start when viewed.

1.5
-----
- Audio files covering only a part of a chapter are now supported.
- Added automatic menu generation for sub-chapters created by partial 
  chapter audio files.
- Fixed a bug where /defaults/CSS/pal.css would not be overwritten when 
  "Restore Default Files" was checked.
- New "MatchChapterTransitions" config.txt entry is used to enable 
  transition matching. Transition matching still has bugs and has been 
  turned off by default.
- Fixed minor bugs.

1.4.4
-----
- Improved UI behaviour and interaction. 
- Control window no longer closes after each render session.
- Improved page rendering speed (using asynchronous page generation 
  rather than synchronous).
- Added progress meter for osis2html conversion
- Fixed a bug where FootnotesInOwnVTS=true would fail in certain 
  configurations.
- Fixed a problem where dvdauthor would stop with:  "ERR:  Can only 
  have 128 commands for pre, post, and cell commands."

1.4.3
-----
- Added this ReadMe.
- Added default config.txt and other input files necessary to create a 
  minimal working DVD when an empty project directory is selected.
- Updated and improved documentation of these files.
- Improved transition capture tool: Got rid of ecasound in exchange 
  for ffplay and renamed ecasound.pl to transitions.pl
- Bug fixes

1.4.2
-----
- pal.css was completely redone to make full customization easy.
- Files are re-organized to be easier to use and back up.
- A defaults directory in the project directory holds all default CSS,
  image, and resource files.
- By default, all project files (inputs and outputs) are contained
  within a single folder. This folder can even be renamed or moved to a
  different location.
- Better error reporting and logging.
- Component version logging for easier debug.
- Backup of the firefox extension, log files, and listings in the
  OUTPUTS directory.
- Tested on Lucid and Natty Ubuntu and firefox 3 and 7.
- Bug fixes.

1.4.1
-----
- Single column text rendering is possible by setting visibility=hidden
  to page 2.
- Video output no longer shows the DVD control buttons.
- Bug fixes.

1.4
---
- Improved mpeg video quality.
- Works with firefox 4+ which does not unzip extensions in the
  extensions directory.
- Works with ffmpeg 0.6.
- Added debug options to scripts.
- Bug fixes.












