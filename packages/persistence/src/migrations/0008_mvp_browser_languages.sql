-- A V0.1 oferece Python, JavaScript e C++ no catálogo inicial.
-- Java poderá voltar em um problema futuro quando houver judge configurado para ele.
delete from devleague.starter_code
where problem_version_id = '20000000-0000-4000-8000-000000000001'
  and language_key = 'java';
