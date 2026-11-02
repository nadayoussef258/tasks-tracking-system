/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { DeptWizardComponent } from './dept-wizard.component';

describe('DeptWizardComponent', () => {
  let component: DeptWizardComponent;
  let fixture: ComponentFixture<DeptWizardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DeptWizardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DeptWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
