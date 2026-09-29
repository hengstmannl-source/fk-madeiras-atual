# Auditoria de dependências — 28/09/2026

Instalação inicial com `pnpm install --frozen-lockfile`; auditorias online com pnpm 10.34.5. Os JSONs brutos em `validation/` são a evidência. A classificação runtime/dev abaixo usa package.json e o caminho, pois os metadados agregados do serviço informam devDependencies=0.

Contagem inicial: {"info":0,"low":1,"moderate":18,"high":20,"critical":2}. Final: {"info":0,"low":1,"moderate":7,"high":1,"critical":1}. A contagem é por ocorrência/caminho; há 9 registros de advisory no JSON final. Nenhum advisory remanescente reportado para dependência de runtime direta. Isso não prova ausência de vulnerabilidades desconhecidas.

Express, mysql2, cookie, jose, helmet, axios, pdf-lib e XLSX: sem advisory nesta resposta. XLSX 0.20.3 vem de tarball local versionado (`vendor/`): o audit não substitui a verificação de procedência desse artefato. Não houve substituição desses pacotes.

## esbuild — GHSA-67mh-4wv8-2f99

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 0.18.20, 0.21.5. Versão corrigida informada: `>=0.25.0`.
- Caminhos: `.>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild`, `.>vitest>vite>esbuild`.
- Fonte: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). CVEs: não informado pelo serviço.
- Alcance/ação: APIs de serve do esbuild não são chamadas pelo projeto. Remanesce em drizzle-kit/Vitest e Vite (0.27.7); build usa CLI sem servidor.
- Risco de compatibilidade: Moderado: overrides 0.x nos consumidores antigos exigem validação específica.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-93m4-6634-74q7

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 5.4.20. Versão corrigida informada: `>=5.4.21`.
- Caminhos: `.>vitest>vite`.
- Fonte: [GHSA-93m4-6634-74q7](https://github.com/advisories/GHSA-93m4-6634-74q7). CVEs: CVE-2025-62522.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-93m4-6634-74q7

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 7.1.9. Versão corrigida informada: `>=7.1.11`.
- Caminhos: `.>vite`.
- Fonte: [GHSA-93m4-6634-74q7](https://github.com/advisories/GHSA-93m4-6634-74q7). CVEs: CVE-2025-62522.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## tar — GHSA-29xp-372q-xqph

- Severidade do advisory: moderate; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.2`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-29xp-372q-xqph](https://github.com/advisories/GHSA-29xp-372q-xqph). CVEs: CVE-2025-64118.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## @trpc/server — GHSA-43p4-m455-4f4j

- Severidade do advisory: high; uso: runtime.
- Versões encontradas: 11.6.0. Versão corrigida informada: `>=11.8.0`.
- Caminhos: `.>@trpc/server`.
- Fonte: [GHSA-43p4-m455-4f4j](https://github.com/advisories/GHSA-43p4-m455-4f4j). CVEs: CVE-2025-68130.
- Alcance/ação: Caller experimental de Next.js não encontrado; Express é o adapter usado. Atualizado com client/react-query para 11.8.0.
- Risco de compatibilidade: Baixo/moderado: minor da mesma major; testes e typecheck.
- Estado: não reportado na auditoria final.

## tar — GHSA-34x7-hfp2-rc4v

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.7`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v). CVEs: CVE-2026-24842.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-8qq5-rm4j-mr97

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.3`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97). CVEs: CVE-2026-23745.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-83g3-92jg-28cx

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.8`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx). CVEs: CVE-2026-26960.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## rollup — GHSA-mw96-cpmx-2vgc

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 4.52.4. Versão corrigida informada: `>=4.59.0`.
- Caminhos: `.>vite>rollup`.
- Fonte: [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc). CVEs: CVE-2026-27606.
- Alcance/ação: Build de fontes do repositório; não recebe arquivos enviados por usuários. Override 4.59.0.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## tar — GHSA-qffp-2rhf-9h96

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.10`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96). CVEs: CVE-2026-29786.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-9ppj-qmqm-q256

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.11`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256). CVEs: CVE-2026-31802.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-r6q2-hw4h-h46w

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.4`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w). CVEs: CVE-2026-23950.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## picomatch — GHSA-3v7f-55p6-f55p

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 4.0.3. Versão corrigida informada: `>=4.0.4`.
- Caminhos: `.>vite>picomatch`.
- Fonte: [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p). CVEs: CVE-2026-33672.
- Alcance/ação: Globs do build, não filtros de API do ERP. Override 4.0.4.
- Risco de compatibilidade: Baixo: patch; build verificado.
- Estado: não reportado na auditoria final.

## picomatch — GHSA-c2c7-rcm5-vvqj

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 4.0.3. Versão corrigida informada: `>=4.0.4`.
- Caminhos: `.>vite>picomatch`.
- Fonte: [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj). CVEs: CVE-2026-33671.
- Alcance/ação: Globs do build, não filtros de API do ERP. Override 4.0.4.
- Risco de compatibilidade: Baixo: patch; build verificado.
- Estado: não reportado na auditoria final.

## vite — GHSA-4w7w-66w2-5vf9

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 5.4.20. Versão corrigida informada: `>=6.4.2`.
- Caminhos: `.>vitest>vite`.
- Fonte: [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9). CVEs: CVE-2026-39365.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-4w7w-66w2-5vf9

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 7.1.9. Versão corrigida informada: `>=7.3.2`.
- Caminhos: `.>vite`.
- Fonte: [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9). CVEs: CVE-2026-39365.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-v2wj-q39q-566r

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 7.1.9. Versão corrigida informada: `>=7.3.2`.
- Caminhos: `.>vite`.
- Fonte: [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r). CVEs: CVE-2026-39364.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: não reportado na auditoria final.

## vite — GHSA-p9ff-h696-f583

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 7.1.9. Versão corrigida informada: `>=7.3.2`.
- Caminhos: `.>vite`.
- Fonte: [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583). CVEs: CVE-2026-39363.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: não reportado na auditoria final.

## drizzle-orm — GHSA-gpj5-g38j-94v9

- Severidade do advisory: high; uso: runtime.
- Versões encontradas: 0.44.6. Versão corrigida informada: `>=0.45.2`.
- Caminhos: `.>drizzle-orm`.
- Fonte: [GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9). CVEs: CVE-2026-39356.
- Alcance/ação: Identificadores no código são constantes; não encontrado SQL raw/identificador derivado de input. Atualizado 0.44.6 → 0.45.3 por defesa adicional.
- Risco de compatibilidade: Moderado: versão 0.x; build/typecheck e testes com SQL, sem integração MySQL real.
- Estado: não reportado na auditoria final.

## postcss — GHSA-qx2v-qp2m-jg93

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 8.5.6. Versão corrigida informada: `>=8.5.10`.
- Caminhos: `.>postcss`.
- Fonte: [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93). CVEs: CVE-2026-41305.
- Alcance/ação: CSS local do build, sem CSS de upload. Atualizado para 8.5.23.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## tar — GHSA-vmf3-w455-68vh

- Severidade do advisory: moderate; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.16`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh). CVEs: CVE-2026-53655.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## vite — GHSA-v6wh-96g9-6wx3

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 5.4.20. Versão corrigida informada: `>=6.4.3`.
- Caminhos: `.>vitest>vite`.
- Fonte: [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3). CVEs: CVE-2026-53632.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-v6wh-96g9-6wx3

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 7.1.9. Versão corrigida informada: `>=7.3.5`.
- Caminhos: `.>vite`.
- Fonte: [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3). CVEs: CVE-2026-53632.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-fx2h-pf6j-xcff

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 5.4.20. Versão corrigida informada: `>=6.4.3`.
- Caminhos: `.>vitest>vite`.
- Fonte: [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff). CVEs: CVE-2026-53571.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## vite — GHSA-fx2h-pf6j-xcff

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 7.1.9. Versão corrigida informada: `>=7.3.5`.
- Caminhos: `.>vite`.
- Fonte: [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff). CVEs: CVE-2026-53571.
- Alcance/ação: Vite 7.1.9 → 7.3.5. Servidor Vite só em NODE_ENV=development; produção serve arquivos estáticos. Vite 5.4.20 remanescente pertence ao Vitest 2.
- Risco de compatibilidade: Baixo para Vite 7; corrigir a árvore Vitest requer migração da ferramenta de testes.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## @babel/core — GHSA-4x5r-pxfx-6jf8

