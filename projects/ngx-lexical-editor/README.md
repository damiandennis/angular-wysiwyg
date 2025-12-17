# NgxLexicalEditor

A powerful Angular WYSIWYG editor library with a floating toolbar, built on top of the [Lexical](https://lexical.dev/) framework.

## Features

- **Text Formatting**: Bold, italic, underline, strikethrough
- **Font Customization**: Font family, font size, font color, background color
- **Text Alignment**: Left, center, right, justify
- **Spacing Controls**: Letter spacing, line height, paragraph spacing
- **Links**: Insert and edit hyperlinks
- **Emoji/Text Insertion**: Quick emoji picker with common emojis
- **Floating Toolbar**: Context-aware toolbar that appears on text selection
- **Angular 20+**: Built with modern Angular features (signals, standalone components)

## Installation

```bash
npm install ngx-lexical-editor lexical @lexical/selection @lexical/utils @lexical/link @lexical/rich-text
```

## Usage

### Import the Component

```typescript
import { Component } from '@angular/core';
import { LexicalEditorComponent, EditorConfig, TextFormatState } from 'ngx-lexical-editor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LexicalEditorComponent],
  template: `
    <ngx-lexical-editor
      [config]="editorConfig"
      (contentChange)="onContentChange($event)"
      (selectionChange)="onSelectionChange($event)"
    />
  `,
})
export class AppComponent {
  editorConfig: EditorConfig = {
    placeholder: 'Start writing...',
    editable: true,
  };

  onContentChange(content: string): void {
    console.log('Content:', content);
  }

  onSelectionChange(formatState: TextFormatState): void {
    console.log('Format state:', formatState);
  }
}
```

### Configuration Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `placeholder` | `string` | `'Start typing...'` | Placeholder text when editor is empty |
| `initialContent` | `string` | `''` | Initial text content |
| `editable` | `boolean` | `true` | Whether the editor is editable |

### Events

| Event | Type | Description |
|-------|------|-------------|
| `contentChange` | `EventEmitter<string>` | Emitted when content changes |
| `selectionChange` | `EventEmitter<TextFormatState>` | Emitted when selection/format changes |

### Public Methods

| Method | Description |
|--------|-------------|
| `setContent(content: string)` | Set the editor content |
| `getContent(): string` | Get the plain text content |
| `getHtmlContent(): string` | Get the HTML content |
| `focus()` | Focus the editor |
| `blur()` | Blur the editor |

## Building

```bash
ng build ngx-lexical-editor
```

## Testing

```bash
ng test ngx-lexical-editor
```

## License

MIT

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
