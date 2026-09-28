const fs=require('fs');
function read(file){const b=fs.readFileSync(file);return JSON.parse(b.toString(b[0]===255?'utf16le':'utf8').replace(/^\uFEFF/,''));}
const initial=read('validation/pnpm-audit.json'),final=read('validation/pnpm-audit-final.json');
const remaining=Object.values(final.advisories), original=Object.values(initial.advisories);
const notes={
 '@trpc/server':['runtime','Caller experimental de Next.js não encontrado; Express é o adapter usado. Atualizado com client/react-query para 11.8.0.','Baixo/moderado: minor da mesma major; testes e typecheck.'],
 'drizzle-orm':['runtime','Identificadores no código são constantes; não encontrado SQL raw/identificador derivado de input. Atualizado 0.44.6 → 0.45.3 por defesa adicional.','Moderado: versão 0.x; build/typecheck e testes com SQL, sem integração MySQL real.'],
 'vite':['dev/build','Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.','Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.'],
 'vitest':['dev/test','Uso configurado: vitest run, sem UI/browser server. Adiada migração 2 → 4; não iniciar UI acessível pela rede.','Alto: duas majors e mudanças de configuração/mocks.'],
 '@vitest/mocker':['dev/test','Caminho browser/redirect mock não usado pela suíte node/jsdom. Vinculado à migração Vitest 4.1.11+.','Alto: acompanha a migração do runner.'],
 'esbuild':['dev/build','APIs de serve do esbuild não são chamadas pelo projeto. Remanesce em drizzle-kit/Vitest e Vite (0.27.7); build usa CLI sem servidor.','Moderado: overrides 0.x nos consumidores antigos exigem validação específica.'],
 'tar':['dev/install','Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.','Baixo: mesma major; instalação e build verificados.'],
 'rollup':['dev/build','Build de fontes do repositório; não recebe arquivos enviados por usuários. Override 4.59.0.','Baixo: mesma major; build verificado.'],
 'picomatch':['dev/build','Globs do build, não filtros de API do ERP. Override 4.0.4.','Baixo: patch; build verificado.'],
 'postcss':['dev/build','CSS local do build, sem CSS de upload. Atualizado para 8.5.23.','Baixo: mesma major; build verificado.'],
 '@babel/core':['dev/build','Compilação de fontes locais; override 7.29.6.','Baixo: mesma major; build verificado.'],
 'browserslist':['dev/build','Consultas do build fixas no projeto; override 4.28.7.','Baixo: mesma major; build verificado.'],
 'baseline-browser-mapping':['dev/build','Entrada de browserslist/build; override 2.11.0.','Baixo: mesma major; build verificado.'],
};
let out='# Auditoria de dependências — 28/09/2026\n\nInstalação inicial com `pnpm install --frozen-lockfile`; auditorias online com pnpm 10.34.5. Os JSONs brutos em `validation/` são a evidência. A classificação runtime/dev abaixo usa package.json e o caminho, pois os metadados agregados do serviço informam devDependencies=0.\n\n';
out+=`Contagem inicial: ${JSON.stringify(initial.metadata.vulnerabilities)}. Final: ${JSON.stringify(final.metadata.vulnerabilities)}. A contagem é por ocorrência/caminho; há ${remaining.length} registros de advisory no JSON final. Nenhum advisory remanescente reportado para dependência de runtime direta. Isso não prova ausência de vulnerabilidades desconhecidas.\n\n`;
out+='Express, mysql2, cookie, jose, helmet, axios, pdf-lib e XLSX: sem advisory nesta resposta. XLSX 0.20.3 vem de tarball local versionado (`vendor/`): o audit não substitui a verificação de procedência desse artefato. Não houve substituição desses pacotes.\n\n';
const records=[...original,...remaining.filter(r=>!original.some(a=>a.github_advisory_id===r.github_advisory_id&&a.module_name===r.module_name))];
for(const a of records){const n=notes[a.module_name]||['ver JSON','Revisar caminho transitivo.','Não alterado.'];const still=remaining.some(r=>r.github_advisory_id===a.github_advisory_id&&r.module_name===a.module_name);out+=`## ${a.module_name} — ${a.github_advisory_id}\n\n- Severidade do advisory: ${a.severity}; uso: ${n[0]}.\n- Versões encontradas: ${a.findings.map(f=>f.version).join(', ')}. Versão corrigida informada: \`${a.patched_versions}\`.\n- Caminhos: ${a.findings.flatMap(f=>f.paths).map(p=>'`'+p+'`').join(', ')}.\n- Fonte: [${a.github_advisory_id}](${a.url}). CVEs: ${(a.cves||[]).join(', ')||'não informado pelo serviço'}.\n- Alcance/ação: ${n[1]}\n- Risco de compatibilidade: ${n[2]}\n- Estado: ${still?'há ocorrência remanescente na árvore final (ver JSON/caminho)':'não reportado na auditoria final'}.\n\n`;}
fs.writeFileSync('docs/SEGURANCA-DEPENDENCIAS.md',out);
