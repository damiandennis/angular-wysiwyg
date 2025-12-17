import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TextFormatState } from '../editor/lexical-editor.component';

export interface FormatCommand {
  type: string;
  value?: string;
}

@Component({
  selector: 'ngx-floating-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="floating-toolbar btn-toolbar"
      [style.top.px]="position.top"
      [style.left.px]="position.left"
      (mousedown)="onToolbarMouseDown($event)"
    >
      <!-- Text Format Buttons -->
      <div class="btn-group btn-group-sm me-2">
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.isBold"
          (click)="onFormat('bold')"
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.isItalic"
          (click)="onFormat('italic')"
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.isUnderline"
          (click)="onFormat('underline')"
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.isStrikethrough"
          (click)="onFormat('strikethrough')"
          title="Strikethrough"
        >
          <s>S</s>
        </button>
      </div>

      <!-- Font Family Dropdown -->
      <div class="btn-group btn-group-sm me-2">
        <div class="dropdown">
          <button 
            type="button"
            class="btn btn-outline-secondary dropdown-toggle"
            (click)="toggleDropdown('fontFamily')"
          >
            {{ getCurrentFontLabel() }}
          </button>
          @if (openDropdown() === 'fontFamily') {
            <div class="dropdown-menu show">
              @for (font of fontFamilies; track font.value) {
                <button 
                  type="button"
                  class="dropdown-item" 
                  [class.active]="selectedFontFamily() === font.value"
                  (click)="onFontFamilyChange(font.value)"
                >{{ font.label }}</button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Font Size Dropdown -->
      <div class="btn-group btn-group-sm me-2">
        <div class="dropdown">
          <button 
            type="button"
            class="btn btn-outline-secondary dropdown-toggle"
            (click)="toggleDropdown('fontSize')"
          >
            {{ selectedFontSize() }}
          </button>
          @if (openDropdown() === 'fontSize') {
            <div class="dropdown-menu show">
              @for (size of fontSizes; track size) {
                <button 
                  type="button"
                  class="dropdown-item"
                  [class.active]="selectedFontSize() === size"
                  (click)="onFontSizeChange(size)"
                >{{ size }}</button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Colors -->
      <div class="btn-group btn-group-sm me-2">
        <label class="btn btn-outline-secondary color-btn" title="Font Color">
          <span class="color-indicator" [style.background-color]="formatState.fontColor || '#000000'"></span>
          <span class="color-label">A</span>
          <input 
            type="color" 
            class="color-input-hidden"
            [value]="formatState.fontColor || '#000000'"
            (input)="onFontColorChange($any($event.target).value)"
          />
        </label>
        <label class="btn btn-outline-secondary color-btn" title="Background Color">
          <span class="color-indicator" [style.background-color]="bgColorValue()"></span>
          <span class="color-label">🎨</span>
          <input 
            type="color" 
            class="color-input-hidden"
            [value]="bgColorValue()"
            (input)="onBackgroundColorChange($any($event.target).value)"
          />
        </label>
      </div>

      <!-- Text Alignment -->
      <div class="btn-group btn-group-sm me-2">
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.textAlign === 'left'"
          (click)="onTextAlign('left')"
          title="Align Left"
        >⫷</button>
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.textAlign === 'center'"
          (click)="onTextAlign('center')"
          title="Align Center"
        >⫶</button>
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.textAlign === 'right'"
          (click)="onTextAlign('right')"
          title="Align Right"
        >⫸</button>
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.textAlign === 'justify'"
          (click)="onTextAlign('justify')"
          title="Justify"
        >☰</button>
      </div>

      <!-- Spacing Dropdown -->
      <div class="btn-group btn-group-sm me-2">
        <div class="dropdown">
          <button 
            type="button"
            class="btn btn-outline-secondary dropdown-toggle"
            (click)="toggleDropdown('spacing')"
            title="Spacing Options"
          >
            ¶
          </button>
          @if (openDropdown() === 'spacing') {
            <div class="dropdown-menu show spacing-menu">
              <div class="dropdown-header">Letter Spacing</div>
              @for (spacing of letterSpacingOptions; track spacing.value) {
                <button 
                  type="button"
                  class="dropdown-item"
                  (click)="onLetterSpacingChange(spacing.value)"
                >{{ spacing.label }}</button>
              }
              <div class="dropdown-divider"></div>
              <div class="dropdown-header">Line Height</div>
              @for (lh of lineHeightOptions; track lh.value) {
                <button 
                  type="button"
                  class="dropdown-item"
                  (click)="onLineHeightChange(lh.value)"
                >{{ lh.label }}</button>
              }
              <div class="dropdown-divider"></div>
              <div class="dropdown-header">Paragraph Spacing</div>
              @for (ps of paragraphSpacingOptions; track ps.value) {
                <button 
                  type="button"
                  class="dropdown-item"
                  (click)="onParagraphSpacingChange(ps.value)"
                >{{ ps.label }}</button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Link -->
      <div class="btn-group btn-group-sm me-2">
        <button 
          type="button"
          class="btn btn-outline-secondary" 
          [class.active]="formatState.isLink"
          (click)="toggleDropdown('link')"
          title="Insert Link"
        >🔗</button>
      </div>

      <!-- Emoji -->
      <div class="btn-group btn-group-sm">
        <button 
          type="button"
          class="btn btn-outline-secondary"
          (click)="toggleDropdown('emoji')"
          title="Insert Emoji"
        >😀</button>
      </div>

      <!-- Link Input Panel -->
      @if (openDropdown() === 'link') {
        <div class="dropdown-panel link-panel">
          <div class="input-group input-group-sm">
            <input 
              type="url" 
              class="form-control"
              placeholder="Enter URL..."
              [ngModel]="linkUrl()"
              (ngModelChange)="linkUrl.set($event)"
              (keydown.enter)="applyLink()"
            />
            <button class="btn btn-primary" type="button" (click)="applyLink()">Apply</button>
            <button class="btn btn-outline-secondary" type="button" (click)="closeDropdowns()">✕</button>
          </div>
        </div>
      }

      <!-- Emoji Picker Panel -->
      @if (openDropdown() === 'emoji') {
        <div class="dropdown-panel emoji-panel">
          <div class="emoji-grid">
            @for (emoji of commonEmojis; track emoji) {
              <button 
                type="button"
                class="btn btn-light emoji-btn" 
                (click)="onInsertEmoji(emoji)"
              >{{ emoji }}</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .floating-toolbar {
      position: absolute;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      padding: 8px 12px;
      background: #ffffff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 1050;
      transform: translateX(-50%);
      gap: 0;
      white-space: nowrap;
    }

    .btn-group-sm > .btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.875rem;
      min-width: 32px;
    }

    .btn-outline-secondary {
      border-color: #dee2e6;
      color: #495057;
    }

    .btn-outline-secondary:hover {
      background-color: #e9ecef;
      border-color: #dee2e6;
      color: #495057;
    }

    .btn-outline-secondary.active {
      background-color: #0d6efd;
      border-color: #0d6efd;
      color: #fff;
    }

    .me-2 {
      margin-right: 0.5rem;
    }

    .dropdown {
      position: relative;
    }

    .dropdown-toggle {
      min-width: 80px;
      text-align: left;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dropdown-toggle::after {
      content: '';
      border: solid #495057;
      border-width: 0 2px 2px 0;
      display: inline-block;
      padding: 3px;
      transform: rotate(45deg);
      margin-left: 8px;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 1060;
      min-width: 120px;
      max-height: 250px;
      overflow-y: auto;
      padding: 0.5rem 0;
      margin-top: 2px;
      background-color: #fff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .dropdown-item {
      display: block;
      width: 100%;
      padding: 0.35rem 1rem;
      clear: both;
      font-weight: 400;
      color: #212529;
      text-align: inherit;
      white-space: nowrap;
      background-color: transparent;
      border: 0;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .dropdown-item:hover {
      background-color: #e9ecef;
    }

    .dropdown-item.active {
      background-color: #0d6efd;
      color: #fff;
    }

    .dropdown-header {
      display: block;
      padding: 0.35rem 1rem;
      font-size: 0.75rem;
      color: #6c757d;
      font-weight: 600;
      text-transform: uppercase;
    }

    .dropdown-divider {
      height: 0;
      margin: 0.5rem 0;
      overflow: hidden;
      border-top: 1px solid #dee2e6;
    }

    .spacing-menu {
      min-width: 160px;
    }

    .color-btn {
      position: relative;
      padding: 0.25rem 0.4rem !important;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      cursor: pointer;
    }

    .color-indicator {
      width: 16px;
      height: 3px;
      border-radius: 1px;
      position: absolute;
      bottom: 4px;
    }

    .color-label {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .color-input-hidden {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      top: 0;
      left: 0;
    }

    .dropdown-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 1060;
    }

    .link-panel {
      padding: 8px;
      min-width: 300px;
    }

    .link-panel .form-control {
      border-radius: 4px 0 0 4px;
    }

    .emoji-panel {
      padding: 8px;
    }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
      max-width: 280px;
    }

    .emoji-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .emoji-btn:hover {
      background-color: #e9ecef;
    }

    .input-group-sm > .form-control {
      padding: 0.25rem 0.5rem;
      font-size: 0.875rem;
    }

    .input-group-sm > .btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.875rem;
    }

    .form-control {
      border: 1px solid #dee2e6;
      border-radius: 4px;
    }

    .form-control:focus {
      border-color: #86b7fe;
      box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
      outline: none;
    }

    .btn-primary {
      background-color: #0d6efd;
      border-color: #0d6efd;
      color: #fff;
    }

    .btn-primary:hover {
      background-color: #0b5ed7;
      border-color: #0a58ca;
    }

    .btn-light {
      background-color: #f8f9fa;
      border-color: #f8f9fa;
    }

    .input-group {
      display: flex;
    }

    .input-group > .form-control {
      flex: 1;
    }

    .input-group > .btn:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;
    }

    .input-group > .form-control:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  `],
})
export class FloatingToolbarComponent {
  @Input() formatState!: TextFormatState;
  @Input() position: { top: number; left: number } = { top: 0, left: 0 };

  @Output() formatCommand = new EventEmitter<FormatCommand>();
  @Output() insertText = new EventEmitter<string>();
  @Output() insertLink = new EventEmitter<string>();

  openDropdown = signal<string | null>(null);
  linkUrl = signal('');

  fontFamilies = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
    { label: 'Comic Sans', value: '"Comic Sans MS", cursive' },
    { label: 'Impact', value: 'Impact, sans-serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  ];

  fontSizes = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px'];

  letterSpacingOptions = [
    { label: 'Normal', value: 'normal' },
    { label: '1px', value: '1px' },
    { label: '2px', value: '2px' },
    { label: '3px', value: '3px' },
    { label: '5px', value: '5px' },
  ];

  lineHeightOptions = [
    { label: '1.0', value: '1' },
    { label: '1.2', value: '1.2' },
    { label: '1.4', value: '1.4' },
    { label: '1.6', value: '1.6' },
    { label: '1.8', value: '1.8' },
    { label: '2.0', value: '2' },
  ];

  paragraphSpacingOptions = [
    { label: 'None', value: '0px' },
    { label: '8px', value: '8px' },
    { label: '16px', value: '16px' },
    { label: '24px', value: '24px' },
    { label: '32px', value: '32px' },
  ];

  commonEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
    '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎',
    '👍', '👎', '👏', '🙌', '🤝', '💪', '❤️', '💔',
    '⭐', '🔥', '✨', '💡', '✅', '❌', '⚠️', '💬',
  ];

  selectedFontFamily = computed(() => {
    const current = this.formatState?.fontFamily || 'Arial';
    return this.fontFamilies.find(f => current.includes(f.value.split(',')[0].replace(/"/g, '')))?.value || 'Arial, sans-serif';
  });

  selectedFontSize = computed(() => {
    const current = this.formatState?.fontSize || '16px';
    return this.fontSizes.find(s => current.includes(s.replace('px', ''))) || '16px';
  });

  bgColorValue = computed(() => {
    const bg = this.formatState?.backgroundColor || 'transparent';
    if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return '#ffffff';
    return bg;
  });

  getCurrentFontLabel(): string {
    const current = this.formatState?.fontFamily || 'Arial';
    const found = this.fontFamilies.find(f => current.includes(f.value.split(',')[0].replace(/"/g, '')));
    return found?.label || 'Arial';
  }

  onToolbarMouseDown(event: MouseEvent): void {
    // Prevent default to avoid losing selection, but allow clicks on inputs/buttons
    const target = event.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON') {
      event.preventDefault();
    }
  }

  toggleDropdown(dropdown: string): void {
    if (this.openDropdown() === dropdown) {
      this.openDropdown.set(null);
    } else {
      this.openDropdown.set(dropdown);
    }
  }

  closeDropdowns(): void {
    this.openDropdown.set(null);
  }

  onFormat(type: string): void {
    this.formatCommand.emit({ type });
    this.closeDropdowns();
  }

  onFontFamilyChange(value: string): void {
    this.formatCommand.emit({ type: 'fontFamily', value });
    this.closeDropdowns();
  }

  onFontSizeChange(value: string): void {
    this.formatCommand.emit({ type: 'fontSize', value });
    this.closeDropdowns();
  }

  onFontColorChange(value: string): void {
    this.formatCommand.emit({ type: 'fontColor', value });
  }

  onBackgroundColorChange(value: string): void {
    this.formatCommand.emit({ type: 'backgroundColor', value });
  }

  onTextAlign(value: string): void {
    this.formatCommand.emit({ type: 'textAlign', value });
  }

  onLetterSpacingChange(value: string): void {
    this.formatCommand.emit({ type: 'letterSpacing', value });
    this.closeDropdowns();
  }

  onLineHeightChange(value: string): void {
    this.formatCommand.emit({ type: 'lineHeight', value });
    this.closeDropdowns();
  }

  onParagraphSpacingChange(value: string): void {
    this.formatCommand.emit({ type: 'paragraphSpacing', value });
    this.closeDropdowns();
  }

  applyLink(): void {
    const url = this.linkUrl();
    if (url) {
      this.insertLink.emit(url);
    }
    this.closeDropdowns();
    this.linkUrl.set('');
  }

  onInsertEmoji(emoji: string): void {
    this.insertText.emit(emoji);
    this.closeDropdowns();
  }
}
