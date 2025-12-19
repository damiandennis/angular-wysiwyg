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
  Inject,
} from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
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
  $setSelection,
  RangeSelection,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { registerRichText, HeadingNode, $createHeadingNode, $isHeadingNode, QuoteNode, $createQuoteNode, $isQuoteNode } from '@lexical/rich-text';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { mergeRegister, $getNearestNodeOfType } from '@lexical/utils';
import { LinkNode, TOGGLE_LINK_COMMAND, $toggleLink } from '@lexical/link';
import { 
  ListNode, 
  ListItemNode, 
  INSERT_UNORDERED_LIST_COMMAND, 
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  $isListItemNode,
  insertList,
  removeList
} from '@lexical/list';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { FloatingToolbarComponent } from '../toolbar/floating-toolbar.component';

export interface EditorConfig {
  placeholder?: string;
  initialContent?: string;
  initialHtml?: string;
  initialState?: string; // JSON serialized editor state - best for complete restoration
  editable?: boolean;
}

/**
 * Combined content format for saving/loading editor content.
 * The state preserves all formatting, while HTML is useful for display.
 */
export interface EditorContent {
  html: string;   // HTML representation (good for display, may lose some formatting)
  state: string;  // JSON state (preserves ALL formatting - use for restore)
  text: string;   // Plain text content
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
  blockType: string;
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
        (focus)="onEditorFocus()"
        (blur)="onEditorBlur()"
      ></div>
      
