import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxLexicalEditor } from './ngx-lexical-editor';

describe('NgxLexicalEditor', () => {
  let component: NgxLexicalEditor;
  let fixture: ComponentFixture<NgxLexicalEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxLexicalEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxLexicalEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
