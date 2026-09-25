# Proposta de correção da migration 0049

## Diagnóstico

A migration `0049_steep_eddie_brock.sql` contém duas operações:

```sql
ALTER TABLE `folhasPagamentoRh` ADD `tituloEncargosFinanceiroId` int;
ALTER TABLE `folhasPagamentoRh`
  ADD CONSTRAINT `folhasPagamentoRh_tituloEncargosFinanceiroId_unique`
  UNIQUE(`tituloEncargosFinanceiroId`);
```

Na homologação restaurada, o backup possui 49 migrations registradas e a coluna `folhasPagamentoRh.tituloEncargosFinanceiroId` já existe fisicamente. A constraint única, contudo, não existe. Portanto, a divergência não é uma migration totalmente aplicada: é uma aplicação parcial da migration 0049. O comportamento observado é esperado: o primeiro `ALTER TABLE` falha por coluna duplicada antes que o segundo statement possa criar a constraint.

A coluna não aparece na definição da tabela criada pela migration `0048_numerous_giant_man.sql`; por isso, uma instalação nova depende atualmente do primeiro statement da migration 0049.

## Solução recomendada

A solução compatível com o banco novo e com o backup autorizado é mover a criação da coluna para a definição de `folhasPagamentoRh` na migration `0048` e deixar a migration `0049` responsável apenas pela constraint única.

O resultado lógico será:

```sql
-- dentro do CREATE TABLE folhasPagamentoRh da migration 0048
`tituloEncargosFinanceiroId` int,

-- migration 0049
ALTER TABLE `folhasPagamentoRh`
  ADD CONSTRAINT `folhasPagamentoRh_tituloEncargosFinanceiroId_unique`
  UNIQUE(`tituloEncargosFinanceiroId`);
```

Em uma instalação nova, a migration 0048 criará a coluna e a 0049 criará a constraint. Na cópia restaurada, como a migration 0048 já está registrada e a coluna já existe, somente a migration 0049 pendente será executada e criará a constraint que falta. Não é necessário usar SQL condicional, procedure, edição manual de `__drizzle_migrations` ou reset de dados.

## Por que esta alternativa é preferível

A alteração preserva a semântica das migrations: a tabela recebe a coluna junto da sua criação e a migration seguinte adiciona a regra de unicidade. Também elimina o statement que causa o conflito no backup e não depende de sintaxe condicional que o executor Drizzle já demonstrou não aceitar neste fluxo.

A alteração deve incluir os snapshots históricos correspondentes: o snapshot da migration 0048 precisa refletir a coluna na tabela, e o snapshot da 0049 deve manter a mesma coluna e a constraint. O journal não deve ser editado; a entrada da 0049 deverá ser criada pelo próprio Drizzle quando a migration for executada.

## Limite conhecido

Esta solução cobre o estado comprovado do backup autorizado: migration 0048 registrada, migration 0049 pendente e coluna já presente. Um banco hipotético com migration 0048 registrada, migration 0049 pendente e coluna ausente exigiria uma análise própria antes de execução; não se deve presumir que esse estado exista no ambiente real sem auditoria.

## Alternativas rejeitadas

Não recomendamos `ADD COLUMN IF NOT EXISTS`, porque a tentativa condicional já falhou com o executor utilizado e não deve ser promovida a solução definitiva sem uma prova específica do parser e do driver. Também não recomendamos inserir manualmente uma linha em `__drizzle_migrations`, remover a coluna do backup, renomear temporariamente a coluna ou executar a reconciliação diretamente no banco real.

## Próximo passo sujeito a aprovação

Após aprovação explícita desta proposta, serão alterados somente `drizzle/0048_numerous_giant_man.sql`, `drizzle/0049_steep_eddie_brock.sql` e os snapshots históricos necessários. Em seguida, a homologação restaurada será recriada do backup, o baseline será capturado e o Drizzle será executado duas vezes. A primeira execução deverá aplicar a constraint da 0049 e as migrations posteriores; a segunda deverá terminar sem novas alterações. O banco real continuará fora do processo.
