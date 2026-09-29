const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/globals.css');
let content = fs.readFileSync(filePath, 'utf8');

const search = `  /* Deep, luminous ambient mesh backdrop for Liquid Glass refraction */
  background-color: #060814;
  background-image:
    radial-gradient(55% 65% at 16% 16%, rgba(106, 92, 255, 0.32) 0%, transparent 65%),
    radial-gradient(60% 70% at 84% 18%, rgba(20, 209, 196, 0.25) 0%, transparent 65%),
    radial-gradient(45% 55% at 76% 82%, rgba(255, 94, 156, 0.22) 0%, transparent 65%),
    radial-gradient(50% 60% at 20% 85%, rgba(255, 180, 67, 0.18) 0%, transparent 65%),
    linear-gradient(180deg, #090c1a 0%, #05060c 100%);`;

const searchCrLf = search.replace(/\n/g, '\r\n');

const replace = `  /* Deep, luminous ambient mesh backdrop for Liquid Glass refraction */
  background-color: #04060d;
  background-image:
    radial-gradient(55% 65% at 16% 16%, rgba(56, 82, 195, 0.12) 0%, transparent 65%),
    radial-gradient(60% 70% at 84% 18%, rgba(20, 169, 209, 0.10) 0%, transparent 65%),
    radial-gradient(45% 55% at 76% 82%, rgba(56, 82, 195, 0.08) 0%, transparent 65%),
    radial-gradient(50% 60% at 20% 85%, rgba(106, 92, 255, 0.06) 0%, transparent 65%),
    linear-gradient(180deg, #070913 0%, #030408 100%);`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Replaced with LF');
} else if (content.includes(searchCrLf)) {
  content = content.replace(searchCrLf, replace.replace(/\n/g, '\r\n'));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Replaced with CRLF');
} else {
  console.log('Not found!');
}
