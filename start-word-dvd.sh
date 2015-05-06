#!/bin/bash

cd "$(dirname "$0")"

# Create soft link to scripts, so that editing OUTPUTS scripts edits the originals (helps with debugging)
if [ ! -e ./PROJECT/OUTPUTS/script ]; then
  mkdir -p ./PROJECT/OUTPUTS/script
fi

if [ -e ./PROJECT/OUTPUTS/script/scripts ]; then
  rm -rf ./PROJECT/OUTPUTS/script/scripts
fi

# softlinks won't work from Windows hosts
if [[ $(uname -o) =~ Linux ]]; then
  ln -s ../../../extension/defaults/INPUTS/scripts/ ./PROJECT/OUTPUTS/script/scripts
fi

vagrant up

vagrant -Y ssh
