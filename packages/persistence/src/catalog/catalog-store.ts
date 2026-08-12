import { randomUUID } from 'node:crypto';
import type { Database } from '../postgres/database.js';

export type LanguageKey = 'python' | 'java' | 'javascript' | 'cpp';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type OutputComparator = 'EXACT' | 'TRIM_FINAL_NEWLINES' | 'TOKENS';

export interface CatalogProblemSummary {
  readonly id: string;
  readonly versionId: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly categories: readonly string[];
  readonly languages: readonly LanguageKey[];
}

export interface PublicTestCase {
  readonly id: string;
  readonly stdin: string;
  readonly expectedOutput: string;
}

export interface CatalogProblemDetail extends CatalogProblemSummary {
  readonly statementMarkdown: string;
  readonly constraintsMarkdown: string;
  readonly starterCode: Readonly<Partial<Record<LanguageKey, string>>>;
  readonly examples: readonly PublicTestCase[];
}

export interface ProblemExecutionSpec {
  readonly versionId: string;
  readonly comparator: OutputComparator;
  readonly cases: readonly PublicTestCase[];
  readonly limits: {
    readonly cpuMs: number;
    readonly wallMs: number;
    readonly memoryKb: number;
    readonly processes: number;
    readonly outputBytes: number;
    readonly fileBytes: number;
  };
}

interface SummaryRow {
  id: string;
  versionId: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  categories: string[];
  languages: LanguageKey[];
}

export class CatalogStore {
  constructor(private readonly database: Database) {}

  async listPublished(input: {
    readonly limit: number;
    readonly cursor?: string;
    readonly difficulty?: Difficulty;
  }): Promise<{ readonly items: readonly CatalogProblemSummary[]; readonly nextCursor: string | null }> {
    const rows = await this.database<SummaryRow[]>`
      select p.id, pv.id as version_id, p.slug, pv.title, pv.difficulty,
             coalesce(array_agg(distinct pcl.category_key)
               filter (where pcl.category_key is not null), '{}') as categories,
             coalesce(array_agg(distinct sc.language_key)
               filter (where sc.language_key is not null), '{}') as languages
      from devleague.problem p
      join lateral (
        select selected.*
        from devleague.problem_version selected
        where selected.problem_id = p.id and selected.practice_visible = true
        order by selected.version_number desc
        limit 1
      ) pv on true
      left join devleague.problem_category_link pcl on pcl.problem_id = p.id
      left join devleague.starter_code sc on sc.problem_version_id = pv.id
      where p.status = 'PUBLISHED'
        and (${input.cursor ?? null}::uuid is null or pv.id > ${input.cursor ?? null}::uuid)
        and (${input.difficulty ?? null}::text is null or pv.difficulty = ${input.difficulty ?? null})
      group by p.id, pv.id
      order by pv.id
      limit ${input.limit + 1}
    `;
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items.at(-1)?.versionId ?? null : null
    };
  }

  async getPublishedForPractice(input: {
    readonly problemId: string;
    readonly userId: string;
  }): Promise<CatalogProblemDetail | null> {
    return this.database.begin(async (transaction) => {
      const [problem] = await transaction<SummaryRow[]>`
        select p.id, pv.id as version_id, p.slug, pv.title, pv.difficulty,
               coalesce(array_agg(distinct pcl.category_key)
                 filter (where pcl.category_key is not null), '{}') as categories,
               coalesce(array_agg(distinct sc.language_key)
                 filter (where sc.language_key is not null), '{}') as languages
        from devleague.problem p
        join devleague.problem_version pv on pv.problem_id = p.id
        left join devleague.problem_category_link pcl on pcl.problem_id = p.id
        left join devleague.starter_code sc on sc.problem_version_id = pv.id
        where p.id = ${input.problemId}
          and p.status = 'PUBLISHED'
          and pv.practice_visible = true
        group by p.id, pv.id
        order by pv.version_number desc
        limit 1
      `;
      if (!problem) return null;

      const [content] = await transaction<{
        statementMarkdown: string;
        constraintsMarkdown: string;
      }[]>`
        select statement_markdown, constraints_markdown
        from devleague.problem_version where id = ${problem.versionId}
      `;
      const starters = await transaction<{ languageKey: LanguageKey; source: string }[]>`
        select language_key, source from devleague.starter_code
        where problem_version_id = ${problem.versionId}
      `;
      const examples = await transaction<{
        id: string;
        stdin: string;
        expectedOutput: string;
      }[]>`
        select id, input_text as stdin, expected_output_text as expected_output
        from devleague.test_case
        where problem_version_id = ${problem.versionId} and kind = 'PUBLIC'
        order by ordinal
      `;
      await transaction`
        insert into devleague.problem_exposure (
          id, user_id, problem_version_id, context
        ) values (${randomUUID()}, ${input.userId}, ${problem.versionId}, 'PRACTICE')
      `;

      return {
        ...problem,
        statementMarkdown: content?.statementMarkdown ?? '',
        constraintsMarkdown: content?.constraintsMarkdown ?? '',
        starterCode: Object.fromEntries(starters.map((starter) =>
          [starter.languageKey, starter.source])),
        examples
      };
    });
  }

  async getExecutionSpec(
    problemVersionId: string,
    kind: 'PUBLIC' | 'PRIVATE'
  ): Promise<ProblemExecutionSpec | null> {
    const [version] = await this.database<{
      versionId: string;
      comparator: OutputComparator;
      cpuMs: number;
      wallMs: number;
      memoryKb: number;
      processes: number;
      outputBytes: number;
      fileBytes: number;
    }[]>`
      select id as version_id, comparator, cpu_ms, wall_ms, memory_kb,
             processes, output_bytes, file_bytes
      from devleague.problem_version
      where id = ${problemVersionId}
    `;
    if (!version) return null;
    const cases = await this.database<{
      id: string;
      stdin: string;
      expectedOutput: string;
    }[]>`
      select id, input_text as stdin, expected_output_text as expected_output
      from devleague.test_case
      where problem_version_id = ${problemVersionId} and kind = ${kind}
      order by ordinal
    `;
    return {
      versionId: version.versionId,
      comparator: version.comparator,
      cases,
      limits: {
        cpuMs: version.cpuMs,
        wallMs: version.wallMs,
        memoryKb: version.memoryKb,
        processes: version.processes,
        outputBytes: version.outputBytes,
        fileBytes: version.fileBytes
      }
    };
  }
}
