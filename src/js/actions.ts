import { DatePickerModes } from './conts.js';
import { DateTime, Unit } from './datetime';
import Collapse from './display/collapse';
import Namespace from './namespace';
import { OptionsStore } from './options';
import Dates from './dates';
import Validation from './validation';
import Display from './display';
import { EventEmitters } from './event-emitter';
import { ActionTypes } from './actionTypes';
import { ServiceLocator } from './service-locator.js';

/**
 *
 */
export default class Actions {
  private optionsStore: OptionsStore;
  private validation: Validation;
  private dates: Dates;
  private display: Display;

  constructor() {
    this.optionsStore = ServiceLocator.locate(OptionsStore);
    this.dates = ServiceLocator.locate(Dates);
    this.validation = ServiceLocator.locate(Validation);
    this.display = ServiceLocator.locate(Display);
  }

  /**
   * Performs the selected `action`. See ActionTypes
   * @param e This is normally a click event
   * @param action If not provided, then look for a [data-action]
   */
  do(e: any, action?: ActionTypes) {
    const currentTarget = e?.currentTarget;
    if (currentTarget?.classList?.contains(Namespace.css.disabled))
      return false;
    action = action || currentTarget?.dataset?.action;
    const lastPicked = (
      this.dates.lastPicked || this.optionsStore.viewDate
    ).clone;

    switch (action) {
      case ActionTypes.next:
      case ActionTypes.previous:
        this.handleNextPrevious(action);
        break;
      case ActionTypes.pickerSwitch:
        this.display._showMode(1);
        EventEmitters.viewUpdate.emit(
          DatePickerModes[this.optionsStore.currentViewMode].unit
        );
        this.display._updateCalendarHeader();
        break;
      case ActionTypes.selectMonth:
      case ActionTypes.selectYear:
      case ActionTypes.selectDecade:
        const value = +currentTarget.dataset.value;
        switch (action) {
          case ActionTypes.selectMonth:
            this.optionsStore.viewDate.month = value;
            EventEmitters.viewUpdate.emit(Unit.month);
            break;
          case ActionTypes.selectYear:
          case ActionTypes.selectDecade:
            this.optionsStore.viewDate.year = value;
            EventEmitters.viewUpdate.emit(Unit.year);
            break;
        }

        if (
          this.optionsStore.currentViewMode === this.optionsStore.minViewModeNumber
        ) {
          this.dates._setValue(
            this.optionsStore.viewDate,
            this.dates.lastPickedIndex
          );
          if (!this.optionsStore.options.display.inline) {
            this.display.hide();
          }
        } else {
          this.display._showMode(-1);
        }
        break;
      case ActionTypes.selectDay:
        const day = this.optionsStore.viewDate.clone;
        if (currentTarget.classList.contains(Namespace.css.old)) {
          day.manipulate(-1, Unit.month);
        }
        if (currentTarget.classList.contains(Namespace.css.new)) {
          day.manipulate(1, Unit.month);
        }

        day.date = +currentTarget.dataset.day;
        let index = 0;
        if (this.optionsStore.options.multipleDates) {
          index = this.dates.pickedIndex(day, Unit.date);
          if (index !== -1) {
            this.dates._setValue(null, index); //deselect multi-date
          } else {
            this.dates._setValue(
              day,
              this.dates.lastPickedIndex + 1
            );
          }
        } else {
          this.dates._setValue(
            day,
            this.dates.lastPickedIndex
          );
        }

        if (
          !this.display._hasTime &&
          !this.optionsStore.options.display.keepOpen &&
          !this.optionsStore.options.display.inline &&
          !this.optionsStore.options.multipleDates
        ) {
          this.display.hide();
        }
        break;
      case ActionTypes.selectHour:
        let hour = +currentTarget.dataset.value;
        if (
          lastPicked.hours >= 12 &&
          !this.optionsStore.options.display.components.useTwentyfourHour
        )
          hour += 12;
        lastPicked.hours = hour;
        this.dates._setValue(
          lastPicked,
          this.dates.lastPickedIndex
        );
        this.hideOrClock(e);
        break;
      case ActionTypes.selectMinute:
        lastPicked.minutes = +currentTarget.dataset.value;
        this.dates._setValue(
          lastPicked,
          this.dates.lastPickedIndex
        );
        this.hideOrClock(e);
        break;
      case ActionTypes.selectSecond:
        lastPicked.seconds = +currentTarget.dataset.value;
        this.dates._setValue(
          lastPicked,
          this.dates.lastPickedIndex
        );
        this.hideOrClock(e);
        break;
      case ActionTypes.incrementHours:
       this.manipulateAndSet(lastPicked, Unit.hours);
        break;
      case ActionTypes.incrementMinutes:
        this.manipulateAndSet(lastPicked, Unit.minutes, this.optionsStore.options.stepping);
        break;
      case ActionTypes.incrementSeconds:
        this.manipulateAndSet(lastPicked, Unit.seconds);
        break;
      case ActionTypes.decrementHours:
        this.manipulateAndSet(lastPicked, Unit.hours, -1);
        break;
      case ActionTypes.decrementMinutes:
        this.manipulateAndSet(lastPicked, Unit.minutes, this.optionsStore.options.stepping * -1);
        break;
      case ActionTypes.decrementSeconds:
        this.manipulateAndSet(lastPicked, Unit.seconds, -1);
        break;
      case ActionTypes.toggleMeridiem:
        this.manipulateAndSet(lastPicked,
          Unit.hours,
          this.dates.lastPicked.hours >= 12 ? -12 : 12
        );
        break;
      case ActionTypes.togglePicker:
        if (
          currentTarget.getAttribute('title') ===
          this.optionsStore.options.localization.selectDate
        ) {
          currentTarget.setAttribute(
            'title',
            this.optionsStore.options.localization.selectTime
          );
          currentTarget.innerHTML = this.display._iconTag(
            this.optionsStore.options.display.icons.time
          ).outerHTML;

          this.display._updateCalendarHeader();
        } else {
          currentTarget.setAttribute(
            'title',
            this.optionsStore.options.localization.selectDate
          );
          currentTarget.innerHTML = this.display._iconTag(
            this.optionsStore.options.display.icons.date
          ).outerHTML;
          if (this.display._hasTime) {
            this.do(e, ActionTypes.showClock);
            this.display._update('clock');
          }
        }
        this.display.widget
          .querySelectorAll(
            `.${Namespace.css.dateContainer}, .${Namespace.css.timeContainer}`
          )
          .forEach((htmlElement: HTMLElement) => Collapse.toggle(htmlElement));
        break;
      case ActionTypes.showClock:
      case ActionTypes.showHours:
      case ActionTypes.showMinutes:
      case ActionTypes.showSeconds:
        this.display.widget
          .querySelectorAll(`.${Namespace.css.timeContainer} > div`)
          .forEach(
            (htmlElement: HTMLElement) => (htmlElement.style.display = 'none')
          );

        let classToUse = '';
        switch (action) {
          case ActionTypes.showClock:
            classToUse = Namespace.css.clockContainer;
            this.display._update('clock');
            break;
          case ActionTypes.showHours:
            classToUse = Namespace.css.hourContainer;
            this.display._update(Unit.hours);
            break;
          case ActionTypes.showMinutes:
            classToUse = Namespace.css.minuteContainer;
            this.display._update(Unit.minutes);
            break;
          case ActionTypes.showSeconds:
            classToUse = Namespace.css.secondContainer;
            this.display._update(Unit.seconds);
            break;
        }

        (<HTMLElement>(
          this.display.widget.getElementsByClassName(classToUse)[0]
        )).style.display = 'grid';
        break;
      case ActionTypes.clear:
        this.dates._setValue(null);
        this.display._updateCalendarHeader();
        break;
      case ActionTypes.close:
        this.display.hide();
        break;
      case ActionTypes.today:
        const today = new DateTime().setLocale(
          this.optionsStore.options.localization.locale
        );
        this.optionsStore.viewDate = today;
        if (this.validation.isValid(today, Unit.date))
          this.dates._setValue(
            today,
            this.dates.lastPickedIndex
          );
        break;
    }
  }

