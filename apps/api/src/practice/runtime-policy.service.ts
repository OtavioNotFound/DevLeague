import { Injectable } from '@nestjs/common';
import type { LanguageKey } from '@devleague/persistence';

@Injectable()
export class RuntimePolicyService {
  readonly versions: Readonly<Record<LanguageKey, string>> = {
    python: process.env.RUNTIME_PYTHON ?? '3.13',
    java: process.env.RUNTIME_JAVA ?? '21',
    javascript: process.env.RUNTIME_JAVASCRIPT ?? '24',
    cpp: process.env.RUNTIME_CPP ?? '23'
  };
}
