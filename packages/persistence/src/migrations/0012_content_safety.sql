-- The initial catalog was seeded with complete solutions and insufficient private calibration.
-- Keep it available for browser practice, but never select it for X1 until a reviewed
-- operational content release enables each immutable problem version explicitly.
update devleague.problem_version
set competitive_eligible = false
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004'
);

update devleague.starter_code
set source = case language_key
  when 'python' then E'# Leia a entrada e escreva sua solução aqui.\n'
  when 'javascript' then E'const input = require("fs").readFileSync(0, "utf8").trim();\n\n// Escreva sua solução aqui.\n'
  when 'typescript' then E'const input: string = require("fs").readFileSync(0, "utf8").trim();\n\n// Escreva sua solução aqui.\n'
  when 'lua' then E'-- Leia a entrada e escreva sua solução aqui.\n'
  when 'java' then E'import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    // Escreva sua solução aqui.\n  }\n}\n'
  when 'cpp' then E'#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  // Escreva sua solução aqui.\n  return 0;\n}\n'
  else source
end
where problem_version_id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004'
);
