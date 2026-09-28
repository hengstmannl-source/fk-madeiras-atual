const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const schema = fs.readFileSync('drizzle/schema.ts','utf8');
const tables = new Set();
const schemaAst = ts.createSourceFile('schema.ts',schema,ts.ScriptTarget.Latest,true);
function schemaWalk(n) { if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(schemaAst)==='mysqlTable'&&n.initializer.arguments[1]?.getText(schemaAst).includes('empresaId:')) tables.add(n.name.getText(schemaAst)); ts.forEachChild(n,schemaWalk); } schemaWalk(schemaAst);
function walkDir(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkDir(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const files = walkDir('server').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts'));
for(const file of files) {
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function walk(n) {
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['where','leftJoin','innerJoin','rightJoin'].includes(n.expression.name.text)) {
   const join=n.expression.name.text!=='where';
   const chain=n.expression.expression.getText(sf), table=join?n.arguments[0]?.getText(sf):chain.match(/\.(?:from|update|delete)\((\w+)\)/)?.[1];
   const arg=n.arguments[join?1:0];
   if(tables.has(table)&& !arg?.getText(sf).includes(table+'.empresaId')) {
    let fn=n.parent; while(fn&&!ts.isFunctionDeclaration(fn)&&!ts.isArrowFunction(fn))fn=fn.parent;
    console.log(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line+1} ${table} ${fn?.name?.getText(sf)||'callback'} ${arg?.getText(sf).replace(/\s+/g,' ')}`);
   }
  }
  ts.forEachChild(n,walk);
 } walk(sf);
}