- Severidade do advisory: low; uso: dev/build.
- Versões encontradas: 7.28.4. Versão corrigida informada: `>=7.29.6`.
- Caminhos: `.>@vitejs/plugin-react>@babel/core`.
- Fonte: [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8). CVEs: CVE-2026-49356.
- Alcance/ação: Compilação de fontes locais; override 7.29.6.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## tar — GHSA-w8wr-v893-vjvp

- Severidade do advisory: moderate; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.18`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp). CVEs: CVE-2026-59871.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-23hp-3jrh-7fpw

- Severidade do advisory: critical; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.19`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw). CVEs: CVE-2026-59873.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-8x88-c5mf-7j5w

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.18`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w). CVEs: CVE-2026-59874.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## tar — GHSA-gvwx-54wh-qm9j

- Severidade do advisory: moderate; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.17`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j). CVEs: CVE-2026-59875.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## postcss — GHSA-6g55-p6wh-862q

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 8.5.6. Versão corrigida informada: `>=8.5.12`.
- Caminhos: `.>postcss`.
- Fonte: [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q). CVEs: CVE-2026-45623.
- Alcance/ação: CSS local do build, sem CSS de upload. Atualizado para 8.5.23.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## postcss — GHSA-fxqj-rqcc-2cmp

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 8.5.6. Versão corrigida informada: `>=8.5.23`.
- Caminhos: `.>postcss`.
- Fonte: [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). CVEs: CVE-2026-69153.
- Alcance/ação: CSS local do build, sem CSS de upload. Atualizado para 8.5.23.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## postcss — GHSA-r28c-9q8g-f849

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 8.5.6. Versão corrigida informada: `>=8.5.18`.
- Caminhos: `.>postcss`.
- Fonte: [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849). CVEs: CVE-2026-73646.
- Alcance/ação: CSS local do build, sem CSS de upload. Atualizado para 8.5.23.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## vitest — GHSA-5xrq-8626-4rwp

