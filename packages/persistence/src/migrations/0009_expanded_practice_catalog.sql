insert into devleague.problem_category (key, label) values
  ('loops', 'Laços'),
  ('strings', 'Strings'),
  ('arrays', 'Vetores')
on conflict (key) do nothing;

insert into devleague.problem (id, slug, status) values
  ('10000000-0000-4000-8000-000000000002', 'par-ou-impar', 'PUBLISHED'),
  ('10000000-0000-4000-8000-000000000003', 'contagem-de-vogais', 'PUBLISHED'),
  ('10000000-0000-4000-8000-000000000004', 'soma-dos-pares', 'PUBLISHED');

insert into devleague.problem_version (
  id, problem_id, version_number, title, statement_markdown, constraints_markdown,
  difficulty, competitive_eligible, practice_visible, comparator, cpu_ms, wall_ms,
  memory_kb, processes, output_bytes, file_bytes, published_at
) values
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 1, 'Par ou Ímpar',
   E'Receba um número inteiro `N` e imprima `PAR` quando ele for divisível por 2. Caso contrário, imprima `IMPAR`.',
   E'- `-10^9 <= N <= 10^9`', 'EASY', true, true, 'TRIM_FINAL_NEWLINES', 1000, 3000, 262144, 8, 65536, 1048576, clock_timestamp()),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 1, 'Contagem de Vogais',
   E'Leia uma linha de texto e informe quantas vogais (`a`, `e`, `i`, `o`, `u`) ela possui. Considere letras maiúsculas e minúsculas.',
   E'- A linha possui até 1.000 caracteres.\n- Considere somente as vogais sem acento.', 'EASY', true, true, 'TRIM_FINAL_NEWLINES', 1000, 3000, 262144, 8, 65536, 1048576, clock_timestamp()),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 1, 'Soma dos Pares',
   E'Leia `N` números inteiros e imprima a soma apenas dos valores pares.',
   E'- `1 <= N <= 1000`\n- Cada valor está entre `-10^6` e `10^6`.', 'EASY', true, true, 'TRIM_FINAL_NEWLINES', 1000, 3000, 262144, 8, 65536, 1048576, clock_timestamp());

insert into devleague.problem_category_link (problem_id, category_key) values
  ('10000000-0000-4000-8000-000000000002', 'fundamentals'),
  ('10000000-0000-4000-8000-000000000003', 'strings'),
  ('10000000-0000-4000-8000-000000000003', 'loops'),
  ('10000000-0000-4000-8000-000000000004', 'arrays'),
  ('10000000-0000-4000-8000-000000000004', 'loops');

insert into devleague.starter_code (problem_version_id, language_key, source) values
  ('20000000-0000-4000-8000-000000000002', 'python', E'n = int(input())\nprint("PAR" if n % 2 == 0 else "IMPAR")\n'),
  ('20000000-0000-4000-8000-000000000002', 'javascript', E'const n = Number(require("fs").readFileSync(0, "utf8").trim());\nconsole.log(n % 2 === 0 ? "PAR" : "IMPAR");\n'),
  ('20000000-0000-4000-8000-000000000002', 'cpp', E'#include <iostream>\nusing namespace std;\n\nint main() {\n  long long n; cin >> n;\n  cout << (n % 2 == 0 ? "PAR" : "IMPAR") << "\\n";\n}\n'),
  ('20000000-0000-4000-8000-000000000003', 'python', E'texto = input().lower()\nprint(sum(letra in "aeiou" for letra in texto))\n'),
  ('20000000-0000-4000-8000-000000000003', 'javascript', E'const texto = require("fs").readFileSync(0, "utf8").trim().toLowerCase();\nconsole.log([...texto].filter((letra) => "aeiou".includes(letra)).length);\n'),
  ('20000000-0000-4000-8000-000000000003', 'cpp', E'#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n  string texto; getline(cin, texto);\n  int total = 0;\n  for (char letra : texto) if (string("aeiouAEIOU").find(letra) != string::npos) ++total;\n  cout << total << "\\n";\n}\n'),
  ('20000000-0000-4000-8000-000000000004', 'python', E'n = int(input())\nvalores = map(int, input().split())\nprint(sum(valor for valor in valores if valor % 2 == 0))\n'),
  ('20000000-0000-4000-8000-000000000004', 'javascript', E'const dados = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconst n = dados[0];\nconsole.log(dados.slice(1, n + 1).filter((valor) => valor % 2 === 0).reduce((soma, valor) => soma + valor, 0));\n'),
  ('20000000-0000-4000-8000-000000000004', 'cpp', E'#include <iostream>\nusing namespace std;\n\nint main() {\n  int n; cin >> n; long long soma = 0, valor;\n  while (n--) { cin >> valor; if (valor % 2 == 0) soma += valor; }\n  cout << soma << "\\n";\n}\n');

insert into devleague.test_case (id, problem_version_id, kind, ordinal, input_text, expected_output_text) values
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'PUBLIC', 1, E'7\n', E'IMPAR\n'),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000002', 'PRIVATE', 1, E'-8\n', E'PAR\n'),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', 'PUBLIC', 1, E'Abacaxi\n', E'4\n'),
  ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003', 'PRIVATE', 1, E'xyz\n', E'0\n'),
  ('30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000004', 'PUBLIC', 1, E'5\n1 2 3 4 5\n', E'6\n'),
  ('30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000004', 'PRIVATE', 1, E'4\n-2 5 10 -1\n', E'8\n');
