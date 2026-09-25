# Referências oficiais — IRRF mensal de 2026

Consultado em 20 de agosto de 2026 para parametrização do motor de folha. Este registro é documental e não substitui a revisão do contador responsável antes da utilização em apurações ou obrigações acessórias.

| Fonte | Pontos usados na implementação |
| --- | --- |
| [Receita Federal — Tributação de 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026) | Vigência a partir de janeiro de 2026; faixas mensais de R$ 2.428,80, R$ 2.826,65, R$ 3.751,05 e R$ 4.664,68; deduções de R$ 182,16, R$ 394,16, R$ 675,49 e R$ 908,73; dedução por dependente de R$ 189,59; desconto simplificado de R$ 607,20; tabela de redução mensal. |
| [Receita Federal — Exemplos da Lei nº 15.270/2025](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025) | A escolha entre deduções legais e desconto simplificado deve reduzir a base; a redução usa o rendimento tributável mensal, e não a base após deduções; a redução é limitada ao imposto progressivo. |
| [Lei nº 15.270/2025 — Planalto](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm) | A partir de janeiro de 2026: redução até R$ 312,89 para rendimentos tributáveis mensais até R$ 5.000,00; entre R$ 5.000,01 e R$ 7.350,00, fórmula R$ 978,62 - (0,133145 × rendimento tributável mensal); sem redução acima de R$ 7.350,00; redução limitada ao imposto apurado pela tabela progressiva. |

## Decisões de modelagem

As faixas, deduções, desconto simplificado e redução devem residir em dados versionados por vigência. A competência da folha seleciona a configuração aplicável. O item da folha deve persistir uma memória de cálculo para preservar a rastreabilidade quando novas regras forem cadastradas.
