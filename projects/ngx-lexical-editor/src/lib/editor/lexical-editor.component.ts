import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  createEditor, 
  $getRoot, 
  $getSelection, 
  $isRangeSelection, 
  LexicalEditor, 
  EditorState, 
  FORMAT_TEXT_COMMAND, 
  TextFormatType, 
  $createParagraphNode, 
  $createTextNode,
  $isTextNode,
  TextNode,
  $setSelection,
  RangeSelection,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { mergeRegister, $getNearestNodeOfType } from '@lexical/utils';
import { $createLinkNode, $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND, $toggleLink } from '@lexical/link';
import { FloatingToolbarComponent } from '../toolbar/floating-toolbar.component';

export interface EditorConfig {
  placeholder?: string;
  initialContent?: string;
  editable?: boolean;
}

export interface TextFormatState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  fontFamily: string;
  fontSize: string;
  fontColor: string;
  backgroundColor: string;
  textAlign: string;
  letterSpacing: string;
  lineHeight: string;
  paragraphSpacing: string;
  isLink: boolean;
  linkUrl: string;
}

@Component({
  selector: 'ngx-lexical-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, FloatingToolbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lexical-editor-container" #editorContainer>
      <div 
        class="lexical-editor-content" 
        #editorContent
        [attr.contenteditable]="editable()"
        (mouseup)="onSelectionChange()"
        (keyup)="onSelectionChange()"
      ></div>
      
      @if (showToolbar() && hasSelection()) {
        <ngx-floating-toolbar
          [formatState]="formatState()"
          [position]="toolbarPosition()"
          (formatCommand)="executeFormatCommand($event)"
          (insertText)="insertText($event)"
          (insertLink)="insertLink($event)"
        />
      }
      
      @if (!hasContent() && placeholder()) {
        <div class="lexical-placeholder">{{ placeholder() }}</div>
      }
    </div>
  `,
  styles: [`
    .lexical-editor-container {
      position: relative;
      width: 100%;
      min-height: 200px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
    }
    
    .lexical-editor-content {
      min-height: 200px;
      padding: 16px;
      outline: none;
      font-family: inherit;
      font-size: 16px;
      line-height: 1.6;
    }
    
    .lexical-editor-content:focus {
      outline: none;
    }
    
    .lexical-placeholder {
      position: absolute;
      top: 16px;
      left: 16px;
      color: #999;
      pointer-events: none;
      user-select: none;
    }
  `],
})
export class LexicalEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContent') editorContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('editorContainer') editorContainerRef!: ElementRef<HTMLDivElement>;

  @Input() set config(value: EditorConfig) {
    this._config.set(value);
  }

  @Output() contentChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<TextFormatState>();

  private _config = signal<EditorConfig>({});
  private editor: LexicalEditor | null = null;
  private cleanupFns: (() => void)[] = [];

  placeholder = computed(() => this._config().placeholder ?? 'Start typing...');
  editable = computed(() => this._config().editable !== false);
  
  showToolbar = signal(true);
  hasSelection = signal(false);
  hasContent = signal(false);
  toolbarPosition = signal({ top: 0, left: 0 });
  
  formatState = signal<TextFormatState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    fontFamily: 'Arial',
    fontSize: '16px',
    fontColor: '#000000',
    backgroundColor: 'transparent',
    textAlign: 'left',
    letterSpacing: 'normal',
    lineHeight: '1.6',
    paragraphSpacing: '0',
    isLink: false,
    linkUrl: '',
  });

  ngAfterViewInit(): void {
    this.injectEditorStyles();
    this.initializeEditor();
  }

  ngOnDestroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.editor = null;
  }

  /**
   * Inject styles directly into the container to support Shadow DOM
   */
  private injectEditorStyles(): void {
    const container = this.editorContainerRef.nativeElement;
    
    // Check if we're in a shadow root
    const root = container.getRootNode();
    const targetNode = root instanceof ShadowRoot ? root : container;
    
    // Check if styles are already injected
    if (targetNode.querySelector('#lexical-editor-format-styles')) {
      return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'lexical-editor-format-styles';
    styleElement.textContent = `
      .editor-text-bold { font-weight: bold; }
      .editor-text-italic { font-style: italic; }
      .editor-text-underline { text-decoration: underline; }
      .editor-text-strikethrough { text-decoration: line-through; }
      .editor-text-underline-strikethrough { text-decoration: underline line-through; }
      .editor-text-code { background-color: #f0f0f0; padding: 1px 4px; font-family: monospace; font-size: 0.9em; }
      .editor-text-subscript { font-size: 0.8em; vertical-align: sub; }
      .editor-text-superscript { font-size: 0.8em; vertical-align: super; }
    `;
    
    if (root instanceof ShadowRoot) {
      root.appendChild(styleElement);
    } else {
      container.insertBefore(styleElement, container.firstChild);
    }
  }

  private initializeEditor(): void {
    const theme = {
      text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        underline: 'editor-text-underline',
        strikethrough: 'editor-text-strikethrough',
        underlineStrikethrough: 'editor-text-underline-strikethrough',
        code: 'editor-text-code',
        subscript: 'editor-text-subscript',
        superscript: 'editor-text-superscript',
      },
    };

    const config = {
      namespace: 'NgxLexicalEditor',
      theme,
      onError: (error: Error) => console.error(error),
      nodes: [LinkNode],
    };

    this.editor = createEditor(config);
    
    const rootElement = this.editorContentRef.nativeElement;
    this.editor.setRootElement(rootElement);

    const cleanup = mergeRegister(
      registerRichText(this.editor),
      this.editor.registerUpdateListener(({ editorState }) => {
        this.onEditorUpdate(editorState);
      }),
      // Register link command handler
      this.editor.registerCommand(
        TOGGLE_LINK_COMMAND,
        (payload: string | null) => {
          $toggleLink(payload);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );

    this.cleanupFns.push(cleanup);

    // Set initial content if provided
    const initialContent = this._config().initialContent;
    if (initialContent) {
      this.setContent(initialContent);
    }
  }

  private onEditorUpdate(editorState: EditorState): void {
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      this.hasContent.set(textContent.length > 0);
      this.contentChange.emit(textContent);
    });
  }

  onSelectionChange(): void {
    if (!this.editor) return;

    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        this.hasSelection.set(true);
        this.updateFormatState(selection);
        this.updateToolbarPosition();
      } else {
        this.hasSelection.set(false);
      }
    });
  }

  private updateFormatState(selection: ReturnType<typeof $getSelection>): void {
    if (!$isRangeSelection(selection)) return;

    const anchorNode = selection.anchor.getNode();
    
    // Check for link
    let isLink = false;
    let linkUrl = '';
    
    const linkNode = $getNearestNodeOfType(anchorNode, LinkNode);
    if (linkNode) {
      isLink = true;
      linkUrl = linkNode.getURL();
    }

    // Get style values from Lexical selection
    const fontFamily = $getSelectionStyleValueForProperty(selection, 'font-family', 'Arial');
    const fontSize = $getSelectionStyleValueForProperty(selection, 'font-size', '16px');
    const fontColor = $getSelectionStyleValueForProperty(selection, 'color', '#000000');
    const backgroundColor = $getSelectionStyleValueForProperty(selection, 'background-color', 'transparent');
    const letterSpacing = $getSelectionStyleValueForProperty(selection, 'letter-spacing', 'normal');
    const lineHeight = $getSelectionStyleValueForProperty(selection, 'line-height', '1.6');

    this.formatState.set({
      isBold: selection.hasFormat('bold'),
      isItalic: selection.hasFormat('italic'),
      isUnderline: selection.hasFormat('underline'),
      isStrikethrough: selection.hasFormat('strikethrough'),
      fontFamily: fontFamily || 'Arial',
      fontSize: fontSize || '16px',
      fontColor: fontColor || '#000000',
      backgroundColor: backgroundColor || 'transparent',
      textAlign: this.getComputedStyle('textAlign') || 'left',
      letterSpacing: letterSpacing || 'normal',
      lineHeight: lineHeight || '1.6',
      paragraphSpacing: this.getComputedStyle('marginBottom') || '0px',
      isLink,
      linkUrl,
    });

    this.selectionChange.emit(this.formatState());
  }

  private getComputedStyle(property: string): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    
    const range = selection.getRangeAt(0);
    const element = range.commonAncestorContainer.parentElement;
    if (!element) return '';
    
    return window.getComputedStyle(element)[property as keyof CSSStyleDeclaration] as string;
  }

  private updateToolbarPosition(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = this.editorContainerRef.nativeElement.getBoundingClientRect();

    const toolbarWidth = 700; // Approximate toolbar width
    const toolbarHeight = 50;
    
    // Calculate centered position
    let left = rect.left - containerRect.left + (rect.width / 2);
    
    // Clamp to container bounds (accounting for transform: translateX(-50%))
    const minLeft = toolbarWidth / 2 + 10;
    const maxLeft = containerRect.width - (toolbarWidth / 2) - 10;
    left = Math.max(minLeft, Math.min(left, maxLeft));
    
    // Ensure toolbar doesn't go above container
    let top = rect.top - containerRect.top - toolbarHeight;
    if (top < 5) {
      // Show below selection instead
      top = rect.bottom - containerRect.top + 10;
    }

    this.toolbarPosition.set({ top, left });
  }

  executeFormatCommand(command: { type: string; value?: string }): void {
    if (!this.editor) return;

    // Handle text format commands outside of update() since dispatchCommand triggers its own update
    switch (command.type) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, command.type as TextFormatType);
        setTimeout(() => this.onSelectionChange(), 0);
        return;
    }

    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      switch (command.type) {
        case 'fontFamily':
          $patchStyleText(selection, { 'font-family': command.value! });
          break;
        case 'fontSize':
          $patchStyleText(selection, { 'font-size': command.value! });
          break;
        case 'fontColor':
          $patchStyleText(selection, { 'color': command.value! });
          break;
        case 'backgroundColor':
          $patchStyleText(selection, { 'background-color': command.value! });
          break;
        case 'letterSpacing':
          $patchStyleText(selection, { 'letter-spacing': command.value! });
          break;
        case 'lineHeight':
          $patchStyleText(selection, { 'line-height': command.value! });
          break;
        case 'textAlign':
          this.applyBlockStyle('textAlign', command.value!);
          break;
        case 'paragraphSpacing':
          this.applyBlockStyle('marginBottom', command.value!);
          break;
      }
    });

    // Update format state after command
    setTimeout(() => this.onSelectionChange(), 0);
  }

  private applyBlockStyle(property: string, value: string): void {
    // For block-level styles like text-align, we need to modify the parent element
    const nativeSelection = window.getSelection();
    if (!nativeSelection || nativeSelection.rangeCount === 0) return;

    const range = nativeSelection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    
    // Find the block-level parent (p, div, etc.)
    while (container && container.nodeType !== Node.ELEMENT_NODE) {
      container = container.parentNode!;
    }
    
    if (container && container instanceof HTMLElement) {
      // Find the paragraph or block element
      let blockElement: HTMLElement | null = container;
      while (blockElement && !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(blockElement.tagName)) {
        blockElement = blockElement.parentElement;
      }
      
      if (blockElement && blockElement.closest('.lexical-editor-content')) {
        (blockElement.style as any)[property] = value;
      }
    }
  }

  insertText(text: string): void {
    if (!this.editor) return;

    this.editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
  }

  insertLink(url: string): void {
    if (!this.editor) return;

    if (url) {
      // Use TOGGLE_LINK_COMMAND to properly wrap selected text with a link
      this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    } else {
      // Remove link if URL is empty
      this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }

  setContent(content: string): void {
    if (!this.editor) return;

    this.editor.update(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(content));
      root.append(paragraph);
    });
  }

  getContent(): string {
    if (!this.editor) return '';

    let content = '';
    this.editor.getEditorState().read(() => {
      const root = $getRoot();
      content = root.getTextContent();
    });
    return content;
  }

  getHtmlContent(): string {
    if (!this.editor) return '';
    return this.editorContentRef.nativeElement.innerHTML;
  }

  focus(): void {
    this.editorContentRef?.nativeElement?.focus();
  }

  blur(): void {
    this.editorContentRef?.nativeElement?.blur();
  }
}
