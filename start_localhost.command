#!/bin/zsh
cd "/Users/alvin/Documents/Documents - Alvin's Macbook/Alvin/Medicine/Work/ED Website/Prescriptions"
/opt/homebrew/bin/python3 -m http.server 8000 &
sleep 1
open "http://localhost:8000"
wait