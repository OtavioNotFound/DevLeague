insert into devleague.problem_category (key, label) values
  ('fundamentals', 'Fundamentos'),
  ('math', 'Matemática')
on conflict (key) do nothing;

insert into devleague.problem (id, slug, status)
values ('10000000-0000-4000-8000-000000000001', 'soma-de-dois-numeros', 'PUBLISHED');

insert into devleague.problem_version (
  id, problem_id, version_number, title, statement_markdown,
  constraints_markdown, difficulty, competitive_eligible,
  practice_visible, comparator, cpu_ms, wall_ms, memory_kb,
  processes, output_bytes, file_bytes, published_at
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  1,
  'Soma de Dois Números',
  E'Receba dois números inteiros `A` e `B` e imprima a soma deles.\n\n## Entrada\nUma linha contendo `A` e `B`, separados por espaço.\n\n## Saída\nUma linha contendo `A + B`.',
  E'- `-10^9 <= A, B <= 10^9`\n- A resposta cabe em um inteiro de 64 bits.',
  'EASY',
  true,
  true,
  'TRIM_FINAL_NEWLINES',
  1000,
  3000,
  262144,
  8,
  65536,
  1048576,
  clock_timestamp()
);

insert into devleague.problem_category_link (problem_id, category_key) values
  ('10000000-0000-4000-8000-000000000001', 'fundamentals'),
  ('10000000-0000-4000-8000-000000000001', 'math');

insert into devleague.starter_code (problem_version_id, language_key, source) values
  ('20000000-0000-4000-8000-000000000001', 'python', E'a, b = map(int, input().split())\nprint(a + b)\n'),
  ('20000000-0000-4000-8000-000000000001', 'javascript', E'const fs = require("fs");\nconst [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n'),
  ('20000000-0000-4000-8000-000000000001', 'java', E'import java.util.Scanner;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner in = new Scanner(System.in);\n    long a = in.nextLong();\n    long b = in.nextLong();\n    System.out.println(a + b);\n  }\n}\n'),
  ('20000000-0000-4000-8000-000000000001', 'cpp', E'#include <iostream>\nusing namespace std;\n\nint main() {\n  long long a, b;\n  cin >> a >> b;\n  cout << a + b << "\\n";\n  return 0;\n}\n');

insert into devleague.test_case (
  id, problem_version_id, kind, ordinal, input_text, expected_output_text
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'PUBLIC', 1, E'2 3\n', E'5\n'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'PRIVATE', 1, E'-10 4\n', E'-6\n'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'PRIVATE', 2, E'1000000000 1000000000\n', E'2000000000\n');
