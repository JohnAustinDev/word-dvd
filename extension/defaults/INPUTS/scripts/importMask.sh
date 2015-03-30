#!/bin/bash

import $1 $2 "$3" &>> "$5"

convert "$3" -fuzz 10% -transparent "$4" -colors 3 "$3" &>> "$5"

