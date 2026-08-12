import type { MatchSnapshot, MeResponse, ProblemDetail, ProblemSummary } from '@devleague/contracts';

export const demoMe: MeResponse = {
  id: '019ff31b-6ec5-72d0-a306-1619d8c33cc7',
  username: 'otaviocode',
  status: 'ACTIVE',
  rating: 1248,
  stats: { peakRating: 1264, games: 12, wins: 7, losses: 5, draws: 0 },
  activeMatchId: null,
  consents: { termsVersion: 'v0.1-alpha', privacyVersion: 'v0.1-alpha', over18: true },
  eligibility: { eligible: true, reasons: [] }
};

export const demoProblems: readonly ProblemSummary[] = [
  {
    id: '019ff31b-6ec5-72d0-a306-1619d8c33ca1',
    versionId: '019ff31b-6ec5-72d0-a306-1619d8c33cb1',
    slug: 'eco-do-array', title: 'Eco do Array', difficulty: 'EASY',
    categories: ['arrays', 'logic'], languages: ['python', 'java', 'javascript', 'cpp']
  },
  {
    id: '019ff31b-6ec5-72d0-a306-1619d8c33ca2',
    versionId: '019ff31b-6ec5-72d0-a306-1619d8c33cb2',
    slug: 'janela-minima', title: 'Janela Mínima', difficulty: 'MEDIUM',
    categories: ['strings', 'sliding-window'], languages: ['python', 'java', 'javascript', 'cpp']
  },
  {
    id: '019ff31b-6ec5-72d0-a306-1619d8c33ca3',
    versionId: '019ff31b-6ec5-72d0-a306-1619d8c33cb3',
    slug: 'rotas-em-colisao', title: 'Rotas em Colisão', difficulty: 'HARD',
    categories: ['graphs', 'simulation'], languages: ['python', 'java', 'javascript', 'cpp']
  }
];

export const demoProblem: ProblemDetail = {
  ...demoProblems[0]!,
  statementMarkdown: 'Dado um array de inteiros, devolva os valores na ordem inversa sem utilizar uma função pronta de reversão.',
  constraintsMarkdown: '1 ≤ n ≤ 100.000\n-10⁹ ≤ valor ≤ 10⁹',
  starterCode: {
    python: 'n = int(input())\nvalues = list(map(int, input().split()))\n\n# escreva sua solução\n',
    javascript: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n\n// escreva sua solução\n",
    java: 'import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    // escreva sua solução\n  }\n}\n',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  // escreva sua solução\n}\n'
  },
  examples: [
    { id: 'ex-1', stdin: '5\n1 2 3 4 5\n', expectedOutput: '5 4 3 2 1\n' },
    { id: 'ex-2', stdin: '3\n8 8 -2\n', expectedOutput: '-2 8 8\n' }
  ]
};

export const demoMatch: MatchSnapshot = {
  id: '019ff31b-6ec5-72d0-a306-1619d8c33cc7',
  type: 'RANKED_PUBLIC', status: 'ACTIVE',
  serverNow: new Date().toISOString(),
  startsAt: new Date(Date.now() - 184_000).toISOString(),
  endsAt: new Date(Date.now() + 416_000).toISOString(),
  version: 18,
  problem: {
    versionId: demoProblem.versionId,
    title: demoProblem.title,
    statementMarkdown: demoProblem.statementMarkdown,
    constraintsMarkdown: demoProblem.constraintsMarkdown
  },
  participants: [
    { userId: demoMe.id, username: demoMe.username, submissions: 2 },
    { userId: '019ff31b-6ec5-72d0-a306-1619d8c33cd7', username: 'bytebruna', submissions: 1 }
  ],
  mySubmissions: [
    { id: 'sub-1', admissionSeq: 1, status: 'FINISHED', verdict: 'WRONG_ANSWER' },
    { id: 'sub-2', admissionSeq: 3, status: 'FINISHED', verdict: 'TIME_LIMIT_EXCEEDED' }
  ],
  result: null
};
