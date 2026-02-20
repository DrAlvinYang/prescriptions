#!/bin/bash
cd "$(dirname "$0")"
python3 xlsx_to_json.py
echo ""
echo "Press any key to close..."
read -n 1
