const fs = require('fs'); const lines = fs.readFileSync('C:/Users/dangi/.gemini/antigravity-ide/brain/fff62aad-faca-4206-9d7f-f18b6edc5a68/.system_generated/logs/transcript_full.jsonl', 'utf-8').split('\n'); for(let line of lines) { if(line.includes('\
step_index\:987')) { const d = JSON.parse(line); fs.writeFileSync('extracted_diff.txt', d.content); } }
