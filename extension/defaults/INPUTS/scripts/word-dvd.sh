#!/bin/sh

hash gnome-terminal 2>/dev/null || { "$1/dvd.sh" $3/script "$5" "$6" "$7"; exit 0; }

gnome-terminal -x "$1/dvd.sh" $3/script "$5" "$6" "$7"
