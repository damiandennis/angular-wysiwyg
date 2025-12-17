/*
 * Public API Surface of ngx-lexical-editor
 */

// Main Editor Component
export * from './lib/editor/lexical-editor.component';

// Toolbar Component
export * from './lib/toolbar/floating-toolbar.component';

// Types
export type { EditorConfig, TextFormatState } from './lib/editor/lexical-editor.component';
export type { FormatCommand } from './lib/toolbar/floating-toolbar.component';
