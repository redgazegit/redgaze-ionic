import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

@Component({
  selector: 'app-testbed-test',
  template: `<div>test</div>`,
  standalone: true
})
class TestComponent {}

describe('TestComponent (standalone)', () => {
  let fixture: ComponentFixture<TestComponent>;
  let component: TestComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
  });

  it('should create', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('test');
  });
});