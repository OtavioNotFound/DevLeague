alter table devleague.submission drop constraint submission_language_key_check;
alter table devleague.submission add constraint submission_language_key_check
  check (language_key in ('python', 'java', 'javascript', 'typescript', 'lua', 'cpp'));

alter table devleague.starter_code drop constraint starter_code_language_key_check;
alter table devleague.starter_code add constraint starter_code_language_key_check
  check (language_key in ('python', 'java', 'javascript', 'typescript', 'lua', 'cpp'));

alter table devleague.practice_submission drop constraint practice_submission_language_key_check;
alter table devleague.practice_submission add constraint practice_submission_language_key_check
  check (language_key in ('python', 'java', 'javascript', 'typescript', 'lua', 'cpp'));

do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'devleague.profile'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%preferred_languages%';
  if constraint_name is not null then
    execute format('alter table devleague.profile drop constraint %I', constraint_name);
  end if;
end $$;

alter table devleague.profile add constraint profile_preferred_languages_check
  check (preferred_languages <@ array['python', 'java', 'javascript', 'typescript', 'lua', 'cpp']::text[]);

insert into devleague.starter_code (problem_version_id, language_key, source) values
  ('20000000-0000-4000-8000-000000000001', 'typescript', E'const [a, b]: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n'),
  ('20000000-0000-4000-8000-000000000001', 'lua', E'local a, b = io.read("*n", "*n")\nprint(a + b)\n'),
  ('20000000-0000-4000-8000-000000000002', 'typescript', E'const n: number = Number(require("fs").readFileSync(0, "utf8").trim());\nconsole.log(n % 2 === 0 ? "PAR" : "IMPAR");\n'),
  ('20000000-0000-4000-8000-000000000002', 'lua', E'local n = io.read("*n")\nprint(n % 2 == 0 and "PAR" or "IMPAR")\n'),
  ('20000000-0000-4000-8000-000000000003', 'typescript', E'const texto: string = require("fs").readFileSync(0, "utf8").trim().toLowerCase();\nconsole.log([...texto].filter((letra: string) => "aeiou".includes(letra)).length);\n'),
  ('20000000-0000-4000-8000-000000000003', 'lua', E'local texto = string.lower(io.read("*l"))\nlocal _, total = string.gsub(texto, "[aeiou]", "")\nprint(total)\n'),
  ('20000000-0000-4000-8000-000000000004', 'typescript', E'const dados: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconst n: number = dados[0];\nconsole.log(dados.slice(1, n + 1).filter((valor: number) => valor % 2 === 0).reduce((soma: number, valor: number) => soma + valor, 0));\n'),
  ('20000000-0000-4000-8000-000000000004', 'lua', E'local n = io.read("*n")\nlocal soma = 0\nfor _ = 1, n do\n  local valor = io.read("*n")\n  if valor % 2 == 0 then soma = soma + valor end\nend\nprint(soma)\n')
on conflict (problem_version_id, language_key) do update set source = excluded.source;
