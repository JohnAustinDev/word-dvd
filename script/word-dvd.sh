#!/bin/sh

gnome-terminal --working-directory="$3" -x "$1/dvd.sh" $3/script "$5" "$6" "$7"
