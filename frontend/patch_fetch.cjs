const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add credentials: 'include' if not present inside fetch options
  // Replace `headers: {` or `headers: jsonHeaders` block to also include credentials
  // This is a bit tricky with Regex, so I will just do a global replace for fetch options:
  // Find all `fetch(..., {`
  
  content = content.replace(/fetch\((.*?), \{(.*?)\}\);/gs, (match, url, options) => {
    if (!options.includes("credentials: 'include'")) {
      return `fetch(${url}, {${options}\n    credentials: 'include',\n  });`;
    }
    return match;
  });

  // Also remove manual Authorization header if it's there
  content = content.replace(/Authorization:\s*`Bearer \$\{.*?\}`/g, '');
  // Because it leaves an empty line or trailing comma, it's fine for JSON/JS objects if trailing commas are allowed.
  // Actually, let's just let it be. The backend will ignore Bearer token since it expects a cookie anyway (or we can support both).
  // Wait, if it sends `Bearer undefined` because we removed localStorage token, we should probably remove it.
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
