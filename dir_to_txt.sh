#!/bin/bash

# Source directory
src_dir="src/data/code/mobile_txt"

# Create destination directory if needed
[ ! -d "$dest_dir" ] && mkdir "$dest_dir"

# Loop through source files
find "$src_dir" -type f -print0 | while IFS= read -r -d '' file; do

    # Get relative path
    rel_path="${file#$src_dir/}"

    # Skip hidden
    if [[ $(basename "$rel_path") == .* ]]; then
        continue
    fi

    # Skip node_modules
    if [[ "$rel_path" == */node_modules* ]]; then
        continue
    fi

    # Skip images
    ext="${rel_path##*.}"
    if [[ "$ext" == jpg || "$ext" == jpeg || "$ext" == png || "$ext" == gif ]]; then
        continue
    fi

    # Skip archives
    if [[ "$ext" == zip ]]; then
        continue
    fi

    # Skip empty
    if [[ ! -s "$file" ]]; then
        continue
    fi

    # Rename copied file
    mv -- "$file" "$file.txt" || {
        echo "Failed to rename $file"
        exit 1
    }
    echo "Copied $file to $dest_dir/$rel_path.txt"

done
