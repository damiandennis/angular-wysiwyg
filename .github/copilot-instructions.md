# Angular WYSIWYG Library with Lexical

This is an Angular library project that provides a rich text WYSIWYG editor component with a floating toolbar, using the Lexical framework.

## Project Structure

- `projects/ngx-lexical-editor/` - The Angular library source code
  - `src/lib/editor/` - Main editor component with Lexical integration
  - `src/lib/toolbar/` - Floating toolbar component
- `dist/ngx-lexical-editor/` - Built library output

## Features

- Bold, italic, underline, strikethrough text formatting
- Font family and font size selection
- Font color and background color picker
- Text alignment (left, center, right, justify)
- Letter spacing and line height controls
- Paragraph spacing
- Link insertion
- Emoji/text insertion with quick picker
- Floating toolbar that appears on text selection

## Development

### Building the Library

```bash
npm run build
```

### Running Tests

```bash
npm run test
```

### Watch Mode

```bash
npm run build:watch
```

## Dependencies

- Angular 20+ (supports Angular 21)
- Lexical ^0.21.0
- @lexical/selection ^0.21.0
- @lexical/utils ^0.21.0
- @lexical/link ^0.21.0
- @lexical/rich-text ^0.21.0

## Usage

```typescript
import { LexicalEditorComponent } from 'ngx-lexical-editor';

@Component({
  imports: [LexicalEditorComponent],
  template: `
    <ngx-lexical-editor
      [config]="{ placeholder: 'Start writing...' }"
      (contentChange)="onContentChange($event)"
    />
  `
})
export class MyComponent {}
```
