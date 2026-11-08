import { uiText, useUiLocale } from '@/i18n/ui-copy';
// Parse and render formatted text (bold, italic, strikethrough, monospace, code blocks)
export function parseFormattedText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const remaining = text;
  let key = 0;

  // Patterns for formatting
  const patterns = [
    { regex: /\*\*\*(.+?)\*\*\*/g, render: (match: string) => <strong key={key++} className="italic">{match}</strong> },
    { regex: /\*\*(.+?)\*\*/g, render: (match: string) => <strong key={key++}>{match}</strong> },
    { regex: /\*(.+?)\*/g, render: (match: string) => <em key={key++}>{match}</em> },
    { regex: /__(.+?)__/g, render: (match: string) => <strong key={key++}>{match}</strong> },
    { regex: /_(.+?)_/g, render: (match: string) => <em key={key++}>{match}</em> },
    { regex: /~~(.+?)~~/g, render: (match: string) => <del key={key++}>{match}</del> },
    { regex: /```([^`]+)```/g, render: (match: string) => (
      <pre key={key++} className="bg-black/20 rounded px-2 py-1 text-xs font-mono overflow-x-auto my-1">{match}</pre>
    )},
    { regex: /`([^`]+)`/g, render: (match: string) => (
      <code key={key++} className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">{match}</code>
    )},
  ];

  // Simple implementation - process patterns sequentially
  const processText = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    // Combined regex for all inline formats
    const combinedRegex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_|~~(.+?)~~|```([^`]+)```|`([^`]+)`)/g;

    let match;
    while ((match = combinedRegex.exec(input)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(input.slice(lastIndex, match.index));
      }

      const fullMatch = match[0];

      if (fullMatch.startsWith('***') && fullMatch.endsWith('***')) {
        result.push(<strong key={key++} className="italic">{fullMatch.slice(3, -3)}</strong>);
      } else if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
        result.push(<strong key={key++}>{fullMatch.slice(2, -2)}</strong>);
      } else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
        result.push(<em key={key++}>{fullMatch.slice(1, -1)}</em>);
      } else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) {
        result.push(<strong key={key++}>{fullMatch.slice(2, -2)}</strong>);
      } else if (fullMatch.startsWith('_') && fullMatch.endsWith('_')) {
        result.push(<em key={key++}>{fullMatch.slice(1, -1)}</em>);
      } else if (fullMatch.startsWith('~~') && fullMatch.endsWith('~~')) {
        result.push(<del key={key++}>{fullMatch.slice(2, -2)}</del>);
      } else if (fullMatch.startsWith('```') && fullMatch.endsWith('```')) {
        result.push(
          <pre key={key++} className="bg-black/20 rounded px-2 py-1 text-xs font-mono overflow-x-auto my-1 whitespace-pre-wrap">
            {fullMatch.slice(3, -3)}
          </pre>
        );
      } else if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
        result.push(
          <code key={key++} className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">
            {fullMatch.slice(1, -1)}
          </code>
        );
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < input.length) {
      result.push(input.slice(lastIndex));
    }

    return result.length > 0 ? result : [input];
  };

  return processText(text);
}

// Format hint component
export function FormattingHint() {
  useUiLocale();
  return (
    <div className="text-xs text-muted-foreground space-y-1 p-3 bg-secondary/50 rounded-lg">
      <p className="font-medium mb-2">{uiText("Message Formatting")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div><code className="bg-black/10 px-1 rounded">{uiText("*italic*")}</code> → <em>{uiText("italic")}</em></div>
        <div><code className="bg-black/10 px-1 rounded">{uiText("**bold**")}</code> → <strong>{uiText("bold")}</strong></div>
        <div><code className="bg-black/10 px-1 rounded">{uiText("~~strike~~")}</code> → <del>{uiText("strike")}</del></div>
        <div><code className="bg-black/10 px-1 rounded">{uiText("`code`")}</code> → <code className="bg-black/10 px-1 rounded">{uiText("code")}</code></div>
      </div>
    </div>
  );
}
