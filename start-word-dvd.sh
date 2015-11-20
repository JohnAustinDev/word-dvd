#!/bin/bash

cd "$(dirname "$0")"

# Word-DVD uses the ./PROJECT directory for INTPUTS/OUTPUTS by default.
# If there is no ./PROJECT directory, but there is a ./PROJECTS 
# symbolic link, then a shared folder will be created between its 
# destination and the VM's ./PROJECT directory. 
if [ -e ./PROJECTS ]; then
  DIRNAME=PROJECTS
  if [ -e ./PROJECT ]; then
    rmdir ./PROJECT
  fi
  if [ -e ./PROJECT ]; then
    echo "PROJECT directory is not empty. Cannot proceed using PROJECTS soft link."
    exit
  fi
else
  DIRNAME=PROJECT
fi

# Create soft link to scripts, so that editing OUTPUTS scripts edits the originals (helps with debugging)
if [ -e ./$DIRNAME ]; then
  if [ ! -e ./$DIRNAME/OUTPUTS/script ]; then
    mkdir -p ./$DIRNAME/OUTPUTS/script
  fi

  if [ -e ./$DIRNAME/OUTPUTS/script/scripts ]; then
    rm -rf ./$DIRNAME/OUTPUTS/script/scripts
  fi

  # softlinks won't work from Windows hosts
  if [[ $(uname -o) =~ Linux ]]; then
    ln -s $(pwd)/extension/defaults/INPUTS/scripts/ ./$DIRNAME/OUTPUTS/script/scripts
  fi
fi

vagrant up

vagrant -Y ssh
