import { Component, signal, ViewChild, ViewEncapsulation } from '@angular/core';
import { LexicalEditorComponent, EditorConfig, TextFormatState, EditorContent } from 'ngx-lexical-editor';

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
  };

  content = signal('');
  formatState = signal<TextFormatState | null>(null);
  savedContent = signal<EditorContent | null>(null); // Combined content storage

  onContentChange(content: string): void {
    this.content.set(content);
  }

  // Listen to combined content changes
  onEditorContentChange(content: EditorContent): void {
    console.log('Content changed:', {
      textLength: content.text.length,
      htmlLength: content.html.length,
      stateLength: content.state.length
    });
  }

  onSelectionChange(formatState: TextFormatState): void {
    this.formatState.set(formatState);
  }

  // Save both HTML and state together
  saveContent(): void {
    if (this.editor) {
      const content = this.editor.getEditorContent();
      this.savedContent.set(content);
      console.log('Saved Content:', content);
      alert(`Saved! HTML: ${content.html.length} chars, State: ${content.state.length} chars`);
    }
  }

  // Restore from saved content (uses state for full fidelity)
  restoreContent(): void {
    const content = this.savedContent();
    if (this.editor && content) {
      this.editor.setEditorContent(content);
      console.log('Content restored');
    } else {
      alert('No saved content to restore. Save first!');
    }
  }

  clearContent(): void {
    if (this.editor) {
      this.editor.setContent('');
    }
  }

  loadSampleHtml(): void {
    if (this.editor) {
      this.editor.setHtmlContent(this.sampleHtml);
      console.log('Loaded sample HTML');
    }
  }
}
