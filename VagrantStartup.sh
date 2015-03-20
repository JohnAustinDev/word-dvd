#!/bin/bash

# Create soft link to scripts, so that editing OUTPUTS scripts edits the originals (helps with debugging)
if [ ! -e ./PROJECT/OUTPUTS/script ]; then
  mkdir -p ./PROJECT/OUTPUTS/script
fi

if [ -e ./PROJECT/OUTPUTS/script/scripts ]; then
  rm -rf ./PROJECT/OUTPUTS/script/scripts
fi

ln -s ../../../extension/defaults/INPUTS/scripts/ ./PROJECT/OUTPUTS/script/scripts

vagrant up

vagrant -X ssh
