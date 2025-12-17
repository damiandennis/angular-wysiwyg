import { Component, signal, ViewChild } from '@angular/core';
import { LexicalEditorComponent, EditorConfig, TextFormatState } from 'ngx-lexical-editor';

@Component({
  selector: 'app-root',
  imports: [LexicalEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  @ViewChild(LexicalEditorComponent) editor!: LexicalEditorComponent;

  editorConfig: EditorConfig = {
    placeholder: 'Start writing your content here...',
    editable: true,
  };

  content = signal('');
  formatState = signal<TextFormatState | null>(null);

  onContentChange(content: string): void {
    this.content.set(content);
  }

  onSelectionChange(formatState: TextFormatState): void {
    this.formatState.set(formatState);
  }

  getHtmlContent(): void {
    if (this.editor) {
      const html = this.editor.getHtmlContent();
      console.log('HTML Content:', html);
      alert('Check console for HTML content');
    }
  }

  clearContent(): void {
    if (this.editor) {
      this.editor.setContent('');
    }
  }

  insertSampleText(): void {
    if (this.editor) {
      this.editor.setContent('This is some sample text to demonstrate the WYSIWYG editor capabilities. Select this text to see the floating toolbar appear!');
    }
  }
}