      @if (showToolbar() && isEditorActive()) {
        <ngx-floating-toolbar
          [formatState]="formatState()"
          (formatCommand)="executeFormatCommand($event)"
          (insertText)="insertText($event)"
          (insertLink)="insertLink($event)"
          (toolbarMouseDown)="onToolbarInteractionStart()"
          (toolbarMouseUp)="onToolbarInteractionEnd()"
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

  @Output() contentChange = new EventEmitter<string>(); // Emits plain text
  @Output() editorContentChange = new EventEmitter<EditorContent>(); // Emits HTML, state, and text
  @Output() selectionChange = new EventEmitter<TextFormatState>();

  private _config = signal<EditorConfig>({});
  private editor: LexicalEditor | null = null;
  private cleanupFns: (() => void)[] = [];
  private shadowRoot: ShadowRoot | null = null;
  private originalGetSelection: typeof document.getSelection | null = null;
  private isInteractingWithToolbar = false;
  private storedSelection: RangeSelection | null = null;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  placeholder = computed(() => this._config().placeholder ?? 'Start typing...');
  editable = computed(() => this._config().editable !== false);
  
  showToolbar = signal(true);
  hasSelection = signal(false);
  hasContent = signal(false);
  isEditorFocused = signal(false);
  
  isEditorActive = computed(() => this.isEditorFocused() || this.hasSelection());
  
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
    blockType: 'paragraph',
  });

  ngAfterViewInit(): void {
    this.setupShadowDomSupport();
    this.injectEditorStyles();
    this.initializeEditor();
  }

  ngOnDestroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.restoreGetSelection();
    this.editor = null;
  }

  /**
   * Set up Shadow DOM support by patching getSelection at window level.
   * Uses multiple strategies to try to make selection work in Shadow DOM.
   */
  private setupShadowDomSupport(): void {
    const container = this.editorContainerRef.nativeElement;
    const root = container.getRootNode();
    
    if (root instanceof ShadowRoot) {
      this.shadowRoot = root;
      
      // Store original getSelection
      const originalDocGetSelection = this.document.getSelection.bind(this.document);
      this.originalGetSelection = originalDocGetSelection;
      
      const shadowRoot = this.shadowRoot;
      
      // Create a patched getSelection that works with Shadow DOM
      // Only use shadowRoot.getSelection() which is the most reliable when available
      const patchedGetSelection = (): Selection | null => {
        // Strategy 1: Try shadowRoot.getSelection() (WebKit/Safari and newer Chrome)
        if ('getSelection' in shadowRoot) {
          try {
            const shadowSelection = (shadowRoot as any).getSelection();
            if (shadowSelection && shadowSelection.rangeCount > 0) {
              return shadowSelection;
            }
          } catch (e) {
            // shadowRoot.getSelection not available
          }
        }
        
        // Fall back to document.getSelection
        return originalDocGetSelection();
      };
      
      // Patch both window.getSelection and document.getSelection
      (window as any).getSelection = patchedGetSelection;
      (this.document as any).getSelection = patchedGetSelection;
      
      // Listen for selection changes
      const selectionChangeHandler = () => {
        if (this.editor) {
          this.editor.update(() => {});
        }
      };
      
      this.document.addEventListener('selectionchange', selectionChangeHandler);
      this.cleanupFns.push(() => {
        this.document.removeEventListener('selectionchange', selectionChangeHandler);
      });
    }
  }

  /**
   * Restore the original getSelection method
   */
  private restoreGetSelection(): void {
    if (this.originalGetSelection) {
      (this.document as any).getSelection = this.originalGetSelection;
      (window as any).getSelection = this.originalGetSelection;
      this.originalGetSelection = null;
    }
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
      onError: (error: Error) => {
        console.error(error);
      },
      nodes: [LinkNode, ListNode, ListItemNode, HeadingNode, QuoteNode],
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
      // Register list command handlers
      this.editor.registerCommand(
        INSERT_UNORDERED_LIST_COMMAND,
        () => {
          insertList(this.editor!, 'bullet');
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      this.editor.registerCommand(
        INSERT_ORDERED_LIST_COMMAND,
        () => {
          insertList(this.editor!, 'number');
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      this.editor.registerCommand(
        REMOVE_LIST_COMMAND,
        () => {
          removeList(this.editor!);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );

    this.cleanupFns.push(cleanup);

    // Shadow DOM workaround: Handle input events manually
    if (this.shadowRoot) {
      // Track if we're in a text insertion mode
      let pendingText = '';
      let insertionTimeout: number | null = null;
      
      const beforeInputHandler = (event: InputEvent) => {
        // Only handle insertText events (typing characters)
        if (event.inputType === 'insertText' && event.data) {
          // MUST prevent default and stop propagation immediately
          // to prevent Lexical's own handler from also processing this
          event.preventDefault();
          event.stopImmediatePropagation();
          
          pendingText += event.data;
          
          // Batch rapid keystrokes together
          if (insertionTimeout) {
            clearTimeout(insertionTimeout);
          }
          
          insertionTimeout = window.setTimeout(() => {
            const textToInsert = pendingText;
            pendingText = '';
            insertionTimeout = null;
            
            if (this.editor && textToInsert) {
              this.editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  // Insert text at current selection
                  selection.insertText(textToInsert);
                } else {
                  // No selection, create one at the end
                  const root = $getRoot();
                  const lastChild = root.getLastChild();
                  if (lastChild) {
                    root.selectEnd();
                    const newSelection = $getSelection();
                    if ($isRangeSelection(newSelection)) {
                      newSelection.insertText(textToInsert);
                    }
                  }
                }
              });
            }
          }, 0); // Execute immediately but after current call stack
        }
      };
      
      // Handle special keys via keydown
      const keydownHandler = (event: KeyboardEvent) => {
        if (!this.editor) return;
        
        // Only intercept if not a modifier key combination (allow Ctrl+C, Ctrl+V, etc.)
        if (event.ctrlKey || event.metaKey || event.altKey) {
          return;
        }
        
        // Handle Enter key
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              // Check if we're in an empty list item - if so, exit the list
              let node = selection.anchor.getNode();
              
              // Traverse up to find list item
              let listItemNode = null;
              let currentNode: any = node;
              while (currentNode) {
                if ($isListItemNode(currentNode)) {
                  listItemNode = currentNode;
                  break;
                }
                currentNode = currentNode.getParent ? currentNode.getParent() : null;
              }
              
              if (listItemNode && listItemNode.getTextContent().trim() === '') {
                // Empty list item - remove it and exit the list
                const listNode = listItemNode.getParent();
                if ($isListNode(listNode)) {
                  // Remove the empty list item
                  listItemNode.remove();
                  
                  // If list is now empty, remove it too
                  if (listNode.getChildrenSize() === 0) {
                    const paragraph = $createParagraphNode();
                    listNode.replace(paragraph);
                    paragraph.select();
                  } else {
                    // Insert a paragraph after the list and select it
                    const paragraph = $createParagraphNode();
                    listNode.insertAfter(paragraph);
                    paragraph.select();
                  }
                  return;
                }
              }
              
              // Normal case - insert paragraph/line break
              selection.insertParagraph();
            }
          });
          return;
        }
        
        // Handle Backspace
        if (event.key === 'Backspace') {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              // Check if we're at the beginning of a list item
              const anchorOffset = selection.anchor.offset;
              
              if (anchorOffset === 0 && selection.isCollapsed()) {
                let node = selection.anchor.getNode();
                
                // Traverse up to find list item
                let listItemNode = null;
                let currentNode: any = node;
                while (currentNode) {
                  if ($isListItemNode(currentNode)) {
                    listItemNode = currentNode;
                    break;
                  }
                  currentNode = currentNode.getParent ? currentNode.getParent() : null;
                }
                
                if (listItemNode) {
                  const listNode = listItemNode.getParent();
                  if ($isListNode(listNode)) {
                    // Check if this is the first item in the list
                    const listItems = listNode.getChildren();
                    const isFirstItem = listItems.length > 0 && listItems[0] === listItemNode;
                    
                    if (isFirstItem) {
                      // Convert first list item to paragraph and insert before list
                      const paragraph = $createParagraphNode();
                      const textContent = listItemNode.getTextContent();
                      if (textContent) {
                        paragraph.append($createTextNode(textContent));
                      }
                      
                      // Insert paragraph before the list
                      listNode.insertBefore(paragraph);
                      
                      // Remove the first list item
                      listItemNode.remove();
                      
                      // If list is now empty, remove it
                      if (listNode.getChildrenSize() === 0) {
                        listNode.remove();
                      }
                      
                      // Select the paragraph
                      paragraph.select();
                      return;
                    }
                  }
                }
              }
              
              // Normal backspace
              selection.deleteCharacter(true);
            }
          });
          return;
        }
        
        // Handle Delete
        if (event.key === 'Delete') {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.deleteCharacter(false);
            }
          });
          return;
        }
      };
      
      // Use capture phase to intercept before Lexical's handlers
      rootElement.addEventListener('beforeinput', beforeInputHandler, true);
      rootElement.addEventListener('keydown', keydownHandler, true);
      this.cleanupFns.push(() => {
        rootElement.removeEventListener('beforeinput', beforeInputHandler, true);
        rootElement.removeEventListener('keydown', keydownHandler, true);
        if (insertionTimeout) clearTimeout(insertionTimeout);
      });
    }

    // Set initial content if provided (prefer JSON state > HTML > plain text)
    const initialState = this._config().initialState;
    const initialHtml = this._config().initialHtml;
    const initialContent = this._config().initialContent;
    if (initialState) {
      this.setEditorState(initialState);
    } else if (initialHtml) {
      this.setHtmlContent(initialHtml);
    } else if (initialContent) {
      this.setContent(initialContent);
    }
  }

  private onEditorUpdate(editorState: EditorState): void {
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      this.hasContent.set(textContent.length > 0);
      
      // Emit plain text for backward compatibility
      this.contentChange.emit(textContent);
      
      // Emit combined content (HTML, state, text)
      const html = $generateHtmlFromNodes(this.editor!);
      const state = JSON.stringify(editorState.toJSON());
      this.editorContentChange.emit({
        html,
        state,
        text: textContent
      });
    });
  }

  onSelectionChange(): void {
    if (!this.editor) return;
    
    // Don't update selection state if user is interacting with toolbar
    if (this.isInteractingWithToolbar) return;

    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        this.hasSelection.set(true);
        this.storedSelection = selection.clone();
        this.updateFormatState(selection);
      } else {
        this.hasSelection.set(false);
        this.storedSelection = null;
      }
    });
  }

  /**
   * Called by toolbar when user starts interacting with it (mousedown)
   */
  onToolbarInteractionStart(): void {
    this.isInteractingWithToolbar = true;
  }

  /**
   * Called by toolbar when user finishes interacting with it
   */
  onToolbarInteractionEnd(): void {
    this.isInteractingWithToolbar = false;
  }

  /**
   * Called when the editor content area receives focus
   */
  onEditorFocus(): void {
    this.isEditorFocused.set(true);
    // Update format state even without selection
    if (this.editor) {
      this.editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          this.updateFormatState(selection);
        }
      });
    }
  }

  /**
   * Called when the editor content area loses focus
   */
  onEditorBlur(): void {
    // Delay blur to allow toolbar clicks to complete
    setTimeout(() => {
      if (!this.isInteractingWithToolbar) {
        this.isEditorFocused.set(false);
      }
    }, 150);
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

    // Determine block type
    let blockType = 'paragraph';
    const topLevelElement = anchorNode.getTopLevelElement();
    if (topLevelElement) {
      if ($isHeadingNode(topLevelElement)) {
        blockType = topLevelElement.getTag(); // 'h1', 'h2', etc.
      } else if ($isListNode(topLevelElement)) {
        blockType = topLevelElement.getListType() === 'bullet' ? 'ul' : 'ol';
      }
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
      blockType,
    });

    this.selectionChange.emit(this.formatState());
  }

  /**
   * Get the current selection, using shadow root selection if available
   */
  private getSelection(): Selection | null {
    if (this.shadowRoot && 'getSelection' in this.shadowRoot) {
      const shadowSelection = (this.shadowRoot as any).getSelection();
      if (shadowSelection && shadowSelection.rangeCount > 0) {
        return shadowSelection;
      }
    }
    return this.document.getSelection();
  }

  private getComputedStyle(property: string): string {
    const selection = this.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    
    const range = selection.getRangeAt(0);
    const element = range.commonAncestorContainer.parentElement;
    if (!element) return '';
    
    return window.getComputedStyle(element)[property as keyof CSSStyleDeclaration] as string;
  }

  executeFormatCommand(command: { type: string; value?: string }): void {
    if (!this.editor) return;

    // Reset interaction flag so selection changes can be detected again
    this.isInteractingWithToolbar = false;

    // Handle text format commands outside of update() since dispatchCommand triggers its own update
    switch (command.type) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, command.type as TextFormatType);
        setTimeout(() => this.onSelectionChange(), 0);
        return;
      case 'bulletList':
        this.editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        setTimeout(() => this.onSelectionChange(), 0);
        return;
      case 'numberedList':
        this.editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
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
        case 'blockType':
          this.applyBlockType(selection, command.value!);
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

  private applyBlockType(selection: RangeSelection, blockType: string): void {
    const anchorNode = selection.anchor.getNode();
    const topLevelElement = anchorNode.getTopLevelElement();
    
    if (!topLevelElement) return;

    // Get all children of the current block to preserve content
    const children = topLevelElement.getChildren();
    
    let newBlock;
    if (blockType === 'paragraph') {
      newBlock = $createParagraphNode();
    } else if (blockType.startsWith('h') && blockType.length === 2) {
      // h1, h2, h3, h4, h5, h6
      newBlock = $createHeadingNode(blockType as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6');
    } else {
      return; // Unknown block type
    }

    // Move all children to the new block
    children.forEach(child => {
      newBlock.append(child);
    });

    // Replace the old block with the new one
    topLevelElement.replace(newBlock);
    
    // Restore selection to the new block
    newBlock.selectEnd();
  }

  insertText(text: string): void {
    if (!this.editor) return;

    // Reset interaction flag so selection changes can be detected again
    this.isInteractingWithToolbar = false;

    this.editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
  }

  insertLink(url: string): void {
    if (!this.editor) return;

    this.editor.update(() => {
      // First, try to restore the stored selection if current selection is invalid
      let selection = $getSelection();
      
      if ((!$isRangeSelection(selection) || selection.isCollapsed()) && this.storedSelection) {
        // Restore the stored selection
        $setSelection(this.storedSelection.clone());
        selection = $getSelection();
      }
      
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        if (url) {
          // Use $toggleLink which properly handles the selection context
          $toggleLink(url);
        }
      }
    });
    
    // Clear stored selection and reset state after use
    this.storedSelection = null;
    this.hasSelection.set(false);
    this.isInteractingWithToolbar = false;
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

  /**
   * Set the editor content from an HTML string.
   * This properly parses the HTML and converts it to Lexical nodes.
   */
  setHtmlContent(html: string): void {
    if (!this.editor) {
      console.warn('Editor not initialized');
      return;
    }

    this.editor.update(() => {
      const root = $getRoot();
      
      // First select all content
      root.clear();

      // Create a DOM parser to convert HTML string to DOM nodes
      const parser = new DOMParser();
      const dom = parser.parseFromString(`<body>${html}</body>`, 'text/html');
      
      // Convert DOM nodes to Lexical nodes
      const nodes = $generateNodesFromDOM(this.editor!, dom);
      
      // Filter out any invalid nodes and append valid ones
      if (nodes.length > 0) {
        nodes.forEach(node => {
          if (node) {
            root.append(node);
          }
        });
      }

      // If no nodes were generated or root is empty, create at least one paragraph
      if (root.getChildrenSize() === 0) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      }
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

  /**
   * Get the editor content as an HTML string.
   * This properly serializes the Lexical nodes to HTML.
   */
  getHtmlContent(): string {
    if (!this.editor) return '';
    
    let html = '';
    this.editor.getEditorState().read(() => {
      html = $generateHtmlFromNodes(this.editor!);
    });
    return html;
  }

  /**
   * Get the raw HTML from the editor's DOM.
   * This returns the actual rendered HTML which may include additional styling.
   */
  getRawHtmlContent(): string {
    if (!this.editor) return '';
    return this.editorContentRef.nativeElement.innerHTML;
  }

  /**
   * Get the editor state as a JSON string.
   * This is the BEST method for saving content as it preserves ALL formatting.
   */
  getEditorState(): string {
    if (!this.editor) return '';
    return JSON.stringify(this.editor.getEditorState().toJSON());
  }

  /**
   * Set the editor state from a JSON string.
   * This is the BEST method for loading content as it preserves ALL formatting.
   */
  setEditorState(stateJson: string): void {
    if (!this.editor) {
      console.warn('Editor not initialized');
      return;
    }

    try {
      const parsedState = this.editor.parseEditorState(stateJson);
      this.editor.setEditorState(parsedState);
    } catch (error) {
      console.error('Failed to parse editor state:', error);
    }
  }

  /**
   * Get all content formats at once (HTML, state, and text).
   * Recommended for saving to a database.
   */
  getEditorContent(): EditorContent {
    if (!this.editor) {
      return { html: '', state: '', text: '' };
    }

    let content: EditorContent = { html: '', state: '', text: '' };
    
    this.editor.getEditorState().read(() => {
      const root = $getRoot();
      content = {
        html: $generateHtmlFromNodes(this.editor!),
        state: JSON.stringify(this.editor!.getEditorState().toJSON()),
        text: root.getTextContent()
      };
    });
    
    return content;
  }

  /**
   * Load content from an EditorContent object.
   * Uses state for full restoration, falls back to HTML if state is empty.
   */
  setEditorContent(content: EditorContent): void {
    if (!this.editor) {
      console.warn('Editor not initialized');
      return;
    }

    // Prefer state (full fidelity) over HTML
    if (content.state) {
      this.setEditorState(content.state);
    } else if (content.html) {
      this.setHtmlContent(content.html);
    } else if (content.text) {
      this.setContent(content.text);
    }
  }

  focus(): void {
    this.editorContentRef?.nativeElement?.focus();
  }

  blur(): void {
    this.editorContentRef?.nativeElement?.blur();
  }
}
