const fs = require('fs'), cp = require('child_process');
const files = cp.execFileSync('C:/Program Files/Git/cmd/git.exe',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns = { privateKey:/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, token:/\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|sk-proj-[A-Za-z0-9_-]{30,})\b/, credentialUrl:/\b(?:mysql|postgres(?:ql)?):\/\/[^\s:@/]+:[^\s@/]+@/ };
const matches=[];
for(const file of files){if(!/\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|md|ps1|sh|env|pem|key)$/.test(file))continue;const lines=fs.readFileSync(file,'utf8').split('\n');for(let i=0;i<lines.length;i++)for(const [rule,re] of Object.entries(patterns))if(re.test(lines[i]))matches.push({file,line:i+1,rule,value:'[REDACTED]'});}
fs.writeFileSync('validation/secrets-scan.json',JSON.stringify({scope:'tracked files, current snapshot (not Git history)',trackedFiles:files.length,matches},null,2));
console.log(JSON.stringify({trackedFiles:files.length,matches}));