  private handleNextPrevious(action: ActionTypes) {
    const { unit, step } = DatePickerModes[this.optionsStore.currentViewMode];
    if (action === ActionTypes.next)
      this.optionsStore.viewDate.manipulate(step, unit);
    else this.optionsStore.viewDate.manipulate(step * -1, unit);
    EventEmitters.viewUpdate.emit(unit);

    this.display._showMode();
  }

  /**
   * Common function to manipulate {@link lastPicked} by `unit`.
   * After setting the value it will either show the clock or hide the widget.
   * @param unit
   * @param value Value to change by
   */
  private hideOrClock(e) {
    if (
      this.optionsStore.options.display.components.useTwentyfourHour &&
      !this.optionsStore.options.display.components.minutes &&
      !this.optionsStore.options.display.keepOpen &&
      !this.optionsStore.options.display.inline
    ) {
      this.display.hide();
    } else {
      this.do(e, ActionTypes.showClock);
    }
  }

  /**
   * Common function to manipulate {@link lastPicked} by `unit`.
   * @param unit
   * @param value Value to change by
   */
  private manipulateAndSet(lastPicked: DateTime, unit: Unit, value = 1) {
    const newDate = lastPicked.manipulate(value, unit);
    if (this.validation.isValid(newDate, unit)) {
      this.dates._setValue(
        newDate,
        this.dates.lastPickedIndex
      );
    }
  }
}

