import { Component, signal, ViewChild, ViewEncapsulation } from '@angular/core';
import { LexicalEditorComponent, EditorConfig, TextFormatState } from 'ngx-lexical-editor';

@Component({
  selector: 'app-root',
  imports: [LexicalEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  // Testing Shadow DOM - this requires the polyfill/workaround in the editor
  encapsulation: ViewEncapsulation.ShadowDom
})
export class App {
  @ViewChild(LexicalEditorComponent) editor!: LexicalEditorComponent;

  sampleHtml = `
    <h1>Welcome to the WYSIWYG Editor</h1>
    <p>This is a <strong>bold</strong> and <em>italic</em> text example.</p>
    <h2>Features</h2>
    <ul>
      <li>Rich text formatting</li>
      <li>Headings (H1-H6)</li>
      <li>Lists (bullet and numbered)</li>
    </ul>
    <p>Try selecting text to see the toolbar appear!</p>
  `;

  editorConfig: EditorConfig = {
    placeholder: 'Start writing your content here...',
    editable: true,
    initialHtml: '',
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

  loadSampleHtml(): void {
    if (this.editor) {
      this.editor.setHtmlContent(this.sampleHtml);
      console.log('Loaded sample HTML');
    }
  }
}
