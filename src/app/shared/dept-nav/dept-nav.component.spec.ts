/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { DeptNavComponent } from './dept-nav.component';

describe('DeptNavComponent', () => {
  let component: DeptNavComponent;
  let fixture: ComponentFixture<DeptNavComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DeptNavComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeptNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
