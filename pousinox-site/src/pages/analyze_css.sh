#!/bin/bash

for file in Admin*.module.css; do
  page="${file%.module.css}"
  media=$(grep -c "@media" "$file" 2>/dev/null || echo "0")
  scroll=$(grep -c "overflow-x.*auto" "$file" 2>/dev/null || echo "0")
  cards=$(grep -c "grid-template-columns" "$file" 2>/dev/null || echo "0")
  toolbar=$(grep -c "flex-direction.*column" "$file" 2>/dev/null || echo "0")
  
  if [ "$media" -eq 0 ]; then
    priority="High"
  elif [ "$media" -lt 3 ]; then
    priority="Med"
  else
    priority="Low"
  fi
  
  echo "$page|$([ $media -gt 0 ] && echo "Yes($media)" || echo "No")|$([ $scroll -gt 0 ] && echo "Yes" || echo "No")|$([ $cards -gt 0 ] && echo "Yes" || echo "No")|$([ $toolbar -gt 0 ] && echo "Yes" || echo "No")|$priority"
done | sort
