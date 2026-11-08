import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import portuguese from './interface/pt.json';
import adminPortuguese from './admin-interface/pt.json';

const copy = { ...portuguese, ...adminPortuguese };

it('has a dictionary entry for every fixed UI source and never translates a runtime value', () => {
  const root = process.cwd();
  const files: string[] = [];
  const collect = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) files.push(path);
    }
  };
  collect(join(root, 'src'));
  files.push(join(root, 'supabase/functions/_shared/invitation-copy.ts'));
  const missing: string[] = [];
  const dynamic: string[] = [];
  for (const path of files) {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const names = path.endsWith('invitation-copy.ts') ? ['uiText', 'loadingText', 't'] : ['uiText', 'loadingText'];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && names.includes(node.expression.getText(source))) {
        const argument = node.arguments[0];
        const location = `${relative(root, path)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        if (!argument || !ts.isStringLiteral(argument)) dynamic.push(location);
        else if (!Object.prototype.hasOwnProperty.call(copy, argument.text)) missing.push(`${location}: ${argument.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(dynamic).toEqual([]);
  expect(missing).toEqual([]);
});