- Severidade do advisory: critical; uso: dev/test.
- Versões encontradas: 2.1.9. Versão corrigida informada: `>=3.2.6`.
- Caminhos: `.>vitest`.
- Fonte: [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp). CVEs: CVE-2026-47429.
- Alcance/ação: Uso configurado: vitest run, sem UI/browser server. Adiada migração 2 → 4; não iniciar UI acessível pela rede.
- Risco de compatibilidade: Alto: duas majors e mudanças de configuração/mocks.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## tar — GHSA-r292-9mhp-454m

- Severidade do advisory: high; uso: dev/install.
- Versões encontradas: 7.5.1. Versão corrigida informada: `>=7.5.21`.
- Caminhos: `.>@tailwindcss/vite>@tailwindcss/oxide>tar`.
- Fonte: [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m). CVEs: CVE-2026-73566.
- Alcance/ação: Extração transitiva do instalador Tailwind/oxide; nenhum upload chega ao tar no servidor. Override 7.5.21.
- Risco de compatibilidade: Baixo: mesma major; instalação e build verificados.
- Estado: não reportado na auditoria final.

## browserslist — GHSA-c83g-rgw3-j3cx

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 4.26.3. Versão corrigida informada: `>=4.28.7`.
- Caminhos: `.>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist`.
- Fonte: [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx). CVEs: CVE-2026-73089.
- Alcance/ação: Consultas do build fixas no projeto; override 4.28.7.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## browserslist — GHSA-73wf-gq98-2v4g

- Severidade do advisory: high; uso: dev/build.
- Versões encontradas: 4.26.3. Versão corrigida informada: `>=4.28.7`.
- Caminhos: `.>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist`.
- Fonte: [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g). CVEs: CVE-2026-73088.
- Alcance/ação: Consultas do build fixas no projeto; override 4.28.7.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## vitest — GHSA-82fw-gwwq-j7x9

- Severidade do advisory: moderate; uso: dev/test.
- Versões encontradas: 2.1.9. Versão corrigida informada: `>=4.1.11`.
- Caminhos: `.>vitest`.
- Fonte: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). CVEs: CVE-2026-84373.
- Alcance/ação: Uso configurado: vitest run, sem UI/browser server. Adiada migração 2 → 4; não iniciar UI acessível pela rede.
- Risco de compatibilidade: Alto: duas majors e mudanças de configuração/mocks.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## @vitest/mocker — GHSA-82fw-gwwq-j7x9

- Severidade do advisory: moderate; uso: dev/test.
- Versões encontradas: 2.1.9. Versão corrigida informada: `>=4.1.11`.
- Caminhos: `.>vitest>@vitest/mocker`.
- Fonte: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). CVEs: CVE-2026-84373.
- Alcance/ação: Caminho browser/redirect mock não usado pela suíte node/jsdom. Vinculado à migração Vitest 4.1.11+.
- Risco de compatibilidade: Alto: acompanha a migração do runner.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).

## baseline-browser-mapping — GHSA-w5vr-8v7q-w6rv

- Severidade do advisory: moderate; uso: dev/build.
- Versões encontradas: 2.8.12. Versão corrigida informada: `>=2.11.0`.
- Caminhos: `.>@vitejs/plugin-react>@babel/core>@babel/helper-compilation-targets>browserslist>baseline-browser-mapping`.
- Fonte: [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv). CVEs: CVE-2026-45819.
- Alcance/ação: Entrada de browserslist/build; override 2.11.0.
- Risco de compatibilidade: Baixo: mesma major; build verificado.
- Estado: não reportado na auditoria final.

## esbuild — GHSA-g7r4-m6w7-qqqr

- Severidade do advisory: low; uso: dev/build.
- Versões encontradas: 0.27.7. Versão corrigida informada: `>=0.28.1`.
- Caminhos: `.>vite>esbuild`.
- Fonte: [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). CVEs: não informado pelo serviço.
- Alcance/ação: APIs de serve do esbuild não são chamadas pelo projeto. Remanesce em drizzle-kit/Vitest e Vite (0.27.7); build usa CLI sem servidor.
- Risco de compatibilidade: Moderado: overrides 0.x nos consumidores antigos exigem validação específica.
- Estado: há ocorrência remanescente na árvore final (ver JSON/caminho).
